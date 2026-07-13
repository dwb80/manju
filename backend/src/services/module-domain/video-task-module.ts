import type { AppContext } from "../app.js";
import type { ModuleVideoTask } from "../../types/video.js";
import { id, nowIso } from "../../utils.js";

export type ModuleVideoTaskInput = {
  project_id?: string;
  storyboard_id?: string;
  title?: string;
  prompt?: string;
  image_url?: string;
  params?: any;
  ai_task_id?: string;
  status?: string;
  progress?: number;
  duration?: number;
  resolution?: string;
  fps?: number;
  format?: string;
  file_url?: string;
  episode?: number;
  tags?: string[];
  error?: string;
};

export async function listModuleVideoTasks(ctx: AppContext, projectId?: string): Promise<ModuleVideoTask[]> {
  const filter: Partial<ModuleVideoTask> = projectId ? { project_id: projectId } : {};
  const items = await ctx.moduleVideoTasks.findMany(filter, { sort: "desc" });
  return items.filter((item) => !item.deleted_at);
}

export async function createModuleVideoTask(ctx: AppContext, input: ModuleVideoTaskInput): Promise<ModuleVideoTask> {
  const task: ModuleVideoTask = {
    id: id("vt"),
    project_id: input.project_id ?? "",
    storyboard_id: input.storyboard_id ?? "",
    title: input.title ?? "",
    prompt: input.prompt ?? "",
    image_url: input.image_url ?? "",
    params: input.params ?? {},
    ai_task_id: input.ai_task_id ?? "",
    status: (input.status as ModuleVideoTask["status"]) ?? "queued",
    progress: input.progress ?? 0,
    duration: input.duration ?? 0,
    resolution: input.resolution ?? "",
    fps: input.fps ?? 0,
    format: input.format ?? "",
    file_url: input.file_url ?? "",
    episode: input.episode ?? 1,
    tags: input.tags ?? [],
    error: input.error ?? "",
    usage_count: 0,
    version: 1,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  await ctx.moduleVideoTasks.insert(task);
  return task;
}

export async function updateModuleVideoTask(ctx: AppContext, taskId: string, input: ModuleVideoTaskInput): Promise<ModuleVideoTask> {
  const existing = await ctx.moduleVideoTasks.findById(taskId);
  if (!existing) throw new Error("视频任务不存在");
  const patch: Partial<ModuleVideoTask> = {
    ...input,
    status: input.status ? (input.status as ModuleVideoTask["status"]) : undefined,
    updated_at: nowIso(),
  };
  await ctx.moduleVideoTasks.update(taskId, patch);
  return { ...existing, ...patch } as ModuleVideoTask;
}

export async function deleteModuleVideoTask(ctx: AppContext, taskId: string): Promise<void> {
  await ctx.moduleVideoTasks.delete(taskId);
}

export async function syncVideoTaskStatus(
  ctx: AppContext,
  taskId: string,
  remoteStatus: { status: string; progress?: number; file_url?: string; error?: string }
): Promise<ModuleVideoTask> {
  const existing = await ctx.moduleVideoTasks.findById(taskId);
  if (!existing) throw new Error("视频任务不存在");
  const patch: Partial<ModuleVideoTask> = {
    status: remoteStatus.status as ModuleVideoTask["status"],
    progress: remoteStatus.progress ?? existing.progress,
    file_url: remoteStatus.file_url ?? existing.file_url,
    error: remoteStatus.error ?? "",
    updated_at: nowIso(),
  };
  await ctx.moduleVideoTasks.update(taskId, patch);
  return { ...existing, ...patch } as ModuleVideoTask;
}

export async function retryVideoTask(ctx: AppContext, taskId: string): Promise<ModuleVideoTask> {
  const existing = await ctx.moduleVideoTasks.findById(taskId);
  if (!existing) throw new Error("视频任务不存在");
  if (existing.status === "completed") throw new Error("已完成的任务不能重试");
  const patch: Partial<ModuleVideoTask> = {
    status: "queued",
    progress: 0,
    error: "",
    updated_at: nowIso(),
  };
  await ctx.moduleVideoTasks.update(taskId, patch);
  return { ...existing, ...patch } as ModuleVideoTask;
}

export async function regenerateVideo(ctx: AppContext, taskId: string): Promise<ModuleVideoTask> {
  const existing = await ctx.moduleVideoTasks.findById(taskId);
  if (!existing) throw new Error("视频任务不存在");
  const patch: Partial<ModuleVideoTask> = {
    status: "queued",
    progress: 0,
    file_url: "",
    error: "",
    updated_at: nowIso(),
  };
  await ctx.moduleVideoTasks.update(taskId, patch);
  return { ...existing, ...patch } as ModuleVideoTask;
}
