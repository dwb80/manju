import { createReadStream } from "node:fs";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import http, { type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { rootLogger, withLogContext, logLineToFile } from "../logger.js";
import { getRuntimeConfig } from "../config/env.js";
import type { AppContext } from "../services/app.js";
import { addFavorite, addMessage, createConversation, createLocalImageTask, deleteConversation, ensureConversation, generateImage, generateVideo, listConversations, listImages, listVideos, openProjectFolder, queryImage, queryVideo, updateConversation, updateSettings } from "../services/domain.js";
import { createProject, listProjects, updateProject, deleteProject } from "../services/domain/project.js";
import { saveUploadedImage, type UploadInput } from "../services/media.js";
import { listCharacters, createCharacter, updateCharacter, deleteCharacter, restoreCharacter, listDeletedCharacters, permanentDeleteCharacters, batchDeleteCharacters, batchUpdateCharacters, listScenes, createScene, updateScene, deleteScene, restoreScene, listDeletedScenes, permanentDeleteScenes, batchDeleteScenes, batchUpdateScenes, listProps, createProp, updateProp, deleteProp, restoreProp, listDeletedProps, permanentDeleteProps, batchDeleteProps, batchUpdateProps, getCharacterUsage, getSceneUsage, getPropUsage, copyCharactersToProjects, copyScenesToProjects, copyPropsToProjects, listCharacterTemplatePresets, listSceneTemplatePresets, listPropTemplatePresets, listVersions, getVersion, restoreVersion, listStoryboards, createStoryboard, updateStoryboard, deleteStoryboard, softDeleteStoryboard, restoreStoryboard as restoreStoryboardById, listDeletedStoryboards, permanentDeleteStoryboard, copyStoryboardToProject, generateVideoFromStoryboard, listAudios, createAudio, updateAudio, deleteAudio, softDeleteAudio, restoreAudio as restoreAudioById, listDeletedAudios, permanentDeleteAudio, copyAudioToProject, generateTTS, listModuleVideoTasks, createModuleVideoTask, updateModuleVideoTask, deleteModuleVideoTask, softDeleteVideo, restoreVideo as restoreVideoById, listDeletedVideos, permanentDeleteVideo, copyVideoToProject, syncVideoTaskStatus, retryVideoTask, regenerateVideo, softDeleteClip, restoreClip, listDeletedClips, permanentDeleteClip, copyClipToProject, listScripts, createScript, updateScript as updateScriptRecord, deleteScript as deleteScriptRecord } from "../services/module-domain.js";
import { listScriptComments, createScriptComment, updateScriptComment, deleteScriptComment, listScriptDocuments, getScriptDocument, createScriptDocument, updateScriptDocument, deleteScriptDocument, listScriptEpisodes, listScriptScenes, createScriptEpisode, createScriptScene, createScriptDialogue } from "../services/script-center-impl.js";
import { matchFactoryRoute } from "./factory-router.js";
import { handleAITasksRouter } from "./ai-tasks-router.js";
import { handleDataRouter } from "./data-router.js";
import { handleModelsRouter } from "./models-router.js";
import { handlePublishRouter } from "./publish-router.js";
import { handlePipelineRouter } from "./pipeline-router.js";
import { analyzeScriptWithAI } from "../services/script-analyze-ai.js";
import { listProjectClips, createProjectClip, updateProjectClip, softDeleteProjectClip, syncProjectClipsFromStoryboards } from "../services/domain/storyboard.js";
import { recordAppLog } from "../services/audit-log.js";
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
  // 评审增量改造 P0：同时写 pino（stdout JSON）和原文件日志（兼容旧 grep）
  rootLogger.info({ event: "compat", msg: message });
  void logLineToFile(message);
}

/** 给每个请求挂上完成日志，记录方法、路径、状态码和耗时。 */
function attachRequestLogger(ctx: AppContext, req: IncomingMessage, res: ServerResponse, traceId: string): void {
  const started = Date.now();
  let logged = false;
  const method = req.method ?? "GET";
  const url = req.url ?? "/";
  const log = rootLogger.child({ traceId, method, url });
  /** 只记录一次请求结束事件，避免 finish 和 close 重复写日志。 */
  const finish = (event: "finish" | "close") => {
    if (logged) return;
    logged = true;
    const ms = Date.now() - started;
    const statusCode = res.statusCode;
    const level = statusCode >= 500 ? "error" : statusCode >= 400 ? "warn" : "info";
    log[level]({ event: "http.request", statusCode, durationMs: ms, lifecycle: event }, `${method} ${url} ${statusCode} ${ms}ms ${event}`);
    // 兼容旧 grep：单行写到 data/logs
    void logLineToFile(`${method} ${url} ${statusCode} ${ms}ms ${event} traceId=${traceId}`);
  };
  res.once("finish", () => finish("finish"));
  res.once("close", () => finish("close"));
}

/** 从请求头解析或生成 traceId（评审增量改造 P0）。 */
function resolveTraceId(req: IncomingMessage): string {
  const header = req.headers["x-request-id"];
  if (typeof header === "string" && header.trim().length > 0 && header.length <= 128) {
    return header.trim();
  }
  return `tr-${randomUUID()}`;
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

/** 统一错误码（评审 P1-H12 修复） */
const ERROR_CODE_BAD_REQUEST = 1002;
const ERROR_CODE_UNAUTHORIZED = 1003;
const ERROR_CODE_NOT_FOUND = 1004;
const ERROR_CODE_SERVER = 1005;

/** 把 HTTP 状态码映射到业务错误码。 */
function errorCodeForStatus(status: number): number {
  if (status === 400) return ERROR_CODE_BAD_REQUEST;
  if (status === 401 || status === 403) return ERROR_CODE_UNAUTHORIZED;
  if (status === 404) return ERROR_CODE_NOT_FOUND;
  if (status >= 500) return ERROR_CODE_SERVER;
  return 1001;
}

/** 发送统一格式的错误 JSON 响应。 */
function sendError(res: ServerResponse, error: unknown, status = 400): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ code: errorCodeForStatus(status), message: (error as Error).message ?? "error", data: null }));
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
    // 剧本模块（按项目隔离）
    if (method === "GET" && parts.join("/") === "api/scripts") {
      return sendJson(res, await listScripts(ctx));
    }
    if (method === "GET" && parts[0] === "api" && parts[1] === "projects" && parts[2] && parts[3] === "scripts") {
      return sendJson(res, await listScripts(ctx, parts[2]));
    }
    if (method === "POST" && parts[0] === "api" && parts[1] === "projects" && parts[2] && parts[3] === "scripts") {
      const body = await readJson(req);
      return sendJson(res, await createScript(ctx, { ...(body as any), project_id: parts[2] }));
    }
    if (method === "PUT" && parts[0] === "api" && parts[1] === "projects" && parts[2] && parts[3] === "scripts" && parts[4]) {
      return sendJson(res, await updateScriptRecord(ctx, parts[4], await readJson(req) as any));
    }
    if (method === "DELETE" && parts[0] === "api" && parts[1] === "projects" && parts[2] && parts[3] === "scripts" && parts[4]) {
      await deleteScriptRecord(ctx, parts[4]);
      return sendJson(res, { deleted: true });
    }
    // 剧本富文本结构（剧集/场景/对白）—— 给剧本导入用，POST 单条写入
    if (method === "POST" && parts.join("/") === "api/script-documents") {
      return sendJson(res, await createScriptDocument(ctx, await readJson(req) as any));
    }
    if (method === "GET" && parts.join("/") === "api/script-documents") {
      const projectId = new URL(req.url ?? "/", "http://localhost").searchParams.get("projectId") ?? undefined;
      return sendJson(res, await listScriptDocuments(ctx, projectId));
    }
    if (method === "GET" && parts[0] === "api" && parts[1] === "script-documents" && parts[2]) {
      const doc = await getScriptDocument(ctx, parts[2]);
      if (!doc) throw new Error("剧本文档不存在");
      return sendJson(res, doc);
    }
    if (method === "PUT" && parts[0] === "api" && parts[1] === "script-documents" && parts[2]) {
      return sendJson(res, await updateScriptDocument(ctx, parts[2], await readJson(req) as any));
    }
    if (method === "DELETE" && parts[0] === "api" && parts[1] === "script-documents" && parts[2]) {
      await deleteScriptDocument(ctx, parts[2]);
      return sendJson(res, { deleted: true });
    }
    if (method === "POST" && parts.join("/") === "api/script-episodes") {
      return sendJson(res, await createScriptEpisode(ctx, await readJson(req) as any));
    }
    if (method === "GET" && parts.join("/") === "api/script-episodes") {
      const url = new URL(req.url ?? "/", "http://localhost");
      const projectId = url.searchParams.get("projectId") ?? "";
      const documentId = url.searchParams.get("documentId") ?? undefined;
      // 若提供 documentId，先查出该 doc 所属项目，再用 projectId 过滤
      if (documentId) {
        const doc = await getScriptDocument(ctx, documentId);
        return sendJson(res, await listScriptEpisodes(ctx, doc?.project_id ?? projectId));
      }
      return sendJson(res, await listScriptEpisodes(ctx, projectId));
    }
    if (method === "POST" && parts.join("/") === "api/script-scenes") {
      return sendJson(res, await createScriptScene(ctx, await readJson(req) as any));
    }
    if (method === "GET" && parts.join("/") === "api/script-scenes") {
      const url = new URL(req.url ?? "/", "http://localhost");
      const projectId = url.searchParams.get("projectId") ?? undefined;
      const episodeId = url.searchParams.get("episodeId") ?? undefined;
      const documentId = url.searchParams.get("documentId") ?? undefined;
      // 若提供 documentId，则过滤出该 doc 的所有剧集下场景
      if (documentId) {
        const eps = await listScriptEpisodes(ctx, (await getScriptDocument(ctx, documentId))?.project_id ?? "");
        const epIds = new Set(eps.map((e) => e.id));
        const allScenes = await listScriptScenes(ctx, undefined, projectId);
        return sendJson(res, allScenes.filter((s) => epIds.has(s.episode_id)));
      }
      return sendJson(res, await listScriptScenes(ctx, episodeId, projectId));
    }
    if (method === "POST" && parts.join("/") === "api/script-dialogues") {
      return sendJson(res, await createScriptDialogue(ctx, await readJson(req) as any));
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
    if (method === "POST" && parts.join("/") === "api/ai/script-analyze") {
      const body = (await readJson(req)) as { content?: string; format?: string; useLocal?: boolean };
      return sendJson(res, await analyzeScriptWithAI(ctx, { content: body.content || "", format: body.format || "txt", useLocal: body.useLocal }));
    }
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
    // 客户端日志：前端批量上报 debug/info/warn/error，统一落到 file logger + app_logs。
    // 仅写 error / warn 级别到 app_logs（与 P1 业务事件审计区分），debug/info 仅写文件日志。
    if (method === "POST" && parts.join("/") === "api/client-logs") {
      const body = await readJson(req);
      const logs = Array.isArray(body.logs) ? body.logs : [];
      let received = 0;
      for (const item of logs) {
        if (!item || typeof item !== "object") continue;
        const level = typeof item.level === "string" ? item.level : "info";
        const moduleName = typeof item.module === "string" ? item.module : "frontend";
        const message = typeof item.message === "string" ? item.message : "";
        const payload = item.payload && typeof item.payload === "object" ? item.payload as Record<string, unknown> : {};
        const url = typeof item.url === "string" ? item.url : "";
        const userAgent = typeof item.userAgent === "string" ? item.userAgent : "";
        const sessionId = typeof item.sessionId === "string" ? item.sessionId : "";
        const pinoLevel: "debug" | "info" | "warn" | "error" = level === "error" ? "error" : level === "warn" ? "warn" : level === "debug" ? "debug" : "info";
        rootLogger[pinoLevel]({ event: "client.log", source: "frontend", module: moduleName, url, userAgent, sessionId, ...payload }, `[client][${moduleName}] ${message}`);
        if (level === "error" || level === "warn") {
          void recordAppLog(ctx, {
            entityType: "project",
            entityId: sessionId || url || "frontend",
            action: level === "error" ? "client.error" : "client.warn",
            event: level === "error" ? "client.error" : "client.warn",
            payload: { module: moduleName, message, url, userAgent, ...payload },
            operator: "frontend",
          });
        }
        received += 1;
      }
      return sendJson(res, { received });
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
    // 审计日志查询（评审增量改造 P2-2）：按 entity_type / action / 时间窗过滤。
    if (method === "GET" && parts.join("/") === "api/logs") {
      const url = new URL(req.url ?? "/", "http://localhost");
      const entityType = url.searchParams.get("entityType") ?? undefined;
      const action = url.searchParams.get("action") ?? undefined;
      const limit = Math.min(500, Math.max(1, Number(url.searchParams.get("limit") ?? "100")));
      const filter: Record<string, unknown> = {};
      if (entityType) filter.entity_type = entityType;
      if (action) filter.action = action;
      const items = await ctx.appLogs.findMany(filter, { sort: "desc", limit });
      return sendJson(res, items);
    }
    // 评审 P1-H9 修复：工厂类路由（角色/场景/道具/分镜/音频/视频/剪辑 GET）
    // 拆到 factory-router.ts，handleApi 保持扁平
    if (await matchFactoryRoute(ctx, req, res, {
      method,
      parts,
      readJson,
      sendJson,
      sendError,
    })) return;
    // ============ 剪辑模块（工业化 P0-3） ============
    // 顶层 CRUD：与分镜/视频/音频对齐，使用 ?projectId= 查询参数
    if (method === "GET" && parts.join("/") === "api/clips") {
      const projectId = new URL(req.url ?? "/", "http://localhost").searchParams.get("projectId") ?? undefined;
      if (!projectId) throw new Error("projectId 必填");
      return sendJson(res, await listProjectClips(ctx, projectId));
    }
    if (method === "POST" && parts.join("/") === "api/clips") {
      const body = await readJson(req);
      const projectId = requireString(body.project_id, "project_id");
      return sendJson(res, await createProjectClip(ctx, projectId, body as any));
    }
    if (method === "PUT" && parts[0] === "api" && parts[1] === "clips" && parts[2]) {
      const existing = await ctx.projectClips.findById(parts[2]);
      if (!existing) throw new Error("clip not found");
      const body = await readJson(req);
      return sendJson(res, await updateProjectClip(ctx, (existing as any).project_id, parts[2], body as any));
    }
    if (method === "DELETE" && parts[0] === "api" && parts[1] === "clips" && parts[2]) {
      const existing = await ctx.projectClips.findById(parts[2]);
      if (!existing) throw new Error("clip not found");
      await softDeleteProjectClip(ctx, (existing as any).project_id, parts[2]);
      return sendJson(res, { deleted: true });
    }
    if (method === "POST" && parts[0] === "api" && parts[1] === "clips" && parts[2] === "sync") {
      const body = await readJson(req);
      const projectId = requireString(body.project_id, "project_id");
      return sendJson(res, await syncProjectClipsFromStoryboards(ctx, projectId));
    }
    // 回收站（与三厂对齐：?projectId=）
    if (method === "GET" && parts[0] === "api" && parts[1] === "clips" && parts[2] === "deleted") {
      const projectId = new URL(req.url ?? "/", "http://localhost").searchParams.get("projectId") ?? undefined;
      return sendJson(res, await listDeletedClips(ctx, projectId));
    }
    if (method === "POST" && parts[0] === "api" && parts[1] === "clips" && parts[2] && parts[3] === "restore") {
      await restoreClip(ctx, parts[2]);
      return sendJson(res, { restored: true });
    }
    if (method === "POST" && parts[0] === "api" && parts[1] === "clips" && parts[2] === "permanent") {
      const body = await readJson(req);
      const ids = Array.isArray(body.ids) ? (body.ids as string[]) : [];
      for (const id of ids) await permanentDeleteClip(ctx, id);
      return sendJson(res, { deleted: ids.length });
    }
    if (method === "POST" && parts[0] === "api" && parts[1] === "clips" && parts[2] && parts[3] === "copy") {
      const body = await readJson(req);
      const targetProjectId = requireString(body.targetProjectId, "targetProjectId");
      return sendJson(res, await copyClipToProject(ctx, parts[2], targetProjectId));
    }
    // 剧本评论（任务8：评论持久化）
    if (method === "GET" && parts.join("/") === "api/script-comments") {
      const scriptId = new URL(req.url ?? "/", "http://localhost").searchParams.get("scriptId") ?? "";
      return sendJson(res, await listScriptComments(ctx, scriptId));
    }
    if (method === "POST" && parts.join("/") === "api/script-comments") return sendJson(res, await createScriptComment(ctx, await readJson(req) as any));
    if (method === "PUT" && parts[0] === "api" && parts[1] === "script-comments" && parts[2]) return sendJson(res, await updateScriptComment(ctx, parts[2], await readJson(req) as any));
    if (method === "DELETE" && parts[0] === "api" && parts[1] === "script-comments" && parts[2]) {
      await deleteScriptComment(ctx, parts[2]);
      return sendJson(res, { deleted: true });
    }
    // 资产模板/预设库（任务15：三厂共性 - 全局模板）
    if (method === "GET" && parts.join("/") === "api/templates/characters") return sendJson(res, await listCharacterTemplatePresets());
    if (method === "GET" && parts.join("/") === "api/templates/scenes") return sendJson(res, await listSceneTemplatePresets());
    if (method === "GET" && parts.join("/") === "api/templates/props") return sendJson(res, await listPropTemplatePresets());
    // 资产版本历史（任务12：三厂共性 - 统一版本管理）
    if (method === "GET" && parts.join("/") === "api/versions") {
      const url = new URL(req.url ?? "/", "http://localhost");
      const entityType = url.searchParams.get("entity_type") ?? "";
      const entityId = url.searchParams.get("entity_id") ?? "";
      if (!entityType || !entityId) throw new Error("entity_type 和 entity_id 必填");
      return sendJson(res, await listVersions(ctx, entityType as "character" | "scene" | "prop", entityId));
    }
    if (method === "GET" && parts[0] === "api" && parts[1] === "versions" && parts[2]) {
      return sendJson(res, await getVersion(ctx, parts[2]));
    }
    if (method === "POST" && parts[0] === "api" && parts[1] === "versions" && parts[2] && parts[3] === "restore") {
      const restored = await restoreVersion(ctx, parts[2]);
      return sendJson(res, restored);
    }
    // 委托到独立路由模块（ai-tasks / data / models / publish）
    if (parts[0] === "api" && parts[1] === "ai" && parts[2] === "tasks") {
      return handleAITasksRouter(ctx, req, res);
    }
    if (parts[0] === "api" && parts[1] === "data") {
      return handleDataRouter(ctx, req, res);
    }
    if (parts[0] === "api" && parts[1] === "models") {
      return handleModelsRouter(ctx, req, res);
    }
    if (parts[0] === "api" && parts[1] === "publish") {
      return handlePublishRouter(ctx, req, res);
    }
    if (parts[0] === "api" && parts[1] === "pipeline") {
      return handlePipelineRouter(ctx, req, res);
    }
    sendError(res, new Error("not found"), 404);
  } catch (error) {
    logLine(ctx, `ERROR ${(error as Error).stack ?? (error as Error).message ?? String(error)}`);
    sendError(res, error);
  }
}

/** 创建 Node HTTP Server，并挂载 API、媒体和静态页面路由。 */
export function createServer(ctx: AppContext): http.Server {
  return http.createServer(async (req, res) => {
    // 评审增量改造 P0：每个请求生成 traceId，AsyncLocalStorage 绑定，
    // 业务内任意 logger.child() 都自动带上 traceId，便于全链路关联。
    const traceId = resolveTraceId(req);
    res.setHeader("x-request-id", traceId);
    withLogContext({ traceId }, () => {
      // 同步完成所有操作（createServer 的 handler 是 async，用 .then() 处理）
      Promise.resolve(handleRequest(ctx, req, res, traceId)).catch((err) => {
        rootLogger.error({ event: "http.unhandled", err }, "unhandled error in request");
        try {
          if (!res.headersSent) {
            res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
            res.end(JSON.stringify({ code: 1005, message: (err as Error).message ?? "internal error", data: null }));
          }
        } catch {
          // ignore
        }
      });
    });
  });
}

/** 实际处理一个 HTTP 请求（被 createServer 包在 traceId 上下文中）。 */
async function handleRequest(
  ctx: AppContext,
  req: IncomingMessage,
  res: ServerResponse,
  traceId: string,
): Promise<void> {
  attachRequestLogger(ctx, req, res, traceId);
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
}
