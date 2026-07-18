/**
 * @file scene-module.ts
 * @description 场景模块的增删查改服务，支持 AI 剧本分析扩展字段，提供场景的创建、查询、更新、删除及批量操作等功能
 */

import type { AppContext } from "../app.js";
import type { Scene } from "../../types/scene.js";
import { id, nowIso } from "../../utils.js";
import { recordVersion } from "./asset-version.js";
import { recordAppLog } from "../audit-log.js";

export type SceneInput = {
  project_id?: string;
  name?: string;
  type?: string;
  description?: string;
  image?: string;
  tags?: string[];
  lighting?: string;
  time_of_day?: string;
  weather?: string;
  // === AI 剧本分析扩展字段 ===
  category?: string;
  indoor_outdoor?: string;
  location?: string;
  architecture?: string;
  terrain?: string;
  plants?: string;
  objects?: string;
  period?: string;
  tone?: string;
  visual_style?: string;
  atmosphere_emotion?: string;
  suitable_shots?: string;
  reusable_elements?: string;
  generation_prompt?: string;
  first_appearance?: string;
  confidence?: string;
};

/**
 * listScenes - 列出项目中的场景（排除已删除）
 * @param {AppContext} ctx - 应用上下文
 * @param {string} projectId - 可选的项目 ID 过滤条件
 * @param {string} name - 可选的场景名称过滤条件
 * @returns {Promise<Scene[]>} 场景列表
 */
export async function listScenes(
  ctx: AppContext,
  projectId?: string,
  name?: string,
): Promise<Scene[]> {
  const filter: Partial<Scene> = { ...(projectId ? { project_id: projectId } : {}) };
  if (name) filter.name = name;
  const items = await ctx.scenes.findMany(filter, { sort: "desc" });
  return items.filter((item) => !item.deleted_at);
}

export async function createScene(ctx: AppContext, input: SceneInput): Promise<Scene> {
  const projectId = input.project_id ?? "";
  const name = (input.name ?? "").trim();
  if (projectId && name) {
    const existing = await ctx.scenes.findMany({ project_id: projectId, name });
    if (existing.length > 0) {
      return existing[0];
    }
  }
  const scene: Scene = {
    id: id("scene"),
    project_id: projectId,
    name,
    type: (input.type as Scene["type"]) ?? "indoor",
    description: input.description ?? "",
    image: input.image,
    tags: input.tags ?? [],
    lighting: input.lighting,
    time_of_day: input.time_of_day,
    weather: input.weather,
    usage_count: 0,
    version: 1,
    created_at: nowIso(),
    updated_at: nowIso(),
    // === AI 剧本分析扩展字段 ===
    category: input.category,
    indoor_outdoor: input.indoor_outdoor,
    location: input.location,
    architecture: input.architecture,
    terrain: input.terrain,
    plants: input.plants,
    objects: input.objects,
    period: input.period,
    tone: input.tone,
    visual_style: input.visual_style,
    atmosphere_emotion: input.atmosphere_emotion,
    suitable_shots: input.suitable_shots,
    reusable_elements: input.reusable_elements,
    generation_prompt: input.generation_prompt,
    first_appearance: input.first_appearance,
    confidence: input.confidence,
  };
  await ctx.scenes.insert(scene);
  await recordVersion(ctx, {
    entityType: "scene",
    entityId: scene.id,
    entity: scene,
    changeType: "create",
  });
  return scene;
}

export async function updateScene(ctx: AppContext, sceneId: string, input: SceneInput): Promise<Scene> {
  const existing = await ctx.scenes.findById(sceneId);
  if (!existing) throw new Error("场景不存在");
  if (existing.deleted_at) throw new Error("已删除的场景不可编辑");
  const nextVersion = (existing.version ?? 1) + 1;
  const patch: Partial<Scene> = {
    ...input,
    type: input.type ? (input.type as Scene["type"]) : undefined,
    version: nextVersion,
    updated_at: nowIso(),
  };
  await ctx.scenes.update(sceneId, patch);
  const updated = { ...existing, ...patch } as Scene;
  await recordVersion(ctx, {
    entityType: "scene",
    entityId: sceneId,
    entity: updated,
    changeType: "update",
    changeNote: `升级到 v${nextVersion}`,
  });
  return updated;
}

/**
 * deleteScene - 软删除指定场景
 * @param {AppContext} ctx - 应用上下文
 * @param {string} sceneId - 场景 ID
 * @returns {Promise<void>}
 */
export async function deleteScene(ctx: AppContext, sceneId: string): Promise<void> {
  const existing = await ctx.scenes.findById(sceneId);
  await ctx.scenes.update(sceneId, { deleted_at: nowIso() } as Partial<Scene>);
  void recordAppLog(ctx, {
    entityType: "scene",
    entityId: sceneId,
    action: "asset.soft_deleted",
    event: "asset.soft_deleted",
    payload: { assetType: "scene" },
    projectId: existing?.project_id,
  });
}

/**
 * restoreScene - 恢复已软删除的场景
 * @param {AppContext} ctx - 应用上下文
 * @param {string} sceneId - 场景 ID
 * @returns {Promise<void>}
 */
export async function restoreScene(ctx: AppContext, sceneId: string): Promise<void> {
  const existing = await ctx.scenes.findById(sceneId);
  await ctx.scenes.update(sceneId, { deleted_at: "" } as Partial<Scene>);
  void recordAppLog(ctx, {
    entityType: "scene",
    entityId: sceneId,
    action: "asset.restored",
    event: "asset.restored",
    payload: { assetType: "scene" },
    projectId: existing?.project_id,
  });
}

/**
 * listDeletedScenes - 列出已删除的场景
 * @param {AppContext} ctx - 应用上下文
 * @param {string} projectId - 可选的项目 ID 过滤条件
 * @returns {Promise<Scene[]>} 已删除场景列表
 */
export async function listDeletedScenes(ctx: AppContext, projectId?: string): Promise<Scene[]> {
  const filter: Partial<Scene> = projectId ? { project_id: projectId } : {};
  const items = await ctx.scenes.findMany(filter, { sort: "desc" });
  return items.filter((item) => Boolean(item.deleted_at));
}

/**
 * permanentDeleteScenes - 永久删除多个场景
 * @param {AppContext} ctx - 应用上下文
 * @param {string[]} ids - 场景 ID 列表
 * @returns {Promise<void>}
 */
export async function permanentDeleteScenes(ctx: AppContext, ids: string[]): Promise<void> {
  for (const entityId of ids) {
    await ctx.scenes.delete(entityId);
  }
}

/**
 * batchDeleteScenes - 批量软删除场景
 * @param {AppContext} ctx - 应用上下文
 * @param {string[]} ids - 场景 ID 列表
 * @returns {Promise<void>}
 */
export async function batchDeleteScenes(ctx: AppContext, ids: string[]): Promise<void> {
  const ts = nowIso();
  for (const entityId of ids) {
    await ctx.scenes.update(entityId, { deleted_at: ts } as Partial<Scene>);
  }
}

export async function batchUpdateScenes(ctx: AppContext, ids: string[], patch: SceneInput): Promise<void> {
  const partial: Partial<Scene> = {
    ...patch,
    type: patch.type ? (patch.type as Scene["type"]) : undefined,
    updated_at: nowIso(),
  };
  for (const entityId of ids) {
    await ctx.scenes.update(entityId, partial);
  }
}
