/**
 * 剧本模板 CRUD 服务
 */

import type { AppContext } from "../app.js";
import type { ScriptTemplate } from "../../types.js";
import { id, nowIso } from "../../utils.js";
import type { ScriptTemplateInput } from "./types.js";

export async function listScriptTemplates(ctx: AppContext, isPublic?: boolean): Promise<ScriptTemplate[]> {
  const filter = isPublic !== undefined ? { is_public: isPublic } : {};
  return ctx.scriptTemplates.findMany(filter, { sort: "desc" });
}

export async function getScriptTemplate(ctx: AppContext, templateId: string): Promise<ScriptTemplate | null> {
  return ctx.scriptTemplates.findById(templateId);
}

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

export async function deleteScriptTemplate(ctx: AppContext, templateId: string): Promise<void> {
  await ctx.scriptTemplates.delete(templateId);
}
