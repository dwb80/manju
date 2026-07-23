/**
 * @file subtitles-router.ts
 * @description V2 W12 P0 REQ-AUDIO-F08/F09/F10：字幕路由。
 *
 * 端点：
 *  - GET    /api/subtitles?shotId=xxx
 *  - POST   /api/subtitles
 *  - GET    /api/subtitles/:id
 *  - PATCH  /api/subtitles/:id
 *  - DELETE /api/subtitles/:id
 *  - POST   /api/subtitles/auto-generate  从音频自动切分字幕
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AppContext } from "../services/app.js";
import { sendJson } from "./http-utils.js";
import { asString } from "../utils.js";
import {
  createSubtitle,
  listSubtitlesByShot,
  listSubtitlesByProject,
  getSubtitle,
  updateSubtitle,
  deleteSubtitle,
  autoGenerateSubtitlesFromAudio,
} from "../services/module-domain/subtitle-service.js";

function sendError(res: ServerResponse, status: number, code: string, message: string, data?: unknown): void {
  sendJson(res, status, { ok: false, code, message, data });
}

interface AccessCheck {
  ok: boolean;
  reason?: string;
  principal?: { userId: string; role: string; isAdmin: boolean };
}

export async function handleSubtitlesRouter(
  ctx: AppContext,
  req: IncomingMessage,
  res: ServerResponse,
  access: AccessCheck | undefined,
  parts: string[],
): Promise<boolean> {
  if (parts[0] !== "api" || parts[1] !== "subtitles") return false;
  if (!access?.ok) {
    sendError(res, 401, "unauthorized", "需要登录");
    return true;
  }
  // POST /api/subtitles/auto-generate
  if (parts[2] === "auto-generate" && req.method === "POST") {
    const body = (await readJsonBody(req)) as Record<string, unknown> | null;
    if (!body) {
      sendError(res, 400, "invalid_body", "请求体必须为 JSON");
      return true;
    }
    const project_id = asString(body.project_id);
    const shot_id = asString(body.shot_id);
    const audio_id = asString(body.audio_id);
    const text = asString(body.text);
    const duration = Number(body.duration ?? 0);
    if (!project_id || !shot_id || !audio_id || !text || duration <= 0) {
      sendError(res, 400, "missing_params", "project_id/shot_id/audio_id/text/duration 必填");
      return true;
    }
    try {
      const result = await autoGenerateSubtitlesFromAudio(ctx, {
        project_id,
        shot_id,
        audio_id,
        text,
        duration,
        language: asString(body.language) ?? "zh-CN",
        character_id: asString(body.character_id),
        voice_id: asString(body.voice_id),
        force: body.force === true,
      });
      sendJson(res, 200, { ok: true, data: result });
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : String(e);
      sendError(res, 400, "auto_generate_failed", err);
    }
    return true;
  }

  // GET /api/subtitles?shotId=xxx
  if (parts.length === 2 && req.method === "GET") {
    const url = new URL(req.url ?? "/", "http://localhost");
    const shotId = url.searchParams.get("shotId");
    if (shotId) {
      const list = await listSubtitlesByShot(ctx, shotId);
      sendJson(res, 200, { ok: true, data: { count: list.length, items: list } });
      return true;
    }
    const projectId = url.searchParams.get("projectId");
    if (projectId) {
      const list = await listSubtitlesByProject(ctx, projectId);
      sendJson(res, 200, { ok: true, data: { count: list.length, items: list } });
      return true;
    }
    sendError(res, 400, "missing_query", "shotId 或 projectId 必填");
    return true;
  }

  // POST /api/subtitles
  if (parts.length === 2 && req.method === "POST") {
    const body = (await readJsonBody(req)) as Record<string, unknown> | null;
    if (!body) {
      sendError(res, 400, "invalid_body", "请求体必须为 JSON");
      return true;
    }
    try {
      const sub = await createSubtitle(ctx, {
        project_id: asString(body.project_id) ?? "",
        shot_id: asString(body.shot_id) ?? "",
        text: asString(body.text) ?? "",
        start_time: Number(body.start_time ?? 0),
        end_time: Number(body.end_time ?? 0),
        character_id: asString(body.character_id),
        voice_id: asString(body.voice_id),
        audio_id: asString(body.audio_id),
        language: asString(body.language),
        subtitle_style: body.subtitle_style && typeof body.subtitle_style === "object" ? body.subtitle_style as Record<string, never> : undefined,
        status: (body.status as "draft" | "approved" | "archived" | undefined) ?? "draft",
        created_by: access.principal?.userId,
      });
      sendJson(res, 201, { ok: true, data: sub });
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : String(e);
      sendError(res, 400, "create_failed", err);
    }
    return true;
  }

  // GET/PATCH/DELETE /api/subtitles/:id
  const subId = parts[2];
  if (subId) {
    if (req.method === "GET") {
      const sub = await getSubtitle(ctx, subId);
      if (!sub) {
        sendError(res, 404, "not_found", `字幕 ${subId} 不存在`);
        return true;
      }
      sendJson(res, 200, { ok: true, data: sub });
      return true;
    }
    if (req.method === "PATCH") {
      const body = (await readJsonBody(req)) as Record<string, unknown> | null;
      if (!body) {
        sendError(res, 400, "invalid_body", "请求体必须为 JSON");
        return true;
      }
      try {
        const updated = await updateSubtitle(ctx, subId, {
          text: asString(body.text),
          start_time: body.start_time !== undefined ? Number(body.start_time) : undefined,
          end_time: body.end_time !== undefined ? Number(body.end_time) : undefined,
          character_id: asString(body.character_id),
          voice_id: asString(body.voice_id),
          audio_id: asString(body.audio_id),
          language: asString(body.language),
          subtitle_style: body.subtitle_style && typeof body.subtitle_style === "object" ? body.subtitle_style as Record<string, never> : undefined,
          status: body.status as "draft" | "approved" | "archived" | undefined,
        });
        sendJson(res, 200, { ok: true, data: updated });
      } catch (e: unknown) {
        const err = e instanceof Error ? e.message : String(e);
        sendError(res, 400, "update_failed", err);
      }
      return true;
    }
    if (req.method === "DELETE") {
      try {
        await deleteSubtitle(ctx, subId);
        sendJson(res, 200, { ok: true, data: { id: subId, deleted: true } });
      } catch (e: unknown) {
        const err = e instanceof Error ? e.message : String(e);
        sendError(res, 400, "delete_failed", err);
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
