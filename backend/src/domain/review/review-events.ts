/**
 * @file review-events.ts
 * @description Review 聚合领域事件工厂。
 *
 * 事件名与 Payload 来自冻结契约（domain/shared/domain-event.ts DOMAIN_EVENT_TYPES）。
 * 事件只携带稳定业务 ID，不携带聚合对象、Repository 或 Provider。
 * Outbox topic = DomainEvent.type；envelope 由 toDomainOutboxEvent 装配。
 */

import { randomUUID } from "node:crypto";
import {
  DOMAIN_EVENT_TYPES,
  type DomainEvent,
  type ReviewResultPayload,
  type ReviewResubmittedPayload,
  type ReviewSubmittedPayload,
} from "../shared/domain-event.js";
import type { ReviewStatus } from "./review-state-machine.js";

const AGGREGATE_TYPE = "Review";

function nowIso(): string {
  return new Date().toISOString();
}

function eventId(): string {
  return `evt_${randomUUID()}`;
}

/** ReviewSubmitted：submit 创建审核时产生。 */
export function reviewSubmittedEvent(input: {
  reviewId: string;
  targetType: string;
  targetId: string;
  projectId: string;
  reviewVersion: number;
}): DomainEvent<ReviewSubmittedPayload> {
  return {
    id: eventId(),
    type: DOMAIN_EVENT_TYPES.reviewSubmitted,
    aggregateId: input.reviewId,
    aggregateType: AGGREGATE_TYPE,
    occurredAt: nowIso(),
    payload: {
      reviewId: input.reviewId,
      targetType: input.targetType,
      targetId: input.targetId,
      projectId: input.projectId,
      reviewVersion: input.reviewVersion,
    },
  };
}

/** ReviewApproved：审批通过时产生；reviewerId 必填。 */
export function reviewApprovedEvent(input: {
  reviewId: string;
  targetType: string;
  targetId: string;
  projectId: string;
  reviewVersion: number;
  reviewedBy: string;
  pipelineRunId?: string;
  pipelineNodeId?: string;
}): DomainEvent<ReviewResultPayload> {
  return {
    id: eventId(),
    type: DOMAIN_EVENT_TYPES.reviewApproved,
    aggregateId: input.reviewId,
    aggregateType: AGGREGATE_TYPE,
    occurredAt: nowIso(),
    payload: {
      reviewId: input.reviewId,
      targetType: input.targetType,
      targetId: input.targetId,
      projectId: input.projectId,
      reviewVersion: input.reviewVersion,
      reviewedBy: input.reviewedBy,
      pipelineRunId: input.pipelineRunId,
      pipelineNodeId: input.pipelineNodeId,
    },
  };
}

/** ReviewRejected：驳回时产生；reason 必填。 */
export function reviewRejectedEvent(input: {
  reviewId: string;
  targetType: string;
  targetId: string;
  projectId: string;
  reviewVersion: number;
  reviewedBy: string;
  reason: string;
  pipelineRunId?: string;
  pipelineNodeId?: string;
}): DomainEvent<ReviewResultPayload> {
  if (!input.reason) {
    // 防御性：事件层也守一道，避免调用方漏传 reason。
    throw new TypeError("ReviewRejected requires a non-empty reason");
  }
  return {
    id: eventId(),
    type: DOMAIN_EVENT_TYPES.reviewRejected,
    aggregateId: input.reviewId,
    aggregateType: AGGREGATE_TYPE,
    occurredAt: nowIso(),
    payload: {
      reviewId: input.reviewId,
      targetType: input.targetType,
      targetId: input.targetId,
      projectId: input.projectId,
      reviewVersion: input.reviewVersion,
      reviewedBy: input.reviewedBy,
      reason: input.reason,
      pipelineRunId: input.pipelineRunId,
      pipelineNodeId: input.pipelineNodeId,
    },
  };
}

/** ReviewResubmitted：返工后重新提交时产生。 */
export function reviewResubmittedEvent(input: {
  reviewId: string;
  previousReviewId: string;
  targetType: string;
  targetId: string;
  projectId: string;
  reviewVersion: number;
}): DomainEvent<ReviewResubmittedPayload> {
  return {
    id: eventId(),
    type: DOMAIN_EVENT_TYPES.reviewResubmitted,
    aggregateId: input.reviewId,
    aggregateType: AGGREGATE_TYPE,
    occurredAt: nowIso(),
    payload: {
      reviewId: input.reviewId,
      previousReviewId: input.previousReviewId,
      targetType: input.targetType,
      targetId: input.targetId,
      projectId: input.projectId,
      reviewVersion: input.reviewVersion,
    },
  };
}

/** 事件载荷中可携带的审核状态（用于审计投影，非权威）。 */
export type { ReviewStatus };
