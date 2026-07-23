/**
 * @file close-review.command.ts
 * @description 关闭命令：approved | rejected -> closed。
 *
 * 终态化操作，用于审核流程完结（已审批通过归档或已驳回未返工归档）。
 * closed 为终态，不可再迁移；调用方需在调用前确认无需返工。
 */

import type { Command } from "../shared/command.js";
import {
  assertCommandNotProcessed,
  enqueuePulledEvents,
  loadReviewOrThrow,
  type ReviewHandlerDeps,
} from "./review-command-handler.js";

export interface CloseReviewCommand extends Command {
  type: "CloseReview";
  reviewId: string;
  actorId: string;
}

export async function handleCloseReview(
  deps: ReviewHandlerDeps,
  command: CloseReviewCommand,
) {
  return deps.uow.run(async (ctx) => {
    await assertCommandNotProcessed(deps, command.commandId, "close");
    const aggregate = await loadReviewOrThrow(deps, command.reviewId);
    const expectedVersion = aggregate.version;
    aggregate.close(command.actorId);
    await deps.repo.save(aggregate, expectedVersion);
    await deps.repo.recordCommand(command.commandId, aggregate.id);
    enqueuePulledEvents(ctx, aggregate);
    return aggregate;
  });
}
