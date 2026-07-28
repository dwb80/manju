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
 * - **S2.2**：取消历史图自动裁剪（V1.2 决策）。is_applied 资产图与普通历史图均不限数量；
 *   删除/清空由用户显式操作；DB 单实体历史条数无上限。
 */

import { randomUUID } from "node:crypto";
import type { AppContext } from "./app.js";
import type { CharacterImageHistory } from "../types/character-image-history.js";
import { nowIso } from "../utils.js";

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
 * 追加一条历史（**S4.2 升级**：input 显式接收 shot_type / angle / view_type 三维维度）。
 * - 同一 character + url 已存在则直接返回旧记录（避免重复点「设为角色资产」时塞两条）。
 * - **S2.2**：不再异步裁剪（V1.2 决策：单实体历史条数无上限）。
 */
export interface AppendCharacterImageHistoryInput {
  character_id: string;
  project_id: string;
  url: string;
  ratio: string;
  model: string;
  size: string;
  prompt: string;
  negative_prompt?: string;
  response_format: string;
  n: number;
  /** S4.2：三维筛选维度（nullable，纯 prompt 生图时三个字段都为 null） */
  shot_type?: string | null;
  angle?: string | null;
  view_type?: string | null;
}

export async function appendImageHistory(
  ctx: AppContext,
  input: AppendCharacterImageHistoryInput,
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
    shot_type: input.shot_type ?? null,
    angle: input.angle ?? null,
    view_type: input.view_type ?? null,
    is_applied: false,
    applied_at: "",
    is_primary: 0,
    created_at: nowIso(),
  };
  await ctx.characterImageHistory.insert(record);
  return record;
}

/**
 * S4.2 A→B 复用：在已设为资产的 history 中查匹配 (shot_type, angle, view_type) 的图。
 *
 * - 仅查 `is_applied=1`（已设为资产、用户认可的图），未应用的草图不算
 * - 三个维度全部等值匹配（不传视为通配 null）
 * - 匹配命中即返回最新一条；无命中返回 null
 * - 调用方拿到 url 后直接拷到 consistency_pack_images，跳过 AI 生图
 *
 * 与 scene / prop 同构，详见 scene-image-history.ts 同名函数注释。
 */
export async function findReusableCharacterImage(
  ctx: AppContext,
  characterId: string,
  criteria: { shot_type?: string | null; angle?: string | null; view_type?: string | null },
): Promise<CharacterImageHistory | null> {
  const all = await ctx.characterImageHistory.findMany({ character_id: characterId } as Partial<CharacterImageHistory>);
  const match = all.find((h) => {
    if (!h.is_applied) return false;
    if ((criteria.shot_type ?? null) !== (h.shot_type ?? null)) return false;
    if ((criteria.angle ?? null) !== (h.angle ?? null)) return false;
    if ((criteria.view_type ?? null) !== (h.view_type ?? null)) return false;
    return true;
  });
  return match ?? null;
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

/**
 * 清空某角色的"未应用"历史图片（**S4.0.7 B4 收口**）。
 *
 * 语义：只删除 `is_applied=0` 的记录；`is_applied=1`（已设为角色资产的图）保留不动。
 * 之前实现是"全删"，会导致用户清空历史时把辛苦挑选的资产图也清掉——这是 review 识别的语义瑕疵。
 *
 * 返回删除条数（仅未应用部分）。
 */
export async function clearImageHistory(
  ctx: AppContext,
  characterId: string,
): Promise<number> {
  const all = await ctx.characterImageHistory.findMany({ character_id: characterId } as Partial<CharacterImageHistory>);
  let removed = 0;
  for (const item of all) {
    if (item.is_applied) continue;  // 保留已应用资产图
    await ctx.characterImageHistory.delete(item.id);
    removed += 1;
  }
  return removed;
}
