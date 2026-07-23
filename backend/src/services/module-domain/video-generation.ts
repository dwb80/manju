/**
 * @file video-generation.ts
 * @description 视频生成、TTS 生成、资产出现次数统计及模板预设查询服务
 */

import type { AppContext } from "../app.js";
import type { ModuleVideoTask } from "../../types/video.js";
import type { Storyboard, Shot } from "../../types/storyboard.js";
import type { Audio } from "../../types/audio.js";
import { createModuleVideoTask } from "./video-task-module.js";
import { createAudio } from "./audio-module.js";
import { nowIso, safeAICall } from "../../utils.js";
import { rootLogger } from "../../logger.js";
import { resolveVideoParams } from "../../types/render-presets.js";

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
  options: { ratio?: string; duration?: number; num_inference_steps?: number; presetKey?: string } = {}
): Promise<{ videoTask: ModuleVideoTask; remoteTaskId: string }> {
  return safeAICall("generateVideoFromStoryboard", async () => {
    const storyboard = await ctx.storyboards.findById(storyboardId);
    if (!storyboard) throw new Error("分镜不存在");
    if (!storyboard.description) throw new Error("分镜描述为空，无法生成视频");
    // RENDER-F03/F04:presetKey 优先,无 key 时用 ratio alias 到默认 preset
    const preset = resolveVideoParams({
      presetKey: options.presetKey ?? null,
      ratio: options.ratio ?? null,
      duration: ((options.duration as any) ?? 5) as 3 | 5 | 10 | 18,
      num_inference_steps: options.num_inference_steps,
    });
    const params: any = {
      prompt: storyboard.description,
      image: (storyboard as any).image_url || undefined,
      ratio: preset.ratio,
      width: preset.width,
      height: preset.height,
      duration: preset.duration,
      num_inference_steps: preset.num_inference_steps,
      mode: (storyboard as any).image_url ? "ti2vid" : undefined,
    };
    const result = await ctx.ai.generateVideo(params);
    const aiTaskId = ((result as any).taskId || (result as any).id) ?? "";
    const task = await createModuleVideoTask(ctx, {
      project_id: storyboard.project_id,
      storyboard_id: storyboard.id,
      title: storyboard.title || `分镜 ${(storyboard as any).shot_number || storyboard.storyboard_number} 视频`,
      prompt: storyboard.description,
      image_url: (storyboard as any).image_url ?? "",
      params,
      ai_task_id: aiTaskId,
      status: "processing",
      progress: 0,
      duration: options.duration ?? 5,
      resolution: `${preset.width}x${preset.height} (${preset.ratio})`,
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

/**
 * generateVideoFromShot - 从镜头生成视频（镜头级别图生视频）
 * @param {AppContext} ctx - 应用上下文
 * @param {string} shotId - 镜头 ID
 * @param {object} options - 可选参数（ratio、duration、num_inference_steps）
 * @returns {Promise<{ videoTask: ModuleVideoTask; remoteTaskId: string }>} 视频任务和远程任务 ID
 */
export async function generateVideoFromShot(
  ctx: AppContext,
  shotId: string,
  options: { ratio?: string; duration?: number; num_inference_steps?: number; presetKey?: string } = {}
): Promise<{ videoTask: ModuleVideoTask; remoteTaskId: string }> {
  return safeAICall("generateVideoFromShot", async () => {
    const shot = await ctx.shots.findById(shotId);
    if (!shot) throw new Error("镜头不存在");
    if (!shot.description) throw new Error("镜头描述为空，无法生成视频");

    const storyboard = shot.storyboard_id ? await ctx.storyboards.findById(shot.storyboard_id) : null;
    const prompt = shot.description || storyboard?.description || "";
    const imageUrl = shot.image_url || (storyboard as any)?.image_url || undefined;

    // RENDER-F03/F04:presetKey 优先
    const preset = resolveVideoParams({
      presetKey: options.presetKey ?? null,
      ratio: options.ratio ?? null,
      duration: ((options.duration as any) ?? shot.duration ?? 5) as 3 | 5 | 10 | 18,
      num_inference_steps: options.num_inference_steps,
    });
    const params: any = {
      prompt,
      image: imageUrl,
      ratio: preset.ratio,
      width: preset.width,
      height: preset.height,
      duration: preset.duration,
      num_inference_steps: preset.num_inference_steps,
      mode: imageUrl ? "ti2vid" : undefined,
    };
    const result = await ctx.ai.generateVideo(params);
    const aiTaskId = ((result as any).taskId || (result as any).id) ?? "";
    const task = await createModuleVideoTask(ctx, {
      project_id: shot.project_id,
      storyboard_id: shot.storyboard_id ?? "",
      shot_id: shot.id,
      title: shot.title || `镜头 ${shot.shot_number} 视频`,
      prompt,
      image_url: imageUrl ?? "",
      params,
      ai_task_id: aiTaskId,
      status: "processing",
      progress: 0,
      duration: options.duration ?? shot.duration ?? 5,
      resolution: `${preset.width}x${preset.height} (${preset.ratio})`,
      format: "mp4",
      episode: shot.episode,
    });
    // 回填镜头 video_task_id
    await ctx.shots.update(shot.id, {
      video_task_id: task.id,
      status: "generating",
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
    shot_id?: string;
    emotion?: string;
    voice?: string;
  }
): Promise<Audio> {
  return safeAICall("generateTTS", async () => {
    // V2 W12 P0 REQ-AUDIO-F02：角色音色绑定。如果 voice 未提供，查询 character.voice_id
    let resolvedVoice = input.voice ?? "default";
    let resolvedEmotion = input.emotion ?? "neutral";
    if (input.character_id) {
      try {
        const ch = (await ctx.characters.findById(input.character_id)) as
          | { voice_id?: string; voice_speed?: number; voice_emotion?: string }
          | null;
        if (ch) {
          if (!input.voice && ch.voice_id) {
            resolvedVoice = ch.voice_id;
          }
          if (input.emotion === undefined && ch.voice_emotion) {
            resolvedEmotion = ch.voice_emotion;
          }
        }
      } catch {
        // 角色查询失败不影响 TTS 主流程
      }
    }
    // V2 W12 P0 REQ-AUDIO-F03：shot.dialogue 自动转换。
    // 如果 text 为空但 shot_id 存在，尝试从 shots 表拉取 dialogue 字段
    let resolvedText = input.text;
    if (!resolvedText && input.shot_id) {
      try {
        const shot = (await ctx.shots?.findById(input.shot_id)) as
          | { id: string; dialogue?: string }
          | null
          | undefined;
        if (shot && shot.dialogue) {
          resolvedText = shot.dialogue;
        }
      } catch {
        // shot 查询失败不影响 TTS
      }
    }
    const result = await ctx.ai.generateTTS({
      text: resolvedText,
      voice: resolvedVoice,
      emotion: resolvedEmotion,
    });
    if (result.status !== "success" || !result.file_url) {
      throw new Error("TTS Provider 未返回可用音频文件");
    }
    return createAudio(ctx, {
      project_id: input.project_id,
      name: `${input.speaker || "配音"}-${(resolvedText || "").slice(0, 12)}`,
      type: "voiceover",
      description: resolvedText,
      duration: 0,
      file_url: result.file_url ?? "",
      speaker: input.speaker,
      character_id: input.character_id,
      storyboard_id: input.storyboard_id,
      shot_id: input.shot_id,
      format: "mp3",
      size: 0,
    });
  });
}

/**
 * batchGenerateTTS - 批量 TTS 生成（用于剧本批量配音）
 * @param {AppContext} ctx - 应用上下文
 * @param {Array<{project_id: string; text: string; speaker: string; character_id?: string; storyboard_id?: string; shot_id?: string}>} items - 批量配音项
 * @returns {Promise<{success: Audio[]; failed: number}>} 成功列表和失败数
 */
export async function batchGenerateTTS(
  ctx: AppContext,
  items: Array<{
    project_id: string;
    text: string;
    speaker: string;
    character_id?: string;
    storyboard_id?: string;
    shot_id?: string;
    voice?: string;
    emotion?: string;
  }>
): Promise<{ success: Audio[]; failed: number }> {
  const success: Audio[] = [];
  let failed = 0;

  for (const item of items) {
    try {
      const audio = await generateTTS(ctx, item);
      success.push(audio);
    } catch (err) {
      rootLogger.warn({ event: "tts.batch_item_failed", text: item.text.slice(0, 30), err: String(err) }, "批量 TTS 单项失败");
      failed += 1;
    }
  }

  return { success, failed };
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
