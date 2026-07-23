/**
 * @file http-utils.ts
 * @description HTTP 工具函数：JSON 请求体解析 + Body 错误类。
 */
import type { IncomingMessage, ServerResponse } from "node:http";

export class HttpBodyError extends Error {
  status: number;
  code: string;
  constructor(message: string, status: number, code: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = "HttpBodyError";
  }
}

export const DEFAULT_JSON_BODY_LIMIT = 1024 * 1024;

/**
 * readJsonBody - 读取 HTTP 请求体并解析为 JSON 对象
 * @param req - HTTP 请求
 * @param maxBytes - 最大字节数（默认 1MB）
 * @returns 解析后的 JSON 对象
 */
export async function readJsonBody(
  req: IncomingMessage,
  maxBytes: number = DEFAULT_JSON_BODY_LIMIT,
): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buffer = Buffer.from(chunk);
    total += buffer.length;
    if (total > maxBytes) {
      throw new HttpBodyError(
        `请求体不能超过 ${maxBytes} 字节`,
        413,
        "BODY_TOO_LARGE",
      );
    }
    chunks.push(buffer);
  }
  if (chunks.length === 0) return {};
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text.trim()) return {};
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new HttpBodyError("JSON 请求体必须是对象", 400, "INVALID_JSON");
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof HttpBodyError) throw error;
    throw new HttpBodyError("JSON 请求体格式错误", 400, "INVALID_JSON");
  }
}

/**
 * 统一 JSON 响应写入。
 * - 200 成功：body 可为任意可序列化结构
 * - 非 200：body 自动包装为 { ok:false, code, message, data }
 */
export function sendJson(
  res: ServerResponse,
  status: number,
  body: unknown,
): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body ?? null));
}

/**
 * 通用错误响应。
 * - sendError(res, 401, "unauthorized", "请先登录")
 */
export function sendError(
  res: ServerResponse,
  status: number,
  code: string,
  message: string,
  data?: unknown,
): void {
  sendJson(res, status, { ok: false, code, message, data: data ?? null });
}
