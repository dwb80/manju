/**
 * @file video-generation.ts
 * @description 视频生成、TTS 生成、资产出现次数统计及模板预设查询服务
 */

import type { AppContext } from "../app.js";
import type { ModuleVideoTask } from "../../types/video.js";
import type { Storyboard } from "../../types/storyboard.js";
import type { Audio } from "../../types/audio.js";
import { createModuleVideoTask } from "./video-task-module.js";
import { createAudio } from "./audio-module.js";
import { nowIso, safeAICall } from "../../utils.js";

/**
 * generateVideoFromStoryboard - 从分镜生成视频
 * @param {AppContext} ctx - 应用上下文
 * @param {string} storyboardId - 分镜 ID
 * @param {object} options - 可选参数（ratio、duration、num_inference_steps）
 * @returns {Promise<{ videoTask: ModuleVideoTask; remoteTaskId: string }>} 视频任务和远程任务 ID
 */
export async function generateVideoFromStoryboard(
  ctx: AppContext,
  storyboardId: string,
  options: { ratio?: string; duration?: number; num_inference_steps?: number } = {}
): Promise<{ videoTask: ModuleVideoTask; remoteTaskId: string }> {
  return safeAICall("generateVideoFromStoryboard", async () => {
    const storyboard = await ctx.storyboards.findById(storyboardId);
    if (!storyboard) throw new Error("分镜不存在");
    if (!storyboard.description) throw new Error("分镜描述为空，无法生成视频");
    const params: any = {
      prompt: storyboard.description,
      image: storyboard.image_url || undefined,
      ratio: (options.ratio as any) ?? "16:9",
      duration: (options.duration as any) ?? 5,
      num_inference_steps: options.num_inference_steps ?? 30,
      mode: storyboard.image_url ? "ti2vid" : undefined,
    };
    const result = await ctx.ai.generateVideo(params);
    const aiTaskId = ((result as any).taskId || (result as any).id) ?? "";
    const task = await createModuleVideoTask(ctx, {
      project_id: storyboard.project_id,
      storyboard_id: storyboard.id,
      title: storyboard.title || `分镜 ${storyboard.shot_number} 视频`,
      prompt: storyboard.description,
      image_url: storyboard.image_url ?? "",
      params,
      ai_task_id: aiTaskId,
      status: "processing",
      progress: 0,
      duration: options.duration ?? 5,
      resolution: options.ratio ?? "16:9",
      format: "mp4",
      episode: storyboard.episode,
    });
    await ctx.storyboards.update(storyboard.id, {
      video_task_id: task.id,
      status: "production",
      updated_at: nowIso(),
    } as any);
    return { videoTask: task, remoteTaskId: aiTaskId };
  });
}

export async function generateTTS(
  ctx: AppContext,
  input: {
    project_id: string;
    text: string;
    speaker: string;
    character_id?: string;
    storyboard_id?: string;
    emotion?: string;
    voice?: string;
  }
): Promise<Audio> {
  return safeAICall("generateTTS", async () => {
    const result = await ctx.ai.generateTTS({
      text: input.text,
      voice: input.voice ?? "default",
      emotion: input.emotion ?? "neutral",
    });
    if (result.status !== "success" || !result.file_url) {
      throw new Error("TTS Provider 未返回可用音频文件");
    }
    return createAudio(ctx, {
      project_id: input.project_id,
      name: `${input.speaker || "配音"}-${(input.text || "").slice(0, 12)}`,
      type: "voiceover",
      description: input.text,
      duration: 0,
      file_url: result.file_url ?? "",
      speaker: input.speaker,
      character_id: input.character_id,
      storyboard_id: input.storyboard_id,
      format: "mp3",
      size: 0,
    });
  });
}

/**
 * getCharacterAppearances - 获取角色出现次数统计
 * @param {AppContext} ctx - 应用上下文
 * @param {string} characterId - 角色 ID
 * @returns {Promise<{ storyboards: number; audios: number; total: number }>} 出现次数统计
 */
export async function getCharacterAppearances(ctx: AppContext, characterId: string): Promise<{ storyboards: number; audios: number; total: number }> {
  const character = await ctx.characters.findById(characterId);
  if (!character) return { storyboards: 0, audios: 0, total: 0 };
  const allStoryboards = await ctx.storyboards.findMany();
  const allAudios = await ctx.audios.findMany();
  // 优先按 character_asset_ids 数组精确匹配（来自表单/剧本分析的结构化引用），
  // 兜底按 dialogue 文本里包含角色名的弱匹配（兼容历史数据）。
  const sb = allStoryboards.filter((s) => {
    const ids = s.character_asset_ids ?? [];
    if (ids.includes(characterId)) return true;
    if ((s.dialogue || "").includes(character.name)) return true;
    return false;
  }).length;
  const au = allAudios.filter((a) => a.character_id === characterId).length;
  return { storyboards: sb, audios: au, total: sb + au };
}

/**
 * getSceneAppearances - 获取场景出现次数统计
 * @param {AppContext} ctx - 应用上下文
 * @param {string} sceneId - 场景 ID
 * @returns {Promise<{ storyboards: number; total: number }>} 出现次数统计
 */
export async function getSceneAppearances(ctx: AppContext, sceneId: string): Promise<{ storyboards: number; total: number }> {
  const all = await ctx.storyboards.findMany({ scene_id: sceneId } as any);
  return { storyboards: all.length, total: all.length };
}

export async function getPropAppearances(ctx: AppContext, propId: string): Promise<{ storyboards: number; total: number }> {
  const prop = await ctx.props.findById(propId);
  if (!prop) return { storyboards: 0, total: 0 };
  const all = await ctx.storyboards.findMany();
  // 优先按 prop_asset_ids 数组精确匹配，兜底按 notes/description 文本匹配。
  const matched = all.filter((s) => {
    const ids = s.prop_asset_ids ?? [];
    if (ids.includes(propId)) return true;
    if ((s.notes || "").includes(prop.name)) return true;
    if ((s.description || "").includes(prop.name)) return true;
    return false;
  }).length;
  return { storyboards: matched, total: matched };
}

/**
 * listCharacterTemplatePresets - 列出角色模板预设
 * @returns {Promise<any[]>} 角色模板预设列表
 */
export async function listCharacterTemplatePresets() {
  const { listCharacterTemplates } = await import("../asset-templates.js");
  return listCharacterTemplates();
}

export async function listSceneTemplatePresets() {
  const { listSceneTemplates } = await import("../asset-templates.js");
  return listSceneTemplates();
}

/**
 * listPropTemplatePresets - 列出道具模板预设
 * @returns {Promise<any[]>} 道具模板预设列表
 */
export async function listPropTemplatePresets() {
  const { listPropTemplates } = await import("../asset-templates.js");
  return listPropTemplates();
}
