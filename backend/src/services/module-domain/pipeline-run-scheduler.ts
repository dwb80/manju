/**
 * Pipeline scheduler.
 *
 * The scheduler decides when work may be launched. It never writes Run/Node
 * state: every transition is delegated to an application command handler.
 */
import type { AppContext } from "../app.js";
import { DOMAIN_ERROR_CODES, isDomainError } from "../../domain/shared/domain-error.js";
import type { PipelineNode } from "../../domain/pipeline/pipeline-node.entity.js";
import { SqlitePipelineRunRepository } from "../../infrastructure/persistence/sqlite-pipeline-run.repository.js";
import {
  CompleteNodeHandler,
  FailNodeHandler,
  FinalizeRunHandler,
  SkipNodeHandler,
  StartNodeHandler,
} from "../../application/pipeline/pipeline-command-handler.js";
import { rootLogger } from "../../logger.js";
import { assertBudgetCapacityForNodes } from "./pipeline-budget.js";
import { getNodeMaxConcurrent } from "../horizontal/concurrency-tracker.js";
import {
  createNodeExecutor,
  type NodeExecutionResult,
} from "./pipeline-node-executor.js";

const log = rootLogger.child({ module: "pipeline-run-scheduler" });
const POLL_INTERVAL_MS = 50;

export interface PipelineRunScheduler {
  processRun(runId: string): Promise<void>;
  finalizeRun(runId: string): Promise<void>;
  waitForIdle(): Promise<void>;
}

function issuedAt(): string {
  return new Date().toISOString();
}

function legacyNode(node: PipelineNode): Record<string, unknown> {
  const snapshot = node.toSnapshot();
  return {
    id: snapshot.id,
    run_id: snapshot.runId,
    project_id: snapshot.projectId,
    type: snapshot.type,
    name: snapshot.name,
    status: snapshot.status,
    config: snapshot.config,
    input_data: snapshot.input,
    output_data: snapshot.output,
    error: snapshot.error,
    error_category: snapshot.errorCategory,
    retry_count: snapshot.retryCount,
    idempotency_key: snapshot.idempotencyKey,
    priority: snapshot.priority,
    version: snapshot.version,
    created_at: snapshot.createdAt,
    updated_at: snapshot.updatedAt,
  };
}

async function retryVersionConflict<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (
      !isDomainError(error) ||
      error.code !== DOMAIN_ERROR_CODES.aggregateVersionConflict
    ) {
      throw error;
    }
    return operation();
  }
}

export function createPipelineRunScheduler(
  ctx: AppContext,
  _deps: { readonly recordEvent?: unknown } = {},
): PipelineRunScheduler {
  const repository = new SqlitePipelineRunRepository(ctx.databaseFile);
  const startNode = new StartNodeHandler(repository);
  const completeNode = new CompleteNodeHandler(repository);
  const failNode = new FailNodeHandler(repository);
  const skipNode = new SkipNodeHandler(repository);
  const finalize = new FinalizeRunHandler(repository);
  const executor = createNodeExecutor(ctx);
  const activeRuns = new Map<string, Promise<void>>();
  const mutationTails = new Map<string, Promise<void>>();

  function serializeMutation<T>(
    runId: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    const previous = mutationTails.get(runId) ?? Promise.resolve();
    const current = previous.then(operation, operation);
    mutationTails.set(
      runId,
      current.then(
        () => undefined,
        () => undefined,
      ),
    );
    return current;
  }

  async function applyResult(
    runId: string,
    nodeId: string,
    commandId: string,
    result: NodeExecutionResult,
  ): Promise<void> {
    if (result.kind === "success") {
      await serializeMutation(runId, () =>
        retryVersionConflict(() =>
          completeNode.execute({
          commandId,
          type: "CompletePipelineNode",
          issuedAt: issuedAt(),
          runId,
          nodeId,
          output: result.output,
          }),
        ),
      );
      return;
    }
    const failure =
      result.kind === "cancelled"
        ? {
            message: result.reason,
            category: "cancelled",
            retryable: false,
          }
        : {
            message: result.error.message,
            category: result.error.category,
            retryable: result.error.retryable,
          };
    await serializeMutation(runId, () =>
      retryVersionConflict(() =>
        failNode.execute({
        commandId,
        type: "FailPipelineNode",
        issuedAt: issuedAt(),
        runId,
        nodeId,
        failure,
        }),
      ),
    );
  }

  async function launchNode(
    runId: string,
    node: PipelineNode,
    runConfig: Readonly<Record<string, unknown>>,
  ): Promise<void> {
    const rawNode = legacyNode(node);
    const maxConcurrent = getNodeMaxConcurrent(
      node.type,
      node.config as Record<string, unknown>,
      runConfig as Record<string, unknown>,
    );
    const token = await ctx.concurrencyTracker.acquire(node.type, maxConcurrent);
    const startCommandId = `${runId}:${node.id}:start:v${node.version}`;
    try {
      // Budget is checked immediately before the aggregate performs its second
      // run-state/version check and moves the node to running.
      await assertBudgetCapacityForNodes(ctx, node.projectId, [rawNode]);
      const started = await serializeMutation(runId, () =>
        retryVersionConflict(() =>
          startNode.execute({
          commandId: startCommandId,
          type: "StartPipelineNode",
          issuedAt: issuedAt(),
          runId,
          nodeId: node.id,
          }),
        ),
      );
      if (!started.started) return;
      const result = await executor.executeNode(runId, rawNode);
      await applyResult(
        runId,
        node.id,
        `${runId}:${node.id}:result:${startCommandId}`,
        result,
      );
    } finally {
      ctx.concurrencyTracker.release(token);
    }
  }

  async function finalizeRun(runId: string): Promise<void> {
    const aggregate = await repository.get(runId);
    if (!aggregate || aggregate.status !== "running") return;
    if (aggregate.nodes.some((node) => !node.isTerminal)) return;
    await retryVersionConflict(() =>
      finalize.execute({
        commandId: `${runId}:finalize:v${aggregate.version}`,
        type: "FinalizePipelineRun",
        issuedAt: issuedAt(),
        runId,
      }),
    );
  }

  async function processLoop(runId: string): Promise<void> {
    const activeNodes = new Map<string, Promise<void>>();
    while (true) {
      const aggregate = await repository.get(runId);
      if (!aggregate || aggregate.status !== "running") return;

      for (const node of aggregate.unreachableNodes()) {
        await retryVersionConflict(() =>
          skipNode.execute({
            commandId: `${runId}:${node.id}:dag-skip:v${node.version}`,
            type: "SkipPipelineNode",
            issuedAt: issuedAt(),
            runId,
            nodeId: node.id,
            reason: "SKIPPED_BY_CONDITION: all incoming conditions were evaluated and inactive",
          }),
        );
      }

      const refreshed = await repository.get(runId);
      if (!refreshed || refreshed.status !== "running") return;
      for (const node of refreshed.runnableNodes()) {
        if (activeNodes.has(node.id)) continue;
        const task = launchNode(runId, node, refreshed.workflowConfig)
          .catch((error) => {
            log.error(
              {
                event: "pipeline.node.schedule_error",
                runId,
                nodeId: node.id,
                error: (error as Error).message,
              },
              "Pipeline node scheduling failed",
            );
          })
          .finally(() => activeNodes.delete(node.id));
        activeNodes.set(node.id, task);
      }

      if (activeNodes.size > 0) {
        await Promise.race(activeNodes.values());
        continue;
      }

      const finalCheck = await repository.get(runId);
      if (!finalCheck || finalCheck.status !== "running") return;
      if (finalCheck.nodes.every((node) => node.isTerminal)) {
        await finalizeRun(runId);
        return;
      }
      if (finalCheck.runnableNodes().length === 0) return;
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }

  function processRun(runId: string): Promise<void> {
    const existing = activeRuns.get(runId);
    if (existing) return existing;
    const task = processLoop(runId).finally(() => activeRuns.delete(runId));
    activeRuns.set(runId, task);
    return task;
  }

  async function waitForIdle(): Promise<void> {
    await Promise.allSettled(activeRuns.values());
  }

  return { processRun, finalizeRun, waitForIdle };
}
