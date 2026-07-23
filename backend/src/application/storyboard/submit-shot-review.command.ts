/**
 * @file submit-shot-review.command.ts
 * @description 镜头送审命令：ready/needs_fix -> in_review。
 *
 * 送审仅产 ShotSubmittedForReview 事件，由协调者负责的 ReviewSubmissionHandler
 * 调用 Review 任务的 SubmitReviewCommand 创建审核（迭代计划 §9.2）。
 * 本命令不直接插入 review_items。
 */

import type { Command } from "../shared/command.js";
import {
  assertCommandNotProcessed,
  enqueuePulledEvents,
  loadShotOrThrow,
  type ShotHandlerDeps,
} from "./shot-command-handler.js";

export interface SubmitShotReviewCommand extends Command {
  type: "SubmitShotReview";
  shotId: string;
  submittedBy: string;
  pipelineRunId?: string;
  pipelineNodeId?: string;
}

export async function handleSubmitShotReview(
  deps: ShotHandlerDeps,
  command: SubmitShotReviewCommand,
): Promise<void> {
  return deps.uow.run(async (ctx) => {
    await assertCommandNotProcessed(deps, command.commandId, "submitForReview");
    const aggregate = await loadShotOrThrow(deps, command.shotId);
    const expectedVersion = aggregate.version;
    aggregate.submitForReview({
      submittedBy: command.submittedBy,
      pipelineRunId: command.pipelineRunId,
      pipelineNodeId: command.pipelineNodeId,
    });
    await deps.repo.save(aggregate, expectedVersion);
    await deps.repo.recordCommand(command.commandId, aggregate.id);
    enqueuePulledEvents(ctx, aggregate);
  });
}
