/**
 * @file final-videos-router.ts
 * @description V2 W11 P0 REQ-RENDER-F09：成片下载导出端点。
 *
 * 端点：
 *   GET /api/final-videos/:id/download       —— 鉴权后 stream 文件，递增 download_count
 *   GET /api/final-videos/:id               —— 获取成片元数据
 *   GET /api/final-videos?projectId=...&status=... —— 列出项目成片
 *   POST /api/final-videos                  —— 创建成片记录（pipeline render 节点 callback 用）
 *                                             鉴权方式：管理员 OR 内部服务凭证
 *                                             （REM-P1-010 替代 V2.0 用 admin 代替服务的做法）
 *   PATCH /api/final-videos/:id             —— 更新成片（status / quality_score / tags）
 *   POST /api/final-videos/internal/callback  —— 内部服务凭证注册成片（REM-P1-010）
 *
 * V2.1 P1-007 改造：
 *   - 路由器现在只依赖 FinalVideoUseCases 端口和 internalAuth 服务；
 *   - 不再直接访问 ctx.repositories / ctx.finalVideoService（除"获取已存在的 useCases 实例"外）
 *   - 列表 / 获取元数据 / 解磁盘路径 / 内部回调都通过 UseCase 走 service 层
 */
import { createReadStream, statSync, existsSync } from "node:fs";
import { rootLogger } from "../logger.js";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { FinalVideoUseCases } from "../services/use-cases.js";
import type { InternalAuthService } from "../services/internal-auth.js";
import { readJsonBody } from "./http-utils.js";
import type { FinalVideoVersion } from "../types/av.js";
import { recordAigcWatermark, getAigcWatermark } from "../services/module-domain/sec-p1-service.js";

const log = rootLogger.child({ module: "final-videos-router" });

export interface FinalVideosCtx {
  userId: string;
  isAdmin: boolean;
  canAccessProject: (projectId: string) => Promise<boolean>;
  /** 给路由器提供的最小数据库访问通道（仅用于 SEC-AI-04 水印元数据写入）。 */
  databaseFile: string;
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}
function sendError(res: ServerResponse, status: number, message: string) {
  sendJson(res, status, { code: "error", message, data: null });
}
function badRequest(res: ServerResponse, msg: string) { sendError(res, 400, msg); }

function readInternalServiceToken(req: IncomingMessage): string | null {
  const raw = req.headers["x-internal-service-token"];
  if (typeof raw === "string" && raw.length > 0) return raw;
  if (Array.isArray(raw) && raw[0]) return raw[0];
  return null;
}

export async function handleFinalVideosRouter(
  useCases: FinalVideoUseCases,
  internalAuth: InternalAuthService,
  req: IncomingMessage,
  res: ServerResponse,
  access: FinalVideosCtx,
  url: URL,
): Promise<boolean> {
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] !== "api" || parts[1] !== "final-videos") return false;

  // ===== POST /api/final-videos/internal/callback  REM-P1-010 内部服务凭证路径 =====
  if (parts.length === 4 && parts[2] === "internal" && parts[3] === "callback" && req.method === "POST") {
    const token = readInternalServiceToken(req);
    if (!token) {
      sendError(res, 401, "missing_internal_service_token");
      return true;
    }
    if (!internalAuth.isInternalServiceToken(token)) {
      sendError(res, 401, "invalid_internal_service_token");
      return true;
    }
    if (!internalAuth.isAllowed(internalAuth.resolveService(token)?.serviceId ?? "", "final_video.callback")) {
      sendError(res, 403, "service_not_allowed_for_action");
      return true;
    }
    const body = await readJsonBody(req);
    const id = String(body?.id ?? "");
    if (!id) { badRequest(res, "missing_id"); return true; }
    const videoUrl = String(body?.videoUrl ?? "");
    if (!videoUrl) { badRequest(res, "missing_video_url"); return true; }
    try {
      const result = await useCases.internalCallbackFromService({
        id,
        videoUrl,
        duration: Number(body?.duration ?? 0),
        sizeBytes: Number(body?.sizeBytes ?? 0),
        provider: String(body?.provider ?? "internal"),
        serviceToken: token,
      });
      log.info(
        { id, source: "internal_service", provider: body?.provider },
        "RENDER-F08 内部服务凭证注册成片",
      );
      sendJson(res, 201, { ok: true, id, record: result });
    } catch (error) {
      sendError(res, 409, (error as Error).message);
    }
    return true;
  }

  // ===== GET /api/final-videos?projectId=&status=&limit= =====
  if (parts.length === 2 && req.method === "GET") {
    const projectId = url.searchParams.get("projectId");
    const status = url.searchParams.get("status");
    const limit = Number(url.searchParams.get("limit") ?? "20");
    if (!projectId) { badRequest(res, "missing_project_id"); return true; }
    if (!access.isAdmin) {
      const allowed = await access.canAccessProject(projectId);
      if (!allowed) { sendError(res, 403, "forbidden: not project member"); return true; }
    }
    const items = (await useCases.listByProject({ projectId, status: status ?? undefined, limit })) as any[];
    const sorted = (items || []).sort((a: any, b: any) =>
      String(b.created_at).localeCompare(String(a.created_at)),
    ).slice(0, Math.min(limit, 100));
    sendJson(res, 200, { count: sorted.length, items: sorted });
    return true;
  }

  // ===== POST /api/final-videos 兼容 V2.0：管理员 OR 内部服务凭证 =====
  if (parts.length === 2 && req.method === "POST") {
    const internalToken = readInternalServiceToken(req);
    const isInternalAllowed = internalToken && internalAuth.isInternalServiceToken(internalToken);
    if (!access.isAdmin && !isInternalAllowed) {
      sendError(res, 403, "admin_or_internal_service_token_required");
      return true;
    }
    const body = await readJsonBody(req);
    const projectId = String(body?.projectId ?? "");
    if (!projectId) { badRequest(res, "missing_project_id"); return true; }
    const videoUrl = typeof body?.videoUrl === "string" ? body.videoUrl : "";
    if (!videoUrl) { badRequest(res, "missing_video_url"); return true; }
    try {
      const record = await useCases.register({
        projectId,
        runId: String(body?.runId ?? ""),
        renderJobId: String(body?.renderJobId ?? ""),
        compositionId: String(body?.compositionId ?? ""),
        name: String(body?.name ?? "未命名成片"),
        description: String(body?.description ?? ""),
        duration: Number(body?.duration ?? 0),
        width: Number(body?.width ?? 1920),
        height: Number(body?.height ?? 1080),
        fps: Number(body?.fps ?? 30),
        videoUrl,
        thumbnailUrl: String(body?.thumbnailUrl ?? ""),
        tags: Array.isArray(body?.tags) ? body.tags as string[] : [],
        source: isInternalAllowed ? "internal_service" : "admin",
      } as any);
      log.info(
        { id: record.id, projectId, name: record.name, source: isInternalAllowed ? "internal_service" : "admin" },
        "RENDER-F08 注册待验收成片版本",
      );
      sendJson(res, 201, { ok: true, id: record.id, record });
    } catch (error) {
      sendError(res, 409, (error as Error).message);
    }
    return true;
  }

  // ===== GET /api/final-videos/:id =====
  if (parts.length === 3 && req.method === "GET") {
    const id = parts[2];
    const item = (await useCases.getById(id)) as FinalVideoVersion | null;
    if (!item) { sendError(res, 404, "not_found"); return true; }
    if (!access.isAdmin) {
      const allowed = await access.canAccessProject(item.project_id);
      if (!allowed) { sendError(res, 403, "forbidden: not project member"); return true; }
    }
    sendJson(res, 200, item);
    return true;
  }

  // ===== PATCH /api/final-videos/:id =====
  if (parts.length === 3 && req.method === "PATCH") {
    if (!access.isAdmin) { sendError(res, 403, "admin_required_for_final_video_transition"); return true; }
    const id = parts[2];
    const item = (await useCases.getById(id)) as FinalVideoVersion | null;
    if (!item) { sendError(res, 404, "not_found"); return true; }
    const body = await readJsonBody(req);
    if (body?.qualityScore !== undefined) {
      sendError(res, 400, "quality_score_is_system_managed");
      return true;
    }
    try {
      let updated = item;
      if (typeof body?.status === "string") {
        if (!["pending", "rendering", "ready", "archived", "failed"].includes(body.status)) {
          badRequest(res, "invalid_final_video_status");
          return true;
        }
        updated = (await useCases.transition(
          id,
          body.status as FinalVideoVersion["status"],
          typeof body?.error === "string" ? body.error : "",
        )) as FinalVideoVersion;
      }
      if (Array.isArray(body?.tags)) {
        updated = (await useCases.updateTags(id, body.tags as string[])) as FinalVideoVersion;
      }
      sendJson(res, 200, { ok: true, item: updated });
    } catch (error) {
      sendError(res, 409, (error as Error).message);
    }
    return true;
  }

  // ===== GET /api/final-videos/:id/download =====
  if (parts.length === 4 && parts[3] === "download" && req.method === "GET") {
    const id = parts[2];
    const item = (await useCases.getById(id)) as FinalVideoVersion | null;
    if (!item) { sendError(res, 404, "not_found"); return true; }
    if (item.status !== "ready") {
      sendError(res, 409, `download_unavailable: status=${item.status}`);
      return true;
    }
    if (!access.isAdmin) {
      const allowed = await access.canAccessProject(item.project_id);
      if (!allowed) { sendError(res, 403, "forbidden: not project member"); return true; }
    }
    const resolved = await useCases.resolveDiskPath(id);
    if (!resolved.found || !resolved.absPath) {
      sendError(res, 400, `unsupported_video_url: ${item.video_url}（仅支持 /media/ 内部路径）`);
      return true;
    }
    const abs = resolved.absPath;
    if (!existsSync(abs)) {
      sendError(res, 404, "video_file_not_found");
      return true;
    }
    const stat = statSync(abs);
    const fileName = item.name ? `${item.name}.${abs.split(".").pop() ?? "mp4"}` : `final-${id}.mp4`;
    try {
      await useCases.recordDownload(item);
    } catch (e) {
      sendError(res, 409, (e as Error).message);
      return true;
    }
    let watermarkId = "";
    try {
      const existing = getAigcWatermark(access.databaseFile, "final_video", id);
      if (existing) {
        watermarkId = String((existing as { id?: string }).id ?? "");
      } else {
        const created = recordAigcWatermark(access.databaseFile, "final_video", id, access.userId, "agnes-aigc");
        watermarkId = created.id;
      }
    } catch (e) {
      log.warn({ err: e, id }, "AIGC 水印写入失败（不影响下载）");
    }
    log.info(
      { id, projectId: item.project_id, userId: access.userId, size: stat.size, name: fileName, watermarkId },
      "RENDER-F09 成片下载（含 AIGC 水印）",
    );
    res.statusCode = 200;
    res.setHeader("content-type", "video/mp4");
    res.setHeader("content-length", String(stat.size));
    res.setHeader("content-disposition", `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.setHeader("x-final-video-id", id);
    res.setHeader("x-final-video-version", String(item.version));
    res.setHeader("x-final-video-quality-score", String(item.quality_score));
    res.setHeader("x-aigc", "1");
    res.setHeader("x-aigc-watermark-id", watermarkId);
    res.setHeader("x-aigc-watermark-label", "AIGC");
    const stream = createReadStream(abs);
    stream.pipe(res);
    return true;
  }

  sendError(res, 404, "route_not_found");
  return true;
}
