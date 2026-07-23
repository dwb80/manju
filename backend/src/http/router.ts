/**
 * @file router.ts
 * @description HTTP 主路由模块
 *
 * 提供 Node.js HTTP 服务器的核心路由分发能力：
 * - API 路由：/api/* 下所有接口的请求分发和处理
 * - 静态文件：backend/public 目录下的前端资源服务
 * - 媒体文件：/media/* 和 /project-media/* 的图片视频访问
 * - 文件上传：multipart 图片上传和解析
 * - SSE 聊天：流式聊天响应推送
 *
 * 设计要点：
 * - 手写路由匹配（无框架依赖），性能优先
 * - 统一的 JSON 响应格式 { code, message, data }
 * - traceId 全链路追踪（AsyncLocalStorage）
 * - CORS 支持，允许前端开发服务器跨域调用
 */
import { createReadStream } from "node:fs";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import http, { type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { isDomainError } from "../domain/shared/domain-error.js";
import { rootLogger, withLogContext, logLineToFile } from "../logger.js";
import { getRuntimeConfig } from "../config/env.js";
import type { AppContext } from "../services/app.js";
import { AuthService, resolveAuthMode, type AuthPrincipal } from "../services/auth.js";
import { getRawDatabase } from "../storage/sqlite.js";
import { attachDebugHook } from "./request-debug.js";
import { domainErrorHttpStatus } from "./http-utils.js";
import { addFavorite, addMessage, createConversation, createLocalImageTask, deleteConversation, ensureConversation, generateImage, generateVideo, listConversations, listImages, listVideos, openProjectFolder, queryImage, queryVideo, updateConversation, updateSettings } from "../services/domain.js";
import { enhancePrompt } from "../services/domain/image.js";
import {
  createProject, listProjects, listDeletedProjects, updateProject, deleteProject, restoreProject, summarizeProject,
  listProjectTasks, createProjectTask, updateProjectTask, deleteProjectTask,
  listProjectMembers, createProjectMember, updateProjectMember, deleteProjectMember,
  listProjectIssues, createProjectIssue, updateProjectIssue, deleteProjectIssue,
  listProjectMilestones, createProjectMilestone, updateProjectMilestone, deleteProjectMilestone,
  exportProjectManifest, exportProjectPackageIndex,
} from "../services/domain/project.js";
import {
  listProjectEpisodes, createProjectEpisode, updateProjectEpisode, deleteProjectEpisode,
  listProjectScripts, listDeletedProjectScripts, createProjectScript, updateProjectScript, deleteProjectScript, restoreProjectScript, purgeProjectScript,
  breakdownProjectScript, exportProjectScriptsText,
} from "../services/domain/script.js";
import {
  listProjectReviews, createProjectReview, updateProjectReview, deleteProjectReview,
} from "../services/domain/review.js";
import {
  listProjectStoryboards, createProjectStoryboard, updateProjectStoryboard, deleteProjectStoryboard,
  batchUpdateProjectStoryboards, exportProjectStoryboardsCsv, exportProjectEditListCsv,
} from "../services/domain/storyboard.js";
import { saveUploadedImage, type UploadInput } from "../services/media.js";
import { listCharacters, createCharacter, updateCharacter, deleteCharacter, restoreCharacter, listDeletedCharacters, permanentDeleteCharacters, batchDeleteCharacters, batchUpdateCharacters, listScenes, createScene, updateScene, deleteScene, restoreScene, listDeletedScenes, permanentDeleteScenes, batchDeleteScenes, batchUpdateScenes, listProps, createProp, updateProp, deleteProp, restoreProp, listDeletedProps, permanentDeleteProps, batchDeleteProps, batchUpdateProps, getCharacterUsage, getSceneUsage, getPropUsage, copyCharactersToProjects, copyScenesToProjects, copyPropsToProjects, listCharacterTemplatePresets, listSceneTemplatePresets, listPropTemplatePresets, listVersions, getVersion, restoreVersion, listStoryboards, createStoryboard, updateStoryboard, deleteStoryboard, softDeleteStoryboard, restoreStoryboard as restoreStoryboardById, listDeletedStoryboards, permanentDeleteStoryboard, copyStoryboardToProject, generateVideoFromStoryboard, listAudios, createAudio, updateAudio, deleteAudio, softDeleteAudio, restoreAudio as restoreAudioById, listDeletedAudios, permanentDeleteAudio, copyAudioToProject, generateTTS, listModuleVideoTasks, createModuleVideoTask, updateModuleVideoTask, deleteModuleVideoTask, softDeleteVideo, restoreVideo as restoreVideoById, listDeletedVideos, permanentDeleteVideo, copyVideoToProject, syncVideoTaskStatus, retryVideoTask, regenerateVideo, softDeleteClip, restoreClip, listDeletedClips, permanentDeleteClip, copyClipToProject, listAssets, createAsset, updateAsset, deleteAsset } from "../services/module-domain.js";
import {
  listScriptComments, createScriptComment, updateScriptComment, deleteScriptComment,
  listScriptDocuments, getScriptDocument, createScriptDocument, updateScriptDocument, deleteScriptDocument, listDeletedScriptDocuments, restoreScriptDocument, purgeScriptDocument,
  listScriptEpisodes, listScriptScenes, createScriptEpisode, createScriptScene, createScriptDialogue, generateScriptWithAI, optimizeScriptWithAI,
  listScriptAnalyzedAssets, replaceScriptAnalyzedAssets, updateScriptAnalyzedCharacter, updateScriptAnalyzedScene, updateScriptAnalyzedProp, deleteScriptAnalyzedCharacter, deleteScriptAnalyzedScene, deleteScriptAnalyzedProp,
} from "../services/script-center-impl.js";
import { matchFactoryRoute } from "./factory-router.js";
import { matchConsistencyPackRoute } from "./consistency-pack-router.js";
import { handleAITasksRouter } from "./ai-tasks-router.js";
import { handleDataRouter } from "./data-router.js";
import { handleModelsRouter } from "./models-router.js";
import { handlePublishRouter } from "./publish-router.js";
import { handlePipelineRouter } from "./pipeline-router.js";
import { handleAssistantRouter } from "./assistant-router.js";
import { handleSlaRouter } from "./sla-router.js";
import { handleQualityRouter, deleteQualityAutoConfig } from "./quality-router.js";
import { handleErrorRecoveryRouter } from "./error-recovery-router.js";
import { handleMediaAccessRouter } from "./media-access-router.js";
import { handleRenderPresetsRouter } from "./render-presets-router.js";
import { handleModelConstraintsRouter } from "./model-constraints-router.js";
import { handleRoutePoliciesRouter } from "./route-policies-router.js";
import { handleMetricsRouter } from "./metrics-router.js";
import { handleAudioExtrasRouter } from "./audio-extras-router.js";
import { handleFinalVideosRouter } from "./final-videos-router.js";
import { handleTasksRouter } from "./tasks-router.js";
import { handleSubtitlesRouter } from "./subtitles-router.js";
import { handleTimelinesRouter } from "./timelines-router.js";
import { handleCostRouter } from "./cost-router.js";
import { handleReviewSnapshotsRouter } from "./review-snapshots-router.js";
import { handleTtsModelsRouter, handleCharacterVoiceRouter } from "./tts-models-router.js";
import { handleP2FeaturesRouter } from "./p2-features-router.js";
import { handleP1FeaturesRouter } from "./p1-features-router.js";
import { handleSecP1Router } from "./sec-p1-router.js";
import { handleSecP2Router } from "./sec-p2-router.js";
import { recordHttpPerformance } from "../services/horizontal/http-performance-service.js";
import { applySecurityHeaders, EndpointRateLimiter, enforceHttps, logRateLimit } from "../services/security/hardening.js";
import { assertAiPayloadSafe, assertMediaInputsSafe, assertTextSafe } from "../services/security/content-safety.js";
import { buildCspHeader, generateCspNonce, guardPrompt, recordAigcWatermark } from "../services/module-domain/sec-p1-service.js";
// import { handleAdminRouter } from "./admin-router.js";  // TODO: 恢复后启用
import { readJsonBody as readJson } from "./http-utils.js";
import { analyzeScriptWithAI } from "../services/script-analyze-ai.js";
import { listProjectClips, createProjectClip, updateProjectClip, softDeleteProjectClip, syncProjectClipsFromStoryboards } from "../services/domain/storyboard.js";
import { recordAppLog } from "../services/audit-log.js";
import type { Conversation, Message, Project, Todo, TodoStatus, TodoPriority } from "../types.js";
import { DEFAULT_MODEL, estimateTokens, id, nowIso, requireString, TimeoutError } from "../utils.js";
import type { ReviewItem, ReviewStatus, ReviewTargetType, RejectionReasonCode } from "../types/horizontal.js";

const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../public");
const requestPrincipals = new WeakMap<IncomingMessage, AuthPrincipal>();
const TODO_STATUSES = new Set<unknown>(["pending", "doing", "done"]);
const TODO_PRIORITIES = new Set<unknown>(["low", "medium", "high"]);

function requireRequestPrincipal(req: IncomingMessage): AuthPrincipal {
  const principal = requestPrincipals.get(req);
  if (!principal) throw new Error("无法识别当前登录用户");
  return principal;
}

function enforceEndpointRateLimit(limiter: EndpointRateLimiter, req: IncomingMessage, res: ServerResponse, userId = "anonymous"): boolean {
  const result = limiter.check(req, userId);
  if (result.limit === 0) return true;
  res.setHeader("x-ratelimit-limit", String(result.limit));
  res.setHeader("x-ratelimit-remaining", String(result.remaining));
  if (result.allowed) return true;
  res.setHeader("retry-after", String(result.retryAfter));
  logRateLimit(req, result.limit, result.retryAfter);
  sendError(res, new Error("请求过于频繁，请稍后重试"), 429);
  return false;
}

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

/**
 * logLine - 同时打印日志到终端和写入文件
 * @param {AppContext} ctx - 应用上下文
 * @param {string} message - 日志消息
 * @returns {void}
 */
function logLine(ctx: AppContext, message: string): void {
  // 评审增量改造 P0：同时写 pino（stdout JSON）和原文件日志（兼容旧 grep）
  rootLogger.info({ event: "compat", msg: message });
  void logLineToFile(message);
}

/**
 * attachRequestLogger - 为请求挂载完成日志记录器
 * @param {AppContext} ctx - 应用上下文
 * @param {IncomingMessage} req - HTTP 请求对象
 * @param {ServerResponse} res - HTTP 响应对象
 * @param {string} traceId - 请求追踪ID
 * @returns {void}
 * @description 在请求完成时记录方法、路径、状态码和耗时
 */
function attachRequestLogger(ctx: AppContext, req: IncomingMessage, res: ServerResponse, traceId: string): void {
  const started = Date.now();
  let logged = false;
  const method = req.method ?? "GET";
  const url = req.url ?? "/";
  const log = rootLogger.child({ traceId, method, url });
  // 请求开始时立即打 info 日志：30s+ 的长请求（脚本分析、生图、生视频）
  // 在还没结束时，运维 / 用户需要能看到"请求已进入"以便排查卡在哪一步。
  // 字段刻意保持小：traceId + method/url + ua，便于从大日志里 grep 同一请求。
  log.info(
    {
      event: "http.request.start",
      ua: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null,
      remoteAddr: req.socket?.remoteAddress ?? null,
    },
    `→ 收到请求：${method} ${url}`,
  );
  /** 只记录一次请求结束事件，避免 finish 和 close 重复写日志。 */
  const finish = (event: "finish" | "close") => {
    if (logged) return;
    logged = true;
    const ms = Date.now() - started;
    const statusCode = res.statusCode;
    const level = statusCode >= 500 ? "error" : statusCode >= 400 ? "warn" : "info";
    const lifecycleText = event === "finish" ? "正常结束" : "连接中断";
    log[level]({ event: "http.request", statusCode, durationMs: ms, lifecycle: event }, `${method} ${url} ${statusCode} ${ms}ms ${lifecycleText}`);
    // 兼容旧 grep：单行写到 data/logs
    const lifecycleZh = event === "finish" ? "完成" : "中断";
    void logLineToFile(`${method} ${url} ${statusCode} ${ms}ms ${lifecycleZh} traceId=${traceId}`);
  };
  res.once("finish", () => finish("finish"));
  res.once("close", () => finish("close"));
}

/**
 * resolveTraceId - 从请求头解析或生成 traceId
 * @param {IncomingMessage} req - HTTP 请求对象
 * @returns {string} traceId，优先使用请求头中的 x-request-id
 */
function resolveTraceId(req: IncomingMessage): string {
  const header = req.headers["x-request-id"];
  if (typeof header === "string" && header.trim().length > 0 && header.length <= 128) {
    return header.trim();
  }
  return `tr-${randomUUID()}`;
}

/**
 * readBody - 读取原始请求体，并限制最大字节数
 * @param {IncomingMessage} req - HTTP 请求对象
 * @param {number} maxBytes - 最大字节数限制
 * @returns {Promise<Buffer>} 请求体 Buffer
 * @throws {Error} 当请求体超过最大字节数时抛出错误
 */
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

/**
 * sendJson - 发送统一格式的成功 JSON 响应
 * @param {ServerResponse} res - HTTP 响应对象
 * @param {T} data - 响应数据
 * @param {number} status - HTTP 状态码，默认 200
 * @returns {void}
 */
function sendJson<T>(res: ServerResponse, data: T, status = 200): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ code: 0, message: "ok", data }));
}

/** 统一错误码（评审 P1-H12 修复） */
const ERROR_CODE_BAD_REQUEST = 1002;
const ERROR_CODE_UNAUTHORIZED = 1003;
const ERROR_CODE_NOT_FOUND = 1004;
const ERROR_CODE_SERVER = 1005;
const ERROR_CODE_BUDGET_EXCEEDED = 1010; // 项目预算硬上限超支（HTTP 402）
const ERROR_CODE_VALIDATION = 1007; // 入参校验失败（PROJ-001-008 错误码统一）
const ERROR_CODE_CONFLICT = 1008; // 状态冲突（如恢复未软删项目，PROJ-001-016）

/**
 * errorCodeForStatus - 将 HTTP 状态码映射到业务错误码
 * @param {number} status - HTTP 状态码
 * @returns {number} 业务错误码
 */
function errorCodeForStatus(status: number): number {
  if (status === 400) return ERROR_CODE_BAD_REQUEST;
  if (status === 401 || status === 403) return ERROR_CODE_UNAUTHORIZED;
  if (status === 402) return ERROR_CODE_BUDGET_EXCEEDED;
  if (status === 404) return ERROR_CODE_NOT_FOUND;
  if (status === 409) return ERROR_CODE_CONFLICT;
  if (status === 422) return ERROR_CODE_VALIDATION;
  if (status >= 500) return ERROR_CODE_SERVER;
  return 1001;
}

/**
 * errorStatusForMessage - 将业务错误消息映射到 HTTP 状态码（V2, REQ-PROJ-001, PROJ-001-008）
 * @param {string} message - 业务错误消息
 * @returns {number} HTTP 状态码；未知消息返回 400
 * @description 统一项目模块错误码到 HTTP 状态码的映射：
 *              - project_not_found → 404
 *              - project_not_deleted → 409（PROJ-001-016：恢复未软删项目冲突）
 *              - name_required / owner_required / project_type_invalid → 422
 *              - 旧 V1 兼容：`project not found`（带空格）等价 project_not_found
 *              - 其它 → 400
 */
function errorStatusForMessage(message: string): number {
  const normalized = message.trim().toLowerCase().replace(/\s+/g, "_");
  switch (normalized) {
    case "project_not_found":
    case "project_not_found_due_to_soft_delete":
      return 404;
    case "project_not_deleted":
    case "project_already_deleted":
      return 409;
    case "name_required":
    case "owner_required":
    case "project_type_invalid":
    case "invalid_project_storage_path":
      return 422;
    default:
      return 400;
  }
}

/**
 * sendError - 发送统一格式的错误 JSON 响应
 * @param {ServerResponse} res - HTTP 响应对象
 * @param {unknown} error - 错误对象
 * @param {number} status - HTTP 状态码，默认 400
 * @returns {void}
 */
function sendError(res: ServerResponse, error: unknown, status = 400): void {
  if (isDomainError(error)) {
    const domainStatus = domainErrorHttpStatus(error);
    res.writeHead(domainStatus, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({
      code: error.code,
      message: error.message,
      data: error.details,
    }));
    return;
  }
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ code: errorCodeForStatus(status), message: (error as Error).message ?? "error", data: null }));
}

/**
 * applyCors - 设置跨域响应头
 * @param {IncomingMessage} req - HTTP 请求对象
 * @param {ServerResponse} res - HTTP 响应对象
 * @returns {void}
 * @description 允许前端开发服务器跨域调用后端
 */
function applyCors(req: IncomingMessage, res: ServerResponse): boolean {
  const origin = req.headers.origin;
  const configured = (process.env.CORS_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const developmentDefaults = process.env.NODE_ENV === "production" ? [] : [
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    "http://localhost:3101",
    "http://127.0.0.1:3101",
  ];
  const allowed = new Set(configured.length > 0 ? configured : developmentDefaults);
  if (typeof origin === "string" && !allowed.has(origin)) return false;
  if (typeof origin === "string") {
    res.setHeader("access-control-allow-origin", origin);
    res.setHeader("access-control-allow-credentials", "true");
    res.setHeader("vary", "Origin");
  }
  res.setHeader("access-control-allow-methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type,authorization,x-csrf-token");
  res.setHeader("access-control-max-age", "86400");
  return true;
}

function requestProjectId(req: IncomingMessage): string | null {
  const url = new URL(req.url ?? "/", "http://localhost");
  const pathMatch = url.pathname.match(/^\/api\/projects\/([^/]+)/);
  const pipelineMatch = url.pathname.match(/^\/api\/pipeline\/([^/]+)\/state$/);
  const projectMediaMatch = url.pathname.match(/^\/project-media\/([^/]+)/);
  return pathMatch?.[1] ?? pipelineMatch?.[1] ?? projectMediaMatch?.[1] ?? url.searchParams.get("projectId");
}

async function requestResourceProjectId(ctx: AppContext, req: IncomingMessage): Promise<string | null> {
  const parts = routeParts(req);
  if (parts[0] !== "api" || !parts[1] || !parts[2]) return null;
  const resourceId = parts[2];
  const repositories = {
    characters: ctx.characters,
    scenes: ctx.scenes,
    props: ctx.props,
    storyboards: ctx.storyboards,
    audios: ctx.audios,
    "module-videos": ctx.moduleVideos,
    "character-images": ctx.characterImages,
    "scene-images": ctx.sceneImages,
    "prop-images": ctx.propImages,
    "character-image-history": ctx.characterImageHistory,
    "scene-image-history": ctx.sceneImageHistory,
    "prop-image-history": ctx.propImageHistory,
    shots: ctx.shots,
    "shot-snapshots": ctx.shotSnapshots,
    scripts: ctx.scripts,
    "project-scripts": ctx.projectScripts,
    assets: ctx.assets,
    reviews: ctx.reviews,
    "project-reviews": ctx.projectReviews,
    "project-tasks": ctx.projectTasks,
    "project-episodes": ctx.projectEpisodes,
    "project-issues": ctx.projectIssues,
    "project-milestones": ctx.projectMilestones,
    "project-clips": ctx.projectClips,
    "work-items": ctx.workItems,
    "publish-plans": ctx.publishPlans,
    "review-items": ctx.reviewItems,
    "publish-records": ctx.publishRecords,
    "cost-records": ctx.costRecords,
  } as const;
  const repository = repositories[parts[1] as keyof typeof repositories];
  if (!repository) return null;
  const reserved = new Set(["deleted", "permanent", "copy", "batch", "clear"]);
  if (reserved.has(resourceId)) return null;
  const record = await repository.findById(resourceId) as { project_id?: string } | null;
  return record?.project_id ?? null;
}

async function canAccessProject(ctx: AppContext, principal: AuthPrincipal, projectId: string): Promise<boolean> {
  if (principal.role === "admin") return true;
  const permission = await ctx.projectPermissions.findOne({ project_id: projectId });
  if (!permission || permission.visibility === "all") return true;
  if (permission.visibility === "admin_only") return false;
  try {
    const allowed = JSON.parse(permission.allowed_user_ids_json) as unknown;
    return Array.isArray(allowed) && allowed.includes(principal.userId);
  } catch {
    return false;
  }
}

async function requireProjectAccess(
  ctx: AppContext,
  req: IncomingMessage,
  res: ServerResponse,
  projectId: string | undefined,
): Promise<boolean> {
  if (!projectId || !(await canAccessProject(ctx, requireRequestPrincipal(req), projectId))) {
    sendError(res, new Error("无权访问该项目"), 403);
    return false;
  }
  return true;
}

function ownsPersonalRecord(record: { user_id?: string }, principal: AuthPrincipal): boolean {
  return record.user_id === principal.userId || (!record.user_id && principal.role === "admin");
}

async function requireOwnedConversation(ctx: AppContext, conversationId: string, principal: AuthPrincipal): Promise<Conversation | null> {
  const conversation = await ctx.conversations.findById(conversationId);
  return conversation && ownsPersonalRecord(conversation, principal) ? conversation : null;
}

async function enforceAuthorization(ctx: AppContext, auth: AuthService, req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const principal = auth.authenticate(req);
  if (!principal) {
    sendError(res, new Error("请先登录"), 401);
    return false;
  }
  requestPrincipals.set(req, principal);
  if (!auth.verifyCsrf(req, principal)) {
    sendError(res, new Error("CSRF 校验失败"), 403);
    return false;
  }
  const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
  const modelMutation = pathname.startsWith("/api/models") && !["GET", "HEAD", "OPTIONS"].includes(req.method ?? "GET");
  const adminOnly = pathname.startsWith("/api/admin/") || pathname === "/api/settings" || pathname === "/api/logs" || modelMutation;
  if (adminOnly && principal.role !== "admin") {
    sendError(res, new Error("仅管理员可访问系统管理接口"), 403);
    return false;
  }
  const unsafe = !["GET", "HEAD", "OPTIONS"].includes(req.method ?? "GET");
  if (unsafe && principal.role === "viewer") {
    sendError(res, new Error("只读用户不能执行写操作"), 403);
    return false;
  }
  const projectId = requestProjectId(req) ?? await requestResourceProjectId(ctx, req);
  if (projectId && !(await canAccessProject(ctx, principal, projectId))) {
    sendError(res, new Error("无权访问该项目"), 403);
    return false;
  }
  return true;
}

function buildHealth(ctx: AppContext, includeIntegrity = false): { status: "ok" | "degraded"; database: string; authMode: string; uptimeSeconds: number } {
  let database = "ok";
  try {
    const db = getRawDatabase(ctx.databaseFile);
    const row = includeIntegrity ? db.prepare("PRAGMA quick_check").get() : db.prepare("SELECT 1 AS ok").get();
    if (!row || (includeIntegrity && !Object.values(row).includes("ok"))) database = "failed";
  } catch {
    database = "failed";
  }
  return {
    status: database === "ok" ? "ok" : "degraded",
    database,
    authMode: resolveAuthMode(),
    uptimeSeconds: Math.floor(process.uptime()),
  };
}

/**
 * routeParts - 将请求 URL 拆分为路由片段
 * @param {IncomingMessage} req - HTTP 请求对象
 * @returns {string[]} 路由片段数组
 */
function routeParts(req: IncomingMessage): string[] {
  const url = new URL(req.url ?? "/", "http://localhost");
  return url.pathname.split("/").filter(Boolean);
}

/**
 * serveStatic - 提供 backend/public 下的静态文件服务
 * @param {IncomingMessage} req - HTTP 请求对象
 * @param {ServerResponse} res - HTTP 响应对象
 * @returns {Promise<void>}
 */
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

function isPathWithin(root: string, target: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

async function canAccessGlobalMedia(ctx: AppContext, pathname: string, principal: AuthPrincipal): Promise<boolean> {
  let segments: string[];
  try {
    segments = pathname.split("/").filter(Boolean).map(decodeURIComponent);
  } catch {
    return false;
  }
  if (segments[1] === "uploads") {
    const ownerId = segments[2] ?? "";
    if (ownerId.startsWith("usr-")) return ownerId === principal.userId;
    return principal.role === "admin";
  }

  const [images, videos] = await Promise.all([
    ctx.images.findMany({}, { sort: "desc" }),
    ctx.videos.findMany({}, { sort: "desc" }),
  ]);
  const imageTask = images.find((task) => task.image_urls.includes(pathname));
  if (imageTask) return ownsPersonalRecord(imageTask, principal);
  const videoTask = videos.find((task) => task.video_url === pathname || task.image_url === pathname);
  if (videoTask) return ownsPersonalRecord(videoTask, principal);
  return principal.role === "admin";
}

/**
 * serveMedia - 提供全局 data/media 下的图片、视频和上传文件
 * @param {AppContext} ctx - 应用上下文
 * @param {IncomingMessage} req - HTTP 请求对象
 * @param {ServerResponse} res - HTTP 响应对象
 * @returns {Promise<void>}
 */
async function serveMedia(ctx: AppContext, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (!(await canAccessGlobalMedia(ctx, url.pathname, requireRequestPrincipal(req)))) {
    sendError(res, new Error("not found"), 404);
    return;
  }
  const requested = decodeURIComponent(url.pathname.replace(/^\/media\/?/, ""));
  const target = path.normalize(path.join(ctx.mediaRoot, requested));
  // 静态媒体必须限制在 mediaRoot 内，避免 /media/../../ 读取任意文件。
  if (!isPathWithin(ctx.mediaRoot, target)) {
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

/**
 * serveProjectMedia - 提供项目目录下的图片和视频文件
 * @param {AppContext} ctx - 应用上下文
 * @param {IncomingMessage} req - HTTP 请求对象
 * @param {ServerResponse} res - HTTP 响应对象
 * @returns {Promise<void>}
 */
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
  if (!isPathWithin(storageRoot, mediaRoot) || !isPathWithin(mediaRoot, target)) {
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

/**
 * splitBuffer - 按分隔符拆分 Buffer
 * @param {Buffer} value - 待拆分的 Buffer
 * @param {Buffer} delimiter - 分隔符 Buffer
 * @returns {Buffer[]} 拆分后的 Buffer 数组
 */
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

/**
 * headerValue - 从 multipart 分段头中读取指定头字段
 * @param {string} headers - 分段头字符串
 * @param {string} name - 头字段名称
 * @returns {string} 头字段值
 */
function headerValue(headers: string, name: string): string {
  const line = headers.split(/\r?\n/).find((item) => item.toLowerCase().startsWith(`${name.toLowerCase()}:`));
  return line?.slice(line.indexOf(":") + 1).trim() ?? "";
}

/**
 * dispositionParam - 从 Content-Disposition 中提取参数
 * @param {string} value - Content-Disposition 字段值
 * @param {string} name - 参数名称
 * @returns {string} 参数值
 */
function dispositionParam(value: string, name: string): string {
  const match = new RegExp(`${name}="([^"]*)"`).exec(value);
  return match?.[1] ?? "";
}

/**
 * parseMultipartImages - 解析 multipart 图片上传请求
 * @param {IncomingMessage} req - HTTP 请求对象
 * @param {Buffer} body - 请求体 Buffer
 * @returns {UploadInput[]} 上传文件信息数组
 * @description 限制文件数量和单文件大小（单张图片上限 200MB，单次最多 4 张）
 */
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
    // 单张图片上限 200MB（与前端 MAX_REFERENCE_IMAGE_SIZE 对齐）。
    // 注意：Agnes 官方文档对参考图附件大小无硬限（10MB 是 base64 后的硬限,见 image queue input image size）；
    // 此 200MB 是后端传输防御,避免恶意大文件耗尽服务器内存/带宽。
    // 实际传给 Agnes 前,resolveMediaInput 会用 sharp 压缩到 9MB(base64)以内,base64 编码后也不会超 12MB。
    if (bytes.length > 200 * 1024 * 1024) throw new Error("single image must be less than 200MB");
    uploads.push({
      filename,
      contentType: headerValue(headers, "content-type") || "application/octet-stream",
      bytes,
    });
  }
  // 单次最多 4 张参考图（与前端 MAX_REFERENCE_IMAGES 对齐）
  return uploads.slice(0, 4);
}

/**
 * handleUpload - 处理图片附件上传，返回本地媒体 URL
 * @param {AppContext} ctx - 应用上下文
 * @param {IncomingMessage} req - HTTP 请求对象
 * @param {ServerResponse} res - HTTP 响应对象
 * @returns {Promise<void>}
 */
async function handleUpload(ctx: AppContext, req: IncomingMessage, res: ServerResponse): Promise<void> {
  // body 上限 = 200MB × 4 张 + multipart 开销 = 850MB（按 4 张 200MB 满载估算）
  const body = await readBody(req, 850 * 1024 * 1024);
  const uploads = parseMultipartImages(req, body);
  if (uploads.length === 0) throw new Error("missing image file");
  const stored = [];
  const principal = requireRequestPrincipal(req);
  for (const upload of uploads) stored.push(await saveUploadedImage(ctx, upload, principal.userId));
  sendJson(res, stored);
}

/**
 * handleChat - 处理聊天请求，以 SSE 方式推送模型回复
 * @param {AppContext} ctx - 应用上下文
 * @param {IncomingMessage} req - HTTP 请求对象
 * @param {ServerResponse} res - HTTP 响应对象
 * @returns {Promise<void>}
 * @description 使用 Server-Sent Events 实现流式聊天响应
 */
async function handleChat(ctx: AppContext, req: IncomingMessage, res: ServerResponse, principal: AuthPrincipal): Promise<void> {
  const body = await readJson(req);
  const conversationId = requireString(body.conversationId, "conversationId");
  if (!(await requireOwnedConversation(ctx, conversationId, principal))) {
    return sendError(res, new Error("conversation not found"), 404);
  }
  const userText = requireString(body.message, "message");
  const model = typeof body.model === "string" && body.model.trim()
    ? body.model.trim().slice(0, 120)
    : DEFAULT_MODEL;
  const temperature = typeof body.temperature === "number" && Number.isFinite(body.temperature)
    ? Math.min(2, Math.max(0, body.temperature))
    : undefined;
  const maxTokens = typeof body.max_tokens === "number" && Number.isFinite(body.max_tokens)
    ? Math.min(65_500, Math.max(1, Math.trunc(body.max_tokens)))
    : undefined;
  const attachments = Array.isArray(body.attachments)
    ? body.attachments.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
      .map((item) => ({
        name: typeof item.name === "string" ? item.name : "图片附件",
        type: typeof item.type === "string" ? item.type : "",
        size: typeof item.size === "number" ? item.size : 0,
        url: typeof item.url === "string" ? item.url : "",
      }))
      .filter((item) => item.url)
    : [];
  await assertTextSafe(ctx, userText, "input", conversationId);
  // SEC-AI-01：聊天入口强制 prompt injection 检测；命中 block 立即拒绝调用模型
  const guard = guardPrompt(ctx.databaseFile, principal.userId, userText);
  if (!guard.safe) {
    return sendError(res, new Error(`prompt_injection_blocked: ${guard.hits.map((h) => h.name).join(",")}`), 422);
  }
  assertMediaInputsSafe(attachments);
  await addMessage(ctx, { conversation_id: conversationId, role: "user", content: userText, meta: { attachments } });

  const controller = new AbortController();
  ctx.aborts.set(conversationId, controller);
  // 聊天使用 SSE：服务端可以持续推送文本片段，前端实现比 WebSocket 更轻。
  res.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache",
    connection: "keep-alive",
    "x-accel-buffering": "no",
  });
  res.flushHeaders();
  // 立即发送一个不含正文的事件，避免代理/浏览器等到模型首个 token 才交付响应头。
  res.write(`event: ready\ndata: ${JSON.stringify({ model })}\n\n`);
  res.on("close", () => {
    if (!res.writableEnded) controller.abort();
  });

  let full = "";
  let safetyBlocked = false;
  const startedAt = Date.now();
  let firstContentAt = 0;
  // 注意：SSE header 已经写完，这里的 for-await 抛错**不能**让 router 顶层兜底变 500，
  // 只能转成 SSE 错误事件推给前端，让前端 EventSource 拿到 error 后再 toast 提示用户。
  try {
    for await (const chunk of ctx.ai.chat({
      conversationId,
      message: userText,
      model,
      temperature,
      max_tokens: maxTokens,
    }, controller.signal)) {
      if (controller.signal.aborted) break;
      full += chunk.content;
      await assertTextSafe(ctx, full.slice(-2_000), "output", conversationId);
      if (!firstContentAt && chunk.content) {
        firstContentAt = Date.now();
        const firstContentMs = firstContentAt - startedAt;
        const log = firstContentMs < 5_000 ? rootLogger.info.bind(rootLogger) : rootLogger.warn.bind(rootLogger);
        log(
          { event: "chat.first_content", conversationId, model, firstContentMs, targetMs: 5_000 },
          `聊天首字耗时 ${firstContentMs}ms（目标 <5000ms）`,
        );
      }
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    }
  } catch (err) {
    safetyBlocked = (err as { code?: string })?.code === "content_policy_violation";
    // 不重抛，避免 router 顶层再写 500（这时 SSE header 已发出，写不进去会爆）
    const message = err instanceof Error ? err.message : String(err);
    rootLogger.error(
      { event: "chat.stream.failed", conversationId, err },
      `聊天流式响应失败（会话 ${conversationId}）：${message}`,
    );
    // 通过 SSE 推送错误事件；前端 EventSource 可在 onerror 中区分业务错误与连接断开
    if (!res.writableEnded) {
      try {
        res.write(`event: error\ndata: ${JSON.stringify({ message, name: err instanceof Error ? err.name : "Error" })}\n\n`);
      } catch {
        // ignore
      }
    }
  }
  if (full && !safetyBlocked) {
    try {
      // 4 中心横切：敏感词标红（详见 docs/spec.md 3.1）
      // 流式收完的全文做一次敏感词扫描，命中词写入消息 meta。
      // 前端读消息时根据 meta.sensitiveWords 数组做高亮展示。
      let sensitiveWords: string[] = [];
      try {
        const scan = await ctx.sensitiveWordService.check(full);
        if (scan.hit && scan.words.length > 0) {
          sensitiveWords = scan.words.map((w) => w.word);
          rootLogger.warn(
            { event: "chat.sensitive_hit", conversationId, count: sensitiveWords.length, words: sensitiveWords },
            `AI 回复命中敏感词：${sensitiveWords.join("、")}`,
          );
        }
      } catch (scanErr) {
        // 敏感词服务异常不阻塞消息持久化
        rootLogger.debug(
          { event: "chat.sensitive_scan_failed", err: String(scanErr) },
          "敏感词扫描失败，跳过标红",
        );
      }
      await addMessage(ctx, {
        conversation_id: conversationId,
        role: "assistant",
        content: full,
        meta: {
          model,
          tokens: estimateTokens(full),
          ...(sensitiveWords.length > 0 ? { sensitiveWords } : {}),
        },
      });
    } catch (err) {
      // 持久化失败不应阻塞用户：仅记日志
      rootLogger.warn(
        { event: "chat.persist_failed", conversationId, err },
        "聊天结束后持久化助手消息失败",
      );
    }
  }
  ctx.aborts.delete(conversationId);
  if (!res.writableEnded) {
    res.write(`event: done\ndata: {}\n\n`);
    res.end();
  }
}

/**
 * handleApi - 分发所有 /api 路径到具体业务函数
 * @param {AppContext} ctx - 应用上下文
 * @param {IncomingMessage} req - HTTP 请求对象
 * @param {ServerResponse} res - HTTP 响应对象
 * @returns {Promise<void>}
 */
async function handleApi(ctx: AppContext, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const method = req.method ?? "GET";
  const parts = routeParts(req);
  try {
    if (method === "GET" && parts.join("/") === "api/health") return sendJson(res, { ...buildHealth(ctx), config: getRuntimeConfig() });
    if (method === "GET" && parts.join("/") === "api/ready") {
      const health = buildHealth(ctx, true);
      return sendJson(res, health, health.status === "ok" ? 200 : 503);
    }
    if (method === "GET" && parts.join("/") === "api/projects") {
      const projects = await listProjects(ctx);
      const principal = requestPrincipals.get(req);
      if (!principal || principal.role === "admin") return sendJson(res, projects);
      const visible = [];
      for (const project of projects) {
        if (await canAccessProject(ctx, principal, project.id)) visible.push(project);
      }
      return sendJson(res, visible);
    }
    // V2 (REQ-PROJ-001, PROJ-001-015)：回收站端点
    // 必须放在通用 project 路由之前（parts[2]="trash" 不会被当作 projectId 处理）
    if (method === "GET" && parts[0] === "api" && parts[1] === "projects" && parts[2] === "trash" && !parts[3]) {
      return sendJson(res, await listDeletedProjects(ctx));
    }
    if (method === "POST" && parts.join("/") === "api/projects") return sendJson(res, await createProject(ctx, await readJson(req)));
    if (method === "PUT" && parts[0] === "api" && parts[1] === "projects" && parts[2] && !parts[3]) return sendJson(res, await updateProject(ctx, parts[2], await readJson(req) as Partial<Project>));
    if (method === "POST" && parts[0] === "api" && parts[1] === "projects" && parts[2] && parts[3] === "open-folder") return sendJson(res, await openProjectFolder(ctx, parts[2]));
    if (method === "DELETE" && parts[0] === "api" && parts[1] === "projects" && parts[2] && !parts[3]) {
      const result = await deleteProject(ctx, parts[2]);
      return sendJson(res, result);
    }
    // V2 (REQ-PROJ-001, PROJ-001-016)：恢复已软删项目
    if (method === "POST" && parts[0] === "api" && parts[1] === "projects" && parts[2] && parts[3] === "restore" && !parts[4]) {
      return sendJson(res, await restoreProject(ctx, parts[2]));
    }
    // ===== 项目工作台 =====
    // 所有嵌套资源都校验 projectId，避免跨项目读取或修改。
    if (parts[0] === "api" && parts[1] === "projects" && parts[2]) {
      const projectId = parts[2];
      const resource = parts[3];
      const resourceId = parts[4];
      const action = parts[5];

      if (method === "GET" && resource === "summary" && !resourceId) return sendJson(res, await summarizeProject(ctx, projectId));

      if (resource === "tasks") {
        if (method === "GET" && !resourceId) return sendJson(res, await listProjectTasks(ctx, projectId));
        if (method === "POST" && !resourceId) return sendJson(res, await createProjectTask(ctx, projectId, await readJson(req)));
        if (method === "PUT" && resourceId) return sendJson(res, await updateProjectTask(ctx, projectId, resourceId, await readJson(req)));
        if (method === "DELETE" && resourceId) { await deleteProjectTask(ctx, projectId, resourceId); return sendJson(res, { deleted: true }); }
      }
      if (resource === "members") {
        if (method === "GET" && !resourceId) return sendJson(res, await listProjectMembers(ctx, projectId));
        if (method === "POST" && !resourceId) return sendJson(res, await createProjectMember(ctx, projectId, await readJson(req)));
        if (method === "PUT" && resourceId) return sendJson(res, await updateProjectMember(ctx, projectId, resourceId, await readJson(req)));
        if (method === "DELETE" && resourceId) { await deleteProjectMember(ctx, projectId, resourceId); return sendJson(res, { deleted: true }); }
      }
      if (resource === "issues") {
        if (method === "GET" && !resourceId) return sendJson(res, await listProjectIssues(ctx, projectId));
        if (method === "POST" && !resourceId) return sendJson(res, await createProjectIssue(ctx, projectId, await readJson(req)));
        if (method === "PUT" && resourceId) return sendJson(res, await updateProjectIssue(ctx, projectId, resourceId, await readJson(req)));
        if (method === "DELETE" && resourceId) { await deleteProjectIssue(ctx, projectId, resourceId); return sendJson(res, { deleted: true }); }
      }
      if (resource === "milestones") {
        if (method === "GET" && !resourceId) return sendJson(res, await listProjectMilestones(ctx, projectId));
        if (method === "POST" && !resourceId) return sendJson(res, await createProjectMilestone(ctx, projectId, await readJson(req)));
        if (method === "PUT" && resourceId) return sendJson(res, await updateProjectMilestone(ctx, projectId, resourceId, await readJson(req)));
        if (method === "DELETE" && resourceId) { await deleteProjectMilestone(ctx, projectId, resourceId); return sendJson(res, { deleted: true }); }
      }
      if (resource === "episodes") {
        if (method === "GET" && !resourceId) return sendJson(res, await listProjectEpisodes(ctx, projectId));
        if (method === "POST" && !resourceId) return sendJson(res, await createProjectEpisode(ctx, projectId, await readJson(req)));
        if (method === "PUT" && resourceId) return sendJson(res, await updateProjectEpisode(ctx, projectId, resourceId, await readJson(req)));
        if (method === "DELETE" && resourceId) { await deleteProjectEpisode(ctx, projectId, resourceId); return sendJson(res, { deleted: true }); }
      }
      if (resource === "scripts") {
        if (method === "GET" && !resourceId) {
          const url = new URL(req.url ?? "/", "http://localhost");
          return sendJson(res, url.searchParams.get("deleted") === "1" ? await listDeletedProjectScripts(ctx, projectId) : await listProjectScripts(ctx, projectId));
        }
        if (method === "POST" && !resourceId) return sendJson(res, await createProjectScript(ctx, projectId, await readJson(req)));
        if (method === "PUT" && resourceId && !action) return sendJson(res, await updateProjectScript(ctx, projectId, resourceId, await readJson(req)));
        if (method === "DELETE" && resourceId && !action) return sendJson(res, await deleteProjectScript(ctx, projectId, resourceId));
        if (method === "POST" && resourceId && action === "restore") return sendJson(res, await restoreProjectScript(ctx, projectId, resourceId));
        if (method === "DELETE" && resourceId && action === "purge") return sendJson(res, await purgeProjectScript(ctx, projectId, resourceId));
      }
      if (resource === "reviews") {
        if (method === "GET" && !resourceId) {
          const url = new URL(req.url ?? "/", "http://localhost");
          return sendJson(res, await listProjectReviews(ctx, projectId, { target_type: url.searchParams.get("target_type"), target_id: url.searchParams.get("target_id") }));
        }
        if (method === "POST" && !resourceId) return sendJson(res, await createProjectReview(ctx, projectId, await readJson(req)));
        if (method === "PUT" && resourceId) return sendJson(res, await updateProjectReview(ctx, projectId, resourceId, await readJson(req)));
        if (method === "DELETE" && resourceId) { await deleteProjectReview(ctx, projectId, resourceId); return sendJson(res, { deleted: true }); }
      }
      if (resource === "storyboards") {
        if (method === "GET" && !resourceId) return sendJson(res, await listProjectStoryboards(ctx, projectId));
        if (method === "POST" && !resourceId) return sendJson(res, await createProjectStoryboard(ctx, projectId, await readJson(req)));
        if (method === "POST" && resourceId === "batch") return sendJson(res, await batchUpdateProjectStoryboards(ctx, projectId, await readJson(req)));
        if (method === "POST" && resourceId === "breakdown") return sendJson(res, await breakdownProjectScript(ctx, projectId, await readJson(req)));
        if (method === "PUT" && resourceId && !action) return sendJson(res, await updateProjectStoryboard(ctx, projectId, resourceId, await readJson(req)));
        if (method === "DELETE" && resourceId && !action) { await deleteProjectStoryboard(ctx, projectId, resourceId); return sendJson(res, { deleted: true }); }
        if (method === "POST" && resourceId && action === "generate-image") {
          const body = await readJson(req);
          await assertAiPayloadSafe(ctx, body, "input", resourceId);
          const task = await generateImage(ctx, { ...body, projectId });
          await updateProjectStoryboard(ctx, projectId, resourceId, { image_task_id: task.id, image_url: task.image_urls[0] ?? "", status: "image" });
          return sendJson(res, task);
        }
        if (method === "POST" && resourceId && action === "generate-video") {
          const body = await readJson(req);
          const storyboard = (await listProjectStoryboards(ctx, projectId)).find((item) => item.id === resourceId);
          if (!storyboard) throw new Error("project storyboard not found");
          const task = await generateVideo(ctx, { ...body, projectId, image: body.image ?? storyboard.image_url });
          await updateProjectStoryboard(ctx, projectId, resourceId, { video_task_id: task.id, video_url: task.video_url, status: "video" });
          return sendJson(res, task);
        }
      }
      if (resource === "clips") {
        if (method === "GET" && !resourceId) return sendJson(res, await listProjectClips(ctx, projectId));
        if (method === "POST" && !resourceId) return sendJson(res, await createProjectClip(ctx, projectId, await readJson(req)));
        if (method === "POST" && resourceId === "sync") return sendJson(res, await syncProjectClipsFromStoryboards(ctx, projectId));
        if (method === "PUT" && resourceId) return sendJson(res, await updateProjectClip(ctx, projectId, resourceId, await readJson(req)));
        if (method === "DELETE" && resourceId) { await softDeleteProjectClip(ctx, projectId, resourceId); return sendJson(res, { deleted: true }); }
      }
      if (resource === "exports") {
        if (method === "GET" && resourceId === "manifest.json") return sendJson(res, await exportProjectManifest(ctx, projectId));
        if (method === "POST" && resourceId === "package") return sendJson(res, await exportProjectPackageIndex(ctx, projectId));
        if (method === "GET" && resourceId === "storyboards.csv") {
          res.writeHead(200, { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="storyboards-${projectId}.csv"` });
          return void res.end(`\uFEFF${await exportProjectStoryboardsCsv(ctx, projectId)}`);
        }
        if (method === "GET" && resourceId === "edit-list.csv") {
          res.writeHead(200, { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="edit-list-${projectId}.csv"` });
          return void res.end(`\uFEFF${await exportProjectEditListCsv(ctx, projectId)}`);
        }
        if (method === "GET" && resourceId === "scripts.txt") {
          res.writeHead(200, { "content-type": "text/plain; charset=utf-8", "content-disposition": `attachment; filename="scripts-${projectId}.txt"` });
          return void res.end(await exportProjectScriptsText(ctx, projectId));
        }
      }
    }
    // ===== 项目资产（资产中心）=====
    // GET    /api/projects/:projectId/assets
    // POST   /api/projects/:projectId/assets
    // PUT    /api/projects/:projectId/assets/:assetId
    // DELETE /api/projects/:projectId/assets/:assetId
    if (method === "GET" && parts[0] === "api" && parts[1] === "projects" && parts[2] && parts[3] === "assets" && !parts[4]) {
      return sendJson(res, await listAssets(ctx, parts[2]));
    }
    if (method === "POST" && parts[0] === "api" && parts[1] === "projects" && parts[2] && parts[3] === "assets" && !parts[4]) {
      const body = await readJson(req) as Record<string, unknown>;
      return sendJson(res, await createAsset(ctx, { ...body, project_id: parts[2] }));
    }
    if (method === "PUT" && parts[0] === "api" && parts[1] === "projects" && parts[2] && parts[3] === "assets" && parts[4]) {
      return sendJson(res, await updateAsset(ctx, parts[4], await readJson(req) as any));
    }
    if (method === "DELETE" && parts[0] === "api" && parts[1] === "projects" && parts[2] && parts[3] === "assets" && parts[4]) {
      await deleteAsset(ctx, parts[4]);
      return sendJson(res, { deleted: true });
    }
    // 剧本富文本结构（剧集/场景/对白）—— 给剧本导入用，POST 单条写入
    if (method === "POST" && parts.join("/") === "api/script-documents") {
      const body = await readJson(req);
      const projectId = requireString(body.project_id, "project_id");
      if (!(await requireProjectAccess(ctx, req, res, projectId))) return;
      return sendJson(res, await createScriptDocument(ctx, body as any));
    }
    if (method === "GET" && parts.join("/") === "api/script-documents") {
      const url = new URL(req.url ?? "/", "http://localhost");
      const projectId = url.searchParams.get("projectId") ?? undefined;
      const deleted = url.searchParams.get("deleted");
      const documents = deleted === "1"
        ? await listDeletedScriptDocuments(ctx, projectId)
        : await listScriptDocuments(ctx, projectId);
      const principal = requireRequestPrincipal(req);
      if (principal.role === "admin" || projectId) return sendJson(res, documents);
      const visible = [];
      for (const document of documents) {
        if (await canAccessProject(ctx, principal, document.project_id)) visible.push(document);
      }
      return sendJson(res, visible);
    }
    if (method === "GET" && parts[0] === "api" && parts[1] === "script-documents" && parts[2] && !parts[3]) {
      const doc = await getScriptDocument(ctx, parts[2]);
      if (!doc) throw new Error("剧本文档不存在");
      if (!(await requireProjectAccess(ctx, req, res, doc.project_id))) return;
      return sendJson(res, doc);
    }
    if (method === "PUT" && parts[0] === "api" && parts[1] === "script-documents" && parts[2] && !parts[3]) {
      const doc = await getScriptDocument(ctx, parts[2]);
      if (!doc) throw new Error("剧本文档不存在");
      if (!(await requireProjectAccess(ctx, req, res, doc.project_id))) return;
      const body = await readJson(req);
      return sendJson(res, await updateScriptDocument(ctx, parts[2], { ...body, project_id: doc.project_id } as any));
    }
    if (method === "DELETE" && parts[0] === "api" && parts[1] === "script-documents" && parts[2] && !parts[3]) {
      const doc = await getScriptDocument(ctx, parts[2]);
      if (!doc) throw new Error("剧本文档不存在");
      if (!(await requireProjectAccess(ctx, req, res, doc.project_id))) return;
      await deleteScriptDocument(ctx, parts[2]);
      return sendJson(res, { deleted: true });
    }
    if (method === "POST" && parts[0] === "api" && parts[1] === "script-documents" && parts[2] && parts[3] === "restore") {
      const doc = await getScriptDocument(ctx, parts[2]);
      if (!doc) throw new Error("剧本文档不存在");
      if (!(await requireProjectAccess(ctx, req, res, doc.project_id))) return;
      return sendJson(res, await restoreScriptDocument(ctx, parts[2]));
    }
    if (method === "DELETE" && parts[0] === "api" && parts[1] === "script-documents" && parts[2] && parts[3] === "purge") {
      const doc = await getScriptDocument(ctx, parts[2]);
      if (!doc) throw new Error("剧本文档不存在");
      if (!(await requireProjectAccess(ctx, req, res, doc.project_id))) return;
      return sendJson(res, await purgeScriptDocument(ctx, parts[2]));
    }
    if (method === "POST" && parts.join("/") === "api/script-episodes") {
      const body = await readJson(req);
      const projectId = requireString(body.project_id, "project_id");
      if (!(await requireProjectAccess(ctx, req, res, projectId))) return;
      const doc = await getScriptDocument(ctx, requireString(body.document_id, "document_id"));
      if (!doc || doc.project_id !== projectId) return sendError(res, new Error("剧本文档不属于该项目"), 400);
      return sendJson(res, await createScriptEpisode(ctx, body as any));
    }
    if (method === "GET" && parts.join("/") === "api/script-episodes") {
      const url = new URL(req.url ?? "/", "http://localhost");
      const projectId = url.searchParams.get("projectId") ?? "";
      const documentId = url.searchParams.get("documentId") ?? undefined;
      if (documentId) {
        const doc = await getScriptDocument(ctx, documentId);
        if (!doc) throw new Error("剧本文档不存在");
        if (!(await requireProjectAccess(ctx, req, res, doc.project_id))) return;
      }
      // 若提供 documentId：按 document 严格过滤（避免拉到同项目下其他剧本/孤儿剧集）
      // 否则按 project 过滤（已自动排除孤儿剧集）
      return sendJson(res, await listScriptEpisodes(ctx, projectId, documentId));
    }
    if (method === "POST" && parts.join("/") === "api/script-scenes") {
      const body = await readJson(req);
      const projectId = requireString(body.project_id, "project_id");
      if (!(await requireProjectAccess(ctx, req, res, projectId))) return;
      const episode = await ctx.scriptEpisodes.findById(requireString(body.episode_id, "episode_id"));
      if (!episode || episode.project_id !== projectId) return sendError(res, new Error("剧集不属于该项目"), 400);
      return sendJson(res, await createScriptScene(ctx, body as any));
    }
    if (method === "GET" && parts.join("/") === "api/script-scenes") {
      const url = new URL(req.url ?? "/", "http://localhost");
      const projectId = url.searchParams.get("projectId") ?? undefined;
      const episodeId = url.searchParams.get("episodeId") ?? undefined;
      const documentId = url.searchParams.get("documentId") ?? undefined;
      // 防御：必须传 episodeId / projectId / documentId 至少一个，避免全表扫描
      if (!documentId && !episodeId && !projectId) {
        return sendError(
          res,
          new Error("必须提供 episodeId、projectId 或 documentId 至少一个"),
          400
        );
      }
      // 若提供 documentId，则过滤出该 doc 的所有剧集下场景
      if (documentId) {
        const doc = await getScriptDocument(ctx, documentId);
        if (!doc) throw new Error("剧本文档不存在");
        if (!(await requireProjectAccess(ctx, req, res, doc.project_id))) return;
        const docProjectId = doc?.project_id ?? projectId ?? "";
        if (!docProjectId) {
          return sendJson(res, []);
        }
        const eps = await listScriptEpisodes(ctx, docProjectId);
        if (eps.length === 0) return sendJson(res, []);
        // 按剧集逐个查场景,避免一次性加载整个项目的场景
        const scenesArrays = await Promise.all(
          eps.map((ep) => listScriptScenes(ctx, ep.id, docProjectId))
        );
        return sendJson(res, scenesArrays.flat());
      }
      if (episodeId && !projectId) {
        const episode = await ctx.scriptEpisodes.findById(episodeId);
        if (!episode) throw new Error("剧集不存在");
        if (!(await requireProjectAccess(ctx, req, res, episode.project_id))) return;
      }
      return sendJson(res, await listScriptScenes(ctx, episodeId, projectId));
    }
    if (method === "POST" && parts.join("/") === "api/script-dialogues") {
      const body = await readJson(req);
      const projectId = requireString(body.project_id, "project_id");
      if (!(await requireProjectAccess(ctx, req, res, projectId))) return;
      const scene = await ctx.scriptScenes.findById(requireString(body.scene_id, "scene_id"));
      if (!scene || scene.project_id !== projectId) return sendError(res, new Error("场景不属于该项目"), 400);
      return sendJson(res, await createScriptDialogue(ctx, body as any));
    }
    if (method === "GET" && parts.join("/") === "api/conversations") {
      const principal = requireRequestPrincipal(req);
      const projectId = new URL(req.url ?? "/", "http://localhost").searchParams.get("projectId");
      return sendJson(res, await listConversations(ctx, projectId, principal.userId, principal.role === "admin"));
    }
    if (method === "POST" && parts.join("/") === "api/conversations") {
      const principal = requireRequestPrincipal(req);
      const body = await readJson(req);
      const projectId = typeof body.project_id === "string" ? body.project_id : typeof body.projectId === "string" ? body.projectId : "";
      if (projectId && !(await canAccessProject(ctx, principal, projectId))) return sendError(res, new Error("无权访问该项目"), 403);
      return sendJson(res, await createConversation(ctx, { ...body, user_id: principal.userId }));
    }
    if (method === "PUT" && parts[0] === "api" && parts[1] === "conversations" && parts[2]) {
      const principal = requireRequestPrincipal(req);
      if (!(await requireOwnedConversation(ctx, parts[2], principal))) return sendError(res, new Error("conversation not found"), 404);
      const body = await readJson(req);
      if (typeof body.project_id === "string" && body.project_id && !(await canAccessProject(ctx, principal, body.project_id))) {
        return sendError(res, new Error("无权访问该项目"), 403);
      }
      const patch: Partial<Pick<Conversation, "title" | "is_pinned" | "model" | "project_id">> = {};
      if (typeof body.title === "string") patch.title = body.title;
      if (typeof body.is_pinned === "boolean") patch.is_pinned = body.is_pinned;
      if (typeof body.model === "string") patch.model = body.model;
      if (typeof body.project_id === "string") patch.project_id = body.project_id;
      return sendJson(res, await updateConversation(ctx, parts[2], patch));
    }
    if (method === "DELETE" && parts[0] === "api" && parts[1] === "conversations" && parts[2]) {
      const principal = requireRequestPrincipal(req);
      if (!(await requireOwnedConversation(ctx, parts[2], principal))) return sendError(res, new Error("conversation not found"), 404);
      await deleteConversation(ctx, parts[2]);
      return sendJson(res, { deleted: true });
    }
    if (method === "GET" && parts[0] === "api" && parts[1] === "conversations" && parts[3] === "messages") {
      const principal = requireRequestPrincipal(req);
      const conversation = await ctx.conversations.findById(parts[2]);
      if (conversation && !ownsPersonalRecord(conversation, principal)) return sendError(res, new Error("conversation not found"), 404);
      return sendJson(res, await ctx.messages.findMany({ conversation_id: parts[2] } as Partial<Message>, { sort: "asc" }));
    }
    if (method === "POST" && parts.join("/") === "api/chat") return handleChat(ctx, req, res, requireRequestPrincipal(req));
    if (method === "POST" && parts.join("/") === "api/ai/script-analyze") {
      const body = (await readJson(req)) as { content?: string; format?: string; useLocal?: boolean; timeoutMs?: number; model?: string };
      await assertAiPayloadSafe(ctx, body, "input", "script-analyze");
      // SEC-AI-01：AI 入口强制 prompt injection 检测
      const principal = requireRequestPrincipal(req);
      const guard = guardPrompt(ctx.databaseFile, principal.userId, body.content || "");
      if (!guard.safe) {
        return sendError(res, new Error(`prompt_injection_blocked: ${guard.hits.map((h) => h.name).join(",")}`), 422);
      }
      return sendJson(res, await analyzeScriptWithAI(ctx, {
        content: body.content || "",
        format: body.format || "txt",
        useLocal: body.useLocal,
        // 前端可通过 body.timeoutMs 覆盖 AI_TIMEOUTS.analyzeScript（默认 180s）
        // 用法：fetch('/api/ai/script-analyze', { body: JSON.stringify({ content, timeoutMs: 240000 }) })
        timeoutMs: body.timeoutMs,
        // 前端可通过 body.model 指定大模型；不传则走 DEFAULT_MODEL（agnes-2.0-flash）。
        // 返回的 data.model 字段会回填实际使用的模型 id，前端用这个展示"使用 xxx 解析成功"。
        model: body.model,
      }));
    }
    // 剧本分析提取资产 CRUD
    if (method === "GET" && parts[0] === "api" && parts[1] === "script-documents" && parts[2] && parts[3] === "analyzed-assets") {
      const doc = await getScriptDocument(ctx, parts[2]);
      if (!doc) throw new Error("剧本文档不存在");
      if (!(await requireProjectAccess(ctx, req, res, doc.project_id))) return;
      return sendJson(res, await listScriptAnalyzedAssets(ctx, parts[2]));
    }
    if (method === "PUT" && parts[0] === "api" && parts[1] === "script-documents" && parts[2] && parts[3] === "analyzed-assets") {
      const body = await readJson(req) as any;
      const doc = await getScriptDocument(ctx, parts[2]);
      if (!doc) throw new Error("剧本文档不存在");
      if (!(await requireProjectAccess(ctx, req, res, doc.project_id))) return;
      return sendJson(res, await replaceScriptAnalyzedAssets(ctx, parts[2], doc.project_id, {
        characters: body.characters || [],
        scenes: body.scenes || [],
        props: body.props || [],
      }));
    }
    if (method === "PATCH" && parts[0] === "api" && parts[1] === "analyzed-characters" && parts[2]) {
      const item = await ctx.scriptAnalyzedCharacters.findById(parts[2]);
      if (!item) throw new Error("分析角色不存在");
      if (!(await requireProjectAccess(ctx, req, res, item.project_id))) return;
      return sendJson(res, await updateScriptAnalyzedCharacter(ctx, parts[2], await readJson(req) as any));
    }
    if (method === "PATCH" && parts[0] === "api" && parts[1] === "analyzed-scenes" && parts[2]) {
      const item = await ctx.scriptAnalyzedScenes.findById(parts[2]);
      if (!item) throw new Error("分析场景不存在");
      if (!(await requireProjectAccess(ctx, req, res, item.project_id))) return;
      return sendJson(res, await updateScriptAnalyzedScene(ctx, parts[2], await readJson(req) as any));
    }
    if (method === "PATCH" && parts[0] === "api" && parts[1] === "analyzed-props" && parts[2]) {
      const item = await ctx.scriptAnalyzedProps.findById(parts[2]);
      if (!item) throw new Error("分析道具不存在");
      if (!(await requireProjectAccess(ctx, req, res, item.project_id))) return;
      return sendJson(res, await updateScriptAnalyzedProp(ctx, parts[2], await readJson(req) as any));
    }
    // 删除单条剧本中心分析资产（硬删：仅从当前剧本的视图移除，工厂资源不受影响）
    if (method === "DELETE" && parts[0] === "api" && parts[1] === "analyzed-characters" && parts[2]) {
      const item = await ctx.scriptAnalyzedCharacters.findById(parts[2]);
      if (!item) throw new Error("分析角色不存在");
      if (!(await requireProjectAccess(ctx, req, res, item.project_id))) return;
      await deleteScriptAnalyzedCharacter(ctx, parts[2]);
      return sendJson(res, { deleted: true });
    }
    if (method === "DELETE" && parts[0] === "api" && parts[1] === "analyzed-scenes" && parts[2]) {
      const item = await ctx.scriptAnalyzedScenes.findById(parts[2]);
      if (!item) throw new Error("分析场景不存在");
      if (!(await requireProjectAccess(ctx, req, res, item.project_id))) return;
      await deleteScriptAnalyzedScene(ctx, parts[2]);
      return sendJson(res, { deleted: true });
    }
    if (method === "DELETE" && parts[0] === "api" && parts[1] === "analyzed-props" && parts[2]) {
      const item = await ctx.scriptAnalyzedProps.findById(parts[2]);
      if (!item) throw new Error("分析道具不存在");
      if (!(await requireProjectAccess(ctx, req, res, item.project_id))) return;
      await deleteScriptAnalyzedProp(ctx, parts[2]);
      return sendJson(res, { deleted: true });
    }
    if (method === "POST" && parts.join("/") === "api/ai/script-optimize") {
      const body = await readJson(req);
      const content = typeof body.content === "string" ? body.content : "";
      const scriptId = typeof body.script_id === "string" ? body.script_id : undefined;
      if (!content.trim() && !scriptId) {
        return sendError(res, new Error("content 或 script_id 不能为空"), 400);
      }
      if (scriptId) {
        const doc = await getScriptDocument(ctx, scriptId);
        if (!doc) throw new Error("剧本文档不存在");
        if (!(await requireProjectAccess(ctx, req, res, doc.project_id))) return;
      }
      // SEC-AI-01：AI 入口强制 prompt injection 检测
      if (content) {
        const principal = requireRequestPrincipal(req);
        const guard = guardPrompt(ctx.databaseFile, principal.userId, content);
        if (!guard.safe) {
          return sendError(res, new Error(`prompt_injection_blocked: ${guard.hits.map((h) => h.name).join(",")}`), 422);
        }
      }
      return sendJson(res, await optimizeScriptWithAI(ctx, "local-user", body as any));
    }
    if (method === "POST" && parts.join("/") === "api/ai/script-generate") {
      const body = (await readJson(req)) as {
        prompt?: string;
        style?: string;
        genre?: string;
        length?: number;
        project_id?: string;
      };
      const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
      if (!prompt) {
        return sendError(res, new Error("prompt 不能为空"), 400);
      }
      if (body.project_id && !(await requireProjectAccess(ctx, req, res, body.project_id))) return;
      // SEC-AI-01：AI 入口强制 prompt injection 检测
      const principal = requireRequestPrincipal(req);
      const guard = guardPrompt(ctx.databaseFile, principal.userId, prompt);
      if (!guard.safe) {
        return sendError(res, new Error(`prompt_injection_blocked: ${guard.hits.map((h) => h.name).join(",")}`), 422);
      }
      return sendJson(res, await generateScriptWithAI(ctx, "local-user", {
        prompt,
        style: body.style,
        genre: body.genre,
        length: body.length,
        project_id: body.project_id,
      } as any));
    }
    if (method === "POST" && parts.join("/") === "api/uploads") return handleUpload(ctx, req, res);
    if (method === "POST" && parts.join("/") === "api/chat/stop") {
      const body = await readJson(req);
      const conversationId = requireString(body.conversationId, "conversationId");
      if (!(await requireOwnedConversation(ctx, conversationId, requireRequestPrincipal(req)))) return sendError(res, new Error("conversation not found"), 404);
      ctx.aborts.get(conversationId)?.abort();
      return sendJson(res, { stopped: true });
    }
    if (method === "POST" && parts.join("/") === "api/chat/regenerate") {
      const body = await readJson(req);
      const conversationId = requireString(body.conversationId, "conversationId");
      if (!(await requireOwnedConversation(ctx, conversationId, requireRequestPrincipal(req)))) return sendError(res, new Error("conversation not found"), 404);
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
        rootLogger[pinoLevel]({ event: "client.log", source: "frontend", module: moduleName, url, userAgent, sessionId, ...payload }, `[客户端][${moduleName}] ${message}`);
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
    if (method === "POST" && parts.join("/") === "api/images/generate") {
      const principal = requireRequestPrincipal(req);
      const body = await readJson(req);
      const conversationId = typeof body.conversationId === "string" ? body.conversationId : "";
      await assertAiPayloadSafe(ctx, body, "input", conversationId);
      if (conversationId && !(await requireOwnedConversation(ctx, conversationId, principal))) return sendError(res, new Error("conversation not found"), 404);
      return sendJson(res, await generateImage(ctx, { ...body, user_id: principal.userId }));
    }
    // ===== 提示词强化 =====
    // 角色图片生成器右侧「强化提示词」按钮使用。
    // 输入：{ prompt: string, mode?: "image" | "video" }；输出：{ prompt, enhanced, mode }。
    // 后端 chat 流式有 30s 超时（AI_TIMEOUTS.enhancePrompt），失败时返回 500。
    if (method === "POST" && parts.join("/") === "api/prompts/enhance") {
      const body = (await readJson(req)) as { prompt?: string; mode?: string };
      await assertAiPayloadSafe(ctx, body, "input", "prompt-enhance");
      return sendJson(res, await enhancePrompt(ctx, { prompt: body.prompt, mode: body.mode }));
    }
    if (method === "POST" && parts.join("/") === "api/images/local") {
      const principal = requireRequestPrincipal(req);
      const body = await readJson(req);
      const conversationId = typeof body.conversationId === "string" ? body.conversationId : "";
      if (conversationId && !(await requireOwnedConversation(ctx, conversationId, principal))) return sendError(res, new Error("conversation not found"), 404);
      return sendJson(res, await createLocalImageTask(ctx, { ...body, user_id: principal.userId }));
    }
    if (method === "GET" && parts.join("/") === "api/images") {
      const principal = requireRequestPrincipal(req);
      const conversationId = new URL(req.url ?? "/", "http://localhost").searchParams.get("conversationId");
      const conversation = conversationId ? await ctx.conversations.findById(conversationId) : null;
      if (conversation && !ownsPersonalRecord(conversation, principal)) return sendError(res, new Error("conversation not found"), 404);
      return sendJson(res, await listImages(ctx, conversationId ?? undefined, principal.userId, principal.role === "admin"));
    }
    if (method === "GET" && parts[0] === "api" && parts[1] === "images" && parts[2]) {
      const task = await ctx.images.findById(parts[2]);
      if (!task || !ownsPersonalRecord(task, requireRequestPrincipal(req))) return sendError(res, new Error("image not found"), 404);
      return sendJson(res, await queryImage(ctx, parts[2]));
    }
    if (method === "DELETE" && parts[0] === "api" && parts[1] === "images" && parts[2]) {
      const task = await ctx.images.findById(parts[2]);
      if (!task || !ownsPersonalRecord(task, requireRequestPrincipal(req))) return sendError(res, new Error("image not found"), 404);
      await ctx.images.delete(parts[2]);
      return sendJson(res, { deleted: true });
    }
    if (method === "POST" && parts.join("/") === "api/videos/generate") {
      const principal = requireRequestPrincipal(req);
      const body = await readJson(req);
      const conversationId = typeof body.conversationId === "string" ? body.conversationId : "";
      await assertAiPayloadSafe(ctx, body, "input", conversationId);
      if (conversationId && !(await requireOwnedConversation(ctx, conversationId, principal))) return sendError(res, new Error("conversation not found"), 404);
      return sendJson(res, await generateVideo(ctx, { ...body, user_id: principal.userId }));
    }
    if (method === "GET" && parts.join("/") === "api/videos") {
      const principal = requireRequestPrincipal(req);
      const conversationId = new URL(req.url ?? "/", "http://localhost").searchParams.get("conversationId");
      const conversation = conversationId ? await ctx.conversations.findById(conversationId) : null;
      if (conversation && !ownsPersonalRecord(conversation, principal)) return sendError(res, new Error("conversation not found"), 404);
      return sendJson(res, await listVideos(ctx, conversationId ?? undefined, principal.userId, principal.role === "admin"));
    }
    if (method === "GET" && parts[0] === "api" && parts[1] === "videos" && parts[2]) {
      const task = await ctx.videos.findById(parts[2]);
      if (!task || !ownsPersonalRecord(task, requireRequestPrincipal(req))) return sendError(res, new Error("video not found"), 404);
      return sendJson(res, await queryVideo(ctx, parts[2]));
    }
    if (method === "DELETE" && parts[0] === "api" && parts[1] === "videos" && parts[2]) {
      const task = await ctx.videos.findById(parts[2]);
      if (!task || !ownsPersonalRecord(task, requireRequestPrincipal(req))) return sendError(res, new Error("video not found"), 404);
      await ctx.videos.delete(parts[2]);
      return sendJson(res, { deleted: true });
    }
    if (method === "GET" && parts.join("/") === "api/favorites") {
      const principal = requireRequestPrincipal(req);
      const favorites = await ctx.favorites.findMany({}, { sort: "desc" });
      return sendJson(res, favorites.filter((favorite) => ownsPersonalRecord(favorite, principal)));
    }
    if (method === "POST" && parts.join("/") === "api/favorites") {
      const principal = requireRequestPrincipal(req);
      return sendJson(res, await addFavorite(ctx, await readJson(req), principal.userId));
    }
    if (method === "DELETE" && parts[0] === "api" && parts[1] === "favorites" && parts[2]) {
      const favorite = await ctx.favorites.findById(parts[2]);
      if (!favorite || !ownsPersonalRecord(favorite, requireRequestPrincipal(req))) return sendError(res, new Error("favorite not found"), 404);
      await ctx.favorites.delete(parts[2]);
      return sendJson(res, { deleted: true });
    }
    if (method === "GET" && parts.join("/") === "api/settings") {
      const settings = await ctx.settings.get();
      const { apiKey: _secret, ...publicSettings } = settings;
      return sendJson(res, { ...publicSettings, apiKeyConfigured: Boolean(settings.apiKey) });
    }
    if (method === "PUT" && parts.join("/") === "api/settings") {
      const settings = await updateSettings(ctx, await readJson(req));
      const { apiKey: _secret, ...publicSettings } = settings;
      return sendJson(res, { ...publicSettings, apiKeyConfigured: Boolean(settings.apiKey) });
    }
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
    if (await matchConsistencyPackRoute(ctx, req, res, {
      method,
      parts,
      readJson,
      sendJson,
      sendError,
      canAccessProject: (projectId) => canAccessProject(ctx, requireRequestPrincipal(req), projectId),
    })) return;
    if (await matchFactoryRoute(ctx, req, res, {
      method,
      parts,
      readJson,
      sendJson,
      sendError,
      canAccessProject: (projectId) => canAccessProject(ctx, requireRequestPrincipal(req), projectId),
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
      if (!(await requireProjectAccess(ctx, req, res, projectId))) return;
      return sendJson(res, await createProjectClip(ctx, projectId, body as any));
    }
    if (method === "PUT" && parts[0] === "api" && parts[1] === "clips" && parts[2]) {
      const existing = await ctx.projectClips.findById(parts[2]);
      if (!existing) throw new Error("clip not found");
      if (!(await requireProjectAccess(ctx, req, res, existing.project_id))) return;
      const body = await readJson(req);
      return sendJson(res, await updateProjectClip(ctx, (existing as any).project_id, parts[2], body as any));
    }
    if (method === "DELETE" && parts[0] === "api" && parts[1] === "clips" && parts[2]) {
      const existing = await ctx.projectClips.findById(parts[2]);
      if (!existing) throw new Error("clip not found");
      if (!(await requireProjectAccess(ctx, req, res, existing.project_id))) return;
      await softDeleteProjectClip(ctx, (existing as any).project_id, parts[2]);
      return sendJson(res, { deleted: true });
    }
    if (method === "POST" && parts[0] === "api" && parts[1] === "clips" && parts[2] === "sync") {
      const body = await readJson(req);
      const projectId = requireString(body.project_id, "project_id");
      if (!(await requireProjectAccess(ctx, req, res, projectId))) return;
      return sendJson(res, await syncProjectClipsFromStoryboards(ctx, projectId));
    }
    // 回收站（与三厂对齐：?projectId=）
    if (method === "GET" && parts[0] === "api" && parts[1] === "clips" && parts[2] === "deleted") {
      const projectId = new URL(req.url ?? "/", "http://localhost").searchParams.get("projectId") ?? undefined;
      if (!projectId) throw new Error("projectId 必填");
      return sendJson(res, await listDeletedClips(ctx, projectId));
    }
    if (method === "POST" && parts[0] === "api" && parts[1] === "clips" && parts[2] && parts[3] === "restore") {
      const existing = await ctx.projectClips.findById(parts[2]);
      if (!existing) throw new Error("clip not found");
      if (!(await requireProjectAccess(ctx, req, res, existing.project_id))) return;
      await restoreClip(ctx, parts[2]);
      return sendJson(res, { restored: true });
    }
    if (method === "POST" && parts[0] === "api" && parts[1] === "clips" && parts[2] === "permanent") {
      const body = await readJson(req);
      const ids = Array.isArray(body.ids) ? (body.ids as string[]) : [];
      for (const clipId of ids) {
        const existing = await ctx.projectClips.findById(clipId);
        if (!existing) throw new Error("clip not found");
        if (!(await requireProjectAccess(ctx, req, res, existing.project_id))) return;
      }
      for (const id of ids) await permanentDeleteClip(ctx, id);
      return sendJson(res, { deleted: ids.length });
    }
    if (method === "POST" && parts[0] === "api" && parts[1] === "clips" && parts[2] && parts[3] === "copy") {
      const body = await readJson(req);
      const targetProjectId = requireString(body.targetProjectId, "targetProjectId");
      const existing = await ctx.projectClips.findById(parts[2]);
      if (!existing) throw new Error("clip not found");
      if (!(await requireProjectAccess(ctx, req, res, existing.project_id))) return;
      if (!(await requireProjectAccess(ctx, req, res, targetProjectId))) return;
      return sendJson(res, await copyClipToProject(ctx, parts[2], targetProjectId));
    }
    // 剧本评论（任务8：评论持久化）
    if (method === "GET" && parts.join("/") === "api/script-comments") {
      const scriptId = new URL(req.url ?? "/", "http://localhost").searchParams.get("scriptId") ?? "";
      const doc = await getScriptDocument(ctx, scriptId);
      if (!doc) throw new Error("剧本文档不存在");
      if (!(await requireProjectAccess(ctx, req, res, doc.project_id))) return;
      return sendJson(res, await listScriptComments(ctx, scriptId));
    }
    if (method === "POST" && parts.join("/") === "api/script-comments") {
      const body = await readJson(req);
      const doc = await getScriptDocument(ctx, requireString(body.script_id, "script_id"));
      if (!doc) throw new Error("剧本文档不存在");
      if (!(await requireProjectAccess(ctx, req, res, doc.project_id))) return;
      return sendJson(res, await createScriptComment(ctx, body as any));
    }
    if (method === "PUT" && parts[0] === "api" && parts[1] === "script-comments" && parts[2]) {
      const comment = await ctx.scriptComments.findById(parts[2]);
      if (!comment) throw new Error("评论不存在");
      const doc = await getScriptDocument(ctx, comment.script_id);
      if (!doc) throw new Error("剧本文档不存在");
      if (!(await requireProjectAccess(ctx, req, res, doc.project_id))) return;
      return sendJson(res, await updateScriptComment(ctx, parts[2], await readJson(req) as any));
    }
    if (method === "DELETE" && parts[0] === "api" && parts[1] === "script-comments" && parts[2]) {
      const comment = await ctx.scriptComments.findById(parts[2]);
      if (!comment) throw new Error("评论不存在");
      const doc = await getScriptDocument(ctx, comment.script_id);
      if (!doc) throw new Error("剧本文档不存在");
      if (!(await requireProjectAccess(ctx, req, res, doc.project_id))) return;
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
    // === 我的待办（/api/todos） ===
    // GET /api/todos?status=&includeDeleted=true
    if (method === "GET" && parts[0] === "api" && parts[1] === "todos" && !parts[2]) {
      const principal = requireRequestPrincipal(req);
      const url = new URL(req.url ?? "/", "http://localhost");
      const status = url.searchParams.get("status") as TodoStatus | null;
      if (status && !TODO_STATUSES.has(status)) throw new Error("无效的待办状态");
      const includeDeleted = url.searchParams.get("includeDeleted") === "true";
      const all = await ctx.todos.findMany({ owner: principal.userId }, { sort: "desc" });
      const filtered = all.filter((t) => {
        if (!includeDeleted && t.deleted_at) return false;
        if (status && t.status !== status) return false;
        return true;
      });
      return sendJson(res, filtered);
    }
    // POST /api/todos
    if (method === "POST" && parts[0] === "api" && parts[1] === "todos" && !parts[2]) {
      const principal = requireRequestPrincipal(req);
      const body = await readJson(req);
      const status = body.status === undefined ? "pending" : body.status;
      const priority = body.priority === undefined ? "medium" : body.priority;
      if (!TODO_STATUSES.has(status)) throw new Error("无效的待办状态");
      if (!TODO_PRIORITIES.has(priority)) throw new Error("无效的待办优先级");
      const now = nowIso();
      const todo: Todo = {
        id: id("todo"),
        owner: principal.userId,
        title: requireString(body.title, "title"),
        description: typeof body.description === "string" ? body.description : "",
        status: status as TodoStatus,
        priority: priority as TodoPriority,
        due_date: typeof body.due_date === "string" ? body.due_date : "",
        link_type: typeof body.link_type === "string" ? body.link_type : "",
        link_id: typeof body.link_id === "string" ? body.link_id : "",
        link_url: typeof body.link_url === "string" ? body.link_url : "",
        created_at: now,
        updated_at: now,
        deleted_at: "",
      };
      await ctx.todos.insert(todo);
      return sendJson(res, todo);
    }
    // PUT /api/todos/:id
    if (method === "PUT" && parts[0] === "api" && parts[1] === "todos" && parts[2]) {
      const principal = requireRequestPrincipal(req);
      const existing = await ctx.todos.findById(parts[2]);
      if (!existing || existing.owner !== principal.userId) return sendError(res, new Error("todo not found"), 404);
      const body = await readJson(req);
      if (body.status !== undefined && !TODO_STATUSES.has(body.status)) throw new Error("无效的待办状态");
      if (body.priority !== undefined && !TODO_PRIORITIES.has(body.priority)) throw new Error("无效的待办优先级");
      const patch: Partial<Todo> = { updated_at: nowIso() };
      if (body.title !== undefined) patch.title = requireString(body.title, "title");
      for (const field of ["description", "due_date", "link_type", "link_id", "link_url"] as const) {
        if (body[field] !== undefined) {
          if (typeof body[field] !== "string") throw new Error(`${field} 必须是字符串`);
          patch[field] = body[field];
        }
      }
      if (body.status !== undefined) patch.status = body.status as TodoStatus;
      if (body.priority !== undefined) patch.priority = body.priority as TodoPriority;
      await ctx.todos.update(parts[2], patch);
      const updated = await ctx.todos.findById(parts[2]);
      return sendJson(res, updated);
    }
    // DELETE /api/todos/:id?hard=true
    if (method === "DELETE" && parts[0] === "api" && parts[1] === "todos" && parts[2]) {
      const principal = requireRequestPrincipal(req);
      const existing = await ctx.todos.findById(parts[2]);
      if (!existing || existing.owner !== principal.userId) return sendError(res, new Error("todo not found"), 404);
      const hard = new URL(req.url ?? "/", "http://localhost").searchParams.get("hard") === "true";
      if (hard) {
        await ctx.todos.delete(parts[2]);
      } else {
        await ctx.todos.update(parts[2], { deleted_at: nowIso() });
      }
      return sendJson(res, { deleted: true });
    }
    // POST /api/todos/:id/restore
    if (method === "POST" && parts[0] === "api" && parts[1] === "todos" && parts[2] && parts[3] === "restore") {
      const principal = requireRequestPrincipal(req);
      const existing = await ctx.todos.findById(parts[2]);
      if (!existing || existing.owner !== principal.userId) return sendError(res, new Error("todo not found"), 404);
      await ctx.todos.update(parts[2], { deleted_at: "", updated_at: nowIso() });
      return sendJson(res, { restored: true });
    }
    // === 审核中心（/api/reviews） ===
    // GET /api/reviews?projectId=&status=  → 列表
    if (method === "GET" && parts[0] === "api" && parts[1] === "reviews" && !parts[2]) {
      const url = new URL(req.url ?? "/", "http://localhost");
      const projectId = url.searchParams.get("projectId");
      const status = url.searchParams.get("status") as ReviewStatus | null;
      if (!projectId) throw new Error("projectId required");
      const items = status
        ? await ctx.reviewService.listByStatus(projectId, status)
        : await ctx.reviewItems.findMany({ project_id: projectId }, { sort: "desc" });
      return sendJson(res, items);
    }
    // GET /api/reviews/stats?projectId=  → 看板统计
    if (method === "GET" && parts[0] === "api" && parts[1] === "reviews" && parts[2] === "stats" && !parts[3]) {
      const url = new URL(req.url ?? "/", "http://localhost");
      const projectId = url.searchParams.get("projectId");
      if (!projectId) throw new Error("projectId required");
      return sendJson(res, await ctx.reviewService.stats(projectId));
    }
    // POST /api/reviews  → 提交审核（生产模块调用）
    if (method === "POST" && parts[0] === "api" && parts[1] === "reviews" && !parts[2]) {
      const body = await readJson(req);
      const principal = requireRequestPrincipal(req);
      const projectId = requireString(body.projectId, "projectId");
      if (!(await canAccessProject(ctx, principal, projectId))) {
        return sendError(res, new Error("无权访问该项目"), 403);
      }
      const item = await ctx.reviewService.submit({
        targetType: requireString(body.targetType, "targetType") as ReviewTargetType,
        targetId: requireString(body.targetId, "targetId"),
        projectId,
        submittedBy: principal.userId,
      });
      return sendJson(res, item);
    }
    // POST /api/reviews/:id/approve  → 通过
    if (method === "POST" && parts[0] === "api" && parts[1] === "reviews" && parts[2] && parts[3] === "approve") {
      const principal = requireRequestPrincipal(req);
      const review = await ctx.reviewItems.findById(parts[2]);
      if (review && !(await canAccessProject(ctx, principal, review.project_id))) {
        return sendError(res, new Error("无权访问该项目"), 403);
      }
      const item = await ctx.reviewService.approve(parts[2], principal.userId);
      return sendJson(res, item);
    }
    // POST /api/reviews/:id/reject  → 打回
    if (method === "POST" && parts[0] === "api" && parts[1] === "reviews" && parts[2] && parts[3] === "reject") {
      const body = await readJson(req);
      const principal = requireRequestPrincipal(req);
      const review = await ctx.reviewItems.findById(parts[2]);
      if (review && !(await canAccessProject(ctx, principal, review.project_id))) {
        return sendError(res, new Error("无权访问该项目"), 403);
      }
      const reasonCode = requireString(body.reasonCode, "reasonCode") as RejectionReasonCode;
      const item = await ctx.reviewService.reject(parts[2], principal.userId, reasonCode);
      return sendJson(res, item);
    }
    // 委托到独立路由模块（ai-tasks / data / models / publish）
    if (parts[0] === "api" && parts[1] === "ai" && parts[2] === "tasks") {
      const principal = requireRequestPrincipal(req);
      return handleAITasksRouter(ctx, req, res, {
        userId: principal.userId,
        isAdmin: principal.role === "admin",
        canAccessProject: (projectId) => canAccessProject(ctx, principal, projectId),
      });
    }
    if (
      parts[0] === "api" && parts[1] === "data" &&
      parts[2] !== "manual-work" && parts[2] !== "p2-metrics"
    ) {
      const principal = requireRequestPrincipal(req);
      return handleDataRouter(ctx, req, res, {
        userId: principal.userId,
        isAdmin: principal.role === "admin",
        canAccessProject: (projectId) => canAccessProject(ctx, principal, projectId),
      });
    }
    if (
      parts[0] === "api" &&
      parts[1] === "models" &&
      parts[2] !== "capabilities"
    ) {
      return handleModelsRouter(ctx, req, res);
    }
    if (parts[0] === "api" && parts[1] === "publish") {
      const principal = requireRequestPrincipal(req);
      return handlePublishRouter(ctx, req, res, {
        userId: principal.userId,
        isAdmin: principal.role === "admin",
        canAccessProject: (projectId) => canAccessProject(ctx, principal, projectId),
      });
    }
    if (parts[0] === "api" && parts[1] === "pipeline") {
      const principal = requireRequestPrincipal(req);
      return handlePipelineRouter(ctx, req, res, {
        userId: principal.userId,
        isAdmin: principal.role === "admin",
        canAccessProject: (projectId) => canAccessProject(ctx, principal, projectId),
      });
    }
    // V2 W8 REQ-PIPE-005-03 SLA 监控路由
    if (parts[0] === "api" && parts[1] === "sla") {
      const principal = requireRequestPrincipal(req);
      return handleSlaRouter(ctx, req, res, {
        userId: principal.userId,
        isAdmin: principal.role === "admin",
        canAccessProject: (projectId) => canAccessProject(ctx, principal, projectId),
      });
    }
    // V2 W6 REQ-PIPE-004-05 质检中心路由
    if (parts[0] === "api" && parts[1] === "quality") {
      const principal = requireRequestPrincipal(req);
      const access = {
        userId: principal.userId,
        isAdmin: principal.role === "admin",
        canAccessProject: (projectId: string) => canAccessProject(ctx, principal, projectId),
      };
      // DELETE 走单独 helper（router 内部用 query 解析 projectId）
      if ((req.method ?? "GET").toUpperCase() === "DELETE" && parts[2] === "auto-config") {
        return deleteQualityAutoConfig(ctx, req, res, access);
      }
      return handleQualityRouter(ctx, req, res, access);
    }
    // V2 W10 FEAT-PIPE-006：错误恢复路由（死信队列 / 熔断器 / 错误分类）
    if (parts[0] === "api" && parts[1] === "error-recovery") {
      const principal = requireRequestPrincipal(req);
      const access = {
        userId: principal.userId,
        isAdmin: principal.role === "admin",
        canAccessProject: (projectId: string) => canAccessProject(ctx, principal, projectId),
      };
      return handleErrorRecoveryRouter(ctx, req, res, access);
    }
    // V2 W11 RENDER-F03/F04 横/竖版 preset 路由
    if (parts[0] === "api" && parts[1] === "render" && parts[2] === "presets") {
      const principal = requireRequestPrincipal(req);
      const access = {
        userId: principal.userId,
        isAdmin: principal.role === "admin",
        canAccessProject: (projectId: string) => canAccessProject(ctx, principal, projectId),
      };
      return handleRenderPresetsRouter(ctx, req, res, access);
    }
    // V2 W11 MODEL-F01~F06 模型能力/参数约束路由
    if (parts[0] === "api" && parts[1] === "models" && parts[2] === "capabilities") {
      const principal = requireRequestPrincipal(req);
      const access = {
        userId: principal.userId,
        isAdmin: principal.role === "admin",
      };
      return handleModelConstraintsRouter(ctx, req, res, access);
    }
    // V2 W11 ROUTE-F01~F05 路由策略/决策日志路由
    if (parts[0] === "api" && parts[1] === "route") {
      const principal = requireRequestPrincipal(req);
      const access = {
        userId: principal.userId,
        isAdmin: principal.role === "admin",
      };
      return handleRoutePoliciesRouter(ctx, req, res, access);
    }
    // V2 W11 DATA-F01~F12 指标字典 + 12 个聚合 SQL 视图路由
    if (parts[0] === "api" && parts[1] === "metrics") {
      const principal = requireRequestPrincipal(req);
      const access = {
        userId: principal.userId,
        isAdmin: principal.role === "admin",
      };
      return handleMetricsRouter(ctx, req, res, access);
    }
    // V2 W11 AUDIO-F04/F06/F11/F13/F14 配音参数 + 候选 + 口型同步路由
    if (parts[0] === "api" && parts[1] === "audio") {
      const principal = requireRequestPrincipal(req);
      const access = {
        userId: principal.userId,
        isAdmin: principal.role === "admin",
      };
      return handleAudioExtrasRouter(ctx, req, res, access);
    }
    // V2 W11 P0 REQ-NF-F09：媒体鉴权代理
    if (parts[0] === "api" && parts[1] === "media" && parts[2] === "access") {
      const principal = requireRequestPrincipal(req);
      const access = {
        userId: principal.userId,
        isAdmin: principal.role === "admin",
        canAccessProject: (projectId: string) => canAccessProject(ctx, principal, projectId),
      };
      return handleMediaAccessRouter(ctx, req, res, access);
    }
    // V2 W11 P0 REQ-RENDER-F08/F09：成片版本 / 下载导出
    if (parts[0] === "api" && parts[1] === "final-videos") {
      const principal = requireRequestPrincipal(req);
      const access = {
        userId: principal.userId,
        isAdmin: principal.role === "admin",
        canAccessProject: (projectId: string) => canAccessProject(ctx, principal, projectId),
      };
      const urlObj = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
      // V2.1 P1-007：路由器现在只依赖 UseCase 端口（FinalVideoUseCases + internalAuth）
      const { createUseCases } = await import("../services/use-cases.js");
      const useCases = createUseCases(ctx);
      const handled = await handleFinalVideosRouter(
        useCases.finalVideo,
        ctx.internalAuth,
        req,
        res,
        { ...access, databaseFile: ctx.databaseFile },
        urlObj,
      );
      if (handled) return;
    }
    // V2 chapter 8 P1：审核协作、成本回填、模板生命周期与性能观测
    if (parts[0] === "api" && parts[1] === "p1") {
      const principal = requireRequestPrincipal(req);
      const handled = await handleP1FeaturesRouter(ctx, req, res, {
        userId: principal.userId,
        isAdmin: principal.role === "admin",
        canAccessProject: (projectId: string) => canAccessProject(ctx, principal, projectId),
      }, parts);
      if (handled) return;
    }
    // V2 chapter 8 P2：模板、账单对账、人工时长与复用率指标
    if (
      parts[0] === "api" &&
      ((parts[1] === "p2" && parts[2] === "templates") ||
        (parts[1] === "cost" && parts[2] === "reconciliations") ||
        (parts[1] === "data" && (parts[2] === "manual-work" || parts[2] === "p2-metrics")))
    ) {
      const principal = requireRequestPrincipal(req);
      const handled = await handleP2FeaturesRouter(ctx, req, res, {
        userId: principal.userId,
        isAdmin: principal.role === "admin",
        canAccessProject: (projectId: string) => canAccessProject(ctx, principal, projectId),
      }, parts);
      if (handled) return;
    }
    // V2 chapter 8.13 SEC P1: 安全相关端点（MFA / GDPR / 备份 / PII / Prompt guard / AIGC / sanitize / CSP）
    if (parts[0] === "api" && parts[1] === "sec") {
      const principal = requireRequestPrincipal(req);
      const secUrl = new URL(req.url ?? "/", "http://localhost");
      const handledP1 = await handleSecP1Router(req, res, {
        userId: principal.userId,
        isAdmin: principal.role === "admin",
      }, secUrl);
      if (handledP1) return;
      // SEC P2：深度伪造检测 + 人脸授权 + 相似度告警
      const handledP2 = await handleSecP2Router(req, res, {
        userId: principal.userId,
        isAdmin: principal.role === "admin",
        role: principal.role,
      }, secUrl);
      if (handledP2) return;
    }
    // V2 W12 P0 REQ-TASK-F11/F17/F18：任务路由
    if (parts[0] === "api" && parts[1] === "tasks") {
      const principal = requireRequestPrincipal(req);
      const access = {
        ok: true,
        principal: { userId: principal.userId, role: principal.role, isAdmin: principal.role === "admin" },
      };
      const handled = await handleTasksRouter(ctx, req, res, access, parts);
      if (handled) return;
    }
    // V2 W12 P0 REQ-AUDIO-F08/F09/F10：字幕路由
    if (parts[0] === "api" && parts[1] === "subtitles") {
      const principal = requireRequestPrincipal(req);
      const access = {
        ok: true,
        principal: { userId: principal.userId, role: principal.role, isAdmin: principal.role === "admin" },
      };
      const handled = await handleSubtitlesRouter(ctx, req, res, access, parts);
      if (handled) return;
    }
    // V2 W12 P0 REQ-EDIT-F01~F10：时间线路由
    if (parts[0] === "api" && parts[1] === "timelines") {
      const principal = requireRequestPrincipal(req);
      const access = {
        ok: true,
        principal: { userId: principal.userId, role: principal.role, isAdmin: principal.role === "admin" },
      };
      const handled = await handleTimelinesRouter(ctx, req, res, access, parts);
      if (handled) return;
    }
    // V2 W12 P0 REQ-COST-F10：成本聚合路由
    if (parts[0] === "api" && parts[1] === "cost" && parts[2] === "by-shot") {
      const principal = requireRequestPrincipal(req);
      const access = {
        ok: true,
        principal: { userId: principal.userId, role: principal.role, isAdmin: principal.role === "admin" },
      };
      const handled = await handleCostRouter(ctx, req, res, access, parts);
      if (handled) return;
    }
    // V2 W12 P0 REQ-REVIEW-F01：审核快照路由
    if (parts[0] === "api" && parts[1] === "review-snapshots") {
      const principal = requireRequestPrincipal(req);
      const access = {
        ok: true,
        principal: { userId: principal.userId, role: principal.role, isAdmin: principal.role === "admin" },
      };
      const handled = await handleReviewSnapshotsRouter(ctx, req, res, access, parts);
      if (handled) return;
    }
    // V2 W12 P0 REQ-AUDIO-F01/F02：TTS 模型 / 角色音色
    if (parts[0] === "api" && parts[1] === "tts") {
      const principal = requireRequestPrincipal(req);
      const access = {
        ok: true,
        principal: { userId: principal.userId, role: principal.role, isAdmin: principal.role === "admin" },
      };
      const handled = await handleTtsModelsRouter(ctx, req, res, access, parts);
      if (handled) return;
    }
    if (parts[0] === "api" && parts[1] === "characters" && parts[3] === "voice") {
      const principal = requireRequestPrincipal(req);
      const access = {
        ok: true,
        principal: { userId: principal.userId, role: principal.role, isAdmin: principal.role === "admin" },
      };
      const handled = await handleCharacterVoiceRouter(ctx, req, res, access, parts);
      if (handled) return;
    }
    if (parts[0] === "api" && parts[1] === "assistant") {
      const principal = requireRequestPrincipal(req);
      return handleAssistantRouter(ctx, req, res, principal, (projectId) => canAccessProject(ctx, principal, projectId));
    }
    if (parts[0] === "api" && parts[1] === "admin") {
      // TODO: 恢复 admin-router 后启用
      sendError(res, new Error("admin 路由尚未恢复"), 503);
      return;
    }
    sendError(res, new Error("not found"), 404);
  } catch (error) {
    logLine(ctx, `ERROR ${(error as Error).stack ?? (error as Error).message ?? String(error)}`);
    // 同样地，AI 流式超时需要 504 而不是默认 400，让外层 catch 只兜底其它真错误
    if (error instanceof TimeoutError) {
      sendError(res, error, 504);
    } else {
      // 业务错误（带 err.status 的 4xx）→ 透传 HTTP 状态码。
      // 兜底避免 4 中心横切的业务错误（如 budget_exceeded 402）被默认 400 吃掉。
      // 注意：这里只处理 sendError(res, error)（默认 400）的情况，
      // 已经有 status 4xx 的显式 sendError(res, error, status) 不受影响。
      // V2 (REQ-PROJ-001, PROJ-001-008)：当业务错误没有显式 status 但消息是项目模块
      // 已知错误码时（project_not_found / project_not_deleted / name_required 等），
      // 用 errorStatusForMessage 推导 HTTP 状态码，确保前端能用准确的 4xx 区分错误类型。
      const errorStatus = (error as Error & { status?: number })?.status;
      const errMessage = (error as Error)?.message ?? "";
      if (typeof errorStatus === "number" && errorStatus >= 400 && errorStatus < 500) {
        sendError(res, error, errorStatus);
      } else {
        const mappedStatus = errorStatusForMessage(errMessage);
        if (mappedStatus !== 400) {
          sendError(res, error, mappedStatus);
        } else {
          sendError(res, error);
        }
      }
    }
  }
}

/**
 * createServer - 创建 Node HTTP 服务器
 * @param {AppContext} ctx - 应用上下文
 * @returns {http.Server} HTTP 服务器实例
 * @description 创建并配置 HTTP 服务器，挂载 API、媒体和静态页面路由
 */
export function createServer(ctx: AppContext): http.Server {
  const auth = new AuthService(ctx.databaseFile, resolveAuthMode());
  const endpointRateLimiter = new EndpointRateLimiter();
  return http.createServer(async (req, res) => {
    const requestStartedAt = performance.now();
    res.once("finish", () => {
      try {
        recordHttpPerformance({
          path: new URL(req.url ?? "/", "http://localhost").pathname,
          method: req.method ?? "GET",
          durationMs: performance.now() - requestStartedAt,
          status: res.statusCode,
        });
      } catch { /* performance telemetry must never break requests */ }
    });
    // 评审增量改造 P0：每个请求生成 traceId，AsyncLocalStorage 绑定，
    // 业务内任意 logger.child() 都自动带上 traceId，便于全链路关联。
    const traceId = resolveTraceId(req);
    res.setHeader("x-request-id", traceId);
    withLogContext({ traceId }, () => {
      // 同步完成所有操作（createServer 的 handler 是 async，用 .then() 处理）
      Promise.resolve(handleRequest(ctx, auth, endpointRateLimiter, req, res, traceId)).catch((err) => {
        // AI 流式调用超时（withTimeout 抛 TimeoutError）→ 用 504 Gateway Timeout 区分
        // 真实服务故障（500）。否则前端只能看到 "Internal Server Error"，无法分辨
        // "AI 排队慢" vs "服务挂了"，定位成本极高。
        if (err instanceof TimeoutError) {
          rootLogger.warn({ event: "http.upstream_timeout", err: { message: err.message, op: err.operation, timeoutMs: err.timeoutMs } }, "上游 AI 服务响应超时");
          try {
            if (!res.headersSent) {
              res.writeHead(504, { "content-type": "application/json; charset=utf-8" });
              res.end(JSON.stringify({
                code: 1006,
                message: err.message ?? "AI 服务响应超时，请稍后重试",
                data: { timeoutMs: err.timeoutMs, operation: err.operation },
              }));
            }
          } catch {
            // ignore
          }
          return;
        }
        // 业务错误（带 err.status）→ 透传 HTTP 状态码。
        // 典型：预算超支 (402)、鉴权 (401/403)、未授权 (404)。
        // 范围限定 400-499，避免业务误把 5xx 也带上来。
        const status = (err as Error & { status?: number })?.status;
        if (typeof status === "number" && status >= 400 && status < 500) {
          const code = (err as Error & { code?: string })?.code;
          rootLogger.warn(
            { event: "http.business_error", status, code, err: { message: (err as Error).message } },
            `业务错误：${(err as Error).message}`,
          );
          try {
            if (!res.headersSent) {
              res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
              res.end(JSON.stringify({
                code: errorCodeForStatus(status),
                message: (err as Error).message ?? "error",
                data: code ? { code } : null,
              }));
            }
          } catch {
            // ignore
          }
          return;
        }
        rootLogger.error({ event: "http.unhandled", err }, "请求处理出现未捕获异常");
        try {
          if (!res.headersSent) {
            res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
            res.end(JSON.stringify({ code: 1005, message: "服务器内部错误", data: { traceId } }));
          }
        } catch {
          // ignore
        }
      });
    });
  });
}

/**
 * handleRequest - 实际处理一个 HTTP 请求
 * @param {AppContext} ctx - 应用上下文
 * @param {IncomingMessage} req - HTTP 请求对象
 * @param {ServerResponse} res - HTTP 响应对象
 * @param {string} traceId - 请求追踪ID
 * @returns {Promise<void>}
 * @description 被 createServer 包在 traceId 上下文中执行
 */
async function handleRequest(
  ctx: AppContext,
  auth: AuthService,
  endpointRateLimiter: EndpointRateLimiter,
  req: IncomingMessage,
  res: ServerResponse,
  traceId: string,
): Promise<void> {
  const startedAt = Date.now();
  attachRequestLogger(ctx, req, res, traceId);
  // debug hook：仅 LOG_LEVEL=debug 时真正抓 body/headers，
  // info 级别 attachDebugHook 内部直接 return，零开销
  attachDebugHook(req, res, traceId, startedAt);
  // SEC-TRANS-04 + SEC-TRANS-02：所有 API 路径统一下发安全响应头与 CSP nonce
  // （health/ready/auth 等快捷路径也覆盖），L2120 的二次下发用于保持 CSP nonce 真正随机（每次请求重生成）
  applySecurityHeaders(res);
  if (!enforceHttps(req, res)) return;
  // SEC-TRANS-04：一次性下发完整安全响应头（frame-ancestors via CSP + referrer-policy
  // strict-origin-when-cross-origin + permissions-policy + COOP/COEP/CORP + nosniff + DENY）。
  applySecurityHeaders(res);
  // SEC-TRANS-02：每个请求生成 CSP nonce，注入到 Content-Security-Policy 头
  // 与 X-CSP-Nonce 头（前端可读，用于内联 <script nonce=…>）。
  const cspNonce = generateCspNonce();
  res.setHeader("content-security-policy", buildCspHeader(cspNonce).replace(/^Content-Security-Policy(?:-Report-Only)?:\s*/, ""));
  res.setHeader("x-csp-nonce", cspNonce);
  if (!applyCors(req, res)) {
    res.writeHead(403, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ code: ERROR_CODE_UNAUTHORIZED, message: "不允许的请求来源", data: { traceId } }));
    return;
  }
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  if ((req.url ?? "").startsWith("/api/auth/")) {
    if (!enforceEndpointRateLimit(endpointRateLimiter, req, res)) return;
    await auth.handleRoute(req, res);
    return;
  }
  if ((req.url ?? "").startsWith("/api/health") || (req.url ?? "").startsWith("/api/ready")) {
    await handleApi(ctx, req, res);
    return;
  }
  if ((req.url ?? "").startsWith("/api/") || (req.url ?? "").startsWith("/media/") || (req.url ?? "").startsWith("/project-media/")) {
    if (!(await enforceAuthorization(ctx, auth, req, res))) return;
    if (!enforceEndpointRateLimit(endpointRateLimiter, req, res, requireRequestPrincipal(req).userId)) return;
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
