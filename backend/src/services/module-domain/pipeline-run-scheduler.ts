/**
 * @file pipeline-run-scheduler.ts
 * @description Pipeline Run 并发调度器（REM-P1-006 拆分自原 pipeline-run-service.ts）。
 *
 * 拆分后该模块只负责：
 *  - processRun：拉取 run + nodes + deps，DAG 校验，调 scheduleConcurrentRun
 *  - scheduleConcurrentRun：维护 ready-set（per-type max 并发槽位），
 *    每个 ready 节点先 acquire 并发槽位 → 成功立刻 fire-and-forget
 *  - launchNode：把节点交给 NodeExecutor 跑，处理并发槽位 + onNodeDone 状态机
 *  - finalizeRun：所有节点终态后归并 Run 状态（completed / failed / partial）
 *  - 边条件评估（always / on_skip / on_approve / on_reject）
 *  - "所有入边条件都不满足" 时级联 skip 下游
 *
 * 关键不变量：
 *  - scheduler 只在 run.status === "running" 时推进
 *  - 节点按优先级（priority desc）+ created_at 升序调度
 *  - paused 节点不进 ready-set
 *  - 调度器退出后必须调 finalizeRun
 */
import type { AppContext } from "../app.js";
import { rootLogger } from "../../logger.js";
import { getNodeMaxConcurrent } from "../horizontal/concurrency-tracker.js";
import { createNodeExecutor, type NodeExecutorDeps, type RecordEventFn } from "./pipeline-node-executor.js";

const log = rootLogger.child({ module: "pipeline-run-scheduler" });

const POLL_INTERVAL_MS = 200;

/**
 * V2 W6 REQ-PIPE-005-02 边条件评估
 * @returns true 表示该边被"满足"，目标节点可继续推进
 */
function evaluateDependencyCondition(sourceNode: any, dep: any): boolean {
  const cond = (dep.condition_type as string) || "always";
  if (cond === "always") return true;
  if (cond === "on_skip") return sourceNode.status === "skipped";
  if (cond === "on_approve") {
    const out = (sourceNode.output_data as Record<string, unknown>) ?? {};
    return out.decision === "approved" || out.approved === true;
  }
  if (cond === "on_reject") {
    const out = (sourceNode.output_data as Record<string, unknown>) ?? {};
    return out.decision === "rejected" || out.approved === false;
  }
  return false;
}

/**
 * Run 调度器工厂。依赖 EventService 写事件、Executor 跑节点。
 */
export interface PipelineRunScheduler {
  processRun(runId: string): Promise<void>;
  finalizeRun(runId: string): Promise<void>;
  /** 等待内部所有 active run 任务结束（应用关闭时调用）。 */
  waitForIdle(): Promise<void>;
}

export function createPipelineRunScheduler(
  ctx: AppContext,
  deps: { recordEvent: RecordEventFn },
): PipelineRunScheduler {
  const { recordEvent } = deps;
  const executor = createNodeExecutor(ctx, { recordEvent } as NodeExecutorDeps);
  const activeRuns = new Map<string, Promise<void>>();

  function launchRun(runId: string): void {
    if (activeRuns.has(runId)) return;
    const task = processRun(runId)
      .catch((err) => {
        log.error(
          { event: "pipeline.run.process_error", runId, error: (err as Error).message },
          `Pipeline Run 执行失败: ${(err as Error).message}`,
        );
      })
      .finally(() => {
        activeRuns.delete(runId);
      });
    activeRuns.set(runId, task);
  }

  async function processRun(runId: string): Promise<void> {
    const run = await ctx.pipelineRuns.findById(runId);
    if (!run || run.status !== "running") return;

    const nodes = (await ctx.pipelineNodes.findMany({ run_id: runId } as any)) as any[];
    const dependencies = (await ctx.pipelineDependencies.findMany({ run_id: runId } as any)) as any[];

    const { validateDag } = await import("./pipeline-dag.js");
    const result = validateDag(nodes, dependencies);
    if (!result.valid) {
      await ctx.pipelineRuns.update(runId, {
        status: "failed",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        error: JSON.stringify(result.errors),
      } as any);
      log.error({ event: "pipeline.run.dag_invalid", runId, errors: result.errors }, `DAG 校验失败`);
      return;
    }

    if (nodes.length === 0) {
      await ctx.pipelineRuns.update(runId, {
        status: "completed",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any);
      log.info({ event: "pipeline.run.completed", runId }, `Pipeline Run 已完成（无节点）`);
      return;
    }

    await scheduleConcurrentRun(runId, nodes, dependencies, run);
  }

  async function scheduleConcurrentRun(
    runId: string,
    initialNodes: any[],
    dependencies: any[],
    run: any,
  ): Promise<void> {
    const runConfig = (run.workflow_config as Record<string, unknown>) ?? {};

    const nodeById = new Map<string, any>(initialNodes.map((n) => [n.id, n]));
    const running = new Map<string, Promise<void>>();

    const remainingDeps = new Map<string, number>();
    for (const n of initialNodes) remainingDeps.set(n.id, 0);
    for (const d of dependencies) {
      remainingDeps.set(d.target_node_id, (remainingDeps.get(d.target_node_id) ?? 0) + 1);
    }

    function onNodeDone(nodeId: string, _status: string): void {
      running.delete(nodeId);
      const sourceNode = nodeById.get(nodeId);
      for (const d of dependencies) {
        if (d.source_node_id !== nodeId) continue;
        if (sourceNode && !evaluateDependencyCondition(sourceNode, d)) {
          continue;
        }
        remainingDeps.set(
          d.target_node_id,
          (remainingDeps.get(d.target_node_id) ?? 1) - 1,
        );
      }
      void trySkipUnreachableDownstreams(nodeId);
    }

    function trySkipUnreachableDownstreams(sourceId: string): void {
      const targetIds = new Set<string>();
      for (const d of dependencies) {
        if (d.source_node_id === sourceId) targetIds.add(d.target_node_id);
      }
      for (const targetId of targetIds) {
        const target = nodeById.get(targetId);
        if (!target || target.status !== "pending") continue;
        const incoming = dependencies.filter((d: any) => d.target_node_id === targetId);
        if (incoming.length === 0) continue;
        let allSourcesTerminal = true;
        let allConditionsFailing = true;
        for (const dep of incoming) {
          const source = nodeById.get(dep.source_node_id);
          if (!source) {
            allSourcesTerminal = false;
            break;
          }
          if (source.status !== "completed" && source.status !== "failed" && source.status !== "skipped") {
            allSourcesTerminal = false;
            break;
          }
          if (evaluateDependencyCondition(source, dep)) {
            allConditionsFailing = false;
            break;
          }
        }
        if (allSourcesTerminal && allConditionsFailing) {
          const now = new Date().toISOString();
          ctx.pipelineNodes
            .update(targetId, {
              status: "skipped",
              completed_at: now,
              updated_at: now,
              error: "SKIPPED_BY_CONDITION: 所有入边条件都不满足",
            } as any)
            .catch((err: Error) => {
              log.error(
                { event: "pipeline.node.skip_condition_error", runId, nodeId: targetId, error: err.message },
                `条件 skip 失败`,
              );
            });
          nodeById.set(targetId, {
            ...target,
            status: "skipped",
            completed_at: now,
            updated_at: now,
            error: "SKIPPED_BY_CONDITION: 所有入边条件都不满足",
          });
          setTimeout(() => onNodeDone(targetId, "skipped"), 0);
        }
      }
    }

    function findReadyNodes(): any[] {
      const ready: any[] = [];
      for (const n of initialNodes) {
        if (running.has(n.id)) continue;
        if ((remainingDeps.get(n.id) ?? 0) > 0) continue;
        const latest = nodeById.get(n.id) ?? n;
        if (latest.status === "completed" || latest.status === "failed" || latest.status === "skipped") {
          continue;
        }
        ready.push(latest);
      }
      ready.sort((a, b) => {
        const pa = Number((a as any).priority ?? 1);
        const pb = Number((b as any).priority ?? 1);
        if (pa !== pb) return pb - pa;
        return String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""));
      });
      return ready;
    }

    for (const n of initialNodes) {
      if (n.status === "completed" || n.status === "failed" || n.status === "skipped") {
        onNodeDone(n.id, n.status);
      }
    }

    async function launchNode(node: any): Promise<void> {
      const type = String(node.type ?? "");
      const cfg = (node.config as Record<string, unknown>) ?? {};
      const max = getNodeMaxConcurrent(type, cfg, runConfig);

      const fresh = await ctx.pipelineNodes.findById(node.id);
      if (fresh) nodeById.set(node.id, fresh);

      let token: import("../horizontal/concurrency-tracker.js").ConcurrencyToken | null = null;
      try {
        token = await ctx.concurrencyTracker.acquire(type, max);
      } catch (err) {
        log.error(
          {
            event: "pipeline.node.concurrency_acquire_failed",
            runId,
            nodeId: node.id,
            type,
            error: (err as Error).message,
          },
          `并发槽位申请失败（fail-open 也失败）`,
        );
        const now = new Date().toISOString();
        await ctx.pipelineNodes.update(node.id, {
          status: "failed",
          completed_at: now,
          updated_at: now,
          error: `并发追踪器异常: ${(err as Error).message}`,
        } as any);
        onNodeDone(node.id, "failed");
        return;
      }

      try {
        await executor.executeNode(runId, node);
        const after = await ctx.pipelineNodes.findById(node.id);
        const finalStatus = after?.status ?? "failed";
        if (finalStatus === "completed" || finalStatus === "failed" || finalStatus === "skipped") {
          onNodeDone(node.id, finalStatus);
        } else {
          running.delete(node.id);
        }
      } catch (err) {
        log.error(
          {
            event: "pipeline.node.unexpected",
            runId,
            nodeId: node.id,
            type,
            error: (err as Error).message,
          },
          `节点执行抛出未捕获异常（应已被 executeNode catch）`,
        );
        onNodeDone(node.id, "failed");
      } finally {
        if (token) ctx.concurrencyTracker.release(token);
      }
    }

    while (true) {
      const runCheck = await ctx.pipelineRuns.findById(runId);
      if (runCheck?.status !== "running") {
        log.info(
          { event: "pipeline.run.stopped", runId, status: runCheck?.status },
          `Pipeline Run 已停止，终止调度`,
        );
        return;
      }

      for (const n of initialNodes) {
        const fresh = await ctx.pipelineNodes.findById(n.id);
        if (fresh) nodeById.set(n.id, fresh);
      }

      const ready = findReadyNodes();
      for (const n of ready) {
        const node = nodeById.get(n.id) ?? n;
        if (node.status === "paused") continue;
        if (node.status === "completed" || node.status === "failed" || node.status === "skipped") {
          onNodeDone(node.id, node.status);
          continue;
        }
        const p = launchNode(node);
        running.set(node.id, p);
      }

      if (running.size === 0) {
        const stillPending = findReadyNodes();
        if (stillPending.length === 0) break;
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        continue;
      }

      const promises = Array.from(running.values());
      try {
        await Promise.race(promises);
      } catch {
        // 每个 promise 已被 executeNode 内部消化
      }
    }

    log.info(
      { event: "pipeline.run.scheduler_exit", runId, totalNodes: initialNodes.length },
      `并发调度器退出`,
    );
    await finalizeRun(runId);
  }

  async function finalizeRun(runId: string): Promise<void> {
    const run = await ctx.pipelineRuns.findById(runId);
    const nodes = (await ctx.pipelineNodes.findMany({ run_id: runId } as any)) as any[];
    const failedNodes = nodes.filter((n) => n.status === "failed");
    const completedNodes = nodes.filter((n) => n.status === "completed");
    const doneNodes = nodes.filter(
      (n) => n.status === "completed" || n.status === "skipped",
    );
    const now = new Date().toISOString();
    const projectId = String(run?.project_id ?? "");

    if (failedNodes.length > 0) {
      await ctx.pipelineRuns.update(runId, {
        status: "failed",
        completed_at: now,
        updated_at: now,
        error: `${failedNodes.length} 个节点执行失败`,
      } as any);
      await recordEvent({
        runId,
        nodeId: "",
        projectId,
        type: "run_failed",
        payload: {
          completedAt: now,
          totalNodes: nodes.length,
          failedCount: failedNodes.length,
          completedCount: completedNodes.length,
          skippedCount: nodes.length - completedNodes.length - failedNodes.length,
          failedNodeIds: failedNodes.map((n) => n.id),
        },
      });
      log.error(
        { event: "pipeline.run.failed", runId, failedCount: failedNodes.length },
        `Pipeline Run 失败`,
      );
    } else if (doneNodes.length === nodes.length) {
      await ctx.pipelineRuns.update(runId, {
        status: "completed",
        completed_at: now,
        updated_at: now,
      } as any);
      const startedAt = String(run?.started_at ?? "");
      const durationMs = startedAt ? Date.parse(now) - Date.parse(startedAt) : null;
      await recordEvent({
        runId,
        nodeId: "",
        projectId,
        type: "run_completed",
        payload: {
          completedAt: now,
          totalNodes: nodes.length,
          skippedCount: nodes.length - completedNodes.length,
          durationMs,
        },
      });
      log.info(
        { event: "pipeline.run.completed", runId, completedCount: doneNodes.length },
        `Pipeline Run 完成`,
      );
    } else {
      await ctx.pipelineRuns.update(runId, {
        status: "failed",
        completed_at: now,
        updated_at: now,
        error: `${nodes.length - doneNodes.length} 个节点未执行`,
      } as any);
      await recordEvent({
        runId,
        nodeId: "",
        projectId,
        type: "run_failed",
        payload: {
          completedAt: now,
          totalNodes: nodes.length,
          completedCount: completedNodes.length,
          pendingOrRunningCount: nodes.length - doneNodes.length,
          reason: "partial_completion",
        },
      });
      log.warn(
        { event: "pipeline.run.partial", runId, completedCount: doneNodes.length, totalCount: nodes.length },
        `Pipeline Run 部分完成`,
      );
    }
  }

  return {
    processRun: (runId: string) => {
      // 暴露给主服务的"启动 Run"入口：与原 launchRun 行为一致（fire-and-forget + 注册到 activeRuns）
      launchRun(runId);
      return Promise.resolve();
    },
    finalizeRun,
    async waitForIdle() {
      while (activeRuns.size > 0) {
        await Promise.allSettled([...activeRuns.values()]);
      }
    },
  };
}
