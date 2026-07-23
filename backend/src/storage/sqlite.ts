/**
 * @file sqlite.ts
 * @description SQLite 数据库连接管理与通用仓储实现。
 *              提供数据库连接池、慢查询统计、字段编解码，
 *              以及 SqliteRepository / SqliteSettingsRepository 两个核心仓储类。
 */

import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { jsonClone } from "../utils.js";
import { rootLogger } from "../logger.js";
import { protectSensitiveJson, revealSensitiveJson } from "../services/security/hardening.js";
import type { FieldSpec, FieldType, KeyValueRepository, QueryOptions, Repository } from "./repository.js";

/** 慢查询阈值：超过此毫秒数会打 debug 日志。仅在 LOG_LEVEL=debug 时启用计时（零开销）。 */
const SLOW_QUERY_THRESHOLD_MS = 200;

type DatabaseSync = {
  exec(sql: string): void;
  close(): void;
  prepare(sql: string): {
    run(...values: unknown[]): unknown;
    get(...values: unknown[]): Record<string, unknown> | undefined;
    all(...values: unknown[]): Record<string, unknown>[];
  };
}

const require = createRequire(import.meta.url);
const sqlite = require("node:sqlite") as { DatabaseSync: new (filename: string) => DatabaseSync };
const databasePool = new Map<string, DatabaseSync>();

/**
 * 把原始 prepare 包装成"会统计耗时并在 debug 级别输出慢查询"的 statement。
 * 当 LOG_LEVEL!=debug 时，timingEnabled 为 false，不取 Date.now()，零开销。
 */
function wrapStatement(
  statement: ReturnType<DatabaseSync["prepare"]>,
  sql: string,
  table: string,
  operation: "run" | "get" | "all" | "exec",
  timingEnabled: boolean,
): ReturnType<DatabaseSync["prepare"]> {
  if (!timingEnabled) return statement;

  // 用一个"分桶 SQL"作为日志键，避免在每条参数化 SQL 上都打完整模板（噪声太大）
  const sqlOneLine = sql.replace(/\s+/g, " ").trim().slice(0, 240);
  const wrap = <T extends unknown[]>(fn: (...args: T) => unknown) =>
    (...args: T) => {
      const start = Date.now();
      try {
        return fn(...args);
      } finally {
        const durationMs = Date.now() - start;
        if (durationMs >= SLOW_QUERY_THRESHOLD_MS) {
          rootLogger.debug(
            {
              event: "db.slow_query",
              table,
              operation,
              durationMs,
              sqlPreview: sqlOneLine,
              paramCount: args.length,
            },
            `慢查询：${table}.${operation} 耗时 ${durationMs}ms（阈值 ${SLOW_QUERY_THRESHOLD_MS}ms）`,
          );
        }
      }
    };

  return {
    run: wrap(statement.run.bind(statement)) as typeof statement.run,
    get: wrap(statement.get.bind(statement)) as typeof statement.get,
    all: wrap(statement.all.bind(statement)) as typeof statement.all,
  } as ReturnType<DatabaseSync["prepare"]>;
}

/** 打开并复用同一个 SQLite 数据库连接，避免每次请求都重新建连接。 */
function openDatabase(file: string): DatabaseSync {
  const absolute = path.resolve(file);
  const existing = databasePool.get(absolute);
  if (existing) return existing;
  mkdirSync(path.dirname(absolute), { recursive: true });
  const database = new sqlite.DatabaseSync(absolute);
  database.exec("PRAGMA journal_mode = WAL");
  database.exec("PRAGMA synchronous = NORMAL");
  // 包装 prepare，让上层业务 SQL 自动获得慢查询统计。
  // 复用一个 timingEnabled 标志，避免每次调用都查 isLevelEnabled（热路径开销）。
  const timingEnabled = rootLogger.isLevelEnabled("debug");
  const originalPrepare = database.prepare.bind(database);
  (database as unknown as { prepare: DatabaseSync["prepare"] }).prepare = ((sql: string) => {
    return wrapStatement(originalPrepare(sql), sql, "(unknown)", "all", timingEnabled);
  });

  databasePool.set(absolute, database);
  return database;
}

/** 关闭指定 SQLite 文件连接，主要用于测试清理和服务进程优雅退出。 */
export function closeDatabase(file: string): void {
  const absolute = path.resolve(file);
  const database = databasePool.get(absolute);
  if (!database) return;
  database.close();
  databasePool.delete(absolute);
}

/**
 * getRawDatabase - 获取共享的 SQLite 连接，用于执行 CREATE VIEW / 复杂 SQL。
 * 注意：仅供一次性初始化（启动时建视图）和极少数聚合查询使用；
 *       业务读写必须走 Repository（编码/慢查询统计/WAL 写入都由它负责）。
 */
export function getRawDatabase(file: string): DatabaseSync {
  return openDatabase(file);
}

/** SQLite 标识符只允许代码内声明的表名和字段名进入，这里做一次双引号转义。 */
function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

/** JSON 字段写入字符串，其他字段按原始值写入。 */
function encodeValue(type: FieldType, value: unknown): unknown {
  if (value === undefined || value === null) return "";
  if (type === "json") return JSON.stringify(protectSensitiveJson(value ?? null));
  if (type === "boolean") return value ? 1 : 0;
  return value;
}

/** 从 SQLite 行还原业务对象，保持业务字段类型。 */
function decodeValue(type: FieldType, value: unknown): unknown {
  if (type === "number") return Number(value ?? 0);
  if (type === "boolean") return value === 1 || value === "1" || value === true || value === "true";
  if (type === "json") {
    if (typeof value !== "string" || value.length === 0) return null;
    return revealSensitiveJson(JSON.parse(value));
  }
  return String(value ?? "");
}

/** 比较筛选条件，JSON 字段用字符串化后的结果比对。 */
function encodeFilterValue<T>(fields: FieldSpec<T>[], key: string, value: unknown): unknown {
  const field = fields.find((item) => item.key === key);
  return encodeValue((field?.type ?? "string") as FieldType, value);
}

/** SQLite 版本的通用业务仓储，负责按字段定义创建表并完成增删查改。 */
export class SqliteRepository<T extends { id: string; created_at: string }> implements Repository<T> {
  private readonly database: DatabaseSync;
  private readonly table: string;
  private readonly fields: FieldSpec<T>[];
  /**
   * true = 正常仓储（fields 有定义、表已建好）；
   * false = legacy 仓储（fields 为空、表未创建），所有读操作返回空、写入必须抛错，
   *        避免 `no such table: <name>` 一路冒泡到 HTTP 响应里。
   */
  private readonly isConfigured: boolean;

  /** 为一个业务实体创建 SQLite 表，并按字段定义读写记录。 */
  constructor(databaseFile: string, entity: string, fields: FieldSpec<T>[]) {
    this.database = openDatabase(databaseFile);
    this.table = entity;
    this.fields = fields;
    this.isConfigured = fields.length > 0;
    this.ensureTable();
  }

  /**
   * legacy 表守卫：在 fields 为空时拒绝任何写入，避免静默丢数据。
   * 调用方必须看到清晰错误并把对应的旧字段/逻辑迁到新表（work_items 等）。
   */
  private assertConfigured(method: string): void {
    if (this.isConfigured) return;
    throw new Error(`[${this.table}] 表未配置 schema（legacy table）:${method} 不可用,请将数据迁到新表`);
  }

  /** 创建表结构；当前统一使用 TEXT/INTEGER 存储，类型转换由仓储层负责。 */
  private ensureTable(): void {
    // 兼容旧表（如 project_tasks / publish_plans / model_configs 等正在迁出或已停用），
    // 当 fields 为空时跳过建表，避免 `CREATE TABLE name ()` 触发 SQLite 语法错误。
    if (this.fields.length === 0) return;
    const columns = this.fields.map((field) => {
      const type = field.type === "number" || field.type === "boolean" ? "INTEGER" : "TEXT";
      const primary = field.key === "id" ? " PRIMARY KEY" : "";
      return `${quoteIdentifier(field.key)} ${type}${primary}`;
    });
    this.database.exec(`CREATE TABLE IF NOT EXISTS ${quoteIdentifier(this.table)} (${columns.join(", ")})`);
    this.ensureColumns();
    if (this.fields.some((field) => field.key === "created_at")) {
      this.database.exec(`CREATE INDEX IF NOT EXISTS ${quoteIdentifier(`${this.table}_created_at_idx`)} ON ${quoteIdentifier(this.table)} (${quoteIdentifier("created_at")})`);
    }
  }

  /** 为旧 SQLite 表补齐后来新增的字段，避免版本升级后缺列。 */
  private ensureColumns(): void {
    const rows = this.database.prepare(`PRAGMA table_info(${quoteIdentifier(this.table)})`).all();
    const existing = new Set(rows.map((row) => String(row.name)));
    for (const field of this.fields) {
      if (existing.has(field.key)) continue;
      const type = field.type === "number" || field.type === "boolean" ? "INTEGER" : "TEXT";
      this.database.exec(`ALTER TABLE ${quoteIdentifier(this.table)} ADD COLUMN ${quoteIdentifier(field.key)} ${type}`);
    }
  }

  /**
   * 方案 A 迁移辅助：把 `scripts` 表（Path A）的元数据（title/author/status/genre/words/chapters）
   * 按 `(project_id, title)` 模糊匹配回填到 `script_documents` 表（Path B）。
   * 仅当目标列为空/NULL 时覆盖，避免覆盖后续用户编辑。
   * 必须在 `ensureColumns` 完成之后调用。
   */
  backfillFromScriptsTable(): void {
    // 仅对 script_documents 表生效
    if (this.table !== "script_documents") return;
    const database = this.database;
    const candidates = database
      .prepare(
        `SELECT s.id AS script_id, s.project_id, s.title, s.author, s.status, s.words, s.chapters
         FROM scripts s
         WHERE s.title IS NOT NULL AND s.title <> ''`,
      )
      .all() as Array<{
        script_id: string;
        project_id: string;
        title: string;
        author: string | null;
        status: string | null;
        words: number | null;
        chapters: number | null;
      }>;
    if (candidates.length === 0) return;

    const updateSql = `UPDATE script_documents
       SET title = COALESCE(NULLIF(title, ''), ?),
           author = COALESCE(NULLIF(author, ''), ?),
           status = CASE WHEN status IS NULL OR status = '' THEN ? ELSE status END,
           words = CASE WHEN words IS NULL OR words = 0 THEN ? ELSE words END,
           chapters = CASE WHEN chapters IS NULL OR chapters = 0 THEN ? ELSE chapters END
       WHERE project_id = ? AND (title = '' OR title IS NULL)`;
    const stmt = database.prepare(updateSql);
    database.exec("BEGIN");
    try {
      let updated = 0;
      for (const s of candidates) {
        const info = stmt.run(
          s.title,
          s.author ?? "当前用户",
          s.status ?? "draft",
          s.words ?? 0,
          s.chapters ?? 0,
          s.project_id,
        );
        updated += Number((info as { changes?: number }).changes ?? 0);
      }
      database.exec("COMMIT");
      if (updated > 0) {
        // eslint-disable-next-line no-console
        console.log(`[migrate] 已从 Path A 的 scripts 表回填 ${updated} 条 script_documents`);
      }
    } catch (err) {
      database.exec("ROLLBACK");
      throw err;
    }
  }

  /** 插入单条记录。 */
  async insert(record: T): Promise<void> {
    this.assertConfigured("insert");
    await this.insertBatch([record]);
  }

  /** 批量插入记录，使用事务降低半写入风险。 */
  async insertBatch(records: T[]): Promise<void> {
    if (records.length === 0) return;
    this.assertConfigured("insertBatch");
    const columns = this.fields.map((field) => quoteIdentifier(field.key)).join(", ");
    const placeholders = this.fields.map(() => "?").join(", ");
    const statement = this.database.prepare(`INSERT INTO ${quoteIdentifier(this.table)} (${columns}) VALUES (${placeholders})`);
    this.database.exec("BEGIN");
    try {
      for (const record of records) {
        statement.run(...this.fields.map((field) => encodeValue(field.type as FieldType, record[field.key])));
      }
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  /** 根据 ID 查找单条记录。 */
  async findById(id: string): Promise<T | null> {
    if (!this.isConfigured) return null;
    return this.findOne({ id } as Partial<T>);
  }

  /** 根据筛选条件查找第一条记录。 */
  async findOne(filter: Partial<T>): Promise<T | null> {
    const records = await this.findMany(filter, { limit: 1 });
    return records[0] ?? null;
  }

  /** 查询记录列表，支持等值筛选、创建时间排序和数量限制。 */
  async findMany(filter: Partial<T> = {}, options: QueryOptions = {}): Promise<T[]> {
    // legacy 表(无 fields)未建表,直接返回空数组,避免 SELECT 报 "no such table"
    if (!this.isConfigured) return [];
    const clauses: string[] = [];
    const values: unknown[] = [];
    for (const [key, value] of Object.entries(filter)) {
      if (value === undefined) continue;
      clauses.push(`${quoteIdentifier(key)} = ?`);
      values.push(encodeFilterValue(this.fields, key, value));
    }
    const where = clauses.length > 0 ? ` WHERE ${clauses.join(" AND ")}` : "";
    const direction = options.sort === "asc" ? "ASC" : "DESC";
    const limit = options.limit ? " LIMIT ?" : "";
    if (options.limit) values.push(options.limit);
    const rows = this.database
      .prepare(`SELECT * FROM ${quoteIdentifier(this.table)}${where} ORDER BY ${quoteIdentifier("created_at")} ${direction}${limit}`)
      .all(...values);
    return rows.map((row) => this.decodeRecord(row));
  }

  /** 根据 ID 合并更新字段。 */
  async update(id: string, patch: Partial<T>): Promise<void> {
    this.assertConfigured("update");
    const fieldKeys = new Set<string>(this.fields.map((field) => field.key as string));
    // 防御性修复：过滤掉 schema 中不存在的字段，避免调用方误传（如旧版 typeScript
    // 字段、迁移期遗留字段）触发 SQLite "no such column: <name>" 错误。
    const entries: [string, unknown][] = [];
    for (const [key, value] of Object.entries(patch as Record<string, unknown>)) {
      if (value === undefined) continue;
      if (!fieldKeys.has(key)) continue;
      entries.push([key, value]);
    }
    if (entries.length === 0) return;
    const sets = entries.map(([key]) => `${quoteIdentifier(key)} = ?`).join(", ");
    const values = entries.map(([key, value]) => encodeFilterValue(this.fields, key, value));
    this.database.prepare(`UPDATE ${quoteIdentifier(this.table)} SET ${sets} WHERE ${quoteIdentifier("id")} = ?`).run(...values, id);
  }

  /** 根据 ID 删除记录。 */
  async delete(id: string): Promise<void> {
    this.assertConfigured("delete");
    this.database.prepare(`DELETE FROM ${quoteIdentifier(this.table)} WHERE ${quoteIdentifier("id")} = ?`).run(id);
  }

  /** 统计满足条件的记录数量。 */
  async count(filter: Partial<T> = {}): Promise<number> {
    if (!this.isConfigured) return 0;
    const records = await this.findMany(filter);
    return records.length;
  }

  /**
   * 按 JSON 字段中的某个 key 等值匹配（如 `meta.taskId`）。
   * 仅支持顶层的 JSON 字段（必须是 fields 里 type==="json" 的列），
   * 内部用 SQLite 的 json_extract 函数；走 prepared statement，无 SQL 注入风险。
   * 主要用于历史 video task 没有 message_id 时，回退查找"视频生成中…"占位消息。
   */
  async findOneByJsonPath<K extends keyof T & string>(
    jsonField: K,
    jsonKey: string,
    value: string,
  ): Promise<T | null> {
    if (!this.isConfigured) return null;
    const field = this.fields.find((item) => item.key === jsonField);
    if (!field || field.type !== "json") {
      throw new Error(`[${this.table}] findOneByJsonPath requires a json field, got ${String(field?.type)}`);
    }
    const row = this.database
      .prepare(
        `SELECT * FROM ${quoteIdentifier(this.table)}
         WHERE json_extract(${quoteIdentifier(jsonField)}, ?) = ?
         LIMIT 1`,
      )
      .get(`$.${jsonKey}`, value);
    return row ? this.decodeRecord(row as Record<string, unknown>) : null;
  }

  /** 按字段定义把 SQLite 行转换成业务对象。 */
  private decodeRecord(row: Record<string, unknown>): T {
    const record: Record<string, unknown> = {};
    for (const field of this.fields) {
      record[field.key] = decodeValue(field.type as FieldType, row[field.key]);
    }
    return jsonClone(record) as T;
  }
}

/** SQLite 版本的设置仓储，把整份设置作为一条 JSON 记录保存。 */
export class SqliteSettingsRepository<T> implements KeyValueRepository<T> {
  private readonly database: DatabaseSync;
  private readonly defaults: T;

  /** 使用 SQLite 保存单条应用设置，key 固定为 app。 */
  constructor(databaseFile: string, defaults: T) {
    this.database = openDatabase(databaseFile);
    this.defaults = defaults;
    this.database.exec("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL)");
  }

  /** 读取应用设置，不存在时返回默认值副本。 */
  async get(): Promise<T> {
    const row = this.database.prepare("SELECT value FROM settings WHERE key = ?").get("app");
    if (!row || typeof row.value !== "string") return jsonClone(this.defaults);
    return revealSensitiveJson(JSON.parse(row.value)) as T;
  }

  /** 保存应用设置并返回保存后的副本。 */
  async set(settings: T): Promise<T> {
    this.database
      .prepare("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at")
      .run("app", JSON.stringify(protectSensitiveJson(settings)), new Date().toISOString());
    return jsonClone(settings);
  }
}
