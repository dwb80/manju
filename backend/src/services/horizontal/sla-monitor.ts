/**
 * @file sla-monitor.ts
 * @description SLA 监控器（V2 W8 REQ-PIPE-005-03）。
 *
 * 职责：
 *  - 定时（默认 60s，可在 env `SLA_MONITOR_INTERVAL_MS` 覆盖）扫描所有超时 review
 *  - 标记 breached_at（幂等）
 *  - 调升级策略：escalate（通知 reviewer/owner + 写 audit_log）
 *
 * 启动方式：
 *  - createAppContext() 末尾自动 start()
 *  - 测试可通过 stop() 清理定时器
 *
 * 边界（与监控器相关的）：
 *  - 只处理 review_items（不做项目/任务/对话的 SLA）
 *  - 监控器只"通知"，不"操作"（不调 cancelReview/closeReview，避免误杀）
 *  - 同一 level 升级后，下一次升级间隔至少 escalationDelayHours 小时
 */

import { id as makeId, nowIso } from "../../utils.js";
import { rootLogger } from "../../logger.js";
import type { AppContext } from "../app.js";
import type { ReviewItem, ReviewConfig } from "../../types/horizontal.js";
import { DEFAULT_REVIEW_CONFIG, REVIEW_CONFIG_LIMITS } from "../../types/horizontal.js";
import {
  isSlaBreached,
  isReviewActive,
  shouldEscalateNow,
  computeSlaDueAt,
  nextEscalationLevel,
} from "./sla-utils.js";
import {
  createEscalationStrategy,
  type EscalationStrategy,
  type EscalationResult,
  SLA_NOTIFY_TYPES,
} from "./escalation-strategy.js";
import type { NotificationPayload } from "./notification-service.js";

const log = rootLogger.child({ module: "sla-monitor" });

/** 默认扫描间隔（毫秒）。可被 env `SLA_MONITOR_INTERVAL_MS` 覆盖。 */
export const DEFAULT_SLA_MONITOR_INTERVAL_MS = 60_000;

/** 单次 tick 最多处理的 review 数（防止长时间积压打爆后端）。 */
const MAX_BATCH_PER_TICK = 200;

/** ReviewConfig 内存缓存项。 */
interface CachedConfig {
  config: ReviewConfig;
  cachedAt: number;
}

const CONFIG_CACHE_TTL_MS = 30_000; // 30s 缓存，减少 DB 读

export interface SlaMonitorStats {
  /** 是否在运行。 */
  running: boolean;
  /** 定时器句柄（用于测试清理）。 */
  timer: NodeJS.Timeout | null;
  /** 上一次 tick 的 ISO 时间。 */
  lastTickAt: string;
  /** 上一次 tick 扫描的 review 总数。 */
  lastTickScanned: number;
  /** 上一次 tick 标记 breach 的数量。 */
  lastTickBreached: number;
  /** 上一次 tick 升级的 review 数。 */
  lastTickEscalated: number;
  /** 累计 tick 数。 */
  totalTicks: number;
  /** 累计升级次数。 */
  totalEscalations: number;
  /** 累计错误次数。 */
  totalErrors: number;
}

export interface SlaMonitor {
  start(): void;
  stop(): void;
  /** 主动跑一次 tick（供测试 + 手动触发）。返回本次统计。 */
  tick(): Promise<Omit<SlaMonitorStats, "running" | "timer">>;
  /** 单条 review 升级入口（供 D3 手动升级 API 复用）。 */
  escalateOne(reviewId: string, reason?: string): Promise<EscalationResult | null>;
  /** 读当前统计。 */
  stats(): SlaMonitorStats;
  /** 读/取单项目 ReviewConfig（无则用默认值并落库）。 */
  getOrCreateConfig(projectId: string): Promise<ReviewConfig>;
  /** 改单项目 ReviewConfig（带校验）。 */
  updateConfig(
    projectId: string,
    patch: Partial<Pick<ReviewConfig, "sla_pending_hours" | "sla_review_hours" | "escalation_enabled" | "escalation_max_level">>,
  ): Promise<ReviewConfig>;
}

export function createSlaMonitor(ctx: AppContext): SlaMonitor {
  const escalation: EscalationStrategy = createEscalationStrategy(ctx);
  const configCache = new Map<string, CachedConfig>();
  const stats: SlaMonitorStats = {
    running: false,
    timer: null,
    lastTickAt: "",
    lastTickScanned: 0,
    lastTickBreached: 0,
    lastTickEscalated: 0,
    totalTicks: 0,
    totalEscalations: 0,
    totalErrors: 0,
  };

  /**
   * getOrCreateConfig - 读或创建项目 SLA 配置
   * @param {string} projectId
   * @returns {Promise<ReviewConfig>}
   * @description 每项目一条；缺则按 DEFAULT_REVIEW_CONFIG 创建。
   *              内存缓存 30s 减少 DB 读。
   */
  async function getOrCreateConfig(projectId: string): Promise<ReviewConfig> {
    if (!projectId) {
      // 无项目上下文 → 返回 default in-memory（不入库）
      return {
        id: "",
        project_id: "",
        ...DEFAULT_REVIEW_CONFIG,
        created_at: "",
        updated_at: "",
      };
    }
    const cached = configCache.get(projectId);
    if (cached && Date.now() - cached.cachedAt < CONFIG_CACHE_TTL_MS) {
      return cached.config;
    }
    const existing = (await ctx.reviewConfigs.findMany({ project_id: projectId } as any)) as ReviewConfig[];
    let config = existing[0];
    if (!config) {
      const now = nowIso();
      const newConfig: ReviewConfig = {
        id: makeId("rc"),
        project_id: projectId,
        ...DEFAULT_REVIEW_CONFIG,
        created_at: now,
        updated_at: now,
      };
      try {
        await ctx.reviewConfigs.insert(newConfig as any);
      } catch (err) {
        // 并发创建时可能冲突 → 重读
        const retry = (await ctx.reviewConfigs.findMany({ project_id: projectId } as any)) as ReviewConfig[];
        config = retry[0] ?? newConfig;
        if (config === newConfig) throw err;
      }
      config = newConfig;
    }
    configCache.set(projectId, { config, cachedAt: Date.now() });
    return config;
  }

  /**
   * updateConfig - 改 SLA 配置（含校验 + 失效缓存 + 重算非终态 review）
   * @param {string} projectId
   * @param {Partial<...>} patch
   * @returns {Promise<ReviewConfig>}
   */
  async function updateConfig(
    projectId: string,
    patch: Partial<Pick<ReviewConfig, "sla_pending_hours" | "sla_review_hours" | "escalation_enabled" | "escalation_max_level">>,
  ): Promise<ReviewConfig> {
    const config = await getOrCreateConfig(projectId);
    const merged: ReviewConfig = {
      ...config,
      ...patch,
      updated_at: nowIso(),
    };
    // 校验
    if (!Number.isFinite(merged.sla_pending_hours) ||
      merged.sla_pending_hours < REVIEW_CONFIG_LIMITS.SLA_PENDING_HOURS_MIN ||
      merged.sla_pending_hours > REVIEW_CONFIG_LIMITS.SLA_PENDING_HOURS_MAX) {
      throw new Error("sla_pending_hours_out_of_range");
    }
    if (!Number.isFinite(merged.sla_review_hours) ||
      merged.sla_review_hours < REVIEW_CONFIG_LIMITS.SLA_REVIEW_HOURS_MIN ||
      merged.sla_review_hours > REVIEW_CONFIG_LIMITS.SLA_REVIEW_HOURS_MAX) {
      throw new Error("sla_review_hours_out_of_range");
    }
    if (!Number.isFinite(merged.escalation_max_level) ||
      merged.escalation_max_level < 0 ||
      merged.escalation_max_level > REVIEW_CONFIG_LIMITS.ESCALATION_MAX_LEVEL_MAX) {
      throw new Error("escalation_max_level_out_of_range");
    }
    await ctx.reviewConfigs.update(config.id, merged as any);
    configCache.set(projectId, { config: merged, cachedAt: Date.now() });

    // 重算非终态 review 的 sla_due_at（按推荐：只重算非终态）
    const reviews = (await ctx.reviewItems.findMany({ project_id: projectId } as any)) as ReviewItem[];
    for (const r of reviews) {
      if (!isReviewActive(r)) continue;
      const newDue = computeSlaDueAt(r, merged);
      if (newDue !== r.sla_due_at) {
        await ctx.reviewItems.update(r.id, { sla_due_at: newDue, updated_at: nowIso() } as any);
      }
    }
    return merged;
  }

  /**
   * markBreached - 标记单条 review 为超时态
   * @param {string} reviewId
   * @returns {Promise<boolean>} true 表示本次确实写入了 breached_at
   * @description 幂等：已 breached 的不再覆盖。
   */
  async function markBreached(reviewId: string): Promise<boolean> {
    const review = (await ctx.reviewItems.findById(reviewId)) as ReviewItem | null;
    if (!review || !isReviewActive(review)) return false;
    if (review.breached_at) return false; // 幂等
    const now = nowIso();
    try {
      await ctx.reviewItems.update(reviewId, { breached_at: now, updated_at: now } as any);
      // 前哨通知：sla_pending_breach / sla_review_breach
      const type = review.status === "pending" ? SLA_NOTIFY_TYPES.PENDING_BREACH : SLA_NOTIFY_TYPES.REVIEW_BREACH;
      const payload: NotificationPayload = {
        reviewId: review.id,
        projectId: review.project_id,
        targetType: review.target_type,
        targetId: review.target_id,
        breachedAt: now,
        href: `/reviews/${review.id}`,
      };
      const userId = review.submitted_by || "";
      if (userId) {
        try {
          await ctx.notificationService.notify(
            userId,
            type,
            "审核已超时",
            `审核 #${review.id.slice(0, 8)} 已进入超时态，请尽快处理。`,
            payload,
          );
        } catch (err) {
          log.warn({ err, reviewId }, "前哨通知发送失败");
        }
      }
      return true;
    } catch (err) {
      log.error({ err, reviewId }, "标记 breached 失败");
      return false;
    }
  }

  /**
   * escalate - 升级单条 review
   * @param {string} reviewId
   * @param {object} [opts] - 选项
   * @param {boolean} [opts.force=false] - 手动升级模式：跳过 delay 判定和 max_level 限制
   * @returns {Promise<EscalationResult | null>}
   */
  async function escalate(
    reviewId: string,
    opts: { force?: boolean; reason?: string } = {},
  ): Promise<EscalationResult | null> {
    const review = (await ctx.reviewItems.findById(reviewId)) as ReviewItem | null;
    if (!review || !isReviewActive(review)) return null;
    const config = await getOrCreateConfig(review.project_id);
    if (opts.force) {
      // 手动升级：跳过 shouldEscalateNow 所有 delay / max_level 判定，直接到下一级
      const targetLevel = nextEscalationLevel(review, config);
      log.debug({ reviewId, currentLevel: review.escalation_level, targetLevel, maxLevel: config.escalation_max_level }, "manual escalate attempt");
      if (targetLevel === (review.escalation_level ?? 0)) {
        return null; // 已在 max
      }
      const result = await escalation.escalate({
        review,
        config,
        targetLevel,
      });
      const now = nowIso();
      await ctx.reviewItems.update(reviewId, {
        escalation_level: result.level,
        escalated_at: now,
        updated_at: now,
      } as any);
      return result;
    }
    const decision = shouldEscalateNow(review, config);
    if (!decision.escalate) {
      log.debug({ reviewId, reason: decision.reason }, "跳过升级");
      return null;
    }
    const result = await escalation.escalate({
      review,
      config,
      targetLevel: decision.targetLevel,
    });
    // 升级成功 → 写 escalation_level + escalated_at
    const now = nowIso();
    await ctx.reviewItems.update(reviewId, {
      escalation_level: result.level,
      escalated_at: now,
      updated_at: now,
    } as any);
    return result;
  }

  /**
   * tick - 扫描并处理所有超时 review
   * @returns {Promise<{ lastTickAt, lastTickScanned, lastTickBreached, lastTickEscalated }>}
   */
  async function tick(): Promise<Omit<SlaMonitorStats, "running" | "timer">> {
    stats.totalTicks += 1;
    stats.lastTickAt = nowIso();
    let scanned = 0;
    let breached = 0;
    let escalated = 0;
    try {
      // 仅查活跃 review（非终态 + 未软删）。SQLite 端没有 deleted_at 过滤，我们这里在应用层过滤。
      const all = (await ctx.reviewItems.findMany({} as any)) as ReviewItem[];
      const active = all.filter(isReviewActive);
      scanned = active.length;
      // 限流
      const batch = active.slice(0, MAX_BATCH_PER_TICK);
      for (const r of batch) {
        // 1) 重算 sla_due_at（配置可能已变更；幂等）
        const config = await getOrCreateConfig(r.project_id);
        const expectedDue = computeSlaDueAt(r, config);
        if (expectedDue && expectedDue !== r.sla_due_at) {
          await ctx.reviewItems.update(r.id, { sla_due_at: expectedDue, updated_at: nowIso() } as any);
          r.sla_due_at = expectedDue;
        }
        // 2) 标记 breach
        if (isSlaBreached(r)) {
          const ok = await markBreached(r.id);
          if (ok) {
            breached += 1;
            // 重新读取（breached_at 已更新）
            const fresh = (await ctx.reviewItems.findById(r.id)) as ReviewItem;
            if (fresh) {
              const r2 = await escalate(r.id);
              if (r2) escalated += 1;
            }
          } else if (!r.breached_at) {
            // markBreached 内部失败但没设 breached_at → 尝试 escalate 仍可能命中
            const r2 = await escalate(r.id);
            if (r2) escalated += 1;
          } else {
            // 已 breached 但本次未再升级 → 可能 delay_not_elapsed 或 max_level
            const r2 = await escalate(r.id);
            if (r2) escalated += 1;
          }
        }
      }
    } catch (err) {
      stats.totalErrors += 1;
      log.error({ err }, "SLA tick 失败");
    }
    stats.lastTickScanned = scanned;
    stats.lastTickBreached = breached;
    stats.lastTickEscalated = escalated;
    stats.totalEscalations += escalated;
    return {
      lastTickAt: stats.lastTickAt,
      lastTickScanned: stats.lastTickScanned,
      lastTickBreached: stats.lastTickBreached,
      lastTickEscalated: stats.lastTickEscalated,
      totalTicks: stats.totalTicks,
      totalEscalations: stats.totalEscalations,
      totalErrors: stats.totalErrors,
    };
  }

  return {
    start() {
      if (stats.running) return;
      const intervalMs = Number(process.env.SLA_MONITOR_INTERVAL_MS) || DEFAULT_SLA_MONITOR_INTERVAL_MS;
      // 首次启动立刻跑一次，后续按 intervalMs 间隔
      void tick();
      stats.timer = setInterval(() => {
        void tick();
      }, intervalMs);
      // unref 让定时器不阻止进程退出（开发期常用）
      if (stats.timer && typeof stats.timer.unref === "function") stats.timer.unref();
      stats.running = true;
      log.info({ intervalMs }, "SLA 监控器已启动");
    },
    stop() {
      if (stats.timer) {
        clearInterval(stats.timer);
        stats.timer = null;
      }
      stats.running = false;
      log.info("SLA 监控器已停止");
    },
    tick,
    escalateOne(reviewId: string, reason?: string) {
      return escalate(reviewId, { force: true, reason });
    },
    stats() {
      return { ...stats, timer: stats.timer };
    },
    getOrCreateConfig,
    updateConfig,
  };
}
