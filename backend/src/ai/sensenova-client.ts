/**
 * @file sensenova-client.ts
 * @description 商汤日日新 SenseNova 客户端（OpenAI 兼容协议）。支持 chat 流式 + HTTP CONNECT 代理。
 *
 * ## 设计要点
 *  - 优先 `SENSENOVA_API_KEY` 环境变量；未配置时 `createSenseNovaClient()` 返回 null。
 *  - 支持 `sensenova-` 前缀 + GLM-5 系列别名（兼容模型中心别名）。
 *  - SSE 解析兼容顶层 `choices` 与嵌套 `data.choices` 两种 schema。
 *  - 错误统一封装为 `SenseNovaError`，SSE 无正文时附带响应结构便于排查。
 */
import { rootLogger } from "../logger.js";
import type { ChatChunk, ChatParams } from "../types.js";

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

function describeResponseShape(value: unknown): string {
  const record =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const data =
    record.data && typeof record.data === "object" && !Array.isArray(record.data)
      ? (record.data as Record<string, unknown>)
      : {};
  const choices = Array.isArray(record.choices)
    ? record.choices
    : Array.isArray(data.choices)
      ? data.choices
      : [];
  const choice = choices[0] && typeof choices[0] === "object" ? (choices[0] as Record<string, unknown>) : {};
  const delta =
    choice.delta && typeof choice.delta === "object" ? (choice.delta as Record<string, unknown>) : {};
  const message =
    choice.message && typeof choice.message === "object"
      ? (choice.message as Record<string, unknown>)
      : {};
  return `top=${Object.keys(record).sort().join(",")};data=${Object.keys(data).sort().join(
    ",",
  )};choice=${Object.keys(choice).sort().join(",")};delta=${Object.keys(delta).sort().join(
    ",",
  )};message=${Object.keys(message).sort().join(",")}`;
}

export class SenseNovaError extends Error {
  readonly status: number;
  readonly code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "SenseNovaError";
    this.status = status;
    this.code = code;
  }
}

export function isSenseNovaError(err: unknown): boolean {
  if (err instanceof SenseNovaError) return true;
  if (err && typeof err === "object" && (err as { name?: string }).name === "SenseNovaError")
    return true;
  return false;
}

export interface SenseNovaClientConfig {
  apiKey: string;
  baseURL?: string;
  proxyURL?: string;
}

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

export class SenseNovaClient {
  private readonly apiKey: string;
  private readonly baseURL: string;
  private readonly proxyURL?: string;

  constructor(config: SenseNovaClientConfig) {
    if (!config.apiKey) {
      throw new Error("SenseNova API Key is required");
    }
    this.apiKey = config.apiKey;
    this.baseURL = (config.baseURL || "https://api.sensenova.cn/v1").replace(/\/+$/, "");
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
          provider: "sensenova",
          model,
          promptPreview:
            params.message.length > 500
              ? `${params.message.slice(0, 500)}...<已截断，原始长度=${params.message.length}>`
              : params.message,
          promptLen: params.message.length,
          historyCount: params.history?.length || 0,
        },
        `商汤聊天开始：模型=${model}，提示词=${params.message.length} 字符，历史消息=${params.history?.length || 0
        } 条`,
      );
    }
    const body = {
      model,
      messages,
      stream: true,
      thinking: { enabled: false },
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
      let emittedContent = false;
      const observedShapes = new Set<string>();
      if (!reader) {
        rootLogger.error(
          { event: "ai.chat.error", provider: "sensenova", model, error: "No response body" },
          `商汤聊天失败：模型=${model}，无响应体`,
        );
        throw new SenseNovaError("No response body", 500);
      }
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split(/\r?\n\r?\n/);
          buffer = events.pop() ?? "";
          for (const event of events) {
            if (!event.trim()) continue;
            const line = event.split(/\r?\n/).find((part) => part.startsWith("data:"));
            if (!line) continue;
            const data = line.slice(5).trim();
            if (data === "[DONE]") {
              if (!emittedContent) {
                rootLogger.error(
                  {
                    event: "ai.chat.error",
                    provider: "sensenova",
                    model,
                    responseShapes: [...observedShapes].join(" | "),
                  },
                  `商汤聊天失败：模型=${model}，SSE 未返回正文`,
                );
                throw new SenseNovaError(
                  `SenseNova SSE 未返回正文；响应结构：${[...observedShapes].join(" | ") || "无 JSON 事件"
                  }`,
                  502,
                );
              }
              if (debugEnabled) {
                rootLogger.debug(
                  {
                    event: "ai.chat.finish",
                    provider: "sensenova",
                    model,
                    chunkCount,
                    totalChars,
                    durationMs: Date.now() - streamStartedAt,
                  },
                  `商汤聊天结束：共 ${chunkCount} 个分片，${totalChars} 字符，耗时 ${Date.now() - streamStartedAt}ms`,
                );
              }
              yield { content: "", done: true };
              return;
            }
            try {
              const parsed = JSON.parse(data);
              observedShapes.add(describeResponseShape(parsed));
              const choice = parsed.choices?.[0] ?? parsed.data?.choices?.[0];
              const content =
                typeof choice?.delta === "string"
                  ? choice.delta
                  : choice?.delta?.content ||
                  (typeof choice?.message === "string" ? choice.message : choice?.message?.content) ||
                  "";
              if (content) {
                emittedContent = true;
                totalChars += content.length;
                chunkCount += 1;
                if (debugEnabled && (chunkCount === 1 || chunkCount % 20 === 0)) {
                  rootLogger.debug(
                    {
                      event: "ai.chat.chunk",
                      provider: "sensenova",
                      model,
                      chunkCount,
                      totalChars,
                      lastChunkLen: content.length,
                      durationMs: Date.now() - streamStartedAt,
                    },
                    `商汤聊天分片 #${chunkCount}：新增 ${content.length} 字符（累计=${totalChars}）`,
                  );
                }
                yield { content };
              }
            } catch (err) {
              rootLogger.warn(
                {
                  event: "ai.chat.sse_bad_data",
                  provider: "sensenova",
                  preview: data.slice(0, 200),
                  err: String(err),
                },
                "商汤跳过一条非 JSON 格式的 SSE 数据行",
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
                observedShapes.add(describeResponseShape(parsed));
                const choice = parsed.choices?.[0] ?? parsed.data?.choices?.[0];
                const content =
                  typeof choice?.delta === "string"
                    ? choice.delta
                    : choice?.delta?.content ||
                    (typeof choice?.message === "string" ? choice.message : choice?.message?.content) ||
                    "";
                if (content) {
                  emittedContent = true;
                  yield { content };
                }
              } catch (err) {
                rootLogger.warn(
                  {
                    event: "ai.chat.sse_bad_data",
                    provider: "sensenova",
                    preview: data.slice(0, 200),
                    err: String(err),
                  },
                  "商汤缓冲区数据解析失败",
                );
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
      if (!emittedContent) {
        rootLogger.error(
          {
            event: "ai.chat.error",
            provider: "sensenova",
            model,
            responseShapes: [...observedShapes].join(" | "),
          },
          `商汤聊天失败：模型=${model}，SSE 未返回正文`,
        );
        throw new SenseNovaError(
          `SenseNova SSE 未返回正文；响应结构：${[...observedShapes].join(" | ") || "无 JSON 事件"
          }`,
          502,
        );
      }
      if (debugEnabled) {
        rootLogger.debug(
          {
            event: "ai.chat.finish",
            provider: "sensenova",
            model,
            chunkCount,
            totalChars,
            durationMs: Date.now() - streamStartedAt,
          },
          `商汤聊天结束（流自然结束）：共 ${chunkCount} 个分片，${totalChars} 字符，耗时 ${Date.now() - streamStartedAt}ms`,
        );
      }
      yield { content: "", done: true };
    } else {
      const text = await response.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch (err) {
        rootLogger.warn(
          {
            event: "ai.chat.json_parse_failed",
            provider: "sensenova",
            model,
            preview: text.slice(0, 200),
            err: String(err),
          },
          "商汤响应 JSON 解析失败，返回原始文本",
        );
        yield { content: text, done: true };
        return;
      }
      const choice = (parsed as { choices?: unknown[]; data?: { choices?: unknown[] } }).choices?.[0] ??
        (parsed as { data?: { choices?: unknown[] } }).data?.choices?.[0];
      const c = (choice ?? {}) as {
        message?: string | { content?: string };
        delta?: string | { content?: string };
      };
      const content =
        (typeof c.message === "string" ? c.message : c.message?.content) ||
        (typeof c.delta === "string" ? c.delta : c.delta?.content) ||
        "";
      if (!content) {
        rootLogger.error(
          {
            event: "ai.chat.error",
            provider: "sensenova",
            model,
            responseShape: describeResponseShape(parsed),
          },
          `商汤聊天失败：模型=${model}，JSON 未返回正文`,
        );
        throw new SenseNovaError(
          `SenseNova JSON 未返回正文；响应结构：${describeResponseShape(parsed)}`,
          502,
        );
      }
      if (debugEnabled) {
        rootLogger.debug(
          {
            event: "ai.chat.finish",
            provider: "sensenova",
            model,
            chunkCount: 1,
            totalChars: content.length,
            durationMs: Date.now() - streamStartedAt,
          },
          `商汤聊天结束（非流式）：${content.length} 字符，耗时 ${Date.now() - streamStartedAt}ms`,
        );
      }
      yield { content, done: true };
    }
  }

  async listModels(): Promise<Array<{ id: string; object: string }>> {
    const response = await this.request("/models", { method: "GET" });
    const data = await response.json();
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
    if (!model) return "sensenova-6.7-flash-lite";
    const m = model.trim().toLowerCase();
    if (
      m === "sensenova-6.7-flash-lite" ||
      m === "sensenova-6.7-flash" ||
      m === "sensenova-6.7-pro"
    ) {
      return m;
    }
    if (m === "glm-5.2" || m === "glm-5.1" || m === "glm-5" || m === "glm-5-turbo") {
      return m;
    }
    return "sensenova-6.7-flash-lite";
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
      let errorMessage = `SenseNova API ${response.status}`;
      let errorCode: string | undefined;
      try {
        const err = JSON.parse(text) as { message?: string; error?: string; code?: string; type?: string };
        errorMessage = err.message || err.error || errorMessage;
        errorCode = err.code || err.type;
      } catch {
        errorMessage = text || errorMessage;
      }
      throw new SenseNovaError(errorMessage, response.status, errorCode);
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
            new SenseNovaError(
              `Proxy connection failed: ${res.statusCode}`,
              res.statusCode || 500,
            ),
          );
          return;
        }
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
          reject(new SenseNovaError(err.message, 500));
        });
        tls.end();
      });
      proxyReq.on("error", (err) => {
        reject(new SenseNovaError(`Proxy error: ${err.message}`, 500));
      });
      proxyReq.end();
      if (options.signal) {
        options.signal.addEventListener("abort", () => {
          proxyReq.destroy();
          reject(new SenseNovaError("Request aborted", 499));
        });
      }
    });
  }
}

export function createSenseNovaClient(): SenseNovaClient | null {
  const apiKey = process.env.SENSENOVA_API_KEY;
  if (!apiKey) {
    rootLogger.warn("未配置 SENSENOVA_API_KEY，商汤客户端已禁用");
    return null;
  }
  const baseURL = process.env.SENSENOVA_API_BASE_URL;
  const proxyURL =
    process.env.SENSENOVA_PROXY_URL || process.env.HTTP_PROXY || process.env.HTTPS_PROXY;
  return new SenseNovaClient({
    apiKey,
    baseURL,
    proxyURL,
  });
}
