/**
 * @file storyboard.ts
 * @description 分镜服务模块 - 管理项目分镜表和剪辑清单的增删改查、批量更新和CSV导出
 */

import type { AppContext } from "../app.js";
import type { ProjectClip, ProjectClipStatus, ProjectStoryboard, ProjectStoryboardStatus } from "../../types.js";
import { encodeCsvCell } from "../../storage/csv-export.js";
import { clampNumber, id, nowIso } from "../../utils.js";

const projectStoryboardStatuses: ProjectStoryboardStatus[] = ["draft", "scripted", "image", "video", "review", "done"];
const projectClipStatuses: ProjectClipStatus[] = ["todo", "editing", "review", "done"];

export type ProjectStoryboardInput = {
  episode?: number;
  scene?: string;
  shot?: string;
  title?: string;
  description?: string;
  dialogue?: string;
  characters?: unknown;
  character_asset_ids?: unknown;
  location?: string;
  scene_asset_id?: string;
  shot_size?: string;
  camera_move?: string;
  duration?: number;
  prompt?: string;
  image_task_id?: string;
  image_url?: string;
  video_task_id?: string;
  video_url?: string;
  status?: string;
  notes?: string;
};

type ProjectClipInput = {
  storyboard_id?: string;
  episode?: number;
  scene?: string;
  shot?: string;
  name?: string;
  title?: string;
  description?: string;
  thumbnail_url?: string;
  source_video_url?: string;
  duration?: number;
  in_point?: string;
  out_point?: string;
  order_index?: number;
  status?: string;
  tags?: string[];
  notes?: string;
};

type StoryboardBatchInput = {
  ids?: unknown;
  status?: string;
  notes?: string;
};

/** 把分镜状态规整到制作流程允许的状态集合。 */
function normalizeProjectStoryboardStatus(status: unknown): ProjectStoryboardStatus {
  return projectStoryboardStatuses.includes(status as ProjectStoryboardStatus) ? status as ProjectStoryboardStatus : "draft";
}

/** 把剪辑状态规整到剪辑工作流允许的状态集合。 */
function normalizeProjectClipStatus(status: unknown): ProjectClipStatus {
  return projectClipStatuses.includes(status as ProjectClipStatus) ? status as ProjectClipStatus : "todo";
}

/** 把表单传入的逗号标签或数组规整成去重字符串数组。 */
export function normalizeStringList(value: unknown): string[] {
  const items = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[,，\n]/)
      : [];
  return Array.from(new Set(items.map((item) => String(item).trim()).filter(Boolean)));
}

/**
 * listProjectStoryboards - 查询项目分镜表
 * @param {AppContext} ctx - 应用上下文
 * @param {string} projectId - 项目ID
 * @returns {Promise<ProjectStoryboard[]>} 分镜列表
 * @description 按集、场、镜头号做自然排序
 */
export async function listProjectStoryboards(ctx: AppContext, projectId: string): Promise<ProjectStoryboard[]> {
  if (!await ctx.projects.findById(projectId)) throw new Error("project not found");
  const items = await ctx.projectStoryboards.findMany({ project_id: projectId } as Partial<ProjectStoryboard>, { sort: "asc" });
  return items.map((item) => ({
    ...item,
    characters: Array.isArray(item.characters) ? item.characters : [],
    character_asset_ids: Array.isArray(item.character_asset_ids) ? item.character_asset_ids : [],
    scene_asset_id: item.scene_asset_id ?? "",
  })).sort((left, right) =>
    left.episode - right.episode ||
    left.scene.localeCompare(right.scene, "zh-Hans", { numeric: true }) ||
    left.shot.localeCompare(right.shot, "zh-Hans", { numeric: true }) ||
    left.created_at.localeCompare(right.created_at)
  );
}

/**
 * createProjectStoryboard - 创建分镜条目
 * @param {AppContext} ctx - 应用上下文
 * @param {string} projectId - 项目ID
 * @param {ProjectStoryboardInput} input - 分镜输入参数
 * @returns {Promise<ProjectStoryboard>} 创建的分镜
 */
export async function createProjectStoryboard(ctx: AppContext, projectId: string, input: ProjectStoryboardInput): Promise<ProjectStoryboard> {
  if (!await ctx.projects.findById(projectId)) throw new Error("project not found");
  const now = nowIso();
  const storyboard: ProjectStoryboard = {
    id: id("ps"),
    project_id: projectId,
    episode: clampNumber(input.episode, 1, 1, 999),
    scene: input.scene?.trim() || "1",
    shot: input.shot?.trim() || "1",
    title: input.title?.trim() || "新的分镜",
    description: input.description?.trim() || "",
    dialogue: input.dialogue?.trim() || "",
    characters: normalizeStringList(input.characters),
    character_asset_ids: normalizeStringList(input.character_asset_ids),
    location: input.location?.trim() || "",
    scene_asset_id: input.scene_asset_id?.trim() || "",
    shot_size: input.shot_size?.trim() || "",
    camera_move: input.camera_move?.trim() || "",
    duration: clampNumber(input.duration, 5, 1, 120),
    prompt: input.prompt?.trim() || "",
    image_task_id: input.image_task_id?.trim() || "",
    image_url: input.image_url?.trim() || "",
    video_task_id: input.video_task_id?.trim() || "",
    video_url: input.video_url?.trim() || "",
    status: normalizeProjectStoryboardStatus(input.status),
    notes: input.notes?.trim() || "",
    created_at: now,
    updated_at: now,
  };
  await ctx.projectStoryboards.insert(storyboard);
  return storyboard;
}

/**
 * updateProjectStoryboard - 更新项目分镜
 * @param {AppContext} ctx - 应用上下文
 * @param {string} projectId - 项目ID
 * @param {string} storyboardId - 分镜ID
 * @param {ProjectStoryboardInput} patch - 更新字段
 * @returns {Promise<ProjectStoryboard>} 更新后的分镜
 * @description 只覆盖请求里明确传入的字段
 */
export async function updateProjectStoryboard(ctx: AppContext, projectId: string, storyboardId: string, patch: ProjectStoryboardInput): Promise<ProjectStoryboard> {
  const existing = await ctx.projectStoryboards.findById(storyboardId);
  if (!existing || existing.project_id !== projectId) throw new Error("project storyboard not found");
  const next: Partial<ProjectStoryboard> = { updated_at: nowIso() };
  if (typeof patch.episode === "number") next.episode = clampNumber(patch.episode, existing.episode, 1, 999);
  if (typeof patch.scene === "string") next.scene = patch.scene.trim() || existing.scene;
  if (typeof patch.shot === "string") next.shot = patch.shot.trim() || existing.shot;
  if (typeof patch.title === "string") next.title = patch.title.trim() || existing.title;
  if (typeof patch.description === "string") next.description = patch.description.trim();
  if (typeof patch.dialogue === "string") next.dialogue = patch.dialogue.trim();
  if (patch.characters !== undefined) next.characters = normalizeStringList(patch.characters);
  if (patch.character_asset_ids !== undefined) next.character_asset_ids = normalizeStringList(patch.character_asset_ids);
  if (typeof patch.location === "string") next.location = patch.location.trim();
  if (typeof patch.scene_asset_id === "string") next.scene_asset_id = patch.scene_asset_id.trim();
  if (typeof patch.shot_size === "string") next.shot_size = patch.shot_size.trim();
  if (typeof patch.camera_move === "string") next.camera_move = patch.camera_move.trim();
  if (typeof patch.duration === "number") next.duration = clampNumber(patch.duration, existing.duration, 1, 120);
  if (typeof patch.prompt === "string") next.prompt = patch.prompt.trim();
  if (typeof patch.image_task_id === "string") next.image_task_id = patch.image_task_id.trim();
  if (typeof patch.image_url === "string") next.image_url = patch.image_url.trim();
  if (typeof patch.video_task_id === "string") next.video_task_id = patch.video_task_id.trim();
  if (typeof patch.video_url === "string") next.video_url = patch.video_url.trim();
  if (typeof patch.status === "string") next.status = normalizeProjectStoryboardStatus(patch.status);
  if (typeof patch.notes === "string") next.notes = patch.notes.trim();
  await ctx.projectStoryboards.update(storyboardId, next);
  return (await ctx.projectStoryboards.findById(storyboardId)) as ProjectStoryboard;
}

/**
 * deleteProjectStoryboard - 删除项目分镜
 * @param {AppContext} ctx - 应用上下文
 * @param {string} projectId - 项目ID
 * @param {string} storyboardId - 分镜ID
 * @returns {Promise<void>}
 */
export async function deleteProjectStoryboard(ctx: AppContext, projectId: string, storyboardId: string): Promise<void> {
  const existing = await ctx.projectStoryboards.findById(storyboardId);
  if (!existing || existing.project_id !== projectId) throw new Error("project storyboard not found");
  await ctx.projectStoryboards.delete(storyboardId);
}

/**
 * batchUpdateProjectStoryboards - 批量更新分镜
 * @param {AppContext} ctx - 应用上下文
 * @param {string} projectId - 项目ID
 * @param {StoryboardBatchInput} input - 批量更新参数
 * @returns {Promise<ProjectStoryboard[]>} 更新后的分镜列表
 * @description 用于审核流和制作阶段推进
 */
export async function batchUpdateProjectStoryboards(ctx: AppContext, projectId: string, input: StoryboardBatchInput): Promise<ProjectStoryboard[]> {
  if (!(await ctx.projects.findById(projectId))) throw new Error("project not found");
  const ids = normalizeStringList(input.ids);
  if (ids.length === 0) throw new Error("ids is required");
  const updated: ProjectStoryboard[] = [];
  for (const storyboardId of ids) {
    const existing = await ctx.projectStoryboards.findById(storyboardId);
    if (!existing || existing.project_id !== projectId) continue;
    const patch: ProjectStoryboardInput = {};
    if (typeof input.status === "string") patch.status = input.status;
    if (typeof input.notes === "string") patch.notes = input.notes;
    updated.push(await updateProjectStoryboard(ctx, projectId, storyboardId, patch));
  }
  return updated;
}

/**
 * listProjectClips - 获取项目剪辑清单
 * @param {AppContext} ctx - 应用上下文
 * @param {string} projectId - 项目ID
 * @returns {Promise<ProjectClip[]>} 剪辑清单
 * @description 按集数、场次、镜号和剪辑顺序排列
 */
export async function listProjectClips(ctx: AppContext, projectId: string): Promise<ProjectClip[]> {
  if (!(await ctx.projects.findById(projectId))) throw new Error("project not found");
  const items = await ctx.projectClips.findMany({ project_id: projectId } as Partial<ProjectClip>, { sort: "asc" });
  return items
    .filter((item) => !item.deleted_at)
    .sort((left, right) =>
      left.episode - right.episode ||
      left.order_index - right.order_index ||
      left.scene.localeCompare(right.scene, "zh-Hans", { numeric: true }) ||
      left.shot.localeCompare(right.shot, "zh-Hans", { numeric: true }) ||
      left.created_at.localeCompare(right.created_at)
    );
}

/**
 * createProjectClip - 创建剪辑条目
 * @param {AppContext} ctx - 应用上下文
 * @param {string} projectId - 项目ID
 * @param {ProjectClipInput} input - 剪辑输入参数
 * @returns {Promise<ProjectClip>} 创建的剪辑
 * @description 可直接绑定某条分镜的视频作为素材
 */
export async function createProjectClip(ctx: AppContext, projectId: string, input: ProjectClipInput): Promise<ProjectClip> {
  if (!(await ctx.projects.findById(projectId))) throw new Error("project not found");
  const storyboard = input.storyboard_id ? await ctx.projectStoryboards.findById(input.storyboard_id) : null;
  if (storyboard && storyboard.project_id !== projectId) throw new Error("project storyboard not found");
  const now = nowIso();
  const clip: ProjectClip = {
    id: id("pc"),
    project_id: projectId,
    storyboard_id: storyboard?.id ?? input.storyboard_id?.trim() ?? "",
    episode: clampNumber(input.episode, storyboard?.episode ?? 1, 1, 999),
    scene: input.scene?.trim() || storyboard?.scene || "",
    shot: input.shot?.trim() || storyboard?.shot || "",
    name: input.name?.trim() || input.title?.trim() || "未命名剪辑",
    title: input.title?.trim() || storyboard?.title || "未命名剪辑",
    description: input.description?.trim() || "",
    thumbnail_url: input.thumbnail_url?.trim() || "",
    source_video_url: input.source_video_url?.trim() || storyboard?.video_url || "",
    duration: clampNumber(input.duration, storyboard?.duration ?? 5, 1, 3600),
    in_point: input.in_point?.trim() || "00:00:00",
    out_point: input.out_point?.trim() || "",
    order_index: clampNumber(input.order_index, 0, 0, 99999),
    status: normalizeProjectClipStatus(input.status),
    tags: Array.isArray(input.tags) ? input.tags : [],
    notes: input.notes?.trim() ?? "",
    created_at: now,
    updated_at: now,
  };
  await ctx.projectClips.insert(clip);
  return clip;
}

/**
 * updateProjectClip - 更新剪辑条目
 * @param {AppContext} ctx - 应用上下文
 * @param {string} projectId - 项目ID
 * @param {string} clipId - 剪辑ID
 * @param {ProjectClipInput} patch - 更新字段
 * @returns {Promise<ProjectClip>} 更新后的剪辑
 * @description 更新剪辑入点、出点、顺序、状态和备注
 */
export async function updateProjectClip(ctx: AppContext, projectId: string, clipId: string, patch: ProjectClipInput): Promise<ProjectClip> {
  const existing = await ctx.projectClips.findById(clipId);
  if (!existing || existing.project_id !== projectId) throw new Error("project clip not found");
  const next: Partial<ProjectClip> = { updated_at: nowIso() };
  if (typeof patch.storyboard_id === "string") next.storyboard_id = patch.storyboard_id.trim();
  if (typeof patch.episode === "number") next.episode = clampNumber(patch.episode, existing.episode, 1, 999);
  if (typeof patch.scene === "string") next.scene = patch.scene.trim();
  if (typeof patch.shot === "string") next.shot = patch.shot.trim();
  if (typeof patch.title === "string") next.title = patch.title.trim() || existing.title;
  if (typeof patch.source_video_url === "string") next.source_video_url = patch.source_video_url.trim();
  if (typeof patch.duration === "number") next.duration = clampNumber(patch.duration, existing.duration, 1, 3600);
  if (typeof patch.in_point === "string") next.in_point = patch.in_point.trim();
  if (typeof patch.out_point === "string") next.out_point = patch.out_point.trim();
  if (typeof patch.order_index === "number") next.order_index = clampNumber(patch.order_index, existing.order_index, 0, 99999);
  if (typeof patch.status === "string") next.status = normalizeProjectClipStatus(patch.status);
  if (typeof patch.notes === "string") next.notes = patch.notes.trim();
  await ctx.projectClips.update(clipId, next);
  return (await ctx.projectClips.findById(clipId)) as ProjectClip;
}

/**
 * deleteProjectClip - 删除剪辑条目
 * @param {AppContext} ctx - 应用上下文
 * @param {string} projectId - 项目ID
 * @param {string} clipId - 剪辑ID
 * @returns {Promise<void>}
 */
export async function deleteProjectClip(ctx: AppContext, projectId: string, clipId: string): Promise<void> {
  const existing = await ctx.projectClips.findById(clipId);
  if (!existing || existing.project_id !== projectId) throw new Error("project clip not found");
  await ctx.projectClips.delete(clipId);
}

/**
 * softDeleteProjectClip - 软删除剪辑条目
 * @param {AppContext} ctx - 应用上下文
 * @param {string} projectId - 项目ID
 * @param {string} clipId - 剪辑ID
 * @returns {Promise<void>}
 * @description 设置 deleted_at，可在 5 秒内撤销或从回收站恢复
 */
export async function softDeleteProjectClip(ctx: AppContext, projectId: string, clipId: string): Promise<void> {
  const existing = await ctx.projectClips.findById(clipId);
  if (!existing || existing.project_id !== projectId) throw new Error("project clip not found");
  const now = nowIso();
  await ctx.projectClips.update(clipId, { deleted_at: now, updated_at: now } as Partial<ProjectClip>);
}

/**
 * syncProjectClipsFromStoryboards - 从分镜同步剪辑清单
 * @param {AppContext} ctx - 应用上下文
 * @param {string} projectId - 项目ID
 * @returns {Promise<ProjectClip[]>} 创建的剪辑列表
 * @description 从已有视频分镜同步剪辑清单，跳过已经绑定过的分镜
 */
export async function syncProjectClipsFromStoryboards(ctx: AppContext, projectId: string): Promise<ProjectClip[]> {
  const storyboards = await listProjectStoryboards(ctx, projectId);
  const existing = await listProjectClips(ctx, projectId);
  const existingStoryboardIds = new Set(existing.map((clip) => clip.storyboard_id).filter(Boolean));
  const created: ProjectClip[] = [];
  let orderIndex = existing.length;
  for (const storyboard of storyboards) {
    if (!storyboard.video_url || existingStoryboardIds.has(storyboard.id)) continue;
    created.push(await createProjectClip(ctx, projectId, {
      storyboard_id: storyboard.id,
      episode: storyboard.episode,
      scene: storyboard.scene,
      shot: storyboard.shot,
      title: storyboard.title,
      source_video_url: storyboard.video_url,
      duration: storyboard.duration,
      order_index: orderIndex,
      status: "todo",
    }));
    orderIndex += 1;
  }
  return created;
}

/**
 * exportProjectStoryboardsCsv - 导出分镜表CSV
 * @param {AppContext} ctx - 应用上下文
 * @param {string} projectId - 项目ID
 * @returns {Promise<string>} CSV文本
 * @description 供Excel、剪辑清单和外部协作使用
 */
export async function exportProjectStoryboardsCsv(ctx: AppContext, projectId: string): Promise<string> {
  const storyboards = await listProjectStoryboards(ctx, projectId);
  const headers = ["集数", "场次", "镜号", "标题", "画面描述", "对白", "角色", "场景", "景别", "镜头运动", "时长", "提示词", "底图", "视频", "状态", "备注"];
  const rows = storyboards.map((storyboard) => [
    storyboard.episode,
    storyboard.scene,
    storyboard.shot,
    storyboard.title,
    storyboard.description,
    storyboard.dialogue,
    storyboard.characters.join(" / "),
    storyboard.location,
    storyboard.shot_size,
    storyboard.camera_move,
    storyboard.duration,
    storyboard.prompt,
    storyboard.image_url,
    storyboard.video_url,
    storyboard.status,
    storyboard.notes,
  ]);
  return [
    headers.map(encodeCsvCell).join(","),
    ...rows.map((row) => row.map(encodeCsvCell).join(",")),
  ].join("\n");
}

/**
 * exportProjectEditListCsv - 导出剪辑清单CSV
 * @param {AppContext} ctx - 应用上下文
 * @param {string} projectId - 项目ID
 * @returns {Promise<string>} CSV文本
 * @description 优先使用人工剪辑表，没有剪辑表时按分镜兜底
 */
export async function exportProjectEditListCsv(ctx: AppContext, projectId: string): Promise<string> {
  const clips = await listProjectClips(ctx, projectId);
  if (clips.length > 0) {
    const headers = ["序号", "集数", "场次", "镜号", "片段名", "入点", "出点", "时长", "视频文件", "状态", "备注"];
    const rows = clips.map((clip, index) => [
      index + 1,
      clip.episode,
      clip.scene,
      clip.shot,
      clip.title,
      clip.in_point,
      clip.out_point,
      clip.duration,
      clip.source_video_url,
      clip.status,
      clip.notes,
    ]);
    return [
      headers.map(encodeCsvCell).join(","),
      ...rows.map((row) => row.map(encodeCsvCell).join(",")),
    ].join("\n");
  }
  const storyboards = await listProjectStoryboards(ctx, projectId);
  const headers = ["序号", "集数", "场次", "镜号", "片段名", "时长", "视频文件", "画面说明", "对白/字幕", "备注"];
  const rows = storyboards.map((storyboard, index) => [
    index + 1,
    storyboard.episode,
    storyboard.scene,
    storyboard.shot,
    storyboard.title,
    storyboard.duration,
    storyboard.video_url,
    storyboard.description,
    storyboard.dialogue,
    storyboard.notes,
  ]);
  return [
    headers.map(encodeCsvCell).join(","),
    ...rows.map((row) => row.map(encodeCsvCell).join(",")),
  ].join("\n");
}
