import type { ChatChunk, ChatParams, ImageParams, TaskStatus, VideoParams } from "../types.js";

export interface AgnesClient {
  /** 发送聊天请求，并以文本片段形式返回回复。 */
  chat(params: ChatParams, signal?: AbortSignal): AsyncIterable<ChatChunk>;
  /** 发送图片生成请求，返回图片地址列表。 */
  generateImage(params: ImageParams): Promise<{ imageUrls: string[] }>;
  /** 发送视频生成请求，返回异步任务 ID。 */
  generateVideo(params: VideoParams): Promise<{ taskId: string; providerTaskId?: string; videoId?: string; progress?: number; seconds?: string; size?: string }>;
  /** 查询视频任务状态和结果地址。 */
  queryTask(taskId: string): Promise<{ status: TaskStatus; videoUrl?: string; error?: string }>;
  /** 调用 TTS 文本转语音（占位：Agnes 暂未提供 TTS，返回空 file_url 让前端降级）。 */
  generateTTS(params: { text: string; voice?: string; emotion?: string; speed?: number; format?: string }): Promise<{ file_url: string; duration: number; status: string; voice?: string; emotion?: string }>;
  /** 查询任务状态（兼容旧版）。 */
  queryVideoStatus(taskId: string): Promise<{ status: string; progress: number; file_url: string; error: string }>;
}

/** 等待指定毫秒数，主要给模拟客户端制造流式输出节奏。 */
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

  /** 调用 Agnes 图片生成接口，返回可展示或缓存的图片地址。 */
  async generateImage(params: ImageParams): Promise<{ imageUrls: string[] }> {
    const response = await this.post(this.imagePath, {
      model: "agnes-image-2.1-flash",
      prompt: params.prompt,
      size: params.size ?? "1024x768",
      n: params.n ?? 1,
      quality: "standard",
      extra_body: {
        image: params.images?.length ? params.images : params.image ? [params.image] : undefined,
        negative_prompt: params.negative_prompt || undefined,
        ratio: params.ratio,
        seed: params.seed,
        steps: params.steps,
        cfg: params.cfg,
        response_format: "url",
      },
    });
    const payload = await response.json();
    const imageUrls = parseImageUrls(payload);
    if (imageUrls.length === 0) throw new Error("Agnes image API returned no image URLs");
    return { imageUrls };
  }

  /** 调用 Agnes 视频生成接口，创建异步视频任务并返回任务 ID。 */
  async generateVideo(params: VideoParams): Promise<{ taskId: string; providerTaskId?: string; videoId?: string; progress?: number; seconds?: string; size?: string }> {
    const response = await this.post(this.videoPath, {
      model: params.model ?? "agnes-video-v2.0",
      prompt: params.prompt,
      image: params.image,
      width: params.ratio === "9:16" ? 768 : params.ratio === "1:1" ? 768 : 1152,
      height: params.ratio === "9:16" ? 1152 : 768,
      num_frames: params.duration === 10 ? 241 : 121,
      frame_rate: 24,
    });
    const payload = await response.json();
    const data = asRecord(asRecord(payload).data);
    const taskId = pickString(payload, ["video_id", "videoId", "task_id", "taskId", "id"]) ||
      pickString(data, ["video_id", "videoId", "task_id", "taskId", "id"]);
    if (!taskId) throw new Error("Agnes video API returned no task id");
    return { taskId };
  }

  /** 查询 Agnes 视频任务状态，并归一化状态、视频地址和错误信息。 */
  async queryTask(taskId: string): Promise<{ status: TaskStatus; videoUrl?: string; error?: string }> {
    const path = this.videoTaskPathTemplate.replace(":taskId", encodeURIComponent(taskId));
    const response = await this.get(path);
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
  async generateTTS(params: { text: string; voice?: string; emotion?: string; speed?: number; format?: string }): Promise<{ file_url: string; duration: number; status: string; voice?: string; emotion?: string }> {
    void params;
    return { file_url: "", duration: 0, status: "queued", voice: params.voice, emotion: params.emotion };
  }

  /** 查询视频任务状态（带进度和错误），与 queryTask 等价。 */
  async queryVideoStatus(taskId: string): Promise<{ status: string; progress: number; file_url: string; error: string }> {
    const r = await this.queryTask(taskId);
    const progress = r.status === "success" ? 100 : r.status === "failed" ? 0 : 50;
    return { status: r.status, progress, file_url: r.videoUrl ?? "", error: r.error ?? "" };
  }

  /** 发起带认证信息的 GET 请求。 */
  private async get(route: string): Promise<Response> {
    return this.request(route, { method: "GET" });
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

  /** 统一发送 Agnes HTTP 请求，并把非 2xx 响应转成可读错误。 */
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
  /** 模拟聊天流式回复，便于没有 API Key 时开发前端。 */
  async *chat(params: ChatParams, signal?: AbortSignal): AsyncIterable<ChatChunk> {
    const text = `我已收到你的请求：${params.message}\n\n这是 Agnes 2.0 Flash 的本地模拟回复。你可以继续追问、重新生成，或切换到图片和视频工作流。`;
    for (const part of text.match(/.{1,8}/gs) ?? []) {
      if (signal?.aborted) return;
      await sleep(35);
      yield { content: part };
    }
    yield { content: "", done: true };
  }

  /** 生成占位图片 URL，模拟图片生成结果。 */
  async generateImage(params: ImageParams): Promise<{ imageUrls: string[] }> {
    const count = Math.min(4, Math.max(1, params.n ?? 1));
    const urls = Array.from({ length: count }, (_, index) => {
      const label = encodeURIComponent(`${params.prompt} #${index + 1}`);
      return `https://placehold.co/1024x768/0d0d0d/10a37f/png?text=${label}`;
    });
    return { imageUrls: urls };
  }

  /** 生成本地模拟视频任务 ID。 */
  async generateVideo(params: VideoParams): Promise<{ taskId: string; providerTaskId?: string; videoId?: string; progress?: number; seconds?: string; size?: string }> {
    const seed = Buffer.from(`${params.prompt}-${Date.now()}`).toString("base64url").slice(0, 12);
    return { taskId: `v-${seed}` };
  }

  /** 返回固定示例视频，模拟视频任务已完成。 */
  async queryTask(taskId: string): Promise<{ status: TaskStatus; videoUrl?: string }> {
    return {
      status: "success",
      videoUrl: `https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4#${taskId}`,
    };
  }

  /** 模拟 TTS：直接返回占位 file_url，前端标记为"待生成"。 */
  async generateTTS(params: { text: string; voice?: string; emotion?: string; speed?: number; format?: string }): Promise<{ file_url: string; duration: number; status: string; voice?: string; emotion?: string }> {
    void params;
    return { file_url: "", duration: 0, status: "queued", voice: params.voice, emotion: params.emotion };
  }

  /** 模拟视频状态查询。 */
  async queryVideoStatus(taskId: string): Promise<{ status: string; progress: number; file_url: string; error: string }> {
    return { status: "completed", progress: 100, file_url: `https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4#${taskId}`, error: "" };
  }
}

/** 根据环境变量选择真实 Agnes 客户端或本地模拟客户端。 */
export function createAgnesClient(env = process.env): AgnesClient {
  if (env.AGNES_API_KEY && env.AGNES_USE_REAL_API !== "false") {
    return new RealAgnesClient(env);
  }
  return new MockAgnesClient();
}
