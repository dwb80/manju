import type { PipelineDependency } from "../../domain/pipeline/dag-policy.js";
import {
  PipelineRunAggregate,
  type PipelineRunSnapshot,
} from "../../domain/pipeline/pipeline-run.aggregate.js";
import type { PipelineNodeSnapshot } from "../../domain/pipeline/pipeline-node.entity.js";
import type { PipelineNodeStatus } from "../../domain/pipeline/pipeline-node-state-machine.js";
import type { PipelineRunStatus } from "../../domain/pipeline/pipeline-state-machine.js";

export type SqliteRow = Readonly<Record<string, unknown>>;

function text(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

function integer(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function jsonObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return { ...(value as Record<string, unknown>) };
  }
  if (typeof value !== "string" || value.length === 0) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? { ...(parsed as Record<string, unknown>) }
      : {};
  } catch {
    return {};
  }
}

function stringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value !== "string" || value.length === 0) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export class PipelineRunMapper {
  static toDomain(
    run: SqliteRow,
    nodeRows: readonly SqliteRow[],
    dependencyRows: readonly SqliteRow[],
  ): PipelineRunAggregate {
    const nodes = nodeRows.map<PipelineNodeSnapshot>((node) => ({
      id: text(node.id),
      runId: text(node.run_id),
      projectId: text(node.project_id),
      type: text(node.type),
      name: text(node.name),
      status: text(node.status) as PipelineNodeStatus,
      config: jsonObject(node.config),
      input: jsonObject(node.input_data),
      output: jsonObject(node.output_data),
      error: text(node.error),
      errorCategory: text(node.error_category),
      retryCount: Math.max(0, Number(node.retry_count ?? 0)),
      maxRetries: Math.max(0, Number(node.max_retries ?? 2)),
      idempotencyKey: text(node.idempotency_key),
      priority: Math.max(0, Math.min(3, Number(node.priority ?? 1))),
      startedAt: text(node.started_at),
      completedAt: text(node.completed_at),
      createdAt: text(node.created_at),
      updatedAt: text(node.updated_at),
      version: integer(node.version, 1),
    }));
    const dependencies = dependencyRows.map<PipelineDependency>((edge) => ({
      sourceNodeId: text(edge.source_node_id),
      targetNodeId: text(edge.target_node_id),
      condition: (text(edge.condition_type) || "always") as PipelineDependency["condition"],
    }));
    const snapshot: PipelineRunSnapshot = {
      id: text(run.id),
      projectId: text(run.project_id),
      name: text(run.name),
      status: text(run.status) as PipelineRunStatus,
      workflowConfig: jsonObject(run.workflow_config),
      startNodeId: text(run.start_node_id),
      currentNodeId: text(run.current_node_id),
      error: text(run.error),
      startedAt: text(run.started_at),
      completedAt: text(run.completed_at),
      createdAt: text(run.created_at),
      updatedAt: text(run.updated_at),
      version: integer(run.version, 1),
      processedCommandIds: stringArray(run.processed_command_ids),
      nodes,
      dependencies,
    };
    return PipelineRunAggregate.rehydrate(snapshot);
  }

  static runParameters(aggregate: PipelineRunAggregate): readonly unknown[] {
    const snapshot = aggregate.toSnapshot();
    return [
      snapshot.status,
      JSON.stringify(snapshot.workflowConfig),
      snapshot.startNodeId,
      snapshot.currentNodeId,
      snapshot.error,
      snapshot.startedAt,
      snapshot.completedAt,
      snapshot.updatedAt,
      snapshot.version,
      JSON.stringify(snapshot.processedCommandIds),
    ];
  }

  static nodeParameters(node: PipelineNodeSnapshot): readonly unknown[] {
    return [
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
      node.updatedAt,
      node.priority,
      node.version,
    ];
  }
}
