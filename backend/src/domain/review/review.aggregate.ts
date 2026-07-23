/**
 * @file review.aggregate.ts
 * @description Review 聚合根。
 *
 * 职责（迭代计划 §6.4 / §6.5）：
 *  - 拥有审核七状态机；状态、驳回次数、重新提交次数只能由本聚合修改。
 *  - 校验不变量：只有 in_review 允许审批/驳回；驳回必须携带有效原因；
 *    重新提交只能从 needs_fix 进入；终态不可变更。
 *  - 产出领域事件（ReviewSubmitted/Approved/Rejected/Resubmitted）与审核历史，
 *    调用方不能伪造历史。
 *  - 每次成功业务变更只递增一次聚合版本（供 Repository 乐观锁）。
 *
 * 不依赖 AppContext / HTTP / SQLite / AI Provider。可在纯内存中测试。
 */

import { randomUUID } from "node:crypto";
import type { AggregateRoot } from "../shared/aggregate-root.js";
import type { DomainEvent } from "../shared/domain-event.js";
import {
  assertReviewTransition,
  isReviewTerminal,
  type ReviewCommand,
  type ReviewStatus,
} from "./review-state-machine.js";
import {
  RejectionReason,
  type RejectionReasonCode,
} from "./rejection-reason.value-object.js";
import {
  invalidReviewOperationError,
  invalidReviewTransitionError,
  rejectionReasonRequiredError,
  reviewAlreadyProcessedError,
  reviewInvariantViolatedError,
  reviewIsTerminalError,
  reviewNotFoundError,
} from "./review-errors.js";
import {
  reviewApprovedEvent,
  reviewRejectedEvent,
  reviewResubmittedEvent,
  reviewSubmittedEvent,
} from "./review-events.js";

/** 审核目标类型（领域层不枚举，由调用方传入；Mapper 透传）。 */
export type ReviewTargetType = string;

/** 审核历史条目（与持久化 ReviewHistory 结构对齐，由聚合产出）。 */
export interface ReviewHistoryEntry {
  id: string;
  review_id: string;
  from_status: ReviewStatus | "";
  to_status: ReviewStatus;
  action: ReviewHistoryAction;
  actor_id: string;
  comment: string;
  metadata: string;
  created_at: string;
}

/** 历史动作（与 types/horizontal.ts ReviewAction 对齐）。 */
export type ReviewHistoryAction =
  | "submit"
  | "approve"
  | "reject"
  | "cancel"
  | "close"
  | "resubmit"
  | "assign"
  | "transfer"
  | "start_review";

/** 聚合内部持久化快照所需的最小上下文（用于事件 payload）。 */
export interface ReviewPipelineContext {
  pipelineRunId?: string;
  pipelineNodeId?: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function historyId(): string {
  return `review_history-${randomUUID()}`;
}

function nonEmpty(value: string, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw reviewInvariantViolatedError(`${label}_required`, { field: label });
  }
  return value.trim();
}

/**
 * Review 聚合根。状态变更方法返回 `this` 以便测试断言；失败抛 DomainError。
 */
export class ReviewAggregate implements AggregateRoot {
  readonly id: string;
  targetType: ReviewTargetType;
  targetId: string;
  projectId: string;
  status: ReviewStatus;
  rejectedCount: number;
  rejectionReasonCode: RejectionReason | null;
  reSubmitCount: number;
  approvedAt: string;
  submittedBy: string;
  reviewedBy: string;
  previousReviewId: string;
  chainId: string;
  createdAt: string;
  updatedAt: string;
  version: number;

  /** 可选 Pipeline 上下文，仅用于事件 payload，不参与状态判断。 */
  pipelineRunId?: string;
  pipelineNodeId?: string;

  private readonly events: DomainEvent<unknown>[] = [];
  private readonly history: ReviewHistoryEntry[] = [];
  /** 标记是否尚未持久化（Repository 决定 INSERT vs UPDATE）。 */
  isNew = false;
  /** 最近一次动作（供 Repository 写快照 action 字段）。 */
  lastAction: ReviewHistoryAction = "submit";

  private constructor(props: {
    id: string;
    targetType: ReviewTargetType;
    targetId: string;
    projectId: string;
    status: ReviewStatus;
    rejectedCount: number;
    rejectionReasonCode: RejectionReason | null;
    reSubmitCount: number;
    approvedAt: string;
    submittedBy: string;
    reviewedBy: string;
    previousReviewId: string;
    chainId: string;
    createdAt: string;
    updatedAt: string;
    version: number;
    isNew: boolean;
    pipelineRunId?: string;
    pipelineNodeId?: string;
  }) {
    this.id = props.id;
    this.targetType = props.targetType;
    this.targetId = props.targetId;
    this.projectId = props.projectId;
    this.status = props.status;
    this.rejectedCount = props.rejectedCount;
    this.rejectionReasonCode = props.rejectionReasonCode;
    this.reSubmitCount = props.reSubmitCount;
    this.approvedAt = props.approvedAt;
    this.submittedBy = props.submittedBy;
    this.reviewedBy = props.reviewedBy;
    this.previousReviewId = props.previousReviewId;
    this.chainId = props.chainId;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.version = props.version;
    this.isNew = props.isNew;
    this.pipelineRunId = props.pipelineRunId;
    this.pipelineNodeId = props.pipelineNodeId;
  }

  /** submit：从“不存在”创建新审核。 */
  static submit(input: {
    id?: string;
    targetType: ReviewTargetType;
    targetId: string;
    projectId: string;
    submittedBy: string;
    previousReviewId?: string;
    chainId?: string;
    pipelineRunId?: string;
    pipelineNodeId?: string;
  }): ReviewAggregate {
    const now = nowIso();
    const chainId = input.chainId ?? `rc-${randomUUID()}`;
    const agg = new ReviewAggregate({
      id: input.id ?? `rev-${randomUUID()}`,
      targetType: nonEmpty(input.targetType, "targetType"),
      targetId: nonEmpty(input.targetId, "targetId"),
      projectId: nonEmpty(input.projectId, "projectId"),
      status: "pending",
      rejectedCount: 0,
      rejectionReasonCode: null,
      reSubmitCount: 0,
      approvedAt: "",
      submittedBy: nonEmpty(input.submittedBy, "submittedBy"),
      reviewedBy: "",
      previousReviewId: input.previousReviewId ?? "",
      chainId,
      createdAt: now,
      updatedAt: now,
      version: 1,
      isNew: true,
      pipelineRunId: input.pipelineRunId,
      pipelineNodeId: input.pipelineNodeId,
    });
    agg.lastAction = "submit";
    agg.recordHistory("", "pending", "submit", input.submittedBy, "");
    agg.events.push(
      reviewSubmittedEvent({
        reviewId: agg.id,
        targetType: agg.targetType,
        targetId: agg.targetId,
        projectId: agg.projectId,
        reviewVersion: agg.version,
      }),
    );
    return agg;
  }

  /** rehydrate：从持久化还原聚合（Mapper 调用）。不产生事件/历史。 */
  static rehydrate(input: {
    id: string;
    targetType: ReviewTargetType;
    targetId: string;
    projectId: string;
    status: ReviewStatus;
    rejectedCount: number;
    rejectionReasonCode: RejectionReasonCode | "";
    reSubmitCount: number;
    approvedAt: string;
    submittedBy: string;
    reviewedBy: string;
    previousReviewId: string;
    chainId: string;
    createdAt: string;
    updatedAt: string;
    version: number;
    pipelineRunId?: string;
    pipelineNodeId?: string;
  }): ReviewAggregate {
    return new ReviewAggregate({
      id: input.id,
      targetType: input.targetType,
      targetId: input.targetId,
      projectId: input.projectId,
      status: input.status,
      rejectedCount: input.rejectedCount,
      rejectionReasonCode: input.rejectionReasonCode
        ? RejectionReason.create(input.rejectionReasonCode)
        : null,
      reSubmitCount: input.reSubmitCount,
      approvedAt: input.approvedAt,
      submittedBy: input.submittedBy,
      reviewedBy: input.reviewedBy,
      previousReviewId: input.previousReviewId,
      chainId: input.chainId,
      createdAt: input.createdAt,
      updatedAt: input.updatedAt,
      version: input.version,
      isNew: false,
      pipelineRunId: input.pipelineRunId,
      pipelineNodeId: input.pipelineNodeId,
    });
  }

  /** 拉取并清空待发布的领域事件。 */
  pullDomainEvents(): DomainEvent<unknown>[] {
    const copy = this.events.slice();
    this.events.length = 0;
    return copy;
  }

  /** 拉取并清空待持久化的历史条目（Repository 在同事务写入）。 */
  pullPendingHistory(): ReviewHistoryEntry[] {
    const copy = this.history.slice();
    this.history.length = 0;
    return copy;
  }

  /** 当前是否携带未持久化事件（测试用）。 */
  hasPendingEvents(): boolean {
    return this.events.length > 0;
  }

  // ===== 行为 =====

  /** start：pending -> in_review，指定审核人。 */
  start(reviewerId: string): this {
    nonEmpty(reviewerId, "reviewerId");
    return this.applyTransition("start", "start_review", reviewerId, () => {
      this.reviewedBy = reviewerId;
    });
  }

  /** assignReviewer：pending 状态指定审核人，不改状态（不产生事件）。 */
  assignReviewer(reviewerId: string): this {
    nonEmpty(reviewerId, "reviewerId");
    if (this.status !== "pending") {
      // assign 不属于状态机迁移命令（不改状态），但仍是 invalid_state_transition 语义
      throw invalidReviewOperationError(this.status, "assign");
    }
    const previous = this.reviewedBy;
    this.reviewedBy = reviewerId;
    this.bumpVersion();
    this.lastAction = previous ? "transfer" : "assign";
    this.updatedAt = nowIso();
    this.recordHistory(
      this.status,
      this.status,
      this.lastAction,
      reviewerId,
      "",
      { previousReviewerId: previous },
    );
    return this;
  }

  /** approve：in_review -> approved。 */
  approve(reviewerId: string): this {
    nonEmpty(reviewerId, "reviewerId");
    this.applyTransition("approve", "approve", reviewerId, () => {
      this.reviewedBy = reviewerId;
      this.rejectionReasonCode = null;
      this.approvedAt = nowIso();
    });
    this.events.push(
      reviewApprovedEvent({
        reviewId: this.id,
        targetType: this.targetType,
        targetId: this.targetId,
        projectId: this.projectId,
        reviewVersion: this.version,
        reviewedBy: this.reviewedBy,
        pipelineRunId: this.pipelineRunId,
        pipelineNodeId: this.pipelineNodeId,
      }),
    );
    return this;
  }

  /** reject：in_review -> rejected，必须携带有效原因。 */
  reject(reviewerId: string, reasonCode: unknown): this {
    nonEmpty(reviewerId, "reviewerId");
    if (typeof reasonCode !== "string" || reasonCode.trim().length === 0) {
      throw rejectionReasonRequiredError();
    }
    const reason = RejectionReason.create(reasonCode);
    this.applyTransition("reject", "reject", reviewerId, () => {
      this.reviewedBy = reviewerId;
      this.rejectionReasonCode = reason;
      this.rejectedCount += 1;
      this.approvedAt = "";
    });
    this.events.push(
      reviewRejectedEvent({
        reviewId: this.id,
        targetType: this.targetType,
        targetId: this.targetId,
        projectId: this.projectId,
        reviewVersion: this.version,
        reviewedBy: this.reviewedBy,
        reason: reason.code,
        pipelineRunId: this.pipelineRunId,
        pipelineNodeId: this.pipelineNodeId,
      }),
    );
    return this;
  }

  /** markNeedsFix：rejected -> needs_fix（驳回历史已写入后调用）。 */
  markNeedsFix(actorId: string): this {
    nonEmpty(actorId, "actorId");
    return this.applyTransition("markNeedsFix", "reject", actorId, () => {
      // 进入 needs_fix 时保留 rejectionReasonCode 与 rejectedCount，供前端展示。
    });
  }

  /** resubmit：needs_fix -> pending，记录前序链与重新提交次数。 */
  resubmit(submittedBy: string): this {
    nonEmpty(submittedBy, "submittedBy");
    const previousReviewId = this.id;
    this.applyTransition("resubmit", "resubmit", submittedBy, () => {
      this.reSubmitCount += 1;
      this.rejectionReasonCode = null;
      this.approvedAt = "";
      this.reviewedBy = "";
      this.submittedBy = submittedBy;
      this.previousReviewId = previousReviewId;
      if (!this.chainId) this.chainId = previousReviewId;
    });
    this.events.push(
      reviewResubmittedEvent({
        reviewId: this.id,
        previousReviewId,
        targetType: this.targetType,
        targetId: this.targetId,
        projectId: this.projectId,
        reviewVersion: this.version,
      }),
    );
    return this;
  }

  /** close：approved | rejected -> closed。 */
  close(actorId: string): this {
    nonEmpty(actorId, "actorId");
    return this.applyTransition("close", "close", actorId, () => {
      /* 终态化，无额外字段 */
    });
  }

  /** cancel：pending -> cancelled。 */
  cancel(actorId: string): this {
    nonEmpty(actorId, "actorId");
    return this.applyTransition("cancel", "cancel", actorId, () => {
      /* 终态化，无额外字段 */
    });
  }

  // ===== 内部 =====

  /**
   * 统一执行状态迁移：校验终态、校验迁移合法性、应用副作用、递增版本、写历史。
   * 每次只递增一次版本。
   */
  private applyTransition(
    command: ReviewCommand,
    action: ReviewHistoryAction,
    actorId: string,
    applySideEffects: () => void,
  ): this {
    if (isReviewTerminal(this.status)) {
      throw reviewIsTerminalError(this.status);
    }
    const result = assertReviewTransition(this.status, command);
    if (!result.ok) {
      throw invalidReviewTransitionError(this.status, command);
    }
    const from = this.status;
    applySideEffects();
    this.status = result.to;
    this.bumpVersion();
    this.lastAction = action;
    this.updatedAt = nowIso();
    this.recordHistory(from, this.status, action, actorId, "");
    return this;
  }

  private bumpVersion(): void {
    this.version += 1;
  }

  private recordHistory(
    fromStatus: ReviewStatus | "",
    toStatus: ReviewStatus,
    action: ReviewHistoryAction,
    actorId: string,
    comment: string,
    metadata?: Record<string, unknown>,
  ): void {
    this.history.push({
      id: historyId(),
      review_id: this.id,
      from_status: fromStatus,
      to_status: toStatus,
      action,
      actor_id: actorId,
      comment: comment ?? "",
      metadata: metadata ? JSON.stringify(metadata) : "",
      created_at: nowIso(),
    });
  }
}

/** 聚合不存在时抛出的标准错误（供 Application 层使用）。 */
export function throwReviewNotFound(reviewId: string): never {
  throw reviewNotFoundError(reviewId);
}

/** 幂等重复命令错误（供 Application 层使用）。 */
export function throwAlreadyProcessed(reviewId: string, command: ReviewCommand): never {
  throw reviewAlreadyProcessedError(reviewId, command);
}
