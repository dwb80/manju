/**
 * 剧本备份/版本服务
 *
 * - createBackup: 创建完整备份（含剧集/场景/对白快照）
 * - listBackups: 列出项目全部备份
 * - listScriptVersions: 列出某文档关联的版本
 * - createScriptVersion: 创建一个轻量版本快照（薄封装，与 Backup 同表）
 * - deleteScriptVersion: 删除指定版本
 * - restoreBackup: 恢复备份
 */

import type { AppContext } from "../app.js";
import type { ScriptBackup } from "../../types.js";
import { id, nowIso } from "../../utils.js";
import { rootLogger } from "../../logger.js";

export async function createBackup(
  ctx: AppContext,
  projectId: string,
  documentId: string,
  type: "auto" | "manual" | "scheduled",
  createdBy: string
): Promise<ScriptBackup> {
  // 获取剧本文档和相关数据
  const document = await ctx.scriptDocuments.findById(documentId);
  if (!document) throw new Error("剧本文档不存在");

  const episodes = await ctx.scriptEpisodes.findMany({ project_id: projectId, document_id: documentId });
  const scenes = await ctx.scriptScenes.findMany({ project_id: projectId });
  const dialogues = await ctx.scriptDialogues.findMany({ project_id: projectId });

  const backup: ScriptBackup = {
    id: id("sbkp"),
    project_id: projectId,
    type,
    size: JSON.stringify({ document, episodes, scenes, dialogues }).length,
    content: {
      script_document: document.editor_json,
      script_episodes: episodes,
      script_scenes: scenes,
      script_dialogues: dialogues,
      version: document.version,
    },
    status: "completed",
    created_by: createdBy,
    created_at: nowIso(),
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30天后过期
  };

  await ctx.scriptBackups.insert(backup);
  return backup;
}

/**
 * listBackups - 列出项目全部备份
 * @param {AppContext} ctx - 应用上下文
 * @param {string} projectId - 项目ID
 * @returns {Promise<ScriptBackup[]>} 返回备份列表
 */
export async function listBackups(ctx: AppContext, projectId: string): Promise<ScriptBackup[]> {
  return ctx.scriptBackups.findMany({ project_id: projectId }, { sort: "desc" });
}

// 剧本版本（薄封装，与 Backup 同表；前端走 /api/script-versions 直接操作）
/**
 * listScriptVersions - 列出某文档关联的版本
 * @param {AppContext} ctx - 应用上下文
 * @param {string} documentId - 文档ID
 * @returns {Promise<ScriptBackup[]>} 返回版本列表
 */
export async function listScriptVersions(
  ctx: AppContext,
  documentId: string
): Promise<ScriptBackup[]> {
  return ctx.scriptBackups.findMany({ document_id: documentId }, { sort: "desc" });
}

/**
 * createScriptVersion - 创建一个轻量版本快照
 * @param {AppContext} ctx - 应用上下文
 * @param {object} input - 版本输入数据
 * @param {string} input.documentId - 文档ID
 * @param {string} input.editorJson - 编辑器JSON内容
 * @param {number} input.version - 版本号
 * @param {string} [input.changes] - 变更说明
 * @param {"auto" | "manual" | "scheduled"} [input.type] - 版本类型
 * @param {string} [input.createdBy] - 创建者ID
 * @returns {Promise<ScriptBackup>} 返回创建的版本记录
 */
export async function createScriptVersion(
  ctx: AppContext,
  input: {
    documentId: string;
    editorJson: string;
    version: number;
    changes?: string;
    type?: "auto" | "manual" | "scheduled";
    createdBy?: string;
  }
): Promise<ScriptBackup> {
  const document = await ctx.scriptDocuments.findById(input.documentId);
  if (!document) throw new Error("剧本文档不存在");
  const backup: ScriptBackup = {
    id: id("sbkp"),
    project_id: document.project_id,
    type: input.type ?? "manual",
    size: (input.editorJson || "").length,
    content: {
      script_document: input.editorJson,
      version: input.version,
      changes: input.changes,
    },
    status: "completed",
    created_by: input.createdBy ?? "system",
    created_at: nowIso(),
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  };
  await ctx.scriptBackups.insert(backup);
  return backup;
}

export async function deleteScriptVersion(ctx: AppContext, versionId: string): Promise<void> {
  await ctx.scriptBackups.delete(versionId);
}

/**
 * restoreBackup - 恢复备份
 * @param {AppContext} ctx - 应用上下文
 * @param {string} backupId - 备份ID
 * @returns {Promise<void>}
 */
export async function restoreBackup(ctx: AppContext, backupId: string): Promise<void> {
  const backup = await ctx.scriptBackups.findById(backupId);
  if (!backup || backup.status !== "completed") throw new Error("备份不存在或不可用");

  // 恢复操作需要根据实际业务逻辑实现
  // 这里简化为直接返回备份内容
  rootLogger.info({ event: "script.backup.restore", backupId: backup.id }, `恢复备份: ${backup.id}`);
}
