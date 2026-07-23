/**
 * @file ffprobe-utils.ts
 * @description V2 W12+ REQ-PIPE-004-07 ffprobe 工具模块
 *
 * ## 职责
 *  - `probeFfprobe()`：启动时探测 ffprobe 路径 + 版本，缓存到模块级
 *  - `runFfprobeJson(filePath, options)`：调 ffprobe 解析媒体元数据，返 JSON
 *  - `isFfprobeAvailable()`：查询缓存结果（不重新探测）
 *  - `extractMediaMeta()`：统一封装，返回 { duration, width, height, fps, ... }
 *
 * ## 设计原则
 *  - **启动探测 + 缓存**：避免每次调用都 spawn which/find，提升性能
 *  - **缺失降级**：ffprobe 不存在时不抛错，返 { available: false }，调用方降级到纯 JS
 *  - **超时控制**：默认 10s 单次探测超时（用 AbortController + Promise.race）
 *  - **错误容忍**：spawn ENOENT / 超时 / 解析失败都走 try/catch 降级
 *
 * ## 路径解析策略
 *  1. 环境变量 `FFPROBE_PATH` 优先（CI/自定义部署可指定）
 *  2. `which ffprobe`（Linux/macOS）/ `where ffprobe`（Windows）
 *  3. 常见固定路径 `/usr/bin/ffprobe` / `/usr/local/bin/ffprobe` / `C:\ffmpeg\bin\ffprobe.exe`
 *
 * ## 输出格式（runFfprobeJson）
 *  - 调用 `ffprobe -v error -print_format json -show_format -show_streams <file>`
 *  - 解析 JSON 返 { streams: [...], format: {...} }
 *
 * ## 与 media-heuristics.ts 的协同
 *  - ffprobe 可用时：走 ffprobe 路径（精准）
 *  - ffprobe 不可用时：调用方降级到 media-heuristics.ts 的纯 JS 实现
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { rootLogger } from "../../logger.js";

/** 平台判定（无 os.platform 外部依赖）。 */
const isWindows = process.platform === "win32";

const log = rootLogger.child({ module: "ffprobe-utils" });

/* ============================================================== */
/* 类型定义                                                        */
/* ============================================================== */

export interface FfprobeStream {
  index?: number;
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  /** 原始帧率字符串，如 "30/1" */
  r_frame_rate?: string;
  avg_frame_rate?: string;
  duration?: string;
  bit_rate?: string;
  sample_rate?: string;
  channels?: number;
  [key: string]: unknown;
}

export interface FfprobeFormat {
  filename?: string;
  format_name?: string;
  duration?: string;
  bit_rate?: string;
  size?: string;
  [key: string]: unknown;
}

export interface FfprobeResult {
  streams: FfprobeStream[];
  format: FfprobeFormat;
}

export interface FfprobeAvailability {
  available: boolean;
  path: string | null;
  version: string | null;
  reason?: string;
}

/** 媒体元数据抽取结果（统一封装，调用方直接用）。 */
export interface MediaMeta {
  /** ffprobe 是否可用（不可用时其它字段都是 fallback 默认值） */
  available: boolean;
  durationSec: number;
  width: number;
  height: number;
  fps: number;
  codecName: string;
  bitrateKbps: number;
  sampleRate: number;
  channels: number;
  hasAudio: boolean;
  hasVideo: boolean;
  /** 文件是否存在（pure 校验，不依赖 ffprobe） */
  fileExists: boolean;
  /** 探测源（用于日志） */
  source: "ffprobe" | "fallback_db" | "fallback_default";
  /** 错误信息（探测失败时） */
  error?: string;
}

/* ============================================================== */
/* 启动探测 + 缓存                                                */
/* ============================================================== */

let cachedAvailability: FfprobeAvailability | null = null;

/** 候选固定路径（按平台）。 */
const FIXED_CANDIDATES: string[] = isWindows
  ? [
    "C:\\ffmpeg\\bin\\ffprobe.exe",
    "C:\\Program Files\\ffmpeg\\bin\\ffprobe.exe",
    "C:\\Program Files (x86)\\ffmpeg\\bin\\ffprobe.exe",
    "D:\\ffmpeg\\bin\\ffprobe.exe",
  ]
  : [
    "/usr/bin/ffprobe",
    "/usr/local/bin/ffprobe",
    "/opt/homebrew/bin/ffprobe",
    "/snap/bin/ffprobe",
  ];

/** 探测 ffprobe 路径（带超时 + 缓存）。 */
export async function probeFfprobe(): Promise<FfprobeAvailability> {
  if (cachedAvailability) return cachedAvailability;
  const startedAt = Date.now();
  // 1) 环境变量优先
  const envPath = process.env.FFPROBE_PATH?.trim();
  const candidates: string[] = [];
  if (envPath) candidates.push(envPath);
  // 2) 固定路径
  candidates.push(...FIXED_CANDIDATES.filter((p) => existsSync(p)));
  // 3) PATH 探测（which / where）
  const whichCmd = isWindows ? "where" : "which";
  try {
    const whichPath = await runWithTimeout(whichCmd, ["ffprobe"], 3000);
    if (whichPath && whichPath.trim()) {
      // where/which 可能多行，取第一行
      const first = whichPath.split(/\r?\n/)[0]?.trim();
      if (first) candidates.push(first);
    }
  } catch {
    // PATH 探测失败时忽略
  }
  // 去重
  const unique = Array.from(new Set(candidates));
  // 逐一尝试
  for (const path of unique) {
    try {
      const version = await runWithTimeout(path, ["-version"], 3000);
      if (version && /ffprobe version/i.test(version)) {
        cachedAvailability = {
          available: true,
          path,
          version: version.split("\n")[0]?.trim() ?? null,
        };
        log.info(
          {
            event: "ffprobe.detected",
            path,
            version: cachedAvailability.version,
            durationMs: Date.now() - startedAt,
          },
          `ffprobe 探测成功: ${path}`,
        );
        return cachedAvailability;
      }
    } catch {
      // 当前路径无效，继续下一个
    }
  }
  cachedAvailability = {
    available: false,
    path: null,
    version: null,
    reason: "ffprobe not found in PATH or fixed candidates",
  };
  log.warn(
    {
      event: "ffprobe.missing",
      tried: unique,
      durationMs: Date.now() - startedAt,
    },
    "ffprobe 不可用，质检降级到纯 JS 启发式",
  );
  return cachedAvailability;
}

/** 查询缓存结果（不重新探测）。 */
export function isFfprobeAvailable(): boolean {
  return cachedAvailability?.available === true;
}

/** 重置缓存（测试用）。 */
export function _resetFfprobeCache(): void {
  cachedAvailability = null;
}

/* ============================================================== */
/* runFfprobeJson                                                  */
/* ============================================================== */

const DEFAULT_FFPROBE_TIMEOUT_MS = 10_000;

/**
 * 调 ffprobe 解析媒体文件，返 JSON 结果。
 *  - ffprobe 不可用时抛错（调用方应先用 isFfprobeAvailable 判定）
 *  - 超时 10s 后抛错
 */
export async function runFfprobeJson(
  filePath: string,
  opts: { timeoutMs?: number; showFrames?: boolean } = {},
): Promise<FfprobeResult> {
  const avail = await probeFfprobe();
  if (!avail.available || !avail.path) {
    throw new Error("ffprobe_unavailable");
  }
  if (!existsSync(filePath)) {
    throw new Error(`file_not_found: ${filePath}`);
  }
  const args = [
    "-v", "error",
    "-print_format", "json",
    "-show_format",
    "-show_streams",
  ];
  if (opts.showFrames) {
    args.push("-show_frames");
  }
  args.push(filePath);
  const timeoutMs = opts.timeoutMs ?? DEFAULT_FFPROBE_TIMEOUT_MS;
  const stdout = await runWithTimeout(avail.path, args, timeoutMs);
  if (!stdout || !stdout.trim()) {
    throw new Error("ffprobe_empty_output");
  }
  try {
    const parsed = JSON.parse(stdout) as FfprobeResult;
    if (!Array.isArray(parsed.streams)) parsed.streams = [];
    if (!parsed.format || typeof parsed.format !== "object") parsed.format = {};
    return parsed;
  } catch (err) {
    throw new Error(`ffprobe_invalid_json: ${(err as Error).message}`);
  }
}

/* ============================================================== */
/* extractMediaMeta（统一封装）                                     */
/* ============================================================== */

const DEFAULT_MEDIA_META: Omit<MediaMeta, "available" | "fileExists" | "source"> = {
  durationSec: 0,
  width: 0,
  height: 0,
  fps: 30,
  codecName: "",
  bitrateKbps: 0,
  sampleRate: 0,
  channels: 0,
  hasAudio: false,
  hasVideo: false,
};

/**
 * 提取媒体元数据。ffprobe 不可用时返回 fallback。
 * @param filePath 媒体文件绝对路径（不可用时降级到 default + source=fallback_default）
 * @param fallback 降级时的 fallback 字段（DB 中的 width/height/fps/duration）
 */
export async function extractMediaMeta(
  filePath: string | null | undefined,
  fallback: Partial<MediaMeta> = {},
): Promise<MediaMeta> {
  const fileExists = !!filePath && existsSync(filePath);
  const avail = await probeFfprobe();
  if (!avail.available || !filePath || !fileExists) {
    return {
      ...DEFAULT_MEDIA_META,
      ...fallback,
      available: false,
      fileExists,
      source: "fallback_default",
      error: !filePath ? "no_file_path" : !fileExists ? "file_not_found" : "ffprobe_unavailable",
    };
  }
  try {
    const result = await runFfprobeJson(filePath);
    const videoStream = result.streams.find((s) => s.codec_type === "video");
    const audioStream = result.streams.find((s) => s.codec_type === "audio");
    const fps = parseFrameRate(videoStream?.r_frame_rate ?? videoStream?.avg_frame_rate ?? "30/1");
    return {
      available: true,
      durationSec: parseFloatSafe(result.format?.duration ?? videoStream?.duration) ?? 0,
      width: Number(videoStream?.width ?? 0),
      height: Number(videoStream?.height ?? 0),
      fps,
      codecName: String(videoStream?.codec_name ?? ""),
      bitrateKbps: Math.round(Number(result.format?.bit_rate ?? 0) / 1000),
      sampleRate: Number(audioStream?.sample_rate ?? 0),
      channels: Number(audioStream?.channels ?? 0),
      hasAudio: !!audioStream,
      hasVideo: !!videoStream,
      fileExists: true,
      source: "ffprobe",
    };
  } catch (err) {
    log.warn(
      { event: "ffprobe.extract_failed", err: String(err), filePath },
      "ffprobe 解析失败，降级到 fallback",
    );
    return {
      ...DEFAULT_MEDIA_META,
      ...fallback,
      available: false,
      fileExists: true,
      source: "fallback_db",
      error: String(err),
    };
  }
}

/* ============================================================== */
/* 辅助：执行子进程 + 超时                                         */
/* ============================================================== */

function runWithTimeout(cmd: string, args: string[], timeoutMs: number): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    let proc: ReturnType<typeof spawn> | null = null;
    try {
      proc = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    } catch (err) {
      reject(new Error(`spawn_failed: ${(err as Error).message}`));
      return;
    }
    const chunks: Buffer[] = [];
    const errChunks: Buffer[] = [];
    let killed = false;
    const timer = setTimeout(() => {
      killed = true;
      try { proc?.kill("SIGKILL"); } catch { /* noop */ }
      reject(new Error(`ffprobe_timeout_${timeoutMs}ms`));
    }, timeoutMs);
    proc.stdout?.on("data", (c: Buffer) => chunks.push(c));
    proc.stderr?.on("data", (c: Buffer) => errChunks.push(c));
    proc.on("error", (err) => {
      clearTimeout(timer);
      if (!killed) reject(err);
    });
    proc.on("close", (code) => {
      clearTimeout(timer);
      if (killed) return;
      if (code === 0) {
        resolve(Buffer.concat(chunks).toString("utf-8"));
      } else {
        reject(new Error(`ffprobe_exit_${code}: ${Buffer.concat(errChunks).toString("utf-8").slice(0, 200)}`));
      }
    });
  });
}

/** 解析帧率字符串 "30/1" → 30。 */
function parseFrameRate(rate: string | undefined): number {
  if (!rate) return 30;
  const parts = rate.split("/");
  if (parts.length === 2) {
    const num = Number(parts[0]);
    const den = Number(parts[1]);
    if (den === 0) return 30;
    return Math.round(num / den);
  }
  const n = Number(rate);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 30;
}

function parseFloatSafe(v: string | number | undefined): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}
