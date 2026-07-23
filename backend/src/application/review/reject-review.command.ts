/**
 * @file reject-review.command.ts
 * @description 驳回命令：in_review -> rejected，必须携带有效原因。
 *
 * 驳回结果产出 ReviewRejected 事件（reason 必填），不直接修改 Shot。
 * rejectedCount 由聚合递增；驳回后需 markNeedsFix 才能进入可重新提交状态。
 */

import type { Command } from "../shared/command.js";
import {
  assertCommandNotProcessed,
  enqueuePulledEvents,
  loadReviewOrThrow,
  type ReviewHandlerDeps,
} from "./review-command-handler.js";

export interface RejectReviewCommand extends Command {
  type: "RejectReview";
  reviewId: string;
  reviewerId: string;
  reasonCode: string;
}

export async function handleRejectReview(
  deps: ReviewHandlerDeps,
  command: RejectReviewCommand,
) {
  return deps.uow.run(async (ctx) => {
    await assertCommandNotProcessed(deps, command.commandId, "reject");
    const aggregate = await loadReviewOrThrow(deps, command.reviewId);
    const expectedVersion = aggregate.version;
    aggregate.reject(command.reviewerId, command.reasonCode);
    await deps.repo.save(aggregate, expectedVersion);
    await deps.repo.recordCommand(command.commandId, aggregate.id);
    enqueuePulledEvents(ctx, aggregate);
    return aggregate;
  });
}
