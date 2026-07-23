/**
 * Backwards-compatible Pipeline facade.
 *
 * Query methods keep using the existing read repositories. Every Run/Node
 * state mutation is delegated to a Pipeline application command handler.
 */
import type { AppContext } from "../app.js";
import type {
  PipelineEvent,
  PipelineEventType,
  PipelineNodePriority,
} from "../../types/pipeline.js";
import {
  DEFAULT_PIPELINE_NODE_PRIORITY,
  PIPELINE_NODE_PRIORITY,
} from "../../types/pipeline.js";
import {
  AddNodesHandler,
  CreateRunHandler,
  FailNodeHandler,
  PauseNodeHandler,
  PauseRunHandler,
  ResumeNodeHandler,
  ResumeRunHandler,
  RetryNodeHandler,
  SetNodePriorityHandler,
  SkipNodeHandler,
  StartRunHandler,
} from "../../application/pipeline/pipeline-command-handler.js";
import type {
  CreatePipelineNode,
} from "../../domain/pipeline/pipeline-run.aggregate.js";
import type { PipelineDependency } from "../../domain/pipeline/dag-policy.js";
import { SqlitePipelineRunRepository } from "../../infrastructure/persistence/sqlite-pipeline-run.repository.js";
import { assertBudgetCapacityForNodes } from "./pipeline-budget.js";
import { createPipelineEventService } from "./pipeline-event-service.js";
import { computeNodeIdempotencyKey } from "./pipeline-idempotency.js";
import { createPipelineRunScheduler } from "./pipeline-run-scheduler.js";
import { getNodeTimeout } from "./pipeline-node-executor.js";

export { computeNodeIdempotencyKey };

export function normalizeNodePriority(input: unknown): PipelineNodePriority {
  if (input === null || input === undefined) return DEFAULT_PIPELINE_NODE_PRIORITY;
  if (typeof input === "number") {
    if (!Number.isFinite(input)) return DEFAULT_PIPELINE_NODE_PRIORITY;
    return Math.max(0, Math.min(3, Math.floor(input))) as PipelineNodePriority;
  }
  if (typeof input === "string") {
    const value = input.trim().toLowerCase();
    if (value === "low") return PIPELINE_NODE_PRIORITY.low;
    if (value === "normal" || value === "") return PIPELINE_NODE_PRIORITY.normal;
    if (value === "high") return PIPELINE_NODE_PRIORITY.high;
    if (value === "urgent") return PIPELINE_NODE_PRIORITY.urgent;
    const number = Number(value);
    return Number.isFinite(number)
      ? normalizeNodePriority(number)
      : DEFAULT_PIPELINE_NODE_PRIORITY;
  }
  return DEFAULT_PIPELINE_NODE_PRIORITY;
}

export interface PipelineRunService {
  createRun(
    projectId: string,
    name: string,
    nodes: unknown[],
    dependencies: unknown[],
  ): Promise<{ runId: string; valid: boolean; errors?: unknown[] }>;
  startRun(runId: string): Promise<void>;
  pauseRun(runId: string): Promise<void>;
  resumeRun(runId: string): Promise<void>;
  pauseNode(runId: string, nodeId: string): Promise<void>;
  resumeNode(runId: string, nodeId: string): Promise<void>;
  skipNode(runId: string, nodeId: string): Promise<void>;
  retryNode(runId: string, nodeId: string): Promise<void>;
  batchNodeAction(
    runId: string,
    nodeIds: string[],
    action: "pause" | "resume" | "skip" | "retry",
  ): Promise<{
    runId: string;
    action: "pause" | "resume" | "skip" | "retry";
    total: number;
    succeeded: string[];
    failed: Array<{ nodeId: string; error: string }>;
  }>;
  setNodePriority(
    runId: string,
    nodeId: string,
    priority: number | "low" | "normal" | "high" | "urgent",
  ): Promise<void>;
  batchCreateNodes(
    runId: string,
    nodes: unknown[],
  ): Promise<{
    runId: string;
    added: string[];
    failed: Array<{ index: number; error: string }>;
  }>;
  getRun(runId: string): Promise<unknown | null>;
  listRuns(projectId?: string): Promise<unknown[]>;
  getRunNodes(runId: string): Promise<unknown[]>;
  detectStaleRunningNodes(options?: { graceSeconds?: number }): Promise<{
    cleanedNodeIds: string[];
    cleanedRunIds: string[];
  }>;
  listNodeEvents(
    nodeId: string,
    options?: { limit?: number; type?: PipelineEventType },
  ): Promise<PipelineEvent[]>;
  recordEvent(input: {
    runId: string;
    nodeId: string;
    projectId: string;
    type: PipelineEventType;
    payload: Record<string, unknown>;
  }): Promise<PipelineEvent | null>;
  waitForIdle(): Promise<void>;
}

function newId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function command(type: string, runId: string, nodeId = ""): string {
  return `${type}:${runId}:${nodeId}:${Date.now()}:${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function toCreateNode(
  input: any,
  projectId: string,
  index: number,
): CreatePipelineNode {
  if (!input || typeof input.type !== "string" || input.type.length === 0) {
    throw new Error("node.type is required");
  }
  const id =
    typeof input.id === "string" && input.id.length > 0
      ? input.id
      : newId(`node_${index}`);
  const config =
    input.config && typeof input.config === "object" ? input.config : {};
  const nodeInput =
    input.input_data && typeof input.input_data === "object"
      ? input.input_data
      : {};
  return {
    id,
    type: input.type,
    name: typeof input.name === "string" ? input.name : "",
    config,
    input: nodeInput,
    idempotencyKey:
      typeof input.idempotency_key === "string" &&
      input.idempotency_key.length > 0
        ? input.idempotency_key
        : computeNodeIdempotencyKey({
            type: input.type,
            project_id: projectId,
            input_data: nodeInput,
            config,
          }),
    priority: normalizeNodePriority(input.priority),
    maxRetries: Math.max(0, Number(input.max_retries ?? 2)),
  };
}

function toDependency(input: any): PipelineDependency {
  const sourceNodeId = String(input?.from ?? input?.source_node_id ?? "");
  const targetNodeId = String(input?.to ?? input?.target_node_id ?? "");
  const condition = String(input?.condition_type ?? "always");
  if (
    condition !== "always" &&
    condition !== "on_approve" &&
    condition !== "on_reject" &&
    condition !== "on_skip"
  ) {
    throw new Error(`unsupported_dependency_condition: ${condition}`);
  }
  return {
    sourceNodeId,
    targetNodeId,
    condition,
  };
}

export function createPipelineRunService(ctx: AppContext): PipelineRunService {
  const repository = new SqlitePipelineRunRepository(ctx.databaseFile);
  const createRunHandler = new CreateRunHandler(repository);
  const startRunHandler = new StartRunHandler(repository);
  const pauseRunHandler = new PauseRunHandler(repository);
  const resumeRunHandler = new ResumeRunHandler(repository);
  const pauseNodeHandler = new PauseNodeHandler(repository);
  const resumeNodeHandler = new ResumeNodeHandler(repository);
  const skipNodeHandler = new SkipNodeHandler(repository);
  const retryNodeHandler = new RetryNodeHandler(repository);
  const failNodeHandler = new FailNodeHandler(repository);
  const priorityHandler = new SetNodePriorityHandler(repository);
  const addNodesHandler = new AddNodesHandler(repository);
  const eventService = createPipelineEventService(ctx);
  const scheduler = createPipelineRunScheduler(ctx, {
    recordEvent: eventService.recordEvent,
  });

  async function nodeReadModel(runId: string, nodeId: string): Promise<any> {
    const node = await ctx.pipelineNodes.findById(nodeId);
    if (!node) throw new Error(`node_not_found: ${nodeId}`);
    if (String((node as any).run_id) !== runId) {
      throw new Error("node_not_in_run");
    }
    return node;
  }

  const service: PipelineRunService = {
    async createRun(projectId, name, nodes, dependencies) {
      const runId = newId("run");
      try {
        const convertedNodes = nodes.map((node, index) =>
          toCreateNode(node, projectId, index),
        );
        const convertedDependencies = dependencies.map(toDependency);
        await assertBudgetCapacityForNodes(ctx, projectId, nodes);
        await createRunHandler.execute({
          commandId: command("create", runId),
          type: "CreatePipelineRun",
          issuedAt: new Date().toISOString(),
          run: {
            id: runId,
            projectId,
            name,
            nodes: convertedNodes,
            dependencies: convertedDependencies,
          },
        });
        return { runId, valid: true };
      } catch (error) {
        if ((error as Error).message.includes("cost_hard_cap_will_exceed")) {
          throw error;
        }
        return {
          runId: "",
          valid: false,
          errors: [{ message: (error as Error).message }],
        };
      }
    },

    async startRun(runId) {
      const before = await repository.get(runId);
      await startRunHandler.execute({
        commandId: command("start-run", runId),
        type: "StartPipelineRun",
        issuedAt: new Date().toISOString(),
        runId,
      });
      if (before) {
        await eventService.recordEvent({
          runId,
          nodeId: "",
          projectId: before.projectId,
          type: "run_started",
          payload: { startedAt: new Date().toISOString(), runName: before.name },
        });
      }
      void scheduler.processRun(runId);
    },

    async pauseRun(runId) {
      const before = await repository.get(runId);
      await pauseRunHandler.execute({
        commandId: command("pause-run", runId),
        type: "PausePipelineRun",
        issuedAt: new Date().toISOString(),
        runId,
      });
      if (before) {
        await eventService.recordEvent({
          runId,
          nodeId: "",
          projectId: before.projectId,
          type: "run_paused",
          payload: { pausedAt: new Date().toISOString() },
        });
      }
    },

    async resumeRun(runId) {
      const before = await repository.get(runId);
      await resumeRunHandler.execute({
        commandId: command("resume-run", runId),
        type: "ResumePipelineRun",
        issuedAt: new Date().toISOString(),
        runId,
      });
      if (before) {
        await eventService.recordEvent({
          runId,
          nodeId: "",
          projectId: before.projectId,
          type: "run_resumed",
          payload: { resumedAt: new Date().toISOString() },
        });
      }
      void scheduler.processRun(runId);
    },

    async pauseNode(runId, nodeId) {
      const before = await nodeReadModel(runId, nodeId);
      await pauseNodeHandler.execute({
        commandId: command("pause-node", runId, nodeId),
        type: "PausePipelineNode",
        issuedAt: new Date().toISOString(),
        runId,
        nodeId,
      });
      await eventService.recordEvent({
        runId,
        nodeId,
        projectId: String(before.project_id ?? ""),
        type: "node_paused",
        payload: {
          pausedAt: new Date().toISOString(),
          previousStatus: before.status,
        },
      });
    },

    async resumeNode(runId, nodeId) {
      const before = await nodeReadModel(runId, nodeId);
      await resumeNodeHandler.execute({
        commandId: command("resume-node", runId, nodeId),
        type: "ResumePipelineNode",
        issuedAt: new Date().toISOString(),
        runId,
        nodeId,
      });
      await eventService.recordEvent({
        runId,
        nodeId,
        projectId: String(before.project_id ?? ""),
        type: "node_resumed",
        payload: { resumedAt: new Date().toISOString() },
      });
      const run = await repository.get(runId);
      if (run?.status === "running") void scheduler.processRun(runId);
    },

    async skipNode(runId, nodeId) {
      const before = await nodeReadModel(runId, nodeId);
      await skipNodeHandler.execute({
        commandId: command("skip-node", runId, nodeId),
        type: "SkipPipelineNode",
        issuedAt: new Date().toISOString(),
        runId,
        nodeId,
        reason: "SKIPPED_BY_USER",
      });
      await eventService.recordEvent({
        runId,
        nodeId,
        projectId: String(before.project_id ?? ""),
        type: "node_skipped",
        payload: {
          skippedAt: new Date().toISOString(),
          previousStatus: before.status,
        },
      });
    },

    async retryNode(runId, nodeId) {
      const before = await nodeReadModel(runId, nodeId);
      await retryNodeHandler.execute({
        commandId: command("retry-node", runId, nodeId),
        type: "RetryPipelineNode",
        issuedAt: new Date().toISOString(),
        runId,
        nodeId,
      });
      await eventService.recordEvent({
        runId,
        nodeId,
        projectId: String(before.project_id ?? ""),
        type: "node_retried",
        payload: {
          retriedAt: new Date().toISOString(),
          previousError: String(before.error ?? ""),
          previousRetryCount: Number(before.retry_count ?? 0),
        },
      });
      const run = await repository.get(runId);
      if (run?.status === "running") void scheduler.processRun(runId);
    },

    async batchNodeAction(runId, nodeIds, action) {
      if (!Array.isArray(nodeIds) || nodeIds.length === 0) {
        throw new Error("node_ids_required");
      }
      if (nodeIds.length > 100) throw new Error("batch_too_large");
      const succeeded: string[] = [];
      const failed: Array<{ nodeId: string; error: string }> = [];
      for (const nodeId of nodeIds) {
        try {
          if (action === "pause") await service.pauseNode(runId, nodeId);
          else if (action === "resume") await service.resumeNode(runId, nodeId);
          else if (action === "skip") await service.skipNode(runId, nodeId);
          else await service.retryNode(runId, nodeId);
          succeeded.push(nodeId);
        } catch (error) {
          failed.push({ nodeId, error: (error as Error).message });
        }
      }
      return { runId, action, total: nodeIds.length, succeeded, failed };
    },

    async setNodePriority(runId, nodeId, priority) {
      const before = await nodeReadModel(runId, nodeId);
      const nextPriority = normalizeNodePriority(priority);
      await priorityHandler.execute({
        commandId: command("priority-node", runId, nodeId),
        type: "SetPipelineNodePriority",
        issuedAt: new Date().toISOString(),
        runId,
        nodeId,
        priority: nextPriority,
      });
      await eventService.recordEvent({
        runId,
        nodeId,
        projectId: String(before.project_id ?? ""),
        type: "node_priority_changed",
        payload: {
          oldPriority: normalizeNodePriority(before.priority),
          newPriority: nextPriority,
          changedAt: new Date().toISOString(),
        },
      });
    },

    async batchCreateNodes(runId, nodes) {
      if (!Array.isArray(nodes) || nodes.length === 0) {
        throw new Error("nodes_required");
      }
      if (nodes.length > 100) throw new Error("batch_too_large");
      const aggregate = await repository.get(runId);
      if (!aggregate) throw new Error(`run_not_found: ${runId}`);
      await assertBudgetCapacityForNodes(ctx, aggregate.projectId, nodes);
      const converted: CreatePipelineNode[] = [];
      const failed: Array<{ index: number; error: string }> = [];
      nodes.forEach((node, index) => {
        try {
          converted.push(toCreateNode(node, aggregate.projectId, index));
        } catch (error) {
          failed.push({ index, error: (error as Error).message });
        }
      });
      const added = await addNodesHandler.execute({
        commandId: command("add-nodes", runId),
        type: "AddPipelineNodes",
        issuedAt: new Date().toISOString(),
        runId,
        nodes: converted,
      });
      return { runId, added: [...added], failed };
    },

    async getRun(runId) {
      const run = await ctx.pipelineRuns.findById(runId);
      if (!run) return null;
      const nodes = await ctx.pipelineNodes.findMany({ run_id: runId } as any);
      const dependencies = await ctx.pipelineDependencies.findMany({
        run_id: runId,
      } as any);
      return { ...run, nodes, dependencies };
    },

    async listRuns(projectId) {
      const runs = await ctx.pipelineRuns.findMany(
        projectId ? ({ project_id: projectId } as any) : undefined,
      );
      const result: any[] = [];
      for (const run of runs as any[]) {
        const nodeCount = await ctx.pipelineNodes.count({
          run_id: run.id,
        } as any);
        const completedCount = await ctx.pipelineNodes.count({
          run_id: run.id,
          status: "completed",
        } as any);
        result.push({
          ...run,
          nodeCount,
          completedCount,
          progress:
            nodeCount > 0
              ? Math.round((completedCount / nodeCount) * 100)
              : 0,
        });
      }
      return result;
    },

    getRunNodes(runId) {
      return ctx.pipelineNodes.findMany({ run_id: runId } as any);
    },

    async detectStaleRunningNodes(options) {
      const graceSeconds = options?.graceSeconds ?? 60;
      const now = Date.now();
      const cleanedNodeIds: string[] = [];
      const affectedRuns = new Set<string>();
      const nodes = (await ctx.pipelineNodes.findMany({
        status: "running",
      } as any)) as any[];
      for (const node of nodes) {
        const started = Date.parse(String(node.started_at ?? ""));
        if (!Number.isFinite(started)) continue;
        const timeout = getNodeTimeout(String(node.type ?? ""), node.config ?? {});
        if (now <= started + (timeout + graceSeconds) * 1000) continue;
        const runId = String(node.run_id);
        await failNodeHandler.execute({
          commandId: `stale:${runId}:${node.id}:${node.started_at}`,
          type: "FailPipelineNode",
          issuedAt: new Date().toISOString(),
          runId,
          nodeId: String(node.id),
          failure: {
            message: `STALE_RUNNING_DETECTED: exceeded ${timeout + graceSeconds}s`,
            category: "timeout",
            retryable: false,
          },
        });
        cleanedNodeIds.push(String(node.id));
        affectedRuns.add(runId);
      }
      const cleanedRunIds: string[] = [];
      for (const runId of affectedRuns) {
        await scheduler.finalizeRun(runId);
        const run = await repository.get(runId);
        if (run?.isTerminal) cleanedRunIds.push(runId);
      }
      return { cleanedNodeIds, cleanedRunIds };
    },

    listNodeEvents(nodeId, options) {
      return eventService.listNodeEvents(nodeId, options);
    },

    recordEvent(input) {
      return eventService.recordEvent(input);
    },

    waitForIdle() {
      return scheduler.waitForIdle();
    },
  };

  return service;
}
