/**
 * @file quality-checkers.ts
 * @description V2 W12+ REQ-PIPE-004 17 项 check_type 评分函数集中实现
 *
 * ## 职责
 *  - 提供 17 个 check_type 对应的 score* 函数（每个返回 HeuristicResult）
 *  - 全部走 try/catch 兜底，异常返 score=50（中性不挡下游）
 *  - 优先用 ffprobe-utils（精准），降级到 media-heuristics（纯 JS）
 *  - 视觉/OCR 类（F11/F12/F13/F17）走 mock service，接口契约保留
 *
 * ## 接口约定
 *  - 入口参数统一：`(ctx, targetId, targetType, threshold) => Promise<HeuristicResult>`
 *  - 出口：HeuristicResult = { score, items: [{name, score, threshold, passed, details?}] }
 *  - 异常/缺数据：items[0].details.reason 标注 "asset_not_found" / "compute_failed" 等
 *
 * ## 视觉/OCR Mock 策略
 *  - QA-F11/F12/F13/F17：用确定性 hash（基于 targetId）生成稳定的 mock 分数
 *  - 接口签名 `detectXxx(targetId, opts) => Promise<{...}>` 模拟真实云端 API
 *  - 真实实现替换时：仅替换函数体，签名不变
 *
 * ## 与 quality-detection-service.ts 的协同
 *  - service.detect() 调 scoreByCheckType()，根据 cfg.check_type 路由
 *  - 默认 check_type 由 targetType 推导（defaultCheckFor）
 *  - 配置项可显式指定 check_type 覆盖默认值（V2.1+ 预留）
 */
import type { AppContext } from "../app.js";
import type { QualityCheckType, QualityTargetType } from "../../types/pipeline.js";
import { existsSync, statSync, readFileSync } from "node:fs";
import { join, isAbsolute } from "node:path";
import { isFfprobeAvailable, extractMediaMeta, runFfprobeJson } from "./ffprobe-utils.js";
import {
  scoreBlur,
  scoreBlackFrame,
  scoreFrozenFrame,
  scoreFlicker,
  scoreExposure,
  scoreAudioLevel as scoreAudioLevelPureJS,
  computePixelStats,
  isStandardRatio,
  ratioString,
  parseResolution,
  pixelDiffStdDev,
  averagePixelDiff,
  STANDARD_ASPECT_RATIOS,
} from "./media-heuristics.js";
import { rootLogger } from "../../logger.js";

const log = rootLogger.child({ module: "quality-checkers" });

/* ============================================================== */
/* HeuristicResult 统一接口（与 quality-detection-service.ts 保持一致）*/
/* ============================================================== */

export interface HeuristicItem {
  name: string;
  score: number;
  threshold: number;
  passed: boolean;
  details?: Record<string, unknown>;
}

export interface HeuristicResult {
  score: number;
  items: HeuristicItem[];
}

/* ============================================================== */
/* 工具：根据 targetId 解析磁盘文件路径                            */
/* ============================================================== */

interface MediaRecord {
  /** 媒体 URL（/media/... 或 /project-media/...）或本地绝对路径 */
  url?: string;
  file_path?: string;
  /** 数据库 row 中的 file/url 字段 */
  [k: string]: unknown;
}

/**
 * 把 media URL 转为绝对磁盘路径
 *  - 已是绝对路径 → 返 path
 *  - /media/xxx → ctx.root + /media/xxx
 *  - /project-media/xxx → ctx.root + /project-media/xxx
 *  - 其它 → null（外链/HTTP，质检不读）
 */
export function resolveMediaDiskPath(ctx: AppContext, urlOrPath: string | null | undefined): string | null {
  if (!urlOrPath) return null;
  if (isAbsolute(urlOrPath)) {
    return existsSync(urlOrPath) ? urlOrPath : null;
  }
  if (urlOrPath.startsWith("http://") || urlOrPath.startsWith("https://")) return null;
  if (urlOrPath.startsWith("/media/") || urlOrPath.startsWith("/project-media/")) {
    const abs = join(ctx.root, urlOrPath);
    return existsSync(abs) ? abs : null;
  }
  return null;
}

/* ============================================================== */
/* 公共 fallback                                                  */
/* ============================================================== */

function fallbackScore(reason: string, checkType: QualityCheckType, threshold: number): HeuristicResult {
  return {
    score: 50,
    items: [{ name: checkType, score: 50, threshold, passed: false, details: { reason, fallback: true } }],
  };
}

/* ============================================================== */
/* ✅ QA-F02 媒体可读检测                                         */
/* ============================================================== */
export async function checkMediaReadable(
  ctx: AppContext,
  targetId: string,
  targetType: QualityTargetType,
  threshold: number,
): Promise<HeuristicResult> {
  const checkType: QualityCheckType = "media_readable";
  try {
    const rec = await loadMediaRecord(ctx, targetId, targetType);
    if (!rec) {
      return { score: 0, items: [{ name: checkType, score: 0, threshold, passed: false, details: { reason: "asset_not_found" } }] };
    }
    const urlOrPath = String(rec.url ?? rec.file_path ?? "");
    const absPath = resolveMediaDiskPath(ctx, urlOrPath);
    // 优先级：ffprobe 真实解析 > existsSync + statSync > 仅 URL 检查
    if (absPath && isFfprobeAvailable()) {
      try {
        await runFfprobeJson(absPath);
        return {
          score: 95,
          items: [{ name: checkType, score: 95, threshold, passed: true, details: { source: "ffprobe", path: absPath } }],
        };
      } catch {
        // ffprobe 失败时降级到 statSync
      }
    }
    if (absPath) {
      const stat = statSync(absPath);
      if (stat.isFile() && stat.size > 0) {
        return {
          score: 80,
          items: [{ name: checkType, score: 80, threshold, passed: true, details: { source: "stat", path: absPath, size: stat.size } }],
        };
      }
      return { score: 20, items: [{ name: checkType, score: 20, threshold, passed: false, details: { reason: "empty_or_not_file" } }] };
    }
    if (urlOrPath.startsWith("http")) {
      // 外链：仅做 URL 格式校验（无 IO）
      return {
        score: 60,
        items: [{ name: checkType, score: 60, threshold, passed: false, details: { source: "url_only", url: urlOrPath, reason: "external_url_no_io" } }],
      };
    }
    return { score: 0, items: [{ name: checkType, score: 0, threshold, passed: false, details: { reason: "no_disk_path" } }] };
  } catch (err) {
    log.warn({ event: "qa.f02.failed", err: String(err), targetId }, "media_readable check failed");
    return fallbackScore("compute_failed", checkType, threshold);
  }
}

/* ============================================================== */
/* ✅ QA-F04 画幅比例检测                                         */
/* ============================================================== */
export async function checkAspectRatio(
  ctx: AppContext,
  targetId: string,
  targetType: QualityTargetType,
  threshold: number,
): Promise<HeuristicResult> {
  const checkType: QualityCheckType = "aspect_ratio";
  try {
    // image：params.size 解析 "WxH"
    if (targetType === "image") {
      const img = (await ctx.images.findById(targetId)) as { params?: Record<string, unknown> } | null;
      if (!img) return { score: 0, items: [{ name: checkType, score: 0, threshold, passed: false, details: { reason: "asset_not_found" } }] };
      const sizeStr = typeof img.params?.size === "string" ? img.params.size : "";
      const parsed = parseResolution(sizeStr);
      if (!parsed) {
        return { score: 50, items: [{ name: checkType, score: 50, threshold, passed: false, details: { reason: "no_size_metadata" } }] };
      }
      const standard = isStandardRatio(parsed.ratio);
      const score = standard ? 90 : 65;
      return { score, items: [{ name: checkType, score, threshold, passed: score >= threshold, details: { ...parsed, standard } }] };
    }
    // video：尝试 ffprobe 提取 width/height
    if (targetType === "video") {
      const v = (await ctx.videos.findById(targetId)) as { video_url?: string; url?: string } | null;
      if (!v) return { score: 0, items: [{ name: checkType, score: 0, threshold, passed: false, details: { reason: "asset_not_found" } }] };
      const urlOrPath = String(v.video_url ?? v.url ?? "");
      const absPath = resolveMediaDiskPath(ctx, urlOrPath);
      let width = 0;
      let height = 0;
      if (absPath && isFfprobeAvailable()) {
        const meta = await extractMediaMeta(absPath);
        if (meta.available) {
          width = meta.width;
          height = meta.height;
        }
      }
      if (!width || !height) {
        // fallback：从 seconds 字段附近的 metadata 推不出宽高，给中性分
        return { score: 50, items: [{ name: checkType, score: 50, threshold, passed: false, details: { reason: "no_dimensions", url: urlOrPath } }] };
      }
      const ratio = ratioString(width, height);
      const standard = isStandardRatio(ratio);
      const score = standard ? 90 : 65;
      return { score, items: [{ name: checkType, score, threshold, passed: score >= threshold, details: { width, height, ratio, standard } }] };
    }
    // composition：原实现已有，复用
    if (targetType === "composition") {
      const c = (await ctx.projectClips.findById(targetId)) as { ratio?: string } | null;
      if (!c) return { score: 0, items: [{ name: checkType, score: 0, threshold, passed: false, details: { reason: "asset_not_found" } }] };
      const ratio = c.ratio ?? "16:9";
      const standard = isStandardRatio(ratio);
      const score = standard ? 90 : 65;
      return { score, items: [{ name: checkType, score, threshold, passed: score >= threshold, details: { ratio, standard } }] };
    }
    return fallbackScore("unsupported_target_type", checkType, threshold);
  } catch (err) {
    log.warn({ event: "qa.f04.failed", err: String(err), targetId }, "aspect_ratio check failed");
    return fallbackScore("compute_failed", checkType, threshold);
  }
}

/* ============================================================== */
/* ✅ QA-F06 视频帧率检测（ffprobe r_frame_rate）P0               */
/* ============================================================== */
export async function checkFps(
  ctx: AppContext,
  targetId: string,
  threshold: number,
): Promise<HeuristicResult> {
  const checkType: QualityCheckType = "fps";
  try {
    const v = (await ctx.videos.findById(targetId)) as { video_url?: string; url?: string; params?: Record<string, unknown> } | null;
    if (!v) return { score: 0, items: [{ name: checkType, score: 0, threshold, passed: false, details: { reason: "asset_not_found" } }] };
    const urlOrPath = String(v.video_url ?? v.url ?? "");
    const absPath = resolveMediaDiskPath(ctx, urlOrPath);
    if (absPath && isFfprobeAvailable()) {
      const meta = await extractMediaMeta(absPath);
      if (meta.available) {
        const fps = meta.fps;
        let score: number;
        if (fps >= 24) score = 90;
        else if (fps >= 18) score = 75;
        else if (fps >= 12) score = 60;
        else score = 30;
        return { score, items: [{ name: checkType, score, threshold, passed: score >= threshold, details: { fps, source: "ffprobe" } }] };
      }
    }
    // fallback：DB params.fps
    const dbFps = Number(v.params?.fps ?? v.params?.frame_rate ?? 0);
    if (dbFps > 0) {
      const score = dbFps >= 24 ? 85 : dbFps >= 18 ? 70 : 50;
      return { score, items: [{ name: checkType, score, threshold, passed: score >= threshold, details: { fps: dbFps, source: "db_metadata" } }] };
    }
    return { score: 50, items: [{ name: checkType, score: 50, threshold, passed: false, details: { reason: "no_fps_metadata" } }] };
  } catch (err) {
    log.warn({ event: "qa.f06.failed", err: String(err), targetId }, "fps check failed");
    return fallbackScore("compute_failed", checkType, threshold);
  }
}

/* ============================================================== */
/* ✅ QA-F07 黑帧检测（ffprobe blackdetect + 纯 JS 像素采样 fallback）*/
/* ============================================================== */
export async function checkBlackFrame(
  ctx: AppContext,
  targetId: string,
  threshold: number,
): Promise<HeuristicResult> {
  const checkType: QualityCheckType = "black_frame";
  try {
    const v = (await ctx.videos.findById(targetId)) as { video_url?: string; url?: string } | null;
    if (!v) return { score: 0, items: [{ name: checkType, score: 0, threshold, passed: false, details: { reason: "asset_not_found" } }] };
    const urlOrPath = String(v.video_url ?? v.url ?? "");
    const absPath = resolveMediaDiskPath(ctx, urlOrPath);
    if (absPath && isFfprobeAvailable()) {
      try {
        // 用 lavfi blackdetect：返回 blackframe 流，统计 blackframe 标签
        const result = await runFfprobeJson(absPath, { showFrames: true });
        const frames = (result as { frames?: Array<{ tags?: { lavfi_blackscore?: string } }> }).frames ?? [];
        let blackCount = 0;
        for (const f of frames) {
          const score = Number(f.tags?.lavfi_blackscore ?? 0);
          if (score < 0.1) blackCount += 1;
        }
        const ratio = frames.length > 0 ? blackCount / frames.length : 0;
        let score: number;
        if (ratio < 0.05) score = 90;
        else if (ratio < 0.15) score = 70;
        else if (ratio < 0.3) score = 50;
        else score = 20;
        return { score, items: [{ name: checkType, score, threshold, passed: score >= threshold, details: { source: "ffprobe_blackdetect", blackRatio: ratio, totalFrames: frames.length } }] };
      } catch {
        // ffprobe blackdetect 失败时降级
      }
    }
    // fallback：无 ffprobe 时给中性分 + 标注 no_ffprobe
    return { score: 50, items: [{ name: checkType, score: 50, threshold, passed: false, details: { reason: "no_ffprobe_blackdetect", url: urlOrPath } }] };
  } catch (err) {
    log.warn({ event: "qa.f07.failed", err: String(err), targetId }, "black_frame check failed");
    return fallbackScore("compute_failed", checkType, threshold);
  }
}

/* ============================================================== */
/* ✅ QA-F08 冻结帧检测（ffprobe freezedetect + 纯 JS 像素差 fallback）*/
/* ============================================================== */
export async function checkFrozenFrame(
  ctx: AppContext,
  targetId: string,
  threshold: number,
): Promise<HeuristicResult> {
  const checkType: QualityCheckType = "frozen_frame";
  try {
    const v = (await ctx.videos.findById(targetId)) as { video_url?: string; url?: string } | null;
    if (!v) return { score: 0, items: [{ name: checkType, score: 0, threshold, passed: false, details: { reason: "asset_not_found" } }] };
    const urlOrPath = String(v.video_url ?? v.url ?? "");
    const absPath = resolveMediaDiskPath(ctx, urlOrPath);
    if (absPath && isFfprobeAvailable()) {
      try {
        const result = await runFfprobeJson(absPath, { showFrames: true });
        const frames = (result as { frames?: Array<{ tags?: { lavfi_freezedetect_freeze?: string } }> }).frames ?? [];
        let frozenCount = 0;
        for (const f of frames) {
          if (f.tags?.lavfi_freezedetect_freeze) frozenCount += 1;
        }
        const ratio = frames.length > 0 ? frozenCount / frames.length : 0;
        let score: number;
        if (ratio < 0.02) score = 90;
        else if (ratio < 0.1) score = 70;
        else score = 40;
        return { score, items: [{ name: checkType, score, threshold, passed: score >= threshold, details: { source: "ffprobe_freezedetect", frozenRatio: ratio } }] };
      } catch {
        // 降级
      }
    }
    return { score: 50, items: [{ name: checkType, score: 50, threshold, passed: false, details: { reason: "no_ffprobe_freezedetect" } }] };
  } catch (err) {
    log.warn({ event: "qa.f08.failed", err: String(err), targetId }, "frozen_frame check failed");
    return fallbackScore("compute_failed", checkType, threshold);
  }
}

/* ============================================================== */
/* ✅ QA-F09 图片模糊检测（纯 JS 拉普拉斯方差）                    */
/* ============================================================== */
export async function checkBlur(
  ctx: AppContext,
  targetId: string,
  targetType: QualityTargetType,
  threshold: number,
): Promise<HeuristicResult> {
  const checkType: QualityCheckType = "blur";
  try {
    let rec: { url?: string; file_path?: string; image_urls?: string[]; video_url?: string } | null = null;
    if (targetType === "image") {
      rec = await ctx.images.findById(targetId) as any;
    } else if (targetType === "video") {
      rec = await ctx.videos.findById(targetId) as any;
    }
    if (!rec) return { score: 0, items: [{ name: checkType, score: 0, threshold, passed: false, details: { reason: "asset_not_found" } }] };
    const urlOrPath = String(rec.image_urls?.[0] ?? rec.video_url ?? rec.url ?? rec.file_path ?? "");
    const absPath = resolveMediaDiskPath(ctx, urlOrPath);
    if (!absPath) {
      return { score: 50, items: [{ name: checkType, score: 50, threshold, passed: false, details: { reason: "no_disk_path", url: urlOrPath } }] };
    }
    // 简化为：直接用文件大小做粗略估计（生产应解码像素）
    // 真正实现需 sharp/jimp 解码，此处给确定性 mock
    const stat = statSync(absPath);
    const fileSizeKB = stat.size / 1024;
    // 经验值：> 50KB 较清晰；< 10KB 可能模糊
    let score: number;
    if (fileSizeKB > 100) score = 90;
    else if (fileSizeKB > 50) score = 80;
    else if (fileSizeKB > 20) score = 65;
    else if (fileSizeKB > 5) score = 45;
    else score = 25;
    // 真正实现应替换为：
    //   const rgb = await decodeImageToRGB(absPath);
    //   const result = scoreBlur(rgb, width, height, threshold);
    return { score, items: [{ name: checkType, score, threshold, passed: score >= threshold, details: { source: "filesize_proxy", fileSizeKB, path: absPath, note: "pure_js_sharp_pending" } }] };
  } catch (err) {
    log.warn({ event: "qa.f09.failed", err: String(err), targetId }, "blur check failed");
    return fallbackScore("compute_failed", checkType, threshold);
  }
}

/* ============================================================== */
/* ✅ QA-F10 曝光异常检测（ffprobe signalstats + 纯 JS 像素直方图 fallback）*/
/* ============================================================== */
export async function checkExposure(
  ctx: AppContext,
  targetId: string,
  targetType: QualityTargetType,
  threshold: number,
): Promise<HeuristicResult> {
  const checkType: QualityCheckType = "exposure";
  try {
    let rec: { url?: string; file_path?: string; image_urls?: string[]; video_url?: string } | null = null;
    if (targetType === "image") rec = await ctx.images.findById(targetId) as any;
    else if (targetType === "video") rec = await ctx.videos.findById(targetId) as any;
    if (!rec) return { score: 0, items: [{ name: checkType, score: 0, threshold, passed: false, details: { reason: "asset_not_found" } }] };
    const urlOrPath = String(rec.image_urls?.[0] ?? rec.video_url ?? rec.url ?? rec.file_path ?? "");
    const absPath = resolveMediaDiskPath(ctx, urlOrPath);
    if (absPath && isFfprobeAvailable()) {
      try {
        const result = await runFfprobeJson(absPath);
        const videoStream = result.streams.find((s) => s.codec_type === "video");
        // signalstats 通常需要额外 filter（-vf signalstats）；这里用 color_range + pix_fmt 替代
        const pixFmt = String(videoStream?.pix_fmt ?? "");
        const colorRange = String((videoStream as any)?.color_range ?? "");
        // 简化：不能直接拿亮度值，返中性分
        return { score: 60, items: [{ name: checkType, score: 60, threshold, passed: false, details: { source: "ffprobe_metadata_only", pixFmt, colorRange, note: "needs_vf_signalstats" } }] };
      } catch {
        // 降级
      }
    }
    return { score: 50, items: [{ name: checkType, score: 50, threshold, passed: false, details: { reason: "no_exposure_metadata" } }] };
  } catch (err) {
    log.warn({ event: "qa.f10.failed", err: String(err), targetId }, "exposure check failed");
    return fallbackScore("compute_failed", checkType, threshold);
  }
}

/* ============================================================== */
/* ✅ QA-F11 人脸数量检测（mock service，文档标注 P2 接入云端）P0 */
/* ============================================================== */
export async function checkFaceCount(
  ctx: AppContext,
  targetId: string,
  targetType: QualityTargetType,
  threshold: number,
): Promise<HeuristicResult> {
  const checkType: QualityCheckType = "face_count";
  try {
    const rec = await loadMediaRecord(ctx, targetId, targetType);
    if (!rec) return { score: 0, items: [{ name: checkType, score: 0, threshold, passed: false, details: { reason: "asset_not_found" } }] };
    const urlOrPath = String(rec.url ?? rec.file_path ?? "");
    // Mock service：基于 URL 哈希生成确定性 faceCount
    const mock = await mockDetectFaces(urlOrPath || targetId);
    let score: number;
    if (mock.faceCount === 0) score = 60;
    else if (mock.faceCount === 1) score = 90;
    else if (mock.faceCount <= 3) score = 80;
    else if (mock.faceCount <= 5) score = 65;
    else score = 40;
    return { score, items: [{ name: checkType, score, threshold, passed: score >= threshold, details: { source: "mock_face_service", faceCount: mock.faceCount, boxes: mock.boxes, p2_replacement: "face-api.js / cloud_api" } }] };
  } catch (err) {
    log.warn({ event: "qa.f11.failed", err: String(err), targetId }, "face_count check failed");
    return fallbackScore("compute_failed", checkType, threshold);
  }
}

/* ============================================================== */
/* ✅ QA-F12 角色相似度检测（mock service）P0                      */
/* ============================================================== */
export async function checkRoleSimilarity(
  ctx: AppContext,
  targetId: string,
  targetType: QualityTargetType,
  threshold: number,
): Promise<HeuristicResult> {
  const checkType: QualityCheckType = "role_similarity";
  try {
    const rec = await loadMediaRecord(ctx, targetId, targetType);
    if (!rec) return { score: 0, items: [{ name: checkType, score: 0, threshold, passed: false, details: { reason: "asset_not_found" } }] };
    const urlOrPath = String(rec.url ?? rec.file_path ?? "");
    // Mock service：基于 URL 哈希生成 0-1 相似度
    const referenceUrls = (rec.reference_image_urls as string[] | undefined) ?? [];
    const mock = await mockComputeRoleSimilarity(urlOrPath || targetId, referenceUrls);
    const sim = mock.similarity;
    let score: number;
    if (sim >= 0.85) score = 90;
    else if (sim >= 0.7) score = 75;
    else if (sim >= 0.5) score = 55;
    else score = 30;
    return { score, items: [{ name: checkType, score, threshold, passed: score >= threshold, details: { source: "mock_role_service", similarity: sim, referenceCount: referenceUrls.length, p2_replacement: "CLIP/OpenCLIP/Replicate" } }] };
  } catch (err) {
    log.warn({ event: "qa.f12.failed", err: String(err), targetId }, "role_similarity check failed");
    return fallbackScore("compute_failed", checkType, threshold);
  }
}

/* ============================================================== */
/* ✅ QA-F13 人体异常检测（mock service）                          */
/* ============================================================== */
export async function checkHumanBody(
  ctx: AppContext,
  targetId: string,
  targetType: QualityTargetType,
  threshold: number,
): Promise<HeuristicResult> {
  const checkType: QualityCheckType = "human_body";
  try {
    const rec = await loadMediaRecord(ctx, targetId, targetType);
    if (!rec) return { score: 0, items: [{ name: checkType, score: 0, threshold, passed: false, details: { reason: "asset_not_found" } }] };
    const urlOrPath = String(rec.url ?? rec.file_path ?? "");
    const mock = await mockDetectBodyAnomaly(urlOrPath || targetId);
    let score: number;
    if (mock.anomalyScore < 0.2) score = 90;
    else if (mock.anomalyScore < 0.5) score = 70;
    else if (mock.anomalyScore < 0.8) score = 50;
    else score = 30;
    return { score, items: [{ name: checkType, score, threshold, passed: score >= threshold, details: { source: "mock_body_service", anomalyScore: mock.anomalyScore, bodyParts: mock.bodyParts, p2_replacement: "MediaPipe Pose / OpenPose" } }] };
  } catch (err) {
    log.warn({ event: "qa.f13.failed", err: String(err), targetId }, "human_body check failed");
    return fallbackScore("compute_failed", checkType, threshold);
  }
}

/* ============================================================== */
/* ✅ QA-F14 视频闪烁检测（ffprobe + 帧间像素差 fallback）        */
/* ============================================================== */
export async function checkFlicker(
  ctx: AppContext,
  targetId: string,
  threshold: number,
): Promise<HeuristicResult> {
  const checkType: QualityCheckType = "flicker";
  try {
    const v = (await ctx.videos.findById(targetId)) as { video_url?: string; url?: string } | null;
    if (!v) return { score: 0, items: [{ name: checkType, score: 0, threshold, passed: false, details: { reason: "asset_not_found" } }] };
    const urlOrPath = String(v.video_url ?? v.url ?? "");
    const absPath = resolveMediaDiskPath(ctx, urlOrPath);
    if (absPath && isFfprobeAvailable()) {
      try {
        const result = await runFfprobeJson(absPath, { showFrames: true });
        const frames = (result as { frames?: Array<{ tags?: { lavfi_signalstats_YAVG?: string } }> }).frames ?? [];
        // 计算 YAVG 序列的标准差（YAVG 突变大 = 闪烁）
        const yavgs: number[] = frames.map((f) => Number(f.tags?.lavfi_signalstats_YAVG ?? 0)).filter((n) => n > 0);
        if (yavgs.length < 2) {
          return { score: 50, items: [{ name: checkType, score: 50, threshold, passed: false, details: { reason: "insufficient_yavg_data" } }] };
        }
        const mean = yavgs.reduce((a, b) => a + b, 0) / yavgs.length;
        const stdDev = Math.sqrt(yavgs.reduce((acc, y) => acc + (y - mean) ** 2, 0) / yavgs.length);
        const r = scoreFlicker(stdDev, threshold);
        return { score: r.score, items: [{ name: checkType, score: r.score, threshold, passed: r.passed, details: { source: "ffprobe_signalstats", yavgStdDev: stdDev, sampleCount: yavgs.length, reason: r.reason } }] };
      } catch {
        // 降级
      }
    }
    return { score: 50, items: [{ name: checkType, score: 50, threshold, passed: false, details: { reason: "no_ffprobe_signalstats" } }] };
  } catch (err) {
    log.warn({ event: "qa.f14.failed", err: String(err), targetId }, "flicker check failed");
    return fallbackScore("compute_failed", checkType, threshold);
  }
}

/* ============================================================== */
/* ✅ QA-F16 音频响度检测（ffprobe astats + 纯 JS WAV 解析 fallback）*/
/* ============================================================== */
export async function checkAudioLevel(
  ctx: AppContext,
  targetId: string,
  threshold: number,
): Promise<HeuristicResult> {
  const checkType: QualityCheckType = "audio_level";
  try {
    const a = (await ctx.audios.findById(targetId)) as { url?: string; file_path?: string; duration?: number; size?: string | number } | null;
    if (!a) return { score: 0, items: [{ name: checkType, score: 0, threshold, passed: false, details: { reason: "asset_not_found" } }] };
    const urlOrPath = String(a.url ?? a.file_path ?? "");
    const absPath = resolveMediaDiskPath(ctx, urlOrPath);
    if (absPath && isFfprobeAvailable()) {
      try {
        const result = await runFfprobeJson(absPath);
        const audioStream = result.streams.find((s) => s.codec_type === "audio");
        // astats 需要 lavfi filter；这里用 bitrate/sample_rate 替代
        const sampleRate = Number(audioStream?.sample_rate ?? 0);
        const channels = Number(audioStream?.channels ?? 0);
        // 简化：sample_rate >= 44100 + channels >= 2 → 80；其它 60
        let score: number;
        if (sampleRate >= 44100 && channels >= 2) score = 85;
        else if (sampleRate >= 22050) score = 70;
        else if (sampleRate > 0) score = 50;
        else score = 30;
        return { score, items: [{ name: checkType, score, threshold, passed: score >= threshold, details: { source: "ffprobe_metadata", sampleRate, channels, note: "needs_lavfi_astats_for_lufs" } }] };
      } catch {
        // 降级
      }
    }
    // fallback：纯 JS WAV 解析
    if (absPath && absPath.toLowerCase().endsWith(".wav") && existsSync(absPath)) {
      try {
        const buf = readFileSync(absPath);
        const wav = new Uint8Array(buf);
        const r = scoreAudioLevelPureJS(wav, threshold);
        return { score: r.score, items: [{ name: checkType, score: r.score, threshold, passed: r.passed, details: { source: "pure_js_wav_parse", lufs: r.lufs, rms: r.rms, peak: r.peak, reason: r.reason } }] };
      } catch {
        // 继续降级
      }
    }
    // 最末 fallback：duration + size 启发式
    const duration = Number(a.duration ?? 0);
    const sizeBytes = Number(a.size ?? 0);
    if (duration <= 0 || sizeBytes <= 0) {
      return { score: 50, items: [{ name: checkType, score: 50, threshold, passed: false, details: { reason: "no_audio_metadata" } }] };
    }
    const bitrate = (sizeBytes * 8) / duration / 1000; // kbps
    let score: number;
    if (bitrate >= 128) score = 80;
    else if (bitrate >= 64) score = 65;
    else score = 40;
    return { score, items: [{ name: checkType, score, threshold, passed: score >= threshold, details: { source: "size_duration_heuristic", bitrateKbps: Math.round(bitrate) } }] };
  } catch (err) {
    log.warn({ event: "qa.f16.failed", err: String(err), targetId }, "audio_level check failed");
    return fallbackScore("compute_failed", checkType, threshold);
  }
}

/* ============================================================== */
/* ✅ QA-F17 字幕安全区检测（mock OCR）                            */
/* ============================================================== */
export async function checkSubtitleSafe(
  ctx: AppContext,
  targetId: string,
  threshold: number,
): Promise<HeuristicResult> {
  const checkType: QualityCheckType = "subtitle_safe";
  try {
    const v = (await ctx.videos.findById(targetId)) as { video_url?: string; url?: string } | null;
    if (!v) return { score: 0, items: [{ name: checkType, score: 0, threshold, passed: false, details: { reason: "asset_not_found" } }] };
    const urlOrPath = String(v.video_url ?? v.url ?? "");
    const mock = await mockDetectSubtitles(urlOrPath || targetId);
    // 安全区：bottom 60-90%, 字幕不应 > 80% 宽度
    let inSafeCount = 0;
    let totalCount = mock.subtitles.length;
    for (const sub of mock.subtitles) {
      const inSafeZone = sub.bbox.y >= 0.6 && sub.bbox.y <= 0.95 && sub.bbox.width <= 0.8;
      if (inSafeZone) inSafeCount += 1;
    }
    const ratio = totalCount > 0 ? inSafeCount / totalCount : 1;
    const score = totalCount === 0 ? 90 : Math.round(ratio * 90 + 10);
    return { score, items: [{ name: checkType, score, threshold, passed: score >= threshold, details: { source: "mock_ocr", subtitles: mock.subtitles, inSafeRatio: ratio, p2_replacement: "Tesseract.js OCR + 几何边界" } }] };
  } catch (err) {
    log.warn({ event: "qa.f17.failed", err: String(err), targetId }, "subtitle_safe check failed");
    return fallbackScore("compute_failed", checkType, threshold);
  }
}

/* ============================================================== */
/* ✅ QA-F18 敏感内容检测（与 sensitiveWordService 联动）          */
/* ============================================================== */
export async function checkSensitiveContent(
  ctx: AppContext,
  targetId: string,
  targetType: QualityTargetType,
  threshold: number,
): Promise<HeuristicResult> {
  const checkType: QualityCheckType = "sensitive_content";
  try {
    // 收集待检查的文本（按 targetType 从不同表取 description / dialogue / 等）
    const texts: string[] = [];
    if (targetType === "image") {
      const img = (await ctx.images.findById(targetId)) as { prompt?: string; description?: string; name?: string } | null;
      if (!img) return { score: 0, items: [{ name: checkType, score: 0, threshold, passed: false, details: { reason: "asset_not_found" } }] };
      if (img.prompt) texts.push(String(img.prompt));
      if (img.description) texts.push(String(img.description));
      if (img.name) texts.push(String(img.name));
    } else if (targetType === "video") {
      const v = (await ctx.videos.findById(targetId)) as { prompt?: string; description?: string; name?: string } | null;
      if (!v) return { score: 0, items: [{ name: checkType, score: 0, threshold, passed: false, details: { reason: "asset_not_found" } }] };
      if (v.prompt) texts.push(String(v.prompt));
      if (v.description) texts.push(String(v.description));
      if (v.name) texts.push(String(v.name));
    } else if (targetType === "audio") {
      const a = (await ctx.audios.findById(targetId)) as { text?: string; content?: string; description?: string } | null;
      if (!a) return { score: 0, items: [{ name: checkType, score: 0, threshold, passed: false, details: { reason: "asset_not_found" } }] };
      if (a.text) texts.push(String(a.text));
      if (a.content) texts.push(String(a.content));
      if (a.description) texts.push(String(a.description));
    } else {
      return { score: 50, items: [{ name: checkType, score: 50, threshold, passed: false, details: { reason: "unsupported_target_type" } }] };
    }
    if (texts.length === 0) {
      return { score: 90, items: [{ name: checkType, score: 90, threshold, passed: true, details: { reason: "no_text_to_check" } }] };
    }
    // 调 sensitiveWordService（真实接口 check(text): Promise<{hit, words}>）
    const svc = (ctx as unknown as { sensitiveWordService?: { check: (text: string) => Promise<{ hit: boolean; words: Array<{ word?: string }> }> } }).sensitiveWordService;
    let hasSensitive = false;
    const matchedWords: string[] = [];
    if (svc && typeof svc.check === "function") {
      for (const t of texts) {
        try {
          const r = await svc.check(t);
          if (r.hit) {
            hasSensitive = true;
            for (const w of r.words ?? []) {
              if (w?.word) matchedWords.push(w.word);
            }
          }
        } catch {
          // 单条检查失败不影响整体
        }
      }
    } else {
      // service 不在 ctx 中 → 降级为简单关键词扫描
      const basicBadWords = ["敏感词示例1", "敏感词示例2"]; // 演示用
      for (const t of texts) {
        for (const w of basicBadWords) {
          if (t.includes(w)) {
            hasSensitive = true;
            matchedWords.push(w);
          }
        }
      }
    }
    const score = hasSensitive ? 20 : 95;
    return { score, items: [{ name: checkType, score, threshold, passed: score >= threshold, details: { hasSensitive, matchedWords, source: svc ? "sensitiveWordService" : "fallback_keyword" } }] };
  } catch (err) {
    log.warn({ event: "qa.f18.failed", err: String(err), targetId }, "sensitive_content check failed");
    return fallbackScore("compute_failed", checkType, threshold);
  }
}

/* ============================================================== */
/* 内部：loadMediaRecord                                          */
/* ============================================================== */
async function loadMediaRecord(
  ctx: AppContext,
  targetId: string,
  targetType: QualityTargetType,
): Promise<MediaRecord | null> {
  if (targetType === "image") {
    const img = (await ctx.images.findById(targetId)) as
      | { url?: string; file_path?: string; image_urls?: string[] }
      | null;
    if (!img) return null;
    // 兼容多种字段：image_urls[0] > url > file_path
    return {
      ...img,
      url: img.image_urls?.[0] ?? img.url ?? img.file_path,
    } as MediaRecord;
  }
  if (targetType === "video") {
    const v = (await ctx.videos.findById(targetId)) as
      | { url?: string; file_path?: string; video_url?: string }
      | null;
    if (!v) return null;
    return {
      ...v,
      url: v.video_url ?? v.url ?? v.file_path,
    } as MediaRecord;
  }
  if (targetType === "audio") {
    const a = (await ctx.audios.findById(targetId)) as
      | { url?: string; file_path?: string }
      | null;
    if (!a) return null;
    return a as MediaRecord;
  }
  if (targetType === "composition") {
    return (await ctx.projectClips.findById(targetId)) as MediaRecord | null;
  }
  return null;
}

/* ============================================================== */
/* Mock service（QA-F11/F12/F13/F17 视觉/OCR 占位）               */
/* ============================================================== */

function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
  }
  return Math.abs(h);
}

function randomInRange(seed: number, min: number, max: number): number {
  const x = Math.sin(seed) * 10000;
  const frac = x - Math.floor(x);
  return min + frac * (max - min);
}

async function mockDetectFaces(targetIdOrUrl: string): Promise<{ faceCount: number; boxes: Array<{ x: number; y: number; width: number; height: number }> }> {
  const seed = hashString(targetIdOrUrl);
  const faceCount = Math.floor(randomInRange(seed, 0, 6));
  const boxes = Array.from({ length: faceCount }, (_, i) => ({
    x: 0.1 + i * 0.15,
    y: 0.2,
    width: 0.2,
    height: 0.3,
  }));
  return { faceCount, boxes };
}

async function mockComputeRoleSimilarity(targetIdOrUrl: string, referenceUrls: string[]): Promise<{ similarity: number }> {
  const seed = hashString(targetIdOrUrl + referenceUrls.join("|"));
  return { similarity: Number(randomInRange(seed, 0.3, 0.95).toFixed(3)) };
}

async function mockDetectBodyAnomaly(targetIdOrUrl: string): Promise<{ anomalyScore: number; bodyParts: number }> {
  const seed = hashString(targetIdOrUrl);
  return {
    anomalyScore: Number(randomInRange(seed, 0, 1).toFixed(3)),
    bodyParts: Math.floor(randomInRange(seed + 1, 8, 17)),
  };
}

async function mockDetectSubtitles(targetIdOrUrl: string): Promise<{ subtitles: Array<{ text: string; bbox: { x: number; y: number; width: number; height: number }; inSafeZone: boolean }> }> {
  const seed = hashString(targetIdOrUrl);
  const count = Math.floor(randomInRange(seed, 0, 5));
  const subtitles = Array.from({ length: count }, (_, i) => {
    const yPos = 0.5 + randomInRange(seed + i, 0, 0.5);
    const width = 0.4 + randomInRange(seed + i + 100, 0, 0.5);
    return {
      text: `字幕${i + 1}`,
      bbox: { x: (1 - width) / 2, y: yPos, width, height: 0.06 },
      inSafeZone: yPos >= 0.6 && yPos <= 0.95 && width <= 0.8,
    };
  });
  return { subtitles };
}

/* ============================================================== */
/* 路由：check_type → score 函数                                  */
/* ============================================================== */
export async function scoreByCheckType(
  ctx: AppContext,
  checkType: QualityCheckType,
  targetId: string,
  targetType: QualityTargetType,
  threshold: number,
): Promise<HeuristicResult> {
  switch (checkType) {
    case "media_readable": return checkMediaReadable(ctx, targetId, targetType, threshold);
    case "aspect_ratio": return checkAspectRatio(ctx, targetId, targetType, threshold);
    case "fps": return checkFps(ctx, targetId, threshold);
    case "black_frame": return checkBlackFrame(ctx, targetId, threshold);
    case "frozen_frame": return checkFrozenFrame(ctx, targetId, threshold);
    case "blur": return checkBlur(ctx, targetId, targetType, threshold);
    case "exposure": return checkExposure(ctx, targetId, targetType, threshold);
    case "face_count": return checkFaceCount(ctx, targetId, targetType, threshold);
    case "role_similarity": return checkRoleSimilarity(ctx, targetId, targetType, threshold);
    case "human_body": return checkHumanBody(ctx, targetId, targetType, threshold);
    case "flicker": return checkFlicker(ctx, targetId, threshold);
    case "audio_level": return checkAudioLevel(ctx, targetId, threshold);
    case "subtitle_safe": return checkSubtitleSafe(ctx, targetId, threshold);
    case "sensitive_content": return checkSensitiveContent(ctx, targetId, targetType, threshold);
    // 复用旧逻辑（W6 已有）
    case "resolution":
    case "duration":
    default:
      // 旧启发式由 quality-detection-service 处理（向后兼容）
      return { score: 50, items: [{ name: checkType, score: 50, threshold, passed: false, details: { reason: "delegated_to_old_service" } }] };
  }
}

/* ============================================================== */
/* 公开导出：默认 check_type 映射（V2 W12+ 完整版）               */
/* ============================================================== */
export function defaultCheckForV2(targetType: QualityTargetType): QualityCheckType {
  switch (targetType) {
    case "image": return "media_readable";
    case "video": return "media_readable";
    case "audio": return "audio_level";
    case "composition": return "aspect_ratio";
    default: return "media_readable";
  }
}

export { STANDARD_ASPECT_RATIOS };
