import type { AppContext } from "./app.js";
import type { Conversation, Favorite, FavoriteType, ImageParams, ImageTask, Message, Project, Settings, VideoParams, VideoTask } from "../types.js";
import { cacheMediaUrl, cacheMediaUrls, resolveMediaInput, resolveMediaInputs } from "./media.js";
import { DEFAULT_MODEL, clampNumber, estimateTokens, id, nowIso, requireString } from "../utils.js";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

/** 确保至少存在一个会话，没有时自动创建默认会话。 */
export async function ensureConversation(ctx: AppContext): Promise<Conversation> {
  const existing = await ctx.conversations.findMany({}, { limit: 1 });
  if (existing[0]) return existing[0];
  return createConversation(ctx, { title: "新的创作会话", model: DEFAULT_MODEL });
}

type CreateProjectInput = {
  name?: string;
  is_default?: boolean;
  storage_path?: string;
  storage_mode?: string;
};

/** 把项目目录片段清理成适合 Windows 和 URL 使用的安全名称。 */
function safeStorageSegment(value: string): string {
  return value.trim().replace(/[<>:"|?*\x00-\x1F]/g, "").replace(/[\\/]+/g, "_").replace(/\s+/g, "_").slice(0, 80);
}

// 项目目录只允许使用安全片段，最终都落在 backend/data/projects 下。
// 这样即使用户输入 "../" 或 Windows 盘符，也不会写到项目目录之外。
function normalizeProjectStoragePath(projectId: string, projectName: string, requestedPath?: string): string {
  const fallback = `${safeStorageSegment(projectName) || "project"}-${projectId}`;
  const source = requestedPath?.trim() || fallback;
  const segments = source
    .replace(/\\/g, "/")
    .split("/")
    .map(safeStorageSegment)
    .filter(Boolean);
  return (segments.length ? segments : [fallback]).join("/");
}

/** 计算项目存储目录的绝对路径，并阻止越权写入项目外目录。 */
function projectStorageTarget(ctx: AppContext, storagePath: string): string {
  const root = path.resolve(ctx.root, "data", "projects");
  const target = path.resolve(root, ...storagePath.split("/"));
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
    throw new Error("invalid project storage path");
  }
  return target;
}

/** 创建项目约定目录，包括 CSV、图片、视频和上传目录。 */
async function ensureProjectStorage(ctx: AppContext, storagePath: string): Promise<void> {
  const target = projectStorageTarget(ctx, storagePath);
  // 先创建约定目录。当前主数据仍在全局 CSV 中按 project_id 归属，
  // 这些子目录用于项目媒体落盘，并为后续按项目分仓保存 CSV 预留位置。
  await Promise.all([
    mkdir(path.join(target, "csv"), { recursive: true }),
    mkdir(path.join(target, "media", "images"), { recursive: true }),
    mkdir(path.join(target, "media", "videos"), { recursive: true }),
    mkdir(path.join(target, "uploads"), { recursive: true }),
  ]);
}

/** 创建项目记录，并绑定它的本地存储目录。 */
export async function createProject(ctx: AppContext, input: CreateProjectInput): Promise<Project> {
  const now = nowIso();
  const projectId = id("p");
  const name = input.name?.trim() || "新项目";
  const storagePath = normalizeProjectStoragePath(projectId, name, input.storage_path);
  await ensureProjectStorage(ctx, storagePath);
  const project: Project = {
    id: projectId,
    name,
    is_default: Boolean(input.is_default),
    is_pinned: false,
    created_at: now,
    updated_at: now,
    storage_path: storagePath,
    storage_mode: input.storage_mode === "existing" ? "existing" : "managed",
    archived_at: "",
  };
  await ctx.projects.insert(project);
  return project;
}

/** 确保存在默认项目，用于第一次打开项目列表时展示。 */
export async function ensureDefaultProject(ctx: AppContext): Promise<Project> {
  const existing = await ctx.projects.findMany({}, { sort: "asc", limit: 1 });
  if (existing[0]) return existing[0];
  return createProject(ctx, { name: "manju", is_default: true });
}

/** 获取所有项目，首次调用时会自动补默认项目。 */
export async function listProjects(ctx: AppContext): Promise<Project[]> {
  await ensureDefaultProject(ctx);
  const projects = await ctx.projects.findMany({}, { sort: "asc" });
  return projects
    .filter((project) => !project.archived_at)
    .sort((left, right) => Number(right.is_pinned) - Number(left.is_pinned) || left.name.localeCompare(right.name, "zh-Hans"));
}

/** 更新项目基础信息，例如名称或是否默认。 */
export async function updateProject(ctx: AppContext, projectId: string, patch: Partial<Pick<Project, "name" | "is_default" | "is_pinned" | "archived_at">>): Promise<Project> {
  const existing = await ctx.projects.findById(projectId);
  if (!existing) throw new Error("project not found");
  await ctx.projects.update(projectId, { ...patch, updated_at: nowIso() } as Partial<Project>);
  return (await ctx.projects.findById(projectId)) as Project;
}

/** 在服务器所在机器的资源管理器中打开项目存储目录。 */
export async function openProjectFolder(ctx: AppContext, projectId: string): Promise<{ path: string }> {
  const project = await ctx.projects.findById(projectId);
  if (!project?.storage_path) throw new Error("project not found");
  const target = projectStorageTarget(ctx, project.storage_path);
  await mkdir(target, { recursive: true });
  if (process.platform === "win32") {
    spawn("explorer.exe", [target], { detached: true, stdio: "ignore" }).unref();
  } else if (process.platform === "darwin") {
    spawn("open", [target], { detached: true, stdio: "ignore" }).unref();
  } else {
    spawn("xdg-open", [target], { detached: true, stdio: "ignore" }).unref();
  }
  return { path: target };
}

/** 删除项目记录，并把原本归属该项目的会话改为未归属。 */
export async function deleteProject(ctx: AppContext, projectId: string): Promise<void> {
  const conversations = await ctx.conversations.findMany({ project_id: projectId } as Partial<Conversation>);
  for (const conversation of conversations) {
    await ctx.conversations.update(conversation.id, { project_id: "", updated_at: nowIso() } as Partial<Conversation>);
  }
  await ctx.projects.delete(projectId);
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

/** 从用户提示词中截取适合作为历史标题的前 36 个字符。 */
function firstPromptTitle(text: string): string {
  return text.trim().replace(/\s+/g, " ").slice(0, 36);
}

/** 判断标题是否仍是系统默认标题。 */
function isDefaultTitle(title: string): boolean {
  return ["新的创作会话", "新会话"].includes(title.trim());
}

/** 压缩图片入参在 CSV 中的展示，避免把大段 data URL 写入记录。 */
function compactMediaInput(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (value.startsWith("data:")) return `[uploaded-image:${Math.round(value.length / 1024)}KB]`;
  return value;
}

/** 压缩图片任务参数，保留可读信息并去掉大体积图片内容。 */
function compactImageParams(params: ImageParams): ImageParams {
  return {
    ...params,
    image: compactMediaInput(params.image),
    images: params.images?.map(compactMediaInput).filter((value): value is string => Boolean(value)),
  };
}

/** 压缩视频任务参数，避免本地图片内容写进 CSV。 */
function compactVideoParams(params: VideoParams): VideoParams {
  return {
    ...params,
    image: compactMediaInput(params.image),
  };
}

/** 当会话仍是默认标题时，用第一次用户提示词自动命名会话。 */
async function maybeTitleConversation(ctx: AppContext, conversationId: string, prompt: string): Promise<void> {
  const title = firstPromptTitle(prompt);
  if (!title) return;
  const conversation = await ctx.conversations.findById(conversationId);
  if (!conversation || !isDefaultTitle(conversation.title)) return;
  await ctx.conversations.update(conversationId, { title, updated_at: nowIso() } as Partial<Conversation>);
}

/** 为旧数据推断图片/视频任务属于哪个会话。 */
function legacyOwnerByTime(createdAt: string, conversations: Conversation[]): string {
  const created = Date.parse(createdAt);
  if (Number.isNaN(created)) return "";
  let owner = "";
  for (const conversation of conversations) {
    const conversationCreated = Date.parse(conversation.created_at);
    if (!Number.isNaN(conversationCreated) && conversationCreated <= created) owner = conversation.id;
  }
  return owner || conversations[0]?.id || "";
}

/** 获取图片任务列表，并按会话过滤和触发本地缓存。 */
export async function listImages(ctx: AppContext, conversationId?: string): Promise<ImageTask[]> {
  const tasks = await ctx.images.findMany({}, { sort: "desc" });
  const conversations = await ctx.conversations.findMany({}, { sort: "asc" });
  const filtered = conversationId ? tasks.filter((task) => (task.conversation_id || legacyOwnerByTime(task.created_at, conversations)) === conversationId) : tasks;
  for (const task of filtered) scheduleImageTaskCache(ctx, task);
  return filtered;
}

/** 查询单个图片任务，并触发本地缓存。 */
export async function queryImage(ctx: AppContext, idValue: string): Promise<ImageTask> {
  const task = await ctx.images.findById(idValue);
  if (!task) throw new Error("image not found");
  scheduleImageTaskCache(ctx, task);
  return task;
}

/** 获取视频任务列表，并按会话过滤和触发本地缓存。 */
export async function listVideos(ctx: AppContext, conversationId?: string): Promise<VideoTask[]> {
  const tasks = await ctx.videos.findMany({}, { sort: "desc" });
  const conversations = await ctx.conversations.findMany({}, { sort: "asc" });
  const filtered = conversationId ? tasks.filter((task) => (task.conversation_id || legacyOwnerByTime(task.created_at, conversations)) === conversationId) : tasks;
  for (const task of filtered) scheduleVideoTaskCache(ctx, task);
  return filtered;
}

/** 根据任务会话找到项目 ID，用于决定媒体缓存到哪里。 */
async function taskProjectId(ctx: AppContext, conversationId: string): Promise<string> {
  if (!conversationId) return "";
  const conversation = await ctx.conversations.findById(conversationId);
  return conversation?.project_id ?? "";
}

/** 后台缓存图片任务中的远程图片，并把任务 URL 更新为本地地址。 */
function scheduleImageTaskCache(ctx: AppContext, task: ImageTask): void {
  if (!ctx.mediaCacheEnabled) return;
  // Agnes 可能返回远程 URL 或 data URL。这里后台异步缓存到本地，
  // 页面可以立即显示任务记录，缓存完成后再把 URL 更新为本地地址。
  void taskProjectId(ctx, task.conversation_id)
    .then((projectId) => cacheMediaUrls(ctx, task.image_urls, "images", task.id, projectId))
    .then((imageUrls) => {
      if (JSON.stringify(imageUrls) !== JSON.stringify(task.image_urls)) {
        return ctx.images.update(task.id, { image_urls: imageUrls } as Partial<ImageTask>);
      }
      return undefined;
    })
    .catch((error: unknown) => console.error(error));
}

/** 后台缓存视频任务中的远程视频，并把任务 URL 更新为本地地址。 */
function scheduleVideoTaskCache(ctx: AppContext, task: VideoTask): void {
  if (!ctx.mediaCacheEnabled) return;
  if (!task.video_url) return;
  void taskProjectId(ctx, task.conversation_id)
    .then((projectId) => cacheMediaUrl(ctx, task.video_url, "videos", task.id, 0, projectId))
    .then((videoUrl) => {
      if (videoUrl !== task.video_url) {
        return ctx.videos.update(task.id, { video_url: videoUrl } as Partial<VideoTask>);
      }
      return undefined;
    })
    .catch((error: unknown) => console.error(error));
}

/** 删除会话及其关联消息、图片任务、视频任务和相关收藏记录。 */
export async function deleteConversation(ctx: AppContext, conversationId: string): Promise<void> {
  const messages = await ctx.messages.findMany({ conversation_id: conversationId } as Partial<Message>);
  const images = await ctx.images.findMany({ conversation_id: conversationId } as Partial<ImageTask>);
  const videos = await ctx.videos.findMany({ conversation_id: conversationId } as Partial<VideoTask>);
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

/** 调用图片生成流程，保存图片任务并触发本地缓存。 */
export async function generateImage(ctx: AppContext, body: Record<string, unknown>): Promise<ImageTask> {
  const prompt = requireString(body.prompt, "prompt");
  const conversationId = typeof body.conversationId === "string" ? body.conversationId : "";
  const inputImages = Array.isArray(body.images)
    ? body.images.filter((image): image is string => typeof image === "string" && image.length > 0)
    : [];
  if (typeof body.image === "string" && body.image.length > 0) inputImages.push(body.image);
  const aiImages = await resolveMediaInputs(ctx, inputImages);
  const params: ImageParams = {
    prompt,
    negative_prompt: typeof body.negative_prompt === "string" ? body.negative_prompt : "",
    image: inputImages[0],
    images: inputImages,
    size: (body.size as ImageParams["size"]) ?? "1024x768",
    ratio: (body.ratio as ImageParams["ratio"]) ?? "1:1",
    n: clampNumber(body.n, 1, 1, 4),
    seed: clampNumber(body.seed, -1, -1, Number.MAX_SAFE_INTEGER),
    steps: clampNumber(body.steps, 25, 1, 50),
    cfg: clampNumber(body.cfg, 7, 1, 20),
  };
  // 本地上传图在 CSV 里保存 URL，调用 Agnes 前再转成 data URL。
  const result = await ctx.ai.generateImage({ ...params, image: aiImages[0], images: aiImages });
  const taskId = id("img");
  const task: ImageTask = {
    id: taskId,
    conversation_id: conversationId,
    prompt,
    negative: params.negative_prompt ?? "",
    params: compactImageParams(params),
    image_urls: result.imageUrls,
    status: "success",
    error: "",
    created_at: nowIso(),
  };
  await ctx.images.insert(task);
  scheduleImageTaskCache(ctx, task);
  if (conversationId) await maybeTitleConversation(ctx, conversationId, prompt);
  return task;
}

/** 保存前端本地裁切后的图片任务，不再调用 Agnes 生图模型。 */
export async function createLocalImageTask(ctx: AppContext, body: Record<string, unknown>): Promise<ImageTask> {
  const prompt = requireString(body.prompt, "prompt");
  const conversationId = typeof body.conversationId === "string" ? body.conversationId : "";
  const imageUrls = Array.isArray(body.image_urls)
    ? body.image_urls.filter((url): url is string => typeof url === "string" && url.length > 0)
    : [];
  if (imageUrls.length === 0) throw new Error("image_urls is required");
  const task: ImageTask = {
    id: id("img"),
    conversation_id: conversationId,
    prompt,
    negative: "",
    params: {
      prompt,
      images: imageUrls,
      ratio: "9:16",
      n: imageUrls.length,
    },
    image_urls: imageUrls,
    status: "success",
    error: "",
    created_at: nowIso(),
  };
  await ctx.images.insert(task);
  if (conversationId) await maybeTitleConversation(ctx, conversationId, prompt);
  return task;
}

/** 调用视频生成流程，保存异步视频任务记录。 */
export async function generateVideo(ctx: AppContext, body: Record<string, unknown>): Promise<VideoTask> {
  const prompt = requireString(body.prompt, "prompt");
  const conversationId = typeof body.conversationId === "string" ? body.conversationId : "";
  const inputImage = typeof body.image === "string" ? body.image : undefined;
  const params: VideoParams = {
    prompt,
    image: inputImage,
    ratio: (body.ratio as VideoParams["ratio"]) ?? "16:9",
    duration: Number(body.duration) === 10 ? 10 : 5,
    model: typeof body.model === "string" ? body.model : "agnes-video-v2.0",
  };
  // 视频任务通常是异步的：先保存 processing 记录，详情查询时再轮询 Agnes。
  const result = await ctx.ai.generateVideo({ ...params, image: await resolveMediaInput(ctx, inputImage) });
  const task: VideoTask = {
    id: result.taskId,
    task_id: result.taskId,
    video_id: result.taskId,
    conversation_id: conversationId,
    prompt,
    image_url: params.image ?? "",
    params: compactVideoParams(params),
    video_url: "",
    status: "processing",
    progress: 0,
    seconds: "0",
    size: "",
    error: "",
    created_at: nowIso(),
  };
  await ctx.videos.insert(task);
  if (conversationId) await maybeTitleConversation(ctx, conversationId, prompt);
  return task;
}

/** 查询视频任务，必要时向 Agnes 轮询最新状态并更新本地记录。 */
export async function queryVideo(ctx: AppContext, idValue: string): Promise<VideoTask> {
  const task = await ctx.videos.findById(idValue);
  if (!task) throw new Error("video not found");
  if (task.status === "processing" || task.status === "pending") {
    const status = await ctx.ai.queryTask(idValue);
    const patch: Partial<VideoTask> = {
      status: status.status,
      video_url: status.videoUrl ?? task.video_url,
      error: status.error ?? "",
    };
    await ctx.videos.update(idValue, patch);
    const next = { ...task, ...patch };
    scheduleVideoTaskCache(ctx, next);
    return next;
  }
  scheduleVideoTaskCache(ctx, task);
  return task;
}

/** 新增收藏记录，用于收藏图片或视频任务。 */
export async function addFavorite(ctx: AppContext, body: Record<string, unknown>): Promise<Favorite> {
  const type = requireString(body.type, "type") as FavoriteType;
  if (!["chat", "image", "video"].includes(type)) throw new Error("invalid favorite type");
  const favorite: Favorite = {
    id: id("fav"),
    type,
    ref_id: requireString(body.ref_id, "ref_id"),
    created_at: nowIso(),
  };
  await ctx.favorites.insert(favorite);
  return favorite;
}

/** 合并并保存用户设置。 */
export async function updateSettings(ctx: AppContext, body: Partial<Settings>): Promise<Settings> {
  const current = await ctx.settings.get();
  return ctx.settings.set({ ...current, ...body });
}
