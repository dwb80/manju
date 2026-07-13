import type { AppContext } from "../app.js";
import type { Audio } from "../../types/audio.js";
import { id, nowIso } from "../../utils.js";

export type AudioInput = {
  project_id?: string;
  name?: string;
  type?: string;
  description?: string;
  duration?: number;
  file_url?: string;
  speaker?: string;
  character_id?: string;
  storyboard_id?: string;
  episode?: number;
  tags?: string[];
  format?: string;
  size?: number;
};

export async function listAudios(ctx: AppContext, projectId?: string): Promise<Audio[]> {
  const filter: Partial<Audio> = projectId ? { project_id: projectId } : {};
  const items = await ctx.audios.findMany(filter, { sort: "desc" });
  return items.filter((item) => !item.deleted_at);
}

export async function createAudio(ctx: AppContext, input: AudioInput): Promise<Audio> {
  const audio: Audio = {
    id: id("audio"),
    project_id: input.project_id ?? "",
    name: input.name ?? "",
    type: (input.type as Audio["type"]) ?? "voiceover",
    description: input.description ?? "",
    duration: input.duration ?? 0,
    file_url: input.file_url ?? "",
    speaker: input.speaker ?? "",
    character_id: input.character_id ?? "",
    storyboard_id: input.storyboard_id ?? "",
    episode: input.episode ?? 1,
    tags: input.tags ?? [],
    format: input.format ?? "",
    size: input.size ?? 0,
    usage_count: 0,
    version: 1,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  await ctx.audios.insert(audio);
  return audio;
}

export async function updateAudio(ctx: AppContext, audioId: string, input: AudioInput): Promise<Audio> {
  const existing = await ctx.audios.findById(audioId);
  if (!existing) throw new Error("音频不存在");
  const patch: Partial<Audio> = {
    ...input,
    type: input.type ? (input.type as Audio["type"]) : undefined,
    updated_at: nowIso(),
  };
  await ctx.audios.update(audioId, patch);
  return { ...existing, ...patch } as Audio;
}

export async function deleteAudio(ctx: AppContext, audioId: string): Promise<void> {
  await ctx.audios.delete(audioId);
}
