/**
 * @file cost-router.ts
 * @description V2 W12 P0 REQ-COST-F10：成本聚合路由。
 *
 * 端点：
 *  - GET /api/cost/by-shot?projectId=xxx&monthKey=YYYY-MM
 *  - GET /api/cost/by-shot/:shotId?projectId=xxx&monthKey=YYYY-MM
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AppContext } from "../services/app.js";
import { sendJson } from "./http-utils.js";
import { asString } from "../utils.js";
import {
  aggregateShotCost,
  aggregateProjectShotsCost,
} from "../services/module-domain/cost-aggregation-service.js";

function sendError(res: ServerResponse, status: number, code: string, message: string, data?: unknown): void {
  sendJson(res, status, { ok: false, code, message, data });
}

interface AccessCheck {
  ok: boolean;
  reason?: string;
  principal?: { userId: string; role: string; isAdmin: boolean };
}

export async function handleCostRouter(
  ctx: AppContext,
  req: IncomingMessage,
  res: ServerResponse,
  access: AccessCheck | undefined,
  parts: string[],
): Promise<boolean> {
  if (parts[0] !== "api" || parts[1] !== "cost") return false;
  if (!access?.ok) {
    sendError(res, 401, "unauthorized", "需要登录");
    return true;
  }
  // /api/cost/by-shot 或 /api/cost/by-shot/:shotId
  if (parts[2] !== "by-shot") return false;
  const url = new URL(req.url ?? "/", "http://localhost");
  const projectId = url.searchParams.get("projectId");
  if (!projectId) {
    sendError(res, 400, "missing_query", "projectId 必填");
    return true;
  }
  const monthKey = asString(url.searchParams.get("monthKey")) ?? "";
  // GET /api/cost/by-shot/:shotId
  if (parts[3]) {
    const summary = await aggregateShotCost(ctx, projectId, parts[3], monthKey);
    sendJson(res, 200, { ok: true, data: summary });
    return true;
  }
  // GET /api/cost/by-shot?projectId=xxx
  const list = await aggregateProjectShotsCost(ctx, projectId, monthKey);
  sendJson(res, 200, { ok: true, data: { count: list.length, items: list } });
  return true;
}
