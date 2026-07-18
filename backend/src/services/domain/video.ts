/**
 * @file video.ts
 * @description 视频服务模块 - 处理视频生成任务的创建、查询、状态轮询和本地缓存
 */

import type { AppContext } from "../app.js";
import type { Conversation, VideoParams, VideoTask } from "../../types.js";
import { isAgnesRateLimitError } from "../../ai/agnes-client.js";
import { cacheMediaUrl, resolveMediaInput } from "../media.js";
import { maybeTitleConversation } from "../chat.js";
import { incrementUnreadCount } from "../../http/assistant-router.js";
import { AI_TIMEOUTS, clampNumber, id, nowIso, requireString, safeAICall, withTimeout } from "../../utils.js";
import { rootLogger } from "../../logger.js";
import { recordAppLog } from "../audit-log.js";
import { compactMediaInput, legacyOwnerByTime, taskProjectId } from "./image.js";

/** 压缩视频任务参数，避免本地图片内容写进数据库。 */
function compactVideoParams(params: VideoParams): VideoParams {
  return {
    ...params,
    image: compactMediaInput(params.image),
    images: params.images?.map(compactMediaInput).filter((value): value is string => Boolean(value)),
  };
}

/** 把目标时长换成 Agnes Video V2.0 推荐的帧数。 */
function framesFromDuration(duration: unknown): 81 | 121 | 241 | 441 {
  const value = Number(duration);
  if (value >= 18) return 441;
  if (value >= 10) return 241;
  if (value <= 3) return 81;
  return 121;
}

/** 校验并归一化 Agnes Video V2.0 的 num_frames，必须小于等于 441 且满足 8n+1。 */
function normalizeVideoFrames(value: unknown, duration: unknown): number {
  const fallback = framesFromDuration(duration);
  if (value === undefined || value === null || value === "") return fallback;
  const frames = Number(value);
  if (!Number.isInteger(frames) || frames <= 0) throw new Error("num_frames must be a positive integer");
  if (frames > 441) throw new Error("num_frames must be <= 441");
  if ((frames - 1) % 8 !== 0) throw new Error("num_frames must follow 8n + 1");
  return frames;
}

/** 校验并归一化帧率，Agnes Video V2.0 支持 1 到 60。 */
function normalizeVideoFrameRate(value: unknown): number {
  if (value === undefined || value === null || value === "") return 24;
  const frameRate = Number(value);
  if (!Number.isFinite(frameRate) || frameRate < 1 || frameRate > 60) throw new Error("frame_rate must be between 1 and 60");
  return frameRate;
}

/** 根据宽高比给 Agnes Video V2.0 提供默认输出尺寸。 */
function defaultVideoSize(ratio: VideoParams["ratio"]): { width: number; height: number } {
  if (ratio === "9:16") return { width: 768, height: 1152 };
  if (ratio === "1:1") return { width: 1024, height: 1024 };
  if (ratio === "4:3") return { width: 1024, height: 768 };
  if (ratio === "3:4") return { width: 768, height: 1024 };
  return { width: 1152, height: 768 };
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
    .catch((error: unknown) =>
      rootLogger.error(
        { event: "video.background.failed", taskId: task.id, err: error },
        "视频任务后台缓存失败",
      ),
    );
}

/**
 * 找到与视频任务关联的助手消息。
 * 优先用 VideoTask.message_id（generateVideo 写入的新任务都有）；
 * 历史任务（没有 message_id）回退到 meta.taskId 反查。
 * 找不到返回 null（消息可能已被删）。
 */
async function findMessageForVideoTask(ctx: AppContext, task: VideoTask): Promise<{ id: string; meta: Record<string, unknown> } | null> {
  if (task.message_id) {
    const msg = await ctx.messages.findById(task.message_id);
    if (msg) return { id: msg.id, meta: msg.meta || {} };
  }
  // 回退：历史任务没有 message_id，按 meta.taskId 找占位消息
  try {
    const msg = await ctx.messages.findOneByJsonPath("meta", "taskId", task.id);
    if (msg) return { id: msg.id, meta: msg.meta || {} };
  } catch (err) {
    rootLogger.debug({ event: "video.message_fallback_failed", taskId: task.id, err: String(err) }, "按 meta.taskId 反查助手消息失败");
  }
  return null;
}

/**
 * 根据当前 VideoTask 状态回填助手消息。
 * - success  → status: completed、写入 videoUrl、content: "已生成视频"
 * - failed   → status: failed、写入 error、content: "视频生成失败：..."
 * - processing → 仅刷新 progress
 * 没有关联消息时静默跳过。
 */
async function syncVideoTaskMessage(ctx: AppContext, task: VideoTask): Promise<void> {
  const found = await findMessageForVideoTask(ctx, task);
  if (!found) return;
  const baseMeta: Record<string, unknown> = { ...(found.meta || {}), taskId: task.id };
  if (task.status === "success") {
    const videoUrl = task.video_url || "";
    await ctx.messages.update(found.id, {
      content: videoUrl ? "已生成视频" : "视频生成失败：未返回视频地址",
      meta: {
        ...baseMeta,
        status: videoUrl ? "completed" : "failed",
        videoUrl,
        progress: 100,
      },
    } as Partial<{ content: string; meta: Record<string, unknown> }>);
    return;
  }
  if (task.status === "failed") {
    await ctx.messages.update(found.id, {
      content: `视频生成失败：${task.error || "未知错误"}`,
      meta: { ...baseMeta, status: "failed", error: task.error || "" },
    } as Partial<{ content: string; meta: Record<string, unknown> }>);
    return;
  }
  // processing / pending：只更新进度，不动 status
  if (typeof task.progress === "number") {
    await ctx.messages.update(found.id, {
      meta: { ...baseMeta, progress: task.progress },
    } as Partial<{ meta: Record<string, unknown> }>);
  }
}

/**
 * listVideos - 获取视频任务列表
 * @param {AppContext} ctx - 应用上下文
 * @param {string} conversationId - 会话ID（可选）
 * @returns {Promise<VideoTask[]>} 视频任务列表
 */
export async function listVideos(ctx: AppContext, conversationId?: string): Promise<VideoTask[]> {
  const tasks = await ctx.videos.findMany({}, { sort: "desc" });
  const conversations = await ctx.conversations.findMany({}, { sort: "asc" });
  const filtered = conversationId ? tasks.filter((task) => (task.conversation_id || legacyOwnerByTime(task.created_at, conversations)) === conversationId) : tasks;
  for (const task of filtered) scheduleVideoTaskCache(ctx, task);
  return filtered;
}

/**
 * generateVideo - 调用视频生成流程
 * @param {AppContext} ctx - 应用上下文
 * @param {Record<string, unknown>} body - 请求参数，包含prompt、image等字段
 * @returns {Promise<VideoTask>} 创建的视频任务
 */
export async function generateVideo(ctx: AppContext, body: Record<string, unknown>): Promise<VideoTask> {
  return safeAICall("generateVideo", async () => {
    const prompt = requireString(body.prompt, "prompt");
    const conversationId = typeof body.conversationId === "string" ? body.conversationId : "";
    // === 4 中心横切：预算硬上限拦截（详见 docs/spec.md 3.3 + 6.2）===
    // 解析 projectId：优先 body 显式传入，否则从 conversationId 反查
    let budgetProjectId = typeof body.projectId === "string" ? body.projectId : "";
    if (!budgetProjectId && conversationId) {
      const conv = await ctx.conversations.findById(conversationId);
      if (conv?.project_id) budgetProjectId = conv.project_id;
    }
    if (budgetProjectId && await ctx.budgetService.isOverHardCap(budgetProjectId)) {
      const ratio = await ctx.budgetService.getUsageRatio(budgetProjectId);
      rootLogger.warn(
        { event: "budget.exceeded", module: "video", projectId: budgetProjectId, usageRatio: ratio.toFixed(2) },
        `项目预算已用尽：项目 ${budgetProjectId} 使用率 ${(ratio * 100).toFixed(1)}%`,
      );
      const err = new Error(`budget_exceeded: 项目 ${budgetProjectId} 已超出硬上限，视频生成被禁用`);
      (err as Error & { status?: number }).status = 402;
      (err as Error & { code?: string }).code = "budget_exceeded";
      throw err;
    }
    const inputImage = typeof body.image === "string" ? body.image : undefined;
    const keyframeImages = Array.isArray(body.images) ? body.images.filter((item): item is string => typeof item === "string" && item.length > 0) : [];
    const ratio = (body.ratio as VideoParams["ratio"]) ?? "16:9";
    const defaultSize = defaultVideoSize(ratio);
    const numFrames = normalizeVideoFrames(body.num_frames, body.duration);
    const frameRate = normalizeVideoFrameRate(body.frame_rate);
    const params: VideoParams = {
      prompt,
      image: inputImage,
      images: keyframeImages,
      ratio,
      mode: typeof body.mode === "string" ? body.mode : keyframeImages.length > 0 ? "keyframes" : inputImage ? "ti2vid" : undefined,
      duration: Number(body.duration) === 18 ? 18 : Number(body.duration) === 10 ? 10 : Number(body.duration) === 3 ? 3 : 5,
      width: Number.isFinite(Number(body.width)) ? Number(body.width) : defaultSize.width,
      height: Number.isFinite(Number(body.height)) ? Number(body.height) : defaultSize.height,
      num_frames: numFrames,
      frame_rate: frameRate,
      num_inference_steps: Number.isFinite(Number(body.num_inference_steps)) ? Number(body.num_inference_steps) : undefined,
      seed: Number.isFinite(Number(body.seed)) ? Number(body.seed) : undefined,
      negative_prompt: typeof body.negative_prompt === "string" ? body.negative_prompt : undefined,
      extra_body: keyframeImages.length > 0 ? { image: keyframeImages, mode: "keyframes" } : undefined,
      model: typeof body.model === "string" ? body.model : "agnes-video-v2.0",
    };
    // 视频任务通常是异步的：先保存 processing 记录，详情查询时再轮询 Agnes。
    // 这里只创建任务（30s 超时），不阻塞等结果。
    const resolvedImage = await resolveMediaInput(ctx, inputImage);
    const resolvedImages = (await Promise.all(keyframeImages.map((image) => resolveMediaInput(ctx, image))))
      .filter((image): image is string => Boolean(image));
    const vidCtrl = new AbortController();
    const result = await withTimeout(
      ctx.ai.generateVideo({ ...params, image: resolvedImage, images: resolvedImages }, vidCtrl.signal),
      AI_TIMEOUTS.generateVideo,
      "generateVideo",
      vidCtrl
    );
    // 提前生成助手消息 ID 并写入 task.message_id，queryVideo 就能直接按 ID 定位到占位消息。
    const assistantMsgId = id("m");
    const task: VideoTask = {
      id: result.taskId,
      task_id: result.taskId,
      video_id: result.taskId,
      conversation_id: conversationId,
      prompt,
      image_url: params.image ?? "",
      params: compactVideoParams(params),
      video_url: "",
      status: (result as any).progress > 0 ? "processing" : "pending",
      progress: (result as any).progress ?? 0,
      seconds: (result as any).seconds || (numFrames / frameRate).toFixed(1),
      size: (result as any).size || `${params.width}x${params.height}`,
      error: "",
      message_id: assistantMsgId,
      created_at: nowIso(),
    };
    await ctx.videos.insert(task);
    if (conversationId) await maybeTitleConversation(ctx, conversationId, prompt);
    if (conversationId) {
      // 立即在会话里插入"生成中"占位消息：客户端切走/刷新页面也能看到状态。
      // 后台轮询完成后再 updateMessage 把 video_url 写进去。
      await ctx.messages.insert({
        id: assistantMsgId,
        conversation_id: conversationId,
        role: "assistant",
        // 文案同时承担两件事：告知用户在生成 + 给出等待时长预期
        content: "好的，正在为您生成视频。视频生成通常需要 1-5 分钟，请耐心等待，生成完成后会自动显示在这里。",
        tokens: 0,
        meta: {
          taskId: task.id,
          prompt,
          params: compactVideoParams(params),
          model: params.model,
          status: "processing",
          progress: task.progress,
        },
        created_at: nowIso(),
      });
      // 计入未读：assistant 消息（哪怕还在 processing）也算 +1，
      // 这样用户在另一个会话也能看到红色徽标，知道这个会话有新进展。
      // 后续 pollVideoUntilDone 不会再 +1（同一消息 update 而非新插）。
      await incrementUnreadCount(ctx, conversationId);
      await ctx.conversations.update(conversationId, { updated_at: nowIso() } as Partial<Conversation>);
      // fire-and-forget：后台轮询至完成，更新 VideoTask + 助手消息
      void pollVideoUntilDone(ctx, task.id, assistantMsgId, conversationId).catch((err) => {
        rootLogger.warn({ event: "video.poll_failed", taskId: task.id, err: String(err) }, "视频后台轮询任务整体失败");
      });
    }
    return task;
  });
}

/**
 * queryVideo - 查询视频任务状态
 * @param {AppContext} ctx - 应用上下文
 * @param {string} idValue - 视频任务ID
 * @returns {Promise<VideoTask>} 更新后的视频任务
 */
export async function queryVideo(ctx: AppContext, idValue: string): Promise<VideoTask> {
  const task = await ctx.videos.findById(idValue);
  if (!task) throw new Error("video not found");
  if (task.status === "processing" || task.status === "pending") {
    let status: { status: VideoTask["status"]; videoUrl?: string; error?: string; progress?: number; seconds?: string; size?: string; videoId?: string; providerTaskId?: string };
    try {
      // 视频状态查询：20s 超时，避免孤儿任务一直 polling
      const queryCtrl = new AbortController();
      status = await withTimeout(
        ctx.ai.queryTask(task.video_id || task.id, queryCtrl.signal),
        AI_TIMEOUTS.queryTask,
        "queryTask",
        queryCtrl
      );
    } catch (error) {
      if (isAgnesRateLimitError(error)) {
        const patch: Partial<VideoTask> = {
          status: task.status,
          error: "视频状态查询太频繁，稍后会自动重试",
        };
        await ctx.videos.update(idValue, patch);
        return { ...task, ...patch };
      }
      throw error;
    }
    const patch: Partial<VideoTask> = {
      status: status.status,
      task_id: status.providerTaskId ?? task.task_id,
      video_id: status.videoId ?? task.video_id,
      video_url: status.videoUrl ?? task.video_url,
      progress: status.progress ?? task.progress,
      seconds: status.seconds ?? task.seconds,
      size: status.size ?? task.size,
      error: status.error ?? "",
    };
    await ctx.videos.update(idValue, patch);
    const next = { ...task, ...patch };
    // 状态机变更：仅在 from != to 时写一条 app_log，避免空转
    if (patch.status && patch.status !== task.status) {
      void recordAppLog(ctx, {
        entityType: "video_task",
        entityId: idValue,
        action: "video.status_changed",
        event: "video.status_changed",
        payload: {
          from: task.status,
          to: patch.status,
          progress: patch.progress,
          error: patch.error,
        },
        projectId: await taskProjectId(ctx, task.conversation_id),
      });
    }
    // 关键：把最新状态回填到会话里那条"视频生成中…"占位消息。
    // 这样即使 pollVideoUntilDone 因为后端重启没跑完，前端 10s 轮询 queryVideo 也能
    // 把 success/failed/progress 写回 message meta，UI 不会再卡在"正在生成"。
    void syncVideoTaskMessage(ctx, next).catch((err) => {
      rootLogger.warn({ event: "video.message_sync_failed", taskId: idValue, err: String(err) }, "同步视频任务状态到助手消息失败");
    });
    scheduleVideoTaskCache(ctx, next);
    return next;
  }
  scheduleVideoTaskCache(ctx, task);
  return task;
}

/**
 * pollVideoUntilDone - 后台轮询视频任务直到完成
 * @param {AppContext} ctx - 应用上下文
 * @param {string} taskId - 视频任务ID
 * @param {string} messageId - 关联的消息ID
 * @param {string} conversationId - 会话ID
 * @returns {Promise<void>}
 * @description 客户端切走页面/关tab/刷新都不影响：DB是唯一真相源，重新进入页面时loadMessages拉到的就是最新状态
 */
export async function pollVideoUntilDone(
  ctx: AppContext,
  taskId: string,
  messageId: string,
  conversationId: string
): Promise<void> {
  const MAX_ROUNDS = 60;        // 最多 60 轮
  const INTERVAL_MS = 10_000;   // 每轮 10 秒 → 最长 10 分钟
  const sleep = (ms: number) => new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    // 后台轮询不能单独阻止测试或服务进程退出。
    timer.unref?.();
  });

  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    try {
      const current = await ctx.videos.findById(taskId);
      if (!current || current.status === "success" || current.status === "failed") return;
      const ctrl = new AbortController();
      const result = await withTimeout(
        ctx.ai.queryTask(taskId, ctrl.signal),
        AI_TIMEOUTS.queryTask,
        "queryTask",
        ctrl
      );
      const status = (result.status || "").toLowerCase();
      if (status === "success" || status === "completed" || status === "succeeded") {
        const videoUrl = result.videoUrl || "";
        const updated: VideoTask = {
          ...(await ctx.videos.findById(taskId))!,
          status: "success",
          video_url: videoUrl,
          progress: 100,
        };
        await ctx.videos.update(taskId, {
          status: "success",
          video_url: videoUrl,
          progress: 100,
        } as Partial<VideoTask>);
        // 复用与 queryVideo 相同的消息回填逻辑
        await syncVideoTaskMessage(ctx, updated);
        await ctx.conversations.update(conversationId, { updated_at: nowIso() } as Partial<Conversation>);
        return;
      }
      if (status === "failed" || status === "error" || status === "cancelled") {
        await ctx.videos.update(taskId, {
          status: "failed",
          error: result.error || "视频生成失败",
        } as Partial<VideoTask>);
        const updated: VideoTask = {
          ...(await ctx.videos.findById(taskId))!,
          status: "failed",
          error: result.error || "视频生成失败",
        };
        await syncVideoTaskMessage(ctx, updated);
        return;
      }
      // 否则（pending / processing）继续轮询
      const progress = (result as any).progress;
      if (typeof progress === "number") {
        await ctx.videos.update(taskId, { progress } as Partial<VideoTask>);
        const updated: VideoTask = {
          ...(await ctx.videos.findById(taskId))!,
          progress,
        };
        await syncVideoTaskMessage(ctx, updated);
      }
      await sleep(INTERVAL_MS);
    } catch (err) {
      if (/database is not open/i.test(String(err))) return;
      // 单次轮询失败不中断，下一轮继续
      rootLogger.warn({ event: "video.poll_round_failed", taskId, round, err: String(err) }, `视频轮询第 ${round + 1} 轮失败，下一轮继续`);
      await sleep(INTERVAL_MS);
    }
  }
  // 超时：标失败
  await ctx.videos.update(taskId, { status: "failed", error: "轮询超时（>10 分钟）" } as Partial<VideoTask>);
  const updated: VideoTask = {
    ...(await ctx.videos.findById(taskId))!,
    status: "failed",
    error: "timeout",
  };
  await syncVideoTaskMessage(ctx, updated);
}
