import type { AggregateRepository } from "../shared/aggregate-root.js";
import type { PipelineRunAggregate } from "./pipeline-run.aggregate.js";

/**
 * PipelineRun 聚合仓储端口（V2.1 UoW 接入迭代）。
 *
 * 实现约束：
 *  - `get` / `create` / `save` / `isCommandProcessed` / `recordCommand` 必须依赖调用方提供的外层
 *    UnitOfWork（即 TransactionService.run 开启的同一 SQLite 事务）执行；
 *    仓储本身**不开启** BEGIN/COMMIT，也不直写 outbox_events。
 *  - 领域事件由调用方在 `ctx.enqueueDomainEvent` 入队，事务提交前由 TransactionService 统一
 *    写入 outbox_events。
 *  - `recordCommand` 与 `save` 在同一事务内调用：失败抛错，事务整体回滚，幂等键与状态同时撤销。
 *
 * 权威幂等源：`pipeline_command_log(id PK)` 表，跨进程重启后可恢复。
 * `pipeline_runs.processed_command_ids` 字段保留用于 `get` 时重水合内存 Set，但**不作为
 * 权威幂等源**——仅作为本进程内的快速去重优化。
 */
export interface PipelineRunRepository
  extends AggregateRepository<PipelineRunAggregate> {
  create(aggregate: PipelineRunAggregate): Promise<void>;
  findCompletedOutputByIdempotencyKey(
    projectId: string,
    idempotencyKey: string,
    excludingNodeId: string,
  ): Promise<Readonly<Record<string, unknown>> | null>;
  /** 查询幂等键是否已被处理（必须在 save 之前调用，UoW 事务内）。 */
  isCommandProcessed(commandId: string): Promise<boolean>;
  /**
   * 记录幂等键（必须在 save 之后调用，UoW 事务内）。
   * 重复 commandId 抛 DomainError(command_already_processed)。
   * 与 `save` 在同一事务提交：失败回滚时本行 INSERT 一并消失。
   */
  recordCommand(
    commandId: string,
    runId: string,
    commandType: string,
  ): Promise<void>;
}
