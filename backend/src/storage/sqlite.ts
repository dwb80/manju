import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { jsonClone } from "../utils.js";
import type { FieldSpec, FieldType, KeyValueRepository, QueryOptions, Repository } from "./repository.js";

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

/** 打开并复用同一个 SQLite 数据库连接，避免每次请求都重新建连接。 */
function openDatabase(file: string): DatabaseSync {
  const absolute = path.resolve(file);
  const existing = databasePool.get(absolute);
  if (existing) return existing;
  mkdirSync(path.dirname(absolute), { recursive: true });
  const database = new sqlite.DatabaseSync(absolute);
  database.exec("PRAGMA journal_mode = WAL");
  database.exec("PRAGMA synchronous = NORMAL");
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

/** SQLite 标识符只允许代码内声明的表名和字段名进入，这里做一次双引号转义。 */
function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

/** JSON 字段写入字符串，其他字段按原始值写入。 */
function encodeValue(type: FieldType, value: unknown): unknown {
  if (value === undefined || value === null) return "";
  if (type === "json") return JSON.stringify(value ?? null);
  if (type === "boolean") return value ? 1 : 0;
  return value;
}

/** 从 SQLite 行还原业务对象，保持业务字段类型。 */
function decodeValue(type: FieldType, value: unknown): unknown {
  if (type === "number") return Number(value ?? 0);
  if (type === "boolean") return value === 1 || value === "1" || value === true || value === "true";
  if (type === "json") {
    if (typeof value !== "string" || value.length === 0) return null;
    return JSON.parse(value);
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
    const entries = Object.entries(patch).filter(([, value]) => value !== undefined);
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
    return JSON.parse(row.value) as T;
  }

  /** 保存应用设置并返回保存后的副本。 */
  async set(settings: T): Promise<T> {
    this.database
      .prepare("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at")
      .run("app", JSON.stringify(settings), new Date().toISOString());
    return jsonClone(settings);
  }
}
