/**
 * 角色图片生成历史服务
 *
 * 提供 character_image_history 表的 CRUD + 状态变更：
 * - listImageHistory：列出某角色所有记录（前端按 is_applied 过滤出"历史图片"和"已选资产历史"）
 * - appendImageHistory：AI 生成图片后写入新记录
 * - markImageApplied / markImageUnapplied：「设为角色资产 / 取消应用」时打标
 * - deleteImageHistory：删除单条
 * - clearImageHistory：清空某角色所有记录
 *
 * 设计：
 * - 同一 character 下同一 url 唯一：append 时先查重，已存在则返回旧记录（避免重复）。
 * - 上限裁剪：append 后仅裁剪未应用的普通历史图；is_applied=true 的资产历史必须保留，
 *   只能由用户手工删除。
 */

import { randomUUID } from "node:crypto";
import type { AppContext } from "./app.js";
import type { CharacterImageHistory } from "../types/character-image-history.js";
import { nowIso } from "../utils.js";

/** 单角色普通历史最大保留条数；已应用资产历史不参与自动裁剪。 */
const MAX_HISTORY_PER_CHARACTER = 40;

/** 列出某角色所有图片生成历史（按 created_at 倒序）。 */
export async function listImageHistory(
  ctx: AppContext,
  characterId: string,
): Promise<CharacterImageHistory[]> {
  const all = await ctx.characterImageHistory.findMany({ character_id: characterId } as Partial<CharacterImageHistory>);
  // Repository.findMany 没有 sort 参数支持（按 created_at 索引读取），这里手动排序
  return all.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
}

/**
 * 追加一条历史。
 * - 同一 character + url 已存在则直接返回旧记录（避免重复点「设为角色资产」时塞两条）。
 * - 写完后异步裁剪到上限（不阻塞返回）。
 */
export async function appendImageHistory(
  ctx: AppContext,
  input: Omit<CharacterImageHistory, "id" | "is_applied" | "applied_at" | "created_at">,
): Promise<CharacterImageHistory> {
  // 查重：同一 character + url 视为同一条历史
  const existing = await ctx.characterImageHistory.findMany({
    character_id: input.character_id,
    url: input.url,
  } as Partial<CharacterImageHistory>);
  if (existing.length > 0) {
    return existing[0];
  }
  const record: CharacterImageHistory = {
    id: `imhist-${randomUUID()}`,
    character_id: input.character_id,
    project_id: input.project_id,
    url: input.url,
    ratio: input.ratio,
    model: input.model,
    size: input.size,
    prompt: input.prompt,
    negative_prompt: input.negative_prompt ?? "",
    response_format: input.response_format,
    n: input.n,
    is_applied: false,
    applied_at: "",
    created_at: nowIso(),
  };
  await ctx.characterImageHistory.insert(record);
  // 异步裁剪（不阻塞调用方）
  void trimHistory(ctx, input.character_id);
  return record;
}

/** 把某条记录标记为「已设为角色资产」。 */
export async function markImageApplied(
  ctx: AppContext,
  id: string,
): Promise<CharacterImageHistory | null> {
  const existing = await ctx.characterImageHistory.findById(id);
  if (!existing) return null;
  await ctx.characterImageHistory.update(id, {
    is_applied: true,
    applied_at: nowIso(),
  } as Partial<CharacterImageHistory>);
  return { ...existing, is_applied: true, applied_at: nowIso() };
}

/** 把某条记录取消「已应用」标记（用于从历史中"恢复"后又被覆盖的场景，目前前端不用，预留）。 */
export async function markImageUnapplied(
  ctx: AppContext,
  id: string,
): Promise<void> {
  await ctx.characterImageHistory.update(id, {
    is_applied: false,
    applied_at: "",
  } as Partial<CharacterImageHistory>);
}

/** 删除单条历史。 */
export async function deleteImageHistory(
  ctx: AppContext,
  id: string,
): Promise<boolean> {
  const existing = await ctx.characterImageHistory.findById(id);
  if (!existing) return false;
  await ctx.characterImageHistory.delete(id);
  return true;
}

/** 清空某角色的所有图片生成历史。返回删除条数。 */
export async function clearImageHistory(
  ctx: AppContext,
  characterId: string,
): Promise<number> {
  const all = await ctx.characterImageHistory.findMany({ character_id: characterId } as Partial<CharacterImageHistory>);
  for (const item of all) {
    await ctx.characterImageHistory.delete(item.id);
  }
  return all.length;
}

/** 内部：按 created_at 倒序裁剪到上限，删除最老的。 */
async function trimHistory(ctx: AppContext, characterId: string): Promise<void> {
  const all = await ctx.characterImageHistory.findMany({ character_id: characterId } as Partial<CharacterImageHistory>);
  const ordinary = all.filter((item) => !item.is_applied);
  if (ordinary.length <= MAX_HISTORY_PER_CHARACTER) return;
  const sorted = [...ordinary].sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  const toDelete = sorted.slice(MAX_HISTORY_PER_CHARACTER);
  for (const item of toDelete) {
    await ctx.characterImageHistory.delete(item.id);
  }
}
