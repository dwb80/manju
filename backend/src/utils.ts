import { randomUUID } from "node:crypto";
import { rootLogger, currentLogContext } from "./logger.js";

export const DEFAULT_MODEL = "agnes-2.0-flash";

/** 返回当前时间的 ISO 字符串，用作记录创建和更新时间。 */
export function nowIso(): string {
  return new Date().toISOString();
}

/** 从 ISO 时间中截取日期部分（保留供导出文件名等场景使用）。 */
export function datePart(iso: string): string {
  return iso.slice(0, 10);
}

/** 生成带业务前缀的唯一 ID，例如 c-xxx、img-xxx。 */
export function id(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}

/** 粗略估算文本 token 数，用于本地记录和展示。 */
export function estimateTokens(text: string): number {
  const asciiWords = text.match(/[A-Za-z0-9_]+/g)?.length ?? 0;
  const cjkChars = text.match(/[\u4e00-\u9fff]/g)?.length ?? 0;
  return Math.max(1, asciiWords + Math.ceil(cjkChars / 2));
}

/** 校验接口入参必须是非空字符串，并返回去掉首尾空格后的值。 */
export function requireString(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${name} is required`);
  }
  return value.trim();
}

/** 把用户传入的数字限制在指定范围内，非法值则使用默认值。 */
export function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
}

/** 用 JSON 序列化做一次深拷贝，避免直接修改原始对象。 */
export function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * 给 Promise 套一个超时。超时会自动 abort 调用方传入的 AbortController，
 * 并抛一个带超时常识的错误，让上层区分"网络/AI 排队慢"与"业务错"。
 *
 * 用法：
 *   const ctrl = new AbortController();
 *   await withTimeout(ctx.ai.generateImage(params, ctrl.signal), 60_000, "generateImage", ctrl);
 */
export class TimeoutError extends Error {
  readonly timeoutMs: number;
  readonly operation: string;
  constructor(operation: string, timeoutMs: number) {
    super(`Operation "${operation}" timed out after ${timeoutMs}ms`);
    this.name = "TimeoutError";
    this.operation = operation;
    this.timeoutMs = timeoutMs;
  }
}

export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operation: string,
  controller?: AbortController
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  // 评审增量改造 P0：把超时与异常计入结构化日志（含 stack + traceId）
  const startedAt = Date.now();
  const ctxFields = currentLogContext();
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      try { controller?.abort(); } catch { /* noop */ }
      const err = new TimeoutError(operation, timeoutMs);
      rootLogger.error({
        event: "ai.timeout",
        operation,
        timeoutMs,
        durationMs: Date.now() - startedAt,
        ...ctxFields,
        err,
      }, `timeout after ${timeoutMs}ms in ${operation}`);
      reject(err);
    }, timeoutMs);
  });
  return Promise.race([promise, timeoutPromise])
    .catch((err) => {
      // 底层 promise 异常（非 TimeoutError）也记 warn 便于排查
      if (err instanceof TimeoutError) throw err;
      rootLogger.warn({
        event: "ai.error",
        operation,
        durationMs: Date.now() - startedAt,
        ...ctxFields,
        err,
      }, `error in ${operation}: ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    })
    .finally(() => {
      if (timer) clearTimeout(timer);
    });
}

/** 默认 AI 调用超时配置（毫秒）。 */
export const AI_TIMEOUTS = {
  chat: 60_000,           // 60s：聊天流式响应
  generateImage: 60_000,  // 60s：图片生成
  generateVideo: 30_000,  // 30s：视频任务创建（只创建任务，不等结果）
  queryTask: 20_000,      // 20s：视频状态查询
  enhancePrompt: 30_000,  // 30s：提示词增强
  analyzeScript: 60_000,  // 60s：剧本 AI 分析
} as const;
