/**
 * @file budget-service.ts
 * @description 项目预算服务。负责：
 *  - 预算设置 / 查询（monthly_limit 软上限 + hard_cap 硬上限）
 *  - 当月成本聚合（直接读 cost_records 表，避免实时计算）
 *  - 成本记账（带 idempotency_key 防重入）
 *
 * ## 设计要点
 *  - 成本按 `YYYY-MM` 月份键归档，getCurrentCost() 仅聚合当月。
 *  - recordCost 失败时通过 UNIQUE 约束自动检测幂等命中（同 key 重复记账 → 静默返回 false）。
 *
 * ## 表结构
 *  - project_budgets(id, project_id, monthly_limit, alert_threshold, hard_cap, created_at, updated_at, updated_by)
 *  - cost_records(id, project_id, month_key, amount, source, ref_type, ref_id, idempotency_key, note, created_at)
 */
import { rootLogger } from "../../logger.js";
import { getRawDatabase } from "../../storage/sqlite.js";
import type { AppContext } from "../app.js";
import type { ProjectBudget, CostRecord } from "../../types/horizontal.js";

const log = rootLogger.child({ module: "budget-service" });

/** 软上限告警阈值默认 80%。 */
const DEFAULT_ALERT_THRESHOLD = 0.8;

function nowMonthKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function aggregateCurrentCost(databaseFile: string, projectId: string, monthKey: string): number {
  const database = getRawDatabase(databaseFile);
  const row = database
    .prepare(`SELECT COALESCE(SUM(CAST("amount" AS REAL)), 0) AS total
       FROM "cost_records"
       WHERE "project_id" = ? AND "month_key" = ?`)
    .get(projectId, monthKey) as { total: number } | undefined;
  return Number(row?.total ?? 0);
}

export interface BudgetService {
  getBudget(projectId: string): Promise<ProjectBudget | null>;
  setBudget(input: {
    project_id: string;
    monthly_limit: number | null;
    alert_threshold?: number;
    hard_cap: number | null;
    updated_by?: string;
  }): Promise<ProjectBudget>;
  getCurrentCost(projectId: string): Promise<number>;
  isOverHardCap(projectId: string): Promise<boolean>;
  getUsageRatio(projectId: string): Promise<number>;
  /** V2 W11 P0 REQ-COST-F01：成本前置预估（按 kind/model/参数计算元成本） */
  estimateCost(input: EstimateCostInput): Promise<EstimateCostResult>;
  recordCost(input: {
    projectId: string;
    amount: number;
    idempotencyKey: string;
    source: "image" | "video" | "tts" | "manual";
    refType: string;
    refId: string;
    note?: string;
  }): Promise<boolean>;
}

/** V2 W11 P0 REQ-COST-F01：成本估算入参 */
export interface EstimateCostInput {
  kind: "image" | "video" | "tts";
  model: string;
  count?: number;
  numFrames?: number;
  textLength?: number;
  /** 任务时长大致秒数（视频/TTS 用） */
  durationSec?: number;
  /** 项目 ID（用于预算查询），V2 W12 补齐：之前调用方已传但 type 未声明，导致 TS2339。 */
  projectId: string;
}

/** V2 W11 P0 REQ-COST-F01：成本估算结果 */
export interface EstimateCostResult {
  estimatedCost: number;
  /** 单价（元/单位） */
  unitPrice: number;
  /** 计量单位：image=次 / video=帧 / tts=千字 */
  unit: "image" | "frame" | "thousand_chars";
  quantity: number;
  /** 是否超过项目 hard_cap（同时返 current + cap 供前端展示） */
  exceedsHardCap: boolean;
  currentCost: number;
  hardCap: number;
  budgetConfigured: boolean;
  projectId: string;
}

/** 单价表（元）。保守估计，覆盖 90% 场景；未匹配时回退 defaultPrice。 */
const PRICE_TABLE: Record<string, { price: number; unit: EstimateCostResult["unit"] }> = {
  // 图片：按张
  "agnes-image-2.1-flash": { price: 0.1, unit: "image" },
  "agnes-image-2.1": { price: 0.3, unit: "image" },
  "agnes-image-3.0": { price: 0.5, unit: "image" },
  // 视频：按帧
  "agnes-video-v2.0": { price: 0.02, unit: "frame" },
  "agnes-video-v2.0-fast": { price: 0.01, unit: "frame" },
  // TTS：按千字
  "agnes-tts-v1": { price: 0.5, unit: "thousand_chars" },
};
const DEFAULT_IMAGE_PRICE = 0.2;
const DEFAULT_VIDEO_PRICE = 0.015;
const DEFAULT_TTS_PRICE = 0.5;

function lookupUnitPrice(model: string, kind: EstimateCostInput["kind"]): { price: number; unit: EstimateCostResult["unit"] } {
  const hit = PRICE_TABLE[model];
  if (hit) return hit;
  if (kind === "image") return { price: DEFAULT_IMAGE_PRICE, unit: "image" };
  if (kind === "video") return { price: DEFAULT_VIDEO_PRICE, unit: "frame" };
  return { price: DEFAULT_TTS_PRICE, unit: "thousand_chars" };
}

export function createBudgetService(ctx: AppContext): BudgetService {
  return {
    async getBudget(projectId) {
      return await ctx.projectBudgets.findOne({ project_id: projectId });
    },

    async setBudget(input) {
      const now = new Date().toISOString();
      const existing = await ctx.projectBudgets.findOne({ project_id: input.project_id });
      if (existing) {
        await ctx.projectBudgets.update(existing.id, {
          monthly_limit: input.monthly_limit,
          alert_threshold: input.alert_threshold ?? existing.alert_threshold,
          hard_cap: input.hard_cap,
          updated_at: now,
          updated_by: input.updated_by,
        });
        const updated = await ctx.projectBudgets.findById(existing.id);
        log.info(
          { projectId: input.project_id, monthly_limit: input.monthly_limit, hard_cap: input.hard_cap },
          "项目预算已更新",
        );
        return updated!;
      }
      const record: ProjectBudget = {
        id: crypto.randomUUID(),
        project_id: input.project_id,
        monthly_limit: input.monthly_limit,
        alert_threshold: input.alert_threshold ?? DEFAULT_ALERT_THRESHOLD,
        hard_cap: input.hard_cap,
        created_at: now,
        updated_at: now,
        updated_by: input.updated_by,
      };
      await ctx.projectBudgets.insert(record);
      log.info(
        { projectId: input.project_id, monthly_limit: input.monthly_limit, hard_cap: input.hard_cap },
        "项目预算已创建",
      );
      return record;
    },

    async getCurrentCost(projectId) {
      if (!projectId) return 0;
      return aggregateCurrentCost(ctx.databaseFile, projectId, nowMonthKey());
    },

    async isOverHardCap(projectId) {
      if (!projectId) return false;
      const budget = await ctx.projectBudgets.findOne({ project_id: projectId });
      if (!budget || budget.hard_cap === null || budget.hard_cap === undefined) return false;
      const cost = await this.getCurrentCost(projectId);
      return cost >= budget.hard_cap;
    },

    async getUsageRatio(projectId) {
      if (!projectId) return 0;
      const budget = await ctx.projectBudgets.findOne({ project_id: projectId });
      if (!budget || !budget.monthly_limit || budget.monthly_limit <= 0) return 0;
      const cost = await this.getCurrentCost(projectId);
      return cost / budget.monthly_limit;
    },

    async estimateCost(input) {
      const { price, unit } = lookupUnitPrice(input.model, input.kind);
      let quantity = 0;
      if (input.kind === "image") {
        quantity = input.count && input.count > 0 ? input.count : 1;
      } else if (input.kind === "video") {
        quantity = input.numFrames && input.numFrames > 0 ? input.numFrames : 25;
      } else {
        // tts：按千字
        quantity = input.textLength && input.textLength > 0 ? Math.max(1, Math.ceil(input.textLength / 1000)) : 1;
      }
      const estimatedCost = Number((price * quantity).toFixed(4));
      const budget = await ctx.projectBudgets.findOne({ project_id: input.projectId });
      const currentCost = await this.getCurrentCost(input.projectId);
      const hardCap = budget?.hard_cap ?? 0;
      const budgetConfigured = !!budget;
      const exceedsHardCap = budgetConfigured && hardCap > 0 && (currentCost + estimatedCost) > hardCap;
      return {
        estimatedCost,
        unitPrice: price,
        unit,
        quantity,
        exceedsHardCap,
        currentCost,
        hardCap,
        budgetConfigured,
        projectId: input.projectId,
      };
    },

    async recordCost(input) {
      if (!input.projectId) return false;
      if (!input.idempotencyKey) return false;
      if (!(input.amount > 0)) return false;
      // V2 W11 P0 REQ-COST-F09：硬拦截超额记账
      const overCap = await this.isOverHardCap(input.projectId);
      if (overCap) {
        const err: Error & { code?: string } = new Error(
          `cost_hard_cap_exceeded: 拒绝记账，项目 ${input.projectId} 当月成本已超 hard_cap`,
        );
        err.code = "cost_hard_cap_exceeded";
        log.warn(
          { projectId: input.projectId, amount: input.amount, idempotencyKey: input.idempotencyKey },
          "成本记账被 hard_cap 硬拦截",
        );
        throw err;
      }
      // 增量检查：记完这次后是否会超 hard_cap
      const budget = await ctx.projectBudgets.findOne({ project_id: input.projectId });
      if (budget && budget.hard_cap && budget.hard_cap > 0) {
        const current = await this.getCurrentCost(input.projectId);
        if (current + input.amount > budget.hard_cap) {
          const err: Error & { code?: string } = new Error(
            `cost_hard_cap_will_exceed: 记账后将超 hard_cap（current=${current} + amount=${input.amount} > cap=${budget.hard_cap}）`,
          );
          err.code = "cost_hard_cap_will_exceed";
          log.warn(
            { projectId: input.projectId, current, amount: input.amount, hardCap: budget.hard_cap },
            "成本记账将使 hard_cap 超额，已拦截",
          );
          throw err;
        }
      }
      const record: CostRecord = {
        id: crypto.randomUUID(),
        project_id: input.projectId,
        month_key: nowMonthKey(),
        amount: input.amount,
        source: input.source,
        ref_type: input.refType,
        ref_id: input.refId,
        idempotency_key: input.idempotencyKey,
        note: input.note ?? "",
        created_at: new Date().toISOString(),
      };
      try {
        await ctx.costRecords.insert(record);
        log.debug(
          {
            projectId: input.projectId,
            amount: input.amount,
            source: input.source,
            refId: input.refId,
            idempotencyKey: input.idempotencyKey,
          },
          "成本已记账",
        );
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (/UNIQUE constraint failed/i.test(message)) {
          log.debug(
            { idempotencyKey: input.idempotencyKey, projectId: input.projectId },
            "成本幂等命中（已存在），跳过",
          );
          return false;
        }
        log.error({ err, projectId: input.projectId, idempotencyKey: input.idempotencyKey }, "成本记账失败");
        throw err;
      }
    },
  };
}
