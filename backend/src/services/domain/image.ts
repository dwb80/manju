/**
 * @file image.ts
 * @description 图片服务模块 - 处理图片生成任务的创建、查询、本地缓存和提示词增强
 */

import type { AppContext } from "../app.js";
import type { Conversation, Favorite, FavoriteType, ImageParams, ImageTask } from "../../types.js";
import { AI_TIMEOUTS, DEFAULT_MODEL, clampNumber, id, nowIso, requireString, safeAICall, withTimeout } from "../../utils.js";
import { rootLogger } from "../../logger.js";
import { cacheMediaUrls, resolveMediaInputs } from "../media.js";
import { maybeTitleConversation } from "../chat.js";
import { incrementUnreadCount } from "../../http/assistant-router.js";

type EnhancePromptInput = {
  prompt?: string;
  mode?: string;
  ratio?: string;
};

/**
 * compactMediaInput - 压缩图片入参
 * @param {string | undefined} value - 原始图片数据
 * @returns {string | undefined} 压缩后的展示字符串
 * @description 避免把大段 data URL 写入数据库，用占位符代替
 */
export function compactMediaInput(value: string | undefined): string | undefined {
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

/**
 * legacyOwnerByTime - 为旧数据推断任务归属
 * @param {string} createdAt - 任务创建时间
 * @param {Conversation[]} conversations - 会话列表
 * @returns {string} 推断出的会话ID
 * @description 为旧数据推断图片/视频任务属于哪个会话
 */
export function legacyOwnerByTime(createdAt: string, conversations: Conversation[]): string {
  const created = Date.parse(createdAt);
  if (Number.isNaN(created)) return "";
  let owner = "";
  for (const conversation of conversations) {
    const conversationCreated = Date.parse(conversation.created_at);
    if (!Number.isNaN(conversationCreated) && conversationCreated <= created) owner = conversation.id;
  }
  return owner || conversations[0]?.id || "";
}

/**
 * taskProjectId - 获取任务所属项目ID
 * @param {AppContext} ctx - 应用上下文
 * @param {string} conversationId - 会话ID
 * @returns {Promise<string>} 项目ID
 * @description 根据任务会话找到项目ID，用于决定媒体缓存到哪里
 */
export async function taskProjectId(ctx: AppContext, conversationId: string): Promise<string> {
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
    .catch((error: unknown) => rootLogger.error({ event: "image.background.failed", taskId: task.id, err: error }, "图片任务后台缓存失败"));
}

/**
 * listImages - 获取图片任务列表
 * @param {AppContext} ctx - 应用上下文
 * @param {string} conversationId - 会话ID（可选）
 * @returns {Promise<ImageTask[]>} 图片任务列表
 * @description 按会话过滤并触发本地缓存
 */
export async function listImages(ctx: AppContext, conversationId?: string): Promise<ImageTask[]> {
  const tasks = await ctx.images.findMany({}, { sort: "desc" });
  const conversations = await ctx.conversations.findMany({}, { sort: "asc" });
  const filtered = conversationId ? tasks.filter((task) => (task.conversation_id || legacyOwnerByTime(task.created_at, conversations)) === conversationId) : tasks;
  for (const task of filtered) scheduleImageTaskCache(ctx, task);
  return filtered;
}

/**
 * queryImage - 查询单个图片任务
 * @param {AppContext} ctx - 应用上下文
 * @param {string} idValue - 图片任务ID
 * @returns {Promise<ImageTask>} 图片任务详情
 * @description 查询单个图片任务，并触发本地缓存
 */
export async function queryImage(ctx: AppContext, idValue: string): Promise<ImageTask> {
  const task = await ctx.images.findById(idValue);
  if (!task) throw new Error("image not found");
  scheduleImageTaskCache(ctx, task);
  return task;
}

/**
 * generateImage - 调用图片生成流程
 * @param {AppContext} ctx - 应用上下文
 * @param {Record<string, unknown>} body - 请求参数，包含prompt、images等字段
 * @returns {Promise<ImageTask>} 创建的图片任务
 * @description 保存图片任务并触发本地缓存
 */
export async function generateImage(ctx: AppContext, body: Record<string, unknown>): Promise<ImageTask> {
  return safeAICall("generateImage", async () => {
    const prompt = requireString(body.prompt, "prompt");
    const conversationId = typeof body.conversationId === "string" ? body.conversationId : "";
    // === 4 中心横切：预算硬上限拦截（详见 docs/spec.md 3.3 + 6.2）===
    // 解析 projectId：优先 body 显式传入，其次从 conversation 反查
    let budgetProjectId = typeof body.projectId === "string" ? body.projectId : "";
    if (!budgetProjectId && conversationId) {
      const conv = await ctx.conversations.findById(conversationId);
      if (conv?.project_id) budgetProjectId = conv.project_id;
    }
    rootLogger.debug(
      { event: "budget.check", module: "image", budgetProjectId, hasBudgetService: Boolean(ctx.budgetService) },
      `预算检查：projectId=${budgetProjectId || "(空)"}`,
    );
    if (budgetProjectId && await ctx.budgetService.isOverHardCap(budgetProjectId)) {
      const ratio = await ctx.budgetService.getUsageRatio(budgetProjectId);
      rootLogger.warn(
        { event: "budget.exceeded", module: "image", projectId: budgetProjectId, usageRatio: ratio.toFixed(2) },
        `项目预算已用尽：项目 ${budgetProjectId} 使用率 ${(ratio * 100).toFixed(1)}%`,
      );
      // 抛带前缀的错误，HTTP 层会把它转成 402 Payment Required
      const err = new Error(`budget_exceeded: 项目 ${budgetProjectId} 已超出硬上限，图片生成被禁用`);
      (err as Error & { status?: number }).status = 402;
      (err as Error & { code?: string }).code = "budget_exceeded";
      throw err;
    }
    const inputImages = Array.isArray(body.images)
      ? body.images.filter((image): image is string => typeof image === "string" && image.length > 0)
      : [];
    if (typeof body.image === "string" && body.image.length > 0) inputImages.push(body.image);
    const aiImages = await resolveMediaInputs(ctx, inputImages);
    const responseFormat = body.response_format === "b64_json" ? "b64_json" : "url";
    // 显式接受 model 字段（默认 agnes-image-2.1-flash），允许前端切换
    const rawModel = typeof body.model === "string" ? body.model.trim() : "";
    const model: ImageParams["model"] = rawModel === "agnes-image-2.1-flash" ? rawModel : "agnes-image-2.1-flash";
    const params: ImageParams = {
      model,
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
      response_format: responseFormat,
    };
    // 60s 超时，超时自动 abort 网络请求，避免连接挂死阻塞用户。
    const imgCtrl = new AbortController();
    const result = await withTimeout(
      ctx.ai.generateImage({ ...params, image: aiImages[0], images: aiImages }, imgCtrl.signal),
      AI_TIMEOUTS.generateImage,
      "generateImage",
      imgCtrl
    );
    // 部分失败提示:用户请求 N 张,实际拿回 M 张(M < N),记日志便于排查
    if (result.imageUrls.length < (params.n ?? 1)) {
      rootLogger.warn(
        {
          event: "image.partial_result",
          requested: params.n ?? 1,
          returned: result.imageUrls.length,
          prompt: prompt.slice(0, 80),
          hasReferences: aiImages.length > 0,
        },
        `图片生成返回数量不足：请求 ${params.n ?? 1} 张，实际拿到 ${result.imageUrls.length} 张（前端将展示部分结果）`,
      );
    }
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
    if (conversationId) {
      await maybeTitleConversation(ctx, conversationId, prompt);
      // 把结果直接落库为一条助手消息：这样客户端哪怕切走页面 / 关 tab，
      // 重新进入时 loadMessages 也能拿到这条结果。
      await ctx.messages.insert({
        id: id("m"),
        conversation_id: conversationId,
        role: "assistant",
        content: `已生成 ${task.image_urls.length} 张图片（${params.ratio ?? "1:1"} · ${params.model ?? "default"}）`,
        tokens: 0,
        meta: {
          taskId: task.id,
          imageUrls: task.image_urls,
          prompt,
          ratio: params.ratio,
          size: params.size,
          n: params.n,
          negativePrompt: params.negative_prompt,
          model: params.model,
          status: "completed",
        },
        created_at: nowIso(),
      });
      // 未读计数 +1（直接走 messages 表，绕开 addAssistantMessage）
      await incrementUnreadCount(ctx, conversationId);
      await ctx.conversations.update(conversationId, { updated_at: nowIso() } as Partial<Conversation>);
    }
    return task;
  });
}

/**
 * createLocalImageTask - 保存本地图片任务
 * @param {AppContext} ctx - 应用上下文
 * @param {Record<string, unknown>} body - 请求参数，包含prompt、image_urls等字段
 * @returns {Promise<ImageTask>} 创建的图片任务
 * @description 保存前端本地裁切后的图片任务，不再调用 Agnes 生图模型
 */
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

/**
 * enhancePrompt - 增强提示词
 * @param {AppContext} ctx - 应用上下文
 * @param {EnhancePromptInput} input - 输入参数，包含prompt、mode、ratio
 * @returns {Promise<{prompt: string; enhanced: string; mode: string}>} 原始提示词和增强后的提示词
 * @description 用聊天模型把用户的粗略描述增强成更稳定的图片或视频生成提示词
 */
export async function enhancePrompt(ctx: AppContext, input: EnhancePromptInput): Promise<{ prompt: string; enhanced: string; mode: string }> {
  const prompt = requireString(input.prompt, "prompt").trim();
  const mode = input.mode === "video" ? "video" : "image";
  const ratio = input.ratio?.trim();
  const instruction = [
    "你是AI漫剧创作的提示词优化师。",
    `请把用户的${mode === "video" ? "视频" : "图片"}生成想法改写成专业、稳定、可直接用于生成的中文提示词。`,
    "要求：",
    "1. 自动补充主体、场景、镜头、光照、构图、风格、质感和技术参数。",
    "2. 保留用户原意，不要改变人物身份、关键动作和关键场景。",
    "3. 严格保留用户指定的约束条件（如'禁止改变XX'、'保持原有XX不变'、'不要修改XX'等），不得删除、修改或重新诠释。",
    "4. 严格保留用户指定的技术参数（如画幅比例、分辨率等），不得改变。",
    "5. 输出只给增强后的提示词，不要解释，不要加标题，不要用 Markdown。",
    mode === "video"
      ? "6. 视频提示词需包含镜头运动、节奏、时长感、画面连续性和避免跳变的描述。"
      : "6. 图片提示词需包含景别、画面结构、细节层次和避免畸形的描述。",
    ratio ? `7. 用户明确要求画幅比例为 ${ratio}，请在提示词末尾追加 --ar ${ratio}。` : "",
    "",
    "用户原始提示词：",
    prompt,
  ].join("\n");
  let enhanced = "";
  // 30s 超时；chat 是流式，但 enhancePrompt 用的是同步消费模式
  const enhanceCtrl = new AbortController();
  const chatIter = ctx.ai.chat(
    { conversationId: "", message: instruction, model: DEFAULT_MODEL },
    enhanceCtrl.signal
  );
  try {
    await withTimeout(
      (async () => {
        for await (const chunk of chatIter) {
          enhanced += chunk.content;
        }
      })(),
      AI_TIMEOUTS.enhancePrompt,
      "enhancePrompt",
      enhanceCtrl
    );
  } catch (err) {
    enhanceCtrl.abort();
    throw err;
  }
  return {
    prompt,
    mode,
    enhanced: enhanced.trim() || prompt,
  };
}

/**
 * addFavorite - 新增收藏记录
 * @param {AppContext} ctx - 应用上下文
 * @param {Record<string, unknown>} body - 请求参数，包含type、ref_id等字段
 * @returns {Promise<Favorite>} 创建的收藏记录
 * @description 用于收藏图片或视频任务
 */
export async function addFavorite(ctx: AppContext, body: Record<string, unknown>): Promise<Favorite> {
  const type = requireString(body.type, "type") as FavoriteType;
  if (!["chat", "image", "video"].includes(type)) throw new Error("invalid favorite type");
  const refId = requireString(body.ref_id, "ref_id");
  const existing = (await ctx.favorites.findMany({ type, ref_id: refId }))[0];
  if (existing) return existing;

  const favorite: Favorite = {
    id: id("fav"),
    type,
    ref_id: refId,
    created_at: nowIso(),
  };
  await ctx.favorites.insert(favorite);
  return favorite;
}
