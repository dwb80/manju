/**
 * @file review.repository.ts
 * @description Review 聚合 Repository Port。
 *
 * 实现方（infrastructure/persistence/sqlite-review.repository.ts）必须：
 *  - save 使用 `WHERE id = ? AND version = ?` 乐观锁；影响行数 0 抛
 *    aggregate_version_conflict。
 *  - 在同一 SQLite 事务内写入状态、历史、快照和 Outbox，禁止先提交状态再补 Outbox。
 *  - 不修改 SLA 元数据字段（sla_due_at / escalation_level / escalated_at / breached_at）。
 *  - 幂等命令通过 commandId 去重，重复命令抛 command_already_processed。
 *
 * 领域层只定义 Port，不依赖 SQLite。
 */

import type { AggregateRepository } from "../shared/aggregate-root.js";
import type { ReviewAggregate, ReviewHistoryEntry } from "./review.aggregate.js";

/** Repository Port。 */
export interface ReviewRepository
  extends AggregateRepository<ReviewAggregate> {
  /** 按审核目标定位当前审核（用于 submit 去重 / 链路查询）。 */
  findByTarget(
    targetType: string,
    targetId: string,
  ): Promise<ReviewAggregate | null>;

  /** 读取已持久化的审核历史（按 created_at 升序）。 */
  listHistory(reviewId: string): Promise<ReviewHistoryEntry[]>;

  /**
   * 幂等检查：commandId 是否已处理过。已处理返回 true。
   * 必须与 save 在同一事务内调用，确保原子性。
   */
  isCommandProcessed(commandId: string): Promise<boolean>;

  /**
   * 记录已处理命令（commandId, reviewId）。必须与 save 同事务。
   * 重复 commandId 由唯一约束拒绝并抛 command_already_processed。
   */
  recordCommand(commandId: string, reviewId: string): Promise<void>;
}
