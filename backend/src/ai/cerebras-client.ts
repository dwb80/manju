/**
 * @file cerebras-client.ts
 * @description Cerebras Inference 客户端（OpenAI 兼容协议）。支持 chat 流式 + HTTP CONNECT 代理。
 *
 * ## 设计要点
 *  - 默认模型 `gemma-4-31b`，可在 `cerebras-` 前缀下选择其他模型。
 *  - 优先 `CEREBRAS_API_KEY` 环境变量；未配置时 `createCerebrasClient()` 返回 null。
 *  - 支持 HTTP 代理（CONNECT 隧道），避免直连失败。
 *  - 错误统一封装为 `CerebrasError`，携带 status + code 便于上层退避。
 */
import { rootLogger } from "../logger.js";

interface ProxyResponse {
  status: number;
  ok: boolean;
  headers: { get(name: string): string | null };
  body: {
    getReader(): {
      read(): Promise<{ value: Uint8Array | undefined; done: boolean }>;
      releaseLock(): void;
    };
  };
  text(): Promise<string>;
  json(): Promise<unknown>;
}
import type { ChatChunk, ChatParams } from "../types.js";

export class CerebrasError extends Error {
  readonly status: number;
  readonly code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "CerebrasError";
    this.status = status;
    this.code = code;
  }
}

export function isCerebrasError(err: unknown): boolean {
  if (err instanceof CerebrasError) return true;
  if (err && typeof err === "object" && (err as { name?: string }).name === "CerebrasError")
    return true;
  return false;
}

export interface CerebrasClientConfig {
  apiKey: string;
  baseURL?: string;
  proxyURL?: string;
}

export class CerebrasClient {
  private readonly apiKey: string;
  private readonly baseURL: string;
  private readonly proxyURL?: string;

  constructor(config: CerebrasClientConfig) {
    if (!config.apiKey) {
      throw new Error("Cerebras API Key is required");
    }
    this.apiKey = config.apiKey;
    this.baseURL = (config.baseURL || "https://api.cerebras.ai/v1").replace(/\/+$/, "");
    this.proxyURL = config.proxyURL;
  }

  async *chat(params: ChatParams, signal?: AbortSignal): AsyncIterable<ChatChunk> {
    const messages = this.buildMessages(params);
    const model = this.resolveModelName(params.model);
    const debugEnabled = rootLogger.isLevelEnabled("debug");
    const streamStartedAt = debugEnabled ? Date.now() : 0;
    let chunkCount = 0;
    let totalChars = 0;
    if (debugEnabled) {
      rootLogger.debug(
        {
          event: "ai.chat.start",
          provider: "cerebras",
          model,
          promptPreview:
            params.message.length > 500
              ? `${params.message.slice(0, 500)}...<已截断，原始长度=${params.message.length}>`
              : params.message,
          promptLen: params.message.length,
          historyCount: params.history?.length || 0,
        },
        `Cerebras 聊天开始：模型=${model}，提示词=${params.message.length} 字符，历史消息=${params.history?.length || 0
        } 条`,
      );
    }
    const body = {
      model,
      messages,
      stream: true,
      temperature: params.temperature ?? 0.7,
      max_tokens: params.max_tokens ?? 2000,
    };
    const response = await this.request("/chat/completions", {
      method: "POST",
      body: JSON.stringify(body),
      signal,
    });
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("text/event-stream")) {
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      if (!reader) {
        rootLogger.error(
          { event: "ai.chat.error", provider: "cerebras", model, error: "No response body" },
          `Cerebras 聊天失败：模型=${model}，无响应体`,
        );
        throw new CerebrasError("No response body", 500);
      }
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n\n");
          buffer = events.pop() ?? "";
          for (const event of events) {
            if (!event.trim()) continue;
            const line = event.split(/\r?\n/).find((part) => part.startsWith("data:"));
            if (!line) continue;
            const data = line.slice(5).trim();
            if (data === "[DONE]") {
              if (debugEnabled) {
                rootLogger.debug(
                  {
                    event: "ai.chat.finish",
                    provider: "cerebras",
                    model,
                    chunkCount,
                    totalChars,
                    durationMs: Date.now() - streamStartedAt,
                  },
                  `Cerebras 聊天结束：共 ${chunkCount} 个分片，${totalChars} 字符，耗时 ${Date.now() - streamStartedAt}ms`,
                );
              }
              yield { content: "", done: true };
              return;
            }
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content || "";
              if (content) {
                totalChars += content.length;
                chunkCount += 1;
                if (debugEnabled && (chunkCount === 1 || chunkCount % 20 === 0)) {
                  rootLogger.debug(
                    {
                      event: "ai.chat.chunk",
                      provider: "cerebras",
                      model,
                      chunkCount,
                      totalChars,
                      lastChunkLen: content.length,
                      durationMs: Date.now() - streamStartedAt,
                    },
                    `Cerebras 聊天分片 #${chunkCount}：新增 ${content.length} 字符（累计=${totalChars}）`,
                  );
                }
                yield { content };
              }
            } catch (err) {
              rootLogger.warn(
                {
                  event: "ai.chat.sse_bad_data",
                  provider: "cerebras",
                  preview: data.slice(0, 200),
                  err: String(err),
                },
                "Cerebras 跳过一条非 JSON 格式的 SSE 数据行",
              );
            }
          }
        }
        if (buffer.trim()) {
          const line = buffer.split(/\r?\n/).find((part) => part.startsWith("data:"));
          if (line) {
            const data = line.slice(5).trim();
            if (data !== "[DONE]") {
              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content || "";
                if (content) {
                  yield { content };
                }
              } catch (err) {
                rootLogger.warn(
                  {
                    event: "ai.chat.sse_bad_data",
                    provider: "cerebras",
                    preview: data.slice(0, 200),
                    err: String(err),
                  },
                  "Cerebras 缓冲区数据解析失败",
                );
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
      if (debugEnabled) {
        rootLogger.debug(
          {
            event: "ai.chat.finish",
            provider: "cerebras",
            model,
            chunkCount,
            totalChars,
            durationMs: Date.now() - streamStartedAt,
          },
          `Cerebras 聊天结束（流自然结束）：共 ${chunkCount} 个分片，${totalChars} 字符，耗时 ${Date.now() - streamStartedAt}ms`,
        );
      }
      yield { content: "", done: true };
    } else {
      const text = await response.text();
      try {
        const parsed = JSON.parse(text);
        const content = parsed.choices?.[0]?.message?.content || "";
        if (debugEnabled) {
          rootLogger.debug(
            {
              event: "ai.chat.finish",
              provider: "cerebras",
              model,
              chunkCount: 1,
              totalChars: content.length,
              durationMs: Date.now() - streamStartedAt,
            },
            `Cerebras 聊天结束（非流式）：${content.length} 字符，耗时 ${Date.now() - streamStartedAt}ms`,
          );
        }
        yield { content, done: true };
      } catch (err) {
        rootLogger.warn(
          {
            event: "ai.chat.json_parse_failed",
            provider: "cerebras",
            model,
            preview: text.slice(0, 200),
            err: String(err),
          },
          "Cerebras 响应 JSON 解析失败，返回原始文本",
        );
        yield { content: text, done: true };
      }
    }
  }

  async listModels(): Promise<Array<{ id: string; object: string }>> {
    const response = await this.request("/models", { method: "GET" });
    const data = (await response.json()) as { data?: Array<{ id: string; object: string }> };
    return data.data || [];
  }

  private buildMessages(params: ChatParams): Array<{ role: string; content: string }> {
    const messages: Array<{ role: string; content: string }> = [];
    if (params.history) {
      for (const msg of params.history) {
        if (typeof msg.content === "string") {
          messages.push({ role: msg.role, content: msg.content });
        } else {
          const textParts = msg.content
            .filter((part) => part.type === "text")
            .map((part) => part.text)
            .join("\n");
          messages.push({ role: msg.role, content: textParts });
        }
      }
    }
    messages.push({ role: "user", content: params.message });
    return messages;
  }

  private resolveModelName(model?: string): string {
    if (!model) return "gemma-4-31b";
    const m = model.trim().toLowerCase();
    if (m === "gemma-4-31b" || m === "gpt-oss-120b" || m === "zai-glm-4.7") {
      return m;
    }
    return "gemma-4-31b";
  }

  private async request(
    path: string,
    options: { method: string; body?: string; signal?: AbortSignal },
  ): Promise<Response | ProxyResponse> {
    const url = `${this.baseURL}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };
    const response = this.proxyURL
      ? await this.requestWithProxy(url, { ...options, headers })
      : await fetch(url, {
        method: options.method,
        headers,
        body: options.body,
        signal: options.signal,
      });
    if (!response.ok) {
      const text = await response.text();
      let errorMessage = `Cerebras API ${response.status}`;
      let errorCode: string | undefined;
      try {
        const err = JSON.parse(text) as { message?: string; error?: string; code?: string; type?: string };
        errorMessage = err.message || err.error || errorMessage;
        errorCode = err.code || err.type;
      } catch {
        errorMessage = text || errorMessage;
      }
      throw new CerebrasError(errorMessage, response.status, errorCode);
    }
    return response;
  }

  private async requestWithProxy(
    url: string,
    options: { method: string; body?: string; headers: Record<string, string>; signal?: AbortSignal },
  ): Promise<ProxyResponse> {
    const https = await import("node:https");
    const http = await import("node:http");
    const { URL } = await import("node:url");
    const urlObj = new URL(url);
    const proxyObj = new URL(this.proxyURL!);
    return new Promise<ProxyResponse>((resolve, reject) => {
      const proxyReq = http.request({
        hostname: proxyObj.hostname,
        port: parseInt(proxyObj.port) || 80,
        method: "CONNECT",
        path: `${urlObj.hostname}:443`,
      });
      proxyReq.on("connect", (res, socket) => {
        if (res.statusCode !== 200) {
          reject(
            new CerebrasError(
              `Proxy connection failed: ${res.statusCode}`,
              res.statusCode || 500,
            ),
          );
          return;
        }
        // node:https 的 RequestOptions 类型不允许 socket 字段，使用 any 绕过以支持 CONNECT 隧道
        const tls = https.request({
          hostname: urlObj.hostname,
          port: 443,
          path: urlObj.pathname + urlObj.search,
          method: options.method,
          headers: options.headers,
          socket: socket,
          rejectUnauthorized: false,
        } as any);
        if (options.body) {
          tls.write(options.body);
        }
        tls.on("response", (response) => {
          let data = "";
          response.on("data", (chunk: Buffer) => (data += chunk.toString()));
          response.on("end", () => {
            resolve({
              status: response.statusCode || 0,
              ok: (response.statusCode || 0) >= 200 && (response.statusCode || 0) < 300,
              headers: {
                get: (name: string) => {
                  const val = (response.headers as Record<string, string | string[] | undefined>)[
                    name.toLowerCase()
                  ];
                  return Array.isArray(val) ? val[0] : val || null;
                },
              },
              body: {
                getReader: () => {
                  const chunks = [new Uint8Array(Buffer.from(data))];
                  let index = 0;
                  return {
                    read: () => {
                      if (index < chunks.length) {
                        return Promise.resolve({ value: chunks[index++], done: false });
                      }
                      return Promise.resolve({ value: undefined, done: true });
                    },
                    releaseLock: () => {
                      /* noop */
                    },
                  };
                },
              },
              text: () => Promise.resolve(data),
              json: () => Promise.resolve(JSON.parse(data)),
            });
          });
        });
        tls.on("error", (err) => {
          reject(new CerebrasError(err.message, 500));
        });
        tls.end();
      });
      proxyReq.on("error", (err) => {
        reject(new CerebrasError(`Proxy error: ${err.message}`, 500));
      });
      proxyReq.end();
      if (options.signal) {
        options.signal.addEventListener("abort", () => {
          proxyReq.destroy();
          reject(new CerebrasError("Request aborted", 499));
        });
      }
    });
  }
}

export function createCerebrasClient(): CerebrasClient | null {
  const apiKey = process.env.CEREBRAS_API_KEY;
  if (!apiKey) {
    rootLogger.warn("未配置 CEREBRAS_API_KEY，Cerebras 客户端已禁用");
    return null;
  }
  const baseURL = process.env.CEREBRAS_API_BASE_URL;
  const proxyURL =
    process.env.CEREBRAS_PROXY_URL || process.env.HTTP_PROXY || process.env.HTTPS_PROXY;
  return new CerebrasClient({
    apiKey,
    baseURL,
    proxyURL,
  });
}
