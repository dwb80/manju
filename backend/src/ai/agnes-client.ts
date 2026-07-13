import type { ChatChunk, ChatParams, ImageParams, TaskStatus, VideoParams } from "../types.js";
import { rootLogger } from "../logger.js";

/**
 * Agnes API 限流错误（HTTP 429 / 配额用尽）。
 * 抛此类型可让上层（domain service、前端）做"等待后重试 / 降级"等差异化处理。
 */
export class AgnesRateLimitError extends Error {
  readonly status: number;
  readonly retryAfterSec?: number;
  constructor(message: string, status: number, retryAfterSec?: number) {
    super(message);
    this.name = "AgnesRateLimitError";
    this.status = status;
    this.retryAfterSec = retryAfterSec;
  }
}

/** 识别一个错误是否为 Agnes 限流错误（兼容旧代码用字符串前缀抛错的情况）。 */
export function isAgnesRateLimitError(err: unknown): boolean {
  if (err instanceof AgnesRateLimitError) return true;
  if (err && typeof err === "object" && (err as { name?: string }).name === "AgnesRateLimitError") return true;
  if (err instanceof Error) return /Agnes API 429|rate.?limit|quota.?exceed/i.test(err.message);
  return false;
}

export interface AgnesClient {
  /** 发送聊天请求，并以文本片段形式返回回复。 */
  chat(params: ChatParams, signal?: AbortSignal): AsyncIterable<ChatChunk>;
  /** 发送图片生成请求，返回图片地址列表。 */
  generateImage(params: ImageParams, signal?: AbortSignal): Promise<{ imageUrls: string[] }>;
  /** 发送视频生成请求，返回异步任务 ID。 */
  generateVideo(params: VideoParams, signal?: AbortSignal): Promise<{ taskId: string; providerTaskId?: string; videoId?: string; progress?: number; seconds?: string; size?: string }>;
  /** 查询视频任务状态和结果地址。 */
  queryTask(taskId: string, signal?: AbortSignal): Promise<{ status: TaskStatus; videoUrl?: string; error?: string }>;
  /** 调用 TTS 文本转语音（占位：Agnes 暂未提供 TTS，返回空 file_url 让前端降级）。 */
  generateTTS(params: { text: string; voice?: string; emotion?: string; speed?: number; format?: string }, signal?: AbortSignal): Promise<{ file_url: string; duration: number; status: string; voice?: string; emotion?: string }>;
  /** 查询任务状态（兼容旧版）。 */
  queryVideoStatus(taskId: string, signal?: AbortSignal): Promise<{ status: string; progress: number; file_url: string; error: string }>;
}

/** 等待指定毫秒数，给真实流式 API 输出节奏。 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 拼接 API 根地址和接口路径，避免重复或缺失斜杠。 */
function joinUrl(baseUrl: string, route: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/${route.replace(/^\/+/, "")}`;
}

/** 把旧文档中的 Agnes 地址归一化为实际 API Hub 地址。 */
function normalizeBaseUrl(baseUrl: string): string {
  if (baseUrl === "https://agnes-ai.com/api" || baseUrl === "https://www.agnes-ai.com/api") {
    return "https://apihub.agnes-ai.com";
  }
  return baseUrl;
}

/** 把未知返回值安全转换成普通对象，避免直接访问时报错。 */
function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

/** 从对象的多个候选字段里取第一个非空字符串。 */
function pickString(value: unknown, keys: string[]): string {
  const record = asRecord(value);
  for (const key of keys) {
    const candidate = record[key];
    if (typeof candidate === "string" && candidate.length > 0) return candidate;
  }
  return "";
}

/** 从聊天接口的多种返回格式中提取文本内容。 */
function parseContent(payload: unknown): string {
  const record = asRecord(payload);
  const choices = Array.isArray(record.choices) ? record.choices : [];
  const firstChoice = asRecord(choices[0]);
  const delta = asRecord(firstChoice.delta);
  const message = asRecord(firstChoice.message);
  return pickString(delta, ["content"]) ||
    pickString(message, ["content"]) ||
    pickString(record, ["output_text", "text", "content", "message"]);
}

/** 从图片接口的多种返回格式中提取图片 URL 列表。 */
function parseImageUrls(payload: unknown): string[] {
  const record = asRecord(payload);
  const direct = record.image_urls ?? record.images;
  if (Array.isArray(direct)) return direct.filter((url): url is string => typeof url === "string");
  const data = Array.isArray(record.data) ? record.data : [];
  return data
    .map((item) => pickString(item, ["url", "image_url", "b64_json"]))
    .filter(Boolean);
}

export class RealAgnesClient implements AgnesClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly chatPath: string;
  private readonly imagePath: string;
  private readonly videoPath: string;
  private readonly videoTaskPathTemplate: string;

  /** 读取环境变量并初始化真实 Agnes API 的地址和路径。 */
  constructor(env = process.env) {
    if (!env.AGNES_API_KEY) throw new Error("AGNES_API_KEY is required for real Agnes API mode");
    this.apiKey = env.AGNES_API_KEY;
    this.baseUrl = normalizeBaseUrl(env.AGNES_API_BASE_URL ?? "https://apihub.agnes-ai.com");
    this.chatPath = env.AGNES_CHAT_PATH ?? "/v1/chat/completions";
    this.imagePath = env.AGNES_IMAGE_PATH ?? "/v1/images/generations";
    this.videoPath = env.AGNES_VIDEO_PATH ?? "/v1/videos";
    this.videoTaskPathTemplate = env.AGNES_VIDEO_TASK_PATH ?? "/agnesapi?video_id=:taskId";
  }

  /** 调用 Agnes 聊天接口，并把 SSE 或普通 JSON 响应统一转成文本片段。 */
  async *chat(params: ChatParams, signal?: AbortSignal): AsyncIterable<ChatChunk> {
    const response = await this.post(this.chatPath, {
      model: params.model ?? "agnes-2.0-flash",
      stream: true,
      messages: [{ role: "user", content: params.message }],
    }, signal);

    const contentType = response.headers.get("content-type") ?? "";
    if (response.body && contentType.includes("text/event-stream")) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const event of events) {
          const line = event.split(/\r?\n/).find((part) => part.startsWith("data:"));
          if (!line) continue;
          const data = line.slice(5).trim();
          if (data === "[DONE]") {
            yield { content: "", done: true };
            return;
          }
          const content = parseContent(JSON.parse(data));
          if (content) yield { content };
        }
      }
      yield { content: "", done: true };
      return;
    }

    const payload = await response.json();
    const content = parseContent(payload);
    yield { content, done: true };
  }

  /** 调用 Agnes 图片生成接口，返回可展示或缓存的图片地址。
   *  根据 images.txt 文档:响应 `data: [{url, b64_json, ...}]` 是单元素数组,无 `n` 参数文档,
   *  因此 n>1 时必须由客户端并发调用 N 次,然后合并 URL 列表。
   *  使用 Promise.allSettled 保证"部分失败"也能拿到部分结果(2/4 比 0/4 强),
   *  限流错误 (429) 立即 reject 全部 + abort,避免继续打 API 加重限流。 */
  async generateImage(params: ImageParams, signal?: AbortSignal): Promise<{ imageUrls: string[] }> {
    // response_format 必须是 extra_body.response_format（顶层会被忽略），
    // 默认 url；调用方可通过 params.response_format 显式切换为 b64_json。
    const responseFormat = params.response_format === "b64_json" ? "b64_json" : "url";
    const referenceImages = params.images?.length
      ? params.images
      : params.image
        ? [params.image]
        : undefined;
    const n = Math.max(1, Math.min(4, params.n ?? 1));

    // 单张:n === 1,保持原行为(单次 POST,简单快速)
    if (n === 1) {
      const response = await this.post(this.imagePath, {
        model: params.model ?? "agnes-image-2.1-flash",
        prompt: params.prompt,
        size: params.size ?? "1024x768",
        n: 1,
        quality: "standard",
        extra_body: {
          ...(referenceImages ? { image: referenceImages } : {}),
          negative_prompt: params.negative_prompt || undefined,
          ratio: params.ratio,
          seed: params.seed,
          steps: params.steps,
          cfg: params.cfg,
          response_format: responseFormat,
        },
      }, signal);
      const payload = await response.json();
      const imageUrls = parseImageUrls(payload);
      if (imageUrls.length === 0) throw new Error("Agnes image API returned no image URLs");
      return { imageUrls };
    }

    // 多张:N 次并行 POST(每张独立随机种子,得到差异化的图;同时请求耗时从 N×30s 缩到 ~30s)
    // 用 allSettled 而不是 all:允许部分失败(用户能看到 3/4 也比 0/4 强)
    const tasks = Array.from({ length: n }, () => this.callSingleImageGeneration(params, referenceImages, responseFormat, signal));
    const results = await Promise.allSettled(tasks);

    // 限流错误:任何一个 reject 是 429,立即终止整批(其他并行请求继续打也只会得到 429)
    // AbortSignal 是只读的,无法在 signal 上调 abort();但上层 withTimeout 60s 后会自动 abort,
    // 期间已 in-flight 的请求会陆续收到 429 自然 reject,服务端负载不会显著加重
    for (const result of results) {
      if (result.status === "rejected" && isAgnesRateLimitError(result.reason)) {
        throw result.reason;
      }
    }

    // 合并成功的 URL
    const imageUrls: string[] = [];
    let successCount = 0;
    let failCount = 0;
    const firstError = (results.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined)?.reason;
    for (const result of results) {
      if (result.status === "fulfilled") {
        imageUrls.push(...result.value);
        successCount += 1;
      } else {
        failCount += 1;
      }
    }
    if (successCount === 0) {
      // 全部失败:抛首个错误,让上层有具体的失败原因
      throw firstError instanceof Error ? firstError : new Error("Agnes image API returned no image URLs");
    }
    if (failCount > 0) {
      // 部分失败:不抛错,只记日志(前端能拿到部分结果,体验更好)
      rootLogger.warn(
        {
          event: "ai.image.partial_failure",
          requested: n,
          succeeded: successCount,
          failed: failCount,
          err: firstError,
        },
        "Agnes image generation partially failed; returning successful URLs only"
      );
    }
    return { imageUrls };
  }

  /** 单次图片生成 POST 调用,供 generateImage 并发复用。 */
  private async callSingleImageGeneration(
    params: ImageParams,
    referenceImages: string[] | undefined,
    responseFormat: "url" | "b64_json",
    signal?: AbortSignal
  ): Promise<string[]> {
    const response = await this.post(this.imagePath, {
      model: params.model ?? "agnes-image-2.1-flash",
      prompt: params.prompt,
      size: params.size ?? "1024x768",
      n: 1,
      quality: "standard",
      // 不传 seed:让 API 自己随机,这样 N 次并行能产生不同结果
      extra_body: {
        ...(referenceImages ? { image: referenceImages } : {}),
        negative_prompt: params.negative_prompt || undefined,
        ratio: params.ratio,
        steps: params.steps,
        cfg: params.cfg,
        response_format: responseFormat,
      },
    }, signal);
    const payload = await response.json();
    return parseImageUrls(payload);
  }

  /** 调用 Agnes 视频生成接口，创建异步视频任务并返回任务 ID。 */
  async generateVideo(params: VideoParams, signal?: AbortSignal): Promise<{ taskId: string; providerTaskId?: string; videoId?: string; progress?: number; seconds?: string; size?: string }> {
    const response = await this.post(this.videoPath, {
      model: params.model ?? "agnes-video-v2.0",
      prompt: params.prompt,
      image: params.image,
      width: params.ratio === "9:16" ? 768 : params.ratio === "1:1" ? 768 : 1152,
      height: params.ratio === "9:16" ? 1152 : 768,
      num_frames: params.duration === 10 ? 241 : 121,
      frame_rate: 24,
    }, signal);
    const payload = await response.json();
    const data = asRecord(asRecord(payload).data);
    const taskId = pickString(payload, ["video_id", "videoId", "task_id", "taskId", "id"]) ||
      pickString(data, ["video_id", "videoId", "task_id", "taskId", "id"]);
    if (!taskId) throw new Error("Agnes video API returned no task id");
    return { taskId };
  }

  /** 查询 Agnes 视频任务状态，并归一化状态、视频地址和错误信息。 */
  async queryTask(taskId: string, signal?: AbortSignal): Promise<{ status: TaskStatus; videoUrl?: string; error?: string }> {
    const path = this.videoTaskPathTemplate.replace(":taskId", encodeURIComponent(taskId));
    const response = await this.get(path, signal);
    const payload = await response.json();
    const data = asRecord(asRecord(payload).data);
    const rawStatus = pickString(payload, ["status"]) || pickString(data, ["status"]) || "processing";
    const status = this.normalizeStatus(rawStatus);
    const videoUrl = pickString(payload, ["video_url", "videoUrl", "url", "remixed_from_video_id"]) ||
      pickString(data, ["video_url", "videoUrl", "url", "remixed_from_video_id"]);
    const error = pickString(payload, ["error", "message"]) || pickString(data, ["error", "message"]);
    return { status, videoUrl: videoUrl || undefined, error: error || undefined };
  }

  /** 文本转语音：Agnes 暂不提供 TTS，前端按占位实现处理。 */
  async generateTTS(params: { text: string; voice?: string; emotion?: string; speed?: number; format?: string }, signal?: AbortSignal): Promise<{ file_url: string; duration: number; status: string; voice?: string; emotion?: string }> {
    void params; void signal;
    return { file_url: "", duration: 0, status: "queued", voice: params.voice, emotion: params.emotion };
  }

  /** 查询视频任务状态（带进度和错误），与 queryTask 等价。 */
  async queryVideoStatus(taskId: string, signal?: AbortSignal): Promise<{ status: string; progress: number; file_url: string; error: string }> {
    const r = await this.queryTask(taskId, signal);
    const progress = r.status === "success" ? 100 : r.status === "failed" ? 0 : 50;
    return { status: r.status, progress, file_url: r.videoUrl ?? "", error: r.error ?? "" };
  }

  /** 发起带认证信息的 GET 请求。 */
  private async get(route: string, signal?: AbortSignal): Promise<Response> {
    return this.request(route, { method: "GET", signal });
  }

  /** 发起带 JSON 请求体和认证信息的 POST 请求。 */
  private async post(route: string, body: unknown, signal?: AbortSignal): Promise<Response> {
    return this.request(route, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  }

  /** 统一发送 Agnes HTTP 请求，并把非 2xx 响应转成可读错误（429 抛 AgnesRateLimitError）。 */
  private async request(route: string, init: RequestInit): Promise<Response> {
    const response = await fetch(joinUrl(this.baseUrl, route), {
      ...init,
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        ...(init.headers ?? {}),
      },
    });
    if (!response.ok) {
      const detail = await response.text();
      // 限流：抛类型化错误，让上层做重试 / 降级
      if (response.status === 429) {
        const retryAfter = Number(response.headers.get("retry-after")) || undefined;
        throw new AgnesRateLimitError(
          `Agnes API 429: ${detail.slice(0, 300)}`,
          429,
          Number.isFinite(retryAfter) ? retryAfter : undefined
        );
      }
      throw new Error(`Agnes API ${response.status}: ${detail.slice(0, 300)}`);
    }
    return response;
  }

  /** 把不同厂商可能返回的任务状态归一化为前端使用的四种状态。 */
  private normalizeStatus(status: string): TaskStatus {
    if (["completed", "complete", "succeeded", "success"].includes(status)) return "success";
    if (["queued", "pending"].includes(status)) return "pending";
    if (["failed", "error", "cancelled", "canceled"].includes(status)) return "failed";
    return "processing";
  }
}

export class MockAgnesClient implements AgnesClient {
  // 已废弃：所有 AI 能力必须走真实 API。
  // 保留空类仅为兼容旧代码导入，构造时直接抛错，避免任何"模拟"数据被上层误用。
  constructor() {
    throw new Error("MockAgnesClient 已废弃：所有 AI 能力必须通过真实 API（AGNES_API_KEY）。请在前端或后端配置真实 API Key 后重启。")
  }
  async *chat(): AsyncIterable<ChatChunk> { throw new Error("MockAgnesClient 已废弃") }
  async generateImage(): Promise<{ imageUrls: string[] }> { throw new Error("MockAgnesClient 已废弃") }
  async generateVideo(): Promise<{ taskId: string }> { throw new Error("MockAgnesClient 已废弃") }
  async queryTask(): Promise<{ status: TaskStatus; videoUrl?: string }> { throw new Error("MockAgnesClient 已废弃") }
  async generateTTS(): Promise<{ file_url: string; duration: number; status: string }> { throw new Error("MockAgnesClient 已废弃") }
  async queryVideoStatus(): Promise<{ status: string; progress: number; file_url: string; error: string }> { throw new Error("MockAgnesClient 已废弃") }
}

/** 创建真实 Agnes API 客户端。未配置 AGNES_API_KEY 时直接抛错，不提供任何 mock 兜底。 */
export function createAgnesClient(env = process.env): AgnesClient {
  if (!env.AGNES_API_KEY) {
    throw new Error("AGNES_API_KEY 未配置：所有 AI 能力（剧本分析、聊天、生图、生视频）必须通过真实 API。请在 backend/.env 配置 AGNES_API_KEY 后重启。")
  }
  return new RealAgnesClient(env)
}
