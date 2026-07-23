/**
 * @file utils.ts
 * @description 通用工具函数集合。提供：
 *   - ID 生成（带业务前缀）
 *   - 时间处理（ISO 字符串、日期截取）
 *   - Token 估算（粗略计算文本 token 数）
 *   - 参数校验（requireString、clampNumber）
 *   - 对象深拷贝（jsonClone）
 *   - AI 调用超时控制（withTimeout、AI_TIMEOUTS）
 *   - AI 调用异常包装（safeAICall、AICallError）
 * 
 * 超时配置支持通过环境变量动态调整，修改 .env 后重启进程即可生效。
 */

import { randomUUID } from "node:crypto";
import { rootLogger, currentLogContext } from "./logger.js";
import { isAgnesRateLimitError } from "./ai/agnes-client.js";

export const DEFAULT_MODEL = "agnes-2.0-flash";

/** 返回当前时间的 ISO 字符串，用作记录创建和更新时间。 */
export function nowIso(): string {
  return new Date().toISOString();
}

/**
 * datePart - 从 ISO 时间截取日期部分
 * @param {string} iso - ISO 时间字符串
 * @returns {string} 日期部分（YYYY-MM-DD）
 */
export function datePart(iso: string): string {
  return iso.slice(0, 10);
}

/** 生成带业务前缀的唯一 ID，例如 c-xxx、img-xxx。 */
export function id(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}

/**
 * estimateTokens - 粗略估算文本 token 数
 * @param {string} text - 待估算的文本
 * @returns {number} 预估的 token 数量
 */
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

/**
 * 安全的字符串转换：非 string / null / undefined 全部返空串。
 * 永不抛错，专为可选字段设计。
 */
export function asString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

/**
 * 安全的整数转换：解析失败返 fallback。
 * 接受 string / number；NaN / Infinity 全部回退。
 */
export function asInt(value: unknown, fallback = 0): number {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string") {
    const n = Number(value);
    if (Number.isFinite(n)) return Math.trunc(n);
  }
  return fallback;
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
 * TimeoutError - 超时错误类
 * 用于区分"网络/AI 排队慢"与"业务错"。
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

/**
 * withTimeout - 为 Promise 添加超时控制
 * @param {Promise<T>} promise - 待包装的 Promise
 * @param {number} timeoutMs - 超时时间（毫秒）
 * @param {string} operation - 操作名称（用于错误提示）
 * @param {AbortController} controller - AbortController 实例
 * @returns {Promise<T>} 带超时控制的 Promise
 * @throws {TimeoutError} 超时时抛出
 */
export async function withTimeout<T>(
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
      }, `操作 "${operation}" 超时（${timeoutMs}ms），已触发 abort`);
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
      }, `操作 "${operation}" 异常：${err instanceof Error ? err.message : String(err)}`);
      throw err;
    })
    .finally(() => {
      if (timer) clearTimeout(timer);
    });
}

/**
 * AICallError - AI 调用统一异常类
 * 用于包装所有 AI 相关调用中的异常，提供统一错误格式。
 */
export class AICallError extends Error {
  readonly operation: string;
  readonly cause: unknown;
  constructor(operation: string, message: string, cause: unknown) {
    super(message);
    this.name = "AICallError";
    this.operation = operation;
    this.cause = cause;
  }
}

/**
 * safeAICall - AI 调用统一异常包装器
 * @param {string} operation - 操作名称
 * @param {() => Promise<T>} fn - 待执行的异步函数
 * @returns {Promise<T>} 执行结果
 * @throws {AICallError} AI 调用失败时抛出
 * @throws {TimeoutError} 超时时抛出（保持原类型）
 */
export async function safeAICall<T>(
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  const startedAt = Date.now();
  try {
    return await fn();
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    const ctxFields = currentLogContext();

    // 限流/超时：保持原类型透传，仅补日志
    if (isAgnesRateLimitError(err)) {
      rootLogger.warn(
        {
          event: "ai.call.rate_limited",
          operation,
          durationMs,
          ...ctxFields,
          err,
        },
        `AI 限流（${operation}）：${err instanceof Error ? err.message : String(err)}`,
      );
      throw err;
    }
    if (err instanceof TimeoutError) {
      rootLogger.warn(
        {
          event: "ai.call.timeout",
          operation,
          durationMs,
          ...ctxFields,
          err,
        },
        `AI 调用超时（${operation}）：${err.message}`,
      );
      throw err;
    }

    // 业务错误（带 err.status 的 4xx）→ 不包装，保留 status / code 字段
    // 让 router 顶层 catch 能识别并透传 HTTP 状态码（如 budget_exceeded → 402）。
    const status = (err as Error & { status?: number })?.status;
    if (typeof status === "number" && status >= 400 && status < 500) {
      const code = (err as Error & { code?: string })?.code;
      rootLogger.warn(
        {
          event: "ai.call.business_error",
          operation,
          durationMs,
          status,
          code,
          ...ctxFields,
          err,
        },
        `AI 业务错误（${operation}）：${err instanceof Error ? err.message : String(err)}`,
      );
      throw err;
    }

    // 其它错误：包装为 AICallError，保留 cause 供日志查询
    const originalMessage = err instanceof Error ? err.message : String(err);
    const wrapped = new AICallError(
      operation,
      `AI 调用失败 (${operation}): ${originalMessage}`,
      err,
    );
    rootLogger.error(
      {
        event: "ai.call.failed",
        operation,
        durationMs,
        ...ctxFields,
        err,
      },
      `AI 调用失败（${operation}）：${originalMessage}`,
    );
    throw wrapped;
  }
}

function readPositiveIntMs(envKey: string, fallback: number): number {
  const raw = process.env[envKey];
  if (raw == null || raw === "") return fallback;
  const v = Number(raw);
  if (!Number.isFinite(v) || v <= 0 || !Number.isInteger(v)) {
    // 环境变量值非法时给一次 stderr 提示，但不影响使用
    console.warn(
      `[AI_TIMEOUTS] 环境变量 ${envKey}=${JSON.stringify(raw)} 不是正整数，回退到默认值 ${fallback}ms`,
    );
    return fallback;
  }
  return v;
}

const DEFAULT_AI_TIMEOUTS = {
  chat: 60_000,           // 60s：聊天流式响应
  generateImage: 180_000, // 180s：真实 Agnes 单图在高峰期可能超过 90s
  generateVideo: 30_000,  // 30s：视频任务创建（只创建任务，不等结果）
  queryTask: 20_000,      // 20s：视频状态查询
  enhancePrompt: 30_000,  // 30s：提示词增强
  analyzeScript: 180_000, // 180s：剧本 AI 分析（可被请求体 timeoutMs 覆盖）
} as const;

export const AI_TIMEOUTS = {
  get chat() { return readPositiveIntMs("AGNES_TIMEOUT_CHAT_MS", DEFAULT_AI_TIMEOUTS.chat); },
  get generateImage() { return readPositiveIntMs("AGNES_TIMEOUT_GENERATE_IMAGE_MS", DEFAULT_AI_TIMEOUTS.generateImage); },
  get generateVideo() { return readPositiveIntMs("AGNES_TIMEOUT_GENERATE_VIDEO_MS", DEFAULT_AI_TIMEOUTS.generateVideo); },
  get queryTask() { return readPositiveIntMs("AGNES_TIMEOUT_QUERY_TASK_MS", DEFAULT_AI_TIMEOUTS.queryTask); },
  get enhancePrompt() { return readPositiveIntMs("AGNES_TIMEOUT_ENHANCE_PROMPT_MS", DEFAULT_AI_TIMEOUTS.enhancePrompt); },
  get analyzeScript() { return readPositiveIntMs("AGNES_TIMEOUT_ANALYZE_SCRIPT_MS", DEFAULT_AI_TIMEOUTS.analyzeScript); },
} as const;
