/**
 * 剧本标签 CRUD 服务
 */

import type { AppContext } from "../app.js";
import type { ScriptTag } from "../../types.js";
import { id, nowIso } from "../../utils.js";
import type { ScriptTagInput } from "./types.js";

export async function listScriptTags(ctx: AppContext, scriptId?: string): Promise<ScriptTag[]> {
  const filter = scriptId ? { script_id: scriptId } : {};
  return ctx.scriptTags.findMany(filter);
}

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

export async function deleteScriptTag(ctx: AppContext, tagId: string): Promise<void> {
  await ctx.scriptTags.delete(tagId);
}
