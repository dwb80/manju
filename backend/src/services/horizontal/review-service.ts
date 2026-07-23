/**
 * @file review-service.ts
 * @description 审核中心服务（V2.1 DDD 改造版）。
 *
 * ## 改造要点（迭代计划 §6）
 *  - 状态、驳回次数、重新提交次数、审核历史只能通过 ReviewAggregate 修改。
 *  - 所有变更走 Application Command Handler（submit/start/approve/reject/resubmit/
 *    close/cancel），命令在 UnitOfWork 事务内执行：加载聚合 → 应用行为 → 乐观锁保存 →
 *    记录幂等键 → 入队领域事件。状态/历史/快照/Outbox 在同一 SQLite 事务原子提交。
 *  - 审核结果只产出领域事件（ReviewApproved/ReviewRejected/...），不直接修改 Shot；
 *    跨聚合联动由事件消费者负责。
 *  - SLA 元数据字段（sla_due_at / escalation_level / escalated_at / breached_at）由
 *    SLA 服务独占，本服务不再写状态字段；submit 时的 sla_due_at 初始化仍保留为
 *    非状态元数据写入（SLA 文件不在本任务授权范围，详见交付报告）。
 *  - 旧 `reviews` 表（review-module.ts）冻结为只读，本服务不再使用。
 *
 * ## 保留的横切副作用（非聚合状态）
 *  - 通知 submitter / 项目 owner
 *  - 审计日志（auditService.log）
 *  - 返工 todo 创建 / 更新
 *  这些副作用在命令事务提交后执行，失败不回滚聚合状态（与旧实现一致）。
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
} from "../../types/horizontal.js";
import type { TodoStatus, TodoPriority } from "../../types/todo.js";
import { computeSlaDueAt as computeSlaDueAtFn } from "./sla-utils.js";

import { SqliteReviewRepository } from "../../infrastructure/persistence/sqlite-review.repository.js";
import { createTransactionServiceUnitOfWork } from "../../infrastructure/unit-of-work/transaction-service-unit-of-work.js";
import type { ReviewRepository } from "../../domain/review/review.repository.js";
import type { ReviewAggregate } from "../../domain/review/review.aggregate.js";
import type { UnitOfWork } from "../../application/shared/unit-of-work.js";
import {
  assertCommandNotProcessed,
  enqueuePulledEvents,
  loadReviewOrThrow,
  type ReviewHandlerDeps,
} from "../../application/review/review-command-handler.js";
import { handleSubmitReview } from "../../application/review/submit-review.command.js";
import { handleStartReview } from "../../application/review/start-review.command.js";
import { handleApproveReview } from "../../application/review/approve-review.command.js";
import { handleRejectReview } from "../../application/review/reject-review.command.js";
import { handleResubmitReview } from "../../application/review/resubmit-review.command.js";
import { handleCloseReview } from "../../application/review/close-review.command.js";
import { handleCancelReview } from "../../application/review/cancel-review.command.js";

/** 内部 helper：包装 sla-utils 的 computeSlaDueAt，单测可 mock。 */
function computeSlaDueAtLocal(
  review: Pick<ReviewItem, "status" | "created_at" | "updated_at">,
  config: Pick<ReviewConfig, "sla_pending_hours" | "sla_review_hours">,
): string {
  return computeSlaDueAtFn(review, config);
}

// 局部类型引用（避免循环导入 ReviewConfig）。
type ReviewConfig = {
  sla_pending_hours: number;
  sla_review_hours: number;
};

/** 11 种打回原因（前端下拉框）。保留导出以兼容旧引用。 */
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

/**
 * 旧状态转移矩阵（保留导出以兼容外部引用；权威状态机以 review-state-machine.ts 为准）。
 * 注意：旧表允许 rejected -> pending；新冻结状态机要求 rejected -> needs_fix -> pending。
 */
export const VALID_TRANSITIONS: Record<ReviewStatus, ReviewStatus[]> = {
  pending: ["in_review", "cancelled"],
  in_review: ["approved", "rejected"],
  approved: ["closed"],
  rejected: ["needs_fix", "closed"],
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

  // 聚合命令依赖：Repository + UnitOfWork。惰性构造，避免启动期建表顺序问题。
  let depsCache: ReviewHandlerDeps | null = null;
  function deps(): ReviewHandlerDeps {
    if (!depsCache) {
      const repo: ReviewRepository = new SqliteReviewRepository(ctx.databaseFile);
      const uow: UnitOfWork = createTransactionServiceUnitOfWork(ctx.transactionService);
      depsCache = { repo, uow };
    }
    return depsCache;
  }

  /** 命令事务提交后，回读完整 ReviewItem（含 SLA / 展示字段）返回给调用方。 */
  async function reloadReview(reviewId: string): Promise<ReviewItem> {
    const row = await ctx.reviewItems.findById(reviewId);
    if (!row) throw new Error(`review_not_found: ${reviewId}`);
    return row;
  }

  return {
    async submit({ targetType, targetId, projectId, submittedBy }) {
      const d = deps();
      // 同目标已有 needs_fix 审核 → 走 resubmit（同链续审）；否则创建新审核。
      const existing = await d.repo.findByTarget(targetType, targetId);
      let aggregate: ReviewAggregate;
      if (existing && existing.status === "needs_fix") {
        aggregate = await handleResubmitReview(d, {
          commandId: id("cmd"),
          type: "ResubmitReview",
          issuedAt: nowIso(),
          reviewId: existing.id,
          submittedBy,
        });
      } else {
        aggregate = await handleSubmitReview(d, {
          commandId: id("cmd"),
          type: "SubmitReview",
          issuedAt: nowIso(),
          targetType,
          targetId,
          projectId,
          submittedBy,
        });
      }
      // SLA due_at 初始化（非状态元数据；SLA 文件不在授权范围，保留此处的最小写入）。
      try {
        const config = await ctx.slaMonitor.getOrCreateConfig(projectId);
        const due = computeSlaDueAtLocal(
          { status: "pending", created_at: aggregate.createdAt, updated_at: aggregate.updatedAt },
          config,
        );
        if (due) {
          await ctx.reviewItems.update(aggregate.id, { sla_due_at: due } as Partial<ReviewItem>);
        }
      } catch (e) {
        rootLogger.warn({ err: e, reviewId: aggregate.id }, "SLA 初始 due_at 写入失败（非阻塞）");
      }
      log.info(
        { event: "review.submit", reviewId: aggregate.id, targetType, targetId, projectId },
        `审核提交：reviewId=${aggregate.id}，目标类型=${targetType}，项目=${projectId}`,
      );
      ctx.auditService.log(submittedBy, "review.submit", {
        type: "review",
        id: aggregate.id,
        payload: { targetType, targetId, projectId },
      });
      return reloadReview(aggregate.id);
    },

    async approve(reviewId, reviewerId) {
      const aggregate = await handleApproveReview(deps(), {
        commandId: id("cmd"),
        type: "ApproveReview",
        issuedAt: nowIso(),
        reviewId,
        reviewerId,
      });
      const row = await reloadReview(reviewId);
      log.info(
        { event: "review.approve", reviewId, reviewerId, rejectedCount: row.rejected_count },
        `审核通过：reviewId=${reviewId}，审核员=${reviewerId}`,
      );
      ctx.auditService.log(reviewerId, "review.approve", {
        type: "review",
        id: reviewId,
        payload: {
          targetType: row.target_type,
          targetId: row.target_id,
          rejectedCount: row.rejected_count,
        },
      });
      if (row.submitted_by && row.submitted_by !== reviewerId) {
        ctx.notificationService.notify(
          row.submitted_by,
          "review.approved",
          "审核已通过",
          `你的 ${row.target_type} 已通过审核`,
          { reviewId, targetType: row.target_type, targetId: row.target_id },
        );
      }
      return row;
    },

    async reject(reviewId, reviewerId, reasonCode) {
      const d = deps();
      // reject → rejected → markNeedsFix → needs_fix，在同一 UoW 事务内完成，
      // 使被打回方可以直接 resubmit（与旧实现的"打回后可重新提交"语义一致）。
      const aggregate = await d.uow.run(async (uowCtx) => {
        const cmdId = id("cmd");
        await assertCommandNotProcessed(d, cmdId, "reject");
        const agg = await loadReviewOrThrow(d, reviewId);
        const expectedVersion = agg.version;
        agg.reject(reviewerId, reasonCode);
        agg.markNeedsFix(reviewerId);
        await d.repo.save(agg, expectedVersion);
        await d.repo.recordCommand(cmdId, agg.id);
        enqueuePulledEvents(uowCtx, agg);
        return agg;
      });
      const row = await reloadReview(reviewId);
      const newRejectedCount = aggregate.rejectedCount;
      log.info(
        { event: "review.reject", reviewId, reviewerId, reasonCode, rejectedCount: newRejectedCount },
        `审核打回：reviewId=${reviewId}，原因=${reasonCode}，累计退回=${newRejectedCount}次`,
      );
      ctx.auditService.log(reviewerId, "review.reject", {
        type: "review",
        id: reviewId,
        payload: {
          targetType: row.target_type,
          targetId: row.target_id,
          reasonCode,
          rejectedCount: newRejectedCount,
        },
      });
      // 同步打回 todo（非聚合状态，失败不回滚）。
      try {
        const now = nowIso();
        const todoStatus: TodoStatus = "pending";
        const todoPriority: TodoPriority = newRejectedCount >= 3 ? "high" : "medium";
        const todoPatch = {
          title: `审核退回：${REJECTION_REASONS.find((r) => r.code === reasonCode)?.label ?? reasonCode}`,
          description: `${row.target_type}（${row.target_id}）被退回，请修改后重新提交。`,
          status: todoStatus,
          priority: todoPriority,
          owner: row.submitted_by,
          due_date: "",
          link_type: "review",
          link_id: reviewId,
          link_url: `/review?projectId=${encodeURIComponent(row.project_id)}&reviewId=${encodeURIComponent(reviewId)}`,
          updated_at: now,
          deleted_at: "",
        };
        const existingTodo = await ctx.todos.findOne({
          owner: row.submitted_by,
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
      if (isPipelineReworkTargetType(row.target_type)) {
        try {
          let run: { id: string; name?: string; project_id?: string } | null = null;
          let node: { id: string; name?: string; type?: string; error?: string; run_id?: string } | null = null;
          if (row.target_type === "pipeline_run") {
            const r = await ctx.pipelineRuns.findById(row.target_id);
            if (r) run = r;
          } else if (row.target_type === "pipeline_node") {
            const n = await ctx.pipelineNodes.findById(row.target_id);
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
              review: row,
              run: run as { id: string; name?: string; project_id?: string },
              node: node as { id: string; name?: string; type?: string; error?: string; run_id?: string } | null,
              reasonCode,
              reasonLabel,
              rejectedCount: newRejectedCount,
              submittedBy: row.submitted_by,
            });
          } else {
            log.debug(
              { event: "review.pipeline_rework_no_run", reviewId, targetType: row.target_type, targetId: row.target_id },
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
            targetType: row.target_type,
            targetId: row.target_id,
            rejectedCount: newRejectedCount,
          },
          `审核反复被打回：reviewId=${reviewId}，累计退回 ${newRejectedCount} 次，将通知项目负责人`,
        );
        const proj = await ctx.projects.findById(row.project_id);
        const ownerId = proj?.owner ?? "default";
        ctx.notificationService.notify(
          ownerId,
          "review.frequent_rejection",
          "审核反复被打回",
          `${row.target_type}（${row.target_id}）已累计退回 ${newRejectedCount} 次，需要项目负责人介入`,
          {
            reviewId,
            targetType: row.target_type,
            targetId: row.target_id,
            rejectedCount: newRejectedCount,
          },
        );
      }
      return row;
    },

    async startReview(reviewId, actorId) {
      await handleStartReview(deps(), {
        commandId: id("cmd"),
        type: "StartReview",
        issuedAt: nowIso(),
        reviewId,
        reviewerId: actorId,
      });
      log.info({ event: "review.startReview", reviewId, actorId }, "startReview review: " + reviewId);
      return reloadReview(reviewId);
    },

    async cancel(reviewId, actorId) {
      await handleCancelReview(deps(), {
        commandId: id("cmd"),
        type: "CancelReview",
        issuedAt: nowIso(),
        reviewId,
        actorId,
      });
      log.info({ event: "review.cancel", reviewId, actorId }, "cancel review: " + reviewId);
      return reloadReview(reviewId);
    },

    async close(reviewId, actorId) {
      await handleCloseReview(deps(), {
        commandId: id("cmd"),
        type: "CloseReview",
        issuedAt: nowIso(),
        reviewId,
        actorId,
      });
      log.info({ event: "review.close", reviewId, actorId }, "close review: " + reviewId);
      return reloadReview(reviewId);
    },

    async resubmit(reviewId, submittedBy) {
      await handleResubmitReview(deps(), {
        commandId: id("cmd"),
        type: "ResubmitReview",
        issuedAt: nowIso(),
        reviewId,
        submittedBy,
      });
      log.info(
        { event: "review.resubmit", reviewId, submittedBy },
        "resubmit review: " + reviewId,
      );
      return reloadReview(reviewId);
    },

    async listHistory(reviewId) {
      // 读路径走 Read Model（review_histories），无需加载聚合。
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
