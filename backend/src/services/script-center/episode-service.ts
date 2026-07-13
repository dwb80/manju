/**
 * 剧集 CRUD 服务
 */

import type { AppContext } from "../app.js";
import type { ScriptEpisode } from "../../types.js";
import { id, nowIso } from "../../utils.js";
import type { ScriptEpisodeInput } from "./types.js";

export async function listScriptEpisodes(ctx: AppContext, projectId: string): Promise<ScriptEpisode[]> {
  return ctx.scriptEpisodes.findMany({ project_id: projectId }, { sort: "asc" });
}

export async function getScriptEpisode(ctx: AppContext, episodeId: string): Promise<ScriptEpisode | null> {
  return ctx.scriptEpisodes.findById(episodeId);
}

export async function createScriptEpisode(ctx: AppContext, input: ScriptEpisodeInput): Promise<ScriptEpisode> {
  const episode: ScriptEpisode = {
    id: id("se"),
    project_id: input.project_id ?? "",
    document_id: input.document_id ?? "",
    episode_no: input.episode_no ?? 1,
    title: input.title ?? "",
    synopsis: input.synopsis ?? "",
    status: (input.status as ScriptEpisode["status"]) ?? "draft",
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  await ctx.scriptEpisodes.insert(episode);
  return episode;
}

export async function updateScriptEpisode(
  ctx: AppContext,
  episodeId: string,
  input: ScriptEpisodeInput
): Promise<ScriptEpisode> {
  const existing = await ctx.scriptEpisodes.findById(episodeId);
  if (!existing) throw new Error("剧集不存在");

  const patch: Partial<ScriptEpisode> = {
    ...input,
    status: input.status ? (input.status as ScriptEpisode["status"]) : undefined,
    updated_at: nowIso(),
  };

  await ctx.scriptEpisodes.update(episodeId, patch);
  return { ...existing, ...patch } as ScriptEpisode;
}

export async function deleteScriptEpisode(ctx: AppContext, episodeId: string): Promise<void> {
  await ctx.scriptEpisodes.delete(episodeId);
}
