/**
 * @file review-snapshots-router.ts
 * @description V2 W12 P0 REQ-REVIEW-F01：审核快照路由。
 *
 * 端点：
 *  - GET /api/review-snapshots?reviewId=xxx
 *  - GET /api/review-snapshots?projectId=xxx&limit=50
 *  - GET /api/review-snapshots/:reviewId/latest
 *  - POST /api/review-snapshots  { review_id, action, actor_id }  手动创建（一般由 service 自动调）
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AppContext } from "../services/app.js";
import { sendJson } from "./http-utils.js";
import { asString, asInt } from "../utils.js";
import {
  listReviewSnapshots,
  listReviewSnapshotsDecoded,
  getLatestSnapshot,
  listRecentSnapshotsByProject,
  recordReviewSnapshot,
} from "../services/module-domain/review-snapshot-service.js";

function sendError(res: ServerResponse, status: number, code: string, message: string, data?: unknown): void {
  sendJson(res, status, { ok: false, code, message, data });
}

interface AccessCheck {
  ok: boolean;
  reason?: string;
  principal?: { userId: string; role: string; isAdmin: boolean };
}

export async function handleReviewSnapshotsRouter(
  ctx: AppContext,
  req: IncomingMessage,
  res: ServerResponse,
  access: AccessCheck | undefined,
  parts: string[],
): Promise<boolean> {
  if (parts[0] !== "api" || parts[1] !== "review-snapshots") return false;
  if (!access?.ok) {
    sendError(res, 401, "unauthorized", "需要登录");
    return true;
  }
  // POST /api/review-snapshots
  if (parts.length === 2 && req.method === "POST") {
    const body = (await readJsonBody(req)) as Record<string, unknown> | null;
    if (!body) {
      sendError(res, 400, "invalid_body", "请求体必须为 JSON");
      return true;
    }
    const reviewId = asString(body.review_id);
    if (!reviewId) {
      sendError(res, 400, "missing_review_id", "review_id 必填");
      return true;
    }
    const review = (await ctx.reviewItems.findById(reviewId)) as Record<string, unknown> | null;
    if (!review) {
      sendError(res, 404, "review_not_found", `review ${reviewId} 不存在`);
      return true;
    }
    const snapId = await recordReviewSnapshot(
      ctx,
      review as never,
      asString(body.action) ?? "manual",
      asString(body.actor_id) ?? access.principal?.userId ?? "",
    );
    sendJson(res, 201, { ok: true, data: { id: snapId, review_id: reviewId } });
    return true;
  }
  // GET /api/review-snapshots?reviewId=xxx (returns decoded list)
  if (parts.length === 2 && req.method === "GET") {
    const url = new URL(req.url ?? "/", "http://localhost");
    const reviewId = url.searchParams.get("reviewId");
    const projectId = url.searchParams.get("projectId");
    const limit = asInt(url.searchParams.get("limit")) ?? 50;
    if (reviewId) {
      const list = await listReviewSnapshotsDecoded(ctx, reviewId);
      sendJson(res, 200, { ok: true, data: { count: list.length, items: list } });
      return true;
    }
    if (projectId) {
      const list = await listRecentSnapshotsByProject(ctx, projectId, limit);
      sendJson(res, 200, { ok: true, data: { count: list.length, items: list } });
      return true;
    }
    sendError(res, 400, "missing_query", "reviewId 或 projectId 必填");
    return true;
  }
  // GET /api/review-snapshots/:reviewId/latest
  if (parts.length === 4 && parts[3] === "latest" && req.method === "GET") {
    const snap = await getLatestSnapshot(ctx, parts[2] ?? "");
    if (!snap) {
      sendError(res, 404, "no_snapshot", `review ${parts[2]} 无快照`);
      return true;
    }
    sendJson(res, 200, { ok: true, data: snap });
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
