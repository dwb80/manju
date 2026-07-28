/**
 * @file prop-image-history.ts
 * @description 道具图片生成历史（list/append/apply/unapply/delete/clear/findReusable）
 *
 * S2.2：取消历史图自动裁剪（V1.2 决策）。is_applied 资产图与普通历史图均不限数量；
 * 删除/清空由用户显式操作；DB 单实体历史条数无上限。
 *
 * S4.2：三厂同构——prop / scene / character 的 image_history 都补齐 shot_type / angle / view_type 三个维度。
 * 这些维度用于：
 * 1) 前端"多视图"按景别/角度/视图类型筛选
 * 2) 一致性包生成时按 image_type 复用 history（`findReusablePropImage`）
 */
import { randomUUID } from "node:crypto";
import { nowIso } from "../utils.js";
import type { AppContext } from "./app.js";
import type { PropImageHistory } from "../types/character-image-history.js";

export async function listPropImageHistory(
  ctx: AppContext,
  propId: string,
): Promise<PropImageHistory[]> {
  const all = await ctx.propImageHistory.findMany({ prop_id: propId });
  return all.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
}

export interface AppendPropImageHistoryInput {
  prop_id: string;
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

export async function appendPropImageHistory(
  ctx: AppContext,
  input: AppendPropImageHistoryInput,
): Promise<PropImageHistory> {
  const existing = await ctx.propImageHistory.findMany({
    prop_id: input.prop_id,
    url: input.url,
  });
  if (existing.length > 0) return existing[0];
  const record: PropImageHistory = {
    id: `pimhist-${randomUUID()}`,
    prop_id: input.prop_id,
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
  await ctx.propImageHistory.insert(record);
  return record;
}

/**
 * S4.2 A→B 复用：在已设为资产的 history 中查匹配 (shot_type, angle, view_type) 的图。
 * 语义与 scene 同构；详见 scene-image-history.ts 同名函数注释。
 */
export async function findReusablePropImage(
  ctx: AppContext,
  propId: string,
  criteria: { shot_type?: string | null; angle?: string | null; view_type?: string | null },
): Promise<PropImageHistory | null> {
  const all = await ctx.propImageHistory.findMany({ prop_id: propId } as Partial<PropImageHistory>);
  const match = all.find((h) => {
    if (!h.is_applied) return false;
    if ((criteria.shot_type ?? null) !== (h.shot_type ?? null)) return false;
    if ((criteria.angle ?? null) !== (h.angle ?? null)) return false;
    if ((criteria.view_type ?? null) !== (h.view_type ?? null)) return false;
    return true;
  });
  return match ?? null;
}

export async function markPropImageApplied(
  ctx: AppContext,
  id: string,
): Promise<PropImageHistory | null> {
  const existing = await ctx.propImageHistory.findById(id);
  if (!existing) return null;
  await ctx.propImageHistory.update(id, { is_applied: true, applied_at: nowIso() } as any);
  return { ...existing, is_applied: true, applied_at: nowIso() };
}

export async function markPropImageUnapplied(ctx: AppContext, id: string): Promise<void> {
  await ctx.propImageHistory.update(id, { is_applied: false, applied_at: "" } as any);
}

export async function deletePropImageHistory(ctx: AppContext, id: string): Promise<boolean> {
  const existing = await ctx.propImageHistory.findById(id);
  if (!existing) return false;
  await ctx.propImageHistory.delete(id);
  return true;
}

/**
 * 清空某道具的"未应用"历史图片（**S4.0.7 B4 收口**）。
 * 语义：只删 `is_applied=0`；`is_applied=1`（已设为道具资产的图）保留不动。
 */
export async function clearPropImageHistory(ctx: AppContext, propId: string): Promise<number> {
  const all = await ctx.propImageHistory.findMany({ prop_id: propId });
  let removed = 0;
  for (const item of all) {
    if (item.is_applied) continue;
    await ctx.propImageHistory.delete(item.id);
    removed += 1;
  }
  return removed;
}
