/**
 * 剧集 CRUD 服务
 */

import type { AppContext } from "../app.js";
import type { ScriptEpisode } from "../../types.js";
import { id, nowIso } from "../../utils.js";
import type { ScriptEpisodeInput } from "./types.js";

/**
 * 列出剧集
 * - projectId 提供时按 project 过滤
 * - documentId 提供时按 document 严格过滤（优先于 projectId），避免拉到同一项目下其他剧本的剧集
 * - 两个都不提供时回退到按 project 过滤（保持历史行为）
 * - 孤儿剧集（document_id 为空字符串）只在不提供 documentId 时保留
 */
export async function listScriptEpisodes(
  ctx: AppContext,
  projectId: string,
  documentId?: string,
): Promise<ScriptEpisode[]> {
  if (documentId) {
    // 严格按 documentId 过滤，不返回其他剧本或孤儿剧集
    const all = await ctx.scriptEpisodes.findMany({ document_id: documentId }, { sort: "asc" });
    return all;
  }
  // 按 project 过滤；同时清洗掉孤儿剧集（document_id 为空）
  // 这些孤儿剧集是历史脏数据，不应该出现在任何剧本编辑页
  const all = await ctx.scriptEpisodes.findMany({ project_id: projectId }, { sort: "asc" });
  return all.filter((ep) => typeof ep.document_id === "string" && ep.document_id !== "");
}

/**
 * getScriptEpisode - 根据ID获取剧集
 * @param {AppContext} ctx - 应用上下文
 * @param {string} episodeId - 剧集ID
 * @returns {Promise<ScriptEpisode | null>} 返回剧集记录，不存在则返回null
 */
export async function getScriptEpisode(ctx: AppContext, episodeId: string): Promise<ScriptEpisode | null> {
  return ctx.scriptEpisodes.findById(episodeId);
}

/**
 * createScriptEpisode - 创建剧集
 * @param {AppContext} ctx - 应用上下文
 * @param {ScriptEpisodeInput} input - 剧集输入数据
 * @returns {Promise<ScriptEpisode>} 返回创建的剧集记录
 */
export async function createScriptEpisode(ctx: AppContext, input: ScriptEpisodeInput): Promise<ScriptEpisode> {
  const episode: ScriptEpisode = {
    id: id("se"),
    project_id: input.project_id ?? "",
    document_id: input.document_id ?? "",
    episode_no: input.episode_no ?? 1,
    title: input.title ?? "",
    synopsis: input.synopsis ?? "",
    status: (input.status as ScriptEpisode["status"]) ?? "draft",
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  await ctx.scriptEpisodes.insert(episode);
  return episode;
}

/**
 * updateScriptEpisode - 更新剧集
 * @param {AppContext} ctx - 应用上下文
 * @param {string} episodeId - 剧集ID
 * @param {ScriptEpisodeInput} input - 更新数据
 * @returns {Promise<ScriptEpisode>} 返回更新后的剧集记录
 */
export async function updateScriptEpisode(
  ctx: AppContext,
  episodeId: string,
  input: ScriptEpisodeInput
): Promise<ScriptEpisode> {
  const existing = await ctx.scriptEpisodes.findById(episodeId);
  if (!existing) throw new Error("剧集不存在");

  const patch: Partial<ScriptEpisode> = {
    ...input,
    status: input.status ? (input.status as ScriptEpisode["status"]) : undefined,
    updated_at: nowIso(),
  };

  await ctx.scriptEpisodes.update(episodeId, patch);
  return { ...existing, ...patch } as ScriptEpisode;
}

/**
 * deleteScriptEpisode - 删除剧集
 * @param {AppContext} ctx - 应用上下文
 * @param {string} episodeId - 剧集ID
 * @returns {Promise<void>}
 */
export async function deleteScriptEpisode(ctx: AppContext, episodeId: string): Promise<void> {
  await ctx.scriptEpisodes.delete(episodeId);
}
