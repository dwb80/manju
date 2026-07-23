/**
 * @file shot-migration.ts
 * @description Shot 聚合持久化幂等迁移。
 *
 * 仅新增本任务线独有的对象：
 *   - shot_command_log：commandId 幂等去重表（aggregate_version_conflict 之外的第二道防线）。
 *   - shots 增加新列：current_generation_request_id / video_candidates (json) /
 *     review_result (json) / submitted_by。这些是聚合权威字段，FieldSpec 没列；
 *     由本迁移补齐。
 *
 * 不修改 shots / shot_snapshots 的现有字段定义（FieldSpec 由 storage/schema.ts
 * 自动建表 + ensureColumns 加列）。version 列在 schema 已有，本迁移不做防御性 ALTER。
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

/** Shot 任务线独占的幂等迁移；构造 Repository 时调用一次。 */
export function ensureShotAggregateSchema(databaseFile: string): void {
  const database = getRawDatabase(databaseFile) as unknown as RawDatabase;
  database.exec("BEGIN");
  try {
    // commandId 幂等表
    database.exec(`
      CREATE TABLE IF NOT EXISTS shot_command_log (
        id TEXT PRIMARY KEY,
        shot_id TEXT NOT NULL,
        command_type TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_shot_command_log_shot
        ON shot_command_log(shot_id);
    `);

    // shots 表聚合权威列（FieldSpec 没有，但 Mapper 读写）。
    ensureColumn(database, "shots", "current_generation_request_id",
      "TEXT NOT NULL DEFAULT ''");
    ensureColumn(database, "shots", "video_candidates",
      "TEXT NOT NULL DEFAULT '[]'");
    ensureColumn(database, "shots", "review_result",
      "TEXT NOT NULL DEFAULT ''");
    ensureColumn(database, "shots", "submitted_by",
      "TEXT NOT NULL DEFAULT ''");
    ensureColumn(database, "shots", "pipeline_run_id",
      "TEXT NOT NULL DEFAULT ''");
    ensureColumn(database, "shots", "pipeline_node_id",
      "TEXT NOT NULL DEFAULT ''");
    ensureColumn(database, "shots", "version",
      "INTEGER NOT NULL DEFAULT 1");

    // shot_snapshots 表 change_note / created_by 列
    ensureColumn(database, "shot_snapshots", "change_note",
      "TEXT NOT NULL DEFAULT ''");
    ensureColumn(database, "shot_snapshots", "created_by",
      "TEXT NOT NULL DEFAULT 'system'");

    // shots.version 必须 ≥ 1
    database.exec(`UPDATE shots SET version = 1 WHERE version IS NULL OR version < 1;`);

    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}
