/**
 * @file start-review.command.ts
 * @description 开始审核命令：pending -> in_review，指定审核人。
 */

import type { Command } from "../shared/command.js";
import {
  assertCommandNotProcessed,
  enqueuePulledEvents,
  loadReviewOrThrow,
  type ReviewHandlerDeps,
} from "./review-command-handler.js";

export interface StartReviewCommand extends Command {
  type: "StartReview";
  reviewId: string;
  reviewerId: string;
}

export async function handleStartReview(
  deps: ReviewHandlerDeps,
  command: StartReviewCommand,
) {
  return deps.uow.run(async (ctx) => {
    await assertCommandNotProcessed(deps, command.commandId, "start");
    const aggregate = await loadReviewOrThrow(deps, command.reviewId);
    const expectedVersion = aggregate.version;
    aggregate.start(command.reviewerId);
    await deps.repo.save(aggregate, expectedVersion);
    await deps.repo.recordCommand(command.commandId, aggregate.id);
    enqueuePulledEvents(ctx, aggregate);
    return aggregate;
  });
}
