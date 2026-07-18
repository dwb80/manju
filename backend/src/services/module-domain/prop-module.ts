/**
 * @file prop-module.ts
 * @description 道具模块的增删查改服务，支持 AI 剧本分析扩展字段，提供道具的创建、查询、更新、删除及批量操作等功能
 */

import type { AppContext } from "../app.js";
import type { Prop, PropCategory } from "../../types/prop.js";
import { id, nowIso } from "../../utils.js";
import { recordVersion } from "./asset-version.js";
import { recordAppLog } from "../audit-log.js";

export type PropInput = {
  project_id?: string;
  name?: string;
  category?: PropCategory | string;
  description?: string;
  appearance?: string;
  material?: string;
  size?: string;
  color?: string;
  image?: string;
  tags?: string[];
  // === AI 剧本分析扩展字段 ===
  importance_level?: string;
  owner?: string;
  shape?: string;
  texture?: string;
  story_function?: string;
  visual_features?: string;
  camera_usage?: string;
  generation_prompt?: string;
  first_appearance?: string;
  confidence?: string;
};

/**
 * listProps - 列出项目中的道具（排除已删除）
 * @param {AppContext} ctx - 应用上下文
 * @param {string} projectId - 可选的项目 ID 过滤条件
 * @param {string} name - 可选的道具名称过滤条件
 * @returns {Promise<Prop[]>} 道具列表
 */
export async function listProps(
  ctx: AppContext,
  projectId?: string,
  name?: string,
): Promise<Prop[]> {
  const filter: Partial<Prop> = { ...(projectId ? { project_id: projectId } : {}) };
  if (name) filter.name = name;
  const items = await ctx.props.findMany(filter, { sort: "desc" });
  return items.filter((item) => !item.deleted_at);
}

/**
 * createProp - 创建新道具，支持 AI 剧本分析扩展字段
 * @param {AppContext} ctx - 应用上下文
 * @param {PropInput} input - 道具输入数据
 * @returns {Promise<Prop>} 创建的道具对象
 */
export async function createProp(ctx: AppContext, input: PropInput): Promise<Prop> {
  const projectId = input.project_id ?? "";
  const name = (input.name ?? "").trim();
  if (projectId && name) {
    const existing = await ctx.props.findMany({ project_id: projectId, name });
    if (existing.length > 0) {
      return existing[0];
    }
  }
  const prop: Prop = {
    id: id("prop"),
    project_id: projectId,
    name,
    category: (input.category as Prop["category"]) ?? "other",
    description: input.description ?? "",
    appearance: input.appearance,
    material: input.material,
    size: input.size,
    color: input.color,
    image: input.image,
    tags: input.tags ?? [],
    usage_count: 0,
    version: 1,
    created_at: nowIso(),
    updated_at: nowIso(),
    // === AI 剧本分析扩展字段 ===
    importance_level: input.importance_level,
    owner: input.owner,
    shape: input.shape,
    texture: input.texture,
    story_function: input.story_function,
    visual_features: input.visual_features,
    camera_usage: input.camera_usage,
    generation_prompt: input.generation_prompt,
    first_appearance: input.first_appearance,
    confidence: input.confidence,
  };
  await ctx.props.insert(prop);
  await recordVersion(ctx, {
    entityType: "prop",
    entityId: prop.id,
    entity: prop,
    changeType: "create",
  });
  return prop;
}

/**
 * updateProp - 更新指定道具，自动升级版本号
 * @param {AppContext} ctx - 应用上下文
 * @param {string} propId - 道具 ID
 * @param {PropInput} input - 更新数据
 * @returns {Promise<Prop>} 更新后的道具对象
 */
export async function updateProp(ctx: AppContext, propId: string, input: PropInput): Promise<Prop> {
  const existing = await ctx.props.findById(propId);
  if (!existing) throw new Error("道具不存在");
  if (existing.deleted_at) throw new Error("已删除的道具不可编辑");
  const nextVersion = (existing.version ?? 1) + 1;
  const patch: Partial<Prop> = {
    ...input,
    category: input.category ? (input.category as Prop["category"]) : undefined,
    version: nextVersion,
    updated_at: nowIso(),
  };
  await ctx.props.update(propId, patch);
  const updated = { ...existing, ...patch } as Prop;
  await recordVersion(ctx, {
    entityType: "prop",
    entityId: propId,
    entity: updated,
    changeType: "update",
    changeNote: `升级到 v${nextVersion}`,
  });
  return updated;
}

/**
 * deleteProp - 软删除指定道具
 * @param {AppContext} ctx - 应用上下文
 * @param {string} propId - 道具 ID
 * @returns {Promise<void>}
 */
export async function deleteProp(ctx: AppContext, propId: string): Promise<void> {
  const existing = await ctx.props.findById(propId);
  if (!existing) throw new Error("道具不存在");
  await ctx.props.update(propId, { deleted_at: nowIso() } as Partial<Prop>);
}

export async function restoreProp(ctx: AppContext, propId: string): Promise<void> {
  const existing = await ctx.props.findById(propId);
  if (!existing) throw new Error("道具不存在");
  await ctx.props.update(propId, { deleted_at: "" } as Partial<Prop>);
}

export async function listDeletedProps(ctx: AppContext, projectId?: string): Promise<Prop[]> {
  const filter: Partial<Prop> = projectId ? { project_id: projectId } : {};
  const items = await ctx.props.findMany(filter, { sort: "desc" });
  return items.filter((item) => Boolean(item.deleted_at));
}

/**
 * permanentDeleteProps - 永久删除多个道具
 * @param {AppContext} ctx - 应用上下文
 * @param {string[]} ids - 道具 ID 列表
 * @returns {Promise<void>}
 */
export async function permanentDeleteProps(ctx: AppContext, ids: string[]): Promise<void> {
  for (const entityId of ids) {
    await ctx.props.delete(entityId);
  }
}

export async function batchDeleteProps(ctx: AppContext, ids: string[]): Promise<void> {
  const ts = nowIso();
  for (const entityId of ids) {
    const existing = await ctx.props.findById(entityId);
    await ctx.props.update(entityId, { deleted_at: ts } as Partial<Prop>);
    void recordAppLog(ctx, {
      entityType: "prop",
      entityId: entityId,
      action: "asset.soft_deleted",
      event: "asset.soft_deleted",
      payload: { assetType: "prop", batch: true },
      projectId: existing?.project_id,
    });
  }
}

/**
 * batchUpdateProps - 批量更新道具
 * @param {AppContext} ctx - 应用上下文
 * @param {string[]} ids - 道具 ID 列表
 * @param {PropInput} patch - 更新数据
 * @returns {Promise<void>}
 */
export async function batchUpdateProps(ctx: AppContext, ids: string[], patch: PropInput): Promise<void> {
  const partial: Partial<Prop> = {
    ...patch,
    category: patch.category ? (patch.category as Prop["category"]) : undefined,
    updated_at: nowIso(),
  };
  for (const entityId of ids) {
    await ctx.props.update(entityId, partial);
  }
}
