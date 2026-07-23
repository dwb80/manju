/**
 * @file composition-service.ts
 * @description 合成 / 渲染 预检服务 —— V2 W11 P0 缺口补齐。
 *
 * 负责两件事：
 *  1. REQ-REVIEW-F20：合成/渲染前校验"上游审核是否已通过"
 *     - 查 review_items 表中关联到 shot 的最新一条 review
 *     - status !== 'approved' → 抛 review_not_approved 错误
 *  2. REQ-RENDER-F01：preRenderCheck 预检函数
 *     - 输入 { projectId, shots[] }
 *     - 检查：依赖完成？配额？上游 review 通过？素材 URL 有效？
 *     - 返 { ok, reasons[] }
 *
 * 集成点：pipeline-run-service.ts 的 executeNode → case "composition"/"render"/"image_generation"/"video_generation"
 *        入口会调 assertReviewApprovedForShots；preRenderCheck 可由前端 "开始合成" 按钮直接调用。
 */
import { rootLogger } from "../../logger.js";
import type { AppContext } from "../app.js";
import {
  resolveRenderPreset,
  resolveVideoParams,
  type RenderPresetKey,
  RENDER_PRESETS,
} from "../../types/render-presets.js";

const log = rootLogger.child({ module: "composition-service" });

export interface PreRenderShotInput {
  id: string;
  /** 镜头关联的视频/图片 URL（用于素材存在性检查） */
  video_url?: string;
  /** 镜头关联的脚本/分镜 id（用于反查 review） */
  storyboard_id?: string;
  /** 镜头关联的 episode（项目内多集时用） */
  episode?: number;
  /** 镜头依赖的上游节点 id（pipeline 节点） */
  depends_on?: string[];
}

export interface PreRenderCheckResult {
  ok: boolean;
  reasons: PreRenderCheckReason[];
  /** 已完成的依赖节点 id 列表（用于诊断） */
  completedDeps: string[];
  /** 未完成的依赖节点 id 列表 */
  pendingDeps: string[];
  /** 已通过审核的 shot 列表 */
  approvedShots: string[];
  /** 未通过审核的 shot 列表 */
  unapprovedShots: string[];
}

export interface PreRenderCheckReason {
  code:
    | "no_shots"
    | "missing_video_url"
    | "incomplete_dependencies"
    | "review_not_approved"
    | "budget_hard_cap_will_exceed"
    | "project_budget_not_configured";
  message: string;
  /** 关联的 shot id（如果是 shot 级问题） */
  shotId?: string;
  /** 关联的依赖节点 id（如果是依赖问题） */
  depId?: string;
  /** 关联的 review id（如果是 review 问题） */
  reviewId?: string;
}

/** 抛错时使用，HTTP 层可翻译为 400/409。 */
export class CompositionGuardError extends Error {
  code: string;
  reviewId?: string;
  shotId?: string;
  constructor(message: string, code: string, opts?: { reviewId?: string; shotId?: string }) {
    super(message);
    this.code = code;
    this.reviewId = opts?.reviewId;
    this.shotId = opts?.shotId;
  }
}

export interface CompositionService {
  /** REQ-RENDER-F01：预检函数，返回 ok + reasons，不抛错 */
  preRenderCheck(input: { projectId: string; shots: PreRenderShotInput[]; /** 可选：检查预算（默认 true） */ checkBudget?: boolean; /** 可选：render preset key（用于横/竖版规格预检），默认 landscape_1080p */ presetKey?: RenderPresetKey | string }): Promise<PreRenderCheckResult>;
  /** REQ-REVIEW-F20：硬校验上游审核，失败抛 CompositionGuardError */
  assertReviewApprovedForShots(input: { projectId: string; shotIds: string[]; /** 默认 'composition'：调用方场景 */ context?: string }): Promise<{ approvedShotIds: string[]; reviewMap: Record<string, string> }>;
  /** RENDER-F03/F04：根据 preset 解析合成/渲染规格(width/height/fps/duration/ratio) */
  resolveCompositionPreset(input: { presetKey?: RenderPresetKey | string; ratio?: string; duration?: 3 | 5 | 10 | 18 }): { key: RenderPresetKey; width: number; height: number; fps: number; duration: 3 | 5 | 10 | 18; ratio: "16:9" | "9:16" | "1:1"; format: "mp4" | "mov"; valid: boolean; notice?: string };
}

export function createCompositionService(ctx: AppContext): CompositionService {
  return {
    async preRenderCheck(input) {
      const { projectId, shots } = input;
      const checkBudget = input.checkBudget !== false;
      const reasons: PreRenderCheckReason[] = [];
      const completedDeps: string[] = [];
      const pendingDeps: string[] = [];
      const approvedShots: string[] = [];
      const unapprovedShots: string[] = [];

      // 1) shots 必填
      if (!Array.isArray(shots) || shots.length === 0) {
        reasons.push({ code: "no_shots", message: "缺少镜头（shots 数组为空）" });
        return { ok: false, reasons, completedDeps, pendingDeps, approvedShots, unapprovedShots };
      }

      // 2) 每个 shot 必须有 video_url
      for (const s of shots) {
        if (!s.video_url || typeof s.video_url !== "string") {
          reasons.push({ code: "missing_video_url", message: `镜头 ${s.id} 缺少素材 URL（video_url）`, shotId: s.id });
        }
      }

      // 3) 依赖检查（pipeline_nodes 表）
      const allDeps = new Set<string>();
      for (const s of shots) {
        if (Array.isArray(s.depends_on)) for (const d of s.depends_on) allDeps.add(d);
      }
      for (const depId of allDeps) {
        const dep = await ctx.pipelineNodes.findById(depId);
        if (!dep) {
          pendingDeps.push(depId);
          reasons.push({ code: "incomplete_dependencies", message: `依赖节点不存在：${depId}`, depId });
        } else if (dep.status !== "completed" && dep.status !== "skipped") {
          pendingDeps.push(depId);
          reasons.push({ code: "incomplete_dependencies", message: `依赖节点 ${depId} 状态为 ${dep.status}，未完成`, depId });
        } else {
          completedDeps.push(depId);
        }
      }

      // 4) 上游 review 校验（spec：shots 必须全部 approved）
      const reviewMap = await assertReviewApprovedInternal(ctx, projectId, shots.map((s) => s.id));
      for (const s of shots) {
        if (reviewMap[s.id]) {
          approvedShots.push(s.id);
        } else {
          unapprovedShots.push(s.id);
          reasons.push({ code: "review_not_approved", message: `镜头 ${s.id} 上游审核未通过`, shotId: s.id });
        }
      }

      // 5) 预算检查（可选；用 hard_cap - 1 次最小合成的预估）
      if (checkBudget) {
        const budget = await ctx.projectBudgets.findOne({ project_id: projectId });
        if (!budget) {
          // 软警告：未配预算不阻塞
          log.debug({ projectId }, "项目未配预算，跳过预算预检");
        } else if (budget.hard_cap && budget.hard_cap > 0) {
          const est = await ctx.budgetService.estimateCost({
            kind: "video",
            model: "agnes-video-v2.0",
            numFrames: 441,
            count: shots.length,
            projectId,
          });
          if (est.exceedsHardCap) {
            reasons.push({
              code: "budget_hard_cap_will_exceed",
              message: `合成将超 hard_cap：预估 ${est.estimatedCost} 元 > 余额 ${est.hardCap - est.currentCost} 元（current=${est.currentCost}, cap=${est.hardCap}）`,
            });
          }
        }
      }

      return {
        ok: reasons.length === 0,
        reasons,
        completedDeps,
        pendingDeps,
        approvedShots,
        unapprovedShots,
      };
    },

    async assertReviewApprovedForShots(input) {
      const { projectId, shotIds } = input;
      const context = input.context ?? "composition";
      const reviewMap = await assertReviewApprovedInternal(ctx, projectId, shotIds);
      const unapproved = shotIds.filter((id) => !reviewMap[id]);
      if (unapproved.length > 0) {
        const sample = unapproved[0];
        const sampleReview = await latestReviewForShot(ctx, projectId, sample);
        log.warn(
          { projectId, context, unapproved, sampleReview: sampleReview?.id },
          `REVIEW-F20 ${context} 被拒：上游审核未通过`,
        );
        throw new CompositionGuardError(
          `review_not_approved: ${context} 拒绝执行，镜头 ${unapproved.length}/${shotIds.length} 个上游审核未通过（首个：${sample}）`,
          "review_not_approved",
          { reviewId: sampleReview?.id, shotId: sample },
        );
      }
      return { approvedShotIds: shotIds, reviewMap };
    },

    resolveCompositionPreset(input) {
      // RENDER-F03/F04:走 resolveVideoParams 走完整 ratio 解析;
      // presetKey 优先,无 key 则用 ratio alias 到默认 preset(向后兼容老接口)
      const params = resolveVideoParams({
        presetKey: input.presetKey ?? null,
        ratio: input.ratio ?? null,
        duration: input.duration,
      });
      const preset = RENDER_PRESETS[params.presetKey];
      const result: ReturnType<CompositionService["resolveCompositionPreset"]> = {
        key: params.presetKey,
        width: params.width,
        height: params.height,
        fps: preset.fps,
        duration: params.duration,
        ratio: params.ratio,
        format: preset.format,
        valid: params.valid,
      };
      if (params.notice) result.notice = params.notice;
      return result;
    },
  };
}

/* ============== 内部 helpers ============== */

async function latestReviewForShot(
  ctx: AppContext,
  projectId: string,
  shotId: string,
): Promise<{ id: string; status: string; shot_id: string } | null> {
  // review_items 表：找最近一条 ref_type=shot & ref_id=shotId & project_id=projectId 的 review
  try {
    const reviews = await ctx.reviewItems.findMany({ project_id: projectId, ref_type: "shot", ref_id: shotId } as any);
    if (!reviews || reviews.length === 0) return null;
    // 取最近（按 created_at desc）
    reviews.sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)));
    return { id: reviews[0].id, status: reviews[0].status, shot_id: shotId };
  } catch (e) {
    log.debug({ err: e, projectId, shotId }, "查 review 失败，忽略");
    return null;
  }
}

async function assertReviewApprovedInternal(
  ctx: AppContext,
  projectId: string,
  shotIds: string[],
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const shotId of shotIds) {
    const review = await latestReviewForShot(ctx, projectId, shotId);
    if (review && review.status === "approved") {
      result[shotId] = review.id;
    }
  }
  return result;
}
