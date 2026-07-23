import type { Command } from "../shared/command.js";
import {
  assertCommandNotProcessed,
  loadReviewOrThrow,
  type ReviewHandlerDeps,
} from "./review-command-handler.js";

export interface AssignReviewerCommand extends Command {
  type: "AssignReviewReviewer";
  reviewId: string;
  reviewerId: string;
}

export async function handleAssignReviewer(
  deps: ReviewHandlerDeps,
  command: AssignReviewerCommand,
): Promise<void> {
  await deps.uow.run(async () => {
    await assertCommandNotProcessed(deps, command.commandId, "assignReviewer");
    const aggregate = await loadReviewOrThrow(deps, command.reviewId);
    const expectedVersion = aggregate.version;
    aggregate.assignReviewer(command.reviewerId);
    await deps.repo.save(aggregate, expectedVersion);
    await deps.repo.recordCommand(command.commandId, aggregate.id);
  });
}
