/**
 * @file review-errors.ts
 * @description Review 聚合专属领域错误。基于共享 DomainError，复用冻结错误码。
 *
 * 共享错误码（domain/shared/domain-error.ts）：
 *  - aggregate_not_found
 *  - invalid_state_transition
 *  - aggregate_version_conflict
 *  - aggregate_invariant_violated
 *  - command_already_processed
 *
 * 本文件只提供 Review 语义的构造器，让聚合代码抛出的错误带上可读 details。
 */

import {
  DOMAIN_ERROR_CODES,
  DomainError,
  type DomainErrorCode,
} from "../shared/domain-error.js";
import type { ReviewCommand, ReviewStatus } from "./review-state-machine.js";

/** 聚合不存在。 */
export function reviewNotFoundError(reviewId: string): DomainError {
  return new DomainError(
    DOMAIN_ERROR_CODES.aggregateNotFound,
    `review_not_found: ${reviewId}`,
    { aggregateType: "Review", reviewId },
  );
}

/** 非法状态迁移。 */
export function invalidReviewTransitionError(
  from: ReviewStatus,
  command: ReviewCommand,
): DomainError {
  return new DomainError(
    DOMAIN_ERROR_CODES.invalidStateTransition,
    `非法审核状态迁移：${from} -> ${command}`,
    { aggregateType: "Review", from, command },
  );
}

/**
 * 非状态机命令在当前状态被拒绝（例如 assign 仅在 pending 允许）。
 * 仍归 invalid_state_transition 错误码，但 command 不必属于 ReviewCommand。
 */
export function invalidReviewOperationError(
  from: ReviewStatus,
  operation: string,
): DomainError {
  return new DomainError(
    DOMAIN_ERROR_CODES.invalidStateTransition,
    `非法审核操作：${operation} 不允许在 ${from}`,
    { aggregateType: "Review", from, operation },
  );
}

/** 业务不变量被破坏。 */
export function reviewInvariantViolatedError(
  rule: string,
  details: Readonly<Record<string, unknown>> = {},
): DomainError {
  return new DomainError(
    DOMAIN_ERROR_CODES.aggregateInvariantViolated,
    `审核不变量被破坏：${rule}`,
    { aggregateType: "Review", rule, ...details },
  );
}

/** 驳回未携带有效原因。 */
export function rejectionReasonRequiredError(): DomainError {
  return reviewInvariantViolatedError("reject_requires_reason");
}

/** 同版本重复审批/驳回（幂等）。 */
export function reviewAlreadyProcessedError(
  reviewId: string,
  command: ReviewCommand,
): DomainError {
  return new DomainError(
    DOMAIN_ERROR_CODES.commandAlreadyProcessed,
    `审核命令已处理：${command} on ${reviewId}`,
    { aggregateType: "Review", reviewId, command },
  );
}

/** 终态不可变更。 */
export function reviewIsTerminalError(status: ReviewStatus): DomainError {
  return new DomainError(
    DOMAIN_ERROR_CODES.invalidStateTransition,
    `审核已处于终态：${status}`,
    { aggregateType: "Review", status },
  );
}

/** 乐观锁冲突：聚合已被其他请求修改（expectedVersion 不匹配）。 */
export function reviewVersionConflictError(
  reviewId: string,
  expectedVersion: number,
): DomainError {
  return new DomainError(
    DOMAIN_ERROR_CODES.aggregateVersionConflict,
    `审核版本冲突：${reviewId} @ v${expectedVersion}`,
    { aggregateType: "Review", reviewId, expectedVersion },
  );
}

/** 提取错误的码（便于测试断言）。 */
export function errorCodeOf(error: unknown): DomainErrorCode | undefined {
  if (error instanceof DomainError) return error.code;
  return undefined;
}
