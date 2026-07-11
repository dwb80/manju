import type { AppContext } from "./app.js";
import type { ChatChunk, ChatParams, ChatToolCall, Conversation, Message } from "../types.js";
import { DEFAULT_MODEL, estimateTokens, id, nowIso } from "../utils.js";

/**
 * 聊天领域服务。
 *
 * 该模块负责会话生命周期、消息持久化、历史上下文构建以及 Agnes 聊天接口的流式调用。
 * 与图片/视频/项目管理解耦，只依赖 AppContext 和通用工具函数。
 */

/** 确保至少存在一个会话，没有时自动创建默认会话。 */
export async function ensureConversation(ctx: AppContext): Promise<Conversation> {
  const existing = await ctx.conversations.findMany({}, { limit: 1 });
  if (existing[0]) return existing[0];
  return createConversation(ctx, { title: "新的创作会话", model: DEFAULT_MODEL });
}

/** 创建新的聊天或创作会话，并记录项目归属。 */
export async function createConversation(ctx: AppContext, input: { title?: string; model?: string; project_id?: string; projectId?: string }): Promise<Conversation> {
  const now = nowIso();
  const projectId = input.project_id ?? input.projectId ?? "";
  const conversation: Conversation = {
    id: id("c"),
    title: input.title?.trim() || "新的创作会话",
    model: input.model || DEFAULT_MODEL,
    is_pinned: false,
    created_at: now,
    updated_at: now,
    project_id: projectId,
  };
  await ctx.conversations.insert(conversation);
  return conversation;
}

/** 按项目筛选并返回会话列表，同时用首条用户消息补齐默认标题。 */
export async function listConversations(ctx: AppContext, projectId?: string | null): Promise<Conversation[]> {
  const conversations = await ctx.conversations.findMany({}, { sort: "desc" });
  const messages = await ctx.messages.findMany({}, { sort: "asc" });
  const projects = await ctx.projects.findMany({}, { sort: "asc" });
  const archivedProjectIds = new Set(projects.filter((project) => project.archived_at).map((project) => project.id));
  const filtered = projectId === undefined || projectId === null || projectId === "all"
    ? conversations.filter((conversation) => !archivedProjectIds.has(conversation.project_id))
    : conversations.filter((conversation) => (conversation.project_id ?? "") === projectId);

  return filtered.map((conversation) => {
    if (!isDefaultTitle(conversation.title)) return conversation;
    const firstMessage = messages.find((message) => message.conversation_id === conversation.id && message.role === "user");
    const title = firstPromptTitle(firstMessage?.content ?? "");
    return title ? { ...conversation, title } : conversation;
  });
}

/** 更新会话标题、置顶状态、模型或项目归属。 */
export async function updateConversation(ctx: AppContext, conversationId: string, patch: Partial<Pick<Conversation, "title" | "is_pinned" | "model" | "project_id">>): Promise<Conversation> {
  const existing = await ctx.conversations.findById(conversationId);
  if (!existing) throw new Error("conversation not found");
  await ctx.conversations.update(conversationId, { ...patch, updated_at: nowIso() } as Partial<Conversation>);
  return (await ctx.conversations.findById(conversationId)) as Conversation;
}

/** 删除会话及其关联消息、图片任务、视频任务和相关收藏记录。 */
export async function deleteConversation(ctx: AppContext, conversationId: string): Promise<void> {
  const messages = await ctx.messages.findMany({ conversation_id: conversationId } as Partial<Message>);
  const images = await ctx.images.findMany({ conversation_id: conversationId } as Partial<import("../types.js").ImageTask>);
  const videos = await ctx.videos.findMany({ conversation_id: conversationId } as Partial<import("../types.js").VideoTask>);
  const favorites = await ctx.favorites.findMany();
  const deletedRefs = new Set<string>([
    ...images.map((image) => image.id),
    ...videos.map((video) => video.id),
  ]);

  for (const message of messages) await ctx.messages.delete(message.id);
  for (const image of images) await ctx.images.delete(image.id);
  for (const video of videos) await ctx.videos.delete(video.id);
  for (const favorite of favorites) {
    if (deletedRefs.has(favorite.ref_id)) await ctx.favorites.delete(favorite.id);
  }
  await ctx.conversations.delete(conversationId);
}

/** 新增一条会话消息，并更新时间和可能的会话标题。 */
export async function addMessage(ctx: AppContext, input: Pick<Message, "conversation_id" | "role" | "content"> & { meta?: Record<string, unknown> }): Promise<Message> {
  const message: Message = {
    id: id("m"),
    conversation_id: input.conversation_id,
    role: input.role,
    content: input.content,
    tokens: estimateTokens(input.content),
    meta: input.meta ?? {},
    created_at: nowIso(),
  };
  await ctx.messages.insert(message);
  await maybeTitleConversation(ctx, input.conversation_id, input.role === "user" ? input.content : "");
  await ctx.conversations.update(input.conversation_id, { updated_at: nowIso() } as Partial<Conversation>);
  return message;
}

/** 把历史消息转成 Agnes 聊天所需的 history 数组，只保留文本内容。 */
export function buildChatHistory(messages: Message[]): Array<{ role: "user" | "assistant" | "system"; content: string }> {
  return messages
    .filter((message) => message.role === "user" || message.role === "assistant" || message.role === "system")
    .map((message) => ({ role: message.role, content: message.content }));
}

/** 合并流式返回中的工具调用片段。 */
function mergeToolCalls(buffer: Map<string, ChatToolCall>, deltas: ChatToolCall[]): ChatToolCall[] {
  for (const delta of deltas) {
    const existing = buffer.get(delta.id) ?? {
      id: delta.id,
      type: "function" as const,
      function: { name: "", arguments: "" },
    };
    if (delta.function.name) existing.function.name = delta.function.name;
    existing.function.arguments += delta.function.arguments;
    buffer.set(delta.id, existing);
  }
  return Array.from(buffer.values());
}

/** 流式调用 Agnes 聊天接口，并持久化助手回复。 */
export async function streamChatAssistant(
  ctx: AppContext,
  params: ChatParams,
  signal: AbortSignal,
  onChunk: (chunk: ChatChunk) => void
): Promise<{ content: string; reasoning?: string; toolCalls?: ChatToolCall[]; tokens: number }> {
  let content = "";
  let reasoning = "";
  const toolCallBuffer = new Map<string, ChatToolCall>();

  for await (const chunk of ctx.ai.chat(params, signal)) {
    if (signal.aborted) break;
    onChunk(chunk);
    if (chunk.content) content += chunk.content;
    if (chunk.reasoning) reasoning += chunk.reasoning;
    if (chunk.tool_calls) mergeToolCalls(toolCallBuffer, chunk.tool_calls);
    if (chunk.done) break;
  }

  const toolCalls = toolCallBuffer.size > 0 ? Array.from(toolCallBuffer.values()) : undefined;
  const metaTokens = content + (reasoning ? `\n${reasoning}` : "") + (toolCalls ? toolCalls.map((tc) => tc.function.arguments).join("") : "");
  const tokens = estimateTokens(metaTokens);

  const meta: Record<string, unknown> = { model: params.model ?? DEFAULT_MODEL, tokens };
  if (reasoning) meta.reasoning = reasoning;
  if (toolCalls) meta.tool_calls = toolCalls;

  if (content || reasoning || toolCalls) {
    await addMessage(ctx, {
      conversation_id: params.conversationId,
      role: "assistant",
      content,
      meta,
    });
  }

  return { content, reasoning: reasoning || undefined, toolCalls, tokens };
}

/** 从用户提示词中截取适合作为历史标题的前 36 个字符。 */
function firstPromptTitle(text: string): string {
  return text.trim().replace(/\s+/g, " ").slice(0, 36);
}

/** 判断标题是否仍是系统默认标题。 */
function isDefaultTitle(title: string): boolean {
  return ["新的创作会话", "新会话"].includes(title.trim());
}

/** 当用户发送第一条消息时，如果标题还是默认值则自动替换为提示词摘要。 */
export async function maybeTitleConversation(ctx: AppContext, conversationId: string, userText: string): Promise<void> {
  if (!userText.trim()) return;
  const conversation = await ctx.conversations.findById(conversationId);
  if (!conversation || !isDefaultTitle(conversation.title)) return;
  const title = firstPromptTitle(userText);
  if (title) {
    await ctx.conversations.update(conversationId, { title, updated_at: nowIso() } as Partial<Conversation>);
  }
}
