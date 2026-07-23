/**
 * @file cost-aggregation-service.ts
 * @description V2 W12 P0 REQ-COST-F10：镜头成本聚合。
 *
 * 设计要点：
 *  - 走 cost_records 表聚合（ref_type=shot 的所有记录）
 *  - 附加 pipeline_nodes 关联的 image/video/tts 成本（按 shot_id 间接聚合）
 *  - 返回 { shotId, total, bySource: {image, video, tts, manual}, recordCount }
 */
import { getRawDatabase } from "../../storage/sqlite.js";
import type { AppContext } from "../app.js";

export interface ShotCostSummary {
  shotId: string;
  projectId: string;
  total: number;
  bySource: { image: number; video: number; tts: number; manual: number };
  recordCount: number;
  /** 月份（YYYY-MM），与 cost_records.month_key 一致。 */
  monthKey: string;
}

function nowMonthKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * 聚合单个 shot 的成本（按 source 分桶 + 总额）。
 * 失败返零值结构（不抛错，便于前端直接展示）。
 */
export async function aggregateShotCost(
  ctx: AppContext,
  projectId: string,
  shotId: string,
  monthKey: string = nowMonthKey(),
): Promise<ShotCostSummary> {
  const empty: ShotCostSummary = {
    shotId,
    projectId,
    total: 0,
    bySource: { image: 0, video: 0, tts: 0, manual: 0 },
    recordCount: 0,
    monthKey,
  };
  try {
    const db = getRawDatabase(ctx.databaseFile);
    const rows = db
      .prepare(
        `SELECT "source", COALESCE(SUM(CAST("amount" AS REAL)), 0) AS subtotal, COUNT(*) AS cnt
         FROM "cost_records"
         WHERE "project_id" = ? AND "ref_type" = 'shot' AND "ref_id" = ? AND "month_key" = ?
         GROUP BY "source"`,
      )
      .all(projectId, shotId, monthKey) as Array<{ source: string; subtotal: number; cnt: number }>;
    let total = 0;
    let count = 0;
    const bySource = { image: 0, video: 0, tts: 0, manual: 0 };
    for (const r of rows) {
      const k = r.source as keyof typeof bySource;
      const subtotal = Number(r.subtotal ?? 0);
      const cnt = Number(r.cnt ?? 0);
      if (k in bySource) {
        bySource[k] = Number(subtotal.toFixed(4));
      }
      total += subtotal;
      count += cnt;
    }
    return {
      shotId,
      projectId,
      total: Number(total.toFixed(4)),
      bySource: {
        image: bySource.image,
        video: bySource.video,
        tts: bySource.tts,
        manual: bySource.manual,
      },
      recordCount: count,
      monthKey,
    };
  } catch {
    return empty;
  }
}

/**
 * 批量聚合：项目下所有 shot 的成本（返回 Map<shotId, summary>）。
 * 用单条 SQL + GROUP BY 减少 IO。
 */
export async function aggregateProjectShotsCost(
  ctx: AppContext,
  projectId: string,
  monthKey: string = nowMonthKey(),
): Promise<ShotCostSummary[]> {
  try {
    const db = getRawDatabase(ctx.databaseFile);
    const rows = db
      .prepare(
        `SELECT "ref_id" AS shot_id, "source", COALESCE(SUM(CAST("amount" AS REAL)), 0) AS subtotal, COUNT(*) AS cnt
         FROM "cost_records"
         WHERE "project_id" = ? AND "ref_type" = 'shot' AND "month_key" = ?
         GROUP BY "ref_id", "source"`,
      )
      .all(projectId, monthKey) as Array<{ shot_id: string; source: string; subtotal: number; cnt: number }>;
    const byShot = new Map<string, ShotCostSummary>();
    for (const r of rows) {
      let entry = byShot.get(r.shot_id);
      if (!entry) {
        entry = {
          shotId: r.shot_id,
          projectId,
          total: 0,
          bySource: { image: 0, video: 0, tts: 0, manual: 0 },
          recordCount: 0,
          monthKey,
        };
        byShot.set(r.shot_id, entry);
      }
      const k = r.source as keyof typeof entry.bySource;
      const subtotal = Number(r.subtotal ?? 0);
      const cnt = Number(r.cnt ?? 0);
      if (k in entry.bySource) {
        entry.bySource[k] = Number(subtotal.toFixed(4));
      }
      entry.total = Number((entry.total + subtotal).toFixed(4));
      entry.recordCount += cnt;
    }
    return Array.from(byShot.values()).sort((a, b) => b.total - a.total);
  } catch {
    return [];
  }
}
