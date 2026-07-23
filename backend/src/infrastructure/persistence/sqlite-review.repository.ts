/**
 * @file sqlite-review.repository.ts
 * @description ReviewRepository 的 SQLite 实现。
 *
 * 关键规则（迭代计划 §3.3 / §6.5）：
 *  - save 使用 `WHERE id = ? AND version = ?` 乐观锁；影响行数 0 抛 aggregate_version_conflict。
 *  - save 不开启自己的 BEGIN/COMMIT：所有语句参与外层 UnitOfWork（TransactionService）
 *    的事务，确保状态/历史/快照与 Outbox（由 UoW 在 commit 前写入）原子提交。
 *  - 不修改 SLA 元数据字段（sla_due_at / escalation_level / escalated_at / breached_at），
 *    UPDATE 只 SET 聚合权威字段；SLA 由 sla-monitor 独占。
 *  - recordCommand 通过 review_command_log(id PK) 去重；重复 commandId 抛 command_already_processed。
 *  - 幂等检查 isCommandProcessed 必须与 save 同事务调用（命令处理器保证顺序）。
 *
 * Outbox：领域事件由命令处理器经 UnitOfWorkContext.enqueueDomainEvent 入队，TransactionService
 * 在 COMMIT 前写入 outbox_events。Repository 不直接写 outbox，避免与 UoW 双写重复。
 */

import type { ReviewRepository } from "../../domain/review/review.repository.js";
import type {
  ReviewAggregate,
  ReviewHistoryEntry,
} from "../../domain/review/review.aggregate.js";
import {
  DOMAIN_ERROR_CODES,
  DomainError,
} from "../../domain/shared/domain-error.js";
import { reviewVersionConflictError } from "../../domain/review/review-errors.js";
import { getRawDatabase } from "../../storage/sqlite.js";
import { ensureReviewAggregateSchema } from "./review-migration.js";
import { ReviewMapper, type SqliteRow } from "./review.mapper.js";

type RunResult = { changes?: number | bigint };
type Statement = {
  get(...args: unknown[]): Record<string, unknown> | undefined;
  all(...args: unknown[]): Record<string, unknown>[];
  run(...args: unknown[]): RunResult;
};
type RawDatabase = {
  exec(sql: string): void;
  prepare(sql: string): Statement;
};

function changes(result: RunResult): number {
  return Number(result.changes ?? 0);
}

function nowIso(): string {
  return new Date().toISOString();
}

function snapshotId(): string {
  // 与 review-service 旧快照 id 风格保持一致，便于跨模块查询。
  return `review_snapshot-${nowIso()}-${Math.random().toString(36).slice(2, 10)}`;
}

export class SqliteReviewRepository implements ReviewRepository {
  private readonly database: RawDatabase;

  constructor(databaseFile: string) {
    ensureReviewAggregateSchema(databaseFile);
    this.database = getRawDatabase(databaseFile) as unknown as RawDatabase;
  }

  async get(id: string): Promise<ReviewAggregate | null> {
    const row = this.database
      .prepare("SELECT * FROM review_items WHERE id = ?")
      .get(id) as SqliteRow | undefined;
    if (!row) return null;
    return ReviewMapper.toDomain(row);
  }

  async findByTarget(
    targetType: string,
    targetId: string,
  ): Promise<ReviewAggregate | null> {
    const row = this.database
      .prepare(
        `SELECT * FROM review_items
         WHERE target_type = ? AND target_id = ?
         ORDER BY created_at DESC, id DESC LIMIT 1`,
      )
      .get(targetType, targetId) as SqliteRow | undefined;
    if (!row) return null;
    return ReviewMapper.toDomain(row);
  }

  async listHistory(reviewId: string): Promise<ReviewHistoryEntry[]> {
    const rows = this.database
      .prepare(
        `SELECT * FROM review_histories WHERE review_id = ?
         ORDER BY created_at ASC, id ASC`,
      )
      .all(reviewId) as SqliteRow[];
    return rows.map((row) => ({
      id: String(row.id ?? ""),
      review_id: String(row.review_id ?? ""),
      from_status: String(row.from_status ?? "") as ReviewHistoryEntry["from_status"],
      to_status: String(row.to_status ?? "") as ReviewHistoryEntry["to_status"],
      action: String(row.action ?? "") as ReviewHistoryEntry["action"],
      actor_id: String(row.actor_id ?? ""),
      comment: String(row.comment ?? ""),
      metadata: String(row.metadata ?? ""),
      created_at: String(row.created_at ?? ""),
    }));
  }

  async isCommandProcessed(commandId: string): Promise<boolean> {
    const row = this.database
      .prepare("SELECT id FROM review_command_log WHERE id = ?")
      .get(commandId) as SqliteRow | undefined;
    return Boolean(row);
  }

  async recordCommand(
    commandId: string,
    reviewId: string,
  ): Promise<void> {
    try {
      this.database
        .prepare(
          `INSERT INTO review_command_log (id, review_id, command_type, created_at)
           VALUES (?, ?, ?, ?)`,
        )
        .run(commandId, reviewId, "", nowIso());
    } catch (err) {
      // PK 冲突 = commandId 已处理。SQLite 主键冲突抛出后事务仍可继续读写（同一连接）。
      const message = err instanceof Error ? err.message : String(err);
      if (/UNIQUE constraint|PRIMARY KEY|unique/i.test(message)) {
        throw new DomainError(
          DOMAIN_ERROR_CODES.commandAlreadyProcessed,
          `审核命令已处理：${commandId}`,
          { aggregateType: "Review", reviewId, commandId },
        );
      }
      throw err;
    }
  }

  async save(
    aggregate: ReviewAggregate,
    expectedVersion: number,
  ): Promise<void> {
    if (aggregate.isNew) {
      this.insertAggregate(aggregate);
    } else {
      this.updateAggregate(aggregate, expectedVersion);
    }
    // 拉取并写入聚合产出的历史条目（同事务）。
    const history = aggregate.pullPendingHistory();
    if (history.length > 0) {
      this.insertHistory(history);
    }
    // 写入审核快照（不可变 JSON，记录本次迁移后的聚合状态；同事务）。
    this.insertSnapshot(aggregate);
    aggregate.isNew = false;
  }

  private insertAggregate(aggregate: ReviewAggregate): void {
    const row = ReviewMapper.toPersistence(aggregate);
    this.database
      .prepare(
        `INSERT INTO review_items
         (id, target_type, target_id, project_id, status, rejected_count,
          rejection_reason, rejection_reason_code, approved_at, submitted_by,
          reviewed_by, re_submit_count, previous_review_id, chain_id,
          pipeline_run_id, pipeline_node_id, created_at, updated_at, version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        row.id,
        row.target_type,
        row.target_id,
        row.project_id,
        row.status,
        row.rejected_count,
        // rejection_reason（旧字段）与 rejection_reason_code 同步，兼容旧读取路径。
        row.rejection_reason_code,
        row.rejection_reason_code,
        row.approved_at,
        row.submitted_by,
        row.reviewed_by,
        row.re_submit_count,
        row.previous_review_id,
        row.chain_id,
        row.pipeline_run_id,
        row.pipeline_node_id,
        row.created_at,
        row.updated_at,
        row.version,
      );
  }

  private updateAggregate(
    aggregate: ReviewAggregate,
    expectedVersion: number,
  ): void {
    const row = ReviewMapper.toPersistence(aggregate);
    const result = this.database
      .prepare(
        `UPDATE review_items
         SET status = ?, rejected_count = ?, rejection_reason = ?,
             rejection_reason_code = ?, approved_at = ?, submitted_by = ?,
             reviewed_by = ?, re_submit_count = ?, previous_review_id = ?,
             chain_id = ?, pipeline_run_id = ?, pipeline_node_id = ?,
             updated_at = ?, version = ?
         WHERE id = ? AND version = ?`,
      )
      .run(
        row.status,
        row.rejected_count,
        row.rejection_reason_code,
        row.rejection_reason_code,
        row.approved_at,
        row.submitted_by,
        row.reviewed_by,
        row.re_submit_count,
        row.previous_review_id,
        row.chain_id,
        row.pipeline_run_id,
        row.pipeline_node_id,
        row.updated_at,
        row.version,
        row.id,
        expectedVersion,
      );
    if (changes(result) !== 1) {
      throw reviewVersionConflictError(row.id, expectedVersion);
    }
  }

  private insertHistory(entries: readonly ReviewHistoryEntry[]): void {
    const stmt = this.database.prepare(
      `INSERT INTO review_histories
       (id, review_id, from_status, to_status, action, actor_id, comment, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const entry of entries) {
      stmt.run(
        entry.id,
        entry.review_id,
        entry.from_status,
        entry.to_status,
        entry.action,
        entry.actor_id,
        entry.comment,
        entry.metadata,
        entry.created_at,
      );
    }
  }

  private insertSnapshot(aggregate: ReviewAggregate): void {
    // 仅在"显著"状态写快照（approved / rejected / needs_fix / closed / cancelled）。
    // pending / in_review 属于中间态，不打快照——避免 submit/start 噪音并
    // 让"打回前 vs 打回后"对比聚焦在决策点（迭代计划 §6.5）。
    const significant: ReadonlySet<string> = new Set([
      "approved",
      "rejected",
      "needs_fix",
      "closed",
      "cancelled",
    ]);
    if (!significant.has(aggregate.status)) return;
    const row = ReviewMapper.toPersistence(aggregate);
    const snapshotData = JSON.stringify({
      reviewId: row.id,
      targetType: row.target_type,
      targetId: row.target_id,
      projectId: row.project_id,
      status: row.status,
      rejectedCount: row.rejected_count,
      rejectionReasonCode: row.rejection_reason_code,
      reSubmitCount: row.re_submit_count,
      previousReviewId: row.previous_review_id,
      chainId: row.chain_id,
      submittedBy: row.submitted_by,
      reviewedBy: row.reviewed_by,
      approvedAt: row.approved_at,
      version: row.version,
    });
    this.database
      .prepare(
        `INSERT INTO review_snapshots
         (id, project_id, review_id, action, snapshot_data, actor_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        snapshotId(),
        row.project_id,
        row.id,
        aggregate.lastAction,
        snapshotData,
        row.reviewed_by || row.submitted_by,
        nowIso(),
      );
  }
}
