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
import {
  SHOT_PROTECTED_FIELDS,
  type ShotCommand,
} from "../../domain/storyboard/shot-state-machine.js";
import {
  DOMAIN_ERROR_CODES,
  DomainError,
} from "../../domain/shared/domain-error.js";

/** 命令处理器共享依赖。 */
export interface ShotHandlerDeps {
  readonly repo: ShotRepository;
  readonly uow: UnitOfWork;
}

export type { ShotAggregate, ShotSnapshotDraft };

/**
 * 入口统一守门：拒绝空 commandId 进入 Shot 任意可写命令。
 * 空串会让后续幂等检查误判（首条空串入库后，第二次同空串才报 PK 冲突，
 * 中间窗口业务状态已变）。直接抛 invariant 让上游修正调用方。
 */
export function assertCommandId(commandId: string, commandName: string): void {
  if (!commandId || typeof commandId !== "string") {
    throw new DomainError(
      DOMAIN_ERROR_CODES.aggregateInvariantViolated,
      `shot 命令 ${commandName} 缺少 commandId`,
      { commandName, commandId: String(commandId ?? "") },
    );
  }
}

/**
 * 入口统一守门：拒绝受保护字段（status / version / 审核结果等）进入 Shot 任意
 * 可写命令（edit / archive / restore / softDelete / 第三方 patch 路径等）。
 * 提到 ShotHandlerDeps 同模块后，新增命令只需 import + 调用，不再在分散位置
 * 各自加 `key in patch` 守护（之前 R2 审计发现 edit-shot 是唯一守门点，
 * archive/softDelete 路径并未受同样保护，存在绕过风险）。
 */
export function assertNoProtectedFields(patch: Record<string, unknown>): void {
  for (const key of SHOT_PROTECTED_FIELDS) {
    if (key in patch && patch[key] !== undefined) {
      throw new DomainError(
        DOMAIN_ERROR_CODES.aggregateInvariantViolated,
        `shot 拒绝受保护字段：${key}`,
        { field: key, aggregateType: "Shot" },
      );
    }
  }
}

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
