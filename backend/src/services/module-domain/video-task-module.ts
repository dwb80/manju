/**
 * @file video-task-module.ts
 * @description 视频任务模块的增删查改服务，提供视频任务的创建、查询、更新、删除、状态同步及重试等功能
 */

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

/**
 * listModuleVideoTasks - 列出项目中的视频任务（排除已删除）
 * @param {AppContext} ctx - 应用上下文
 * @param {string} projectId - 可选的项目 ID 过滤条件
 * @returns {Promise<ModuleVideoTask[]>} 视频任务列表
 */
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

/**
 * updateModuleVideoTask - 更新指定视频任务
 * @param {AppContext} ctx - 应用上下文
 * @param {string} taskId - 视频任务 ID
 * @param {ModuleVideoTaskInput} input - 更新数据
 * @returns {Promise<ModuleVideoTask>} 更新后的视频任务对象
 */
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

/**
 * deleteModuleVideoTask - 删除指定视频任务
 * @param {AppContext} ctx - 应用上下文
 * @param {string} taskId - 视频任务 ID
 * @returns {Promise<void>}
 */
export async function deleteModuleVideoTask(ctx: AppContext, taskId: string): Promise<void> {
  await ctx.moduleVideoTasks.delete(taskId);
}

/**
 * syncVideoTaskStatus - 同步视频任务状态（从远程 AI 服务）
 * @param {AppContext} ctx - 应用上下文
 * @param {string} taskId - 视频任务 ID
 * @param {object} remoteStatus - 远程状态对象，包含 status、progress、file_url、error 字段
 * @returns {Promise<ModuleVideoTask>} 更新后的视频任务对象
 */
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

/**
 * retryVideoTask - 重试失败的视频任务
 * @param {AppContext} ctx - 应用上下文
 * @param {string} taskId - 视频任务 ID
 * @returns {Promise<ModuleVideoTask>} 重试后的视频任务对象
 */
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

/**
 * regenerateVideo - 重新生成视频（清除原结果重新排队）
 * @param {AppContext} ctx - 应用上下文
 * @param {string} taskId - 视频任务 ID
 * @returns {Promise<ModuleVideoTask>} 重新生成的视频任务对象
 */
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
