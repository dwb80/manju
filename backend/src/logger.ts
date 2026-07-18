/**
 * 结构化日志封装（评审增量改造 P0）
 *
 * 设计原则：
 * - 底层 pino：JSON 行输出，便于后续接 ELK / Loki / 阿里云 SLS
 * - 默认 level：info（开发用 debug 由 LOG_LEVEL 切换）
 * - 必备字段：traceId / projectId / userId / event / durationMs（按需透传）
 * - 同时落盘到 data/logs/pino.log（直接文件目的地，**不依赖** stdout 重定向）
 *   原因：用 Start-Process / npm start / IDE 终端 等多种方式启动后端时，stdout 不一定
 *         能被外部命令捕获到文件里。把 pino 的 destination 直接指向 data/logs/pino.log，
 *         任何启动方式下都能看到完整 JSON 日志。
 * - 现有 data/logs/YYYY-MM-DD.log 由 logLine() 兼容保留（结构化写入）
 */
import pino, { multistream, type Logger, type LoggerOptions } from "pino";
import { AsyncLocalStorage } from "node:async_hooks";
import { createWriteStream, mkdirSync } from "node:fs";
import path from "node:path";

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

/**
 * 构造 pino 的 file destination：data/logs/pino.log。
 *
 * 不论用 `node dist/server.js` / `npm start` / IDE 调试 / `Start-Process` 哪种方式启动，
 * 这里直接 createWriteStream 打开一个独立文件，绕开 stdout 不被重定向的问题。
 *
 * sync: false 避免 pino 把同步写入卡住事件循环；append 模式追加而不是覆盖。
 * mkdirSync(recursive) 在 backend 启动时一次性建好 data/logs 目录。
 */
function createPinoFileDestination(): NodeJS.WritableStream {
  const logDir = path.join(process.cwd(), "data", "logs");
  try {
    mkdirSync(logDir, { recursive: true });
  } catch {
    // 目录已存在或权限异常时忽略；后续 write 失败会被 pino 吞掉但不阻塞主流程
  }
  const filePath = path.join(logDir, "pino.log");
  return createWriteStream(filePath, { flags: "a", encoding: "utf8" });
}

/**
 * 构造 pino 的 multistream destination：
 *   - stream 0：pino.log（落盘，必备）
 *   - stream 1：process.stdout（给 IDE 终端 / 调试用，失败也无影响）
 *
 * 之所以用 multistream 而不是只写文件：
 *   1. 调试时 IDE 控制台能直接看到 JSON 行，不用每次 cat 文件
 *   2. 万一文件句柄出问题（磁盘满 / 权限），stdout 还能看到错误
 *
 * 注意：每路 stream 必须显式带 `level`，否则 pino 默认只让 info 以上的
 * 日志通过（实测：LOG_LEVEL=debug 时 stream 收不到 debug 行）。
 */
function createPinoDestination() {
  // 延迟 require 是因为 pino-pretty 等 transport 在 worker_threads 里跑，
  // 顶层直接 import 会让某些打包器（如 esbuild）报错。
  const { multistream: stream } = pino;
  const minLevel = (process.env.LOG_LEVEL ?? "info").toLowerCase();
  return stream([
    { level: minLevel, stream: createPinoFileDestination() },
    { level: minLevel, stream: process.stdout },
  ]);
}

/** 全局默认 logger（应用启动 / 工具类使用）。 */
export const rootLogger: Logger = pino(baseOptions, createPinoDestination());

/**
 * 启动期 banner：把当前生效的 LOG_LEVEL 显式打到日志里，
 * 避免 debug 没生效时还要去翻代码确认。
 * 放在 module 顶层而不是 bootstrap() 里，保证：rootLogger 一被 import 就打印一次。
 */
{
  const level = process.env.LOG_LEVEL ?? "info";
  const validLevels = new Set(["trace", "debug", "info", "warn", "error", "fatal"]);
  const effective = validLevels.has(level) ? level : "info";
  rootLogger.info(
    {
      event: "logger.init",
      level: effective,
      rawEnv: process.env.LOG_LEVEL ?? null,
      note: !validLevels.has(level) ? `未识别的 LOG_LEVEL "${level}"，已回退到 "info"` : null,
    },
    `日志系统已就绪（级别=${effective}）`,
  );
}

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
