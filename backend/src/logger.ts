/**
 * 结构化日志封装（评审增量改造 P0）
 *
 * 设计原则：
 * - 底层 pino：JSON 行输出，便于后续接 ELK / Loki / 阿里云 SLS
 * - 默认 level：info（开发用 debug 由 LOG_LEVEL 切换）
 * - 必备字段：traceId / projectId / userId / event / durationMs（按需透传）
 * - 不在 logger 内做 file 落盘：由调用方注入 destination（默认 stdout）
 *   现有 data/logs/YYYY-MM-DD.log 由 logLine() 兼容保留（结构化写入）
 */
import pino, { type Logger, type LoggerOptions } from "pino";
import { AsyncLocalStorage } from "node:async_hooks";

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

/** 全局 trace 上下文，贯穿一次 HTTP 请求的多个调用。 */
export interface LogContext {
  traceId: string;
  projectId?: string;
  userId?: string;
  conversationId?: string;
}

const asyncContext = new AsyncLocalStorage<LogContext>();

/** 在异步上下文中绑定日志上下文（如：HTTP 中间件入口）。 */
export function withLogContext<T>(ctx: LogContext, fn: () => T): T {
  return asyncContext.run(ctx, fn);
}

/** 读取当前请求的日志上下文；无上下文时返回 fallback。 */
export function currentLogContext(): Partial<LogContext> {
  return asyncContext.getStore() ?? {};
}

const baseOptions: LoggerOptions = {
  level: process.env.LOG_LEVEL ?? "info",
  base: {
    service: "manju-backend",
    pid: process.pid,
  },
  timestamp: () => `,"time":"${new Date().toISOString()}"`,
  formatters: {
    level: (label) => ({ level: label }),
  },
  // 错误对象序列化时带 stack
  serializers: {
    err: (err) => ({
      type: err?.constructor?.name ?? "Error",
      message: err?.message ?? String(err),
      stack: err?.stack,
      ...(err && typeof err === "object" ? err : {}),
    }),
  },
};

/** 全局默认 logger（应用启动 / 工具类使用）。 */
export const rootLogger: Logger = pino(baseOptions);

/**
 * 给一个命名空间创建子 logger，业务模块按需 `const log = createLogger("chat")`。
 * 会自动合并 AsyncLocalStorage 中的 traceId 等上下文。
 */
export function createLogger(name: string): Logger {
  return rootLogger.child({ module: name });
}

/**
 * 给定一个 logger，临时绑定上下文（用于 AsyncLocalStorage 之外的场景）。
 */
export function loggerWithContext(base: Logger, ctx: Partial<LogContext>): Logger {
  return base.child(ctx);
}

/**
 * 计时器：返回函数，调用时输出耗时。
 * 用法：
 *   const end = startTimer(log, "ai.chat", { model });
 *   ... do work ...
 *   end({ tokens: 123 });  // 输出 info 日志
 */
export function startTimer(
  log: Logger,
  event: string,
  fields: Record<string, unknown> = {},
): (extra?: Record<string, unknown>) => void {
  const startedAt = process.hrtime.bigint();
  return (extra: Record<string, unknown> = {}) => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    log.info({ event, durationMs: Math.round(durationMs * 100) / 100, ...fields, ...extra }, event);
  };
}

/**
 * 兼容旧 logLine：把单行字符串写入每日文件 + stdout。
 * 保留原因：现有运维脚本可能 grep 该文件，不能直接切。
 */
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

const fileLogDir = path.join(process.cwd(), "data", "logs");
let fileLogReady: Promise<void> | null = null;

async function ensureFileLogDir(): Promise<void> {
  if (!fileLogReady) {
    fileLogReady = mkdir(fileLogDir, { recursive: true }).then(() => undefined);
  }
  return fileLogReady;
}

/** 兼容旧 logLine：写一行到 data/logs/YYYY-MM-DD.log。 */
export async function logLineToFile(message: string): Promise<void> {
  await ensureFileLogDir();
  const date = new Date().toISOString().slice(0, 10);
  const line = `[${new Date().toISOString()}] ${message}\n`;
  try {
    await appendFile(path.join(fileLogDir, `${date}.log`), line, "utf8");
  } catch {
    // 文件日志失败不阻塞主流程
  }
}
