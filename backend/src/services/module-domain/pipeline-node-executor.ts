/**
 * @file pipeline-node-executor.ts
 * @description Pipeline 节点执行器（REM-P1-006 拆分自原 pipeline-run-service.ts）。
 *
 * 拆分后该模块只关注：
 *  - 节点超时（AbortController + timeout_ms 配置）
 *  - 幂等命中（同 project + idempotency_key 的历史 completed 节点）
 *  - 业务逻辑分发（runNodeLogic：image / video / tts / composition / render / wait / review 等）
 *  - 错误恢复决策树（classifyError → 熔断 → 不可重试 → 模型降级 → 常规重试 → DLQ）
 *  - 节点完成前的同步质量门禁（block 模式必须 fail closed）
 *
 * 关键不变量（验收门禁）：
 *  - executeNode 中抛 QUALITY_GATE_BLOCKED → 节点不得标 completed（fail-closed 阻断）
 *  - 业务占位节点（image_generation / video_generation / tts / webhook / composition / render）
 *    必须显式抛 node_executor_not_configured 错误；禁止返回空对象/空字符串
 *  - review 节点必须要求 default_decision 显式传入；缺省抛 review_decision_required
 *  - composition / render 节点必须先调 compositionService.preRenderCheck 再 throw
 */
import type { AppContext } from "../app.js";
import { rootLogger } from "../../logger.js";
import {
  classifyError, isRetryable, isFallbackEligible,
  getFallbackChain, pickNextModel,
  circuitBreakerRegistry,
  recordDeadLetter,
} from "./error-recovery.js";
import type {
  ErrorCategory,
  PipelineEvent,
  PipelineEventType,
} from "../../types/pipeline.js";
import { computeNodeIdempotencyKey } from "./pipeline-idempotency.js";
import { assertBudgetCapacityForNodes } from "./pipeline-budget.js";

const log = rootLogger.child({ module: "pipeline-node-executor" });

/** 默认节点超时（秒）。 */
const NODE_TIMEOUT_DEFAULTS: Record<string, number> = {
  image_generation: 60,
  generate_image: 60,
  video_generation: 900,
  generate_video: 900,
  tts: 30,
  composition: 120,
  compose: 120,
  render: 1800,
  quality_check: 60,
  qa: 60,
  review: 300,
  notification: 30,
  notify: 30,
  wait: 3600,
  delay: 3600,
  webhook: 30,
};

export function getNodeTimeout(nodeType: string, config: Record<string, unknown>): number {
  if (
    config.timeout_seconds &&
    typeof config.timeout_seconds === "number" &&
    config.timeout_seconds > 0
  ) {
    return config.timeout_seconds;
  }
  return NODE_TIMEOUT_DEFAULTS[nodeType] ?? 600;
}

/** 全局默认熔断器配置（V2 W10 REQ-PIPE-006-04）。 */
const CB_DEFAULT_THRESHOLD = Number(process.env.PIPELINE_CB_THRESHOLD ?? 5);
const CB_DEFAULT_OPEN_MS = Number(process.env.PIPELINE_CB_OPEN_MS ?? 30000);
const CB_ENABLED = String(process.env.PIPELINE_CB_ENABLED ?? "true").toLowerCase() !== "false";

/** 节流常量：常规重试最大次数（指数退避）。 */
const MAX_REGULAR_RETRIES = 3;

/** AbortError 类型标签，供错误分类识别。 */
export class NodeAbortedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NodeAbortedError";
  }
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new NodeAbortedError(signal.reason ?? "aborted");
  }
}

function abortToPromise(controller: AbortController): Promise<never> {
  return new Promise((_, reject) => {
    if (controller.signal.aborted) {
      reject(controller.signal.reason ?? new NodeAbortedError("aborted"));
      return;
    }
    controller.signal.addEventListener(
      "abort",
      () => reject(controller.signal.reason ?? new NodeAbortedError("aborted")),
      { once: true },
    );
  });
}

/* 事件记录回调签名。调度器 / 主服务可注入不同实现。 */
export type RecordEventFn = (input: {
  runId: string;
  nodeId: string;
  projectId: string;
  type: PipelineEventType;
  payload: Record<string, unknown>;
}) => Promise<PipelineEvent | null>;

/** 执行器依赖（REM-P1-006 拆分后以依赖注入方式装配）。 */
export interface NodeExecutorDeps {
  recordEvent: RecordEventFn;
}

/* ============================================================== */
/* 节点输入解析                                                  */
/* ============================================================== */
async function resolveNodeInputs(
  ctx: AppContext,
  runId: string,
  node: any,
): Promise<Record<string, unknown>> {
  const inputs = node.input_data ?? {};
  const resolved: Record<string, unknown> = { ...(node.config ?? {}) };
  if (Object.keys(inputs).length === 0) return resolved;

  const dependencies = (await ctx.pipelineDependencies.findMany({ run_id: runId } as any)) as any[];
  const upstreamNodes = (await ctx.pipelineNodes.findMany({ run_id: runId } as any)) as any[];

  for (const [field, mapping] of Object.entries(inputs)) {
    const mappingStr = String(mapping);
    const parts = mappingStr.split(".");
    if (parts.length >= 2) {
      const upstreamId = parts[0];
      const outputField = parts.slice(1).join(".");
      const upstream = upstreamNodes.find((n) => n.id === upstreamId || n.node_key === upstreamId);
      if (upstream && upstream.output_data) {
        const value = outputField.split(".").reduce(
          (obj: any, key) => obj?.[key],
          upstream.output_data,
        );
        if (value !== undefined) {
          resolved[field] = value;
        } else {
          log.warn(
            { event: "pipeline.input.unresolved", runId, nodeId: node.id, field, mapping: mappingStr },
            `上游节点无输出字段`,
          );
        }
      } else {
        log.warn(
          { event: "pipeline.input.upstream_not_found", runId, nodeId: node.id, field, upstreamId },
          `上游节点未找到`,
        );
      }
    } else {
      resolved[field] = mapping;
    }
  }
  return resolved;
}

/* ============================================================== */
/* 节点业务逻辑（按类型分发；占位实现）                          */
/* ============================================================== */
async function runNodeLogic(
  ctx: AppContext,
  runId: string,
  node: any,
  config: Record<string, unknown>,
  _now: string,
  signal: AbortSignal,
): Promise<Record<string, unknown>> {
  throwIfAborted(signal);
  const nodeType = String(node.type ?? "");
  const output: Record<string, unknown> = {
    node_id: node.id,
    node_type: nodeType,
    executed_at: new Date().toISOString(),
  };

  switch (nodeType) {
    case "wait":
    case "delay": {
      const duration = Number(config.duration_ms ?? config.duration ?? 0);
      if (duration > 0) {
        const stepMs = 200;
        let waited = 0;
        while (waited < duration) {
          throwIfAborted(signal);
          const slice = Math.min(stepMs, duration - waited);
          await new Promise((resolve) => setTimeout(resolve, slice));
          waited += slice;
        }
        output.waited_ms = duration;
      }
      break;
    }
    case "image_generation":
    case "generate_image": {
      throw new Error("node_executor_not_configured: image_generation");
    }
    case "video_generation":
    case "generate_video": {
      throw new Error("node_executor_not_configured: video_generation");
    }
    case "tts": {
      throw new Error("node_executor_not_configured: tts");
    }
    case "composition":
    case "compose": {
      const shots = Array.isArray(config.shots) ? config.shots : [];
      const check = await ctx.compositionService.preRenderCheck({
        projectId: String(node.project_id ?? ""),
        shots,
        checkBudget: true,
        presetKey: typeof config.preset_key === "string" ? config.preset_key : undefined,
      });
      if (!check.ok) {
        throw new Error(`composition_precheck_failed: ${check.reasons.map((reason) => reason.code).join(",")}`);
      }
      throw new Error("node_executor_not_configured: composition");
    }
    case "render": {
      const shots = Array.isArray(config.shots) ? config.shots : [];
      const check = await ctx.compositionService.preRenderCheck({
        projectId: String(node.project_id ?? ""),
        shots,
        checkBudget: true,
        presetKey: typeof config.preset_key === "string" ? config.preset_key : undefined,
      });
      if (!check.ok) {
        throw new Error(`render_precheck_failed: ${check.reasons.map((reason) => reason.code).join(",")}`);
      }
      throw new Error("node_executor_not_configured: render");
    }
    case "webhook": {
      throw new Error("node_executor_not_configured: webhook");
    }
    case "review": {
      // 只有调用方明确提供测试/自动审批决策时才允许继续，禁止缺省"假通过"。
      if (config.default_decision !== "approved" && config.default_decision !== "rejected") {
        throw new Error("review_decision_required: default_decision must be explicitly approved or rejected");
      }
      const defaultDecision = config.default_decision;
      const reviewer = typeof config.reviewer === "string" ? config.reviewer : "system";
      const reason = typeof config.reason === "string" ? config.reason : "explicit pipeline decision";
      log.info(
        {
          event: "pipeline.node.review.placeholder",
          runId,
          nodeId: node.id,
          defaultDecision,
          reviewer,
        },
        "review 节点使用显式决策",
      );
      output.decision = defaultDecision;
      output.approved = defaultDecision === "approved";
      output.reviewer = reviewer;
      output.reason = reason;
      output.reviewed_at = new Date().toISOString();
      break;
    }
    default: {
      throw new Error(`unknown_node_type: ${nodeType}`);
    }
  }
  throwIfAborted(signal);
  return output;
}

/* ============================================================== */
/* 幂等命中查找                                                  */
/* ============================================================== */
async function findIdempotentHit(
  ctx: AppContext,
  projectId: string,
  idempotencyKey: string,
  currentNodeId: string,
): Promise<Record<string, unknown> | null> {
  if (!idempotencyKey) return null;
  const candidates = (await ctx.pipelineNodes.findMany({
    project_id: projectId,
    idempotency_key: idempotencyKey,
  } as any)) as any[];
  for (const c of candidates) {
    if (c.id === currentNodeId) continue;
    if (c.status !== "completed") continue;
    if (!c.output_data || Object.keys(c.output_data).length === 0) continue;
    return c.output_data;
  }
  return null;
}

/* ============================================================== */
/* 构造执行器（暴露 executeNode / runNodeLogic 给调度器调用）    */
/* ============================================================== */
export interface PipelineNodeExecutor {
  executeNode(runId: string, node: any): Promise<void>;
  runNodeLogic(
    runId: string,
    node: any,
    config: Record<string, unknown>,
    now: string,
    signal: AbortSignal,
  ): Promise<Record<string, unknown>>;
}

export function createNodeExecutor(ctx: AppContext, deps: NodeExecutorDeps): PipelineNodeExecutor {
  const { recordEvent } = deps;

  return {
    async executeNode(runId, node) {
      // 已完成 / 跳过的节点直接 return
      if (node.status === "completed" || node.status === "skipped") return;

      const projectId = String(node.project_id ?? "");
      const idempotencyKey = String(node.idempotency_key ?? "");

      // 1) 幂等命中：复用历史 output
      if (idempotencyKey) {
        const hit = await findIdempotentHit(ctx, projectId, idempotencyKey, String(node.id));
        if (hit) {
          const now = new Date().toISOString();
          await ctx.pipelineNodes.update(node.id, {
            status: "completed",
            completed_at: now,
            updated_at: now,
            output_data: { ...hit, idempotent_reused_from: true },
          } as any);
          await recordEvent({
            runId,
            nodeId: node.id,
            projectId,
            type: "node_idempotent_hit",
            payload: {
              nodeType: node.type,
              idempotencyKey,
              reusedOutputKeys: Object.keys(hit),
            },
          });
          log.info(
            {
              event: "pipeline.node.idempotent_hit",
              runId,
              nodeId: node.id,
              nodeType: node.type,
              idempotencyKey,
            },
            `节点幂等命中，复用历史结果`,
          );
          return;
        }
      }

      // 2) 标 running + 写 started 事件
      const now = new Date().toISOString();
      await ctx.pipelineNodes.update(node.id, {
        status: "running",
        started_at: now,
        updated_at: now,
      } as any);
      await recordEvent({
        runId,
        nodeId: node.id,
        projectId,
        type: "node_started",
        payload: {
          nodeType: node.type,
          startedAt: now,
          defaultTimeoutSec: getNodeTimeout(String(node.type ?? ""), {}),
        },
      });
      log.info(
        { event: "pipeline.node.start", runId, nodeId: node.id, nodeType: node.type },
        `开始执行节点`,
      );

      try {
        // COST-F09：任务排队后预算可能已被其他任务消耗，真正执行前再次 fail closed。
        await assertBudgetCapacityForNodes(ctx, projectId, [node]);
        // 3) 解析上游输入 → 注入 config
        const config = await resolveNodeInputs(ctx, runId, node);
        const timeoutSeconds = getNodeTimeout(node.type, config);
        const timeoutMs = timeoutSeconds * 1000;
        const abortController = new AbortController();
        const { signal } = abortController;
        let timeoutFired = false;
        const timeoutHandle = setTimeout(() => {
          timeoutFired = true;
          abortController.abort(new NodeAbortedError(`NODE_TIMEOUT: 节点执行超过 ${timeoutSeconds} 秒`));
        }, timeoutMs);
        if (typeof timeoutHandle.unref === "function") timeoutHandle.unref();

        let output: Record<string, unknown> = {};
        try {
          const nodeExecutionPromise = runNodeLogic(ctx, runId, node, config, now, signal);
          output = await Promise.race([nodeExecutionPromise, abortToPromise(abortController)]);
        } finally {
          clearTimeout(timeoutHandle);
        }
        if (timeoutFired) {
          throw new NodeAbortedError(`NODE_TIMEOUT: 节点执行超过 ${timeoutSeconds} 秒`);
        }

        // 4) 节点完成前同步执行质量门禁。block 模式不通过时必须失败关闭，
        //    不得先标 completed，也不得以 fire-and-forget 方式放行下游。
        const { maybeAutoTriggerQualityCheck } =
          await import("./quality-detection-service.js");
        const qualityResult = await maybeAutoTriggerQualityCheck(ctx, {
          runId,
          nodeId: node.id,
          projectId,
          nodeType: String(node.type ?? ""),
          output: (output ?? {}) as Record<string, unknown>,
        });
        if (qualityResult.blocked) {
          const gateError = new Error(
            `QUALITY_GATE_BLOCKED: report=${qualityResult.reportId ?? ""}, score=${qualityResult.score ?? ""}`,
          );
          gateError.name = "ValidationError";
          throw gateError;
        }

        // 5) 标 completed + 写 completed 事件
        const completedAt = new Date().toISOString();
        await ctx.pipelineNodes.update(node.id, {
          status: "completed",
          completed_at: completedAt,
          updated_at: completedAt,
          output_data: output,
        } as any);
        await recordEvent({
          runId,
          nodeId: node.id,
          projectId,
          type: "node_completed",
          payload: {
            nodeType: node.type,
            startedAt: now,
            completedAt,
            durationMs: Date.parse(completedAt) - Date.parse(now),
            outputKeys: Object.keys(output),
            timeoutSec: timeoutSeconds,
          },
        });
        log.info(
          { event: "pipeline.node.completed", runId, nodeId: node.id, nodeType: node.type },
          `节点执行成功`,
        );
      } catch (error) {
        const errorMsg = (error as Error).message ?? String(error);
        const isAbort =
          error instanceof NodeAbortedError || (error as any)?.name === "AbortError";
        const retryCount = (node.retry_count ?? 0) + 1;

        // ===== V2 W10 FEAT-PIPE-006：错误恢复决策树 =====
        const errorCategory: ErrorCategory = classifyError(error);
        const taggedErrorMsg = `[${errorCategory}] ${errorMsg}`;
        const nodeConfigObj = (node as any).config && typeof (node as any).config === "object" ? (node as any).config : {};
        const currentModel: string | null = nodeConfigObj.model ?? null;
        const cbKey = `${String(node.type ?? "unknown")}:${currentModel ?? "default"}`;

        try {
          await recordEvent({
            runId,
            nodeId: node.id,
            projectId,
            type: "node_error_classified",
            payload: { errorCategory, error: errorMsg, retryCount, model: currentModel },
          });
        } catch { /* fail-safe */ }

        const markFailedAndDlq = async (opts: { reason: string; willRetry: boolean; cbState?: string }) => {
          const failedAt = new Date().toISOString();
          await ctx.pipelineNodes.update(node.id, {
            status: opts.willRetry ? "retrying" : "failed",
            completed_at: opts.willRetry ? "" : failedAt,
            updated_at: failedAt,
            error: taggedErrorMsg,
            retry_count: retryCount,
            error_category: errorCategory as any,
          } as any);
          await recordEvent({
            runId,
            nodeId: node.id,
            projectId,
            type: opts.willRetry ? "node_retried" : "node_failed",
            payload: {
              nodeType: node.type,
              error: errorMsg,
              errorCategory,
              retryCount,
              reason: opts.reason,
              cbState: opts.cbState,
            },
          });
          if (!opts.willRetry) {
            await recordDeadLetter(ctx, {
              projectId, runId, nodeId: node.id, nodeType: String(node.type ?? ""),
              errorCategory, errorMessage: errorMsg,
              payload: { model: currentModel, retryCount, reason: opts.reason, cbState: opts.cbState, config: nodeConfigObj },
              retryCount,
            });
          }
        };

        if (isAbort) {
          await ctx.pipelineNodes.update(node.id, {
            status: "failed",
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            error: taggedErrorMsg,
            retry_count: retryCount,
            error_category: errorCategory as any,
          } as any);
          const resolvedConfig = await resolveNodeInputs(ctx, runId, node);
          await recordEvent({
            runId,
            nodeId: node.id,
            projectId,
            type: "node_timeout_cancelled",
            payload: {
              nodeType: node.type,
              error: errorMsg,
              errorCategory,
              timeoutSec: getNodeTimeout(node.type, resolvedConfig),
              willRetry: false,
            },
          });
          log.warn(
            { event: "pipeline.node.timeout_cancelled", runId, nodeId: node.id, nodeType: node.type, errorCategory },
            `节点超时强制取消`,
          );
          await recordDeadLetter(ctx, {
            projectId, runId, nodeId: node.id, nodeType: String(node.type ?? ""),
            errorCategory, errorMessage: errorMsg,
            payload: { reason: "timeout", retryCount },
            retryCount,
          });
          return;
        }

        if (CB_ENABLED) {
          const { allowed, state } = circuitBreakerRegistry.canAcquire(cbKey, CB_DEFAULT_OPEN_MS);
          if (!allowed) {
            const r = circuitBreakerRegistry.recordFailure(cbKey, CB_DEFAULT_THRESHOLD, CB_DEFAULT_OPEN_MS);
            if (r.opened) {
              try {
                await recordEvent({
                  runId, nodeId: node.id, projectId,
                  type: "node_circuit_breaker_open",
                  payload: { cbKey, threshold: CB_DEFAULT_THRESHOLD, openMs: CB_DEFAULT_OPEN_MS, errorCategory },
                });
              } catch { /* fail-safe */ }
            }
            log.warn(
              { event: "pipeline.node.cb_open", cbKey, runId, nodeId: node.id, errorCategory },
              `熔断器已打开（key=${cbKey}），节点跳过重试直接 DLQ`,
            );
            await markFailedAndDlq({ reason: "circuit_breaker_open", willRetry: false, cbState: state });
            return;
          }
        }

        if (!isRetryable(errorCategory)) {
          log.warn(
            { event: "pipeline.node.permanent_fail", runId, nodeId: node.id, errorCategory, error: errorMsg },
            `错误分类为不可重试，跳过重试直接 DLQ`,
          );
          await markFailedAndDlq({ reason: "non_retryable_category", willRetry: false });
          return;
        }

        if (isFallbackEligible(errorCategory)) {
          try {
            const chain = await getFallbackChain(ctx, String(node.type ?? ""));
            const next = pickNextModel(chain ?? [], currentModel);
            if (next) {
              const newConfig = { ...nodeConfigObj, model: next, _fallback_from: currentModel };
              const fallbackPath = Array.isArray(nodeConfigObj._fallback_path) ? [...nodeConfigObj._fallback_path, currentModel ?? ""] : (currentModel ? [currentModel] : []);
              newConfig._fallback_path = fallbackPath;
              try {
                await recordEvent({
                  runId, nodeId: node.id, projectId,
                  type: "node_model_fallback",
                  payload: { fromModel: currentModel, toModel: next, errorCategory, chainLen: chain?.length ?? 0 },
                });
              } catch { /* fail-safe */ }
              log.warn(
                { event: "pipeline.node.model_fallback", runId, nodeId: node.id, from: currentModel, to: next, errorCategory },
                `模型降级：${currentModel ?? "(无)"} → ${next}`,
              );
              await new Promise((resolve) => setTimeout(resolve, 1000));
              await this.executeNode(runId, { ...node, retry_count: 0, config: newConfig } as any);
              return;
            }
          } catch (fbErr) {
            log.warn({ event: "pipeline.node.fallback_err", err: (fbErr as Error).message }, `模型降级失败，继续走重试路径`);
          }
        }

        if (CB_ENABLED) {
          circuitBreakerRegistry.recordFailure(cbKey, CB_DEFAULT_THRESHOLD, CB_DEFAULT_OPEN_MS);
        }
        if (retryCount < MAX_REGULAR_RETRIES) {
          await ctx.pipelineNodes.update(node.id, {
            status: "retrying",
            retry_count: retryCount,
            updated_at: now,
            error: taggedErrorMsg,
            error_category: errorCategory as any,
          } as any);
          const nextDelayMs = Math.pow(2, retryCount) * 1000;
          await recordEvent({
            runId,
            nodeId: node.id,
            projectId,
            type: "node_retried",
            payload: {
              nodeType: node.type,
              error: errorMsg,
              errorCategory,
              retryCount,
              nextRetryDelayMs: nextDelayMs,
            },
          });
          log.warn(
            { event: "pipeline.node.retry", runId, nodeId: node.id, retryCount, error: errorMsg, errorCategory },
            `节点执行失败，准备重试`,
          );
          await new Promise((resolve) => setTimeout(resolve, nextDelayMs));
          await this.executeNode(runId, { ...node, retry_count: retryCount });
        } else {
          const failedAt = new Date().toISOString();
          await ctx.pipelineNodes.update(node.id, {
            status: "failed",
            completed_at: failedAt,
            updated_at: failedAt,
            error: taggedErrorMsg,
            retry_count: retryCount,
            error_category: errorCategory as any,
          } as any);
          await recordEvent({
            runId,
            nodeId: node.id,
            projectId,
            type: "node_failed",
            payload: {
              nodeType: node.type,
              error: errorMsg,
              errorCategory,
              retryCount,
              exhaustedRetries: true,
            },
          });
          log.error(
            { event: "pipeline.node.failed", runId, nodeId: node.id, error: errorMsg, errorCategory },
            `节点执行失败，已达最大重试次数`,
          );
          await recordDeadLetter(ctx, {
            projectId, runId, nodeId: node.id, nodeType: String(node.type ?? ""),
            errorCategory, errorMessage: errorMsg,
            payload: { reason: "exhausted_retries", model: currentModel, retryCount },
            retryCount,
          });
        }
      }
    },

    runNodeLogic(runId, node, config, now, signal) {
      return runNodeLogic(ctx, runId, node, config, now, signal);
    },
  };
}

export { computeNodeIdempotencyKey };
