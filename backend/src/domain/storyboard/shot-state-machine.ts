/**
 * @file shot-state-machine.ts
 * @description V2.1 DDD-SHOT 镜头八状态机（冻结契约）。
 *
 * 权威来源：
 *   docs/iterations/v2.1-ddd-state-machines.json#shot
 *   docs/iterations/v2.1-ddd-gate0-contracts.md §2.1
 *
 * 任何对状态、命令或迁移的修改都必须先更新 Gate 0 契约与共享契约测试，再回填本文件。
 * 本文件不依赖 HTTP / SQLite / AppContext / AI Provider。
 */

/** 镜头八状态。 */
export type ShotStatus =
  | "draft"
  | "generating"
  | "ready"
  | "in_review"
  | "approved"
  | "needs_fix"
  | "rejected"
  | "archived";

/** 镜头聚合命令名（与状态机迁移表对齐）。 */
export type ShotCommand =
  | "markReady"
  | "editMetadata"
  | "startGeneration"
  | "attachGeneratedVideo"
  | "submitForReview"
  | "approve"
  | "reject"
  | "requestFix"
  | "archive"
  | "restore"
  | "softDelete";

/** 终态：不允许任何出边（仅 archived 在 restore 路径上保留一条出边）。 */
export const SHOT_TERMINAL_STATES: readonly ShotStatus[] = ["archived"];

/**
 * 冻结迁移表：[当前状态, 命令, 目标状态]。
 * create / editMetadata / softDelete 不改变状态，不在此表中。
 * restore 仅允许从 archived 回到 draft。
 */
export const SHOT_TRANSITIONS: ReadonlyArray<
  readonly [ShotStatus, ShotCommand, ShotStatus]
> = [
  ["draft", "markReady", "ready"],
  ["draft", "startGeneration", "generating"],
  ["ready", "startGeneration", "generating"],
  ["needs_fix", "startGeneration", "generating"],
  ["rejected", "startGeneration", "generating"],
  ["generating", "attachGeneratedVideo", "ready"],
  ["ready", "submitForReview", "in_review"],
  ["needs_fix", "submitForReview", "in_review"],
  ["in_review", "approve", "approved"],
  ["in_review", "reject", "rejected"],
  ["in_review", "requestFix", "needs_fix"],
  ["approved", "requestFix", "needs_fix"],
  ["rejected", "requestFix", "needs_fix"],
  ["ready", "archive", "archived"],
  ["approved", "archive", "archived"],
  ["needs_fix", "archive", "archived"],
  ["rejected", "archive", "archived"],
  ["archived", "restore", "draft"],
];

/** 全部合法状态。 */
export const SHOT_STATES: readonly ShotStatus[] = [
  "draft",
  "generating",
  "ready",
  "in_review",
  "approved",
  "needs_fix",
  "rejected",
  "archived",
];

/** 查询某状态在某命令下的目标状态；非法返回 null。 */
export function nextShotStatus(
  from: ShotStatus,
  command: ShotCommand,
): ShotStatus | null {
  for (const [src, cmd, dst] of SHOT_TRANSITIONS) {
    if (src === from && cmd === command) return dst;
  }
  return null;
}

/** 判断迁移是否合法。 */
export function canTransition(
  from: ShotStatus,
  command: ShotCommand,
): boolean {
  return nextShotStatus(from, command) !== null;
}

/** 判断状态是否终态（不可变更状态，restore 是唯一出边）。 */
export function isShotTerminal(status: ShotStatus): boolean {
  return SHOT_TERMINAL_STATES.includes(status);
}

/**
 * 断言迁移合法，非法时返回错误标签（不抛错，由聚合翻译成 DomainError）。
 * 返回目标状态或 null。
 */
export function assertShotTransition(
  from: ShotStatus,
  command: ShotCommand,
): { ok: true; to: ShotStatus } | { ok: false } {
  const to = nextShotStatus(from, command);
  if (to === null) return { ok: false };
  return { ok: true, to };
}

/**
 * 受保护字段：editMetadata 不允许修改这些字段。
 * 普通 PATCH 必须经过 rejectKeyIfProtected 在 Command Handler 入口校验，
 * 避免 Storyboard Input/Update DTO 携带这些字段直接进入 update。
 */
export const SHOT_PROTECTED_FIELDS: readonly string[] = [
  "status",
  "version",
  "reviewId",
  "reviewResult",
  "approvedAt",
  "rejectedAt",
  "reviewerId",
  "submittedAt",
  "submittedBy",
  "lastGenerationRequestId",
];
