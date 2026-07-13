/**
 * 场景-地点引用 CRUD 服务
 */

import type { AppContext } from "../app.js";
import type { ScriptSceneLocation } from "../../types.js";
import { id, nowIso } from "../../utils.js";
import type { ScriptSceneLocationInput } from "./types.js";

export async function listScriptSceneLocations(ctx: AppContext, sceneId?: string): Promise<ScriptSceneLocation[]> {
  const filter = sceneId ? { scene_id: sceneId } : {};
  return ctx.scriptSceneLocations.findMany(filter);
}

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

export async function deleteScriptSceneLocation(ctx: AppContext, refId: string): Promise<void> {
  await ctx.scriptSceneLocations.delete(refId);
}
