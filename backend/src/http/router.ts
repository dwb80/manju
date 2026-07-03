import { createReadStream } from "node:fs";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import http, { type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getRuntimeConfig } from "../config/env.js";
import type { AppContext } from "../services/app.js";
import { addFavorite, addMessage, createConversation, createProject, createLocalImageTask, deleteConversation, deleteProject, ensureConversation, generateImage, generateVideo, listConversations, listImages, listProjects, listVideos, openProjectFolder, queryImage, queryVideo, updateConversation, updateProject, updateSettings } from "../services/domain.js";
import { saveUploadedImage, type UploadInput } from "../services/media.js";
import type { Conversation, Message, Project } from "../types.js";
import { DEFAULT_MODEL, estimateTokens, requireString } from "../utils.js";

const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../public");

const mediaTypes: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
};

/** 同时把日志打印到终端并写入 backend/data/logs。 */
function logLine(ctx: AppContext, message: string): void {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(line);
  const date = new Date().toISOString().slice(0, 10);
  const directory = path.join(ctx.root, "data", "logs");
  void mkdir(directory, { recursive: true })
    .then(() => appendFile(path.join(directory, `${date}.log`), `${line}\n`, "utf8"))
    .catch(() => undefined);
}

/** 给每个请求挂上完成日志，记录方法、路径、状态码和耗时。 */
function attachRequestLogger(ctx: AppContext, req: IncomingMessage, res: ServerResponse): void {
  const started = Date.now();
  let logged = false;
  const method = req.method ?? "GET";
  const url = req.url ?? "/";
  /** 只记录一次请求结束事件，避免 finish 和 close 重复写日志。 */
  const finish = (event: "finish" | "close") => {
    if (logged) return;
    logged = true;
    const ms = Date.now() - started;
    logLine(ctx, `${method} ${url} ${res.statusCode} ${ms}ms ${event}`);
  };
  res.once("finish", () => finish("finish"));
  res.once("close", () => finish("close"));
}

/** 读取 JSON 请求体，并解析成普通对象。 */
async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) as Record<string, unknown> : {};
}

/** 读取原始请求体，并限制最大字节数以保护上传接口。 */
async function readBody(req: IncomingMessage, maxBytes: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buffer = Buffer.from(chunk);
    total += buffer.length;
    if (total > maxBytes) throw new Error("upload is too large");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

/** 发送统一格式的成功 JSON 响应。 */
function sendJson<T>(res: ServerResponse, data: T, status = 200): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ code: 0, message: "ok", data }));
}

/** 发送统一格式的错误 JSON 响应。 */
function sendError(res: ServerResponse, error: unknown, status = 400): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ code: status === 404 ? 1004 : 1001, message: (error as Error).message ?? "error", data: null }));
}

/** 设置跨域响应头，允许前端开发服务器调用后端。 */
function applyCors(req: IncomingMessage, res: ServerResponse): void {
  const origin = req.headers.origin;
  res.setHeader("access-control-allow-origin", typeof origin === "string" ? origin : "*");
  res.setHeader("access-control-allow-methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type,authorization");
  res.setHeader("access-control-max-age", "86400");
}

/** 把请求 URL 拆成路由片段，方便手写路由判断。 */
function routeParts(req: IncomingMessage): string[] {
  const url = new URL(req.url ?? "/", "http://localhost");
  return url.pathname.split("/").filter(Boolean);
}

/** 提供 backend/public 下的静态文件。 */
async function serveStatic(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", "http://localhost");
  const requested = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
  const target = path.normalize(path.join(publicDir, requested));
  if (!target.startsWith(publicDir)) {
    sendError(res, new Error("not found"), 404);
    return;
  }
  try {
    await readFile(target);
    const ext = path.extname(target);
    const type = ext === ".css" ? "text/css" : ext === ".js" ? "text/javascript" : "text/html";
    res.writeHead(200, { "content-type": `${type}; charset=utf-8` });
    createReadStream(target).pipe(res);
  } catch {
    sendError(res, new Error("not found"), 404);
  }
}

/** 提供全局 data/media 下的图片、视频和上传文件。 */
async function serveMedia(ctx: AppContext, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", "http://localhost");
  const requested = decodeURIComponent(url.pathname.replace(/^\/media\/?/, ""));
  const target = path.normalize(path.join(ctx.mediaRoot, requested));
  // 静态媒体必须限制在 mediaRoot 内，避免 /media/../../ 读取任意文件。
  if (!target.startsWith(path.resolve(ctx.mediaRoot))) {
    sendError(res, new Error("not found"), 404);
    return;
  }
  try {
    await readFile(target);
    const type = mediaTypes[path.extname(target).toLowerCase()] ?? "application/octet-stream";
    res.writeHead(200, { "content-type": type });
    createReadStream(target).pipe(res);
  } catch {
    sendError(res, new Error("not found"), 404);
  }
}

/** 提供项目目录下的图片和视频文件。 */
async function serveProjectMedia(ctx: AppContext, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", "http://localhost");
  const [projectId, ...rest] = url.pathname.replace(/^\/project-media\/?/, "").split("/").filter(Boolean);
  const project = projectId ? await ctx.projects.findById(decodeURIComponent(projectId)) : null;
  if (!project?.storage_path || rest.length === 0) {
    sendError(res, new Error("not found"), 404);
    return;
  }

  const storageRoot = path.resolve(ctx.root, "data", "projects");
  const mediaRoot = path.resolve(storageRoot, ...project.storage_path.split("/"), "media");
  const target = path.normalize(path.join(mediaRoot, ...rest.map(decodeURIComponent)));
  // 项目媒体需要先根据 projectId 找到 storage_path，再限制在该项目 media 目录内。
  if (!mediaRoot.startsWith(storageRoot) || !target.startsWith(mediaRoot)) {
    sendError(res, new Error("not found"), 404);
    return;
  }
  try {
    await readFile(target);
    const type = mediaTypes[path.extname(target).toLowerCase()] ?? "application/octet-stream";
    res.writeHead(200, { "content-type": type });
    createReadStream(target).pipe(res);
  } catch {
    sendError(res, new Error("not found"), 404);
  }
}

/** 按分隔符拆分 Buffer，用于解析 multipart 表单。 */
function splitBuffer(value: Buffer, delimiter: Buffer): Buffer[] {
  const parts: Buffer[] = [];
  let start = 0;
  while (true) {
    const index = value.indexOf(delimiter, start);
    if (index < 0) {
      parts.push(value.subarray(start));
      break;
    }
    parts.push(value.subarray(start, index));
    start = index + delimiter.length;
  }
  return parts;
}

/** 从 multipart 分段头中读取指定头字段。 */
function headerValue(headers: string, name: string): string {
  const line = headers.split(/\r?\n/).find((item) => item.toLowerCase().startsWith(`${name.toLowerCase()}:`));
  return line?.slice(line.indexOf(":") + 1).trim() ?? "";
}

/** 从 Content-Disposition 中提取 filename 等参数。 */
function dispositionParam(value: string, name: string): string {
  const match = new RegExp(`${name}="([^"]*)"`).exec(value);
  return match?.[1] ?? "";
}

/** 解析 multipart 图片上传请求，并限制文件数量和单文件大小。 */
function parseMultipartImages(req: IncomingMessage, body: Buffer): UploadInput[] {
  const contentType = req.headers["content-type"] ?? "";
  const boundary = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(Array.isArray(contentType) ? contentType[0] : contentType)?.[1]
    ?? /boundary=(?:"([^"]+)"|([^;]+))/i.exec(Array.isArray(contentType) ? contentType[0] : contentType)?.[2];
  if (!boundary) throw new Error("missing multipart boundary");

  const uploads: UploadInput[] = [];
  for (const rawPart of splitBuffer(body, Buffer.from(`--${boundary}`))) {
    let part = rawPart;
    if (part.length === 0 || part.equals(Buffer.from("--\r\n")) || part.equals(Buffer.from("--"))) continue;
    if (part.subarray(0, 2).equals(Buffer.from("\r\n"))) part = part.subarray(2);
    if (part.subarray(part.length - 2).equals(Buffer.from("\r\n"))) part = part.subarray(0, part.length - 2);
    if (part.subarray(part.length - 2).equals(Buffer.from("--"))) part = part.subarray(0, part.length - 2);

    const headerEnd = part.indexOf(Buffer.from("\r\n\r\n"));
    if (headerEnd < 0) continue;
    const headers = part.subarray(0, headerEnd).toString("latin1");
    const disposition = headerValue(headers, "content-disposition");
    const filename = dispositionParam(disposition, "filename");
    if (!filename) continue;

    const bytes = part.subarray(headerEnd + 4);
    if (bytes.length > 10 * 1024 * 1024) throw new Error("single image must be less than 10MB");
    uploads.push({
      filename,
      contentType: headerValue(headers, "content-type") || "application/octet-stream",
      bytes,
    });
  }
  return uploads.slice(0, 8);
}

/** 处理图片附件上传，并返回本地媒体 URL。 */
async function handleUpload(ctx: AppContext, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readBody(req, 80 * 1024 * 1024);
  const uploads = parseMultipartImages(req, body);
  if (uploads.length === 0) throw new Error("missing image file");
  const stored = [];
  for (const upload of uploads) stored.push(await saveUploadedImage(ctx, upload));
  sendJson(res, stored);
}

/** 处理聊天请求，以 SSE 方式把模型回复片段推给前端。 */
async function handleChat(ctx: AppContext, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readJson(req);
  const conversationId = requireString(body.conversationId, "conversationId");
  const userText = requireString(body.message, "message");
  const attachments = Array.isArray(body.attachments)
    ? body.attachments.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
      .map((item) => ({
        name: typeof item.name === "string" ? item.name : "图片附件",
        size: typeof item.size === "number" ? item.size : 0,
        url: typeof item.url === "string" ? item.url : "",
      }))
      .filter((item) => item.url)
    : [];
  await addMessage(ctx, { conversation_id: conversationId, role: "user", content: userText, meta: { attachments } });

  const controller = new AbortController();
  ctx.aborts.set(conversationId, controller);
  // 聊天使用 SSE：服务端可以持续推送文本片段，前端实现比 WebSocket 更轻。
  res.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache",
    connection: "keep-alive",
  });
  req.on("close", () => controller.abort());

  let full = "";
  for await (const chunk of ctx.ai.chat({ conversationId, message: userText, model: DEFAULT_MODEL }, controller.signal)) {
    if (controller.signal.aborted) break;
    full += chunk.content;
    res.write(`data: ${JSON.stringify(chunk)}\n\n`);
  }
  if (full) {
    await addMessage(ctx, {
      conversation_id: conversationId,
      role: "assistant",
      content: full,
      meta: { model: DEFAULT_MODEL, tokens: estimateTokens(full) },
    });
  }
  ctx.aborts.delete(conversationId);
  res.write(`event: done\ndata: {}\n\n`);
  res.end();
}

/** 分发所有 /api 路径到具体业务函数。 */
async function handleApi(ctx: AppContext, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const method = req.method ?? "GET";
  const parts = routeParts(req);
  try {
    if (method === "GET" && parts.join("/") === "api/health") return sendJson(res, { status: "ok", config: getRuntimeConfig() });
    if (method === "GET" && parts.join("/") === "api/projects") return sendJson(res, await listProjects(ctx));
    if (method === "POST" && parts.join("/") === "api/projects") return sendJson(res, await createProject(ctx, await readJson(req)));
    if (method === "PUT" && parts[0] === "api" && parts[1] === "projects" && parts[2]) return sendJson(res, await updateProject(ctx, parts[2], await readJson(req) as Partial<Project>));
    if (method === "POST" && parts[0] === "api" && parts[1] === "projects" && parts[2] && parts[3] === "open-folder") return sendJson(res, await openProjectFolder(ctx, parts[2]));
    if (method === "DELETE" && parts[0] === "api" && parts[1] === "projects" && parts[2]) {
      await deleteProject(ctx, parts[2]);
      return sendJson(res, { deleted: true });
    }
    if (method === "GET" && parts.join("/") === "api/conversations") {
      const projectId = new URL(req.url ?? "/", "http://localhost").searchParams.get("projectId");
      return sendJson(res, await listConversations(ctx, projectId));
    }
    if (method === "POST" && parts.join("/") === "api/conversations") return sendJson(res, await createConversation(ctx, await readJson(req)));
    if (method === "PUT" && parts[0] === "api" && parts[1] === "conversations" && parts[2]) return sendJson(res, await updateConversation(ctx, parts[2], await readJson(req) as Partial<Conversation>));
    if (method === "DELETE" && parts[0] === "api" && parts[1] === "conversations" && parts[2]) {
      await deleteConversation(ctx, parts[2]);
      return sendJson(res, { deleted: true });
    }
    if (method === "GET" && parts[0] === "api" && parts[1] === "conversations" && parts[3] === "messages") {
      return sendJson(res, await ctx.messages.findMany({ conversation_id: parts[2] } as Partial<Message>, { sort: "asc" }));
    }
    if (method === "POST" && parts.join("/") === "api/chat") return handleChat(ctx, req, res);
    if (method === "POST" && parts.join("/") === "api/uploads") return handleUpload(ctx, req, res);
    if (method === "POST" && parts.join("/") === "api/chat/stop") {
      const body = await readJson(req);
      ctx.aborts.get(requireString(body.conversationId, "conversationId"))?.abort();
      return sendJson(res, { stopped: true });
    }
    if (method === "POST" && parts.join("/") === "api/chat/regenerate") {
      const body = await readJson(req);
      const conversationId = requireString(body.conversationId, "conversationId");
      const messages = await ctx.messages.findMany({ conversation_id: conversationId } as Partial<Message>, { sort: "desc" });
      const lastAssistant = messages.find((message) => message.role === "assistant");
      if (lastAssistant) await ctx.messages.delete(lastAssistant.id);
      const lastUser = messages.find((message) => message.role === "user");
      return sendJson(res, { conversationId, message: lastUser?.content ?? "" });
    }
    if (method === "POST" && parts.join("/") === "api/images/generate") return sendJson(res, await generateImage(ctx, await readJson(req)));
    if (method === "POST" && parts.join("/") === "api/images/local") return sendJson(res, await createLocalImageTask(ctx, await readJson(req)));
    if (method === "GET" && parts.join("/") === "api/images") {
      const conversationId = new URL(req.url ?? "/", "http://localhost").searchParams.get("conversationId");
      return sendJson(res, await listImages(ctx, conversationId ?? undefined));
    }
    if (method === "GET" && parts[0] === "api" && parts[1] === "images" && parts[2]) return sendJson(res, await queryImage(ctx, parts[2]));
    if (method === "DELETE" && parts[0] === "api" && parts[1] === "images" && parts[2]) {
      await ctx.images.delete(parts[2]);
      return sendJson(res, { deleted: true });
    }
    if (method === "POST" && parts.join("/") === "api/videos/generate") return sendJson(res, await generateVideo(ctx, await readJson(req)));
    if (method === "GET" && parts.join("/") === "api/videos") {
      const conversationId = new URL(req.url ?? "/", "http://localhost").searchParams.get("conversationId");
      return sendJson(res, await listVideos(ctx, conversationId ?? undefined));
    }
    if (method === "GET" && parts[0] === "api" && parts[1] === "videos" && parts[2]) return sendJson(res, await queryVideo(ctx, parts[2]));
    if (method === "DELETE" && parts[0] === "api" && parts[1] === "videos" && parts[2]) {
      await ctx.videos.delete(parts[2]);
      return sendJson(res, { deleted: true });
    }
    if (method === "GET" && parts.join("/") === "api/favorites") return sendJson(res, await ctx.favorites.findMany({}, { sort: "desc" }));
    if (method === "POST" && parts.join("/") === "api/favorites") return sendJson(res, await addFavorite(ctx, await readJson(req)));
    if (method === "DELETE" && parts[0] === "api" && parts[1] === "favorites" && parts[2]) {
      await ctx.favorites.delete(parts[2]);
      return sendJson(res, { deleted: true });
    }
    if (method === "GET" && parts.join("/") === "api/settings") return sendJson(res, await ctx.settings.get());
    if (method === "PUT" && parts.join("/") === "api/settings") return sendJson(res, await updateSettings(ctx, await readJson(req)));
    sendError(res, new Error("not found"), 404);
  } catch (error) {
    logLine(ctx, `ERROR ${(error as Error).stack ?? (error as Error).message ?? String(error)}`);
    sendError(res, error);
  }
}

/** 创建 Node HTTP Server，并挂载 API、媒体和静态页面路由。 */
export function createServer(ctx: AppContext): http.Server {
  return http.createServer(async (req, res) => {
    attachRequestLogger(ctx, req, res);
    applyCors(req, res);
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }
    if ((req.url ?? "").startsWith("/api/")) {
      await handleApi(ctx, req, res);
      return;
    }
    if ((req.url ?? "").startsWith("/media/")) {
      await serveMedia(ctx, req, res);
      return;
    }
    if ((req.url ?? "").startsWith("/project-media/")) {
      await serveProjectMedia(ctx, req, res);
      return;
    }
    await ensureConversation(ctx);
    await serveStatic(req, res);
  });
}
