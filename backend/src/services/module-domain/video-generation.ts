import type { AppContext } from "../app.js";
import type { ModuleVideoTask } from "../../types/video.js";
import type { Storyboard } from "../../types/storyboard.js";
import type { Audio } from "../../types/audio.js";
import { createModuleVideoTask } from "./video-task-module.js";
import { createAudio } from "./audio-module.js";
import { nowIso } from "../../utils.js";

export async function generateVideoFromStoryboard(
  ctx: AppContext,
  storyboardId: string,
  options: { ratio?: string; duration?: number; num_inference_steps?: number } = {}
): Promise<{ videoTask: ModuleVideoTask; remoteTaskId: string }> {
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
  const result = await ctx.ai.generateTTS({
    text: input.text,
    voice: input.voice ?? "default",
    emotion: input.emotion ?? "neutral",
  });
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
}

export async function getCharacterAppearances(ctx: AppContext, characterId: string): Promise<{ storyboards: number; audios: number; total: number }> {
  const character = await ctx.characters.findById(characterId);
  if (!character) return { storyboards: 0, audios: 0, total: 0 };
  const allStoryboards = await ctx.storyboards.findMany();
  const allAudios = await ctx.audios.findMany();
  const sb = allStoryboards.filter((s) => (s.dialogue || "").includes(character.name)).length;
  const au = allAudios.filter((a) => a.character_id === characterId).length;
  return { storyboards: sb, audios: au, total: sb + au };
}

export async function getSceneAppearances(ctx: AppContext, sceneId: string): Promise<{ storyboards: number; total: number }> {
  const all = await ctx.storyboards.findMany({ scene_id: sceneId } as any);
  return { storyboards: all.length, total: all.length };
}

export async function getPropAppearances(ctx: AppContext, propId: string): Promise<{ total: number }> {
  const prop = await ctx.props.findById(propId);
  if (!prop) return { total: 0 };
  const all = await ctx.storyboards.findMany();
  const matched = all.filter((s) => (s.notes || "").includes(prop.name) || (s.description || "").includes(prop.name)).length;
  return { total: matched };
}

export async function listCharacterTemplatePresets() {
  const { listCharacterTemplates } = await import("../asset-templates.js");
  return listCharacterTemplates();
}

export async function listSceneTemplatePresets() {
  const { listSceneTemplates } = await import("../asset-templates.js");
  return listSceneTemplates();
}

export async function listPropTemplatePresets() {
  const { listPropTemplates } = await import("../asset-templates.js");
  return listPropTemplates();
}
