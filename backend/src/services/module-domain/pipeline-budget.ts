/**
 * @file pipeline-budget.ts
 * @description Pipeline 节点计费预算校验。
 *
 * 抽取自原 pipeline-run-service.ts，目的是把"billable 节点估算 + 预算校验"
 * 这块独立 IO 关注点拆出，主服务只负责调度和编排。
 *
 * 关键行为：
 *  - 只对 image / video / tts 三类节点计费（其余不消耗 token）
 *  - 调用 ctx.budgetService.estimateCost 聚合所有节点的预估成本
 *  - 若项目配置了 hard_cap 且 累计 + 当前 > hard_cap 则抛 cost_hard_cap_will_exceed
 *  - 在 createRun / batchCreateNodes / executeNode 之前都会被调用（fail-closed）
 */
import type { AppContext } from "../app.js";

type BillableNodeEstimate = {
  kind: "image" | "video" | "tts";
  model: string;
  count?: number;
  numFrames?: number;
  textLength?: number;
  durationSec?: number;
};

export function billableEstimateForNode(node: any): BillableNodeEstimate | null {
  const type = String(node?.type ?? "");
  const config = typeof node?.config === "object" && node.config ? node.config : {};
  const input = typeof node?.input_data === "object" && node.input_data ? node.input_data : {};
  const value = (key: string): unknown => input[key] ?? config[key];
  if (type === "image_generation" || type === "generate_image") {
    return {
      kind: "image",
      model: String(value("model") ?? "agnes-image-2.1-flash"),
      count: Math.max(1, Number(value("count") ?? value("n") ?? 1)),
    };
  }
  if (type === "video_generation" || type === "generate_video") {
    return {
      kind: "video",
      model: String(value("model") ?? "agnes-video-v2.0"),
      count: Math.max(1, Number(value("count") ?? 1)),
      numFrames: Math.max(1, Number(value("num_frames") ?? value("numFrames") ?? 1)),
      durationSec: Math.max(0, Number(value("duration") ?? value("durationSec") ?? 0)),
    };
  }
  if (type === "tts") {
    return {
      kind: "tts",
      model: String(value("model") ?? value("voice_model") ?? "agnes-tts-v1"),
      count: Math.max(1, Number(value("count") ?? 1)),
      textLength: String(value("text") ?? "").length,
      durationSec: Math.max(0, Number(value("duration") ?? value("durationSec") ?? 0)),
    };
  }
  return null;
}

/**
 * 校验一批节点的预计成本是否触发 hard_cap。
 *  - 任一节点 fail closed 抛错（fail-closed）
 *  - 预估超过 cap 时抛 cost_hard_cap_will_exceed 错误，调用方应在 createRun / batch / executeNode 之前 fail
 */
export async function assertBudgetCapacityForNodes(
  ctx: AppContext,
  projectId: string,
  nodes: unknown[],
): Promise<void> {
  let estimatedTotal = 0;
  let currentCost = 0;
  let hardCap = 0;
  let budgetConfigured = false;
  for (const node of nodes as any[]) {
    const request = billableEstimateForNode(node);
    if (!request) continue;
    const estimate = await ctx.budgetService.estimateCost({ projectId, ...request });
    estimatedTotal += estimate.estimatedCost;
    currentCost = estimate.currentCost;
    hardCap = estimate.hardCap;
    budgetConfigured = estimate.budgetConfigured;
  }
  if (budgetConfigured && hardCap > 0 && currentCost + estimatedTotal > hardCap) {
    const error = new Error(
      `cost_hard_cap_will_exceed: current=${currentCost} + estimated=${estimatedTotal} > cap=${hardCap}`,
    ) as Error & { code?: string };
    error.code = "cost_hard_cap_will_exceed";
    throw error;
  }
}
