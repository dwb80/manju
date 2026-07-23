/**
 * @file resubmit-review.command.ts
 * @description 重新提交命令：needs_fix -> pending。
 *
 * 调用方必须保证此前已通过 reject + markNeedsFix 进入 needs_fix；
 * 命令本身只触发 resubmit 行为。重新提交次数（reSubmitCount）由聚合递增。
 * 产出 ReviewResubmitted 事件，previousReviewId 仍为本审核 id（同链续审）。
 */

import type { Command } from "../shared/command.js";
import {
  assertCommandNotProcessed,
  enqueuePulledEvents,
  loadReviewOrThrow,
  type ReviewHandlerDeps,
} from "./review-command-handler.js";

export interface ResubmitReviewCommand extends Command {
  type: "ResubmitReview";
  reviewId: string;
  submittedBy: string;
}

export async function handleResubmitReview(
  deps: ReviewHandlerDeps,
  command: ResubmitReviewCommand,
) {
  return deps.uow.run(async (ctx) => {
    await assertCommandNotProcessed(deps, command.commandId, "resubmit");
    const aggregate = await loadReviewOrThrow(deps, command.reviewId);
    const expectedVersion = aggregate.version;
    aggregate.resubmit(command.submittedBy);
    await deps.repo.save(aggregate, expectedVersion);
    await deps.repo.recordCommand(command.commandId, aggregate.id);
    enqueuePulledEvents(ctx, aggregate);
    return aggregate;
  });
}
