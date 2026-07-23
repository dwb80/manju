import { toDomainOutboxEvent } from "../../application/shared/unit-of-work.js";
import type { PipelineRunRepository } from "../../domain/pipeline/pipeline-run.repository.js";
import type { PipelineRunAggregate } from "../../domain/pipeline/pipeline-run.aggregate.js";
import { pipelineVersionConflict } from "../../domain/pipeline/pipeline-errors.js";
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

  async create(aggregate: PipelineRunAggregate): Promise<void> {
    const snapshot = aggregate.toSnapshot();
    this.database.exec("BEGIN");
    try {
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
      const now = new Date().toISOString();
      this.database.prepare(
        `INSERT INTO outbox_events
         (id, topic, payload, source, status, attempts, max_attempts,
          not_before, last_error, created_at, updated_at)
         VALUES (?, 'run.lifecycle.created', ?, 'PipelineRun', 'pending',
                 0, 5, 0, '', ?, ?)`,
      ).run(
        `run.lifecycle.created:${snapshot.id}`,
        JSON.stringify({
          runId: snapshot.id,
          projectId: snapshot.projectId,
          nodeCount: snapshot.nodes.length,
        }),
        now,
        now,
      );
      this.database.exec("COMMIT");
      aggregate.markPersisted();
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  async save(
    aggregate: PipelineRunAggregate,
    expectedVersion: number,
  ): Promise<void> {
    const snapshot = aggregate.toSnapshot();
    const events = aggregate.pendingDomainEvents().map(toDomainOutboxEvent);
    this.database.exec("BEGIN");
    try {
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

      const insertOutbox = this.database.prepare(
        `INSERT INTO outbox_events
         (id, topic, payload, source, status, attempts, max_attempts,
          not_before, last_error, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'pending', 0, 5, 0, '', ?, ?)`,
      );
      const now = new Date().toISOString();
      for (const event of events) {
        insertOutbox.run(
          event.id,
          event.topic,
          JSON.stringify(event.payload),
          event.source,
          now,
          now,
        );
      }
      this.database.exec("COMMIT");
      aggregate.markPersisted();
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
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
}
