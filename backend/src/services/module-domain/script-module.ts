/**
 * @file script-module.ts
 * @description 剧本模块的增删查改服务（已废弃，统一使用 script-center-impl.js）
 */

import type { AppContext } from "../app.js";
import type { Script, ScriptDocument } from "../../types/script.js";
import { id, nowIso } from "../../utils.js";
import { recordAppLog } from "../audit-log.js";

/** 将 ScriptDocument 映射为 Script（保持路由返回兼容） */
function docToScript(doc: ScriptDocument): Script {
  return {
    id: doc.id,
    project_id: doc.project_id,
    title: doc.title,
    description: doc.editor_json,
    status: doc.status as Script["status"],
    words: doc.words,
    chapters: doc.chapters,
    author: doc.author,
    tags: (doc as any).tags ?? [],
    version: doc.version,
    created_at: doc.created_at,
    updated_at: doc.updated_at,
    deleted_at: doc.deleted_at,
  };
}

export type ScriptInput = {
  project_id?: string;
  title?: string;
  description?: string;
  status?: string;
  words?: number;
  chapters?: number;
  author?: string;
  tags?: string[];
  version?: number;
};

/**
 * listScripts - 列出项目中的剧本（排除已删除）
 * @param {AppContext} ctx - 应用上下文
 * @param {string} projectId - 可选的项目 ID 过滤条件
 * @returns {Promise<Script[]>} 剧本列表
 */
export async function listScripts(ctx: AppContext, projectId?: string): Promise<Script[]> {
  const filter = projectId ? { project_id: projectId } : {};
  const all = await ctx.scriptDocuments.findMany(filter, { sort: "desc" });
  return all.filter((doc) => !doc.deleted_at).map(docToScript);
}

/**
 * listDeletedScripts - 列出已删除的剧本
 * @param {AppContext} ctx - 应用上下文
 * @param {string} projectId - 可选的项目 ID 过滤条件
 * @returns {Promise<Script[]>} 已删除剧本列表
 */
export async function listDeletedScripts(ctx: AppContext, projectId?: string): Promise<Script[]> {
  const filter = projectId ? { project_id: projectId } : {};
  const all = await ctx.scriptDocuments.findMany(filter, { sort: "desc" });
  return all.filter((doc) => !!doc.deleted_at).map(docToScript);
}

/**
 * createScript - 创建新剧本（同步写入 script_documents 和 scripts 表）
 * @param {AppContext} ctx - 应用上下文
 * @param {ScriptInput} input - 剧本输入数据
 * @returns {Promise<Script>} 创建的剧本对象
 */
export async function createScript(ctx: AppContext, input: ScriptInput): Promise<Script> {
  const now = nowIso();
  const doc: ScriptDocument = {
    id: id("script"),
    project_id: input.project_id ?? "",
    title: input.title ?? "",
    author: input.author ?? "",
    status: (input.status as ScriptDocument["status"]) ?? "draft",
    genre: "",
    words: input.words ?? 0,
    chapters: input.chapters ?? 0,
    editor_json: input.description ?? "",
    version: input.version ?? 1,
    created_at: now,
    updated_at: now,
  };
  await ctx.scriptDocuments.insert(doc);
  // 同步写入 scripts 表（保持兼容，后续废弃）
  const script: Script = {
    ...docToScript(doc),
    tags: input.tags ?? [],
  };
  try { await ctx.scripts.insert(script); } catch { }
  return script;
}

/**
 * updateScript - 更新指定剧本（同步更新 script_documents 和 scripts 表）
 * @param {AppContext} ctx - 应用上下文
 * @param {string} scriptId - 剧本 ID
 * @param {ScriptInput} input - 更新数据
 * @returns {Promise<Script>} 更新后的剧本对象
 */
export async function updateScript(ctx: AppContext, scriptId: string, input: ScriptInput): Promise<Script> {
  const existing = await ctx.scriptDocuments.findById(scriptId);
  if (!existing) throw new Error("剧本不存在");
  const patch: Partial<ScriptDocument> = {
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.author !== undefined ? { author: input.author } : {}),
    ...(input.status !== undefined ? { status: input.status as ScriptDocument["status"] } : {}),
    ...(input.words !== undefined ? { words: input.words } : {}),
    ...(input.chapters !== undefined ? { chapters: input.chapters } : {}),
    ...(input.description !== undefined ? { editor_json: input.description } : {}),
    ...(input.version !== undefined ? { version: input.version } : {}),
    updated_at: nowIso(),
  };
  await ctx.scriptDocuments.update(scriptId, patch);
  // 同步更新 scripts 表（保持兼容，后续废弃）
  try {
    const scriptPatch: Partial<Script> = {
      ...input,
      status: input.status ? (input.status as Script["status"]) : undefined,
      updated_at: nowIso(),
    };
    await ctx.scripts.update(scriptId, scriptPatch);
  } catch { }
  return docToScript({ ...existing, ...patch } as ScriptDocument);
}

/**
 * deleteScript - 软删除指定剧本（同步更新 script_documents 和 scripts 表）
 * @param {AppContext} ctx - 应用上下文
 * @param {string} scriptId - 剧本 ID
 * @returns {Promise<{ deleted_at: string }>} 包含删除时间的对象
 */
export async function deleteScript(ctx: AppContext, scriptId: string): Promise<{ deleted_at: string }> {
  const existing = await ctx.scriptDocuments.findById(scriptId);
  if (!existing) throw new Error("剧本不存在");
  if (existing.deleted_at) {
    return { deleted_at: existing.deleted_at };
  }
  const deletedAt = nowIso();
  await ctx.scriptDocuments.update(scriptId, {
    deleted_at: deletedAt,
    updated_at: deletedAt,
  } as Partial<ScriptDocument>);
  // 同步软删除 scripts 表（保持兼容，后续废弃）
  try {
    const script = await ctx.scripts.findById(scriptId);
    if (script && !script.deleted_at) {
      await ctx.scripts.update(scriptId, {
        deleted_at: deletedAt,
        updated_at: deletedAt,
      } as Partial<Script>);
    }
  } catch { }
  void recordAppLog(ctx, {
    entityType: "script",
    entityId: scriptId,
    action: "script.soft_deleted",
    event: "script.soft_deleted",
    payload: { title: existing.title, project_id: existing.project_id },
    projectId: existing.project_id,
  });
  return { deleted_at: deletedAt };
}

/**
 * restoreScript - 恢复已软删除的剧本
 * @param {AppContext} ctx - 应用上下文
 * @param {string} scriptId - 剧本 ID
 * @returns {Promise<void>}
 */
export async function restoreScript(ctx: AppContext, scriptId: string): Promise<void> {
  const existing = await ctx.scriptDocuments.findById(scriptId);
  if (!existing) throw new Error("剧本不存在或已被彻底删除");
  if (!existing.deleted_at) throw new Error("剧本未处于软删状态");
  const restoredAt = nowIso();
  await ctx.scriptDocuments.update(scriptId, {
    deleted_at: "",
    updated_at: restoredAt,
  } as Partial<ScriptDocument>);
  // 同步恢复 scripts 表（保持兼容，后续废弃）
  try {
    const script = await ctx.scripts.findById(scriptId);
    if (script && script.deleted_at) {
      await ctx.scripts.update(scriptId, { deleted_at: "", updated_at: restoredAt } as Partial<Script>);
    }
  } catch { }
  void recordAppLog(ctx, {
    entityType: "script",
    entityId: scriptId,
    action: "script.restored",
    event: "script.restored",
    payload: { title: existing.title, project_id: existing.project_id },
    projectId: existing.project_id,
  });
}

const SCRIPT_PURGE_GRACE_DAYS = (() => {
  const raw = process.env.SCRIPT_PURGE_GRACE_DAYS;
  const n = raw ? Number(raw) : 30;
  return Number.isFinite(n) && n > 0 ? n : 30;
})();

/**
 * purgeScript - 彻底删除剧本及其关联数据（需要满足保留期要求）
 * @param {AppContext} ctx - 应用上下文
 * @param {string} scriptId - 剧本 ID
 * @returns {Promise<object>} 包含删除信息、保留天数和级联删除统计的对象
 */
export async function purgeScript(ctx: AppContext, scriptId: string): Promise<{
  script_id: string;
  deleted_at: string;
  purged_at: string;
  grace_days: number;
  cascade: Record<string, number>;
}> {
  const existing = await ctx.scriptDocuments.findById(scriptId);
  if (!existing) throw new Error("剧本不存在");
  if (!existing.deleted_at) {
    throw new Error("剧本未处于软删状态,无法彻底删除");
  }
  const deletedAtMs = Date.parse(existing.deleted_at);
  if (!Number.isFinite(deletedAtMs)) {
    throw new Error("软删时间戳格式异常,无法校验保留期");
  }
  const ageDays = (Date.now() - deletedAtMs) / 86_400_000;
  if (ageDays < SCRIPT_PURGE_GRACE_DAYS) {
    const remain = Math.ceil(SCRIPT_PURGE_GRACE_DAYS - ageDays);
    throw new Error(`剧本软删不足 ${SCRIPT_PURGE_GRACE_DAYS} 天,还需等待 ${remain} 天`);
  }

  const comments = await ctx.scriptComments.findMany({ script_id: scriptId } as any);
  const approvals = await ctx.scriptApprovals.findMany({ script_id: scriptId } as any);
  const assessments = await ctx.scriptQualityAssessments.findMany({ script_id: scriptId } as any);
  const backups = await ctx.scriptBackups.findMany({ document_id: scriptId } as any);
  const episodes = await ctx.scriptEpisodes.findMany({ document_id: scriptId } as any);
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

  for (const r of dialogues) await ctx.scriptDialogues.delete(r.id);
  for (const r of sceneCharacters) await ctx.scriptSceneCharacters.delete(r.id);
  for (const r of sceneLocations) await ctx.scriptSceneLocations.delete(r.id);
  for (const s of scenes) await ctx.scriptScenes.delete(s.id);
  for (const e of episodes) await ctx.scriptEpisodes.delete(e.id);
  for (const r of backups) await ctx.scriptBackups.delete(r.id);
  for (const r of comments) await ctx.scriptComments.delete(r.id);
  for (const r of approvals) await ctx.scriptApprovals.delete(r.id);
  for (const r of assessments) await ctx.scriptQualityAssessments.delete(r.id);
  try {
    await ctx.scriptDocuments.delete(scriptId);
  } catch { }
  try { await ctx.scripts.delete(scriptId); } catch { }

  const cascade = {
    script_comments: comments.length,
    script_approvals: approvals.length,
    script_quality_assessments: assessments.length,
    script_backups: backups.length,
    script_episodes: episodes.length,
    script_scenes: scenes.length,
    script_dialogues: dialogues.length,
    script_scene_characters: sceneCharacters.length,
    script_scene_locations: sceneLocations.length,
  };
  const purgedAt = nowIso();
  void recordAppLog(ctx, {
    entityType: "script",
    entityId: scriptId,
    action: "script.purged",
    event: "script.purged",
    payload: {
      title: existing.title,
      project_id: existing.project_id,
      deleted_at: existing.deleted_at,
      purged_at: purgedAt,
      grace_days: SCRIPT_PURGE_GRACE_DAYS,
      cascade,
    },
    projectId: existing.project_id,
  });
  return {
    script_id: scriptId,
    deleted_at: existing.deleted_at,
    purged_at: purgedAt,
    grace_days: SCRIPT_PURGE_GRACE_DAYS,
    cascade,
  };
}
