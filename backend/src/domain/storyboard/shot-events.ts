/**
 * @file shot-events.ts
 * @description Shot 聚合领域事件工厂。
 *
 * 事件名与 Payload 来自冻结契约（domain/shared/domain-event.ts DOMAIN_EVENT_TYPES）。
 * 事件只携带稳定业务 ID，不携带聚合对象、Repository 或 Provider。
 * Outbox topic = DomainEvent.type；envelope 由 toDomainOutboxEvent 装配。
 *
 * 关键约束：
 *  - Shot 不直接创建 Review（Review 任务独占 submit）。
 *    Shot 送审仅产出 ShotSubmittedForReview 事件，由协调者负责的跨聚合消费者驱动 Review。
 *  - Shot 不直接完成 Pipeline 节点。
 *    审核结果由 Review 任务产出 ReviewApproved/Rejected，Review 任务在集成层调用
 *    ApplyShotReviewResultCommand（§9.1）。
 */

import { randomUUID } from "node:crypto";
import {
  DOMAIN_EVENT_TYPES,
  type DomainEvent,
  type ShotReviewResultPayload,
  type ShotSubmittedForReviewPayload,
  type ShotVideoCandidateAttachedPayload,
} from "../shared/domain-event.js";

const AGGREGATE_TYPE = "Shot";

function nowIso(): string {
  return new Date().toISOString();
}

function eventId(): string {
  return `evt_${randomUUID()}`;
}

/**
 * ShotVideoCandidateAttached：视频生成回调成功后将候选绑定到镜头时产生。
 * 携带 candidateId + providerRequestId，供消费端做幂等去重。
 */
export function shotVideoCandidateAttachedEvent(input: {
  shotId: string;
  projectId: string;
  shotVersion: number;
  candidateId: string;
  providerRequestId: string;
}): DomainEvent<ShotVideoCandidateAttachedPayload> {
  return {
    id: eventId(),
    type: DOMAIN_EVENT_TYPES.shotVideoCandidateAttached,
    aggregateId: input.shotId,
    aggregateType: AGGREGATE_TYPE,
    occurredAt: nowIso(),
    payload: {
      shotId: input.shotId,
      projectId: input.projectId,
      shotVersion: input.shotVersion,
      candidateId: input.candidateId,
      providerRequestId: input.providerRequestId,
    },
  };
}

/**
 * ShotSubmittedForReview：镜头从 ready/needs_fix 提交审核时产生。
 * 不直接创建 Review；协调者负责的 ReviewSubmissionHandler 收到事件后
 * 调用 SubmitReviewCommand 创建 Review（迭代计划 §9.2）。
 */
export function shotSubmittedForReviewEvent(input: {
  shotId: string;
  projectId: string;
  shotVersion: number;
  submittedBy: string;
  pipelineRunId?: string;
  pipelineNodeId?: string;
}): DomainEvent<ShotSubmittedForReviewPayload> {
  if (!input.submittedBy) {
    // 防御性：送审必须由具体操作人发起。
    throw new TypeError("ShotSubmittedForReview requires a non-empty submittedBy");
  }
  return {
    id: eventId(),
    type: DOMAIN_EVENT_TYPES.shotSubmittedForReview,
    aggregateId: input.shotId,
    aggregateType: AGGREGATE_TYPE,
    occurredAt: nowIso(),
    payload: {
      shotId: input.shotId,
      projectId: input.projectId,
      shotVersion: input.shotVersion,
      submittedBy: input.submittedBy,
      pipelineRunId: input.pipelineRunId,
      pipelineNodeId: input.pipelineNodeId,
    },
  };
}

/**
 * ShotApproved：镜头审核通过时产生（ReviewApproved 后由协调者驱动 ApplyShotReviewResultCommand）。
 * reviewId 必填；可选 pipelineRunId/pipelineNodeId（送审时若关联 Pipeline 则携带，避免消费者猜测）。
 */
export function shotApprovedEvent(input: {
  shotId: string;
  projectId: string;
  reviewId: string;
  shotVersion: number;
  reviewedBy: string;
  pipelineRunId?: string;
  pipelineNodeId?: string;
}): DomainEvent<ShotReviewResultPayload> {
  if (!input.reviewId) {
    throw new TypeError("ShotApproved requires a non-empty reviewId");
  }
  return {
    id: eventId(),
    type: DOMAIN_EVENT_TYPES.shotApproved,
    aggregateId: input.shotId,
    aggregateType: AGGREGATE_TYPE,
    occurredAt: nowIso(),
    payload: {
      shotId: input.shotId,
      projectId: input.projectId,
      reviewId: input.reviewId,
      shotVersion: input.shotVersion,
      reviewedBy: input.reviewedBy,
      pipelineRunId: input.pipelineRunId,
      pipelineNodeId: input.pipelineNodeId,
    },
  };
}

/**
 * ShotRejected：镜头审核被驳回时产生。reason 必填（与 review 的 rejectionReasonCode 对齐）。
 */
export function shotRejectedEvent(input: {
  shotId: string;
  projectId: string;
  reviewId: string;
  shotVersion: number;
  reviewedBy: string;
  reason: string;
  pipelineRunId?: string;
  pipelineNodeId?: string;
}): DomainEvent<ShotReviewResultPayload> {
  if (!input.reviewId) {
    throw new TypeError("ShotRejected requires a non-empty reviewId");
  }
  if (!input.reason) {
    throw new TypeError("ShotRejected requires a non-empty reason");
  }
  return {
    id: eventId(),
    type: DOMAIN_EVENT_TYPES.shotRejected,
    aggregateId: input.shotId,
    aggregateType: AGGREGATE_TYPE,
    occurredAt: nowIso(),
    payload: {
      shotId: input.shotId,
      projectId: input.projectId,
      reviewId: input.reviewId,
      shotVersion: input.shotVersion,
      reviewedBy: input.reviewedBy,
      reason: input.reason,
      pipelineRunId: input.pipelineRunId,
      pipelineNodeId: input.pipelineNodeId,
    },
  };
}
