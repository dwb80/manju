/**
 * 剧本标签 CRUD 服务
 */

import type { AppContext } from "../app.js";
import type { ScriptTag } from "../../types.js";
import { id, nowIso } from "../../utils.js";
import type { ScriptTagInput } from "./types.js";

/**
 * listScriptTags - 列出剧本标签
 * @param {AppContext} ctx - 应用上下文
 * @param {string} [scriptId] - 剧本ID，不传则列出所有标签
 * @returns {Promise<ScriptTag[]>} 返回标签列表
 */
export async function listScriptTags(ctx: AppContext, scriptId?: string): Promise<ScriptTag[]> {
  const filter = scriptId ? { script_id: scriptId } : {};
  return ctx.scriptTags.findMany(filter);
}

/**
 * createScriptTag - 创建剧本标签
 * @param {AppContext} ctx - 应用上下文
 * @param {ScriptTagInput} input - 标签输入数据
 * @returns {Promise<ScriptTag>} 返回创建的标签记录
 */
export async function createScriptTag(ctx: AppContext, input: ScriptTagInput): Promise<ScriptTag> {
  const tag: ScriptTag = {
    id: id("stag"),
    project_id: input.project_id ?? "",
    script_id: input.script_id ?? "",
    name: input.name ?? "",
    category: (input.category as ScriptTag["category"]) ?? "custom",
    color: input.color ?? "#3b82f6",
    created_by: input.created_by ?? "",
    created_at: nowIso(),
  };
  await ctx.scriptTags.insert(tag);
  return tag;
}

/**
 * deleteScriptTag - 删除剧本标签
 * @param {AppContext} ctx - 应用上下文
 * @param {string} tagId - 标签ID
 * @returns {Promise<void>}
 */
export async function deleteScriptTag(ctx: AppContext, tagId: string): Promise<void> {
  await ctx.scriptTags.delete(tagId);
}
