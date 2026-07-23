/**
 * @file prop-image-history.ts
 * @description 道具图片生成历史（list/append/apply/unapply/delete/clear + 自动 trim）
 */
import { randomUUID } from "node:crypto";
import { nowIso } from "../utils.js";
import type { AppContext } from "./app.js";
import type { PropImageHistory } from "../types/character-image-history.js";

const MAX_HISTORY_PER_PROP = 100;

export async function listPropImageHistory(
  ctx: AppContext,
  propId: string,
): Promise<PropImageHistory[]> {
  const all = await ctx.propImageHistory.findMany({ prop_id: propId });
  return all.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
}

export async function appendPropImageHistory(
  ctx: AppContext,
  input: {
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
  },
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
    is_applied: false,
    applied_at: "",
    created_at: nowIso(),
  };
  await ctx.propImageHistory.insert(record);
  void trimPropHistory(ctx, input.prop_id);
  return record;
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

export async function clearPropImageHistory(ctx: AppContext, propId: string): Promise<number> {
  const all = await ctx.propImageHistory.findMany({ prop_id: propId });
  for (const item of all) {
    await ctx.propImageHistory.delete(item.id);
  }
  return all.length;
}

async function trimPropHistory(ctx: AppContext, propId: string): Promise<void> {
  const all = await ctx.propImageHistory.findMany({ prop_id: propId });
  const ordinary = all.filter((item) => !item.is_applied);
  if (ordinary.length <= MAX_HISTORY_PER_PROP) return;
  const sorted = [...ordinary].sort((a, b) =>
    (b.created_at || "").localeCompare(a.created_at || ""),
  );
  const toDelete = sorted.slice(MAX_HISTORY_PER_PROP);
  for (const item of toDelete) {
    await ctx.propImageHistory.delete(item.id);
  }
}
