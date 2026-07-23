import { handleSubmitReview } from "../review/submit-review.command.js";
import type { ReviewHandlerDeps } from "../review/review-command-handler.js";
import { handleApplyShotReviewResult } from "../storyboard/apply-shot-review-result.command.js";
import type { ShotHandlerDeps } from "../storyboard/shot-command-handler.js";
import {
  CompleteNodeHandler,
  FailNodeHandler,
} from "../pipeline/pipeline-command-handler.js";
import { createTransactionServiceUnitOfWork } from "../../infrastructure/unit-of-work/transaction-service-unit-of-work.js";
import { SqliteReviewRepository } from "../../infrastructure/persistence/sqlite-review.repository.js";
import { SqliteShotRepository } from "../../infrastructure/persistence/sqlite-shot.repository.js";
import { SqlitePipelineRunRepository } from "../../infrastructure/persistence/sqlite-pipeline-run.repository.js";
import { DOMAIN_EVENT_TYPES } from "../../domain/shared/domain-event.js";
import { isDomainError } from "../../domain/shared/domain-error.js";
import type {
  OutboxRecord,
  TransactionService,
} from "../../services/horizontal/transaction-service.js";

export interface AggregateEventDispatcher {
  publish(event: OutboxRecord): Promise<void>;
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function text(payload: Record<string, unknown>, key: string): string {
  return typeof payload[key] === "string" ? payload[key] : "";
}

export function createAggregateEventDispatcher(input: {
  databaseFile: string;
  transactionService: TransactionService;
}): AggregateEventDispatcher {
  const uow = createTransactionServiceUnitOfWork(input.transactionService);
  const reviewDeps: ReviewHandlerDeps = {
    repo: new SqliteReviewRepository(input.databaseFile),
    uow,
  };
  const shotDeps: ShotHandlerDeps = {
    repo: new SqliteShotRepository(input.databaseFile),
    uow,
  };
  const pipelineRepository = new SqlitePipelineRunRepository(input.databaseFile);
  const completeNode = new CompleteNodeHandler(pipelineRepository);
  const failNode = new FailNodeHandler(pipelineRepository);

  async function executeIdempotently(work: () => Promise<unknown>): Promise<void> {
    try {
      await work();
    } catch (error) {
      if (isDomainError(error) && error.code === "command_already_processed") return;
      throw error;
    }
  }

  async function updatePipeline(
    event: OutboxRecord,
    payload: Record<string, unknown>,
    decision: "approved" | "rejected",
  ): Promise<void> {
    const runId = text(payload, "pipelineRunId");
    const nodeId = text(payload, "pipelineNodeId");
    if (!runId || !nodeId) return;
    if (decision === "approved") {
      await completeNode.execute({
        commandId: `event:${event.id}:complete-pipeline-review-node`,
        type: "CompletePipelineNode",
        issuedAt: text(object(event.payload), "occurredAt") || event.createdAt,
        runId,
        nodeId,
        output: {
          decision,
          reviewId: text(payload, "reviewId"),
          shotId: text(payload, "shotId"),
        },
      });
      return;
    }
    await failNode.execute({
      commandId: `event:${event.id}:fail-pipeline-review-node`,
      type: "FailPipelineNode",
      issuedAt: text(object(event.payload), "occurredAt") || event.createdAt,
      runId,
      nodeId,
      failure: {
        message: text(payload, "reason") || "review_rejected",
        category: "review_rejected",
        retryable: false,
      },
    });
  }

  return {
    async publish(event) {
      const envelope = object(event.payload);
      const payload = object(envelope.payload ?? event.payload);
      switch (event.topic) {
        case DOMAIN_EVENT_TYPES.shotSubmittedForReview:
          await executeIdempotently(() => handleSubmitReview(reviewDeps, {
            commandId: `event:${event.id}:submit-review`,
            type: "SubmitReview",
            issuedAt: event.createdAt,
            targetType: "shot",
            targetId: text(payload, "shotId"),
            projectId: text(payload, "projectId"),
            submittedBy: text(payload, "submittedBy"),
            pipelineRunId: text(payload, "pipelineRunId") || undefined,
            pipelineNodeId: text(payload, "pipelineNodeId") || undefined,
          }));
          return;
        case DOMAIN_EVENT_TYPES.reviewApproved:
        case DOMAIN_EVENT_TYPES.reviewRejected: {
          const decision = event.topic === DOMAIN_EVENT_TYPES.reviewApproved
            ? "approved" : "rejected";
          if (text(payload, "targetType") === "shot") {
            await executeIdempotently(() => handleApplyShotReviewResult(shotDeps, {
              commandId: `event:${event.id}:apply-shot-review-result`,
              type: "ApplyShotReviewResult",
              issuedAt: event.createdAt,
              shotId: text(payload, "targetId"),
              reviewId: text(payload, "reviewId"),
              reviewedBy: text(payload, "reviewedBy"),
              decision,
              reasonCode: text(payload, "reason") || undefined,
              pipelineRunId: text(payload, "pipelineRunId") || undefined,
              pipelineNodeId: text(payload, "pipelineNodeId") || undefined,
            }));
          } else {
            await updatePipeline(event, payload, decision);
          }
          return;
        }
        case DOMAIN_EVENT_TYPES.shotApproved:
          await updatePipeline(event, payload, "approved");
          return;
        case DOMAIN_EVENT_TYPES.shotRejected:
          await updatePipeline(event, payload, "rejected");
          return;
        default:
          return;
      }
    },
  };
}
