/**
 * 场景-地点引用 CRUD 服务
 */

import type { AppContext } from "../app.js";
import type { ScriptSceneLocation } from "../../types.js";
import { id, nowIso } from "../../utils.js";
import type { ScriptSceneLocationInput } from "./types.js";

/**
 * listScriptSceneLocations - 列出场景-地点引用
 * @param {AppContext} ctx - 应用上下文
 * @param {string} [sceneId] - 场景ID，不传则列出所有
 * @returns {Promise<ScriptSceneLocation[]>} 返回引用列表
 */
export async function listScriptSceneLocations(ctx: AppContext, sceneId?: string): Promise<ScriptSceneLocation[]> {
  const filter = sceneId ? { scene_id: sceneId } : {};
  return ctx.scriptSceneLocations.findMany(filter);
}

/**
 * createScriptSceneLocation - 创建场景-地点引用
 * @param {AppContext} ctx - 应用上下文
 * @param {ScriptSceneLocationInput} input - 引用输入数据
 * @returns {Promise<ScriptSceneLocation>} 返回创建的引用记录
 */
export async function createScriptSceneLocation(
  ctx: AppContext,
  input: ScriptSceneLocationInput
): Promise<ScriptSceneLocation> {
  const ref: ScriptSceneLocation = {
    id: id("ssloc"),
    project_id: input.project_id ?? "",
    scene_id: input.scene_id ?? "",
    location_asset_id: input.location_asset_id ?? "",
    created_at: nowIso(),
  };
  await ctx.scriptSceneLocations.insert(ref);
  return ref;
}

/**
 * deleteScriptSceneLocation - 删除场景-地点引用
 * @param {AppContext} ctx - 应用上下文
 * @param {string} refId - 引用ID
 * @returns {Promise<void>}
 */
export async function deleteScriptSceneLocation(ctx: AppContext, refId: string): Promise<void> {
  await ctx.scriptSceneLocations.delete(refId);
}
