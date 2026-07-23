/**
 * @file shot-errors.ts
 * @description Shot 聚合专属领域错误。基于共享 DomainError，复用冻结错误码。
 *
 * 共享错误码（domain/shared/domain-error.ts）：
 *   - aggregate_not_found
 *   - invalid_state_transition
 *   - aggregate_version_conflict
 *   - aggregate_invariant_violated
 *   - command_already_processed
 *
 * 本文件只提供 Shot 语义的构造器，让聚合代码抛出的错误带上可读 details。
 */

import {
  DOMAIN_ERROR_CODES,
  DomainError,
  type DomainErrorCode,
} from "../shared/domain-error.js";
import type { ShotCommand, ShotStatus } from "./shot-state-machine.js";

/** 聚合不存在。 */
export function shotNotFoundError(shotId: string): DomainError {
  return new DomainError(
    DOMAIN_ERROR_CODES.aggregateNotFound,
    `shot_not_found: ${shotId}`,
    { aggregateType: "Shot", shotId },
  );
}

/** 非法状态迁移。 */
export function invalidShotTransitionError(
  from: ShotStatus,
  command: ShotCommand,
): DomainError {
  return new DomainError(
    DOMAIN_ERROR_CODES.invalidStateTransition,
    `非法镜头状态迁移：${from} -> ${command}`,
    { aggregateType: "Shot", from, command },
  );
}

/** 业务不变量被破坏。 */
export function shotInvariantViolatedError(
  rule: string,
  details: Readonly<Record<string, unknown>> = {},
): DomainError {
  return new DomainError(
    DOMAIN_ERROR_CODES.aggregateInvariantViolated,
    `镜头不变量被破坏：${rule}`,
    { aggregateType: "Shot", rule, ...details },
  );
}

/** 必填生成结果缺失（送审/批准前置条件）。 */
export function shotMissingVideoResultError(shotId: string): DomainError {
  return shotInvariantViolatedError("missing_video_result", { shotId });
}

/** 必填 reviewId 缺失（批准/驳回前置条件）。 */
export function shotMissingReviewResultError(shotId: string): DomainError {
  return shotInvariantViolatedError("missing_review_id", { shotId });
}

/** 必填驳回原因缺失。 */
export function shotRejectionReasonRequiredError(): DomainError {
  return shotInvariantViolatedError("reject_requires_reason");
}

/** 候选视频/Provider request 不匹配当前 generationRequestId。 */
export function shotCandidateMismatchError(
  shotId: string,
  expected: string,
  actual: string,
): DomainError {
  return shotInvariantViolatedError("candidate_mismatch", {
    shotId,
    expected,
    actual,
  });
}

/** 已审核镜头不能通过普通删除入口删除。 */
export function shotProtectedFromDeleteError(
  shotId: string,
  status: ShotStatus,
): DomainError {
  return shotInvariantViolatedError("protected_from_delete", {
    shotId,
    status,
  });
}

/** 同 commandId 重复提交（幂等）。 */
export function shotAlreadyProcessedError(
  shotId: string,
  command: ShotCommand,
): DomainError {
  return new DomainError(
    DOMAIN_ERROR_CODES.commandAlreadyProcessed,
    `镜头命令已处理：${command} on ${shotId}`,
    { aggregateType: "Shot", shotId, command },
  );
}

/** 终态不可变更。 */
export function shotIsTerminalError(status: ShotStatus): DomainError {
  return new DomainError(
    DOMAIN_ERROR_CODES.invalidStateTransition,
    `镜头已处于终态：${status}`,
    { aggregateType: "Shot", status },
  );
}

/** 乐观锁冲突（被其他请求修改）。 */
export function shotVersionConflictError(
  shotId: string,
  expectedVersion: number,
): DomainError {
  return new DomainError(
    DOMAIN_ERROR_CODES.aggregateVersionConflict,
    `镜头版本冲突：${shotId} expected=${expectedVersion}`,
    { aggregateType: "Shot", shotId, expectedVersion },
  );
}

/** 提取错误的码（便于测试断言）。 */
export function errorCodeOf(error: unknown): DomainErrorCode | undefined {
  if (error instanceof DomainError) return error.code;
  return undefined;
}
