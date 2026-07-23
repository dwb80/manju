/**
 * @file submit-review.command.ts
 * @description 提交审核命令：从“不存在”创建新 ReviewAggregate（pending）。
 *
 * submit 不再 upsert 旧记录；同一目标的重新提交走 resubmit 命令（需先 markNeedsFix）。
 * 若需保留前序链路，可传入 previousReviewId / chainId（由 review-service 装配）。
 */

import type { Command } from "../shared/command.js";
import { ReviewAggregate } from "../../domain/review/review.aggregate.js";
import {
  assertCommandNotProcessed,
  enqueuePulledEvents,
  type ReviewHandlerDeps,
} from "./review-command-handler.js";

export interface SubmitReviewCommand extends Command {
  type: "SubmitReview";
  targetType: string;
  targetId: string;
  projectId: string;
  submittedBy: string;
  previousReviewId?: string;
  chainId?: string;
  pipelineRunId?: string;
  pipelineNodeId?: string;
}

export async function handleSubmitReview(
  deps: ReviewHandlerDeps,
  command: SubmitReviewCommand,
): Promise<ReviewAggregate> {
  return deps.uow.run(async (ctx) => {
    await assertCommandNotProcessed(deps, command.commandId, "submit");
    const aggregate = ReviewAggregate.submit({
      targetType: command.targetType,
      targetId: command.targetId,
      projectId: command.projectId,
      submittedBy: command.submittedBy,
      previousReviewId: command.previousReviewId,
      chainId: command.chainId,
      pipelineRunId: command.pipelineRunId,
      pipelineNodeId: command.pipelineNodeId,
    });
    await deps.repo.save(aggregate, 0);
    await deps.repo.recordCommand(command.commandId, aggregate.id);
    enqueuePulledEvents(ctx, aggregate);
    return aggregate;
  });
}
