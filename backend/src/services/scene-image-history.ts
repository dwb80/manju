/**
 * @file scene-image-history.ts
 * @description 场景图片生成历史（list/append/apply/unapply/delete/clear + 自动 trim）
 */
import { randomUUID } from "node:crypto";
import { nowIso } from "../utils.js";
import type { AppContext } from "./app.js";
import type { SceneImageHistory } from "../types/character-image-history.js";

const MAX_HISTORY_PER_SCENE = 100;

export async function listSceneImageHistory(
  ctx: AppContext,
  sceneId: string,
): Promise<SceneImageHistory[]> {
  const all = await ctx.sceneImageHistory.findMany({ scene_id: sceneId });
  return all.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
}

export async function appendSceneImageHistory(
  ctx: AppContext,
  input: {
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
  },
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
    is_applied: false,
    applied_at: "",
    created_at: nowIso(),
  };
  await ctx.sceneImageHistory.insert(record);
  void trimSceneHistory(ctx, input.scene_id);
  return record;
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

export async function clearSceneImageHistory(ctx: AppContext, sceneId: string): Promise<number> {
  const all = await ctx.sceneImageHistory.findMany({ scene_id: sceneId });
  for (const item of all) {
    await ctx.sceneImageHistory.delete(item.id);
  }
  return all.length;
}

async function trimSceneHistory(ctx: AppContext, sceneId: string): Promise<void> {
  const all = await ctx.sceneImageHistory.findMany({ scene_id: sceneId });
  const ordinary = all.filter((item) => !item.is_applied);
  if (ordinary.length <= MAX_HISTORY_PER_SCENE) return;
  const sorted = [...ordinary].sort((a, b) =>
    (b.created_at || "").localeCompare(a.created_at || ""),
  );
  const toDelete = sorted.slice(MAX_HISTORY_PER_SCENE);
  for (const item of toDelete) {
    await ctx.sceneImageHistory.delete(item.id);
  }
}
