/**
 * Stable domain-event envelope shared by all aggregate task lines.
 *
 * Event payloads contain business identifiers only. Infrastructure adapters are
 * responsible for translating this envelope to an Outbox record.
 */
export interface DomainEvent<TPayload = unknown> {
  readonly id: string;
  readonly type: string;
  readonly aggregateId: string;
  readonly aggregateType: string;
  readonly occurredAt: string;
  readonly payload: TPayload;
}

export const DOMAIN_EVENT_TYPES = {
  shotVideoCandidateAttached: "ShotVideoCandidateAttached",
  shotSubmittedForReview: "ShotSubmittedForReview",
  shotApproved: "ShotApproved",
  shotRejected: "ShotRejected",
  reviewSubmitted: "ReviewSubmitted",
  reviewApproved: "ReviewApproved",
  reviewRejected: "ReviewRejected",
  reviewResubmitted: "ReviewResubmitted",
  pipelineRunStarted: "PipelineRunStarted",
  pipelineNodeCompleted: "PipelineNodeCompleted",
  pipelineNodeFailed: "PipelineNodeFailed",
  pipelineRunCompleted: "PipelineRunCompleted",
  pipelineRunFailed: "PipelineRunFailed",
} as const;

export type DomainEventType =
  (typeof DOMAIN_EVENT_TYPES)[keyof typeof DOMAIN_EVENT_TYPES];

export interface ShotVideoCandidateAttachedPayload {
  readonly shotId: string;
  readonly projectId: string;
  readonly shotVersion: number;
  readonly candidateId: string;
  readonly providerRequestId: string;
}

export interface ShotSubmittedForReviewPayload {
  readonly shotId: string;
  readonly projectId: string;
  readonly shotVersion: number;
  readonly submittedBy: string;
  readonly pipelineRunId?: string;
  readonly pipelineNodeId?: string;
}

export interface ShotReviewResultPayload {
  readonly shotId: string;
  readonly projectId: string;
  readonly reviewId: string;
  readonly shotVersion: number;
  readonly reviewedBy: string;
  readonly reason?: string;
  readonly pipelineRunId?: string;
  readonly pipelineNodeId?: string;
}

export interface ReviewSubmittedPayload {
  readonly reviewId: string;
  readonly targetType: string;
  readonly targetId: string;
  readonly projectId: string;
  readonly reviewVersion: number;
}

export interface ReviewResultPayload {
  readonly reviewId: string;
  readonly targetType: string;
  readonly targetId: string;
  readonly projectId: string;
  readonly reviewVersion: number;
  readonly reviewedBy: string;
  readonly reason?: string;
  readonly pipelineRunId?: string;
  readonly pipelineNodeId?: string;
}

export interface ReviewResubmittedPayload {
  readonly reviewId: string;
  readonly previousReviewId: string;
  readonly targetType: string;
  readonly targetId: string;
  readonly projectId: string;
  readonly reviewVersion: number;
}

export interface PipelineRunEventPayload {
  readonly runId: string;
  readonly projectId: string;
  readonly runVersion: number;
}

export interface PipelineNodeEventPayload extends PipelineRunEventPayload {
  readonly nodeId: string;
  readonly nodeType: string;
  readonly commandId: string;
  readonly errorCode?: string;
}
