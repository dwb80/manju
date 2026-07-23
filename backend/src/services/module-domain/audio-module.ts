/**
 * @file audio-module.ts
 * @description 音频模块的增删查改服务，提供音频资源的创建、查询、更新、删除等功能
 */

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
  shot_id?: string;
  start_time?: number;
  end_time?: number;
  episode?: number;
  tags?: string[];
  format?: string;
  size?: number;
};

/**
 * listAudios - 列出项目中的音频（排除已删除）
 * @param {AppContext} ctx - 应用上下文
 * @param {string} projectId - 可选的项目 ID 过滤条件
 * @returns {Promise<Audio[]>} 音频列表
 */
export async function listAudios(ctx: AppContext, projectId?: string): Promise<Audio[]> {
  const filter: Partial<Audio> = projectId ? { project_id: projectId } : {};
  const items = await ctx.audios.findMany(filter, { sort: "desc" });
  return items.filter((item) => !item.deleted_at);
}

/**
 * createAudio - 创建新音频记录
 * @param {AppContext} ctx - 应用上下文
 * @param {AudioInput} input - 音频输入数据
 * @returns {Promise<Audio>} 创建的音频对象
 */
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
    shot_id: input.shot_id ?? "",
    start_time: input.start_time ?? 0,
    end_time: input.end_time ?? 0,
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

/**
 * deleteAudio - 删除指定音频
 * @param {AppContext} ctx - 应用上下文
 * @param {string} audioId - 音频 ID
 * @returns {Promise<void>}
 */
export async function deleteAudio(ctx: AppContext, audioId: string): Promise<void> {
  await ctx.audios.delete(audioId);
}
