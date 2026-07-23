/**
 * @file review-migration.ts
 * @description Review 聚合持久化幂等迁移。
 *
 * 仅新增本任务线独有的对象：
 *  - review_command_log：commandId 幂等去重表（aggregate_version_conflict 之外的第二道防线）。
 *
 * 不修改 review_items / review_histories / review_snapshots 的字段定义——这些表由
 * storage/schema.ts 的 FieldSpec 自动建表与 ensureColumns 自动加列，包括 `version`、
 * SLA 字段、previous_review_id / chain_id。本文件只做最小补齐，避免与公共装配冲突。
 *
 * 幂等：可重复调用，已存在的表/列/索引跳过。
 */

import { getRawDatabase } from "../../storage/sqlite.js";

type RawDatabase = {
  exec(sql: string): void;
  prepare(sql: string): {
    all(...args: unknown[]): Record<string, unknown>[];
  };
};

function ensureColumn(
  database: RawDatabase,
  table: string,
  column: string,
  definition: string,
): void {
  const columns = new Set(
    database
      .prepare(`PRAGMA table_info("${table}")`)
      .all()
      .map((row) => String(row.name)),
  );
  if (!columns.has(column)) {
    database.exec(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${definition}`);
  }
}

/** Review 任务线独占的幂等迁移；构造 Repository 时调用一次。 */
export function ensureReviewAggregateSchema(databaseFile: string): void {
  const database = getRawDatabase(databaseFile) as unknown as RawDatabase;
  database.exec("BEGIN");
  try {
    // commandId 幂等表：review_command_log(id PK, review_id, command_type, created_at)
    database.exec(`
      CREATE TABLE IF NOT EXISTS review_command_log (
        id TEXT PRIMARY KEY,
        review_id TEXT NOT NULL,
        command_type TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_review_command_log_review
        ON review_command_log(review_id);
    `);
    // 防御性补齐聚合持久化所需字段，也兼容只创建最小 review_items 表的测试/旧库。
    ensureColumn(database, "review_items", "target_type", "TEXT NOT NULL DEFAULT ''");
    ensureColumn(database, "review_items", "target_id", "TEXT NOT NULL DEFAULT ''");
    ensureColumn(database, "review_items", "rejected_count", "INTEGER NOT NULL DEFAULT 0");
    ensureColumn(database, "review_items", "rejection_reason", "TEXT NOT NULL DEFAULT ''");
    ensureColumn(database, "review_items", "rejection_reason_code", "TEXT NOT NULL DEFAULT ''");
    ensureColumn(database, "review_items", "approved_at", "TEXT NOT NULL DEFAULT ''");
    ensureColumn(database, "review_items", "submitted_by", "TEXT NOT NULL DEFAULT ''");
    ensureColumn(database, "review_items", "reviewed_by", "TEXT NOT NULL DEFAULT ''");
    ensureColumn(database, "review_items", "version", "INTEGER NOT NULL DEFAULT 1");
    ensureColumn(database, "review_items", "re_submit_count", "INTEGER NOT NULL DEFAULT 0");
    ensureColumn(database, "review_items", "previous_review_id", "TEXT NOT NULL DEFAULT ''");
    ensureColumn(database, "review_items", "chain_id", "TEXT NOT NULL DEFAULT ''");
    ensureColumn(database, "review_items", "pipeline_run_id", "TEXT NOT NULL DEFAULT ''");
    ensureColumn(database, "review_items", "pipeline_node_id", "TEXT NOT NULL DEFAULT ''");
    database.exec(`
      UPDATE review_items SET version = 1 WHERE version IS NULL OR version < 1;
    `);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}
