/**
 * @file zhipu-client.ts
 * @description 智谱 GLM 客户端（OpenAI 兼容协议）。支持 chat 流式 + 思考模式。
 *
 * ## 设计要点
 *  - 走 OpenAI 兼容协议（POST `/chat/completions`，stream=true）。
 *  - `ZHIPU_API_KEY` 缺失时延迟到首次 chat 抛错（而非启动时崩溃），便于演示模式跑起。
 *  - 支持 `thinking.type = "enabled" | "disabled"`，对应 GLM 思考模式开关。
 *  - 429 限流封装 `ZhipuRateLimitError`，上层可以做退避。
 *  - generateImage / Video / TTS / queryTask / queryVideoStatus 在 GLM-4.7-flash 上下文下显式抛错，
 *    避免误用文本模型做多模态。
 */
import { rootLogger } from "../logger.js";
import type { ChatChunk, ChatParams, ImageParams, TaskStatus, VideoParams } from "../types.js";

const ZHIPU_DEFAULT_BASE_URL = "https://open.bigmodel.cn/api/paas/v4";
const ZHIPU_CHAT_PATH = "/chat/completions";

export type ZhipuApiKeyProvider = () => string | undefined;

export class ZhipuRateLimitError extends Error {
  readonly status: number;
  readonly retryAfterSec?: number;
  constructor(message: string, status: number, retryAfterSec?: number) {
    super(message);
    this.name = "ZhipuRateLimitError";
    this.status = status;
    this.retryAfterSec = retryAfterSec;
  }
}

export interface ZhipuClientOptions {
  apiKey?: string;
  apiKeyProvider?: ZhipuApiKeyProvider;
  baseUrl?: string;
}

export class ZhipuClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly apiKeyProvider?: ZhipuApiKeyProvider;

  constructor(options: ZhipuClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? ZHIPU_DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.apiKey = options.apiKey;
    this.apiKeyProvider = options.apiKeyProvider;
  }

  private resolveApiKey(): string {
    const key = this.apiKey ?? this.apiKeyProvider?.();
    if (!key || !key.trim()) {
      throw new Error(
        "ZHIPU_API_KEY 未配置：请在模型中心 glm-4.7-flash 记录的 api_config.headers.Authorization 中填入真实 Key（Bearer xxx），或在环境变量 ZHIPU_API_KEY 中设置。",
      );
    }
    return key.trim();
  }

  async *chat(params: ChatParams, signal?: AbortSignal): AsyncIterable<ChatChunk> {
    const apiKey = this.resolveApiKey();
    const model = params.model || "glm-4.7-flash";
    const debugEnabled = rootLogger.isLevelEnabled("debug");
    const streamStartedAt = debugEnabled ? Date.now() : 0;
    let chunkCount = 0;
    let totalChars = 0;
    if (debugEnabled) {
      rootLogger.debug(
        {
          event: "ai.chat.start",
          provider: "zhipu",
          model,
          promptPreview:
            params.message.length > 500
              ? `${params.message.slice(0, 500)}...<已截断，原始长度=${params.message.length}>`
              : params.message,
          promptLen: params.message.length,
          thinking: params.thinking?.type || params.chat_template_kwargs?.enable_thinking
            ? "enabled"
            : "disabled",
        },
        `智谱聊天开始：模型=${model}，提示词=${params.message.length} 字符，思考模式=${params.thinking?.type || "disabled"
        }`,
      );
    }
    const raw = String(params.message ?? "");
    const split = raw.split(/\n\n---\n\n/);
    const systemContent = split.length > 1 ? split[0].trim() : "";
    const userContent = split.length > 1 ? split.slice(1).join("\n\n---\n\n").trim() : raw;
    const messages: Array<{ role: "system" | "user"; content: string }> = [];
    if (systemContent) messages.push({ role: "system", content: systemContent });
    messages.push({ role: "user", content: userContent });
    const thinking: { type: "enabled" | "disabled" } | undefined = (() => {
      if (params.thinking?.type === "enabled") return { type: "enabled" };
      if (params.thinking?.type === "disabled") return { type: "disabled" };
      if (params.chat_template_kwargs?.enable_thinking) return { type: "enabled" };
      return undefined;
    })();
    const body: Record<string, unknown> = {
      model,
      messages,
      stream: true,
      temperature: params.temperature ?? 0.2,
      max_tokens: params.max_tokens ?? 4000,
    };
    if (params.top_p != null) body.top_p = params.top_p;
    if (thinking) body.thinking = thinking;
    const response = await fetch(`${this.baseUrl}${ZHIPU_CHAT_PATH}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal,
    });
    if (!response.ok) {
      const detail = await response.text();
      rootLogger.error(
        {
          event: "ai.chat.error",
          provider: "zhipu",
          model,
          status: response.status,
          error: detail.slice(0, 300),
        },
        `智谱聊天失败：模型=${model}，状态码=${response.status}`,
      );
      if (response.status === 429) {
        const retryAfter = Number(response.headers.get("retry-after")) || undefined;
        throw new ZhipuRateLimitError(
          `智谱 API 429: ${detail.slice(0, 300)}`,
          429,
          Number.isFinite(retryAfter) ? retryAfter : undefined,
        );
      }
      throw new Error(`智谱 API ${response.status}: ${detail.slice(0, 300)}`);
    }
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
          const line = event.split(/\r?\n/).find((p) => p.startsWith("data:"));
          if (!line) continue;
          const data = line.slice(5).trim();
          if (data === "[DONE]") {
            if (debugEnabled) {
              rootLogger.debug(
                {
                  event: "ai.chat.finish",
                  provider: "zhipu",
                  model,
                  chunkCount,
                  totalChars,
                  durationMs: Date.now() - streamStartedAt,
                },
                `智谱聊天结束：共 ${chunkCount} 个分片，${totalChars} 字符，耗时 ${Date.now() - streamStartedAt}ms`,
              );
            }
            yield { content: "", done: true };
            return;
          }
          let parsed: unknown;
          try {
            parsed = JSON.parse(data);
          } catch (err) {
            rootLogger.warn(
              {
                event: "ai.chat.sse_bad_data",
                provider: "zhipu",
                preview: data.slice(0, 200),
                err: String(err),
              },
              "智谱跳过一条非 JSON 格式的 SSE 数据行",
            );
            continue;
          }
          const choice = (parsed as { choices?: Array<{ delta?: Record<string, unknown> }> })
            ?.choices?.[0];
          const delta = choice?.delta ?? {};
          const chunk: { content?: string; reasoning?: string } = {};
          if (typeof delta.content === "string" && delta.content.length > 0) {
            chunk.content = delta.content;
            totalChars += delta.content.length;
            chunkCount += 1;
          }
          if (typeof delta.reasoning_content === "string" && delta.reasoning_content.length > 0) {
            chunk.reasoning = delta.reasoning_content;
          }
          if (debugEnabled && chunk.content && (chunkCount === 1 || chunkCount % 20 === 0)) {
            rootLogger.debug(
              {
                event: "ai.chat.chunk",
                provider: "zhipu",
                model,
                chunkCount,
                totalChars,
                lastChunkLen: chunk.content.length,
                durationMs: Date.now() - streamStartedAt,
              },
              `智谱聊天分片 #${chunkCount}：新增 ${chunk.content.length} 字符（累计=${totalChars}）`,
            );
          }
          if (chunk.content || chunk.reasoning) yield chunk;
        }
      }
      if (debugEnabled) {
        rootLogger.debug(
          {
            event: "ai.chat.finish",
            provider: "zhipu",
            model,
            chunkCount,
            totalChars,
            durationMs: Date.now() - streamStartedAt,
          },
          `智谱聊天结束（流自然结束）：共 ${chunkCount} 个分片，${totalChars} 字符，耗时 ${Date.now() - streamStartedAt}ms`,
        );
      }
      yield { content: "", done: true };
      return;
    }
    const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const choice = payload?.choices?.[0];
    const content = choice?.message?.content ?? "";
    if (debugEnabled) {
      rootLogger.debug(
        {
          event: "ai.chat.finish",
          provider: "zhipu",
          model,
          chunkCount: 1,
          totalChars: content.length,
          durationMs: Date.now() - streamStartedAt,
        },
        `智谱聊天结束（非流式）：${content.length} 字符，耗时 ${Date.now() - streamStartedAt}ms`,
      );
    }
    yield { content: String(content), done: true };
  }

  async generateImage(_params: ImageParams, _signal?: AbortSignal): Promise<{ imageUrls: string[] }> {
    throw new Error(
      "智谱 glm-4.7-flash 是文本模型，不支持图片生成。请使用 agnes-image-2.1-flash。",
    );
  }

  async generateVideo(_params: VideoParams, _signal?: AbortSignal): Promise<{ taskId: string }> {
    throw new Error(
      "智谱 glm-4.7-flash 是文本模型，不支持视频生成。请使用 agnes-video-v2.0。",
    );
  }

  async queryTask(
    _taskId: string,
    _signal?: AbortSignal,
  ): Promise<{ status: TaskStatus; videoUrl?: string; error?: string }> {
    throw new Error("智谱 glm-4.7-flash 是文本模型，无视频任务状态可查询。");
  }

  async generateTTS(
    _params: { text: string; voice?: string; emotion?: string; speed?: number; format?: string },
    _signal?: AbortSignal,
  ): Promise<{
    file_url: string;
    duration: number;
    status: string;
    voice?: string;
    emotion?: string;
  }> {
    throw new Error("智谱 glm-4.7-flash 是文本模型，TTS 暂未实现。");
  }

  async queryVideoStatus(
    _taskId: string,
    _signal?: AbortSignal,
  ): Promise<{ status: string; progress: number; file_url: string; error: string }> {
    throw new Error("智谱 glm-4.7-flash 是文本模型，无视频任务状态可查询。");
  }
}

export function createZhipuClient(options: ZhipuClientOptions = {}): ZhipuClient {
  const env = options.apiKey ? undefined : process.env.ZHIPU_API_KEY;
  if (!options.apiKey && !options.apiKeyProvider) {
    rootLogger.info(
      { event: "ai.zhipu.init", source: env ? "env" : "missing" },
      env ? "智谱客户端从环境变量读取 API Key" : "智谱客户端未配置 API Key，需在调用前注入",
    );
  }
  return new ZhipuClient({ ...options, apiKey: options.apiKey ?? env });
}
