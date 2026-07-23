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

/** Idempotent, transaction-scoped migration owned by the Pipeline task line. */
export function ensurePipelineAggregateSchema(databaseFile: string): void {
  const database = getRawDatabase(databaseFile) as unknown as RawDatabase;
  database.exec("BEGIN");
  try {
    database.exec(`
      CREATE TABLE IF NOT EXISTS pipeline_runs (
        id TEXT PRIMARY KEY, project_id TEXT NOT NULL, name TEXT NOT NULL,
        status TEXT NOT NULL, workflow_config TEXT NOT NULL DEFAULT '{}',
        start_node_id TEXT NOT NULL DEFAULT '', current_node_id TEXT NOT NULL DEFAULT '',
        error TEXT NOT NULL DEFAULT '', started_at TEXT NOT NULL DEFAULT '',
        completed_at TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1,
        processed_command_ids TEXT NOT NULL DEFAULT '[]'
      );
      CREATE TABLE IF NOT EXISTS pipeline_nodes (
        id TEXT PRIMARY KEY, run_id TEXT NOT NULL, project_id TEXT NOT NULL,
        type TEXT NOT NULL, name TEXT NOT NULL, status TEXT NOT NULL,
        config TEXT NOT NULL DEFAULT '{}', input_data TEXT NOT NULL DEFAULT '{}',
        output_data TEXT NOT NULL DEFAULT '{}', error TEXT NOT NULL DEFAULT '',
        error_category TEXT NOT NULL DEFAULT '', retry_count INTEGER NOT NULL DEFAULT 0,
        max_retries INTEGER NOT NULL DEFAULT 2, started_at TEXT NOT NULL DEFAULT '',
        completed_at TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL, idempotency_key TEXT NOT NULL DEFAULT '',
        priority INTEGER NOT NULL DEFAULT 1, version INTEGER NOT NULL DEFAULT 1
      );
      CREATE TABLE IF NOT EXISTS pipeline_dependencies (
        id TEXT PRIMARY KEY, run_id TEXT NOT NULL, source_node_id TEXT NOT NULL,
        target_node_id TEXT NOT NULL, created_at TEXT NOT NULL,
        condition_type TEXT NOT NULL DEFAULT 'always',
        condition_expr TEXT NOT NULL DEFAULT '', condition TEXT NOT NULL DEFAULT '{}'
      );
      CREATE TABLE IF NOT EXISTS outbox_events (
        id TEXT PRIMARY KEY, topic TEXT NOT NULL, payload TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'pending',
        attempts INTEGER NOT NULL DEFAULT 0, max_attempts INTEGER NOT NULL DEFAULT 5,
        not_before INTEGER NOT NULL DEFAULT 0, last_error TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
    `);
    ensureColumn(database, "pipeline_runs", "version", "INTEGER NOT NULL DEFAULT 1");
    ensureColumn(
      database,
      "pipeline_runs",
      "processed_command_ids",
      "TEXT NOT NULL DEFAULT '[]'",
    );
    ensureColumn(database, "pipeline_nodes", "version", "INTEGER NOT NULL DEFAULT 1");
    ensureColumn(
      database,
      "pipeline_nodes",
      "error_category",
      "TEXT NOT NULL DEFAULT ''",
    );
    ensureColumn(
      database,
      "pipeline_nodes",
      "max_retries",
      "INTEGER NOT NULL DEFAULT 2",
    );
    database.exec(`
      UPDATE pipeline_runs SET version = 1 WHERE version IS NULL OR version < 1;
      UPDATE pipeline_nodes SET version = 1 WHERE version IS NULL OR version < 1;
      UPDATE pipeline_runs SET processed_command_ids = '[]'
        WHERE processed_command_ids IS NULL OR processed_command_ids = '';
      CREATE INDEX IF NOT EXISTS idx_pipeline_nodes_run ON pipeline_nodes(run_id);
      CREATE INDEX IF NOT EXISTS idx_pipeline_dependencies_run ON pipeline_dependencies(run_id);
      CREATE INDEX IF NOT EXISTS idx_pipeline_nodes_idempotency
        ON pipeline_nodes(project_id, idempotency_key, status);
      CREATE INDEX IF NOT EXISTS idx_outbox_events_status
        ON outbox_events(status, created_at);
    `);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}
