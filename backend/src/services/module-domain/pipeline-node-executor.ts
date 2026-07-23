/**
 * Pipeline node execution boundary.
 *
 * This module may resolve inputs and call providers, but it never changes Run
 * or Node persistence. Every outcome is returned to an application command
 * handler so the aggregate remains the sole state authority.
 */
import type { AppContext } from "../app.js";
import {
  classifyError,
  isFallbackEligible,
  isRetryable,
} from "./error-recovery.js";
import type { ErrorCategory } from "../../types/pipeline.js";
import { computeNodeIdempotencyKey } from "./pipeline-idempotency.js";

export {
  classifyError,
  isFallbackEligible,
  isRetryable,
  computeNodeIdempotencyKey,
};

export interface NodeExecutionError {
  readonly message: string;
  readonly category: ErrorCategory | "cancelled";
  readonly retryable: boolean;
  readonly name: string;
}

export type NodeExecutionResult =
  | { readonly kind: "success"; readonly output: Record<string, unknown> }
  | { readonly kind: "failure"; readonly error: NodeExecutionError }
  | { readonly kind: "cancelled"; readonly reason: string };

export class NodeAbortedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NodeAbortedError";
  }
}

const NODE_TIMEOUT_DEFAULTS: Readonly<Record<string, number>> = {
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

export function getNodeTimeout(
  nodeType: string,
  config: Record<string, unknown>,
): number {
  const configured = Number(config.timeout_seconds ?? 0);
  return configured > 0
    ? configured
    : (NODE_TIMEOUT_DEFAULTS[nodeType] ?? 600);
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new NodeAbortedError(String(signal.reason ?? "aborted"));
  }
}

async function resolveNodeInputs(
  ctx: AppContext,
  runId: string,
  node: any,
): Promise<Record<string, unknown>> {
  const inputs =
    node.input && typeof node.input === "object"
      ? node.input
      : (node.input_data ?? {});
  const resolved: Record<string, unknown> = {
    ...((node.config as Record<string, unknown>) ?? {}),
  };
  if (Object.keys(inputs).length === 0) return resolved;
  const upstreamNodes = (await ctx.pipelineNodes.findMany({
    run_id: runId,
  } as any)) as any[];
  for (const [field, mapping] of Object.entries(inputs)) {
    const [upstreamId, ...path] = String(mapping).split(".");
    const upstream = upstreamNodes.find(
      (candidate) =>
        candidate.id === upstreamId || candidate.node_key === upstreamId,
    );
    if (!upstream || path.length === 0) continue;
    const value = path.reduce(
      (current: any, key) => current?.[key],
      upstream.output_data,
    );
    if (value !== undefined) resolved[field] = value;
  }
  return resolved;
}

async function runNodeLogic(
  ctx: AppContext,
  runId: string,
  node: any,
  config: Record<string, unknown>,
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
      let waited = 0;
      while (waited < duration) {
        throwIfAborted(signal);
        const slice = Math.min(200, duration - waited);
        await new Promise((resolve) => setTimeout(resolve, slice));
        waited += slice;
      }
      output.waited_ms = duration;
      break;
    }
    case "composition":
    case "compose":
    case "render": {
      const shots = Array.isArray(config.shots) ? config.shots : [];
      const check = await ctx.compositionService.preRenderCheck({
        projectId: String(node.projectId ?? node.project_id ?? ""),
        shots,
        checkBudget: true,
        presetKey:
          typeof config.preset_key === "string"
            ? config.preset_key
            : undefined,
      });
      if (!check.ok) {
        throw new Error(
          `${nodeType}_precheck_failed: ${check.reasons
            .map((reason) => reason.code)
            .join(",")}`,
        );
      }
      throw new Error(`node_executor_not_configured: ${nodeType}`);
    }
    case "review": {
      if (
        config.default_decision !== "approved" &&
        config.default_decision !== "rejected"
      ) {
        throw new Error(
          "review_decision_required: default_decision must be explicitly approved or rejected",
        );
      }
      output.decision = config.default_decision;
      output.approved = config.default_decision === "approved";
      output.reviewer =
        typeof config.reviewer === "string" ? config.reviewer : "system";
      output.reason =
        typeof config.reason === "string"
          ? config.reason
          : "explicit pipeline decision";
      output.reviewed_at = new Date().toISOString();
      break;
    }
    case "image_generation":
      throw new Error("node_executor_not_configured: image_generation");
    case "generate_image":
    case "video_generation":
    case "generate_video":
    case "tts":
    case "webhook":
      throw new Error(`node_executor_not_configured: ${nodeType}`);
    default:
      throw new Error(`unknown_node_type: ${nodeType}`);
  }
  throwIfAborted(signal);
  return output;
}

export interface PipelineNodeExecutor {
  executeNode(runId: string, node: any): Promise<NodeExecutionResult>;
  runNodeLogic(
    runId: string,
    node: any,
    config: Record<string, unknown>,
    now: string,
    signal: AbortSignal,
  ): Promise<Record<string, unknown>>;
}

/** Retained for source compatibility; execution no longer accepts write hooks. */
export interface NodeExecutorDeps {
  readonly recordEvent?: unknown;
}

export function createNodeExecutor(
  ctx: AppContext,
  _deps: NodeExecutorDeps = {},
): PipelineNodeExecutor {
  return {
    async executeNode(runId, node): Promise<NodeExecutionResult> {
      const config = await resolveNodeInputs(ctx, runId, node);
      const timeoutSeconds = getNodeTimeout(String(node.type ?? ""), config);
      const controller = new AbortController();
      const timeout = setTimeout(() => {
        controller.abort(
          new NodeAbortedError(
            `NODE_TIMEOUT: node execution exceeded ${timeoutSeconds} seconds`,
          ),
        );
      }, timeoutSeconds * 1000);
      if (typeof timeout.unref === "function") timeout.unref();
      try {
        const output = await Promise.race([
          runNodeLogic(ctx, runId, node, config, controller.signal),
          new Promise<never>((_, reject) => {
            controller.signal.addEventListener(
              "abort",
              () =>
                reject(
                  controller.signal.reason ??
                    new NodeAbortedError("node execution cancelled"),
                ),
              { once: true },
            );
          }),
        ]);

        const { maybeAutoTriggerQualityCheck } =
          await import("./quality-detection-service.js");
        const qualityResult = await maybeAutoTriggerQualityCheck(ctx, {
          runId,
          nodeId: String(node.id),
          projectId: String(node.projectId ?? node.project_id ?? ""),
          nodeType: String(node.type ?? ""),
          output,
        });
        if (qualityResult.blocked) {
          const error = new Error(
            `QUALITY_GATE_BLOCKED: report=${qualityResult.reportId ?? ""}, score=${qualityResult.score ?? ""}`,
          );
          error.name = "ValidationError";
          throw error;
        }
        return { kind: "success", output };
      } catch (caught) {
        const error =
          caught instanceof Error ? caught : new Error(String(caught));
        if (
          error instanceof NodeAbortedError ||
          error.name === "AbortError"
        ) {
          return { kind: "cancelled", reason: error.message };
        }
        const category = classifyError(error);
        return {
          kind: "failure",
          error: {
            message: error.message,
            category,
            retryable: isRetryable(category),
            name: error.name,
          },
        };
      } finally {
        clearTimeout(timeout);
      }
    },

    runNodeLogic(runId, node, config, _now, signal) {
      return runNodeLogic(ctx, runId, node, config, signal);
    },
  };
}
