/**
 * 剧本模板 CRUD 服务
 */

import type { AppContext } from "../app.js";
import type { ScriptTemplate } from "../../types.js";
import { id, nowIso } from "../../utils.js";
import type { ScriptTemplateInput } from "./types.js";

/**
 * listScriptTemplates - 列出剧本模板
 * @param {AppContext} ctx - 应用上下文
 * @param {boolean} [isPublic] - 是否只列出公开模板，不传则列出所有
 * @returns {Promise<ScriptTemplate[]>} 返回模板列表
 */
export async function listScriptTemplates(ctx: AppContext, isPublic?: boolean): Promise<ScriptTemplate[]> {
  const filter = isPublic !== undefined ? { is_public: isPublic } : {};
  return ctx.scriptTemplates.findMany(filter, { sort: "desc" });
}

/**
 * getScriptTemplate - 根据ID获取剧本模板
 * @param {AppContext} ctx - 应用上下文
 * @param {string} templateId - 模板ID
 * @returns {Promise<ScriptTemplate | null>} 返回模板记录，不存在则返回null
 */
export async function getScriptTemplate(ctx: AppContext, templateId: string): Promise<ScriptTemplate | null> {
  return ctx.scriptTemplates.findById(templateId);
}

/**
 * createScriptTemplate - 创建剧本模板
 * @param {AppContext} ctx - 应用上下文
 * @param {ScriptTemplateInput} input - 模板输入数据
 * @returns {Promise<ScriptTemplate>} 返回创建的模板记录
 */
export async function createScriptTemplate(ctx: AppContext, input: ScriptTemplateInput): Promise<ScriptTemplate> {
  const template: ScriptTemplate = {
    id: id("stpl"),
    name: input.name ?? "",
    category: input.category ?? "",
    description: input.description ?? "",
    world_setting: input.world_setting ?? "",
    character_templates: input.character_templates ?? [],
    plot_structure: input.plot_structure ?? "",
    usage_count: input.usage_count ?? 0,
    rating: input.rating ?? 0,
    author: input.author ?? "",
    is_public: input.is_public ?? false,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  await ctx.scriptTemplates.insert(template);
  return template;
}

/**
 * updateScriptTemplate - 更新剧本模板
 * @param {AppContext} ctx - 应用上下文
 * @param {string} templateId - 模板ID
 * @param {ScriptTemplateInput} input - 更新数据
 * @returns {Promise<ScriptTemplate>} 返回更新后的模板记录
 */
export async function updateScriptTemplate(
  ctx: AppContext,
  templateId: string,
  input: ScriptTemplateInput
): Promise<ScriptTemplate> {
  const existing = await ctx.scriptTemplates.findById(templateId);
  if (!existing) throw new Error("剧本模板不存在");

  const patch: Partial<ScriptTemplate> = {
    ...input,
    updated_at: nowIso(),
  };

  await ctx.scriptTemplates.update(templateId, patch);
  return { ...existing, ...patch } as ScriptTemplate;
}

/**
 * deleteScriptTemplate - 删除剧本模板
 * @param {AppContext} ctx - 应用上下文
 * @param {string} templateId - 模板ID
 * @returns {Promise<void>}
 */
export async function deleteScriptTemplate(ctx: AppContext, templateId: string): Promise<void> {
  await ctx.scriptTemplates.delete(templateId);
}
