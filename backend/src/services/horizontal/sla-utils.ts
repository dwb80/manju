/**
 * @file sla-utils.ts
 * @description SLA 时长计算与状态判断纯函数（V2 W8 REQ-PIPE-005-03）。
 *
 * 设计原则：所有函数都是纯函数（无 IO），便于单测；不依赖具体 AppContext。
 * - computeSlaDueAt：按 review 状态 + 配置返回 ISO 时间
 * - isSlaBreached：判断当前是否超时
 * - nextEscalationLevel：按当前 level + 超时时长返回下一级（0-3）
 * - isReviewActive：判断 review 是否处于 SLA 监控范围（非终态）
 */

import type { ReviewItem, ReviewStatus, ReviewConfig } from "../../types/horizontal.js";

/** SLA 监控范围内的 review 状态（非终态）。 */
export const SLA_ACTIVE_STATUSES: ReadonlySet<ReviewStatus> = new Set([
  "pending",
  "in_review",
  "rejected",
  "needs_fix",
]);

/** 终态：监控器跳过这些 review。 */
export const SLA_TERMINAL_STATUSES: ReadonlySet<ReviewStatus> = new Set([
  "approved",
  "closed",
  "cancelled",
]);

/**
 * computeSlaDueAt - 计算 review 的 SLA 到期时间
 * @param {ReviewItem} review - review_items 记录
 * @param {Pick<ReviewConfig, "sla_pending_hours" | "sla_review_hours">} config - 项目的 SLA 配置
 * @returns {string} ISO 时间字符串；无法计算时返回 ""
 * @description 规则：
 *              - 终态（approved/closed/cancelled）→ ""（不再有 SLA）
 *              - pending → created_at + sla_pending_hours
 *              - in_review → updated_at（进入 in_review 的时刻）+ sla_review_hours
 *              - rejected/needs_fix → updated_at + sla_review_hours（视为"返工后再次等待处理"）
 *              - 任意输入异常（缺字段、hours 非正）→ ""（V1 兼容：缺值即不监控）
 */
export function computeSlaDueAt(
  review: Pick<ReviewItem, "status" | "created_at" | "updated_at">,
  config: Pick<ReviewConfig, "sla_pending_hours" | "sla_review_hours">,
): string {
  if (SLA_TERMINAL_STATUSES.has(review.status as ReviewStatus)) return "";
  const hours =
    review.status === "pending" ? config.sla_pending_hours : config.sla_review_hours;
  if (!Number.isFinite(hours) || hours <= 0) return "";
  const baseIso = review.status === "pending" ? review.created_at : review.updated_at;
  if (!baseIso) return "";
  const baseMs = Date.parse(baseIso);
  if (!Number.isFinite(baseMs)) return "";
  return new Date(baseMs + hours * 3600 * 1000).toISOString();
}

/**
 * isSlaBreached - 判断 review 是否超时
 * @param {Pick<ReviewItem, "status" | "sla_due_at">} review - review 记录
 * @param {Date} [now] - 当前时间（默认 new Date()，便于测试注入）
 * @returns {boolean} true 表示已超时且仍处于监控范围
 * @description 终态/已取消/无 sla_due_at 一律返回 false。
 */
export function isSlaBreached(
  review: Pick<ReviewItem, "status" | "sla_due_at">,
  now: Date = new Date(),
): boolean {
  if (SLA_TERMINAL_STATUSES.has(review.status as ReviewStatus)) return false;
  if (!review.sla_due_at) return false;
  const dueMs = Date.parse(review.sla_due_at);
  if (!Number.isFinite(dueMs)) return false;
  return now.getTime() > dueMs;
}

/**
 * isReviewActive - 判断 review 是否处于 SLA 监控范围
 * @param {Pick<ReviewItem, "status" | "deleted_at">} review
 * @returns {boolean} true 表示非终态 + 未软删
 */
export function isReviewActive(review: Pick<ReviewItem, "status" | "deleted_at">): boolean {
  if (review.deleted_at) return false;
  return SLA_ACTIVE_STATUSES.has(review.status as ReviewStatus);
}

/**
 * nextEscalationLevel - 计算下一次升级等级
 * @param {Pick<ReviewItem, "escalation_level">} review
 * @param {Pick<ReviewConfig, "escalation_max_level">} config
 * @returns {number} 0-3；已达上限则返回当前等级（不再升级）
 * @description 单调递增：永不降级；超过 max 则保持当前值。
 *              返回 0 表示无需再升级（已是 L0，或当前已是 max）。
 */
export function nextEscalationLevel(
  review: Pick<ReviewItem, "escalation_level">,
  config: Pick<ReviewConfig, "escalation_max_level">,
): number {
  const current = Number(review.escalation_level ?? 0);
  const max = Math.max(0, Math.min(3, Number(config.escalation_max_level ?? 0)));
  if (current >= max) return current; // 已是上限或已升级到 max
  return current + 1;
}

/**
 * escalationDelayHours - 同一 level 升级到下一级的最短等待时长
 * @param {number} currentLevel - 0-3
 * @returns {number} 小时数
 * @description 简单的阶梯式退避：L0→L1 用 0（首次 breach 立即升级），
 *              L1→L2 用 4h，L2→L3 用 12h。V1 占位策略。
 *              返回 Infinity 表示已达最高级。
 */
export function escalationDelayHours(currentLevel: number): number {
  if (currentLevel <= 0) return 0;
  if (currentLevel === 1) return 4;
  if (currentLevel === 2) return 12;
  return Infinity;
}

/**
 * shouldEscalateNow - 综合判断：当前时间是否应该升级
 * @param {Pick<ReviewItem, "status" | "sla_due_at" | "escalation_level" | "escalated_at" | "deleted_at">} review
 * @param {Pick<ReviewConfig, "escalation_enabled" | "escalation_max_level">} config
 * @param {Date} [now]
 * @returns {{ escalate: boolean; targetLevel: number; reason: string }}
 * @description 综合判定：
 *              - escalation_enabled=false → 不升级
 *              - 已达 max_level → 不升级
 *              - 未超时 → 不升级
 *              - 已升级过且距上次升级 < escalationDelayHours → 不升级
 *              - 其它 → 返回目标升级等级
 */
export function shouldEscalateNow(
  review: Pick<ReviewItem, "status" | "sla_due_at" | "escalation_level" | "escalated_at" | "deleted_at">,
  config: Pick<ReviewConfig, "escalation_enabled" | "escalation_max_level">,
  now: Date = new Date(),
): { escalate: boolean; targetLevel: number; reason: string } {
  if (!config.escalation_enabled) {
    return { escalate: false, targetLevel: review.escalation_level ?? 0, reason: "escalation_disabled" };
  }
  if (!isReviewActive(review)) {
    return { escalate: false, targetLevel: review.escalation_level ?? 0, reason: "not_active" };
  }
  if (!isSlaBreached(review, now)) {
    return { escalate: false, targetLevel: review.escalation_level ?? 0, reason: "not_breached" };
  }
  const target = nextEscalationLevel(review, config);
  if (target === (review.escalation_level ?? 0)) {
    return { escalate: false, targetLevel: target, reason: "max_level_reached" };
  }
  // 同 level 升级间隔（防止监控器 60s 一次循环时反复升级到下一级）
  if (review.escalated_at) {
    const lastMs = Date.parse(review.escalated_at);
    const sinceHours = Number.isFinite(lastMs) ? (now.getTime() - lastMs) / 3600000 : Infinity;
    const waitHours = escalationDelayHours(review.escalation_level ?? 0);
    if (sinceHours < waitHours) {
      return { escalate: false, targetLevel: target, reason: "delay_not_elapsed" };
    }
  }
  return { escalate: true, targetLevel: target, reason: "ok" };
}
