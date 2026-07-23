/**
 * @file review-snapshot-service.ts
 * @description V2 W12 P0 REQ-REVIEW-F01：审核快照服务。
 *
 * 设计要点：
 *  - 每次 review 进入新状态时调用 recordSnapshot() 写入一条 immutable 记录
 *  - snapshot_data 是 review 主表当时的完整 JSON
 *  - 用于"打回前 vs 打回后"对比 / 历史回溯 / 审计
 *  - 只追加，永不修改、永不删除
 */
import type { AppContext } from "../app.js";
import type { ReviewSnapshot, ReviewItem, ReviewAction } from "../../types/horizontal.js";
import { id, nowIso } from "../../utils.js";

/** 写入审核快照。fail-safe：ctx 缺失 / IO 失败 → 返 null，不抛错。 */
export async function recordReviewSnapshot(
  ctx: AppContext,
  review: ReviewItem,
  action: ReviewAction | string,
  actorId: string,
): Promise<string | null> {
  try {
    if (!ctx.reviewSnapshots) return null;
    const sid = id("snap");
    const snap: ReviewSnapshot = {
      id: sid,
      project_id: review.project_id ?? "",
      review_id: review.id,
      action: String(action),
      snapshot_data: JSON.stringify(review),
      actor_id: actorId ?? "",
      created_at: nowIso(),
    };
    await ctx.reviewSnapshots.insert(snap as any);
    return sid;
  } catch {
    return null;
  }
}

/** 按 review_id 列出快照（按 created_at 升序）。 */
export async function listReviewSnapshots(
  ctx: AppContext,
  reviewId: string,
): Promise<ReviewSnapshot[]> {
  try {
    if (!ctx.reviewSnapshots) return [];
    const all = (await ctx.reviewSnapshots.findMany({ review_id: reviewId })) as ReviewSnapshot[];
    return all
      .filter(Boolean)
      .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  } catch {
    return [];
  }
}

/** 按 review_id 列出快照的反序列化版本（snapshot_data → 对象）。 */
export async function listReviewSnapshotsDecoded(
  ctx: AppContext,
  reviewId: string,
): Promise<Array<{ snapshot: ReviewSnapshot; data: unknown }>> {
  const list = await listReviewSnapshots(ctx, reviewId);
  return list.map((s) => {
    let data: unknown = null;
    try {
      data = JSON.parse(s.snapshot_data);
    } catch {
      data = null;
    }
    return { snapshot: s, data };
  });
}

/** 按 project_id 列出最近 N 条快照（默认 50）。 */
export async function listRecentSnapshotsByProject(
  ctx: AppContext,
  projectId: string,
  limit = 50,
): Promise<ReviewSnapshot[]> {
  try {
    if (!ctx.reviewSnapshots) return [];
    const all = (await ctx.reviewSnapshots.findMany({ project_id: projectId })) as ReviewSnapshot[];
    return all
      .filter(Boolean)
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      .slice(0, limit);
  } catch {
    return [];
  }
}

/** 获取指定 review 的最新一条快照。 */
export async function getLatestSnapshot(
  ctx: AppContext,
  reviewId: string,
): Promise<ReviewSnapshot | null> {
  const list = await listReviewSnapshots(ctx, reviewId);
  if (list.length === 0) return null;
  return list[list.length - 1] ?? null;
}
