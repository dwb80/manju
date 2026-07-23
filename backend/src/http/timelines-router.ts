/**
 * @file timelines-router.ts
 * @description V2 W12 P0 REQ-EDIT-F01/F02/F03/F08/F10：时间线路由。
 *
 * 端点：
 *  - GET    /api/timelines?projectId=xxx
 *  - POST   /api/timelines
 *  - GET    /api/timelines/:id
 *  - PATCH  /api/timelines/:id
 *  - DELETE /api/timelines/:id
 *  - GET    /api/timelines/:id/nodes        列出节点（按 order）
 *  - POST   /api/timelines/:id/nodes        添加镜头
 *  - PATCH  /api/timelines/:id/nodes/reorder  { shotId, newOrder } 调整顺序
 *  - DELETE /api/timelines/:id/nodes/:shotId
 *  - PATCH  /api/timelines/:id/nodes/:nodeId  { in_point, out_point, subtitle_id, audio_id }
 *  - POST   /api/timelines/:id/versions     保存版本快照
 *  - GET    /api/timelines/:id/versions     列出所有版本
 *  - GET    /api/timelines/:id/versions/:version  获取指定版本
 *  - POST   /api/timelines/:id/versions/:version/restore  恢复到指定版本
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AppContext } from "../services/app.js";
import { sendJson } from "./http-utils.js";
import { asString } from "../utils.js";
import {
  createTimeline,
  listTimelines,
  getTimeline,
  updateTimeline,
  deleteTimeline,
  addShotToTimeline,
  listTimelineShots,
  removeShotFromTimeline,
  reorderShotInTimeline,
  updateTimelineShot,
  saveTimelineVersion,
  listTimelineVersions,
  getTimelineVersion,
  restoreTimelineVersion,
} from "../services/module-domain/timeline-service.js";

function sendError(res: ServerResponse, status: number, code: string, message: string, data?: unknown): void {
  sendJson(res, status, { ok: false, code, message, data });
}

interface AccessCheck {
  ok: boolean;
  reason?: string;
  principal?: { userId: string; role: string; isAdmin: boolean };
}

export async function handleTimelinesRouter(
  ctx: AppContext,
  req: IncomingMessage,
  res: ServerResponse,
  access: AccessCheck | undefined,
  parts: string[],
): Promise<boolean> {
  if (parts[0] !== "api" || parts[1] !== "timelines") return false;
  if (!access?.ok) {
    sendError(res, 401, "unauthorized", "需要登录");
    return true;
  }

  // === 列表 & 创建 ===
  // GET /api/timelines?projectId=xxx
  if (parts.length === 2 && req.method === "GET") {
    const url = new URL(req.url ?? "/", "http://localhost");
    const projectId = url.searchParams.get("projectId");
    if (!projectId) {
      sendError(res, 400, "missing_query", "projectId 必填");
      return true;
    }
    const list = await listTimelines(ctx, projectId);
    sendJson(res, 200, { ok: true, data: { count: list.length, items: list } });
    return true;
  }
  // POST /api/timelines
  if (parts.length === 2 && req.method === "POST") {
    const body = (await readJsonBody(req)) as Record<string, unknown> | null;
    if (!body) {
      sendError(res, 400, "invalid_body", "请求体必须为 JSON");
      return true;
    }
    try {
      const t = await createTimeline(ctx, {
        project_id: asString(body.project_id) ?? "",
        name: asString(body.name) ?? "",
        description: asString(body.description),
        ratio: asString(body.ratio),
        status: body.status as "draft" | "ready" | "archived" | undefined,
        created_by: access.principal?.userId,
      });
      sendJson(res, 201, { ok: true, data: t });
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : String(e);
      sendError(res, 400, "create_failed", err);
    }
    return true;
  }

  const timelineId = parts[2];
  if (!timelineId) return false;

  // === 单条 timeline ===
  // GET /api/timelines/:id
  if (parts.length === 3 && req.method === "GET") {
    const t = await getTimeline(ctx, timelineId);
    if (!t) {
      sendError(res, 404, "not_found", `时间线 ${timelineId} 不存在`);
      return true;
    }
    sendJson(res, 200, { ok: true, data: t });
    return true;
  }
  // PATCH /api/timelines/:id
  if (parts.length === 3 && req.method === "PATCH") {
    const body = (await readJsonBody(req)) as Record<string, unknown> | null;
    if (!body) {
      sendError(res, 400, "invalid_body", "请求体必须为 JSON");
      return true;
    }
    try {
      const t = await updateTimeline(ctx, timelineId, {
        name: asString(body.name),
        description: asString(body.description),
        ratio: asString(body.ratio),
        status: body.status as "draft" | "ready" | "archived" | undefined,
        final_video_id: asString(body.final_video_id),
      });
      sendJson(res, 200, { ok: true, data: t });
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : String(e);
      sendError(res, 400, "update_failed", err);
    }
    return true;
  }
  // DELETE /api/timelines/:id
  if (parts.length === 3 && req.method === "DELETE") {
    try {
      await deleteTimeline(ctx, timelineId);
      sendJson(res, 200, { ok: true, data: { id: timelineId, deleted: true } });
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : String(e);
      sendError(res, 400, "delete_failed", err);
    }
    return true;
  }

  // === 节点（nodes） ===
  // GET /api/timelines/:id/nodes
  if (parts.length === 4 && parts[3] === "nodes" && req.method === "GET") {
    const list = await listTimelineShots(ctx, timelineId);
    sendJson(res, 200, { ok: true, data: { count: list.length, items: list } });
    return true;
  }
  // POST /api/timelines/:id/nodes
  if (parts.length === 4 && parts[3] === "nodes" && req.method === "POST") {
    const body = (await readJsonBody(req)) as Record<string, unknown> | null;
    if (!body) {
      sendError(res, 400, "invalid_body", "请求体必须为 JSON");
      return true;
    }
    try {
      const node = await addShotToTimeline(ctx, {
        project_id: asString(body.project_id) ?? "",
        timeline_id: timelineId,
        shot_id: asString(body.shot_id) ?? "",
        in_point: body.in_point !== undefined ? Number(body.in_point) : 0,
        out_point: body.out_point !== undefined ? Number(body.out_point) : 0,
        subtitle_id: asString(body.subtitle_id),
        audio_id: asString(body.audio_id),
        volume: body.volume !== undefined ? Number(body.volume) : undefined,
        transition_type: asString(body.transition_type) as
          | "cut"
          | "dissolve"
          | "fade"
          | "wipe"
          | "slide"
          | undefined,
        transition_duration_ms:
          body.transition_duration_ms !== undefined ? Number(body.transition_duration_ms) : undefined,
      });
      sendJson(res, 201, { ok: true, data: node });
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : String(e);
      sendError(res, 400, "add_failed", err);
    }
    return true;
  }
  // PATCH /api/timelines/:id/nodes/reorder
  if (parts.length === 5 && parts[3] === "nodes" && parts[4] === "reorder" && req.method === "POST") {
    const body = (await readJsonBody(req)) as Record<string, unknown> | null;
    if (!body) {
      sendError(res, 400, "invalid_body", "请求体必须为 JSON");
      return true;
    }
    try {
      const list = await reorderShotInTimeline(
        ctx,
        timelineId,
        asString(body.shot_id) ?? "",
        Number(body.new_order ?? 0),
      );
      sendJson(res, 200, { ok: true, data: { count: list.length, items: list } });
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : String(e);
      sendError(res, 400, "reorder_failed", err);
    }
    return true;
  }
  // DELETE /api/timelines/:id/nodes/:shotId
  if (parts.length === 5 && parts[3] === "nodes" && req.method === "DELETE") {
    try {
      await removeShotFromTimeline(ctx, timelineId, parts[4] ?? "");
      sendJson(res, 200, { ok: true, data: { timeline_id: timelineId, shot_id: parts[4] } });
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : String(e);
      sendError(res, 400, "remove_failed", err);
    }
    return true;
  }
  // PATCH /api/timelines/:id/nodes/:nodeId
  if (parts.length === 5 && parts[3] === "nodes" && req.method === "PATCH") {
    const body = (await readJsonBody(req)) as Record<string, unknown> | null;
    if (!body) {
      sendError(res, 400, "invalid_body", "请求体必须为 JSON");
      return true;
    }
    try {
      const result = await updateTimelineShot(ctx, parts[4] ?? "", {
        in_point: body.in_point !== undefined ? Number(body.in_point) : undefined,
        out_point: body.out_point !== undefined ? Number(body.out_point) : undefined,
        subtitle_id: body.subtitle_id !== undefined ? asString(body.subtitle_id) : undefined,
        audio_id: body.audio_id !== undefined ? asString(body.audio_id) : undefined,
        volume: body.volume !== undefined ? Number(body.volume) : undefined,
        transition_type: body.transition_type !== undefined
          ? (asString(body.transition_type) as
              | "cut"
              | "dissolve"
              | "fade"
              | "wipe"
              | "slide")
          : undefined,
        transition_duration_ms:
          body.transition_duration_ms !== undefined
            ? Number(body.transition_duration_ms)
            : undefined,
      });
      sendJson(res, 200, {
        ok: true,
        data: {
          node: result.node,
          warnings: result.warnings,
          reasons: result.reasons,
        },
      });
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : String(e);
      sendError(res, 400, "update_node_failed", err);
    }
    return true;
  }

  // === 版本（versions） ===
  // POST /api/timelines/:id/versions
  if (parts.length === 4 && parts[3] === "versions" && req.method === "POST") {
    const body = (await readJsonBody(req)) as Record<string, unknown> | null;
    try {
      const v = await saveTimelineVersion(ctx, {
        timeline_id: timelineId,
        change_note: body ? asString(body.change_note) : undefined,
        created_by: access.principal?.userId,
      });
      sendJson(res, 201, { ok: true, data: v });
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : String(e);
      sendError(res, 400, "save_version_failed", err);
    }
    return true;
  }
  // GET /api/timelines/:id/versions
  if (parts.length === 4 && parts[3] === "versions" && req.method === "GET") {
    const list = await listTimelineVersions(ctx, timelineId);
    sendJson(res, 200, { ok: true, data: { count: list.length, items: list } });
    return true;
  }
  // GET /api/timelines/:id/versions/:version
  // POST /api/timelines/:id/versions/:version/restore
  if (parts.length >= 5 && parts[3] === "versions") {
    const versionStr = parts[4];
    if (!versionStr) return false;
    const version = Number(versionStr);
    if (Number.isNaN(version)) {
      sendError(res, 400, "invalid_version", "version 必须为数字");
      return true;
    }
    if (parts.length === 5 && req.method === "GET") {
      const v = await getTimelineVersion(ctx, timelineId, version);
      if (!v) {
        sendError(res, 404, "version_not_found", `version ${version} 不存在`);
        return true;
      }
      let decoded: unknown = null;
      try {
        decoded = JSON.parse(v.snapshot_data);
      } catch {
        decoded = null;
      }
      sendJson(res, 200, { ok: true, data: { ...v, decoded } });
      return true;
    }
    if (parts.length === 6 && parts[5] === "restore" && req.method === "POST") {
      try {
        const v = await restoreTimelineVersion(ctx, timelineId, version, access.principal?.userId ?? "");
        sendJson(res, 200, { ok: true, data: v });
      } catch (e: unknown) {
        const err = e instanceof Error ? e.message : String(e);
        sendError(res, 400, "restore_failed", err);
      }
      return true;
    }
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
