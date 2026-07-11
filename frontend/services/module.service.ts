/**
 * 独立模块 API 服务
 *
 * 提供剧本、角色、场景、分镜、音频、资产、审核等独立模块的 CRUD 操作。
 */

import { api } from "@/lib/api-client";
import type { Script, Character, Scene, Prop, Storyboard, AudioItem, Asset, Review } from "@/lib/module-types";
import type { VideoTask, AssetEntityType, AssetVersion } from "@/lib/module-types";

// ==================== 资产版本管理（任务12：统一版本管理） ====================

/** 列出某资产的全部历史版本，按 version 倒序。 */
export async function listVersions(
  entityType: AssetEntityType,
  entityId: string,
): Promise<AssetVersion[]> {
  const query = `?entity_type=${encodeURIComponent(entityType)}&entity_id=${encodeURIComponent(entityId)}`;
  return api<AssetVersion[]>(`/api/versions${query}`);
}

/** 根据版本 ID 获取单条版本记录。 */
export async function getVersion(versionId: string): Promise<AssetVersion> {
  return api<AssetVersion>(`/api/versions/${versionId}`);
}

/** 回滚某条版本到对应实体，会自动新增一条 restore 版本。 */
export async function restoreVersion(versionId: string): Promise<AssetVersion> {
  return api<AssetVersion>(`/api/versions/${versionId}/restore`, { method: "POST" });
}

// ==================== 剧本模块 ====================

export async function listScripts(projectId?: string): Promise<Script[]> {
  const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
  return api<Script[]>(`/api/scripts${query}`);
}

export async function createScript(data: {
  title: string;
  project_id?: string;
  description?: string;
  status?: string;
  words?: number;
  chapters?: number;
  author?: string;
  tags?: string[];
  version?: number;
}): Promise<Script> {
  return api<Script>("/api/scripts", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateScript(id: string, data: Partial<{
  title: string;
  description: string;
  status: string;
  words: number;
  chapters: number;
  author: string;
  tags: string[];
  version: number;
}>): Promise<Script> {
  return api<Script>(`/api/scripts/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteScript(id: string): Promise<void> {
  await api(`/api/scripts/${id}`, { method: "DELETE" });
}

// ==================== 角色模块 ====================

export async function listCharacters(projectId?: string): Promise<Character[]> {
  const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
  return api<Character[]>(`/api/characters${query}`);
}

export async function createCharacter(data: {
  name: string;
  role?: string;
  gender?: string;
  age?: number;
  traits?: string[];
  description?: string;
  image?: string;
  tags?: string[];
}): Promise<Character> {
  return api<Character>("/api/characters", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateCharacter(id: string, data: Partial<{
  name: string;
  role: string;
  gender: string;
  age: number;
  traits: string[];
  description: string;
  image: string;
  tags: string[];
}>): Promise<Character> {
  return api<Character>(`/api/characters/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteCharacter(id: string): Promise<void> {
  await api(`/api/characters/${id}`, { method: "DELETE" });
}

export async function restoreCharacter(id: string): Promise<void> {
  await api(`/api/characters/${id}/restore`, { method: "POST" });
}

/** 回收站：列出已软删除的角色。 */
export async function listDeletedCharacters(projectId?: string): Promise<Character[]> {
  const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
  return api<Character[]>(`/api/characters/deleted${query}`);
}

/** 回收站：永久删除角色（真删，无法恢复）。 */
export async function permanentDeleteCharacters(ids: string[]): Promise<void> {
  await api("/api/characters/permanent", {
    method: "POST",
    body: JSON.stringify({ ids }),
  });
}

/** 角色引用关系：被哪些剧本/分镜/对白引用。 */
export interface UsageReferenceItem {
  type: "script" | "storyboard" | "dialogue" | "scene_character" | "scene_location" | "script_center";
  id: string;
  title: string;
  project_id?: string;
  context?: string;
}

export interface AssetUsage {
  id: string;
  total: number;
  storyboards: UsageReferenceItem[];
  scripts: UsageReferenceItem[];
  dialogues: UsageReferenceItem[];
  sceneCharacters: UsageReferenceItem[];
  sceneLocations: UsageReferenceItem[];
  usage_count: number;
}

export async function getCharacterUsage(id: string): Promise<AssetUsage> {
  return api<AssetUsage>(`/api/characters/${id}/usage`);
}

/** 批量操作角色：action=delete 时删除；action=update 时按 patch 批量更新。 */
export async function batchCharacters(
  action: "delete" | "update",
  ids: string[],
  patch?: Record<string, unknown>,
): Promise<{ deleted?: number; updated?: number }> {
  return api<{ deleted?: number; updated?: number }>("/api/characters/batch", {
    method: "POST",
    body: JSON.stringify({ action, ids, patch }),
  });
}

/** 跨项目复制角色：把源角色复制到多个目标项目，按名称去重。 */
export interface CopyToProjectsResult<T> {
  copied: number;
  skipped: number;
  items: T[];
}

export async function copyCharactersToProjects(
  sourceId: string,
  targetProjectIds: string[],
): Promise<CopyToProjectsResult<Character>> {
  return api<CopyToProjectsResult<Character>>("/api/characters/copy", {
    method: "POST",
    body: JSON.stringify({ sourceId, targetProjectIds }),
  });
}

// ==================== 场景模块 ====================

export async function listScenes(projectId?: string): Promise<Scene[]> {
  const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
  return api<Scene[]>(`/api/scenes${query}`);
}

export async function createScene(data: {
  name: string;
  type?: string;
  description?: string;
  image?: string;
  tags?: string[];
  lighting?: string;
  time_of_day?: string;
  weather?: string;
}): Promise<Scene> {
  return api<Scene>("/api/scenes", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateScene(id: string, data: Partial<{
  name: string;
  type: string;
  description: string;
  image: string;
  tags: string[];
  lighting: string;
  time_of_day: string;
  weather: string;
}>): Promise<Scene> {
  return api<Scene>(`/api/scenes/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteScene(id: string): Promise<void> {
  await api(`/api/scenes/${id}`, { method: "DELETE" });
}

export async function restoreScene(id: string): Promise<void> {
  await api(`/api/scenes/${id}/restore`, { method: "POST" });
}

/** 回收站：列出已软删除的场景。 */
export async function listDeletedScenes(projectId?: string): Promise<Scene[]> {
  const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
  return api<Scene[]>(`/api/scenes/deleted${query}`);
}

/** 回收站：永久删除场景（真删，无法恢复）。 */
export async function permanentDeleteScenes(ids: string[]): Promise<void> {
  await api("/api/scenes/permanent", {
    method: "POST",
    body: JSON.stringify({ ids }),
  });
}

/** 场景引用关系：被哪些分镜/项目分镜/场景-地点引用。 */
export async function getSceneUsage(id: string): Promise<AssetUsage> {
  return api<AssetUsage>(`/api/scenes/${id}/usage`);
}

/** 批量操作场景。 */
export async function batchScenes(
  action: "delete" | "update",
  ids: string[],
  patch?: Record<string, unknown>,
): Promise<{ deleted?: number; updated?: number }> {
  return api<{ deleted?: number; updated?: number }>("/api/scenes/batch", {
    method: "POST",
    body: JSON.stringify({ action, ids, patch }),
  });
}

/** 跨项目复制场景。 */
export async function copyScenesToProjects(
  sourceId: string,
  targetProjectIds: string[],
): Promise<CopyToProjectsResult<Scene>> {
  return api<CopyToProjectsResult<Scene>>("/api/scenes/copy", {
    method: "POST",
    body: JSON.stringify({ sourceId, targetProjectIds }),
  });
}

// ==================== 道具模块 ====================

export async function listProps(projectId?: string): Promise<Prop[]> {
  const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
  return api<Prop[]>(`/api/props${query}`);
}

export async function createProp(data: {
  name: string;
  category?: string;
  description?: string;
  appearance?: string;
  material?: string;
  size?: string;
  color?: string;
  image?: string;
  tags?: string[];
  project_id?: string;
}): Promise<Prop> {
  return api<Prop>("/api/props", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateProp(id: string, data: Partial<{
  name: string;
  category: string;
  description: string;
  appearance: string;
  material: string;
  size: string;
  color: string;
  image: string;
  tags: string[];
}>): Promise<Prop> {
  return api<Prop>(`/api/props/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteProp(id: string): Promise<void> {
  await api(`/api/props/${id}`, { method: "DELETE" });
}

export async function restoreProp(id: string): Promise<void> {
  await api(`/api/props/${id}/restore`, { method: "POST" });
}

/** 回收站：列出已软删除的道具。 */
export async function listDeletedProps(projectId?: string): Promise<Prop[]> {
  const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
  return api<Prop[]>(`/api/props/deleted${query}`);
}

/** 回收站：永久删除道具（真删，无法恢复）。 */
export async function permanentDeleteProps(ids: string[]): Promise<void> {
  await api("/api/props/permanent", {
    method: "POST",
    body: JSON.stringify({ ids }),
  });
}

/** 道具引用关系：被哪些剧本/分镜文本提及。 */
export async function getPropUsage(id: string): Promise<AssetUsage> {
  return api<AssetUsage>(`/api/props/${id}/usage`);
}

/** 批量操作道具。 */
export async function batchProps(
  action: "delete" | "update",
  ids: string[],
  patch?: Record<string, unknown>,
): Promise<{ deleted?: number; updated?: number }> {
  return api<{ deleted?: number; updated?: number }>("/api/props/batch", {
    method: "POST",
    body: JSON.stringify({ action, ids, patch }),
  });
}

/** 跨项目复制道具。 */
export async function copyPropsToProjects(
  sourceId: string,
  targetProjectIds: string[],
): Promise<CopyToProjectsResult<Prop>> {
  return api<CopyToProjectsResult<Prop>>("/api/props/copy", {
    method: "POST",
    body: JSON.stringify({ sourceId, targetProjectIds }),
  });
}

// ==================== 分镜模块 ====================

export async function listStoryboards(projectId?: string): Promise<Storyboard[]> {
  const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
  return api<Storyboard[]>(`/api/storyboards${query}`);
}

export async function createStoryboard(data: {
  scene_id?: string;
  shot_number?: number;
  description?: string;
  duration?: number;
  camera_angle?: string;
  movement?: string;
  dialogue?: string;
  notes?: string;
  status?: string;
  order?: number;
}): Promise<Storyboard> {
  return api<Storyboard>("/api/storyboards", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateStoryboard(id: string, data: Partial<{
  scene_id: string;
  shot_number: number;
  description: string;
  duration: number;
  camera_angle: string;
  movement: string;
  dialogue: string;
  notes: string;
  status: string;
  order: number;
}>): Promise<Storyboard> {
  return api<Storyboard>(`/api/storyboards/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteStoryboard(id: string): Promise<void> {
  await api(`/api/storyboards/${id}`, { method: "DELETE" });
}

// ==================== 音频模块 ====================

export async function listAudios(projectId?: string): Promise<AudioItem[]> {
  const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
  return api<AudioItem[]>(`/api/audios${query}`);
}

export async function createAudio(data: {
  name: string;
  type?: string;
  duration?: number;
  file_url?: string;
  speaker?: string;
  tags?: string[];
  format?: string;
  size?: number;
}): Promise<AudioItem> {
  return api<AudioItem>("/api/audios", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateAudio(id: string, data: Partial<{
  name: string;
  type: string;
  duration: number;
  file_url: string;
  speaker: string;
  tags: string[];
  format: string;
  size: number;
}>): Promise<AudioItem> {
  return api<AudioItem>(`/api/audios/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteAudio(id: string): Promise<void> {
  await api(`/api/audios/${id}`, { method: "DELETE" });
}

// ==================== 资产模块 ====================

export async function listAssets(projectId?: string): Promise<Asset[]> {
  const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
  return api<Asset[]>(`/api/assets${query}`);
}

export async function createAsset(data: {
  name: string;
  type?: string;
  file_url?: string;
  size?: number;
  format?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}): Promise<Asset> {
  return api<Asset>("/api/assets", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateAsset(id: string, data: Partial<{
  name: string;
  type: string;
  file_url: string;
  size: number;
  format: string;
  tags: string[];
  metadata: Record<string, unknown>;
}>): Promise<Asset> {
  return api<Asset>(`/api/assets/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteAsset(id: string): Promise<void> {
  await api(`/api/assets/${id}`, { method: "DELETE" });
}

// ==================== 审核模块 ====================

export async function listReviews(projectId?: string): Promise<Review[]> {
  const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
  return api<Review[]>(`/api/reviews${query}`);
}

export async function createReview(data: {
  content_type?: string;
  content_id?: string;
  content_title?: string;
  result?: string;
  score?: number;
  comment?: string;
  reviewer_id?: string;
  reviewer_name?: string;
}): Promise<Review> {
  return api<Review>("/api/reviews", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateReview(id: string, data: Partial<{
  content_type: string;
  content_id: string;
  content_title: string;
  result: string;
  score: number;
  comment: string;
  reviewer_id: string;
  reviewer_name: string;
}>): Promise<Review> {
  return api<Review>(`/api/reviews/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteReview(id: string): Promise<void> {
  await api(`/api/reviews/${id}`, { method: "DELETE" });
}

// ==================== 资产模板/预设库 ====================
//
// 三厂（角色 / 场景 / 道具）共用的全局模板数据（不依赖 project_id）。
// 由后端在 backend/src/services/asset-templates.ts 硬编码提供。

/** 角色模板列表（10 个常用预设）。 */
export async function listCharacterTemplates(): Promise<Character[]> {
  return api<Character[]>("/api/templates/characters");
}

/** 场景模板列表（8 个常用预设）。 */
export async function listSceneTemplates(): Promise<Scene[]> {
  return api<Scene[]>("/api/templates/scenes");
}

/** 道具模板列表（10 个常用预设）。 */
export async function listPropTemplates(): Promise<Prop[]> {
  return api<Prop[]>("/api/templates/props");
}

// ==================== 视频任务模块 ====================

export async function listModuleVideoTasks(projectId?: string): Promise<VideoTask[]> {
  const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
  return api<VideoTask[]>(`/api/module-video-tasks${query}`);
}

export async function createModuleVideoTask(data: {
  title: string;
  status?: string;
  progress?: number;
  duration?: number;
  resolution?: string;
  fps?: number;
  format?: string;
  file_url?: string;
}): Promise<VideoTask> {
  return api<VideoTask>("/api/module-video-tasks", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateModuleVideoTask(id: string, data: Partial<{
  title: string;
  status: string;
  progress: number;
  duration: number;
  resolution: string;
  fps: number;
  format: string;
  file_url: string;
}>): Promise<VideoTask> {
  return api<VideoTask>(`/api/module-video-tasks/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteModuleVideoTask(id: string): Promise<void> {
  await api(`/api/module-video-tasks/${id}`, { method: "DELETE" });
}