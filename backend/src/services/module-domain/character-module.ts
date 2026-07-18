/**
 * @file character-module.ts
 * @description 角色模块的增删查改服务，支持 AI 剧本分析扩展字段，提供角色的创建、查询、更新、删除及批量操作等功能
 */

import type { AppContext } from "../app.js";
import type { Character } from "../../types/character.js";
import { id, nowIso } from "../../utils.js";
import { recordVersion } from "./asset-version.js";
import { recordAppLog } from "../audit-log.js";

export type CharacterInput = {
  project_id?: string;
  name?: string;
  role?: string;
  gender?: string;
  age?: number;
  traits?: string[];
  description?: string;
  image?: string;
  tags?: string[];
  // === AI 剧本分析扩展字段 ===
  identity?: string;
  face?: string;
  hair?: string;
  body?: string;
  temperament?: string;
  costume_name?: string;
  costume_description?: string;
  costume_color?: string;
  costume_material?: string;
  costume_style?: string;
  accessories?: string[];
  emotion_states?: string;
  action_assets?: string;
  relationships?: string;
  first_appearance?: string;
  dialogue_count?: number;
  generation_prompt?: string;
  confidence?: string;
};

/**
 * listCharacters - 列出项目中的角色（排除已删除）
 * @param {AppContext} ctx - 应用上下文
 * @param {string} projectId - 可选的项目 ID 过滤条件
 * @param {string} name - 可选的角色名称过滤条件
 * @returns {Promise<Character[]>} 角色列表
 */
export async function listCharacters(
  ctx: AppContext,
  projectId?: string,
  name?: string,
): Promise<Character[]> {
  const filter: Partial<Character> = { ...(projectId ? { project_id: projectId } : {}) };
  if (name) filter.name = name;
  const items = await ctx.characters.findMany(filter, { sort: "desc" });
  return items.filter((item) => !item.deleted_at);
}

export async function getCharacter(ctx: AppContext, characterId: string): Promise<Character | null> {
  const ch = await ctx.characters.findById(characterId);
  if (!ch || ch.deleted_at) return null;
  return ch;
}

/**
 * createCharacter - 创建新角色，支持 AI 剧本分析扩展字段
 * @param {AppContext} ctx - 应用上下文
 * @param {CharacterInput} input - 角色输入数据
 * @returns {Promise<Character>} 创建的角色对象
 */
export async function createCharacter(ctx: AppContext, input: CharacterInput): Promise<Character> {
  const projectId = input.project_id ?? "";
  const name = (input.name ?? "").trim();
  if (projectId && name) {
    const existing = await ctx.characters.findMany({ project_id: projectId, name });
    if (existing.length > 0) {
      return existing[0];
    }
  }
  const character: Character = {
    id: id("char"),
    project_id: projectId,
    name,
    role: (input.role as Character["role"]) ?? "supporting",
    gender: input.gender as Character["gender"],
    age: input.age,
    traits: input.traits ?? [],
    description: input.description ?? "",
    image: input.image,
    tags: input.tags ?? [],
    usage_count: 0,
    version: 1,
    created_at: nowIso(),
    updated_at: nowIso(),
    // === AI 剧本分析扩展字段 ===
    identity: input.identity,
    face: input.face,
    hair: input.hair,
    body: input.body,
    temperament: input.temperament,
    costume_name: input.costume_name,
    costume_description: input.costume_description,
    costume_color: input.costume_color,
    costume_material: input.costume_material,
    costume_style: input.costume_style,
    accessories: input.accessories,
    emotion_states: input.emotion_states,
    action_assets: input.action_assets,
    relationships: input.relationships,
    first_appearance: input.first_appearance,
    dialogue_count: input.dialogue_count,
    generation_prompt: input.generation_prompt,
    confidence: input.confidence,
  };
  await ctx.characters.insert(character);
  await recordVersion(ctx, {
    entityType: "character",
    entityId: character.id,
    entity: character,
    changeType: "create",
  });
  return character;
}

/**
 * updateCharacter - 更新指定角色，自动升级版本号
 * @param {AppContext} ctx - 应用上下文
 * @param {string} characterId - 角色 ID
 * @param {CharacterInput} input - 更新数据
 * @returns {Promise<Character>} 更新后的角色对象
 */
export async function updateCharacter(ctx: AppContext, characterId: string, input: CharacterInput): Promise<Character> {
  const existing = await ctx.characters.findById(characterId);
  if (!existing) throw new Error("角色不存在");
  if (existing.deleted_at) throw new Error("已删除的角色不可编辑");
  const nextVersion = (existing.version ?? 1) + 1;
  const patch: Partial<Character> = {
    ...input,
    role: input.role ? (input.role as Character["role"]) : undefined,
    gender: input.gender ? (input.gender as Character["gender"]) : undefined,
    version: nextVersion,
    updated_at: nowIso(),
  };
  await ctx.characters.update(characterId, patch);
  const updated = { ...existing, ...patch } as Character;
  await recordVersion(ctx, {
    entityType: "character",
    entityId: characterId,
    entity: updated,
    changeType: "update",
    changeNote: `升级到 v${nextVersion}`,
  });
  return updated;
}

export async function deleteCharacter(ctx: AppContext, characterId: string): Promise<void> {
  const existing = await ctx.characters.findById(characterId);
  await ctx.characters.update(characterId, { deleted_at: nowIso() } as Partial<Character>);
  void recordAppLog(ctx, {
    entityType: "character",
    entityId: characterId,
    action: "asset.soft_deleted",
    event: "asset.soft_deleted",
    payload: { assetType: "character" },
    projectId: existing?.project_id,
  });
}

/**
 * restoreCharacter - 恢复已软删除的角色
 * @param {AppContext} ctx - 应用上下文
 * @param {string} characterId - 角色 ID
 * @returns {Promise<void>}
 */
export async function restoreCharacter(ctx: AppContext, characterId: string): Promise<void> {
  const existing = await ctx.characters.findById(characterId);
  await ctx.characters.update(characterId, { deleted_at: "" } as Partial<Character>);
  void recordAppLog(ctx, {
    entityType: "character",
    entityId: characterId,
    action: "asset.restored",
    event: "asset.restored",
    payload: { assetType: "character" },
    projectId: existing?.project_id,
  });
}

export async function listDeletedCharacters(ctx: AppContext, projectId?: string): Promise<Character[]> {
  const filter: Partial<Character> = projectId ? { project_id: projectId } : {};
  const items = await ctx.characters.findMany(filter, { sort: "desc" });
  return items.filter((item) => Boolean(item.deleted_at));
}

export async function permanentDeleteCharacters(ctx: AppContext, ids: string[]): Promise<void> {
  for (const entityId of ids) {
    await ctx.characters.delete(entityId);
  }
}

export async function batchDeleteCharacters(ctx: AppContext, ids: string[]): Promise<void> {
  const ts = nowIso();
  for (const entityId of ids) {
    await ctx.characters.update(entityId, { deleted_at: ts } as Partial<Character>);
  }
}

/**
 * batchUpdateCharacters - 批量更新角色
 * @param {AppContext} ctx - 应用上下文
 * @param {string[]} ids - 角色 ID 列表
 * @param {CharacterInput} patch - 更新数据
 * @returns {Promise<void>}
 */
export async function batchUpdateCharacters(ctx: AppContext, ids: string[], patch: CharacterInput): Promise<void> {
  const partial: Partial<Character> = {
    ...patch,
    role: patch.role ? (patch.role as Character["role"]) : undefined,
    gender: patch.gender ? (patch.gender as Character["gender"]) : undefined,
    updated_at: nowIso(),
  };
  for (const entityId of ids) {
    await ctx.characters.update(entityId, partial);
  }
}
