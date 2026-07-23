/**
 * @file assistant-router.ts
 * @description 智能助手 HTTP 路由：会话/消息/收藏（个人维度）
 *
 * 路由：
 *  - GET    /api/assistant/conversations?mode=chat|image|video
 *  - POST   /api/assistant/conversations
 *  - PUT    /api/assistant/conversations/:id
 *  - DELETE /api/assistant/conversations/:id
 *  - GET    /api/assistant/conversations/:id/messages
 *  - POST   /api/assistant/conversations/:id/messages
 *  - PATCH  /api/assistant/messages/:id/feedback
 *  - GET    /api/assistant/favorites?type=
 *  - POST   /api/assistant/favorites
 *  - DELETE /api/assistant/favorites/:id
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AppContext } from "../services/app.js";
import type { AuthPrincipal } from "../services/auth.js";
import { rootLogger } from "../logger.js";
import { id, nowIso } from "../utils.js";
import { readJsonBody as readJson } from "./http-utils.js";

function sendJson(res: ServerResponse, data: unknown, status = 200): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ code: 0, message: "ok", data }));
}

function sendError(res: ServerResponse, error: Error, status = 400): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ code: status, message: error.message, data: null }));
}

function requireString(value: unknown, name: string): string {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  throw new Error(`${name} 不能为空`);
}

function ownsPersonalRecord(record: any, principal: AuthPrincipal): boolean {
  return record.user_id === principal.userId || (!record.user_id && principal.role === "admin");
}

async function requireOwnedConversation(
  ctx: AppContext,
  conversationId: string,
  principal: AuthPrincipal,
): Promise<any> {
  const conversation = await ctx.conversations.findById(conversationId);
  if (!conversation || !ownsPersonalRecord(conversation, principal)) {
    throw new Error("会话不存在");
  }
  return conversation;
}

async function createAssistantConversation(
  ctx: AppContext,
  body: any,
  principal: AuthPrincipal,
): Promise<any> {
  const now = nowIso();
  const mode = body.mode || "chat";
  const validMode = ["chat", "image", "video"].includes(mode) ? mode : "chat";
  const conversation = {
    id: id("conv"),
    user_id: principal.userId,
    title:
      typeof body.title === "string" && body.title.trim()
        ? body.title.trim()
        : `新的${mode === "chat" ? "对话" : mode === "image" ? "图片" : "视频"}会话`,
    model: typeof body.model === "string" ? body.model : "",
    mode: validMode,
    is_pinned: false,
    created_at: now,
    updated_at: now,
    project_id: typeof body.project_id === "string" ? body.project_id : "",
    unread_count: 0,
  };
  await ctx.conversations.insert(conversation);
  return conversation;
}

async function listAssistantConversations(
  ctx: AppContext,
  principal: AuthPrincipal,
  mode: string | null,
): Promise<any[]> {
  const all = await ctx.conversations.findMany({}, { sort: "desc" });
  const owned = all.filter((c: any) => ownsPersonalRecord(c, principal));
  return mode ? owned.filter((c: any) => c.mode === mode) : owned;
}

async function updateAssistantConversation(
  ctx: AppContext,
  conversationId: string,
  body: any,
  principal: AuthPrincipal,
): Promise<any> {
  await requireOwnedConversation(ctx, conversationId, principal);
  const patch: Record<string, unknown> = {};
  if (typeof body.title === "string") patch.title = body.title;
  if (typeof body.model === "string") patch.model = body.model;
  if (typeof body.mode === "string" && ["chat", "image", "video"].includes(body.mode)) {
    patch.mode = body.mode;
  }
  if (typeof body.is_pinned === "boolean") patch.is_pinned = body.is_pinned;
  if (typeof body.project_id === "string") patch.project_id = body.project_id;
  if (
    typeof body.unread_count === "number" &&
    Number.isFinite(body.unread_count) &&
    body.unread_count >= 0
  ) {
    patch.unread_count = Math.floor(body.unread_count);
  }
  patch.updated_at = nowIso();
  await ctx.conversations.update(conversationId, patch as any);
  return await ctx.conversations.findById(conversationId);
}

async function deleteAssistantConversation(
  ctx: AppContext,
  conversationId: string,
  principal: AuthPrincipal,
): Promise<void> {
  await requireOwnedConversation(ctx, conversationId, principal);
  const messages = await ctx.messages.findMany({ conversation_id: conversationId });
  for (const msg of messages) {
    await ctx.messages.delete(msg.id);
  }
  await ctx.conversations.delete(conversationId);
}

async function addAssistantMessage(
  ctx: AppContext,
  conversationId: string,
  body: any,
  principal: AuthPrincipal,
): Promise<any> {
  await requireOwnedConversation(ctx, conversationId, principal);
  const message = {
    id: id("msg"),
    conversation_id: conversationId,
    role: body.role || "user",
    content: typeof body.content === "string" ? body.content : "",
    tokens: typeof body.tokens === "number" ? body.tokens : 0,
    meta: typeof body.meta === "object" && body.meta !== null ? body.meta : {},
    created_at: nowIso(),
  };
  await ctx.messages.insert(message);
  if (message.role === "assistant") {
    await incrementUnreadCount(ctx, conversationId);
  }
  await ctx.conversations.update(conversationId, { updated_at: nowIso() });
  return message;
}

async function getAssistantMessages(
  ctx: AppContext,
  conversationId: string,
  principal: AuthPrincipal,
): Promise<any[]> {
  const conversation = await ctx.conversations.findById(conversationId);
  if (!conversation) return [];
  if (!ownsPersonalRecord(conversation, principal)) throw new Error("会话不存在");
  return ctx.messages.findMany({ conversation_id: conversationId }, { sort: "asc" });
}

async function updateAssistantMessageFeedback(
  ctx: AppContext,
  messageId: string,
  body: any,
  principal: AuthPrincipal,
): Promise<any> {
  const existing = await ctx.messages.findById(messageId);
  if (!existing) throw new Error("消息不存在");
  await requireOwnedConversation(ctx, existing.conversation_id, principal);
  if (existing.role !== "assistant") throw new Error("只能评价助手消息");
  const feedback = body.feedback;
  if (feedback !== "up" && feedback !== "down" && feedback !== null) {
    throw new Error("feedback 必须是 up、down 或 null");
  }
  const meta: Record<string, unknown> = { ...(existing.meta ?? {}) };
  if (feedback === null) {
    delete meta.feedback;
    delete meta.feedback_at;
  } else {
    meta.feedback = feedback;
    meta.feedback_at = nowIso();
  }
  await ctx.messages.update(messageId, { meta } as any);
  return await ctx.messages.findById(messageId);
}

async function addAssistantFavorite(
  ctx: AppContext,
  body: any,
  principal: AuthPrincipal,
): Promise<any> {
  const type = requireString(body.type, "type");
  const refId = requireString(body.ref_id, "ref_id");
  const favorite = {
    id: id("fav"),
    user_id: principal.userId,
    type,
    ref_id: refId,
    created_at: nowIso(),
  } as any;
  await ctx.favorites.insert(favorite);
  return favorite;
}

async function listAssistantFavorites(
  ctx: AppContext,
  principal: AuthPrincipal,
  type: string | null,
): Promise<any[]> {
  const all = await ctx.favorites.findMany({}, { sort: "desc" });
  const owned = all.filter((f: any) => ownsPersonalRecord(f, principal));
  return type ? owned.filter((f: any) => f.type === type) : owned;
}

async function deleteAssistantFavorite(
  ctx: AppContext,
  favoriteId: string,
  principal: AuthPrincipal,
): Promise<void> {
  const favorite = await ctx.favorites.findById(favoriteId);
  if (!favorite || !ownsPersonalRecord(favorite, principal)) {
    throw new Error("收藏不存在");
  }
  await ctx.favorites.delete(favoriteId);
}

export async function incrementUnreadCount(
  ctx: AppContext,
  conversationId: string,
): Promise<void> {
  if (!conversationId) return;
  const conv = await ctx.conversations.findById(conversationId);
  if (!conv) return;
  const current = typeof conv.unread_count === "number" ? conv.unread_count : 0;
  await ctx.conversations.update(conversationId, { unread_count: current + 1 });
}

export async function handleAssistantRouter(
  ctx: AppContext,
  req: IncomingMessage,
  res: ServerResponse,
  principal: AuthPrincipal,
  canAccessProject: (projectId: string) => Promise<boolean>,
): Promise<void> {
  const method = req.method ?? "GET";
  const url = new URL(req.url ?? "/", "http://localhost");
  const parts = url.pathname.replace(/^\//, "").split("/");
  try {
    if (
      method === "GET" &&
      parts[0] === "api" &&
      parts[1] === "assistant" &&
      parts[2] === "conversations" &&
      !parts[3]
    ) {
      const mode = url.searchParams.get("mode");
      return sendJson(res, await listAssistantConversations(ctx, principal, mode));
    }
    if (
      method === "POST" &&
      parts[0] === "api" &&
      parts[1] === "assistant" &&
      parts[2] === "conversations" &&
      !parts[3]
    ) {
      const body = await readJson(req);
      if (
        typeof body.project_id === "string" &&
        body.project_id &&
        !(await canAccessProject(body.project_id))
      ) {
        return sendError(res, new Error("无权访问该项目"), 403);
      }
      return sendJson(res, await createAssistantConversation(ctx, body, principal));
    }
    if (
      method === "PUT" &&
      parts[0] === "api" &&
      parts[1] === "assistant" &&
      parts[2] === "conversations" &&
      parts[3]
    ) {
      const body = await readJson(req);
      if (
        typeof body.project_id === "string" &&
        body.project_id &&
        !(await canAccessProject(body.project_id))
      ) {
        return sendError(res, new Error("无权访问该项目"), 403);
      }
      return sendJson(res, await updateAssistantConversation(ctx, parts[3], body, principal));
    }
    if (
      method === "DELETE" &&
      parts[0] === "api" &&
      parts[1] === "assistant" &&
      parts[2] === "conversations" &&
      parts[3]
    ) {
      await deleteAssistantConversation(ctx, parts[3], principal);
      return sendJson(res, { deleted: true });
    }
    if (
      method === "GET" &&
      parts[0] === "api" &&
      parts[1] === "assistant" &&
      parts[2] === "conversations" &&
      parts[3] &&
      parts[4] === "messages"
    ) {
      return sendJson(res, await getAssistantMessages(ctx, parts[3], principal));
    }
    if (
      method === "POST" &&
      parts[0] === "api" &&
      parts[1] === "assistant" &&
      parts[2] === "conversations" &&
      parts[3] &&
      parts[4] === "messages"
    ) {
      const body = await readJson(req);
      return sendJson(res, await addAssistantMessage(ctx, parts[3], body, principal));
    }
    if (
      method === "PATCH" &&
      parts[0] === "api" &&
      parts[1] === "assistant" &&
      parts[2] === "messages" &&
      parts[3] &&
      parts[4] === "feedback"
    ) {
      const body = await readJson(req);
      return sendJson(res, await updateAssistantMessageFeedback(ctx, parts[3], body, principal));
    }
    if (
      method === "GET" &&
      parts[0] === "api" &&
      parts[1] === "assistant" &&
      parts[2] === "favorites" &&
      !parts[3]
    ) {
      const type = url.searchParams.get("type");
      return sendJson(res, await listAssistantFavorites(ctx, principal, type));
    }
    if (
      method === "POST" &&
      parts[0] === "api" &&
      parts[1] === "assistant" &&
      parts[2] === "favorites" &&
      !parts[3]
    ) {
      const body = await readJson(req);
      return sendJson(res, await addAssistantFavorite(ctx, body, principal));
    }
    if (
      method === "DELETE" &&
      parts[0] === "api" &&
      parts[1] === "assistant" &&
      parts[2] === "favorites" &&
      parts[3]
    ) {
      await deleteAssistantFavorite(ctx, parts[3], principal);
      return sendJson(res, { deleted: true });
    }
    sendError(res, new Error("not found"), 404);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = /不存在$/.test(message) ? 404 : 400;
    const log = status === 404 ? rootLogger.warn.bind(rootLogger) : rootLogger.error.bind(rootLogger);
    log({ event: "assistant.router.error", error: message, status }, "智能助手路由错误");
    sendError(res, error instanceof Error ? error : new Error(message), status);
  }
}
