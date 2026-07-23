/**
 * @file cancel-review.command.ts
 * @description 取消命令：pending -> cancelled。
 *
 * 仅允许 pending 状态的审核被取消；in_review 起需先驳回再走返工链或归档。
 * cancelled 为终态，不可再迁移；本命令不产出独立领域事件（cancel 不在
 * DOMAIN_EVENT_TYPES 冻结列表中），历史条目仍由聚合写入 review_histories。
 */

import type { Command } from "../shared/command.js";
import {
  assertCommandNotProcessed,
  enqueuePulledEvents,
  loadReviewOrThrow,
  type ReviewHandlerDeps,
} from "./review-command-handler.js";

export interface CancelReviewCommand extends Command {
  type: "CancelReview";
  reviewId: string;
  actorId: string;
}

export async function handleCancelReview(
  deps: ReviewHandlerDeps,
  command: CancelReviewCommand,
) {
  return deps.uow.run(async (ctx) => {
    await assertCommandNotProcessed(deps, command.commandId, "cancel");
    const aggregate = await loadReviewOrThrow(deps, command.reviewId);
    const expectedVersion = aggregate.version;
    aggregate.cancel(command.actorId);
    await deps.repo.save(aggregate, expectedVersion);
    await deps.repo.recordCommand(command.commandId, aggregate.id);
    // cancel 无独立领域事件；聚合若后续扩展事件仍会被拉取入队。
    enqueuePulledEvents(ctx, aggregate);
    return aggregate;
  });
}
