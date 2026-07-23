/**
 * @file route-policies-router.ts
 * @description V2 W11 ROUTE-F01~F05 路由策略 HTTP API
 *
 * 端点:
 *  - GET    /api/route/policies                      列表
 *  - GET    /api/route/policies/:id                  单个
 *  - POST   /api/route/policies                      创建
 *  - PATCH  /api/route/policies/:id                  更新
 *  - DELETE /api/route/policies/:id                  删除
 *  - POST   /api/route/policies/:id/enable           启用 (body { enabled })
 *  - POST   /api/route/policies/:id/pick             决策 (body = RouteInput)
 *  - POST   /api/route/pick                         按 capability 决策 (body = {capability, input})
 *  - GET    /api/route/decisions                     决策日志 (query: policyId/projectId/runId/limit)
 *  - GET    /api/route/decisions/count               决策日志计数
 *  - GET    /api/route/health                        健康检查
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { getRoutePolicyService, type RoutePolicyService } from "../services/horizontal/route-policy-service.js";
import type { RouteCapability, RouteInput, RoutePolicy, RouteStrategy, RouteStrategyKind } from "../types/route-policies.js";

interface AccessCtx {
  userId: string;
  isAdmin: boolean;
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(payload));
}

function sendError(res: ServerResponse, status: number, message: string): void {
  sendJson(res, status, { code: status, message, data: null });
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text.trim()) return {};
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("JSON 请求体必须是对象");
    }
    return parsed as Record<string, unknown>;
  } catch (e) {
    throw new Error(`invalid_json: ${(e as Error).message}`);
  }
}

const VALID_KINDS: RouteStrategyKind[] = ["manual", "quality", "speed", "cost", "balanced"];
const VALID_CAPS: RouteCapability[] = ["chat", "image", "video", "tts"];

function isValidStrategyKind(s: unknown): s is RouteStrategyKind {
  return typeof s === "string" && (VALID_KINDS as string[]).includes(s);
}

function parseRoutePolicyFromBody(body: Record<string, unknown>): Partial<RoutePolicy> {
  const out: Partial<RoutePolicy> = {};
  if (typeof body.id === "string") out.id = body.id;
  if (typeof body.name === "string") out.name = body.name;
  if (typeof body.description === "string") out.description = body.description;
  if (typeof body.capability === "string" && (VALID_CAPS as string[]).includes(body.capability)) {
    out.capability = body.capability as RouteCapability;
  }
  if (Array.isArray(body.strategies)) {
    out.strategies = body.strategies.filter((s): s is RouteStrategy => {
      return typeof s === "object" && s !== null && isValidStrategyKind((s as { kind: unknown }).kind);
    }).map((s) => ({
      kind: s.kind,
      weight: typeof s.weight === "number" ? s.weight : undefined,
      options: typeof s.options === "object" && s.options !== null
        ? s.options as RouteStrategy["options"]
        : undefined,
    }));
  }
  if (typeof body.fallbackModel === "string") out.fallbackModel = body.fallbackModel;
  if (typeof body.enabled === "boolean") out.enabled = body.enabled;
  return out;
}

export async function handleRoutePoliciesRouter(
  _ctx: unknown,
  req: IncomingMessage,
  res: ServerResponse,
  _access: AccessCtx,
): Promise<void> {
  const url = req.url ?? "/";
  const qIdx = url.indexOf("?");
  const path = (qIdx >= 0 ? url.slice(0, qIdx) : url).split("/").filter(Boolean); // ["api","route", ...]
  const method = (req.method ?? "GET").toUpperCase();
  if (path[0] !== "api" || path[1] !== "route") {
    sendError(res, 404, "not_found");
    return;
  }
  const svc: RoutePolicyService = getRoutePolicyService();

  // 健康检查
  if (path.length === 3 && path[2] === "health" && method === "GET") {
    const h = await svc.healthCheck();
    return sendJson(res, 200, h);
  }

  // 决策日志计数
  if (path.length === 3 && path[2] === "decisions" && path[2] === "decisions" && method === "GET" && url.includes("/count")) {
    // 不会到这里,这里只是占位
  }
  if (path.length === 4 && path[2] === "decisions" && path[3] === "count" && method === "GET") {
    const qs = qIdx >= 0 ? url.slice(qIdx + 1) : "";
    const params = new URLSearchParams(qs);
    const filter: { policyId?: string; projectId?: string } = {};
    if (params.get("policyId")) filter.policyId = String(params.get("policyId"));
    if (params.get("projectId")) filter.projectId = String(params.get("projectId"));
    const count = await svc.countDecisionLogs(filter);
    return sendJson(res, 200, { count });
  }

  // 决策日志列表
  if (path.length === 3 && path[2] === "decisions" && method === "GET") {
    const qs = qIdx >= 0 ? url.slice(qIdx + 1) : "";
    const params = new URLSearchParams(qs);
    const filter: { policyId?: string; projectId?: string; runId?: string; limit?: number } = {};
    if (params.get("policyId")) filter.policyId = String(params.get("policyId"));
    if (params.get("projectId")) filter.projectId = String(params.get("projectId"));
    if (params.get("runId")) filter.runId = String(params.get("runId"));
    const lim = parseInt(params.get("limit") ?? "50", 10);
    if (Number.isFinite(lim) && lim > 0) filter.limit = lim;
    const list = await svc.listDecisionLogs(filter);
    return sendJson(res, 200, { decisions: list, total: list.length });
  }

  // 策略列表
  if (path.length === 3 && path[2] === "policies" && method === "GET") {
    const qs = qIdx >= 0 ? url.slice(qIdx + 1) : "";
    const params = new URLSearchParams(qs);
    const filter: { capability?: RouteCapability; enabled?: boolean } = {};
    const cap = params.get("capability");
    if (cap && (VALID_CAPS as string[]).includes(cap)) filter.capability = cap as RouteCapability;
    const en = params.get("enabled");
    if (en === "true" || en === "1") filter.enabled = true;
    else if (en === "false" || en === "0") filter.enabled = false;
    const list = await svc.listPolicies(filter);
    return sendJson(res, 200, { policies: list, total: list.length });
  }

  // 策略创建
  if (path.length === 3 && path[2] === "policies" && method === "POST") {
    let body: Record<string, unknown> = {};
    try { body = await readJsonBody(req); } catch (e) { return sendError(res, 400, (e as Error).message); }
    const partial = parseRoutePolicyFromBody(body);
    try {
      const p = await svc.createPolicy(partial as Omit<RoutePolicy, "id" | "created_at" | "updated_at" | "builtIn"> & { id?: string });
      return sendJson(res, 201, { policy: p });
    } catch (e) {
      return sendError(res, 400, (e as Error).message);
    }
  }

  // 策略单个
  if (path.length === 4 && path[2] === "policies" && method === "GET") {
    const id = decodeURIComponent(path[3]);
    const p = await svc.getPolicy(id);
    if (!p) return sendError(res, 404, `route_policy_not_found: ${id}`);
    return sendJson(res, 200, { policy: p });
  }

  // 策略更新
  if (path.length === 4 && path[2] === "policies" && method === "PATCH") {
    const id = decodeURIComponent(path[3]);
    let body: Record<string, unknown> = {};
    try { body = await readJsonBody(req); } catch (e) { return sendError(res, 400, (e as Error).message); }
    const partial = parseRoutePolicyFromBody(body);
    try {
      const p = await svc.updatePolicy(id, partial);
      return sendJson(res, 200, { policy: p });
    } catch (e) {
      return sendError(res, 400, (e as Error).message);
    }
  }

  // 策略删除
  if (path.length === 4 && path[2] === "policies" && method === "DELETE") {
    const id = decodeURIComponent(path[3]);
    try {
      const ok = await svc.deletePolicy(id);
      if (!ok) return sendError(res, 404, `route_policy_not_found: ${id}`);
      return sendJson(res, 200, { deleted: id });
    } catch (e) {
      return sendError(res, 400, (e as Error).message);
    }
  }

  // 启用/禁用
  if (path.length === 5 && path[2] === "policies" && path[4] === "enable" && method === "POST") {
    const id = decodeURIComponent(path[3]);
    let body: Record<string, unknown> = {};
    try { body = await readJsonBody(req); } catch (e) { return sendError(res, 400, (e as Error).message); }
    const enabled = body.enabled === true || body.enabled === "true" || body.enabled === 1;
    try {
      const p = await svc.setEnabled(id, enabled);
      return sendJson(res, 200, { policy: p });
    } catch (e) {
      return sendError(res, 400, (e as Error).message);
    }
  }

  // 决策 (指定 policyId)
  if (path.length === 5 && path[2] === "policies" && path[4] === "pick" && method === "POST") {
    const id = decodeURIComponent(path[3]);
    let body: Record<string, unknown> = {};
    try { body = await readJsonBody(req); } catch (e) { return sendError(res, 400, (e as Error).message); }
    const input: RouteInput = {
      capability: (body.capability as RouteCapability) ?? "image",
      candidates: Array.isArray(body.candidates) ? body.candidates.filter((c): c is string => typeof c === "string") : undefined,
      pinnedModel: typeof body.pinnedModel === "string" ? body.pinnedModel : undefined,
      expectedQualityScore: typeof body.expectedQualityScore === "number" ? body.expectedQualityScore : undefined,
      expectedMaxLatencyMs: typeof body.expectedMaxLatencyMs === "number" ? body.expectedMaxLatencyMs : undefined,
      expectedMaxCostPerCall: typeof body.expectedMaxCostPerCall === "number" ? body.expectedMaxCostPerCall : undefined,
      context: typeof body.context === "object" && body.context !== null ? body.context as RouteInput["context"] : { userId: _access.userId },
    };
    try {
      const decision = await svc.pickModel(id, input);
      return sendJson(res, 200, { decision });
    } catch (e) {
      return sendError(res, 400, (e as Error).message);
    }
  }

  // 决策 (按 capability,自动选 default)
  if (path.length === 3 && path[2] === "pick" && method === "POST") {
    let body: Record<string, unknown> = {};
    try { body = await readJsonBody(req); } catch (e) { return sendError(res, 400, (e as Error).message); }
    const cap = String(body.capability ?? "image");
    if (!(VALID_CAPS as string[]).includes(cap)) {
      return sendError(res, 400, `unsupported_capability: ${cap}`);
    }
    const input: RouteInput = {
      capability: cap as RouteCapability,
      candidates: Array.isArray(body.candidates) ? body.candidates.filter((c): c is string => typeof c === "string") : undefined,
      pinnedModel: typeof body.pinnedModel === "string" ? body.pinnedModel : undefined,
      expectedQualityScore: typeof body.expectedQualityScore === "number" ? body.expectedQualityScore : undefined,
      expectedMaxLatencyMs: typeof body.expectedMaxLatencyMs === "number" ? body.expectedMaxLatencyMs : undefined,
      expectedMaxCostPerCall: typeof body.expectedMaxCostPerCall === "number" ? body.expectedMaxCostPerCall : undefined,
      context: typeof body.context === "object" && body.context !== null ? body.context as RouteInput["context"] : { userId: _access.userId },
    };
    try {
      const decision = await svc.pickModelByCapability(cap as RouteCapability, input);
      return sendJson(res, 200, { decision });
    } catch (e) {
      return sendError(res, 400, (e as Error).message);
    }
  }

  sendError(res, 404, "not_found");
}
