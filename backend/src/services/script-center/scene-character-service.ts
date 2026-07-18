/**
 * 场景-角色引用 CRUD 服务
 */

import type { AppContext } from "../app.js";
import type { ScriptSceneCharacter } from "../../types.js";
import { id, nowIso } from "../../utils.js";
import type { ScriptSceneCharacterInput } from "./types.js";

/**
 * listScriptSceneCharacters - 列出场景-角色引用
 * @param {AppContext} ctx - 应用上下文
 * @param {string} [sceneId] - 场景ID，不传则列出所有
 * @returns {Promise<ScriptSceneCharacter[]>} 返回引用列表
 */
export async function listScriptSceneCharacters(ctx: AppContext, sceneId?: string): Promise<ScriptSceneCharacter[]> {
  const filter = sceneId ? { scene_id: sceneId } : {};
  return ctx.scriptSceneCharacters.findMany(filter);
}

/**
 * createScriptSceneCharacter - 创建场景-角色引用
 * @param {AppContext} ctx - 应用上下文
 * @param {ScriptSceneCharacterInput} input - 引用输入数据
 * @returns {Promise<ScriptSceneCharacter>} 返回创建的引用记录
 */
export async function createScriptSceneCharacter(
  ctx: AppContext,
  input: ScriptSceneCharacterInput
): Promise<ScriptSceneCharacter> {
  const ref: ScriptSceneCharacter = {
    id: id("sschar"),
    project_id: input.project_id ?? "",
    scene_id: input.scene_id ?? "",
    character_asset_id: input.character_asset_id ?? "",
    role_type: (input.role_type as ScriptSceneCharacter["role_type"]) ?? "support",
    is_speaking: input.is_speaking ?? false,
    created_at: nowIso(),
  };
  await ctx.scriptSceneCharacters.insert(ref);
  return ref;
}

/**
 * updateScriptSceneCharacter - 更新场景-角色引用
 * @param {AppContext} ctx - 应用上下文
 * @param {string} refId - 引用ID
 * @param {ScriptSceneCharacterInput} input - 更新数据
 * @returns {Promise<ScriptSceneCharacter>} 返回更新后的引用记录
 */
export async function updateScriptSceneCharacter(
  ctx: AppContext,
  refId: string,
  input: ScriptSceneCharacterInput
): Promise<ScriptSceneCharacter> {
  const existing = await ctx.scriptSceneCharacters.findById(refId);
  if (!existing) throw new Error("场景角色引用不存在");

  const patch: Partial<ScriptSceneCharacter> = {
    ...input,
    role_type: input.role_type ? (input.role_type as ScriptSceneCharacter["role_type"]) : undefined,
  };

  await ctx.scriptSceneCharacters.update(refId, patch);
  return { ...existing, ...patch } as ScriptSceneCharacter;
}

/**
 * deleteScriptSceneCharacter - 删除场景-角色引用
 * @param {AppContext} ctx - 应用上下文
 * @param {string} refId - 引用ID
 * @returns {Promise<void>}
 */
export async function deleteScriptSceneCharacter(ctx: AppContext, refId: string): Promise<void> {
  await ctx.scriptSceneCharacters.delete(refId);
}
