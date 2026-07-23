/**
 * @file review-state-machine.ts
 * @description V2.1 DDD-REVIEW 七状态机（冻结契约）。
 *
 * 权威来源：docs/iterations/v2.1-ddd-state-machines.json#review
 *           docs/iterations/v2.1-ddd-gate0-contracts.md §2.2
 *
 * 任何对状态、命令或迁移的修改都必须先更新 Gate 0 契约和共享契约测试，
 * 再回填本文件。本文件不依赖 HTTP / SQLite / AppContext / AI Provider。
 */

/** 审核七状态。 */
export type ReviewStatus =
  | "pending"
  | "in_review"
  | "approved"
  | "rejected"
  | "needs_fix"
  | "closed"
  | "cancelled";

/** 审核聚合命令名（与状态机迁移表对齐）。 */
export type ReviewCommand =
  | "submit"
  | "start"
  | "cancel"
  | "approve"
  | "reject"
  | "markNeedsFix"
  | "resubmit"
  | "close"
  | "assignReviewer";

/** 终态：不允许任何出边。 */
export const REVIEW_TERMINAL_STATES: readonly ReviewStatus[] = ["closed", "cancelled"];

/**
 * 冻结迁移表：[当前状态, 命令, 目标状态]。
 * submit 从“不存在”创建，不在此表中（由聚合工厂处理）。
 */
export const REVIEW_TRANSITIONS: ReadonlyArray<
  readonly [ReviewStatus, ReviewCommand, ReviewStatus]
> = [
  ["pending", "start", "in_review"],
  ["pending", "cancel", "cancelled"],
  ["in_review", "approve", "approved"],
  ["in_review", "reject", "rejected"],
  ["rejected", "markNeedsFix", "needs_fix"],
  ["needs_fix", "resubmit", "pending"],
  ["approved", "close", "closed"],
  ["rejected", "close", "closed"],
];

/** 全部合法状态。 */
export const REVIEW_STATES: readonly ReviewStatus[] = [
  "pending",
  "in_review",
  "approved",
  "rejected",
  "needs_fix",
  "closed",
  "cancelled",
];

/** 查询某状态在某命令下的目标状态；非法返回 null。 */
export function nextReviewStatus(
  from: ReviewStatus,
  command: ReviewCommand,
): ReviewStatus | null {
  for (const [src, cmd, dst] of REVIEW_TRANSITIONS) {
    if (src === from && cmd === command) return dst;
  }
  return null;
}

/** 判断迁移是否合法。 */
export function canTransition(from: ReviewStatus, command: ReviewCommand): boolean {
  return nextReviewStatus(from, command) !== null;
}

/** 判断状态是否终态。 */
export function isReviewTerminal(status: ReviewStatus): boolean {
  return REVIEW_TERMINAL_STATES.includes(status);
}

/**
 * 断言迁移合法，非法时返回错误标签（不抛错，由聚合翻译成 DomainError）。
 * 返回目标状态或 null。
 */
export function assertReviewTransition(
  from: ReviewStatus,
  command: ReviewCommand,
): { ok: true; to: ReviewStatus } | { ok: false } {
  const to = nextReviewStatus(from, command);
  if (to === null) return { ok: false };
  return { ok: true, to };
}
