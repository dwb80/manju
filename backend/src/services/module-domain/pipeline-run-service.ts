/**
 * @file pipeline-run-service.ts
 * @description MOD-PIPELINE 任务编排门面服务（REM-P1-006 拆分后）。
 *
 * ## 模块拆分（V2 架构治理 P1-006）
 *  - lifecycle / state machine  ——  本文件（public API：PipelineRunService）
 *  - 节点输入解析 + 业务执行   ——  pipeline-node-executor.ts
 *  - 并发调度器 + DAG 收尾     ——  pipeline-run-scheduler.ts
 *  - 事件流 + 裁剪            ——  pipeline-event-service.ts
 *  - 幂等键 + 稳定序列化       ——  pipeline-idempotency.ts
 *  - 计费预算                  ——  pipeline-budget.ts
 *  - 条件解析（DAG 边）        ——  pipeline-condition.ts
 *
 * ## 包含能力（公开 API，保持向后兼容）
 *  - CRUD：createRun / getRun / listRuns / getRunNodes / detectStaleRunningNodes
 *  - 状态机：startRun / pauseRun / resumeRun（隐式 finalizeRun 由调度器调）
 *  - 节点控制：pauseNode / resumeNode / skipNode / retryNode（REQ-PIPE-001-06，W5）
 *  - 批量：batchNodeAction / setNodePriority / batchCreateNodes
 *  - 事件流：recordEvent / listNodeEvents
 *  - 生命周期：waitForIdle
 *
 * ## 演进
 *  - W0：createRun / startRun / 拓扑执行
 *  - W1：pauseRun / resumeRun
 *  - W2：processRun 异步 + finalizeRun + 重试退避
 *  - W3：recordEvent / listNodeEvents
 *  - W4：detectStaleRunningNodes
 *  - W5：executeNode 幂等 + 超时 + 完整事件 + scheduleConcurrentRun
 *  - W6：pauseNode / resumeNode / skipNode
 *  - W10：错误恢复决策树（classifyError / 熔断 / 降级 / DLQ）
 *  - W11：TASK-F11/F16/F17/F18 节点任务管理增强
 *  - V2.1 P1-006：拆分为多文件，主服务仅作 lifecycle 编排
 */
import type { AppContext } from "../app.js";
import { rootLogger } from "../../logger.js";
import { validateDag } from "./pipeline-dag.js";
import type { PipelineEvent, PipelineEventType, PipelineNodePriority } from "../../types/pipeline.js";
import { PIPELINE_NODE_PRIORITY, DEFAULT_PIPELINE_NODE_PRIORITY } from "../../types/pipeline.js";
import { assertBudgetCapacityForNodes } from "./pipeline-budget.js";
import { createPipelineEventService } from "./pipeline-event-service.js";
import { createPipelineRunScheduler } from "./pipeline-run-scheduler.js";
import { computeNodeIdempotencyKey } from "./pipeline-idempotency.js";
export { computeNodeIdempotencyKey } from "./pipeline-idempotency.js";

const log = rootLogger.child({ module: "pipeline-run-service" });

/* ============================================================== */
/* 节点优先级归一化（TASK-F16）                                  */
/* ============================================================== */
export function normalizeNodePriority(input: unknown): PipelineNodePriority {
  if (input === null || input === undefined) return DEFAULT_PIPELINE_NODE_PRIORITY;
  if (typeof input === "number") {
    if (!Number.isFinite(input)) return DEFAULT_PIPELINE_NODE_PRIORITY;
    const n = Math.max(0, Math.min(3, Math.floor(input)));
    return n as PipelineNodePriority;
  }
  if (typeof input === "string") {
    const k = input.trim().toLowerCase();
    if (k === "low") return PIPELINE_NODE_PRIORITY.low;
    if (k === "normal" || k === "") return PIPELINE_NODE_PRIORITY.normal;
    if (k === "high") return PIPELINE_NODE_PRIORITY.high;
    if (k === "urgent") return PIPELINE_NODE_PRIORITY.urgent;
    const n = Number(k);
    if (Number.isFinite(n)) return normalizeNodePriority(n);
    return DEFAULT_PIPELINE_NODE_PRIORITY;
  }
  return DEFAULT_PIPELINE_NODE_PRIORITY;
}

/* ============================================================== */
/* Public Service 工厂                                          */
/* ============================================================== */
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
  batchNodeAction(runId: string, nodeIds: string[], action: "pause" | "resume" | "skip" | "retry"): Promise<{
    runId: string;
    action: "pause" | "resume" | "skip" | "retry";
    total: number;
    succeeded: string[];
    failed: Array<{ nodeId: string; error: string }>;
  }>;
  setNodePriority(runId: string, nodeId: string, priority: number | "low" | "normal" | "high" | "urgent"): Promise<void>;
  batchCreateNodes(runId: string, nodes: unknown[]): Promise<{ runId: string; added: string[]; failed: Array<{ index: number; error: string }>; }>;
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

export function createPipelineRunService(ctx: AppContext): PipelineRunService {
  const eventService = createPipelineEventService(ctx);
  const scheduler = createPipelineRunScheduler(ctx, { recordEvent: eventService.recordEvent });

  return {
    /* ---------------- CRUD ---------------- */
    async createRun(projectId, name, nodes, dependencies) {
      const convertedNodes = nodes.map((n: any) => ({
        id: n.id,
        type: n.type,
        name: n.name ?? "",
        status: "pending" as const,
        config: typeof n.config === "object" ? n.config : {},
        input_data: typeof n.input_data === "object" ? n.input_data : {},
        output_data: {},
        error: "",
        retry_count: 0,
        started_at: "",
        completed_at: "",
        created_at: "",
        updated_at: "",
        run_id: "",
        project_id: projectId,
        idempotency_key: "",
        priority: normalizeNodePriority(n.priority),
      }));
      const { isValidCondition } = await import("./pipeline-condition.js");
      const convertedDependencies = (dependencies as any[]).map((d) => {
        const rawCondType = d.condition_type as string | undefined;
        const condType = (
          rawCondType === "always" || rawCondType === "on_approve" || rawCondType === "on_reject" || rawCondType === "on_skip"
            ? rawCondType
            : "always"
        );
        let condition: unknown = null;
        if (d.condition !== undefined && d.condition !== null) {
          condition = isValidCondition(d.condition) ? d.condition : null;
        } else if (rawCondType === "expression" && typeof d.condition_expr === "string" && d.condition_expr.length > 0) {
          try {
            const parsed = JSON.parse(d.condition_expr);
            condition = isValidCondition(parsed) ? parsed : null;
          } catch {
            condition = null;
          }
        }
        return {
          id: `${d.from}_${d.to}`,
          run_id: "",
          source_node_id: d.from,
          target_node_id: d.to,
          created_at: "",
          condition_type: condType,
          condition_expr: typeof d.condition_expr === "string" ? d.condition_expr : "",
          condition,
        };
      });
      const result = validateDag(convertedNodes as any, convertedDependencies as any);
      if (!result.valid) {
        return { runId: "", valid: false, errors: result.errors };
      }
      await assertBudgetCapacityForNodes(ctx, projectId, nodes);
      const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const now = new Date().toISOString();
      await ctx.pipelineRuns.insert({
        id: runId,
        project_id: projectId,
        name,
        status: "pending",
        workflow_config: {},
        start_node_id: "",
        current_node_id: "",
        error: "",
        started_at: "",
        completed_at: "",
        created_at: now,
        updated_at: now,
      } as any);
      for (const n of nodes as any[]) {
        await ctx.pipelineNodes.insert({
          id: n.id,
          run_id: runId,
          project_id: projectId,
          type: n.type,
          name: n.name ?? "",
          status: "pending",
          config: typeof n.config === "object" ? n.config : {},
          input_data: typeof n.input_data === "object" ? n.input_data : {},
          output_data: {},
          error: "",
          retry_count: 0,
          started_at: "",
          completed_at: "",
          created_at: now,
          updated_at: now,
          idempotency_key: computeNodeIdempotencyKey({
            type: n.type,
            project_id: projectId,
            input_data: typeof n.input_data === "object" ? n.input_data : {},
            config: typeof n.config === "object" ? n.config : {},
          }),
          priority: normalizeNodePriority(n.priority),
        } as any);
      }
      for (const d of dependencies as any[]) {
        const normalized = convertedDependencies.find(
          (cd) => cd.source_node_id === d.from && cd.target_node_id === d.to,
        );
        await ctx.pipelineDependencies.insert({
          id: `${d.from}_${d.to}`,
          run_id: runId,
          source_node_id: d.from,
          target_node_id: d.to,
          created_at: now,
          condition_type: normalized?.condition_type ?? "always",
          condition_expr: typeof d.condition_expr === "string" ? d.condition_expr : "",
          condition: normalized?.condition ?? null,
        } as any);
      }
      // V2.1 P1-008：跨模块事件 Outbox 派发。Run 创建 + 节点 + 依赖都已 commit 后再 enqueue，
      // 订阅方（监控/统计/通知）会异步消费。
      try {
        await ctx.transactionService.enqueueOutboxEvent({
          topic: "run.lifecycle.created",
          payload: {
            runId,
            projectId,
            runName: name,
            nodeCount: nodes.length,
            dependencyCount: dependencies.length,
            createdBy: "pipeline-run-service.createRun",
          },
          source: "pipeline-run-service",
          maxAttempts: 5,
        });
      } catch (outboxErr) {
        // Outbox 失败不阻塞主流程（业务已成功落库，事件可重放）
        log.warn(
          { event: "pipeline.run.outbox_failed", runId, error: (outboxErr as Error).message },
          `run.lifecycle.created 事件入 Outbox 失败（不影响主流程）`,
        );
      }
      log.info(
        { event: "pipeline.run.created", runId, projectId, nodeCount: nodes.length },
        `Pipeline Run 创建成功`,
      );
      return { runId, valid: true };
    },

    async startRun(runId) {
      const run = await ctx.pipelineRuns.findById(runId);
      if (!run) throw new Error(`run_not_found: ${runId}`);
      if (run.status === "running") throw new Error("run_already_running");
      const startedAt = new Date().toISOString();
      await ctx.pipelineRuns.update(runId, {
        status: "running",
        started_at: startedAt,
        updated_at: startedAt,
      } as any);
      await eventService.recordEvent({
        runId,
        nodeId: "",
        projectId: String(run.project_id ?? ""),
        type: "run_started",
        payload: { startedAt, runName: run.name },
      });
      scheduler.processRun(runId);
    },

    async pauseRun(runId) {
      const run = await ctx.pipelineRuns.findById(runId);
      if (!run) throw new Error(`run_not_found: ${runId}`);
      if (run.status !== "running") throw new Error("run_not_running");
      const pausedAt = new Date().toISOString();
      await ctx.pipelineRuns.update(runId, {
        status: "paused",
        updated_at: pausedAt,
      } as any);
      await eventService.recordEvent({
        runId,
        nodeId: "",
        projectId: String(run.project_id ?? ""),
        type: "run_paused",
        payload: { pausedAt },
      });
      log.info({ event: "pipeline.run.paused", runId }, `Pipeline Run 已暂停`);
    },

    async resumeRun(runId) {
      const run = await ctx.pipelineRuns.findById(runId);
      if (!run) throw new Error(`run_not_found: ${runId}`);
      if (run.status !== "paused") throw new Error("run_not_paused");
      const resumedAt = new Date().toISOString();
      await ctx.pipelineRuns.update(runId, {
        status: "running",
        updated_at: resumedAt,
      } as any);
      await eventService.recordEvent({
        runId,
        nodeId: "",
        projectId: String(run.project_id ?? ""),
        type: "run_resumed",
        payload: { resumedAt },
      });
      scheduler.processRun(runId);
    },

    /* ---------------- 节点启停控制（REQ-PIPE-001-06，W5） ---------------- */
    async pauseNode(runId, nodeId) {
      const run = await ctx.pipelineRuns.findById(runId);
      if (!run) throw new Error(`run_not_found: ${runId}`);
      const node = await ctx.pipelineNodes.findById(nodeId);
      if (!node) throw new Error(`node_not_found: ${nodeId}`);
      if (node.run_id !== runId) throw new Error("node_not_in_run");
      if (node.status === "completed" || node.status === "failed" || node.status === "skipped") {
        throw new Error(`node_terminal: cannot pause ${node.status} node`);
      }
      if (node.status === "running") {
        throw new Error("node_running: cannot pause running node（V2.1 支持 cancel）");
      }
      if (node.status === "paused") {
        return;
      }
      const now = new Date().toISOString();
      await ctx.pipelineNodes.update(nodeId, { status: "paused", updated_at: now } as any);
      await eventService.recordEvent({
        runId,
        nodeId,
        projectId: String(run.project_id ?? ""),
        type: "node_paused",
        payload: { pausedAt: now, previousStatus: node.status },
      });
      log.info({ event: "pipeline.node.paused", runId, nodeId }, `节点已暂停`);
    },

    async resumeNode(runId, nodeId) {
      const run = await ctx.pipelineRuns.findById(runId);
      if (!run) throw new Error(`run_not_found: ${runId}`);
      const node = await ctx.pipelineNodes.findById(nodeId);
      if (!node) throw new Error(`node_not_found: ${nodeId}`);
      if (node.run_id !== runId) throw new Error("node_not_in_run");
      if (node.status !== "paused") {
        throw new Error(`node_not_paused: current=${node.status}`);
      }
      const now = new Date().toISOString();
      await ctx.pipelineNodes.update(nodeId, { status: "pending", updated_at: now } as any);
      await eventService.recordEvent({
        runId,
        nodeId,
        projectId: String(run.project_id ?? ""),
        type: "node_resumed",
        payload: { resumedAt: now },
      });
      log.info({ event: "pipeline.node.resumed", runId, nodeId }, `节点已恢复`);
    },

    async skipNode(runId, nodeId) {
      const run = await ctx.pipelineRuns.findById(runId);
      if (!run) throw new Error(`run_not_found: ${runId}`);
      const node = await ctx.pipelineNodes.findById(nodeId);
      if (!node) throw new Error(`node_not_found: ${nodeId}`);
      if (node.run_id !== runId) throw new Error("node_not_in_run");
      if (node.status === "running") {
        throw new Error("node_running: cannot skip running node");
      }
      if (node.status === "completed" || node.status === "failed" || node.status === "skipped") {
        throw new Error(`node_terminal: cannot skip ${node.status} node`);
      }
      const now = new Date().toISOString();
      await ctx.pipelineNodes.update(nodeId, {
        status: "skipped",
        completed_at: now,
        updated_at: now,
      } as any);
      await eventService.recordEvent({
        runId,
        nodeId,
        projectId: String(run.project_id ?? ""),
        type: "node_skipped",
        payload: { skippedAt: now, previousStatus: node.status },
      });
      log.info({ event: "pipeline.node.skipped", runId, nodeId }, `节点已跳过`);
    },

    async retryNode(runId, nodeId) {
      const run = await ctx.pipelineRuns.findById(runId);
      if (!run) throw new Error(`run_not_found: ${runId}`);
      const node = await ctx.pipelineNodes.findById(nodeId);
      if (!node) throw new Error(`node_not_found: ${nodeId}`);
      if (node.run_id !== runId) throw new Error("node_not_in_run");
      if (node.status === "running") throw new Error("node_running: cannot retry running node");
      if (node.status !== "failed") {
        throw new Error(`node_not_failed: cannot retry node in status=${node.status}（仅 failed 可重试）`);
      }
      const now = new Date().toISOString();
      await ctx.pipelineNodes.update(nodeId, {
        status: "pending",
        error: "",
        completed_at: "",
        retry_count: 0,
        updated_at: now,
      } as any);
      if (run.status === "failed") {
        await ctx.pipelineRuns.update(runId, {
          status: "running",
          completed_at: "",
          updated_at: now,
        } as any);
        await eventService.recordEvent({
          runId,
          nodeId: "",
          projectId: String(run.project_id ?? ""),
          type: "run_resumed",
          payload: { resumedAt: now, reason: "node_retry" },
        });
      }
      await eventService.recordEvent({
        runId,
        nodeId,
        projectId: String(run.project_id ?? ""),
        type: "node_retried",
        payload: { retriedAt: now, previousError: String(node.error ?? ""), previousRetryCount: Number(node.retry_count ?? 0) },
      });
      log.info({ event: "pipeline.node.retried", runId, nodeId }, `节点已人工重试`);
    },

    async batchNodeAction(runId, nodeIds, action) {
      if (!Array.isArray(nodeIds) || nodeIds.length === 0) {
        throw new Error("node_ids_required: 必须传至少 1 个 nodeId");
      }
      if (nodeIds.length > 100) {
        throw new Error("batch_too_large: 单次最多 100 个节点");
      }
      if (!["pause", "resume", "skip", "retry"].includes(action)) {
        throw new Error(`unsupported_action: ${action}（仅 pause/resume/skip/retry）`);
      }
      const run = await ctx.pipelineRuns.findById(runId);
      if (!run) throw new Error(`run_not_found: ${runId}`);
      const succeeded: string[] = [];
      const failed: Array<{ nodeId: string; error: string }> = [];
      for (const nid of nodeIds) {
        try {
          if (action === "pause") await this.pauseNode(runId, nid);
          else if (action === "resume") await this.resumeNode(runId, nid);
          else if (action === "skip") await this.skipNode(runId, nid);
          else if (action === "retry") await this.retryNode(runId, nid);
          succeeded.push(nid);
        } catch (e) {
          failed.push({ nodeId: nid, error: (e as Error).message });
        }
      }
      return { runId, action, total: nodeIds.length, succeeded, failed };
    },

    async setNodePriority(runId, nodeId, priority) {
      const run = await ctx.pipelineRuns.findById(runId);
      if (!run) throw new Error(`run_not_found: ${runId}`);
      const node = await ctx.pipelineNodes.findById(nodeId);
      if (!node) throw new Error(`node_not_found: ${nodeId}`);
      if (node.run_id !== runId) throw new Error("node_not_in_run");
      if (node.status === "completed" || node.status === "failed" || node.status === "skipped") {
        throw new Error(`node_terminal: cannot change priority of ${node.status} node`);
      }
      const newPriority = normalizeNodePriority(priority);
      const oldPriority = normalizeNodePriority((node as any).priority);
      if (newPriority === oldPriority) return;
      const now = new Date().toISOString();
      await ctx.pipelineNodes.update(nodeId, {
        priority: newPriority,
        updated_at: now,
      } as any);
      await eventService.recordEvent({
        runId,
        nodeId,
        projectId: String(run.project_id ?? ""),
        type: "node_priority_changed",
        payload: { oldPriority, newPriority, changedAt: now },
      });
      log.info({ event: "pipeline.node.priority_changed", runId, nodeId, oldPriority, newPriority }, `节点优先级变更`);
    },

    async batchCreateNodes(runId, nodes) {
      if (!Array.isArray(nodes) || nodes.length === 0) {
        throw new Error("nodes_required: 必须传至少 1 个 node");
      }
      if (nodes.length > 100) {
        throw new Error("batch_too_large: 单次最多 100 个节点");
      }
      const run = await ctx.pipelineRuns.findById(runId);
      if (!run) throw new Error(`run_not_found: ${runId}`);
      if (run.status === "completed" || run.status === "failed") {
        throw new Error(`run_terminal: cannot add nodes to ${run.status} run`);
      }
      const projectId = String(run.project_id ?? "");
      await assertBudgetCapacityForNodes(ctx, projectId, nodes);
      const added: string[] = [];
      const failed: Array<{ index: number; error: string }> = [];
      const now = new Date().toISOString();
      for (let i = 0; i < nodes.length; i++) {
        const n: any = nodes[i];
        try {
          if (!n || !n.type) throw new Error("node.type 必填");
          const nodeId = n.id && String(n.id).length > 0 ? String(n.id) : `node-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`;
          const cfg = typeof n.config === "object" && n.config !== null ? n.config : {};
          const inp = typeof n.input_data === "object" && n.input_data !== null ? n.input_data : {};
          const idempKey = typeof n.idempotency_key === "string" && n.idempotency_key.length > 0
            ? n.idempotency_key
            : computeNodeIdempotencyKey({ type: n.type, project_id: projectId, input_data: inp, config: cfg });
          await ctx.pipelineNodes.insert({
            id: nodeId,
            run_id: runId,
            project_id: projectId,
            type: n.type,
            name: n.name ?? "",
            status: "pending",
            config: cfg,
            input_data: inp,
            output_data: {},
            error: "",
            retry_count: 0,
            started_at: "",
            completed_at: "",
            created_at: now,
            updated_at: now,
            idempotency_key: idempKey,
            priority: normalizeNodePriority(n.priority),
          } as any);
          added.push(nodeId);
        } catch (e) {
          failed.push({ index: i, error: (e as Error).message });
        }
      }
      await eventService.recordEvent({
        runId,
        nodeId: "",
        projectId,
        type: "nodes_batch_added",
        payload: { added: added.length, failed: failed.length, at: now },
      });
      log.info({ event: "pipeline.nodes.batch_added", runId, added: added.length, failed: failed.length }, `批量新增节点`);
      return { runId, added, failed };
    },

    async getRun(runId) {
      const run = await ctx.pipelineRuns.findById(runId);
      if (!run) return null;
      const nodes = await ctx.pipelineNodes.findMany({ run_id: runId } as any);
      const dependencies = await ctx.pipelineDependencies.findMany({ run_id: runId } as any);
      return { ...run, nodes, dependencies };
    },

    async listRuns(projectId) {
      const filter = projectId ? ({ project_id: projectId } as any) : undefined;
      const runs = await ctx.pipelineRuns.findMany(filter);
      const result: any[] = [];
      for (const run of runs as any[]) {
        const nodeCount = await ctx.pipelineNodes.count({ run_id: run.id } as any);
        const completedCount = await ctx.pipelineNodes.count({
          run_id: run.id,
          status: "completed",
        } as any);
        result.push({
          ...run,
          nodeCount,
          completedCount,
          progress: nodeCount > 0 ? Math.round((completedCount / nodeCount) * 100) : 0,
        });
      }
      return result;
    },

    async getRunNodes(runId) {
      return ctx.pipelineNodes.findMany({ run_id: runId } as any);
    },

    async detectStaleRunningNodes(options) {
      const graceSeconds = options?.graceSeconds ?? 60;
      const now = Date.now();
      const cleanedNodeIds: string[] = [];
      const cleanedRunIds: string[] = [];
      const allNodes = (await ctx.pipelineNodes.findMany({ status: "running" } as any)) as any[];

      // Lazy-import to avoid circular deps; executor holds getNodeTimeout
      const { getNodeTimeout } = await import("./pipeline-node-executor.js");

      for (const node of allNodes) {
        if (!node.started_at) continue;
        const startedMs = Date.parse(node.started_at);
        if (!Number.isFinite(startedMs)) continue;
        const config = node.config ?? {};
        const timeoutSec = getNodeTimeout(String(node.type ?? ""), config);
        const deadline = startedMs + (timeoutSec + graceSeconds) * 1000;
        if (now <= deadline) continue;
        const errMsg = `STALE_RUNNING_DETECTED: 节点已 running 超过 ${timeoutSec + graceSeconds}s（started_at=${node.started_at}），强制收尾`;
        const updatedAt = new Date().toISOString();
        await ctx.pipelineNodes.update(node.id, {
          status: "failed",
          completed_at: updatedAt,
          updated_at: updatedAt,
          error: errMsg,
        } as any);
        cleanedNodeIds.push(node.id);
        await eventService.recordEvent({
          runId: String(node.run_id ?? ""),
          nodeId: node.id,
          projectId: String(node.project_id ?? ""),
          type: "node_stale_running",
          payload: {
            nodeType: node.type,
            startedAt: node.started_at,
            timeoutSec,
            graceSec: graceSeconds,
            error: errMsg,
          },
        });
        log.warn(
          {
            event: "pipeline.node.stale_running",
            runId: node.run_id,
            nodeId: node.id,
            nodeType: node.type,
            startedAt: node.started_at,
            timeoutSec,
            graceSec: graceSeconds,
          },
          `检测到 stale running 节点，强制收尾`,
        );
      }

      const affectedRunIds = new Set(
        allNodes
          .filter((n) => cleanedNodeIds.includes(n.id))
          .map((n) => n.run_id)
          .filter(Boolean),
      );
      for (const runId of affectedRunIds) {
        const run = await ctx.pipelineRuns.findById(runId);
        if (!run || run.status !== "running") continue;
        const runNodes = (await ctx.pipelineNodes.findMany({ run_id: runId } as any)) as any[];
        const failedCount = runNodes.filter((n) => n.status === "failed").length;
        const completedCount = runNodes.filter((n) => n.status === "completed").length;
        const total = runNodes.length;
        if (total > 0 && failedCount === total) {
          await ctx.pipelineRuns.update(runId, {
            status: "failed",
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            error: `Run 内 ${failedCount} 个节点全部失败（包含 stale running 清理）`,
          } as any);
          cleanedRunIds.push(runId);
          log.warn(
            { event: "pipeline.run.stale_failed", runId, failedCount },
            "Run 因 stale running 节点全部失败，标记 failed",
          );
          continue;
        }
        const pendingCount = runNodes.filter((n) => n.status === "pending").length;
        if (pendingCount > 0) {
          await ctx.pipelineRuns.update(runId, {
            status: "pending",
            updated_at: new Date().toISOString(),
            error: `检测到 stale running 节点 ${cleanedNodeIds.filter((id) => {
              const n = runNodes.find((x) => x.id === id);
              return n?.run_id === runId;
            }).length} 个，Run 已切回 pending 待人工恢复`,
          } as any);
          cleanedRunIds.push(runId);
          log.warn(
            { event: "pipeline.run.stale_to_pending", runId, pendingCount, failedCount },
            "Run 因 stale running 节点切回 pending",
          );
        }
      }
      return { cleanedNodeIds, cleanedRunIds };
    },

    /* ---------------- 事件流（REQ-PIPE-003-03） ---------------- */
    recordEvent: eventService.recordEvent,
    listNodeEvents: eventService.listNodeEvents,

    waitForIdle: scheduler.waitForIdle,
  };
}
