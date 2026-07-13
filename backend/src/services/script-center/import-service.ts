/**
 * 剧本导入导出服务
 *
 * - exportScriptAsJson: 导出剧本为 JSON
 * - importScriptFromJson: 从 JSON 导入剧本（含 AI 资产分析、剧集拆分、补偿式回滚）
 * - persistAnalyzedAssets: 将 AI 分析得到的资产写入对应的工厂表
 */

import type { AppContext } from "../app.js";
import type { ScriptDocument } from "../../types.js";
import { nowIso } from "../../utils.js";
import { rootLogger } from "../../logger.js";
import { analyzeScriptWithAI, aiResultToAssets } from "../script-analyze-ai.js";
import type { AnalyzedAsset } from "../script-analyze-ai.js";
import { listCharacters, createCharacter, createScene, createProp } from "../module-domain.js";
import {
  createScriptDialogue,
  deleteScriptDialogue,
} from "./dialogue-service.js";
import {
  createScriptDocument,
  deleteScriptDocument,
} from "./document-service.js";
import {
  createScriptEpisode,
  deleteScriptEpisode,
} from "./episode-service.js";
import {
  createScriptScene,
  deleteScriptScene,
} from "./scene-service.js";
import { createBackup } from "./backup-service.js";
import { splitTextIntoEpisodes } from "./parser.js";
import { extractPlainText } from "./utils.js";
import type { ParsedEpisode } from "./types.js";

export async function exportScriptAsJson(ctx: AppContext, documentId: string): Promise<string> {
  const document = await ctx.scriptDocuments.findById(documentId);
  if (!document) throw new Error("剧本文档不存在");

  const episodes = await ctx.scriptEpisodes.findMany({ document_id: documentId });
  const scenes = await ctx.scriptScenes.findMany({ project_id: document.project_id });
  const dialogues = await ctx.scriptDialogues.findMany({ project_id: document.project_id });

  const exportData = {
    document,
    episodes,
    scenes,
    dialogues,
    exported_at: nowIso(),
  };

  return JSON.stringify(exportData, null, 2);
}

export async function importScriptFromJson(
  ctx: AppContext,
  projectId: string,
  jsonData: string
): Promise<ScriptDocument> {
  const data = JSON.parse(jsonData);

  // 1. 创建剧本文档
  const document = await createScriptDocument(ctx, {
    project_id: projectId,
    editor_json: data.document?.editor_json ?? jsonData,
    version: 1,
  });

  // 2. 从 editor_json 提取纯文本（用于 AI 分析与剧集拆分）
  const plainText = extractPlainText(data.document?.editor_json);

  // 3. 调用 AI 分析剧本内容，提取角色/场景/道具
  //    阈值：1000 字（Feature 3.3 前置条件）
  //    AI 失败时不影响主流程（脚本-analyze-ai 内部已自动回退到 localFallback）
  try {
    if (plainText && plainText.length >= 1000) {
      // 使用规范版本 analyzeScriptWithAI(ctx, {content, format, useLocal?})；
      // 再通过 aiResultToAssets 转为扁平 AnalyzedAsset[] 给 persistAnalyzedAssets。
      const aiResult = await analyzeScriptWithAI(ctx, {
        content: plainText,
        format: "txt",
        useLocal: false,
      });
      if (aiResult.success && aiResult.data) {
        const assets = aiResultToAssets(aiResult.data);
        if (assets.length > 0) {
          await persistAnalyzedAssets(ctx, projectId, assets);
        }
      }
    }
  } catch (err) {
    rootLogger.warn({ event: "script.import.aiAnalyzeFailed", err }, "[importScriptFromJson] AI 资产分析失败");
  }

  // 4. 拆分剧集 + 场景 + 对白
  //    优先使用调用方显式传入的 episodes 数组（结构需包含 scenes）
  //    否则按文本中的 heading/章节自动拆分
  let episodes: ParsedEpisode[];
  if (data.episodes && Array.isArray(data.episodes) && data.episodes.length > 0) {
    episodes = data.episodes.map((ep: any, idx: number) => ({
      episode_no: ep.episode_no ?? idx + 1,
      title: ep.title || `第${idx + 1}集`,
      synopsis: ep.synopsis || "",
      status: ep.status || "draft",
      scenes: Array.isArray(ep.scenes) ? ep.scenes.map((s: any, sIdx: number) => ({
        scene_no: s.scene_no ?? sIdx + 1,
        location_name: s.location_name || s.location || "",
        time_of_day: normalizeTimeOfDay(s.time_of_day || s.time || "day"),
        description: s.description || "",
        dialogues: Array.isArray(s.dialogues) ? s.dialogues.map((d: any, dIdx: number) => ({
          character: d.character || "",
          text: d.text || "",
          emotion: d.emotion || "",
          order: d.order ?? dIdx,
        })) : [],
      })) : [],
    }));
  } else {
    episodes = splitTextIntoEpisodes(plainText);
  }

  // 5. 写入数据库：剧集 → 场景 → 对白
  //    评审 P1-H4 修复：用补偿式回滚保证半成品不污染数据库：
  //    任何一步失败 → 逆序删除已写入的 document/episode/scene/dialogue。
  const createdDocumentIds: string[] = [document.id];
  const createdEpisodeIds: string[] = [];
  const createdSceneIds: string[] = [];
  const createdDialogueIds: string[] = [];
  const rollback = async (reason: unknown) => {
    rootLogger.warn(
      {
        event: "script.import.rollback",
        reason: String(reason),
        createdCount: {
          documents: createdDocumentIds.length,
          episodes: createdEpisodeIds.length,
          scenes: createdSceneIds.length,
          dialogues: createdDialogueIds.length,
        },
      },
      `[importScriptFromJson] 回滚已写入记录: ${reason}`,
    );
    for (const idToDel of createdDialogueIds.reverse()) {
      try { await deleteScriptDialogue(ctx, idToDel); } catch { }
    }
    for (const idToDel of createdSceneIds.reverse()) {
      try { await deleteScriptScene(ctx, idToDel); } catch { }
    }
    for (const idToDel of createdEpisodeIds.reverse()) {
      try { await deleteScriptEpisode(ctx, idToDel); } catch { }
    }
    for (const idToDel of createdDocumentIds.reverse()) {
      try { await deleteScriptDocument(ctx, idToDel); } catch { }
    }
  };
  try {
    for (const episode of episodes) {
      const createdEpisode = await createScriptEpisode(ctx, {
        project_id: projectId,
        document_id: document.id,
        episode_no: episode.episode_no,
        title: episode.title,
        synopsis: episode.synopsis,
        status: episode.status || "draft",
      });
      createdEpisodeIds.push(createdEpisode.id);

      for (const scene of episode.scenes || []) {
        const createdScene = await createScriptScene(ctx, {
          project_id: projectId,
          episode_id: createdEpisode.id,
          scene_no: scene.scene_no,
          location_name: scene.location_name,
          time_of_day: scene.time_of_day,
          description: scene.description,
          notes: scene.notes || "",
        });
        createdSceneIds.push(createdScene.id);

        // 写入对白（按 character 名称查表获取 character_id）。
        // 评审 P1-H3 修复：用 listCharacters 走已过滤 deleted_at 的服务，
        // 避免直接查 Repository 漏掉软删角色被"复活"绑定到对白。
        for (const dialogue of scene.dialogues || []) {
          if (!dialogue.text || !dialogue.character) continue;
          const charRecord = await listCharacters(ctx, projectId, dialogue.character);
          if (charRecord.length > 0) {
            const inserted = await createScriptDialogue(ctx, {
              project_id: projectId,
              scene_id: createdScene.id,
              character_id: charRecord[0].id,
              dialogue: dialogue.text,
              emotion: dialogue.emotion || "",
              order: dialogue.order,
            });
            createdDialogueIds.push(inserted.id);
          }
        }
      }
    }
  } catch (err) {
    await rollback(err);
    throw err;
  }

  // 6. 导入后自动生成版本快照（Feature 4.5 业务规则）
  try {
    await createBackup(ctx, projectId, document.id, "manual", "system");
  } catch (err) {
    rootLogger.warn(
      { event: "script.import.versionFailed", documentId: document.id, err },
      "[importScriptFromJson] 版本快照创建失败",
    );
  }

  // 7. 写入导入日志（Feature 4.5 业务规则：导入时间、文件名、格式、解析结果、操作者）
  try {
    const sceneCount = episodes.reduce((sum, ep) => sum + (ep.scenes?.length || 0), 0);
    const dialogueCount = episodes.reduce(
      (sum, ep) =>
        sum +
        (ep.scenes || []).reduce(
          (sSum, sc) => sSum + (sc.dialogues?.length || 0),
          0
        ),
      0
    );
    rootLogger.info(
      {
        event: "script.import.completed",
        projectId,
        documentId: document.id,
        fileName: data.file_name || "导入剧本",
        format: data.format || "json",
        episodes: episodes.length,
        scenes: sceneCount,
        dialogues: dialogueCount,
        operator: "system",
        at: nowIso(),
      },
      "script import completed",
    );
  } catch {
    // 日志失败不影响导入
  }

  return document;
}

/** 规范化时间段枚举 */
function normalizeTimeOfDay(value: string): "day" | "night" | "dawn" | "dusk" {
  const v = (value || "").toLowerCase();
  if (v.includes("夜") || v.includes("night")) return "night";
  if (v.includes("黄昏") || v.includes("傍晚") || v.includes("dusk")) return "dusk";
  if (v.includes("晨") || v.includes("黎明") || v.includes("dawn")) return "dawn";
  return "day";
}

/**
 * 道具分级 importance_level → PropCategory 枚举的归一化映射。
 * AI 输出的"核心/普通/背景"语义落到类型系统的合法 category 上；
 * 命中不了就回退 "other"，避免把脏字符串塞进 schema。
 */
const IMPORTANCE_TO_PROP_CATEGORY: Record<string, "weapon" | "tool" | "clothing" | "food" | "vehicle" | "artifact" | "furniture" | "other"> = {
  核心道具: "artifact",
  普通道具: "tool",
  背景道具: "furniture",
};

/**
 * 场景类型 indoor_outdoor → Scene["type"] 归一化。
 * AI 可能输出 "mixed"，scene 的类型枚举不包含它，落到 "indoor" 兜底。
 */
const INDOOR_OUTDOOR_TO_SCENE_TYPE: Record<string, "indoor" | "outdoor" | "virtual"> = {
  indoor: "indoor",
  outdoor: "outdoor",
  mixed: "indoor",
  virtual: "virtual",
};

/**
 * 将 AI 分析得到的资产写入对应的工厂表。
 * - 通过 createCharacter/createScene/createProp 入库，自动处理 (project_id, name) 查重、
 *   usage_count/version 初始化、版本快照、审计日志。
 * - 失败的资产不阻塞其他资产入库。
 */
async function persistAnalyzedAssets(
  ctx: AppContext,
  projectId: string,
  assets: AnalyzedAsset[]
): Promise<void> {
  for (const asset of assets) {
    if (!asset || !asset.name) continue;
    try {
      if (asset.type === "character") {
        // 注意：age 缺省时不要写 0（语义错误：不是 0 岁），交给 createCharacter 走 undefined
        await createCharacter(ctx, {
          project_id: projectId,
          name: asset.name,
          role: asset.role,
          gender: asset.gender,
          age: undefined,
          traits: asset.traits,
          description: asset.description,
          tags: ["剧本导入提取"],
        });
      } else if (asset.type === "scene") {
        const sceneType = INDOOR_OUTDOOR_TO_SCENE_TYPE[asset.sceneType ?? ""] ?? "indoor";
        await createScene(ctx, {
          project_id: projectId,
          name: asset.name,
          type: sceneType,
          description: asset.description,
          lighting: asset.lighting,
          time_of_day: asset.timeOfDay,
          weather: asset.weather,
          tags: ["剧本导入提取"],
        });
      } else if (asset.type === "prop") {
        // 修正：AI 的 importance_level 落到 PropCategory，避免把"核心道具"当 category 写库
        const category = IMPORTANCE_TO_PROP_CATEGORY[asset.category ?? ""] ?? "other";
        await createProp(ctx, {
          project_id: projectId,
          name: asset.name,
          category,
          description: asset.description,
          material: asset.material,
          color: asset.color,
          tags: ["剧本导入提取"],
        });
      }
    } catch (err) {
      rootLogger.warn(
        { event: "script.import.assetInsertFailed", assetName: asset.name, err },
        `[importScriptFromJson] 资产 ${asset.name} 入库失败`
      );
    }
  }
}
