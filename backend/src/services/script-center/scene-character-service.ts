/**
 * 场景-角色引用 CRUD 服务
 */

import type { AppContext } from "../app.js";
import type { ScriptSceneCharacter } from "../../types.js";
import { id, nowIso } from "../../utils.js";
import type { ScriptSceneCharacterInput } from "./types.js";

export async function listScriptSceneCharacters(ctx: AppContext, sceneId?: string): Promise<ScriptSceneCharacter[]> {
  const filter = sceneId ? { scene_id: sceneId } : {};
  return ctx.scriptSceneCharacters.findMany(filter);
}

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

export async function deleteScriptSceneCharacter(ctx: AppContext, refId: string): Promise<void> {
  await ctx.scriptSceneCharacters.delete(refId);
}
