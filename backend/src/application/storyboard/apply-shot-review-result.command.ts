/**
 * @file apply-shot-review-result.command.ts
 * @description 应用镜头审核结果命令：in_review -> approved | rejected。
 *
 * 重要：本命令由协调者装配的跨聚合 ReviewResultHandler 调用（迭代计划 §9.1），
 * Review 任务产出 ReviewApproved / ReviewRejected 事件后，集成层把事件翻译成
 * 本命令进入 Shot 聚合。
 *
 * 约束：
 *  - 不直接创建 Review（由 Review 任务独占）。
 *  - 不直接完成 Pipeline 节点（由 Pipeline 任务独占）。
 *  - 重复 reviewId 回调幂等（聚合内部检测）。
 *  - reject 必须携带 reasonCode（reasonCode 与 Review 的 rejectionReasonCode 对齐）。
 */

import type { Command } from "../shared/command.js";
import {
  assertCommandNotProcessed,
  enqueuePulledEvents,
  loadShotOrThrow,
  type ShotHandlerDeps,
} from "./shot-command-handler.js";

export interface ApplyShotReviewResultCommand extends Command {
  type: "ApplyShotReviewResult";
  shotId: string;
  reviewId: string;
  reviewedBy: string;
  /** "approved" | "rejected"。 */
  decision: "approved" | "rejected";
  /** reject 时必填；approved 时忽略。 */
  reasonCode?: string;
  pipelineRunId?: string;
  pipelineNodeId?: string;
}

export async function handleApplyShotReviewResult(
  deps: ShotHandlerDeps,
  command: ApplyShotReviewResultCommand,
): Promise<void> {
  return deps.uow.run(async (ctx) => {
    await assertCommandNotProcessed(
      deps,
      command.commandId,
      command.decision === "approved" ? "approve" : "reject",
    );
    const aggregate = await loadShotOrThrow(deps, command.shotId);
    const expectedVersion = aggregate.version;
    if (command.decision === "approved") {
      aggregate.approve({
        reviewId: command.reviewId,
        reviewedBy: command.reviewedBy,
        pipelineRunId: command.pipelineRunId,
        pipelineNodeId: command.pipelineNodeId,
      });
    } else {
      aggregate.reject({
        reviewId: command.reviewId,
        reviewedBy: command.reviewedBy,
        reasonCode: command.reasonCode ?? "",
        pipelineRunId: command.pipelineRunId,
        pipelineNodeId: command.pipelineNodeId,
      });
    }
    await deps.repo.save(aggregate, expectedVersion);
    await deps.repo.recordCommand(command.commandId, aggregate.id);
    enqueuePulledEvents(ctx, aggregate);
  });
}
