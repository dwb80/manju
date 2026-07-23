/**
 * @file model-constraints-router.ts
 * @description V2 W11 MODEL-F01/F02/F03/F05/F06 模型约束 HTTP API
 *
 * 端点:
 *  - GET  /api/models/capabilities?provider=...&capability=...&visibleOnly=...
 *  - GET  /api/models/capabilities/:name
 *  - POST /api/models/capabilities/:name/validate
 *      body = { capability: "image"|"video"|"chat", params: {...} }
 *  - GET  /api/models/capabilities/:name/contract-check
 *
 * 设计:所有端点对登录用户开放(只读 + 校验),不做修改。
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { getModelConstraintsService, type ModelConstraintsService } from "../services/horizontal/model-constraints-service.js";
import type { ModelCapability, ModelProvider } from "../types/model-capabilities.js";
import { rootLogger } from "../logger.js";

const log = rootLogger.child({ module: "model-constraints-router" });

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

export async function handleModelConstraintsRouter(
  _ctx: unknown,
  req: IncomingMessage,
  res: ServerResponse,
  _access: AccessCtx,
): Promise<void> {
  const url = req.url ?? "/";
  const path = url.split("?")[0];
  const method = (req.method ?? "GET").toUpperCase();
  const parts = path.split("/").filter(Boolean); // ["api","models","capabilities", ...]
  if (parts[0] !== "api" || parts[1] !== "models" || parts[2] !== "capabilities") {
    sendError(res, 404, "not_found");
    return;
  }

  const svc: ModelConstraintsService = getModelConstraintsService();

  // GET /api/models/capabilities            列表
  // GET /api/models/capabilities/:name      单个
  // POST /api/models/capabilities/:name/validate
  // GET /api/models/capabilities/:name/contract-check
  if (parts.length === 3 && method === "GET") {
    const qIdx = url.indexOf("?");
    const qs = qIdx >= 0 ? url.slice(qIdx + 1) : "";
    const params = new URLSearchParams(qs);
    const provider = (params.get("provider") as ModelProvider | null) ?? undefined;
    const capability = (params.get("capability") as ModelCapability | null) ?? undefined;
    const visibleOnly = params.get("visibleOnly") === "true" || params.get("visibleOnly") === "1";
    const models = svc.listModels({ provider: provider ?? undefined, capability: capability ?? undefined, visibleOnly });
    return sendJson(res, 200, { models, total: models.length });
  }

  if (parts.length === 4 && method === "GET") {
    const name = decodeURIComponent(parts[3]);
    const m = svc.getModel(name);
    if (!m) return sendError(res, 404, `model_not_found: ${name}`);
    return sendJson(res, 200, { model: m });
  }

  if (parts.length === 5 && parts[4] === "validate" && method === "POST") {
    const name = decodeURIComponent(parts[3]);
    let body: Record<string, unknown> = {};
    try {
      body = await readJsonBody(req);
    } catch (e) {
      return sendError(res, 400, (e as Error).message);
    }
    const capability = String(body.capability ?? "");
    const params = (typeof body.params === "object" && body.params !== null && !Array.isArray(body.params)
      ? body.params
      : {}) as Record<string, unknown>;
    let result;
    if (capability === "image") result = svc.validateImage(name, params);
    else if (capability === "video") result = svc.validateVideo(name, params);
    else if (capability === "chat") result = svc.validateChat(name, params);
    else return sendError(res, 400, `unsupported_capability: ${capability}（仅 image/video/chat）`);
    log.info(
      { event: "model.validate", model: name, capability, valid: result.valid, userId: _access.userId },
      `model param validate: ${name}/${capability} valid=${result.valid}`,
    );
    return sendJson(res, 200, { ...result, model: name, capability });
  }

  if (parts.length === 5 && parts[4] === "contract-check" && method === "GET") {
    const name = decodeURIComponent(parts[3]);
    const result = svc.contractCheck(name);
    return sendJson(res, result.ok ? 200 : 400, { name, ...result });
  }

  sendError(res, 404, "not_found");
}
