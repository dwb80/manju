/**
 * @file scene-image-history.ts
 * @description 场景图片生成历史（list/append/apply/unapply/delete/clear/findReusable）
 *
 * S2.2：取消历史图自动裁剪（V1.2 决策）。is_applied 资产图与普通历史图均不限数量；
 * 删除/清空由用户显式操作；DB 单实体历史条数无上限。
 *
 * S4.2：三厂同构——scene / prop / character 的 image_history 都补齐 shot_type / angle / view_type 三个维度。
 * 这些维度用于：
 * 1) 前端"多视图"按景别/角度/视图类型筛选
 * 2) 一致性包生成时按 image_type 复用 history（`findReusableSceneImage`）
 */
import { randomUUID } from "node:crypto";
import { nowIso } from "../utils.js";
import type { AppContext } from "./app.js";
import type { SceneImageHistory } from "../types/character-image-history.js";

export async function listSceneImageHistory(
  ctx: AppContext,
  sceneId: string,
): Promise<SceneImageHistory[]> {
  const all = await ctx.sceneImageHistory.findMany({ scene_id: sceneId });
  return all.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
}

export interface AppendSceneImageHistoryInput {
  scene_id: string;
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

export async function appendSceneImageHistory(
  ctx: AppContext,
  input: AppendSceneImageHistoryInput,
): Promise<SceneImageHistory> {
  const existing = await ctx.sceneImageHistory.findMany({
    scene_id: input.scene_id,
    url: input.url,
  });
  if (existing.length > 0) return existing[0];
  const record: SceneImageHistory = {
    id: `simhist-${randomUUID()}`,
    scene_id: input.scene_id,
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
    created_at: nowIso(),
  };
  await ctx.sceneImageHistory.insert(record);
  return record;
}

/**
 * S4.2 A→B 复用：在已设为资产的 history 中查匹配 (shot_type, angle, view_type) 的图。
 *
 * - 仅查 `is_applied=1`（已设为资产、用户认可的图），未应用的草图不算
 * - 三个维度全部等值匹配（不传视为通配 null）
 * - 匹配命中即返回最新一条；无命中返回 null
 * - 调用方拿到 url 后直接拷到 consistency_pack_images，跳过 AI 生图
 */
export async function findReusableSceneImage(
  ctx: AppContext,
  sceneId: string,
  criteria: { shot_type?: string | null; angle?: string | null; view_type?: string | null },
): Promise<SceneImageHistory | null> {
  const all = await ctx.sceneImageHistory.findMany({ scene_id: sceneId } as Partial<SceneImageHistory>);
  const match = all.find((h) => {
    if (!h.is_applied) return false;
    if ((criteria.shot_type ?? null) !== (h.shot_type ?? null)) return false;
    if ((criteria.angle ?? null) !== (h.angle ?? null)) return false;
    if ((criteria.view_type ?? null) !== (h.view_type ?? null)) return false;
    return true;
  });
  return match ?? null;
}

export async function markSceneImageApplied(
  ctx: AppContext,
  id: string,
): Promise<SceneImageHistory | null> {
  const existing = await ctx.sceneImageHistory.findById(id);
  if (!existing) return null;
  await ctx.sceneImageHistory.update(id, { is_applied: true, applied_at: nowIso() } as any);
  return { ...existing, is_applied: true, applied_at: nowIso() };
}

export async function markSceneImageUnapplied(ctx: AppContext, id: string): Promise<void> {
  await ctx.sceneImageHistory.update(id, { is_applied: false, applied_at: "" } as any);
}

export async function deleteSceneImageHistory(ctx: AppContext, id: string): Promise<boolean> {
  const existing = await ctx.sceneImageHistory.findById(id);
  if (!existing) return false;
  await ctx.sceneImageHistory.delete(id);
  return true;
}

/**
 * 清空某场景的"未应用"历史图片（**S4.0.7 B4 收口**）。
 * 语义：只删 `is_applied=0`；`is_applied=1`（已设为场景资产的图）保留不动。
 * 之前实现是"全删"，会误删资产图。
 */
export async function clearSceneImageHistory(ctx: AppContext, sceneId: string): Promise<number> {
  const all = await ctx.sceneImageHistory.findMany({ scene_id: sceneId });
  let removed = 0;
  for (const item of all) {
    if (item.is_applied) continue;
    await ctx.sceneImageHistory.delete(item.id);
    removed += 1;
  }
  return removed;
}
