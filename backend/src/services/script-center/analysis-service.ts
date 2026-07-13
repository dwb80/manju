/**
 * 剧本分析服务
 *
 * - parseScriptDocument: 解析剧本文档，提取场景、对白等结构化信息
 * - getScriptStatistics: 剧本统计（字数、场景数、角色频率、节奏数据）
 * - checkScriptContinuity: 连续性检查（场景编号、对白关联、场景描述）
 * - getDocumentVersions: 获取文档当前版本 + 历史
 */

import type { AppContext } from "../app.js";
import type { ScriptBackup, ScriptDialogue, ScriptDocument, ScriptScene } from "../../types.js";
import { extractPlainText } from "./utils.js";
import { splitTextIntoEpisodes } from "./parser.js";
import type { ParsedDialogue } from "./types.js";

/**
 * 解析剧本文档，提取场景、对白等结构化信息。
 * 仅用于预览/分析：返回的对象 id 为空字符串，需要 persistAnalyzedAssets 才能落库。
 */
export async function parseScriptDocument(ctx: AppContext, documentId: string): Promise<{
  scenes: ScriptScene[];
  dialogues: ScriptDialogue[];
}> {
  const document = await ctx.scriptDocuments.findById(documentId);
  if (!document) throw new Error("剧本文档不存在");

  // 1) 从 Tiptap editor_json 抽纯文本
  const plainText = extractPlainText(document.editor_json);
  if (!plainText) {
    return { scenes: [], dialogues: [] };
  }

  // 2) 用 parser 拆成 剧集 → 场景 → 对白
  //    注意：解析时还没有 episode_id（要先 import 才能确定），
  //    因此把所有场景/对白拍平挂到 document.project_id 下，episode_id 留空让上层后续补。
  const projectId = document.project_id;
  const episodes = splitTextIntoEpisodes(plainText);
  const scenes: ScriptScene[] = [];
  const dialogues: ScriptDialogue[] = [];
  const now = new Date().toISOString();

  for (const ep of episodes) {
    for (const ps of ep.scenes) {
      const sceneId = `preview-scene-${ep.episode_no}-${ps.scene_no}`;
      scenes.push({
        id: sceneId,
        project_id: projectId,
        episode_id: "", // 由 import 流程回填
        scene_no: ps.scene_no,
        location_name: ps.location_name,
        time_of_day: ps.time_of_day,
        description: ps.description,
        notes: ps.notes,
        created_at: now,
        updated_at: now,
      });
      for (const pd of ps.dialogues) {
        dialogues.push(mapParsedDialogue(pd, projectId, sceneId, dialogues.length));
      }
    }
  }
  return { scenes, dialogues };
}

/** 把 parser 出的 ParsedDialogue 收敛成 ScriptDialogue 形状 */
function mapParsedDialogue(
  pd: ParsedDialogue,
  projectId: string,
  sceneId: string,
  order: number
): ScriptDialogue {
  const now = new Date().toISOString();
  return {
    id: `preview-dialogue-${sceneId}-${order}`,
    project_id: projectId,
    scene_id: sceneId,
    character_id: "", // 留待 import 时按 name 查角色工厂回填
    dialogue: pd.text,
    emotion: pd.emotion,
    order: pd.order ?? order,
    created_at: now,
    updated_at: now,
  };
}

export async function getScriptStatistics(ctx: AppContext, documentId: string): Promise<{
  totalWords: number;
  totalScenes: number;
  totalCharacters: number;
  totalDialogues: number;
  characterFrequency: Array<{ name: string; count: number }>;
  sceneDistribution: Array<{ location: string; count: number }>;
  pacingData: Array<{ position: number; intensity: number }>;
}> {
  const document = await ctx.scriptDocuments.findById(documentId);
  if (!document) throw new Error("剧本文档不存在");

  const scenes = await ctx.scriptScenes.findMany({ project_id: document.project_id });
  const dialogues = await ctx.scriptDialogues.findMany({ project_id: document.project_id });
  const sceneCharacters = await ctx.scriptSceneCharacters.findMany({});

  // 字数：先用 Tiptap 解析拿纯文本；解析失败时回退到 0，避免抛 500。
  let totalWords = 0;
  try {
    const plain = extractPlainText(document.editor_json);
    if (plain) {
      // 去掉空白字符后再数（中文以字符为单位）
      totalWords = plain.replace(/\s+/g, "").length;
    }
  } catch (err) {
    totalWords = 0;
  }

  // 角色频率统计
  const charCountMap = new Map<string, number>();
  for (const sc of sceneCharacters) {
    const key = sc.character_asset_id || "未知";
    charCountMap.set(key, (charCountMap.get(key) ?? 0) + 1);
  }

  // 场景分布统计
  const sceneDistMap = new Map<string, number>();
  for (const scene of scenes) {
    const loc = scene.location_name || "未知";
    sceneDistMap.set(loc, (sceneDistMap.get(loc) ?? 0) + 1);
  }

  // 节奏数据：基于每场对白数 + 描述长度做归一化（0-100），
  // 替代之前的 Math.random() 假数据。每次刷新结果稳定可复现。
  const pacingData = computePacingData(scenes, dialogues);

  return {
    totalWords,
    totalScenes: scenes.length,
    totalCharacters: sceneCharacters.length,
    totalDialogues: dialogues.length,
    characterFrequency: Array.from(charCountMap.entries()).map(([name, count]) => ({ name, count })),
    sceneDistribution: Array.from(sceneDistMap.entries()).map(([location, count]) => ({ location, count })),
    pacingData,
  };
}

/**
 * 节奏强度 = (本场对白数 / 全部对白数) × 100，
 * 用对白密度代理场景情绪张力。再加描述长度修正（描述长 → 节奏慢）。
 * 最多返回前 20 场。
 */
function computePacingData(
  scenes: ScriptScene[],
  dialogues: ScriptDialogue[]
): Array<{ position: number; intensity: number }> {
  if (scenes.length === 0) return [];
  const dialoguesByScene = new Map<string, number>();
  for (const d of dialogues) {
    if (!d.scene_id) continue;
    dialoguesByScene.set(d.scene_id, (dialoguesByScene.get(d.scene_id) ?? 0) + 1);
  }
  const totalDialogues = Math.max(1, dialogues.length);
  const maxDescLen = Math.max(
    1,
    ...scenes.map((s) => (s.description ?? "").length)
  );
  return scenes.slice(0, 20).map((s, i) => {
    const dlgCount = dialoguesByScene.get(s.id) ?? 0;
    const dialogueDensity = (dlgCount / totalDialogues) * 100;
    const descLen = (s.description ?? "").length;
    const descPenalty = (descLen / maxDescLen) * 30; // 0-30
    const intensity = Math.max(
      0,
      Math.min(100, Math.round(dialogueDensity * 4 - descPenalty + 30))
    );
    return { position: i + 1, intensity };
  });
}

export async function checkScriptContinuity(ctx: AppContext, documentId: string): Promise<{
  issues: Array<{
    type: "character" | "scene" | "timeline" | "prop";
    severity: "error" | "warning";
    message: string;
    location: string;
    suggestion?: string;
  }>;
}> {
  const document = await ctx.scriptDocuments.findById(documentId);
  if (!document) throw new Error("剧本文档不存在");

  const scenes = await ctx.scriptScenes.findMany({ project_id: document.project_id });
  const dialogues = await ctx.scriptDialogues.findMany({ project_id: document.project_id });
  const issues: Array<{
    type: "character" | "scene" | "timeline" | "prop";
    severity: "error" | "warning";
    message: string;
    location: string;
    suggestion?: string;
  }> = [];

  // 检查场景编号连续性
  const sortedScenes = [...scenes].sort((a, b) => a.scene_no - b.scene_no);
  for (let i = 1; i < sortedScenes.length; i++) {
    if (sortedScenes[i].scene_no !== sortedScenes[i - 1].scene_no + 1) {
      issues.push({
        type: "scene",
        severity: "warning",
        message: `场景编号不连续：从 ${sortedScenes[i - 1].scene_no} 跳到 ${sortedScenes[i].scene_no}`,
        location: `场景 ${sortedScenes[i].scene_no}`,
        suggestion: "建议重新编号场景以保持连续性",
      });
    }
  }

  // 检查对白中是否有未关联角色的条目
  for (const dialogue of dialogues) {
    if (!dialogue.character_id) {
      issues.push({
        type: "character",
        severity: "warning",
        message: "对白未关联角色",
        location: `对白ID: ${dialogue.id}`,
        suggestion: "建议为该对白关联一个角色",
      });
    }
  }

  // 检查场景是否缺少描述
  for (const scene of scenes) {
    if (!scene.description || scene.description.trim().length === 0) {
      issues.push({
        type: "scene",
        severity: "warning",
        message: `场景 ${scene.scene_no} 缺少描述`,
        location: `场景 ${scene.scene_no}: ${scene.location_name}`,
        suggestion: "建议补充场景描述以提升剧本完整性",
      });
    }
  }

  return { issues };
}

export async function getDocumentVersions(ctx: AppContext, documentId: string): Promise<{
  current: ScriptDocument | null;
  history: ScriptBackup[];
}> {
  const current = await ctx.scriptDocuments.findById(documentId);
  const history = await ctx.scriptBackups.findMany(
    { project_id: current?.project_id ?? "" },
    { sort: "desc" }
  );

  return { current, history };
}
