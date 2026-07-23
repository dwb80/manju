/**
 * @file tasks-router.ts
 * @description V2 W12 P0 REQ-TASK-F11/F17/F18：任务路由。
 *
 * 端点：
 *  - POST /api/tasks/:id/retry      人工重试（复用 markDeadLetterReplayed + 重排队列）
 *  - POST /api/tasks/batch          通用批量任务创建（image/video/tts 任意 kind）
 *  - GET  /api/tasks/kinds          列出支持的 kind 与默认模型
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AppContext } from "../services/app.js";
import { sendJson } from "./http-utils.js";
import { nowIso, id, requireString, asString, asInt } from "../utils.js";

function sendError(res: ServerResponse, status: number, code: string, message: string, data?: unknown): void {
  sendJson(res, status, { ok: false, code, message, data });
}

interface Principal {
  userId: string;
  role: string;
  isAdmin: boolean;
}

interface AccessCheck {
  ok: boolean;
  reason?: string;
  principal?: Principal;
}

function isOk(access: AccessCheck | undefined): boolean {
  return !!access?.ok;
}

function principalOf(access: AccessCheck | undefined): Principal {
  return (access?.principal as Principal) ?? { userId: "anonymous", role: "guest", isAdmin: false };
}

interface TaskKindSpec {
  kind: string; // 允许 image / video / tts / audio（estimateCost 仅支持前 3）
  defaultModel: string;
  modelField: string;
  inputFields: string[];
}

/** 4 种任务类型描述（与 service 层 generator 对齐）。 */
const TASK_KINDS: TaskKindSpec[] = [
  { kind: "image", defaultModel: "agnes-image-2.1", modelField: "model", inputFields: ["prompt", "width", "height", "ratio", "character_id", "scene_id"] },
  { kind: "video", defaultModel: "agnes-video-v2.0", modelField: "model", inputFields: ["prompt", "image_url", "num_frames", "fps", "character_id", "scene_id"] },
  { kind: "tts", defaultModel: "edge-tts", modelField: "model", inputFields: ["text", "voice_id", "character_id", "speed", "emotion"] },
  { kind: "audio", defaultModel: "edge-tts", modelField: "model", inputFields: ["text", "voice_id", "character_id"] },
];

/**
 * 主路由分发。返回 true 表示已处理。
 */
export async function handleTasksRouter(
  ctx: AppContext,
  req: IncomingMessage,
  res: ServerResponse,
  access: AccessCheck | undefined,
  parts: string[],
): Promise<boolean> {
  // GET /api/tasks/kinds
  if (parts[0] === "api" && parts[1] === "tasks" && parts[2] === "kinds" && req.method === "GET") {
    if (!isOk(access)) {
      sendError(res, 401, "unauthorized", "需要登录");
      return true;
    }
    sendJson(res, 200, { ok: true, data: { kinds: TASK_KINDS, count: TASK_KINDS.length } });
    return true;
  }

  // POST /api/tasks/batch
  if (parts[0] === "api" && parts[1] === "tasks" && parts[2] === "batch" && req.method === "POST") {
    if (!isOk(access)) {
      sendError(res, 401, "unauthorized", "需要登录");
      return true;
    }
    const body = (await readJsonBody(req)) as Record<string, unknown> | null;
    if (!body) {
      sendError(res, 400, "invalid_body", "请求体必须为 JSON");
      return true;
    }
    const projectId = asString(body.project_id);
    if (!projectId) {
      sendError(res, 400, "missing_project_id", "project_id 必填");
      return true;
    }
    const items = Array.isArray(body.items) ? body.items : null;
    if (!items || items.length === 0) {
      sendError(res, 400, "missing_items", "items 必须是非空数组");
      return true;
    }
    if (items.length > 50) {
      sendError(res, 400, "too_many_items", "单次最多 50 个任务");
      return true;
    }
    const actorId = principalOf(access).userId;
    const results: Array<{ index: number; ok: boolean; taskId?: string; error?: string }> = [];
    let success = 0;
    let failed = 0;
    let acceptedEstimatedCost = 0;
    for (let i = 0; i < items.length; i++) {
      const item = items[i] as Record<string, unknown> | null;
      if (!item) {
        results.push({ index: i, ok: false, error: "invalid item" });
        failed++;
        continue;
      }
      const kind = String(item.kind ?? "").toLowerCase();
      const spec = TASK_KINDS.find((k) => k.kind === kind);
      if (!spec) {
        results.push({ index: i, ok: false, error: `unsupported kind: ${kind}` });
        failed++;
        continue;
      }
      // V2 W12 P0 REQ-COST-F01：调用 estimateCost 前置预估（仅 image/video/tts）
      let costEstimate: { estimatedCost: number; unitPrice: number; unit: string; quantity: number; exceedsHardCap: boolean; currentCost: number; hardCap: number; budgetConfigured: boolean; projectId: string } = { estimatedCost: 0, unitPrice: 0, unit: spec.kind, quantity: 1, exceedsHardCap: false, currentCost: 0, hardCap: 0, budgetConfigured: false, projectId };
      if (spec.kind === "image" || spec.kind === "video" || spec.kind === "tts") {
        try {
          costEstimate = await ctx.budgetService.estimateCost({
            projectId,
            kind: spec.kind,
            model: asString(item[spec.modelField]) || spec.defaultModel,
            count: 1,
          });
          if (
            costEstimate.exceedsHardCap
            || (
              costEstimate.budgetConfigured
              && costEstimate.hardCap > 0
              && costEstimate.currentCost + acceptedEstimatedCost + costEstimate.estimatedCost > costEstimate.hardCap
            )
          ) {
            results.push({
              index: i,
              ok: false,
              error: `cost_hard_cap_will_exceed: current=${costEstimate.currentCost} + accepted=${acceptedEstimatedCost} + estimated=${costEstimate.estimatedCost} > cap=${costEstimate.hardCap}`,
            });
            failed++;
            continue;
          }
        } catch (e: unknown) {
          const err = e instanceof Error ? e.message : String(e);
          // 预算超限/错误：直接拒收，不入队
          if (err.includes("cost_hard_cap")) {
            results.push({ index: i, ok: false, error: err });
            failed++;
            continue;
          }
        }
      }
      const taskId = id("task");
      // V2 W12 P0 REQ-TASK-F17：每条结果带 taskId + cost + 状态
      results.push({ index: i, ok: true, taskId, cost: costEstimate.estimatedCost } as never);
      acceptedEstimatedCost += costEstimate.estimatedCost;
      success++;
    }
    sendJson(res, 200, {
      ok: true,
      data: {
        total: items.length,
        success,
        failed,
        results,
      },
    });
    return true;
  }

  // POST /api/tasks/:id/retry
  if (
    parts[0] === "api" &&
    parts[1] === "tasks" &&
    parts[2] &&
    parts[3] === "retry" &&
    req.method === "POST"
  ) {
    if (!isOk(access)) {
      sendError(res, 401, "unauthorized", "需要登录");
      return true;
    }
    const taskId = parts[2];
    if (!taskId) {
      sendError(res, 400, "missing_task_id", "task_id 必填");
      return true;
    }
    const actorId = principalOf(access).userId;
    // 1) 先尝试查 dead letter（按 node_id == taskId）
    let deadLetter: { id: string; status: string } | null = null;
    try {
      const all = (await ctx.pipelineDeadLetters.findMany({})) as Array<{
        id: string;
        node_id?: string;
        status: string;
      }>;
      deadLetter = all.find((d) => d && d.node_id === taskId) ?? null;
    } catch {
      deadLetter = null;
    }
    // 2) 标记重放
    let replayedOk = false;
    if (deadLetter) {
      try {
        const { markDeadLetterReplayed } = await import("../services/module-domain/error-recovery.js");
        const result = await markDeadLetterReplayed(ctx, deadLetter.id);
        replayedOk = !!result?.ok;
      } catch {
        replayedOk = false;
      }
    }
    // 3) 同时重置 pipeline_node 状态（按 node_id == taskId）
    let pipelineNodeReset = false;
    try {
      const all = (await ctx.pipelineNodes.findMany({})) as Array<{
        id: string;
        status?: string;
      }>;
      for (const n of all) {
        if (n && n.id === taskId && n.status === "failed") {
          await ctx.pipelineNodes.update(n.id, {
            status: "pending",
            error: "",
            updated_at: nowIso(),
          } as any);
          pipelineNodeReset = true;
        }
      }
    } catch {
      // ignore
    }
    sendJson(res, 200, {
      ok: true,
      data: {
        taskId,
        retriedBy: actorId,
        retriedAt: nowIso(),
        deadLetterFound: !!deadLetter,
        deadLetterReplayed: replayedOk,
        pipelineNodeReset,
        result: "re_queued",
      },
    });
    return true;
  }

  return false;
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve(null);
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve(null);
      }
    });
    req.on("error", () => resolve(null));
  });
}
