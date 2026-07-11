import type { AppContext } from "../app.js";
import type { Conversation, VideoParams, VideoTask } from "../../types.js";
import { AgnesRateLimitError } from "../../ai/agnes-client.js";
import { cacheMediaUrl, resolveMediaInput } from "../media.js";
import { maybeTitleConversation } from "../chat.js";
import { clampNumber, id, nowIso, requireString } from "../../utils.js";
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
    .catch((error: unknown) => console.error(error));
}

/** 获取视频任务列表，并按会话过滤和触发本地缓存。 */
export async function listVideos(ctx: AppContext, conversationId?: string): Promise<VideoTask[]> {
  const tasks = await ctx.videos.findMany({}, { sort: "desc" });
  const conversations = await ctx.conversations.findMany({}, { sort: "asc" });
  const filtered = conversationId ? tasks.filter((task) => (task.conversation_id || legacyOwnerByTime(task.created_at, conversations)) === conversationId) : tasks;
  for (const task of filtered) scheduleVideoTaskCache(ctx, task);
  return filtered;
}

/** 调用视频生成流程，保存异步视频任务记录。 */
export async function generateVideo(ctx: AppContext, body: Record<string, unknown>): Promise<VideoTask> {
  const prompt = requireString(body.prompt, "prompt");
  const conversationId = typeof body.conversationId === "string" ? body.conversationId : "";
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
  const resolvedImage = await resolveMediaInput(ctx, inputImage);
  const resolvedImages = (await Promise.all(keyframeImages.map((image) => resolveMediaInput(ctx, image))))
    .filter((image): image is string => Boolean(image));
  const result = await ctx.ai.generateVideo({ ...params, image: resolvedImage, images: resolvedImages });
  const task: VideoTask = {
    id: result.taskId,
    task_id: result.providerTaskId,
    video_id: result.videoId,
    conversation_id: conversationId,
    prompt,
    image_url: params.image ?? "",
    params: compactVideoParams(params),
    video_url: "",
    status: result.progress > 0 ? "processing" : "pending",
    progress: result.progress,
    seconds: result.seconds || (numFrames / frameRate).toFixed(1),
    size: result.size || `${params.width}x${params.height}`,
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
    let status: { status: VideoTask["status"]; videoUrl?: string; error?: string; progress?: number; seconds?: string; size?: string; videoId?: string; providerTaskId?: string };
    try {
      status = await ctx.ai.queryTask(task.video_id || task.id);
    } catch (error) {
      if (error instanceof AgnesRateLimitError) {
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
    scheduleVideoTaskCache(ctx, next);
    return next;
  }
  scheduleVideoTaskCache(ctx, task);
  return task;
}
