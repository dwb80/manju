/**
 * 剧本文档 CRUD 服务
 *
 * 方案 A 改造：ScriptDocument 现在承载完整剧本元数据（title/author/status/genre/words/chapters），
 * 不再依赖 Path A 的 `scripts` 表。所有 Path A 调用方统一改走 document-service。
 */

import type { AppContext } from "../app.js";
import type { ScriptDocument } from "../../types.js";
import { id, nowIso } from "../../utils.js";
import type { ScriptDocumentInput } from "./types.js";
import { deleteScriptAnalyzedAssetsByDocument } from "./analyzed-asset-service.js";

/** 允许的剧本状态值（与前端 ScriptFormDialog 状态选项对齐）。 */
const ALLOWED_STATUS = new Set([
  "draft",
  "active",
  "review",
  "completed",
  "archived",
]);

/** 规范化状态字段：非法值降级为 draft。 */
function normalizeStatus(value: string | undefined, fallback: string): string {
  if (typeof value !== "string") return fallback;
  return ALLOWED_STATUS.has(value) ? value : fallback;
}

/** 从 editor_json（Tiptap JSON 字符串）提取纯文本字数。 */
function countWords(editorJson: string | undefined): number {
  if (!editorJson) return 0;
  try {
    const parsed = JSON.parse(editorJson) as { content?: Array<{ content?: Array<{ text?: string }> }> };
    let count = 0;
    const walk = (node: { text?: string; content?: unknown[] } | undefined) => {
      if (!node) return;
      if (typeof node.text === "string") {
        // 中文按字符数；英文按词数（按空格切分）。
        // 简化策略：每 1 个中文字符算 1 字，英文每词算 1 字。
        const text = node.text;
        const chinese = (text.match(/[一-龥]/g) || []).length;
        const englishWords = text
          .replace(/[一-龥]/g, " ")
          .split(/\s+/)
          .filter((w) => /[A-Za-z0-9]/.test(w)).length;
        count += chinese + englishWords;
      }
      if (Array.isArray(node.content)) {
        for (const child of node.content) walk(child as { text?: string; content?: unknown[] });
      }
    };
    if (Array.isArray(parsed?.content)) {
      for (const top of parsed.content) walk(top as { text?: string; content?: unknown[] });
    }
    return count;
  } catch {
    return 0;
  }
}

/**
 * listScriptDocuments - 列出剧本文档
 * @param {AppContext} ctx - 应用上下文
 * @param {string} [projectId] - 项目ID，不传则列出所有
 * @returns {Promise<ScriptDocument[]>} 返回未删除的文档列表
 */
export async function listScriptDocuments(ctx: AppContext, projectId?: string): Promise<ScriptDocument[]> {
  const filter = projectId ? { project_id: projectId } : {};
  const all = await ctx.scriptDocuments.findMany(filter, { sort: "desc" });
  return all.filter((doc) => !doc.deleted_at);
}

export async function getScriptDocument(ctx: AppContext, documentId: string): Promise<ScriptDocument | null> {
  return ctx.scriptDocuments.findById(documentId);
}

/**
 * createScriptDocument - 创建剧本文档
 * @param {AppContext} ctx - 应用上下文
 * @param {ScriptDocumentInput} input - 文档输入数据
 * @returns {Promise<ScriptDocument>} 返回创建的文档记录
 */
export async function createScriptDocument(ctx: AppContext, input: ScriptDocumentInput): Promise<ScriptDocument> {
  const now = nowIso();
  const document: ScriptDocument = {
    id: input.id ?? id("sd"),
    project_id: input.project_id ?? "",
    // ===== 方案 A：元数据并入 =====
    title: input.title?.trim() || "未命名剧本",
    author: input.author?.trim() || "当前用户",
    status: normalizeStatus(input.status, "draft"),
    genre: input.genre?.trim() || "",
    words: typeof input.words === "number" ? input.words : countWords(input.editor_json),
    chapters: typeof input.chapters === "number" ? input.chapters : 0,
    // ===== 内容 =====
    editor_json: input.editor_json ?? "",
    // ===== 剧本导入：完整 AI 原始数据（仅导入流程写入，不写任何工厂） =====
    ai_raw_data: input.ai_raw_data ?? "",
    version: input.version ?? 1,
    created_at: now,
    updated_at: now,
  };
  await ctx.scriptDocuments.insert(document);
  return document;
}

/**
 * updateScriptDocument - 更新剧本文档
 * @param {AppContext} ctx - 应用上下文
 * @param {string} documentId - 文档ID
 * @param {ScriptDocumentInput} input - 更新数据
 * @returns {Promise<ScriptDocument>} 返回更新后的文档记录
 */
export async function updateScriptDocument(
  ctx: AppContext,
  documentId: string,
  input: ScriptDocumentInput
): Promise<ScriptDocument> {
  const existing = await ctx.scriptDocuments.findById(documentId);
  if (!existing) throw new Error("剧本文档不存在");

  const patch: Partial<ScriptDocument> = {
    ...input,
    // 状态：仅接受合法值
    ...(input.status !== undefined
      ? { status: normalizeStatus(input.status, existing.status) }
      : {}),
    // 字数：若未显式提供，从 editor_json 自动计算
    ...(input.words === undefined && input.editor_json !== undefined
      ? { words: countWords(input.editor_json) }
      : {}),
    version: existing.version + 1, // 每次更新自动增加版本号
    updated_at: nowIso(),
  };

  await ctx.scriptDocuments.update(documentId, patch);
  return { ...existing, ...patch } as ScriptDocument;
}

/**
 * deleteScriptDocument - 软删除剧本文档
 * @param {AppContext} ctx - 应用上下文
 * @param {string} documentId - 文档ID
 * @returns {Promise<void>}
 */
export async function deleteScriptDocument(ctx: AppContext, documentId: string): Promise<void> {
  const existing = await ctx.scriptDocuments.findById(documentId);
  if (!existing) return;
  await ctx.scriptDocuments.update(documentId, { deleted_at: nowIso() } as Partial<ScriptDocument>);
}

/** 列出已软删除的剧本文档（回收站） */
/**
 * listDeletedScriptDocuments - 列出已软删除的剧本文档（回收站）
 * @param {AppContext} ctx - 应用上下文
 * @param {string} [projectId] - 项目ID，不传则列出所有
 * @returns {Promise<ScriptDocument[]>} 返回已删除的文档列表
 */
export async function listDeletedScriptDocuments(ctx: AppContext, projectId?: string): Promise<ScriptDocument[]> {
  const filter = projectId ? { project_id: projectId } : {};
  const all = await ctx.scriptDocuments.findMany(filter, { sort: "desc" });
  return all.filter((doc) => !!doc.deleted_at);
}

/** 恢复已软删除的剧本文档 */
/**
 * restoreScriptDocument - 恢复已软删除的剧本文档
 * @param {AppContext} ctx - 应用上下文
 * @param {string} documentId - 文档ID
 * @returns {Promise<ScriptDocument>} 返回恢复后的文档记录
 */
export async function restoreScriptDocument(ctx: AppContext, documentId: string): Promise<ScriptDocument> {
  const existing = await ctx.scriptDocuments.findById(documentId);
  if (!existing) throw new Error("剧本文档不存在");
  if (!existing.deleted_at) throw new Error("剧本文档未处于软删状态");
  const patch = { deleted_at: "", updated_at: nowIso() } as Partial<ScriptDocument>;
  await ctx.scriptDocuments.update(documentId, patch);
  return { ...existing, ...patch } as ScriptDocument;
}

/** 彻底删除剧本文档及其关联数据 */
/**
 * purgeScriptDocument - 彻底删除剧本文档及其关联数据
 * @param {AppContext} ctx - 应用上下文
 * @param {string} documentId - 文档ID
 * @returns {Promise<object>} 返回删除结果，包含级联删除的记录数
 */
export async function purgeScriptDocument(ctx: AppContext, documentId: string): Promise<{
  document_id: string;
  deleted_at: string;
  purged_at: string;
  cascade: Record<string, number>;
}> {
  const existing = await ctx.scriptDocuments.findById(documentId);
  if (!existing) throw new Error("剧本文档不存在");
  if (!existing.deleted_at) {
    throw new Error("剧本文档未处于软删状态，无法彻底删除");
  }

  const episodes = await ctx.scriptEpisodes.findMany({ document_id: documentId } as any);
  const scenes = await ctx.scriptScenes.findMany({
    episode_id: episodes.map((e) => e.id),
  } as any);
  const sceneIds = scenes.map((s) => s.id);
  const dialogues = sceneIds.length
    ? await ctx.scriptDialogues.findMany({ scene_id: sceneIds } as any)
    : [];
  const sceneCharacters = sceneIds.length
    ? await ctx.scriptSceneCharacters.findMany({ scene_id: sceneIds } as any)
    : [];
  const sceneLocations = sceneIds.length
    ? await ctx.scriptSceneLocations.findMany({ scene_id: sceneIds } as any)
    : [];
  const backups = await ctx.scriptBackups.findMany({ document_id: documentId } as any);
  const analyzedAssets = await deleteScriptAnalyzedAssetsByDocument(ctx, documentId);

  for (const r of dialogues) await ctx.scriptDialogues.delete(r.id);
  for (const r of sceneCharacters) await ctx.scriptSceneCharacters.delete(r.id);
  for (const r of sceneLocations) await ctx.scriptSceneLocations.delete(r.id);
  for (const s of scenes) await ctx.scriptScenes.delete(s.id);
  for (const e of episodes) await ctx.scriptEpisodes.delete(e.id);
  for (const r of backups) await ctx.scriptBackups.delete(r.id);
  await ctx.scriptDocuments.delete(documentId);

  const cascade = {
    script_episodes: episodes.length,
    script_scenes: scenes.length,
    script_dialogues: dialogues.length,
    script_scene_characters: sceneCharacters.length,
    script_scene_locations: sceneLocations.length,
    script_backups: backups.length,
    script_analyzed_characters: analyzedAssets.characters,
    script_analyzed_scenes: analyzedAssets.scenes,
    script_analyzed_props: analyzedAssets.props,
  };
  const purgedAt = nowIso();
  return {
    document_id: documentId,
    deleted_at: existing.deleted_at,
    purged_at: purgedAt,
    cascade,
  };
}
