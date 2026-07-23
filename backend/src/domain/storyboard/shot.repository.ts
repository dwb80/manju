/**
 * @file shot.repository.ts
 * @description Shot 聚合 Repository Port。
 *
 * 实现方（infrastructure/persistence/sqlite-shot.repository.ts）必须：
 *  - save 使用 `WHERE id = ? AND version = ?` 乐观锁；影响行数 0 抛
 *    aggregate_version_conflict。
 *  - 在同一 SQLite 事务内写入状态、快照和 Outbox（由 UoW 在 commit 前入队），
 *    禁止先提交状态再补 Outbox。
 *  - 幂等命令通过 commandId 去重（shot_command_log），重复 commandId 抛
 *    command_already_processed。
 *  - 不修改 shots 表的 status/version/审核结果等关键字段以外的字段，
 *    这些字段只能由 Mapper 通过聚合权威字段落盘。
 *
 * 领域层只定义 Port，不依赖 SQLite。
 */

import type { AggregateRepository } from "../shared/aggregate-root.js";
import type {
  ShotAggregate,
  ShotSnapshotDraft,
} from "./shot.aggregate.js";

/** Repository Port。 */
export interface ShotRepository extends AggregateRepository<ShotAggregate> {
  /** 按 storyboardId 列出镜头（按 order 升序、shot_number 升序）。 */
  listByStoryboard(storyboardId: string): Promise<ShotAggregate[]>;

  /** 按 projectId 列出镜头（按 created_at desc）。 */
  listByProject(
    projectId: string,
    options?: { limit?: number; status?: string },
  ): Promise<ShotAggregate[]>;

  /**
   * 幂等检查：commandId 是否已处理过。已处理返回 true。
   * 必须与 save 在同一事务内调用，确保原子性。
   */
  isCommandProcessed(commandId: string): Promise<boolean>;

  /**
   * 记录已处理命令（commandId, shotId）。必须与 save 同事务。
   * 重复 commandId 由唯一约束拒绝并抛 command_already_processed。
   */
  recordCommand(commandId: string, shotId: string): Promise<void>;
}

/** 快照条目（Repository 写入 shots_snapshots 表）。 */
export type ShotSnapshotEntry = ShotSnapshotDraft;
