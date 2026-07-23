/**
 * @file quality-detection-service.ts
 * @description V2 W6+ REQ-PIPE-004 质检中心服务
 *
 * ## 职责
 *  - detect()：单次质检核心入口（按 targetType 走启发式评分 + 写 qualityReports）
 *  - maybeAutoTriggerQualityCheck()：W6 自动 hook（节点完成时按项目配置触发）
 *  - extractTargetIdFromOutput()：从节点 output 中提取 target_id 的 helper
 *
 * ## 设计原则
 *  - 启发式评分优先（V2.0 MVP 不依赖 AI），后续 P2 可加 AI 评分路径
 *  - 异常/缺数据全部 try/catch 兜底，分数给 50（中性），不挡下游
 *  - 自动 hook 用 fire-and-forget，不阻塞调度器
 *  - 同 node 60s 内已有 report 时幂等跳过，避免重试节点产生 N 条 report
 *
 * ## on_failure 三种联动
 *  - log    : 仅 warn 日志
 *  - review : failed 状态时调 ctx.reviewService.submit（targetType 映射）
 *  - block  : 软阻断（写 node_error_classified 事件 + warn 日志，不改 node.status）
 */

import type { AppContext } from "../app.js";
import type {
  QualityReport,
  QualityTargetType,
  QualityCheckType,
  QualityAutoConfig,
} from "../../types/pipeline.js";
import type { ReviewTargetType } from "../../types/horizontal.js";
import { id as makeId, nowIso } from "../../utils.js";
import { rootLogger } from "../../logger.js";
import { scoreByCheckType, defaultCheckForV2 } from "../horizontal/quality-checkers.js";

const log = rootLogger.child({ module: "quality-detection-service" });

/* ============================================================== */
/* 默认配置（无记录时 fallback）                                    */
/* ============================================================== */
const DEFAULT_AUTO_CONFIG: Omit<QualityAutoConfig, "project_id" | "created_at" | "updated_at"> = {
  id: "",
  enabled: false,
  target_types: [],
  threshold: 70,
  on_failure: "log",
};

/** targetType → 默认 check_type 映射。 */
function defaultCheckFor(targetType: QualityTargetType): QualityCheckType {
  switch (targetType) {
    case "image": return "resolution";
    case "video": return "duration";
    case "audio": return "audio_level";
    case "composition": return "aspect_ratio";
    default: return "resolution";
  }
}

/** 同 node 在 60s 内已有 report 时跳过（避免重试节点产生 N 条 report）。 */
const HOOK_DEDUPE_WINDOW_MS = 60_000;

/* ============================================================== */
/* 启发式评分（按 targetType 分支）                                */
/* ============================================================== */

interface HeuristicItem {
  name: string;
  score: number;
  threshold: number;
  passed: boolean;
  details?: Record<string, unknown>;
}

interface HeuristicResult {
  score: number;
  items: HeuristicItem[];
}

function fallbackHeuristic(targetType: QualityTargetType, reason: string): HeuristicResult {
  // 检测器异常必须失败关闭。禁止用随机分数掩盖检测失败或生成伪通过结果。
  const score = 0;
  return {
    score,
    items: [
      {
        name: defaultCheckFor(targetType),
        score,
        threshold: 70,
        passed: false,
        details: { reason, fallback: true, failClosed: true },
      },
    ],
  };
}

async function scoreImageHeuristically(
  ctx: AppContext,
  targetId: string,
  threshold: number,
): Promise<HeuristicResult> {
  try {
    const img = (await ctx.images.findById(targetId)) as
      | { image_urls?: string[]; params?: Record<string, unknown> }
      | null;
    if (!img) {
      return { score: 50, items: [{ name: "resolution", score: 50, threshold, passed: false, details: { reason: "asset_not_found" } }] };
    }
    // 优先用 params.size / params.width / params.height
    const params = img.params ?? {};
    const sizeStr = typeof params.size === "string" ? params.size : "";
    let width = 0;
    let height = 0;
    const m = sizeStr.match(/^(\d+)\s*x\s*(\d+)$/i);
    if (m) {
      width = Number(m[1]);
      height = Number(m[2]);
    } else {
      width = Number(params.width ?? 0);
      height = Number(params.height ?? 0);
    }
    if (!width || !height) {
      return { score: 50, items: [{ name: "resolution", score: 50, threshold, passed: false, details: { reason: "no_size_metadata" } }] };
    }
    const pixels = width * height;
    // ≥1024×768 (786432 像素) 满分
    // <512×512 (262144 像素) 30 分
    // 线性插值
    const minP = 262144;
    const maxP = 1024 * 768;
    const t = Math.max(0, Math.min(1, (pixels - minP) / (maxP - minP)));
    const score = Math.round(30 + t * 70);
    return {
      score,
      items: [
        {
          name: "resolution",
          score,
          threshold,
          passed: score >= threshold,
          details: { width, height, pixels },
        },
      ],
    };
  } catch (err) {
    log.warn({ err, targetId }, "image heuristic 失败");
    return fallbackHeuristic("image", "image_heuristic_failed");
  }
}

async function scoreVideoHeuristically(
  ctx: AppContext,
  targetId: string,
  threshold: number,
): Promise<HeuristicResult> {
  try {
    const v = (await ctx.videos.findById(targetId)) as
      | { seconds?: string | number; size?: string | number; params?: Record<string, unknown> }
      | null;
    if (!v) {
      return { score: 50, items: [{ name: "duration", score: 50, threshold, passed: false, details: { reason: "asset_not_found" } }] };
    }
    const seconds = Number(v.seconds ?? 0);
    const sizeBytes = Number(v.size ?? 0);
    // 时长 ≥5s 且 ≥100KB → 80+；时长 <2s → 30
    let score = 60;
    if (seconds >= 5 && sizeBytes >= 100_000) score = 85;
    else if (seconds >= 3) score = 75;
    else if (seconds >= 1) score = 60;
    else score = 30;
    return {
      score,
      items: [
        {
          name: "duration",
          score,
          threshold,
          passed: score >= threshold,
          details: { seconds, sizeBytes },
        },
      ],
    };
  } catch (err) {
    log.warn({ err, targetId }, "video heuristic 失败");
    return fallbackHeuristic("video", "video_heuristic_failed");
  }
}

async function scoreAudioHeuristically(
  ctx: AppContext,
  targetId: string,
  threshold: number,
): Promise<HeuristicResult> {
  try {
    const a = (await ctx.audios.findById(targetId)) as
      | { duration?: number; size?: string | number; params?: Record<string, unknown> }
      | null;
    if (!a) {
      return { score: 50, items: [{ name: "audio_level", score: 50, threshold, passed: false, details: { reason: "asset_not_found" } }] };
    }
    const duration = Number(a.duration ?? a.params?.duration ?? 0);
    const sizeBytes = Number(a.size ?? 0);
    let score = 60;
    if (duration >= 5 && sizeBytes >= 50_000) score = 80;
    else if (duration >= 1) score = 70;
    else score = 30;
    return {
      score,
      items: [
        {
          name: "audio_level",
          score,
          threshold,
          passed: score >= threshold,
          details: { duration, sizeBytes },
        },
      ],
    };
  } catch (err) {
    log.warn({ err, targetId }, "audio heuristic 失败");
    return fallbackHeuristic("audio", "audio_heuristic_failed");
  }
}

async function scoreCompositionHeuristically(
  ctx: AppContext,
  targetId: string,
  threshold: number,
): Promise<HeuristicResult> {
  try {
    const c = (await ctx.projectClips.findById(targetId)) as
      | { duration?: number; ratio?: string; params?: Record<string, unknown> }
      | null;
    if (!c) {
      return { score: 50, items: [{ name: "aspect_ratio", score: 50, threshold, passed: false, details: { reason: "asset_not_found" } }] };
    }
    const duration = Number(c.duration ?? c.params?.duration ?? 0);
    const ratio = c.ratio ?? c.params?.ratio ?? "16:9";
    // 标准比例 16:9 / 9:16 / 1:1 / 4:3 → 80；其它 → 60
    const standard = new Set(["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"]);
    const baseScore = standard.has(String(ratio)) ? 80 : 60;
    const bonusScore = duration > 0 ? 5 : 0;
    const score = Math.min(100, baseScore + bonusScore);
    return {
      score,
      items: [
        {
          name: "aspect_ratio",
          score,
          threshold,
          passed: score >= threshold,
          details: { ratio, duration },
        },
      ],
    };
  } catch (err) {
    log.warn({ err, targetId }, "composition heuristic 失败");
    return fallbackHeuristic("composition", "composition_heuristic_failed");
  }
}

async function scoreByType(
  ctx: AppContext,
  targetType: QualityTargetType,
  targetId: string,
  threshold: number,
): Promise<HeuristicResult> {
  switch (targetType) {
    case "image": return await scoreImageHeuristically(ctx, targetId, threshold);
    case "video": return await scoreVideoHeuristically(ctx, targetId, threshold);
    case "audio": return await scoreAudioHeuristically(ctx, targetId, threshold);
    case "composition": return await scoreCompositionHeuristically(ctx, targetId, threshold);
    default: return fallbackHeuristic(targetType, "unknown_target_type");
  }
}

/* ============================================================== */
/* 三段 status 判定                                                */
/* ============================================================== */
function deriveStatus(score: number, threshold: number): "passed" | "warning" | "failed" {
  if (score >= threshold) return "passed";
  if (score >= threshold - 15) return "warning";
  return "failed";
}

/* ============================================================== */
/* loadConfig（读项目配置，无记录走 default）                       */
/* ============================================================== */
async function loadConfig(ctx: AppContext, projectId: string): Promise<QualityAutoConfig> {
  const existing = (await ctx.qualityAutoConfigs.findOne({ project_id: projectId } as any)) as
    | QualityAutoConfig
    | null;
  if (existing) return existing;
  const now = nowIso();
  return {
    ...DEFAULT_AUTO_CONFIG,
    project_id: projectId,
    created_at: now,
    updated_at: now,
  } as QualityAutoConfig;
}

/* ============================================================== */
/* QualityDetectionService（核心 service）                         */
/* ============================================================== */
export interface QualityDetectionResult {
  reportId: string;
  overallScore: number;
  status: "passed" | "warning" | "failed";
}

export interface QualityDetectionService {
  detect(
    targetId: string,
    targetType: QualityTargetType,
    projectId: string,
    runId?: string,
    nodeId?: string,
    opts?: { useAIScoring?: boolean; source?: string },
  ): Promise<QualityDetectionResult>;
}

export function createQualityDetectionService(ctx: AppContext): QualityDetectionService {
  return {
    async detect(targetId, targetType, projectId, runId, nodeId, opts) {
      const cfg = await loadConfig(ctx, projectId);
      // V2 W12+：用扩展版 defaultCheckForV2（image/video → media_readable，audio → audio_level，composition → aspect_ratio）
      const checkType = defaultCheckForV2(targetType);
      const threshold = cfg.threshold;
      const enabled = cfg.enabled === true || opts?.useAIScoring === true;
      const source = opts?.source ?? (enabled ? "auto" : "auto_disabled");

      // 启发式评分：V2 W12+ 走 quality-checkers（覆盖 17 项 check_type）
      const result = await scoreByCheckType(ctx, checkType, targetId, targetType, threshold);
      const status = deriveStatus(result.score, threshold);

      const now = nowIso();
      const report: QualityReport = {
        id: makeId("qrpt"),
        project_id: projectId,
        run_id: runId ?? "",
        node_id: nodeId ?? "",
        check_type: checkType,
        score: result.score,
        threshold,
        passed: status === "passed",
        details: {
          targetId,
          targetType,
          overallScore: result.score,
          status,
          enabled,
          onFailure: cfg.on_failure,
          items: result.items,
          metadata: { source },
        },
        created_at: now,
        // V2 W12+ 新增字段（QA-F22/QA-F24）默认值
        reviewer_note: "",
        reviewed_by: "",
        reviewed_at: "",
        retried: false,
        retry_triggered_at: "",
      };
      await ctx.qualityReports.insert(report as any);

      log.info(
        {
          event: "quality.detect.completed",
          reportId: report.id,
          projectId,
          targetId,
          targetType,
          checkType,
          score: result.score,
          threshold,
          status,
          source,
        },
        `质检完成 ${targetType}/${targetId} score=${result.score} status=${status}`,
      );

      return {
        reportId: report.id,
        overallScore: result.score,
        status,
      };
    },
  };
}

/* ============================================================== */
/* 导出 P1：自动 hook helpers                                       */
/* ============================================================== */

/** 不触发自动 hook 的 nodeType（系统节点 / 流程节点）。 */
const HOOK_SKIP_NODE_TYPES: ReadonlySet<string> = new Set([
  "quality_check",
  "review",
  "notification",
  "wait",
  "webhook",
]);

/** nodeType → QualityTargetType 映射；不可识别返回 null。 */
export function nodeTypeToTargetType(nodeType: string): QualityTargetType | null {
  switch (nodeType) {
    case "image_generation":
    case "generate_image":
      return "image";
    case "video_generation":
    case "generate_video":
      return "video";
    case "tts":
      return "audio";
    case "composition":
    case "compose":
    case "render":
      return "composition";
    default:
      return null;
  }
}

/** nodeType → ReviewTargetType 映射（用于 on_failure=review 提交审核）。 */
function nodeTypeToReviewTargetType(nodeType: string): ReviewTargetType {
  switch (nodeType) {
    case "image_generation":
    case "generate_image":
      return "character_image";
    case "video_generation":
    case "generate_video":
      return "video";
    case "tts":
      return "audio";
    case "composition":
    case "compose":
    case "render":
      return "shot";
    default:
      return "shot";
  }
}

/**
 * extractTargetIdFromOutput - 从节点 output 中按约定字段顺序提取 target_id
 * @param {string} nodeType
 * @param {Record<string, unknown>} output
 * @returns {string | null}
 */
export function extractTargetIdFromOutput(
  nodeType: string,
  output: Record<string, unknown>,
): string | null {
  const get = (k: string): string | null =>
    typeof output[k] === "string" && (output[k] as string).length > 0
      ? (output[k] as string)
      : null;
  switch (nodeType) {
    case "image_generation":
    case "generate_image":
      return get("image_id") || get("asset_id") || get("id");
    case "video_generation":
    case "generate_video":
      return get("video_id") || get("asset_id") || get("id");
    case "tts":
      return get("audio_id") || get("asset_id") || get("id");
    case "composition":
    case "compose":
      return get("composition_id") || get("clip_id") || get("id");
    case "render":
      return get("render_job_id") || get("clip_id") || get("id");
    default:
      return null;
  }
}

/**
 * isRecentlyDetected - 同 node 60s 内已有 report 时返回 true（用于幂等跳过）
 */
async function isRecentlyDetected(
  ctx: AppContext,
  nodeId: string,
  now: number,
): Promise<boolean> {
  try {
    const all = (await ctx.qualityReports.findMany({ node_id: nodeId } as any)) as QualityReport[];
    for (const r of all) {
      const ts = Date.parse(r.created_at);
      if (Number.isFinite(ts) && now - ts < HOOK_DEDUPE_WINDOW_MS) return true;
    }
  } catch {
    // 忽略错误，继续走检测
  }
  return false;
}

/**
 * onFailure - 四种 on_failure 联动
 *  - log      ：仅记录
 *  - review   ：升级审核
 *  - block    ：阻断（写 node_error_classified 事件 + warn 日志）
 *  - auto_retry：调 retryPolicyService 决定是否自动重试；耗尽后转 block
 */
async function onFailure(
  ctx: AppContext,
  payload: { runId: string; nodeId: string; projectId: string; nodeType: string },
  result: QualityDetectionResult,
  onFailureMode: "log" | "review" | "block" | "auto_retry",
): Promise<{ blocked: boolean; autoRetried?: boolean; retryExhausted?: boolean }> {
  if (result.status === "passed") return { blocked: false };

  if (onFailureMode === "log") {
    log.warn(
      {
        event: "quality.detect.warning",
        ...payload,
        score: result.overallScore,
        reportId: result.reportId,
      },
      `节点 ${payload.nodeId} 质检不达标（仅记录）score=${result.overallScore}`,
    );
    return { blocked: false };
  }

  if (onFailureMode === "review") {
    // 只在 failed 时升级到 review（warning 走 log，避免审核噪音）
    if (result.status !== "failed") return { blocked: false };
    try {
      const reviewTargetType = nodeTypeToReviewTargetType(payload.nodeType);
      await ctx.reviewService.submit({
        targetType: reviewTargetType,
        targetId: payload.nodeId,
        projectId: payload.projectId,
        submittedBy: "system:quality-hook",
      });
      log.info(
        {
          event: "quality.review.submitted",
          ...payload,
          score: result.overallScore,
          reportId: result.reportId,
          reviewTargetType,
        },
        "质检失败已自动提交审核",
      );
    } catch (err) {
      log.warn(
        { event: "quality.review.submit_failed", err: String(err), ...payload },
        "提交审核失败（不影响主流程）",
      );
    }
    return { blocked: false };
  }

  if (onFailureMode === "auto_retry") {
    return await handleAutoRetry(ctx, payload, result);
  }

  if (onFailureMode === "block") {
    log.warn(
      {
        event: "quality.detect.blocked",
        ...payload,
        score: result.overallScore,
        reportId: result.reportId,
        status: result.status,
      },
      `质检门禁阻断节点 ${payload.nodeId}`,
    );
    return { blocked: true };
  }
  return { blocked: false };
}

/**
 * V2.1 REM-P1-009：质控低分自动重试。
 *  - 调 ctx.retryPolicyService.resolvePolicy 查项目策略
 *  - 策略不存在 / 关闭 → 退化为 block（不静默）
 *  - 已用尽 maxRetries → 退化为 block + 写 quality_retry_exhausted 事件
 *  - 仍有重试名额 → 调 retryNode 重置节点状态，按退避计算下次延迟
 *  - 每次重试都写 quality.auto_retry.triggered 事件供审计
 */
async function handleAutoRetry(
  ctx: AppContext,
  payload: { runId: string; nodeId: string; projectId: string; nodeType: string },
  result: QualityDetectionResult,
): Promise<{ blocked: boolean; autoRetried?: boolean; retryExhausted?: boolean }> {
  const policy = await ctx.retryPolicyService.resolvePolicy({
    projectId: payload.projectId,
    trigger: "quality_low_score",
  });
  if (!policy || !policy.enabled) {
    log.warn(
      {
        event: "quality.auto_retry.no_policy",
        ...payload,
        score: result.overallScore,
        reportId: result.reportId,
      },
      `on_failure=auto_retry 但项目未配置策略，回退到 block`,
    );
    return { blocked: true, retryExhausted: false };
  }
  // 分数阈值过滤：仅当 score 低于阈值才重试
  if (typeof policy.minScoreThreshold === "number" && result.overallScore > policy.minScoreThreshold) {
    log.info(
      {
        event: "quality.auto_retry.score_above_threshold",
        ...payload,
        score: result.overallScore,
        threshold: policy.minScoreThreshold,
      },
      `分数高于阈值，跳过自动重试（通过）`,
    );
    return { blocked: false };
  }
  // 查 report 以确定已重试次数
  const report = (await ctx.qualityReports.findById(result.reportId)) as (QualityReport & { retry_count?: number }) | null;
  const alreadyRetried = report?.retried ? Number(report?.retry_count ?? 1) : 0;
  if (alreadyRetried >= policy.maxRetries) {
    log.warn(
      {
        event: "quality.auto_retry.exhausted",
        ...payload,
        score: result.overallScore,
        reportId: result.reportId,
        policyId: policy.id,
        alreadyRetried,
        maxRetries: policy.maxRetries,
      },
      `低分重试已耗尽（${alreadyRetried}/${policy.maxRetries}），转 block`,
    );
    if (report) {
      await ctx.qualityReports.update(report.id, {
        retried: true,
        retry_count: alreadyRetried,
        retry_triggered_at: report.retry_triggered_at ?? nowIso(),
        retry_exhausted: true,
      } as Partial<QualityReport>);
    }
    return { blocked: true, retryExhausted: true };
  }
  // 仍有重试名额：调 retryNode（reset to pending）并按退避
  const backoffMs = ctx.retryPolicyService.computeBackoffMs(policy, alreadyRetried + 1);
  const newRetryCount = alreadyRetried + 1;
  try {
    const retrySvc = (ctx.pipelineRunService as { retryNode?: (runId: string, nodeId: string) => Promise<unknown> });
    if (typeof retrySvc.retryNode !== "function") {
      log.warn({ event: "qa.f24.no_retry_method" }, "pipelineRunService.retryNode 不存在，跳过重试");
      return { blocked: true, retryExhausted: false };
    }
    await retrySvc.retryNode(payload.runId, payload.nodeId);
    if (report) {
      await ctx.qualityReports.update(report.id, {
        retried: true,
        retry_count: newRetryCount,
        retry_triggered_at: nowIso(),
        retry_exhausted: false,
      } as Partial<QualityReport>);
    }
    try {
      await ctx.transactionService.enqueueOutboxEvent({
        topic: "quality.auto_retry.triggered",
        payload: {
          runId: payload.runId,
          nodeId: payload.nodeId,
          projectId: payload.projectId,
          nodeType: payload.nodeType,
          reportId: result.reportId,
          score: result.overallScore,
          threshold: policy.minScoreThreshold ?? null,
          retryCount: newRetryCount,
          maxRetries: policy.maxRetries,
          backoffMs,
          policyId: policy.id,
        },
        source: "quality-detection-service.auto_retry",
        maxAttempts: 3,
      });
    } catch { /* outbox 不可用不影响主流程 */ }
    log.info(
      {
        event: "qa.f24.auto_retry_triggered",
        ...payload,
        score: result.overallScore,
        reportId: result.reportId,
        policyId: policy.id,
        retryCount: newRetryCount,
        maxRetries: policy.maxRetries,
        backoffMs,
      },
      `低分自动重试已触发：${newRetryCount}/${policy.maxRetries} 退避=${backoffMs}ms`,
    );
    return { blocked: false, autoRetried: true };
  } catch (err) {
    log.error(
      { event: "qa.f24.auto_retry_failed", ...payload, error: (err as Error).message },
      `低分自动重试失败，转 block：${(err as Error).message}`,
    );
    return { blocked: true, retryExhausted: false };
  }
}

/**
 * V2 W12+ QA-F24 低分自动重试
 *  - 条件：on_failure=block + status=failed
 *  - 调 ctx.pipelineRunService.retryNode 重试节点
 *  - 写 quality_reports.retried=true + retry_triggered_at
 *  - 限制：单 report 仅触发 1 次（retried 字段防重入）
 */
async function triggerLowScoreRetry(
  ctx: AppContext,
  payload: { runId: string; nodeId: string; projectId: string; nodeType: string },
  result: QualityDetectionResult,
): Promise<void> {
  // 查 report
  const report = (await ctx.qualityReports.findById(result.reportId)) as QualityReport | null;
  if (!report) return;
  // 防重入：已重试过则跳过
  if (report.retried) {
    log.debug({ event: "qa.f24.already_retried", reportId: result.reportId }, "report 已重试过，跳过");
    return;
  }
  // 调 retryNode
  const retrySvc = (ctx.pipelineRunService as { retryNode?: (runId: string, nodeId: string) => Promise<unknown> });
  if (typeof retrySvc.retryNode !== "function") {
    log.warn({ event: "qa.f24.no_retry_method" }, "pipelineRunService.retryNode 不存在");
    return;
  }
  await retrySvc.retryNode(payload.runId, payload.nodeId);
  // 标记已重试
  const now = nowIso();
  await ctx.qualityReports.update(result.reportId, {
    retried: true,
    retry_triggered_at: now,
  } as Partial<QualityReport>);
  log.info(
    {
      event: "qa.f24.retry_triggered",
      reportId: result.reportId,
      runId: payload.runId,
      nodeId: payload.nodeId,
      score: result.overallScore,
    },
    `低分自动重试已触发：node ${payload.nodeId} score=${result.overallScore}`,
  );
}

/* ============================================================== */
/* 导出 P1：maybeAutoTriggerQualityCheck（节点完成 hook）           */
/* ============================================================== */
export interface MaybeAutoTriggerInput {
  runId: string;
  nodeId: string;
  projectId: string;
  nodeType: string;
  output: Record<string, unknown>;
}

export interface MaybeAutoTriggerResult {
  reportId?: string;
  status?: "passed" | "warning" | "failed";
  skipped?: boolean;
  reason?: string;
  /** true 表示质量门禁拒绝节点完成，调用方必须停止下游调度。 */
  blocked?: boolean;
  score?: number;
}

export async function maybeAutoTriggerQualityCheck(
  ctx: AppContext,
  payload: MaybeAutoTriggerInput,
): Promise<MaybeAutoTriggerResult> {
  // 1) 系统/流程节点不触发
  if (HOOK_SKIP_NODE_TYPES.has(payload.nodeType)) {
    return { skipped: true, reason: "skip_node_type" };
  }
  // 2) nodeType → targetType
  const targetType = nodeTypeToTargetType(payload.nodeType);
  if (!targetType) {
    return { skipped: true, reason: "unknown_node_type" };
  }
  // 自动 hook 仅在项目显式启用且目标类型被纳入配置时执行。
  const cfg = await ctx.qualityAutoConfigs.findOne({
    project_id: payload.projectId,
  } as any);
  if (!cfg?.enabled) {
    return { skipped: true, reason: "auto_quality_disabled" };
  }
  if (!cfg.target_types.includes(targetType)) {
    return { skipped: true, reason: "target_type_disabled" };
  }
  // 3) 提取 targetId
  const targetId = extractTargetIdFromOutput(payload.nodeType, payload.output);
  if (!targetId) {
    return { skipped: true, reason: "no_target_id" };
  }
  // 4) 幂等：同 node 60s 内已有 report
  const now = Date.now();
  if (await isRecentlyDetected(ctx, payload.nodeId, now)) {
    return { skipped: true, reason: "dedupe" };
  }
  // 5) 调服务
  const result = await ctx.qualityDetectionService.detect(
    targetId,
    targetType,
    payload.projectId,
    payload.runId,
    payload.nodeId,
    { source: "auto" },
  );
  // 6) on_failure 联动
  const onFailureMode = cfg.on_failure;
  const action = await onFailure(ctx, payload, result, onFailureMode);
  return {
    reportId: result.reportId,
    status: result.status,
    blocked: action.blocked,
    score: result.overallScore,
  };
}
