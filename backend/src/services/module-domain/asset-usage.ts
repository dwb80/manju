/**
 * @file asset-usage.ts
 * @description 资产引用关系查询服务，提供角色、场景、道具在剧本、分镜中的使用情况统计
 */

import type { AppContext } from "../app.js";
import type { ScriptDocument } from "../../types/script.js";
import type { Storyboard } from "../../types/storyboard.js";
import type { ProjectStoryboard } from "../../types/storyboard.js";
import type { ScriptDialogue, ScriptScene, ScriptSceneCharacter, ScriptSceneLocation } from "../../types/script.js";

export type UsageReferenceItem = {
  type: "script" | "storyboard" | "dialogue" | "scene_character" | "scene_location" | "script_center";
  id: string;
  title: string;
  project_id?: string;
  context?: string;
  episode?: number;
};

export type AssetUsage = {
  id: string;
  total: number;
  storyboards: UsageReferenceItem[];
  scripts: UsageReferenceItem[];
  dialogues: UsageReferenceItem[];
  sceneCharacters: UsageReferenceItem[];
  sceneLocations: UsageReferenceItem[];
  usage_count: number;
};

function decodeIdList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value !== "string" || value.length === 0) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function countNameOccurrences(text: string | undefined, name: string): number {
  if (!text || !name) return 0;
  let count = 0;
  let index = 0;
  while (true) {
    const found = text.indexOf(name, index);
    if (found < 0) break;
    count += 1;
    index = found + name.length;
  }
  return count;
}

async function finalizeUsage(
  ctx: AppContext,
  repo: { update: (id: string, patch: Record<string, unknown>) => Promise<void> },
  entityId: string,
  parts: Omit<AssetUsage, "id" | "total" | "usage_count">,
): Promise<AssetUsage> {
  const storyboards = parts.storyboards;
  const scripts = parts.scripts;
  const dialogues = parts.dialogues;
  const sceneCharacters = parts.sceneCharacters;
  const sceneLocations = parts.sceneLocations;
  const total = storyboards.length + scripts.length + dialogues.length + sceneCharacters.length + sceneLocations.length;
  try {
    await repo.update(entityId, { usage_count: total, updated_at: new Date().toISOString() } as Record<string, unknown>);
  } catch { }
  return {
    id: entityId,
    total,
    storyboards,
    scripts,
    dialogues,
    sceneCharacters,
    sceneLocations,
    usage_count: total,
  };
}

/**
 * getCharacterUsage - 获取角色在项目中的引用关系
 * @param {AppContext} ctx - 应用上下文
 * @param {string} characterId - 角色 ID
 * @returns {Promise<AssetUsage>} 角色使用情况，包含分镜、剧本、对白等引用列表
 */
export async function getCharacterUsage(ctx: AppContext, characterId: string): Promise<AssetUsage> {
  const character = await ctx.characters.findById(characterId);
  if (!character) throw new Error("角色不存在");

  const allSceneCharRefs = await ctx.scriptSceneCharacters.findMany({});
  const directSceneCharRefs = allSceneCharRefs.filter((ref) => ref.character_asset_id === characterId);
  const sceneIds = Array.from(new Set(directSceneCharRefs.map((ref) => ref.scene_id)));
  const allScriptScenes = sceneIds.length > 0
    ? (await ctx.scriptScenes.findMany({})).filter((sc) => sceneIds.includes(sc.id))
    : [];
  const sceneCharacters: UsageReferenceItem[] = directSceneCharRefs.map((ref) => {
    const scene = allScriptScenes.find((sc) => sc.id === ref.scene_id);
    return {
      type: "scene_character",
      id: ref.id,
      title: scene ? `场景 ${scene.scene_no} · ${scene.location_name}` : `场景引用 ${ref.id}`,
      project_id: ref.project_id,
      context: scene?.description || "",
    };
  });

  const allDialogues = await ctx.scriptDialogues.findMany({ character_id: characterId } as Partial<ScriptDialogue>);
  const allDialogueSceneIds = Array.from(new Set(allDialogues.map((d) => d.scene_id)));
  const dialogueScenes = allDialogueSceneIds.length > 0
    ? (await ctx.scriptScenes.findMany({})).filter((sc) => allDialogueSceneIds.includes(sc.id))
    : [];
  const dialogues: UsageReferenceItem[] = allDialogues.map((d) => {
    const scene = dialogueScenes.find((sc) => sc.id === d.scene_id);
    return {
      type: "dialogue",
      id: d.id,
      title: scene ? `对白 · ${scene.location_name}` : "对白",
      project_id: d.project_id,
      context: d.dialogue,
    };
  });

  const allStoryboards = await ctx.storyboards.findMany({ project_id: character.project_id } as Partial<Storyboard>);
  const matchedStoryboards = allStoryboards.filter((sb) => {
    // 1) 精确按 character_asset_ids 数组匹配（来自表单/剧本分析的结构化引用）
    if (decodeIdList(sb.character_asset_ids).includes(characterId)) return true;
    // 2) 兜底按 dialogue 文本里出现角色名的弱匹配（兼容历史数据）
    if (countNameOccurrences(sb.dialogue, character.name) > 0) return true;
    return false;
  });
  const storyboards: UsageReferenceItem[] = matchedStoryboards.map((sb) => ({
    type: "storyboard",
    id: sb.id,
    title: sb.description?.slice(0, 30) || `分镜 #${sb.shot_number}`,
    project_id: sb.project_id,
    context: sb.dialogue,
    episode: sb.episode,
  }));

  const allProjectStoryboards = await ctx.projectStoryboards.findMany({ project_id: character.project_id } as Partial<ProjectStoryboard>);
  const projectStoryboardRefs = allProjectStoryboards.filter((sb) => decodeIdList(sb.character_asset_ids).includes(characterId));
  for (const sb of projectStoryboardRefs) {
    storyboards.push({
      type: "storyboard",
      id: sb.id,
      title: sb.title || `分镜 ${sb.episode}-${sb.scene}-${sb.shot}`,
      project_id: sb.project_id,
      context: sb.description,
      episode: sb.episode,
    });
  }

  const allDocs = await ctx.scriptDocuments.findMany({ project_id: character.project_id } as Partial<ScriptDocument>);
  const matchedDocs = allDocs.filter((doc) => {
    return countNameOccurrences(doc.title, character.name) > 0
      || countNameOccurrences(doc.editor_json, character.name) > 0;
  });
  const scripts: UsageReferenceItem[] = matchedDocs.map((doc) => ({
    type: "script",
    id: doc.id,
    title: doc.title,
    project_id: doc.project_id,
    context: doc.editor_json,
  }));

  return await finalizeUsage(ctx, ctx.characters as unknown as { update: (id: string, patch: Record<string, unknown>) => Promise<void> }, characterId, {
    storyboards,
    scripts,
    dialogues,
    sceneCharacters,
    sceneLocations: [],
  });
}

/**
 * getSceneUsage - 获取场景在项目中的引用关系
 * @param {AppContext} ctx - 应用上下文
 * @param {string} sceneId - 场景 ID
 * @returns {Promise<AssetUsage>} 场景使用情况，包含分镜、剧本、场景地点等引用列表
 */
export async function getSceneUsage(ctx: AppContext, sceneId: string): Promise<AssetUsage> {
  const scene = await ctx.scenes.findById(sceneId);
  if (!scene) throw new Error("场景不存在");

  const allStoryboards = await ctx.storyboards.findMany({ scene_id: sceneId } as Partial<Storyboard>);
  const storyboards: UsageReferenceItem[] = allStoryboards.map((sb) => ({
    type: "storyboard",
    id: sb.id,
    title: sb.description?.slice(0, 30) || `分镜 #${sb.shot_number}`,
    project_id: sb.project_id,
    context: sb.dialogue,
    episode: sb.episode,
  }));

  const allProjectStoryboards = await ctx.projectStoryboards.findMany({ project_id: scene.project_id } as Partial<ProjectStoryboard>);
  const projectStoryboardRefs = allProjectStoryboards.filter((sb) => sb.scene_asset_id === sceneId);
  for (const sb of projectStoryboardRefs) {
    storyboards.push({
      type: "storyboard",
      id: sb.id,
      title: sb.title || `分镜 ${sb.episode}-${sb.scene}-${sb.shot}`,
      project_id: sb.project_id,
      context: sb.description,
      episode: sb.episode,
    });
  }

  const allSceneLocRefs = await ctx.scriptSceneLocations.findMany({});
  const directSceneLocRefs = allSceneLocRefs.filter((ref) => ref.location_asset_id === sceneId);
  const locSceneIds = Array.from(new Set(directSceneLocRefs.map((ref) => ref.scene_id)));
  const locScenes = locSceneIds.length > 0
    ? (await ctx.scriptScenes.findMany({})).filter((sc) => locSceneIds.includes(sc.id))
    : [];
  const sceneLocations: UsageReferenceItem[] = directSceneLocRefs.map((ref) => {
    const sc = locScenes.find((item) => item.id === ref.scene_id);
    return {
      type: "scene_location",
      id: ref.id,
      title: sc ? `场景 ${sc.scene_no} · ${sc.location_name}` : `场景地点引用 ${ref.id}`,
      project_id: ref.project_id,
      context: sc?.description || "",
    };
  });

  const allDocs = await ctx.scriptDocuments.findMany({ project_id: scene.project_id } as Partial<ScriptDocument>);
  const matchedDocs = allDocs.filter((doc) => {
    return countNameOccurrences(doc.title, scene.name) > 0
      || countNameOccurrences(doc.editor_json, scene.name) > 0;
  });
  const scripts: UsageReferenceItem[] = matchedDocs.map((doc) => ({
    type: "script",
    id: doc.id,
    title: doc.title,
    project_id: doc.project_id,
    context: doc.editor_json,
  }));

  return await finalizeUsage(ctx, ctx.scenes as unknown as { update: (id: string, patch: Record<string, unknown>) => Promise<void> }, sceneId, {
    storyboards,
    scripts,
    dialogues: [],
    sceneCharacters: [],
    sceneLocations,
  });
}

/**
 * getPropUsage - 获取道具在项目中的引用关系
 * @param {AppContext} ctx - 应用上下文
 * @param {string} propId - 道具 ID
 * @returns {Promise<AssetUsage>} 道具使用情况，包含分镜、剧本等引用列表
 */
export async function getPropUsage(ctx: AppContext, propId: string): Promise<AssetUsage> {
  const prop = await ctx.props.findById(propId);
  if (!prop) throw new Error("道具不存在");

  const allDocs = await ctx.scriptDocuments.findMany({ project_id: prop.project_id } as Partial<ScriptDocument>);
  const matchedDocs = allDocs.filter((doc) => {
    return countNameOccurrences(doc.title, prop.name) > 0
      || countNameOccurrences(doc.editor_json, prop.name) > 0;
  });
  const scripts: UsageReferenceItem[] = matchedDocs.map((doc) => ({
    type: "script",
    id: doc.id,
    title: doc.title,
    project_id: doc.project_id,
    context: doc.editor_json,
  }));

  const allStoryboards = await ctx.storyboards.findMany({ project_id: prop.project_id } as Partial<Storyboard>);
  const matchedStoryboards = allStoryboards.filter((sb) => {
    // 1) 精确按 prop_asset_ids 数组匹配
    if (decodeIdList(sb.prop_asset_ids).includes(propId)) return true;
    // 2) 兜底按 description / dialogue 文本匹配
    if (countNameOccurrences(sb.description, prop.name) > 0) return true;
    if (countNameOccurrences(sb.dialogue, prop.name) > 0) return true;
    return false;
  });
  const storyboards: UsageReferenceItem[] = matchedStoryboards.map((sb) => ({
    type: "storyboard",
    id: sb.id,
    title: sb.description?.slice(0, 30) || `分镜 #${sb.shot_number}`,
    project_id: sb.project_id,
    context: sb.dialogue,
    episode: sb.episode,
  }));

  return await finalizeUsage(ctx, ctx.props as unknown as { update: (id: string, patch: Record<string, unknown>) => Promise<void> }, propId, {
    storyboards,
    scripts,
    dialogues: [],
    sceneCharacters: [],
    sceneLocations: [],
  });
}
