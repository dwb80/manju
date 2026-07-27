/**
 * @file sqlite-pipeline-run.repository.ts
 * @description PipelineRunRepository 的 SQLite 实现（V2.1 UoW 接入版本）。
 *
 * 关键规则（v2.1-ddd-pipeline-uow-migration.md）：
 *  - `get` / `create` / `save` / `isCommandProcessed` / `recordCommand` 全部**不开启** BEGIN/COMMIT：
 *    所有 SQL 操作参与外层 UnitOfWork（TransactionService.run）开启的同一事务，确保
 *    状态、节点、幂等键、Outbox（由 TransactionService 在 commit 前统一写入）原子提交。
 *  - 领域事件由调用方在 `ctx.enqueueDomainEvent` 入队，仓储不再直写 outbox_events。
 *  - `save` 使用 `WHERE id = ? AND version = ?` 乐观锁；影响行数 0 抛 aggregate_version_conflict。
 *  - 幂等键权威源是 `pipeline_command_log(id PK)`：跨进程重启可恢复，事务回滚时一并消失。
 *  - 迁移：构造 Repository 时 ensurePipelineAggregateSchema 自动补齐本任务线独占的表/列。
 */

import type { PipelineRunRepository } from "../../domain/pipeline/pipeline-run.repository.js";
import type { PipelineRunAggregate } from "../../domain/pipeline/pipeline-run.aggregate.js";
import { pipelineVersionConflict } from "../../domain/pipeline/pipeline-errors.js";
import {
  DOMAIN_ERROR_CODES,
  DomainError,
} from "../../domain/shared/domain-error.js";
import { getRawDatabase } from "../../storage/sqlite.js";
import { PipelineRunMapper, type SqliteRow } from "./pipeline-run.mapper.js";
import { ensurePipelineAggregateSchema } from "./pipeline-run-migration.js";

type RunResult = { changes?: number | bigint };
type Statement = {
  get(...args: unknown[]): Record<string, unknown> | undefined;
  all(...args: unknown[]): Record<string, unknown>[];
  run(...args: unknown[]): RunResult;
};
type RawDatabase = {
  exec(sql: string): void;
  prepare(sql: string): Statement;
};

function changes(result: RunResult): number {
  return Number(result.changes ?? 0);
}

export class SqlitePipelineRunRepository implements PipelineRunRepository {
  private readonly database: RawDatabase;

  constructor(databaseFile: string) {
    ensurePipelineAggregateSchema(databaseFile);
    this.database = getRawDatabase(databaseFile) as unknown as RawDatabase;
  }

  async get(id: string): Promise<PipelineRunAggregate | null> {
    const run = this.database
      .prepare("SELECT * FROM pipeline_runs WHERE id = ?")
      .get(id) as SqliteRow | undefined;
    if (!run) return null;
    const nodes = this.database
      .prepare("SELECT * FROM pipeline_nodes WHERE run_id = ? ORDER BY created_at, id")
      .all(id) as SqliteRow[];
    const dependencies = this.database
      .prepare("SELECT * FROM pipeline_dependencies WHERE run_id = ? ORDER BY created_at, id")
      .all(id) as SqliteRow[];
    return PipelineRunMapper.toDomain(run, nodes, dependencies);
  }

  /**
   * 创建 Run + 节点 + 依赖。不再自开事务、不再直写 outbox_events。
   * 调用方必须在 UnitOfWork 事务内（否则外部无事务时 SQLite 会按隐式事务提交，
   * 与其它仓储/Outbox 写入无法原子）。
   *
   * 如果需要发出"Run 生命周期创建"事件，由 CreateRunHandler 在 `ctx.enqueueDomainEvent`
   * 入队即可。PipelineRunAggregate.create() 自身不产生领域事件，所以当前无内置 outbox
   * 写入——V2.1 历史行为 `run.lifecycle.created` 直写已移除（参见 v2.1-ddd-pipeline-uow-migration.md §3.2）。
   */
  async create(aggregate: PipelineRunAggregate): Promise<void> {
    const snapshot = aggregate.toSnapshot();
    this.database
      .prepare(
        `INSERT INTO pipeline_runs
         (id, project_id, name, status, workflow_config, start_node_id,
          current_node_id, error, started_at, completed_at, created_at,
          updated_at, version, processed_command_ids)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        snapshot.id,
        snapshot.projectId,
        snapshot.name,
        snapshot.status,
        JSON.stringify(snapshot.workflowConfig),
        snapshot.startNodeId,
        snapshot.currentNodeId,
        snapshot.error,
        snapshot.startedAt,
        snapshot.completedAt,
        snapshot.createdAt,
        snapshot.updatedAt,
        snapshot.version,
        JSON.stringify(snapshot.processedCommandIds),
      );
    const insertNode = this.database.prepare(
      `INSERT INTO pipeline_nodes
       (id, run_id, project_id, type, name, status, config, input_data,
        output_data, error, error_category, retry_count, max_retries,
        started_at, completed_at, created_at, updated_at, idempotency_key,
        priority, version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const node of snapshot.nodes) {
      insertNode.run(
        node.id,
        node.runId,
        node.projectId,
        node.type,
        node.name,
        node.status,
        JSON.stringify(node.config),
        JSON.stringify(node.input),
        JSON.stringify(node.output),
        node.error,
        node.errorCategory,
        node.retryCount,
        node.maxRetries,
        node.startedAt,
        node.completedAt,
        node.createdAt,
        node.updatedAt,
        node.idempotencyKey,
        node.priority,
        node.version,
      );
    }
    const insertDependency = this.database.prepare(
      `INSERT INTO pipeline_dependencies
       (id, run_id, source_node_id, target_node_id, created_at,
        condition_type, condition_expr, condition)
       VALUES (?, ?, ?, ?, ?, ?, '', '{}')`,
    );
    snapshot.dependencies.forEach((edge, index) => {
      insertDependency.run(
        `${snapshot.id}_dep_${index + 1}`,
        snapshot.id,
        edge.sourceNodeId,
        edge.targetNodeId,
        snapshot.createdAt,
        edge.condition,
      );
    });
    aggregate.markPersisted();
  }

  /**
   * 保存聚合状态。不开启事务、不直写 outbox。调用方必须在 UoW 事务内。
   * Outbox 写入由调用方在 `ctx.enqueueDomainEvent` 完成。
   */
  async save(
    aggregate: PipelineRunAggregate,
    expectedVersion: number,
  ): Promise<void> {
    const snapshot = aggregate.toSnapshot();
    const runUpdate = this.database
      .prepare(
        `UPDATE pipeline_runs
         SET status = ?, workflow_config = ?, start_node_id = ?,
             current_node_id = ?, error = ?, started_at = ?, completed_at = ?,
             updated_at = ?, version = ?, processed_command_ids = ?
         WHERE id = ? AND version = ?`,
      )
      .run(
        ...PipelineRunMapper.runParameters(aggregate),
        snapshot.id,
        expectedVersion,
      );
    if (changes(runUpdate) !== 1) {
      throw pipelineVersionConflict(snapshot.id, expectedVersion);
    }

    const updateNode = this.database.prepare(
      `UPDATE pipeline_nodes
       SET status = ?, config = ?, input_data = ?, output_data = ?,
           error = ?, error_category = ?, retry_count = ?, max_retries = ?,
           started_at = ?, completed_at = ?, updated_at = ?, priority = ?,
           version = ?
       WHERE id = ? AND run_id = ? AND version = ?`,
    );
    const insertNode = this.database.prepare(
      `INSERT INTO pipeline_nodes
       (id, run_id, project_id, type, name, status, config, input_data,
        output_data, error, error_category, retry_count, max_retries,
        started_at, completed_at, created_at, updated_at, idempotency_key,
        priority, version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const node of aggregate.nodes) {
      if (!node.isDirty) continue;
      if (node.persistedVersion === 0) {
        const value = node.toSnapshot();
        insertNode.run(
          value.id,
          value.runId,
          value.projectId,
          value.type,
          value.name,
          value.status,
          JSON.stringify(value.config),
          JSON.stringify(value.input),
          JSON.stringify(value.output),
          value.error,
          value.errorCategory,
          value.retryCount,
          value.maxRetries,
          value.startedAt,
          value.completedAt,
          value.createdAt,
          value.updatedAt,
          value.idempotencyKey,
          value.priority,
          value.version,
        );
        continue;
      }
      const result = updateNode.run(
        ...PipelineRunMapper.nodeParameters(node.toSnapshot()),
        node.id,
        aggregate.id,
        node.persistedVersion,
      );
      if (changes(result) !== 1) {
        throw pipelineVersionConflict(node.id, node.persistedVersion);
      }
    }
    aggregate.markPersisted();
  }

  async findCompletedOutputByIdempotencyKey(
    projectId: string,
    idempotencyKey: string,
    excludingNodeId: string,
  ): Promise<Readonly<Record<string, unknown>> | null> {
    if (!idempotencyKey) return null;
    const row = this.database
      .prepare(
        `SELECT output_data FROM pipeline_nodes
         WHERE project_id = ? AND idempotency_key = ? AND status = 'completed'
           AND id <> ? AND output_data <> '' AND output_data <> '{}'
         ORDER BY completed_at DESC LIMIT 1`,
      )
      .get(projectId, idempotencyKey, excludingNodeId);
    if (!row || typeof row.output_data !== "string") return null;
    try {
      const parsed = JSON.parse(row.output_data) as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }

  /**
   * 幂等键查询（持久化层）。UoW.run 事务内调用。
   * 跨进程重启可恢复；与 pipeline_runs.processed_command_ids 内存缓存无依赖。
   */
  async isCommandProcessed(commandId: string): Promise<boolean> {
    if (!commandId) return false;
    const row = this.database
      .prepare("SELECT id FROM pipeline_command_log WHERE id = ?")
      .get(commandId) as SqliteRow | undefined;
    return Boolean(row);
  }

  /**
   * 幂等键落表。UoW.run 事务内调用，**必须**在 `save` 之后调用。
   * 与 `save` 在同一事务提交：失败回滚时本行 INSERT 一并消失，幂等键与状态同步撤销。
   * 重复 commandId 抛 `DomainError(command_already_processed)`，被 TransactionService 整体回滚。
   */
  async recordCommand(
    commandId: string,
    runId: string,
    commandType: string,
  ): Promise<void> {
    if (!commandId) {
      throw new DomainError(
        DOMAIN_ERROR_CODES.aggregateInvariantViolated,
        "Pipeline command id is required",
        { aggregateType: "PipelineRun" },
      );
    }
    try {
      this.database
        .prepare(
          `INSERT INTO pipeline_command_log (id, run_id, command_type, created_at)
           VALUES (?, ?, ?, ?)`,
        )
        .run(commandId, runId, commandType, new Date().toISOString());
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/UNIQUE constraint|PRIMARY KEY|unique/i.test(message)) {
        throw new DomainError(
          DOMAIN_ERROR_CODES.commandAlreadyProcessed,
          `Pipeline 命令已处理：${commandId}`,
          { aggregateType: "PipelineRun", runId, commandId },
        );
      }
      throw err;
    }
  }
}
