/**
 * @file request-debug.ts
 * @description HTTP 请求 / 响应调试日志钩子（脱敏 + 截断 + JSON 预览）
 */
import { Buffer } from "node:buffer";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createLogger, rootLogger } from "../logger.js";

const log = createLogger("http.debug");
const BODY_PREVIEW_MAX = 2 * 1024;
const SENSITIVE_KEYS = [
  "authorization",
  "cookie",
  "set-cookie",
  "apikey",
  "api_key",
  "api-key",
  "x-api-key",
  "x-auth-token",
  "token",
  "password",
  "secret",
];

function redactDeep(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[depth>6]";
  if (value == null) return value;
  if (Array.isArray(value)) return value.map((v) => redactDeep(v, depth + 1));
  if (typeof value === "string") return value;
  if (typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const lower = k.toLowerCase();
    if (SENSITIVE_KEYS.some((s) => lower.includes(s))) {
      out[k] = "***REDACTED***";
    } else {
      out[k] = redactDeep(v, depth + 1);
    }
  }
  return out;
}

function previewBody(buf: Buffer): unknown {
  if (buf.length === 0) return null;
  const head = buf.slice(0, BODY_PREVIEW_MAX);
  const truncated = buf.length > BODY_PREVIEW_MAX;
  const text = head.toString("utf-8");
  const trimmed = text.trimStart();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const obj = JSON.parse(text);
      return { _truncated: truncated, _bytes: buf.length, value: redactDeep(obj) };
    } catch {
      // 忽略
    }
  }
  if (/^[\x09\x0a\x0d\x20-\x7e\u00a0-\uffff]*$/.test(text)) {
    return {
      _truncated: truncated,
      _bytes: buf.length,
      value: trimmed ? text + "..." : text,
    };
  }
  return {
    _truncated: truncated,
    _bytes: buf.length,
    value: `<binary ${buf.length} bytes, head=0x${head.slice(0, 16).toString("hex")}>`,
  };
}

function captureRequestBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let total = 0;
    const max = 64 * 1024;
    req.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total <= max) chunks.push(chunk);
    });
    req.on("end", () => {
      if (total > max) {
        resolve(
          Buffer.concat([
            ...chunks,
            Buffer.from(`...<truncated, original=${total} bytes>`),
          ]),
        );
      } else {
        resolve(Buffer.concat(chunks));
      }
    });
    req.on("error", () => resolve(Buffer.concat(chunks)));
  });
}

function hookResponseBodyCapture(res: ServerResponse): () => Buffer {
  const chunks: Buffer[] = [];
  let total = 0;
  const max = 256 * 1024;
  const origWrite = res.write.bind(res);
  const origEnd = res.end.bind(res);
  res.write = (chunk: unknown, ...rest: unknown[]) => {
    if (chunk != null) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
      total += buf.length;
      if (total <= max) chunks.push(buf);
    }
    return (origWrite as (...a: unknown[]) => boolean)(chunk, ...rest);
  };
  res.end = (chunk: unknown, ...rest: unknown[]) => {
    if (chunk != null) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
      total += buf.length;
      if (total <= max) chunks.push(buf);
    }
    return (origEnd as (...a: unknown[]) => ServerResponse)(chunk, ...rest);
  };
  return () => {
    if (total > max) {
      chunks.push(Buffer.from(`...<truncated, original=${total} bytes>`));
    }
    return Buffer.concat(chunks);
  };
}

export function attachDebugHook(
  req: IncomingMessage,
  res: ServerResponse,
  traceId: string,
  startedAt: number,
): void {
  if (!rootLogger.isLevelEnabled("debug")) {
    return;
  }
  const childLog = log.child({ traceId, method: req.method, url: req.url });
  const safeHeaders: Record<string, unknown> = { ...req.headers };
  for (const k of Object.keys(safeHeaders)) {
    if (SENSITIVE_KEYS.some((s) => k.toLowerCase().includes(s))) {
      safeHeaders[k] = "***REDACTED***";
    }
  }
  // 重要：POST/PUT/PATCH/DELETE 等带 body 的请求不能通过 req.on("data") 抓 body——
  // data listener 会把流切到 flowing mode，导致 handler 用 for await (const chunk of req)
  // 读 body 时读到空（已被我们的 listener 消费），最后 readJsonBody 返回空对象，
  // requireString(body.projectId, "projectId") 抛 "projectId is required"。
  // 这类请求只记录 headers，body 留空（避免破坏正常 body 解析）。
  const HAS_REQUEST_BODY = new Set(["POST", "PUT", "PATCH", "DELETE"]);
  if (HAS_REQUEST_BODY.has(req.method ?? "")) {
    childLog.debug(
      {
        event: "http.request.received",
        headers: safeHeaders,
        body: { _skipped: true, _reason: "write_method_body_left_for_handler", value: null },
      },
      "收到 HTTP 请求",
    );
  } else {
    void captureRequestBody(req).then((buf) => {
      childLog.debug(
        {
          event: "http.request.received",
          headers: safeHeaders,
          body: previewBody(buf),
        },
        "收到 HTTP 请求",
      );
    });
  }
  const drain = hookResponseBodyCapture(res);
  res.once("finish", () => {
    const buf = drain();
    const ms = Date.now() - startedAt;
    childLog.debug(
      {
        event: "http.response.sent",
        statusCode: res.statusCode,
        headers: res.getHeaders(),
        body: previewBody(buf),
        durationMs: ms,
      },
      "已发送 HTTP 响应",
    );
  });
}
