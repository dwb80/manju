/**
 * @file approve-review.command.ts
 * @description 审批通过命令：in_review -> approved。
 *
 * 只有 in_review 状态允许审批；审批结果产出 ReviewApproved 事件，不直接修改 Shot。
 */

import type { Command } from "../shared/command.js";
import {
  assertCommandNotProcessed,
  enqueuePulledEvents,
  loadReviewOrThrow,
  type ReviewHandlerDeps,
} from "./review-command-handler.js";

export interface ApproveReviewCommand extends Command {
  type: "ApproveReview";
  reviewId: string;
  reviewerId: string;
}

export async function handleApproveReview(
  deps: ReviewHandlerDeps,
  command: ApproveReviewCommand,
) {
  return deps.uow.run(async (ctx) => {
    await assertCommandNotProcessed(deps, command.commandId, "approve");
    const aggregate = await loadReviewOrThrow(deps, command.reviewId);
    const expectedVersion = aggregate.version;
    aggregate.approve(command.reviewerId);
    await deps.repo.save(aggregate, expectedVersion);
    await deps.repo.recordCommand(command.commandId, aggregate.id);
    enqueuePulledEvents(ctx, aggregate);
    return aggregate;
  });
}
