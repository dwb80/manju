/**
 * @file review-service.ts
 * @description 审核中心服务。7 状态机：pending → in_review → (approved | rejected) → (closed | needs_fix) → ...。
 *
 * ## 设计要点
 *  - submit() 自动 upsert：同 target_type + target_id 已存在则重置为 pending。
 *  - approve() 自动通知 submitter（如非审核员本人）。
 *  - reject() 连续 3 次打回时通知项目 owner（自动升级）。
 *  - reject() 同步创建 / 更新 review todo，让被打回方有明确跟进项。
 *  - 所有变更都走 review_histories 表存证，便于审计 / 复盘。
 *
 * ## 表结构
 *  - review_items(id, target_type, target_id, project_id, status, rejected_count, ...)
 *  - review_histories(id, review_id, from_status, to_status, action, actor_id, comment, metadata, created_at)
 *  - todos（同步生成 review todo）
 */
import { id, nowIso } from "../../utils.js";
import { rootLogger } from "../../logger.js";
import type { AppContext } from "../app.js";
import {
  isPipelineReworkTargetType,
  createPipelineReworkTodo,
} from "./rework-todo-service.js";
import type {
  ReviewItem,
  ReviewStatus,
  ReviewTargetType,
  RejectionReasonCode,
  ReviewHistory,
  ReviewAction,
  ReviewConfig,
} from "../../types/horizontal.js";
import type { TodoStatus, TodoPriority } from "../../types/todo.js";
import { computeSlaDueAt as computeSlaDueAtFn } from "./sla-utils.js";

/** 内部 helper：包装 sla-utils 的 computeSlaDueAt，单测可 mock。 */
function computeSlaDueAtLocal(
  review: Pick<ReviewItem, "status" | "created_at" | "updated_at">,
  config: Pick<ReviewConfig, "sla_pending_hours" | "sla_review_hours">,
): string {
  return computeSlaDueAtFn(review, config);
}

/** 11 种打回原因（前端下拉框）。 */
export const REJECTION_REASONS: Array<{ code: RejectionReasonCode; label: string }> = [
  { code: "character_inconsistent", label: "人设偏离" },
  { code: "costume_wrong", label: "服装错" },
  { code: "proportion_off", label: "比例失真" },
  { code: "lighting_unreasonable", label: "光影不合理" },
  { code: "sensitive_content", label: "敏感内容" },
  { code: "dialogue_error", label: "对白错误" },
  { code: "visual_error", label: "画面错误" },
  { code: "asset_error", label: "资产错误" },
  { code: "plot_mismatch", label: "剧情不符" },
  { code: "shot_issue", label: "镜头问题" },
  { code: "other", label: "其他" },
];

/** 合法状态转移矩阵。 */
export const VALID_TRANSITIONS: Record<ReviewStatus, ReviewStatus[]> = {
  pending: ["in_review", "cancelled"],
  in_review: ["approved", "rejected"],
  approved: ["closed"],
  rejected: ["pending", "cancelled"],
  needs_fix: ["pending"],
  closed: [],
  cancelled: [],
};

export function validateTransition(from: ReviewStatus, to: ReviewStatus): boolean {
  const allowed = VALID_TRANSITIONS[from] ?? [];
  return allowed.includes(to);
}

export interface ReviewStats {
  pending: number;
  in_review: number;
  approved: number;
  rejected: number;
  needs_fix: number;
  closed: number;
  cancelled: number;
  blockedByFrequentRejection: number;
  progress: { approved: number; total: number; pct: number };
}

export interface ReviewService {
  submit(input: {
    targetType: ReviewTargetType;
    targetId: string;
    projectId: string;
    submittedBy: string;
  }): Promise<ReviewItem>;
  approve(id: string, reviewerId: string): Promise<ReviewItem>;
  reject(id: string, reviewerId: string, reasonCode: RejectionReasonCode): Promise<ReviewItem>;
  startReview(id: string, reviewerId: string): Promise<ReviewItem>;
  cancel(id: string, actorId: string): Promise<ReviewItem>;
  close(id: string, actorId: string): Promise<ReviewItem>;
  resubmit(id: string, submittedBy: string): Promise<ReviewItem>;
  listHistory(reviewId: string): Promise<ReviewHistory[]>;
  stats(projectId: string): Promise<ReviewStats>;
  listByStatus(projectId: string, status: ReviewStatus): Promise<ReviewItem[]>;
}

export function createReviewService(ctx: AppContext): ReviewService {
  const log = rootLogger.child({ module: "review-service" });

  async function recordHistory(input: {
    reviewId: string;
    fromStatus: ReviewStatus | "";
    toStatus: ReviewStatus;
    action: ReviewAction;
    actorId: string;
    comment?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      const now = nowIso();
      const entry: ReviewHistory = {
        id: id("review_history"),
        review_id: input.reviewId,
        from_status: input.fromStatus,
        to_status: input.toStatus,
        action: input.action,
        actor_id: input.actorId,
        comment: input.comment ?? "",
        metadata: input.metadata ? JSON.stringify(input.metadata) : "",
        created_at: now,
      };
      await ctx.reviewHistories.insert(entry);
    } catch (err) {
      log.warn(
        { event: "review.history_record_failed", reviewId: input.reviewId, err: String(err) },
        "审核历史写入失败",
      );
    }
  }

  return {
    async submit({ targetType, targetId, projectId, submittedBy }) {
      const all = await ctx.reviewItems.findMany();
      const existing = all.find((r) => r.target_type === targetType && r.target_id === targetId);
      const now = nowIso();
      if (existing) {
        const updated: ReviewItem = {
          ...existing,
          status: "pending",
          approved_at: "",
          project_id: projectId,
          updated_at: now,
        };
        await ctx.reviewItems.update(existing.id, updated);
        const reworkTodo = await ctx.todos.findOne({
          owner: submittedBy,
          link_type: "review",
          link_id: existing.id,
        });
        if (reworkTodo && reworkTodo.status !== "done") {
          await ctx.todos.update(reworkTodo.id, { status: "done", updated_at: now });
        }
        log.info(
          {
            event: "review.resubmit",
            reviewId: existing.id,
            targetType,
            targetId,
            projectId,
            rejectedCount: existing.rejected_count,
          },
          `审核重新提交：reviewId=${existing.id}，目标类型=${targetType}，累计退回=${existing.rejected_count}次`,
        );
        ctx.auditService.log(submittedBy, "review.submit", {
          type: "review",
          id: existing.id,
          payload: { targetType, targetId, projectId, resubmit: true, rejected_count: existing.rejected_count },
        });
        return updated;
      }
      const created: ReviewItem = {
        id: id("rev"),
        target_type: targetType,
        target_id: targetId,
        project_id: projectId,
        status: "pending",
        rejected_count: 0,
        rejection_reason: "",
        approved_at: "",
        submitted_by: submittedBy,
        reviewed_by: "",
        created_at: now,
        updated_at: now,
        // V2 W8 REQ-PIPE-005-03 SLA 升级：初始化 4 个 SLA 字段
        sla_due_at: "",       // 由 sla-monitor.tick() 在首次扫描时按 config 补算
        escalation_level: 0,
        escalated_at: "",
        breached_at: "",
        // V2 W12 P0 REQ-REVIEW-F16：前序 review 链（首次提交初始化）
        previous_review_id: "",
        chain_id: id("rc"),
      };
      await ctx.reviewItems.insert(created);
      // V2 W8：创建后立即算一次 sla_due_at（用项目默认 config），
      // 这样 24h 的 pending SLA 可以从入库瞬间开始计时，而不是等下次 tick。
      try {
        const config = await ctx.slaMonitor.getOrCreateConfig(projectId);
        const due = computeSlaDueAtLocal(created, config);
        if (due) {
          await ctx.reviewItems.update(created.id, { sla_due_at: due, updated_at: now } as any);
          created.sla_due_at = due;
        }
      } catch (e) {
        // SLA 初始化失败不应阻塞审核提交
        rootLogger.warn({ err: e, reviewId: created.id }, "SLA 初始 due_at 写入失败（非阻塞）");
      }
      log.info(
        { event: "review.submit", reviewId: created.id, targetType, targetId, projectId },
        `审核提交：reviewId=${created.id}，目标类型=${targetType}，项目=${projectId}`,
      );
      ctx.auditService.log(submittedBy, "review.submit", {
        type: "review",
        id: created.id,
        payload: { targetType, targetId, projectId },
      });
      return created;
    },

    async approve(reviewId, reviewerId) {
      const all = await ctx.reviewItems.findMany();
      const found = all.find((r) => r.id === reviewId);
      if (!found) {
        log.warn({ event: "review.approve_not_found", reviewId }, `审核通过失败：记录不存在，reviewId=${reviewId}`);
        throw new Error(`review_not_found: ${reviewId}`);
      }
      if (found.status !== "pending" && found.status !== "in_review") {
        log.warn(
          { event: "review.approve_invalid_status", reviewId, currentStatus: found.status },
          `审核通过失败：状态不是 pending/in_review，当前=${found.status}`,
        );
        throw new Error("只有待审/审核中记录可以通过");
      }
      const now = nowIso();
      const updated: ReviewItem = {
        ...found,
        status: "approved",
        approved_at: now,
        reviewed_by: reviewerId,
        rejection_reason: "",
        updated_at: now,
      };
      await ctx.reviewItems.update(reviewId, updated);
      await recordHistory({
        reviewId,
        fromStatus: found.status,
        toStatus: "approved",
        action: "approve",
        actorId: reviewerId,
        metadata: { rejectedCount: found.rejected_count },
      });
      log.info(
        {
          event: "review.approve",
          reviewId,
          targetType: found.target_type,
          targetId: found.target_id,
          reviewerId,
          rejectedCount: found.rejected_count,
        },
        `审核通过：reviewId=${reviewId}，审核员=${reviewerId}`,
      );
      ctx.auditService.log(reviewerId, "review.approve", {
        type: "review",
        id: reviewId,
        payload: {
          targetType: found.target_type,
          targetId: found.target_id,
          rejectedCount: found.rejected_count,
        },
      });
      if (found.submitted_by && found.submitted_by !== reviewerId) {
        ctx.notificationService.notify(
          found.submitted_by,
          "review.approved",
          "审核已通过",
          `你的 ${found.target_type} 已通过审核`,
          { reviewId, targetType: found.target_type, targetId: found.target_id },
        );
      }
      return updated;
    },

    async reject(reviewId, reviewerId, reasonCode) {
      const all = await ctx.reviewItems.findMany();
      const found = all.find((r) => r.id === reviewId);
      if (!found) {
        log.warn({ event: "review.reject_not_found", reviewId }, `审核打回失败：记录不存在，reviewId=${reviewId}`);
        throw new Error(`review_not_found: ${reviewId}`);
      }
      if (found.status !== "pending" && found.status !== "in_review") {
        log.warn(
          { event: "review.reject_invalid_status", reviewId, currentStatus: found.status },
          `审核打回失败：状态不是 pending/in_review，当前=${found.status}`,
        );
        throw new Error("只有待审/审核中记录可以打回");
      }
      const now = nowIso();
      const newRejectedCount = found.rejected_count + 1;
      const updated: ReviewItem = {
        ...found,
        status: "rejected",
        rejected_count: newRejectedCount,
        rejection_reason: reasonCode,
        approved_at: "",
        reviewed_by: reviewerId,
        updated_at: now,
      };
      await ctx.reviewItems.update(reviewId, updated);
      await recordHistory({
        reviewId,
        fromStatus: found.status,
        toStatus: "rejected",
        action: "reject",
        actorId: reviewerId,
        metadata: { reasonCode, rejectedCount: newRejectedCount },
      });
      log.info(
        {
          event: "review.reject",
          reviewId,
          targetType: found.target_type,
          targetId: found.target_id,
          reviewerId,
          reasonCode,
          rejectedCount: newRejectedCount,
        },
        `审核打回：reviewId=${reviewId}，原因=${reasonCode}，累计退回=${newRejectedCount}次`,
      );
      ctx.auditService.log(reviewerId, "review.reject", {
        type: "review",
        id: reviewId,
        payload: {
          targetType: found.target_type,
          targetId: found.target_id,
          reasonCode,
          rejectedCount: newRejectedCount,
        },
      });
      // 同步打回 todo
      try {
        const todoStatus: TodoStatus = "pending";
        const todoPriority: TodoPriority = newRejectedCount >= 3 ? "high" : "medium";
        const todoPatch = {
          title: `审核退回：${REJECTION_REASONS.find((r) => r.code === reasonCode)?.label ?? reasonCode}`,
          description: `${found.target_type}（${found.target_id}）被退回，请修改后重新提交。`,
          status: todoStatus,
          priority: todoPriority,
          owner: found.submitted_by,
          due_date: "",
          link_type: "review",
          link_id: reviewId,
          link_url: `/review?projectId=${encodeURIComponent(found.project_id)}&reviewId=${encodeURIComponent(reviewId)}`,
          updated_at: now,
          deleted_at: "",
        };
        const existingTodo = await ctx.todos.findOne({
          owner: found.submitted_by,
          link_type: "review",
          link_id: reviewId,
        });
        if (existingTodo) {
          await ctx.todos.update(existingTodo.id, todoPatch);
        } else {
          await ctx.todos.insert({ id: id("todo"), ...todoPatch, created_at: now });
        }
      } catch (todoErr) {
        log.warn(
          { event: "review.todo_create_failed", reviewId, err: String(todoErr) },
          "审核退回 todo 创建失败",
        );
      }
      // ===== V2 W8 REQ-PIPE-005-01 pipeline 返工 todo 自动创建 =====
      if (isPipelineReworkTargetType(found.target_type)) {
        try {
          let run: { id: string; name?: string; project_id?: string } | null = null;
          let node: { id: string; name?: string; type?: string; error?: string; run_id?: string } | null = null;
          if (found.target_type === "pipeline_run") {
            const r = await ctx.pipelineRuns.findById(found.target_id);
            if (r) run = r;
          } else if (found.target_type === "pipeline_node") {
            const n = await ctx.pipelineNodes.findById(found.target_id);
            if (n) {
              node = n;
              if (n.run_id) {
                const r = await ctx.pipelineRuns.findById(n.run_id);
                if (r) run = r;
              }
            }
          }
          if (run) {
            const reasonLabel = REJECTION_REASONS.find((r) => r.code === reasonCode)?.label ?? reasonCode;
            await createPipelineReworkTodo(ctx, {
              review: found,
              run: run as { id: string; name?: string; project_id?: string },
              node: node as { id: string; name?: string; type?: string; error?: string; run_id?: string } | null,
              reasonCode,
              reasonLabel,
              rejectedCount: newRejectedCount,
              submittedBy: found.submitted_by,
            });
          } else {
            log.debug(
              { event: "review.pipeline_rework_no_run", reviewId, targetType: found.target_type, targetId: found.target_id },
              "pipeline 返工 todo 跳过：找不到 run",
            );
          }
        } catch (reworkErr) {
          log.warn(
            { event: "review.pipeline_rework_todo_failed", reviewId, err: String(reworkErr) },
            "pipeline 返工 todo 创建失败（不影响主流程）",
          );
        }
      }
      // 累计 3 次自动升级通知 owner
      if (newRejectedCount >= 3) {
        log.warn(
          {
            event: "review.frequent_rejection",
            reviewId,
            targetType: found.target_type,
            targetId: found.target_id,
            rejectedCount: newRejectedCount,
          },
          `审核反复被打回：reviewId=${reviewId}，累计退回 ${newRejectedCount} 次，将通知项目负责人`,
        );
        const proj = await ctx.projects.findById(found.project_id);
        const ownerId = proj?.owner ?? "default";
        ctx.notificationService.notify(
          ownerId,
          "review.frequent_rejection",
          "审核反复被打回",
          `${found.target_type}（${found.target_id}）已累计退回 ${newRejectedCount} 次，需要项目负责人介入`,
          {
            reviewId,
            targetType: found.target_type,
            targetId: found.target_id,
            rejectedCount: newRejectedCount,
          },
        );
      }
      return updated;
    },

    async startReview(reviewId, actorId) {
      const all = await ctx.reviewItems.findMany();
      const found = all.find((r) => r.id === reviewId);
      if (!found) throw new Error("review_not_found: " + reviewId);
      if (!validateTransition(found.status, "in_review")) {
        throw new Error("illegal transition: " + found.status + " -> in_review");
      }
      const now = nowIso();
      const newStatus: ReviewStatus = "in_review";
      const updated: ReviewItem = { ...found, status: newStatus, updated_at: now };
      await ctx.reviewItems.update(reviewId, { ...updated, status: newStatus });
      await recordHistory({
        reviewId,
        fromStatus: found.status,
        toStatus: newStatus,
        action: "start_review",
        actorId,
      });
      log.info({ event: "review.startReview", reviewId, actorId }, "startReview review: " + reviewId);
      return updated;
    },

    async cancel(reviewId, actorId) {
      const all = await ctx.reviewItems.findMany();
      const found = all.find((r) => r.id === reviewId);
      if (!found) throw new Error("review_not_found: " + reviewId);
      if (!validateTransition(found.status, "cancelled")) {
        throw new Error("illegal transition: " + found.status + " -> cancelled");
      }
      const now = nowIso();
      const newStatus: ReviewStatus = "cancelled";
      const updated: ReviewItem = { ...found, status: newStatus, updated_at: now };
      await ctx.reviewItems.update(reviewId, { ...updated, status: newStatus });
      await recordHistory({
        reviewId,
        fromStatus: found.status,
        toStatus: newStatus,
        action: "cancel",
        actorId,
      });
      log.info({ event: "review.cancel", reviewId, actorId }, "cancel review: " + reviewId);
      return updated;
    },

    async close(reviewId, actorId) {
      const all = await ctx.reviewItems.findMany();
      const found = all.find((r) => r.id === reviewId);
      if (!found) throw new Error("review_not_found: " + reviewId);
      if (!validateTransition(found.status, "closed")) {
        throw new Error("illegal transition: " + found.status + " -> closed");
      }
      const now = nowIso();
      const newStatus: ReviewStatus = "closed";
      const updated: ReviewItem = { ...found, status: newStatus, updated_at: now };
      await ctx.reviewItems.update(reviewId, { ...updated, status: newStatus });
      await recordHistory({
        reviewId,
        fromStatus: found.status,
        toStatus: newStatus,
        action: "close",
        actorId,
      });
      log.info({ event: "review.close", reviewId, actorId }, "close review: " + reviewId);
      return updated;
    },

    async resubmit(reviewId, submittedBy) {
      const all = await ctx.reviewItems.findMany();
      const found = all.find((r) => r.id === reviewId);
      if (!found) throw new Error("review_not_found: " + reviewId);
      if (!validateTransition(found.status, "pending")) {
        throw new Error("illegal transition: " + found.status + " -> pending");
      }
      const now = nowIso();
      const newStatus: ReviewStatus = "pending";
      const newResubmitCount = (found.re_submit_count ?? 0) + 1;
      // V2 W12 P0 REQ-REVIEW-F16：前序 review 关联
      // - previous_review_id：本次 resubmit 的"前一次 review"id（即当前这条）
      // - chain_id：继承前序 chain_id（首次 submit 时生成）
      const previous_review_id = found.id;
      const chain_id = found.chain_id || previous_review_id || id("rc");
      const updated: ReviewItem = {
        ...found,
        status: newStatus,
        re_submit_count: newResubmitCount,
        rejection_reason: "",
        approved_at: "",
        reviewed_by: "",
        previous_review_id,
        chain_id,
        updated_at: now,
      };
      await ctx.reviewItems.update(reviewId, { ...updated, status: newStatus });
      // V2 W12 P0 REQ-REVIEW-F01：写审核快照（记录 resubmit 前的状态）
      try {
        const { recordReviewSnapshot } = await import(
          "../module-domain/review-snapshot-service.js"
        );
        await recordReviewSnapshot(ctx, found, "resubmit", submittedBy);
      } catch {
        // 快照失败不影响主流程
      }
      await recordHistory({
        reviewId,
        fromStatus: found.status,
        toStatus: newStatus,
        action: "resubmit",
        actorId: submittedBy,
        metadata: {
          reSubmitCount: newResubmitCount,
          previousReviewId: previous_review_id,
          chainId: chain_id,
        },
      });
      log.info(
        { event: "review.resubmit", reviewId, submittedBy, reSubmitCount: newResubmitCount },
        "resubmit review: " + reviewId,
      );
      return updated;
    },

    async listHistory(reviewId) {
      const all = await ctx.reviewHistories.findMany();
      return all
        .filter((h) => h.review_id === reviewId)
        .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
    },

    async stats(projectId) {
      const all = await ctx.reviewItems.findMany();
      const scoped = all.filter((r) => r.project_id === projectId);
      const pending = scoped.filter((r) => r.status === "pending").length;
      const in_review = scoped.filter((r) => r.status === "in_review").length;
      const approved = scoped.filter((r) => r.status === "approved").length;
      const rejected = scoped.filter((r) => r.status === "rejected").length;
      const needs_fix = scoped.filter((r) => r.status === "needs_fix").length;
      const closed = scoped.filter((r) => r.status === "closed").length;
      const cancelled = scoped.filter((r) => r.status === "cancelled").length;
      const blockedByFrequentRejection = scoped.filter((r) => r.rejected_count >= 3).length;
      const total = scoped.length;
      return {
        pending,
        in_review,
        approved,
        rejected,
        needs_fix,
        closed,
        cancelled,
        blockedByFrequentRejection,
        progress: {
          approved,
          total,
          pct: total === 0 ? 0 : Math.round((approved / total) * 100),
        },
      };
    },

    async listByStatus(projectId, status) {
      const all = await ctx.reviewItems.findMany();
      return all
        .filter((r) => r.project_id === projectId && r.status === status)
        .sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""));
    },
  };
}
