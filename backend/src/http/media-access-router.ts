/**
 * @file media-access-router.ts
 * @description V2 W11 P0 REQ-NF-F09：/api/media/access 鉴权代理端点。
 *
 * 设计要点：
 *  - 现有 /media/* /project-media/* 是无鉴权的静态文件服务（向后兼容）
 *  - 前端可选调用 /api/media/access?path=xxx 走鉴权代理：
 *    1) 校验 path 合法（必须以 /media/ 或 /project-media/ 开头，禁 path traversal）
 *    2) 若是 /project-media/{projectId}/*，校验 caller 是 projectId 成员或 admin
 *    3) 若是 /media/*（全局共享），仅校验 caller 已登录
 *    4) 返回文件字节流（200 application/octet-stream） + 头 metadata
 *  - 端点不直接暴露磁盘路径（path 在 ctx 内解析），减少攻击面
 *  - 后续接入 CDN 签名 URL 时只需替换本端点内部实现
 */
import { createReadStream, statSync, existsSync } from "node:fs";
import { resolve as resolvePath, join, normalize } from "node:path";
import { rootLogger } from "../logger.js";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AppContext } from "../services/app.js";
import { readJsonBody } from "./http-utils.js";

const log = rootLogger.child({ module: "media-access-router" });

/** 最大支持单文件 500MB，避免 OOM。 */
const MAX_FILE_SIZE = 500 * 1024 * 1024;

export interface MediaAccessCtx {
  userId: string;
  isAdmin: boolean;
  canAccessProject: (projectId: string) => Promise<boolean>;
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}
function sendError(res: ServerResponse, status: number, message: string) {
  sendJson(res, status, { code: "error", message, data: null });
}

/** 解析 path → 磁盘绝对路径 + 关联 projectId（如果是 /project-media/）。 */
function resolveMediaPath(root: string, urlPath: string): { absPath: string; projectId: string | null; publicAccess: boolean } {
  // 禁 path traversal：禁用 ..
  if (urlPath.includes("..")) {
    throw new Error("path_traversal_detected");
  }
  // normalize 防止 /media/./foo 或 /media//foo
  const cleanPath = normalize(urlPath).replace(/\\/g, "/");
  if (cleanPath.startsWith("/project-media/")) {
    const rest = cleanPath.slice("/project-media/".length);
    const parts = rest.split("/");
    const projectId = parts[0] ?? "";
    if (!projectId) throw new Error("invalid_project_id");
    const relPath = parts.slice(1).join("/");
    return { absPath: join(root, "project-media", projectId, relPath), projectId, publicAccess: false };
  }
  if (cleanPath.startsWith("/media/")) {
    const relPath = cleanPath.slice("/media/".length);
    return { absPath: join(root, "media", relPath), projectId: null, publicAccess: true };
  }
  throw new Error("invalid_path_prefix");
}

export async function handleMediaAccessRouter(
  ctx: AppContext,
  req: IncomingMessage,
  res: ServerResponse,
  access: MediaAccessCtx,
): Promise<void> {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const path = url.searchParams.get("path");

  if (!path) {
    sendError(res, 400, "missing_path");
    return;
  }

  let resolved: { absPath: string; projectId: string | null; publicAccess: boolean };
  try {
    resolved = resolveMediaPath(ctx.root, path);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "path_traversal_detected") {
      log.warn({ userId: access.userId, path }, "path traversal 尝试被拒");
      sendError(res, 400, "path_traversal_detected");
      return;
    }
    if (msg === "invalid_path_prefix") {
      sendError(res, 400, "invalid_path_prefix: path 必须以 /media/ 或 /project-media/ 开头");
      return;
    }
    sendError(res, 400, "invalid_path");
    return;
  }

  // 鉴权：非 admin 必须在 /project-media/{projectId}/* 是 projectId 成员
  if (!resolved.publicAccess && resolved.projectId) {
    if (!access.isAdmin) {
      const allowed = await access.canAccessProject(resolved.projectId);
      if (!allowed) {
        log.warn(
          { userId: access.userId, projectId: resolved.projectId, path },
          "NF-F09 /api/media/access 拒绝：非项目成员",
        );
        sendError(res, 403, "forbidden: not project member");
        return;
      }
    }
  }

  if (!existsSync(resolved.absPath)) {
    sendError(res, 404, "file_not_found");
    return;
  }
  let stat;
  try {
    stat = statSync(resolved.absPath);
  } catch (e) {
    sendError(res, 500, "stat_failed");
    return;
  }
  if (!stat.isFile()) {
    sendError(res, 400, "not_a_file");
    return;
  }
  if (stat.size > MAX_FILE_SIZE) {
    sendError(res, 413, "file_too_large");
    return;
  }

  // 推断 content-type
  const ext = resolved.absPath.split(".").pop()?.toLowerCase() ?? "";
  const mimeMap: Record<string, string> = {
    mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm",
    mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg", m4a: "audio/mp4",
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp",
    srt: "text/plain", vtt: "text/vtt", txt: "text/plain",
    json: "application/json",
  };
  const contentType = mimeMap[ext] ?? "application/octet-stream";
  const fileName = resolved.absPath.split(/[\\/]/).pop() ?? "download";
  res.statusCode = 200;
  res.setHeader("content-type", contentType);
  res.setHeader("content-length", String(stat.size));
  res.setHeader("content-disposition", `inline; filename="${fileName}"`);
  res.setHeader("x-media-access-mode", "authenticated");
  res.setHeader("x-media-access-user", access.userId);
  res.setHeader("x-media-access-time", new Date().toISOString());
  log.info(
    { userId: access.userId, path, absPath: resolved.absPath, size: stat.size, projectId: resolved.projectId },
    "NF-F09 /api/media/access 鉴权通过 + stream",
  );
  const stream = createReadStream(resolved.absPath);
  stream.pipe(res);
}
