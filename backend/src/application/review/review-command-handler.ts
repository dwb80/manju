/**
 * @file review-command-handler.ts
 * @description Review 应用命令处理器装配层。
 *
 * 职责：
 *  - 在 UnitOfWork 事务内加载聚合、执行命令、保存、记录幂等键、入队领域事件。
 *  - 状态/历史/快照/Outbox 在同一 SQLite 事务提交（由 Repository + UnitOfWork 保证）。
 *  - 不直接修改 Shot；审核结果仅产出 ReviewApproved/ReviewRejected 事件，
 *    由协调者负责的跨聚合消费者驱动 Shot（迭代计划 §9.1）。
 *
 * 7 个命令处理器分别定义在 submit/start/approve/reject/resubmit/close/cancel
 * 命令文件中，本文件提供共享依赖类型与公共辅助。
 *
 * R2 加固说明：Review 现状无 DTO patch 路径（命令参数强类型，无 `key in record`
 * 这类宽口径入口），但仍按 Shot 模块对仗保留扩展点：
 *  - 每个可写命令（approve / reject / resubmit / close / cancel / start）在执行
 *    `aggregate.*` 行为之前必须先调 `loadReviewOrThrow` → 已终态直接抛错（参见
 *    `ReviewStateMachine` 的 terminal guard），与 Shot 的 `assertNoProtectedFields`
 *    等价。
 *  - 若未来 Review 出现 DTO-style patch 命令，应在此处补一个
 *    `assertNoReviewProtectedFields`，并由 `apply-*` 命令统一调用。
 */

import type { UnitOfWork } from "../shared/unit-of-work.js";
import type { ReviewRepository } from "../../domain/review/review.repository.js";
import type {
  ReviewAggregate,
  ReviewHistoryEntry,
} from "../../domain/review/review.aggregate.js";
import {
  reviewAlreadyProcessedError,
  reviewNotFoundError,
} from "../../domain/review/review-errors.js";
import type { ReviewCommand } from "../../domain/review/review-state-machine.js";
import {
  DOMAIN_ERROR_CODES,
  DomainError,
} from "../../domain/shared/domain-error.js";

/** 命令处理器共享依赖。 */
export interface ReviewHandlerDeps {
  readonly repo: ReviewRepository;
  readonly uow: UnitOfWork;
}

export type { ReviewAggregate, ReviewHistoryEntry };

/**
 * 入口统一守门：拒绝空 commandId 进入 Review 任意可写命令。
 * 幂等键缺失会导致 review_command_log 写入失败 / 误判，
 * 进而把不同命令当成同一条处理。直接抛 invariant 拒绝。
 */
export function assertCommandId(commandId: string, commandName: string): void {
  if (!commandId || typeof commandId !== "string") {
    throw new DomainError(
      DOMAIN_ERROR_CODES.aggregateInvariantViolated,
      `review 命令 ${commandName} 缺少 commandId`,
      { commandName, commandId: String(commandId ?? "") },
    );
  }
}

/** 加载审核聚合；不存在抛 aggregate_not_found。 */
export async function loadReviewOrThrow(
  deps: ReviewHandlerDeps,
  reviewId: string,
): Promise<ReviewAggregate> {
  const agg = await deps.repo.get(reviewId);
  if (!agg) throw reviewNotFoundError(reviewId);
  return agg;
}

/** 幂等检查：已处理抛 command_already_processed。 */
export async function assertCommandNotProcessed(
  deps: ReviewHandlerDeps,
  commandId: string,
  commandName: ReviewCommand,
): Promise<void> {
  if (await deps.repo.isCommandProcessed(commandId)) {
    throw reviewAlreadyProcessedError("(unknown)", commandName);
  }
}

/** 入队聚合上拉取的领域事件（在 UoW 事务内调用）。 */
export function enqueuePulledEvents(
  ctx: { enqueueDomainEvent(event: import("../../domain/shared/domain-event.js").DomainEvent<unknown>): void },
  aggregate: ReviewAggregate,
): void {
  for (const evt of aggregate.pullDomainEvents()) {
    ctx.enqueueDomainEvent(evt);
  }
}
