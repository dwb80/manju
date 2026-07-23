/**
 * V2 W10 FEAT-PIPE-006 错误恢复 HTTP 端点
 *  - GET  /api/error-recovery/dead-letters?projectId=xxx&status=pending
 *  - POST /api/error-recovery/dead-letters/:id/replay
 *  - POST /api/error-recovery/dead-letters/:id/drop
 *  - GET  /api/error-recovery/circuit-breaker/status
 *  - POST /api/error-recovery/circuit-breaker/:key/reset
 *  - POST /api/error-recovery/circuit-breaker/reset-all
 *  - GET  /api/error-recovery/classify（debug：手动分类一段 message）
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AppContext } from "../services/app.js";
import {
  circuitBreakerRegistry, classifyError, isRetryable, isFallbackEligible,
  listDeadLetters, markDeadLetterReplayed, markDeadLetterDropped,
} from "../services/module-domain/error-recovery.js";
import { readJsonBody } from "./http-utils.js";
import { requireString } from "../utils.js";

interface AccessCtx {
  userId: string;
  isAdmin: boolean;
  canAccessProject: (projectId: string) => Promise<boolean>;
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function sendError(res: ServerResponse, status: number, message: string): void {
  sendJson(res, status, { error: message, status });
}

export async function handleErrorRecoveryRouter(
  ctx: AppContext,
  req: IncomingMessage,
  res: ServerResponse,
  access: AccessCtx,
): Promise<void> {
  const url = new URL(req.url ?? "/", "http://localhost");
  const parts = url.pathname.split("/").filter(Boolean); // ["api","error-recovery", ...]
  const method = (req.method ?? "GET").toUpperCase();

  // /api/error-recovery/dead-letters
  if (parts[2] === "dead-letters" && parts.length === 3) {
    if (method === "GET") {
      const projectId = url.searchParams.get("projectId") ?? "";
      const status = url.searchParams.get("status") ?? "";
      const limit = Number(url.searchParams.get("limit") ?? 50);
      if (projectId && !(await access.canAccessProject(projectId))) {
        sendError(res, 403, "forbidden"); return;
      }
      const list = await listDeadLetters(ctx, {
        ...(projectId ? { projectId } : {}),
        ...(status ? { status } : {}),
        limit,
      });
      sendJson(res, 200, { count: list.length, items: list });
      return;
    }
    sendError(res, 405, "method_not_allowed");
    return;
  }

  // /api/error-recovery/dead-letters/:id/replay  /drop
  if (parts[2] === "dead-letters" && parts.length === 5 && (parts[4] === "replay" || parts[4] === "drop")) {
    const id = parts[3];
    if (method !== "POST") { sendError(res, 405, "method_not_allowed"); return; }
    if (!access.isAdmin) { sendError(res, 403, "forbidden"); return; }
    const result = parts[4] === "replay"
      ? await markDeadLetterReplayed(ctx, id)
      : await markDeadLetterDropped(ctx, id);
    if (!result.ok) {
      sendError(res, 400, result.reason ?? "failed");
      return;
    }
    sendJson(res, 200, { ok: true, id, action: parts[4] });
    return;
  }

  // /api/error-recovery/circuit-breaker/status
  if (parts[2] === "circuit-breaker" && parts[3] === "status" && parts.length === 4) {
    if (method !== "GET") { sendError(res, 405, "method_not_allowed"); return; }
    const keys = circuitBreakerRegistry.keys();
    const snapshot = keys.map((k) => {
      const s = circuitBreakerRegistry.getState(k);
      return { key: k, state: s.state, failureCount: s.failureCount, stateChangedAt: s.stateChangedAt, lastFailureAt: s.lastFailureAt, halfOpenProbes: s.halfOpenProbes };
    });
    sendJson(res, 200, { count: snapshot.length, items: snapshot });
    return;
  }

  // /api/error-recovery/circuit-breaker/:key/reset
  if (parts[2] === "circuit-breaker" && parts.length === 5 && parts[4] === "reset") {
    if (method !== "POST") { sendError(res, 405, "method_not_allowed"); return; }
    if (!access.isAdmin) { sendError(res, 403, "forbidden"); return; }
    const key = decodeURIComponent(parts[3]);
    circuitBreakerRegistry.reset(key);
    sendJson(res, 200, { ok: true, key, state: "closed" });
    return;
  }

  // /api/error-recovery/circuit-breaker/reset-all
  if (parts[2] === "circuit-breaker" && parts[3] === "reset-all" && parts.length === 4) {
    if (method !== "POST") { sendError(res, 405, "method_not_allowed"); return; }
    if (!access.isAdmin) { sendError(res, 403, "forbidden"); return; }
    for (const k of circuitBreakerRegistry.keys()) circuitBreakerRegistry.reset(k);
    sendJson(res, 200, { ok: true, reset: circuitBreakerRegistry.keys().length });
    return;
  }

  // /api/error-recovery/classify（debug：手动分类 message）
  if (parts[2] === "classify" && parts.length === 3) {
    if (method === "POST") {
      const body = await readJsonBody(req);
      try {
        const message = requireString(body.message, "message");
        const category = classifyError(new Error(message));
        sendJson(res, 200, { message, category, retryable: isRetryable(category), fallbackEligible: isFallbackEligible(category) });
      } catch (e) {
        sendError(res, 400, (e as Error).message);
      }
      return;
    }
    sendError(res, 405, "method_not_allowed");
    return;
  }

  sendError(res, 404, "not_found");
}
