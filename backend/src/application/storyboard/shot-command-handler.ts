/**
 * @file shot-command-handler.ts
 * @description Shot 应用命令处理器装配层。
 *
 * 职责：
 *  - 在 UnitOfWork 事务内加载聚合、执行命令、保存、记录幂等键、入队领域事件。
 *  - 状态/快照/Outbox 在同一 SQLite 事务提交（由 Repository + UnitOfWork 保证）。
 *  - 不直接修改 Review/Pipeline。送审仅产出 ShotSubmittedForReview 事件，
 *    由协调者负责的跨聚合消费者驱动 Review 任务（迭代计划 §9.2）。
 *  - 审核结果（approve/reject）由 Review 任务经协调者调用 ApplyShotReviewResultCommand
 *    注入本聚合（迭代计划 §9.1）。
 *
 * 各命令处理器定义在独立文件中（create-shot / edit-shot / start-shot-generation /
 * attach-shot-video-candidate / submit-shot-review / apply-shot-review-result /
 * archive-shot），本文件提供共享依赖类型与公共辅助。
 */

import type { UnitOfWork } from "../shared/unit-of-work.js";
import type { ShotRepository } from "../../domain/storyboard/shot.repository.js";
import type {
  ShotAggregate,
  ShotSnapshotDraft,
} from "../../domain/storyboard/shot.aggregate.js";
import {
  shotAlreadyProcessedError,
  shotNotFoundError,
} from "../../domain/storyboard/shot-errors.js";
import type { ShotCommand } from "../../domain/storyboard/shot-state-machine.js";

/** 命令处理器共享依赖。 */
export interface ShotHandlerDeps {
  readonly repo: ShotRepository;
  readonly uow: UnitOfWork;
}

export type { ShotAggregate, ShotSnapshotDraft };

/** 加载镜头聚合；不存在抛 aggregate_not_found。 */
export async function loadShotOrThrow(
  deps: ShotHandlerDeps,
  shotId: string,
): Promise<ShotAggregate> {
  const agg = await deps.repo.get(shotId);
  if (!agg) throw shotNotFoundError(shotId);
  return agg;
}

/** 幂等检查：已处理抛 command_already_processed。 */
export async function assertCommandNotProcessed(
  deps: ShotHandlerDeps,
  commandId: string,
  commandName: ShotCommand,
): Promise<void> {
  if (await deps.repo.isCommandProcessed(commandId)) {
    throw shotAlreadyProcessedError("(unknown)", commandName);
  }
}

/** 入队聚合上拉取的领域事件（在 UoW 事务内调用）。 */
export function enqueuePulledEvents(
  ctx: { enqueueDomainEvent(event: import("../../domain/shared/domain-event.js").DomainEvent<unknown>): void },
  aggregate: ShotAggregate,
): void {
  for (const evt of aggregate.pullDomainEvents()) {
    ctx.enqueueDomainEvent(evt);
  }
}
