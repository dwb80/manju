/**
 * @file media-heuristics.ts
 * @description V2 W12+ REQ-PIPE-004-08 纯 JS 媒体启发式 fallback
 *
 * ## 职责
 *  - 当 ffprobe 不可用时（部署环境无 ffmpeg），用纯 JS 算法做基础媒体质量检测
 *  - 不依赖任何外部二进制/库，最大兼容性
 *  - 性能比 ffprobe 慢（尤其大文件），但保证质检 17 项不停摆
 *
 * ## 检测项
 *  - Laplacian 方差（模糊检测 F09 基础）：3x3 算子
 *  - 黑帧像素采样（F07 fallback）：取首尾几帧统计平均亮度
 *  - 冻结帧像素差（F08 fallback）：连续帧像素差 < 阈值 → frozen
 *  - 帧间闪烁（F14 fallback）：帧间像素差方差
 *  - 像素直方图（F10 fallback）：平均亮度判断曝光
 *  - WAV 头解析（F16 fallback）：解析 16-bit PCM 取 RMS
 *  - 标准比例集合（F04 复用）
 *
 * ## 像素数据来源
 *  - 当前 backend 实际图片/视频文件存储在 `/media/` 目录
 *  - 本模块接收 Buffer / Uint8Array 做分析，**不**直接读文件系统（调用方负责 IO）
 *  - 大量像素分析时延较高，调用方应控制采样率（如首/尾/中各取 1 帧）
 *
 * ## 评分规则
 *  - 输出 0-100 整数分，调用方按 check_type 决定 threshold
 *  - 异常/缺数据返 50（中性不挡下游）
 */
import { rootLogger } from "../../logger.js";

const log = rootLogger.child({ module: "media-heuristics" });

/* ============================================================== */
/* 类型定义                                                        */
/* ============================================================== */

export interface PixelStats {
  /** 0-255 平均亮度 */
  avgBrightness: number;
  /** 0-255 亮度标准差（越大对比度越强） */
  stdDev: number;
  /** 0-255 直方图分布（256 桶） */
  histogram: number[];
  width: number;
  height: number;
}

export interface BlurScore {
  /** 拉普拉斯方差（>100 清晰，<50 模糊） */
  variance: number;
  /** 归一化分数 0-100 */
  score: number;
  threshold: number;
  passed: boolean;
  reason: string;
}

export interface BlackFrameScore {
  /** 平均亮度（0-255） */
  avgBrightness: number;
  /** 归一化分数 0-100 */
  score: number;
  threshold: number;
  passed: boolean;
  reason: string;
}

export interface FrozenFrameScore {
  /** 帧间像素差平均（0-255） */
  avgDiff: number;
  /** 归一化分数 0-100 */
  score: number;
  threshold: number;
  passed: boolean;
  reason: string;
}

export interface FlickerScore {
  /** 帧间像素差标准差 */
  diffStdDev: number;
  /** 归一化分数 0-100 */
  score: number;
  threshold: number;
  passed: boolean;
  reason: string;
}

export interface ExposureScore {
  /** 平均亮度 */
  avgBrightness: number;
  /** 偏中位 128 的距离（越小越好） */
  distance: number;
  /** 归一化分数 0-100 */
  score: number;
  threshold: number;
  passed: boolean;
  reason: string;
}

export interface AudioLevelScore {
  /** RMS 音量（0-1 归一化） */
  rms: number;
  /** 峰值音量（0-1 归一化） */
  peak: number;
  /** LUFS 估算（基于 RMS） */
  lufs: number;
  /** 归一化分数 0-100 */
  score: number;
  threshold: number;
  passed: boolean;
  reason: string;
}

/* ============================================================== */
/* 标准比例（F04 复用）                                            */
/* ============================================================== */

export const STANDARD_ASPECT_RATIOS: ReadonlySet<string> = new Set([
  "16:9", "9:16", "1:1", "4:3", "3:4", "21:9", "2.39:1", "2.35:1", "2:1", "5:4", "3:2",
]);

/**
 * 把 "1920x1080" / "1920*1080" / "1920,1080" 解析为 { width, height }
 */
export function parseResolution(str: string | undefined | null): { width: number; height: number; ratio: string } | null {
  if (!str) return null;
  const cleaned = String(str).trim();
  const m = cleaned.match(/(\d+)\s*[xX\*,\s]\s*(\d+)/);
  if (!m) return null;
  const width = Number(m[1]);
  const height = Number(m[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return {
    width,
    height,
    ratio: ratioString(width, height),
  };
}

/** 计算最简比例字符串（如 1920x1080 → "16:9"）。 */
export function ratioString(width: number, height: number): string {
  if (!width || !height) return "unknown";
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const g = gcd(width, height);
  const w = Math.round(width / g);
  const h = Math.round(height / g);
  // 限制最简比过大
  if (w > 50 || h > 50) {
    // 用 2 位小数近似
    const r = width / height;
    return `${r.toFixed(2)}:1`;
  }
  return `${w}:${h}`;
}

/** 判断 ratio 是否标准（容忍一些常见变化）。 */
export function isStandardRatio(ratio: string, tolerance = 0.05): boolean {
  if (STANDARD_ASPECT_RATIOS.has(ratio)) return true;
  // 解析 "16:9" 为 1.778，与输入 ratio 比较
  const m = ratio.match(/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/);
  if (!m) return false;
  const r = Number(m[1]) / Number(m[2]);
  const standards = [
    16 / 9, 9 / 16, 1, 4 / 3, 3 / 4, 21 / 9, 2.39, 2.35, 2, 5 / 4, 3 / 2,
  ];
  return standards.some((s) => Math.abs(s - r) < tolerance);
}

/* ============================================================== */
/* 像素分析工具                                                    */
/* ============================================================== */

/**
 * 从 Buffer/Uint8Array 解析 RGB 像素并计算统计信息。
 * 支持 PNG/JPEG 解码（如未提供 pixels，可传 raw RGB 24-bit 数组）。
 *
 * 简化策略：当前 backend 无 sharp/jimp 依赖，此函数接收**已解码的 RGB 像素**做分析。
 * 真实图片解码由调用方负责（如 `sharp(buffer).raw().toBuffer()`）。
 */
export function computePixelStats(rgb: Uint8Array, width: number, height: number): PixelStats {
  if (!rgb || rgb.length < width * height * 3 || width <= 0 || height <= 0) {
    return { avgBrightness: 128, stdDev: 0, histogram: new Array(256).fill(0), width, height };
  }
  const pixelCount = width * height;
  const histogram = new Array(256).fill(0);
  let sumBrightness = 0;
  for (let i = 0; i < pixelCount; i++) {
    const r = rgb[i * 3];
    const g = rgb[i * 3 + 1];
    const b = rgb[i * 3 + 2];
    // ITU-R BT.601 亮度
    const y = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    sumBrightness += y;
    histogram[y] += 1;
  }
  const avg = sumBrightness / pixelCount;
  let variance = 0;
  for (let i = 0; i < pixelCount; i++) {
    const r = rgb[i * 3];
    const g = rgb[i * 3 + 1];
    const b = rgb[i * 3 + 2];
    const y = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    variance += (y - avg) ** 2;
  }
  const stdDev = Math.sqrt(variance / pixelCount);
  return { avgBrightness: avg, stdDev, histogram, width, height };
}

/* ============================================================== */
/* 评分函数（按 check_type）                                       */
/* ============================================================== */

/**
 * QA-F09 模糊检测：拉普拉斯方差（3x3 算子）
 *  - variance > 100 → 90 分（清晰）
 *  - variance > 50 → 70 分
 *  - variance < 20 → 30 分（模糊）
 */
export function scoreBlur(rgb: Uint8Array, width: number, height: number, threshold = 70): BlurScore {
  try {
    if (!rgb || rgb.length < width * height * 3) {
      return { variance: 0, score: 50, threshold, passed: false, reason: "pixel_data_invalid" };
    }
    const variance = laplacianVariance(rgb, width, height);
    let score: number;
    if (variance >= 100) score = 90;
    else if (variance >= 50) score = 70;
    else if (variance >= 20) score = 50;
    else score = 30;
    return { variance, score, threshold, passed: score >= threshold, reason: "ok" };
  } catch (err) {
    log.warn({ err }, "scoreBlur failed");
    return { variance: 0, score: 50, threshold, passed: false, reason: "compute_failed" };
  }
}

/**
 * QA-F07 黑帧检测：平均亮度
 *  - avgBrightness < 15 → 黑帧 → 30 分
 *  - 15-30 → 偏暗 → 60
 *  - > 30 → 90
 */
export function scoreBlackFrame(stats: PixelStats, threshold = 70): BlackFrameScore {
  const { avgBrightness } = stats;
  let score: number;
  let reason: string;
  if (avgBrightness < 15) {
    score = 30;
    reason = "black_frame";
  } else if (avgBrightness < 30) {
    score = 60;
    reason = "dark_frame";
  } else {
    score = 90;
    reason = "ok";
  }
  return { avgBrightness, score, threshold, passed: score >= threshold, reason };
}

/**
 * QA-F08 冻结帧检测：连续帧像素差平均
 *  - avgDiff < 2 → frozen → 20 分
 *  - 2-5 → 60
 *  - > 5 → 90
 */
export function scoreFrozenFrame(avgDiff: number, threshold = 70): FrozenFrameScore {
  let score: number;
  let reason: string;
  if (avgDiff < 2) {
    score = 20;
    reason = "frozen";
  } else if (avgDiff < 5) {
    score = 60;
    reason = "low_motion";
  } else {
    score = 90;
    reason = "ok";
  }
  return { avgDiff, score, threshold, passed: score >= threshold, reason };
}

/**
 * QA-F14 闪烁检测：帧间像素差标准差
 *  - stdDev > 80 → flicker → 30
 *  - 30-80 → 60
 *  - < 30 → 90
 */
export function scoreFlicker(diffStdDev: number, threshold = 70): FlickerScore {
  let score: number;
  let reason: string;
  if (diffStdDev > 80) {
    score = 30;
    reason = "severe_flicker";
  } else if (diffStdDev > 30) {
    score = 60;
    reason = "mild_flicker";
  } else {
    score = 90;
    reason = "ok";
  }
  return { diffStdDev, score, threshold, passed: score >= threshold, reason };
}

/**
 * QA-F10 曝光检测：偏中位 128 的距离
 *  - distance < 30 → 90
 *  - 30-60 → 70
 *  - > 60 → 40
 */
export function scoreExposure(stats: PixelStats, threshold = 70): ExposureScore {
  const { avgBrightness } = stats;
  const distance = Math.abs(avgBrightness - 128);
  let score: number;
  let reason: string;
  if (distance < 30) {
    score = 90;
    reason = "ok";
  } else if (distance < 60) {
    score = 70;
    reason = "slight_exposure";
  } else {
    score = 40;
    reason = "exposure_extreme";
  }
  return { avgBrightness, distance, score, threshold, passed: score >= threshold, reason };
}

/**
 * QA-F16 响度检测：WAV 头解析 + RMS
 *  - 接受 WAV Buffer（16-bit PCM / 8-bit unsigned）
 *  - 目标 -23 LUFS（EBU R128 近似）
 *  - 偏差 < 5 LUFS → 90
 *  - 5-10 → 70
 *  - > 10 → 50
 */
export function scoreAudioLevel(wavBuffer: Uint8Array, threshold = 70): AudioLevelScore {
  try {
    if (!wavBuffer || wavBuffer.length < 44) {
      return { rms: 0, peak: 0, lufs: -70, score: 50, threshold, passed: false, reason: "wav_too_short" };
    }
    // 检查 "RIFF" + "WAVE"
    const header = String.fromCharCode(...wavBuffer.slice(0, 4));
    if (header !== "RIFF") {
      return { rms: 0, peak: 0, lufs: -70, score: 50, threshold, passed: false, reason: "not_riff" };
    }
    const format = String.fromCharCode(...wavBuffer.slice(8, 12));
    if (format !== "WAVE") {
      return { rms: 0, peak: 0, lufs: -70, score: 50, threshold, passed: false, reason: "not_wave" };
    }
    // 找 "fmt " 块
    let offset = 12;
    let bitsPerSample = 16;
    let sampleRate = 44100;
    let channels = 1;
    let dataOffset = 0;
    let dataLength = 0;
    while (offset < wavBuffer.length - 8) {
      const chunkId = String.fromCharCode(...wavBuffer.slice(offset, offset + 4));
      const chunkSize = wavBuffer[offset + 4] | (wavBuffer[offset + 5] << 8) | (wavBuffer[offset + 6] << 16) | (wavBuffer[offset + 7] << 24);
      if (chunkId === "fmt ") {
        bitsPerSample = wavBuffer[offset + 8 + 14] | (wavBuffer[offset + 8 + 15] << 8);
        sampleRate = wavBuffer[offset + 8 + 4] | (wavBuffer[offset + 8 + 5] << 8) | (wavBuffer[offset + 8 + 6] << 16) | (wavBuffer[offset + 8 + 7] << 24);
        channels = wavBuffer[offset + 8 + 2] | (wavBuffer[offset + 8 + 3] << 8);
      } else if (chunkId === "data") {
        dataOffset = offset + 8;
        dataLength = chunkSize;
        break;
      }
      offset += 8 + chunkSize;
    }
    if (!dataOffset || !dataLength) {
      return { rms: 0, peak: 0, lufs: -70, score: 50, threshold, passed: false, reason: "no_data_chunk" };
    }
    // 计算 RMS（采样前 100000 个样本）
    const maxSamples = Math.min(Math.floor(dataLength / (bitsPerSample / 8)), 100_000);
    let sumSquares = 0;
    let peak = 0;
    for (let i = 0; i < maxSamples; i++) {
      let sample: number;
      const base = dataOffset + i * (bitsPerSample / 8);
      if (bitsPerSample === 16) {
        // 有符号 16-bit little-endian
        const lo = wavBuffer[base];
        const hi = wavBuffer[base + 1];
        sample = (hi << 8) | lo;
        if (sample >= 0x8000) sample -= 0x10000;
        sample = sample / 32768;
      } else if (bitsPerSample === 8) {
        // 无符号 8-bit
        sample = (wavBuffer[base] - 128) / 128;
      } else {
        sample = 0;
      }
      sumSquares += sample * sample;
      const abs = Math.abs(sample);
      if (abs > peak) peak = abs;
    }
    const rms = Math.sqrt(sumSquares / maxSamples);
    // 估算 LUFS（粗略公式：20 * log10(rms) - 0.691）
    const lufs = rms > 0 ? 20 * Math.log10(rms) - 0.691 : -70;
    // 评分：目标 -23 LUFS
    const deviation = Math.abs(lufs - (-23));
    let score: number;
    let reason: string;
    if (deviation < 5) {
      score = 90;
      reason = "ok";
    } else if (deviation < 10) {
      score = 70;
      reason = "slight_deviation";
    } else {
      score = 50;
      reason = "high_deviation";
    }
    return { rms, peak, lufs, score, threshold, passed: score >= threshold, reason };
  } catch (err) {
    log.warn({ err }, "scoreAudioLevel failed");
    return { rms: 0, peak: 0, lufs: -70, score: 50, threshold, passed: false, reason: "compute_failed" };
  }
}

/* ============================================================== */
/* 内部算法：拉普拉斯方差                                          */
/* ============================================================== */

function laplacianVariance(rgb: Uint8Array, width: number, height: number): number {
  // 转灰度
  const gray = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    gray[i] = 0.299 * rgb[i * 3] + 0.587 * rgb[i * 3 + 1] + 0.114 * rgb[i * 3 + 2];
  }
  // 3x3 拉普拉斯算子：[0,1,0; 1,-4,1; 0,1,0]
  const lap = new Float32Array(width * height);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const c = gray[idx];
      const u = gray[idx - width];
      const d = gray[idx + width];
      const l = gray[idx - 1];
      const r = gray[idx + 1];
      lap[idx] = (u + d + l + r) - 4 * c;
    }
  }
  // 计算方差
  let mean = 0;
  for (let i = 0; i < lap.length; i++) mean += lap[i];
  mean /= lap.length;
  let variance = 0;
  for (let i = 0; i < lap.length; i++) variance += (lap[i] - mean) ** 2;
  return variance / lap.length;
}

/* ============================================================== */
/* 帧间像素差（F08/F14 复用）                                      */
/* ============================================================== */

/** 计算两帧（RGB）平均像素差（0-255）。 */
export function averagePixelDiff(rgb1: Uint8Array, rgb2: Uint8Array): number {
  if (!rgb1 || !rgb2 || rgb1.length !== rgb2.length) return 0;
  let sum = 0;
  for (let i = 0; i < rgb1.length; i += 3) {
    const dr = Math.abs(rgb1[i] - rgb2[i]);
    const dg = Math.abs(rgb1[i + 1] - rgb2[i + 1]);
    const db = Math.abs(rgb1[i + 2] - rgb2[i + 2]);
    sum += (dr + dg + db) / 3;
  }
  return sum / (rgb1.length / 3);
}

/** 计算多帧间像素差的标准差（用于闪烁检测 F14）。 */
export function pixelDiffStdDev(frames: Uint8Array[]): number {
  if (frames.length < 2) return 0;
  const diffs: number[] = [];
  for (let i = 1; i < frames.length; i++) {
    diffs.push(averagePixelDiff(frames[i - 1], frames[i]));
  }
  const mean = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  const variance = diffs.reduce((acc, d) => acc + (d - mean) ** 2, 0) / diffs.length;
  return Math.sqrt(variance);
}
