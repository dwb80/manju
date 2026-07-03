import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { datePart, jsonClone } from "../utils.js";

type FieldType = "string" | "number" | "boolean" | "json";

export interface FieldSpec<T> {
  key: keyof T & string;
  type: FieldType;
}

export interface QueryOptions {
  limit?: number;
  sort?: "asc" | "desc";
}

/** 防止 Excel 打开 CSV 时把用户输入当公式执行。 */
function sanitizeCsvInjection(value: string): string {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

// CSV 文件可以被 Excel 打开。以 = + - @ 开头的单元格可能被当成公式执行，
// 所以写入前统一加单引号，并按 RFC 4180 规则转义双引号。
/** 把一个值编码成安全的 CSV 单元格文本。 */
export function encodeCsvCell(value: unknown): string {
  const raw = sanitizeCsvInjection(String(value ?? ""));
  return `"${raw.replaceAll('"', '""')}"`;
}

/** 解析一行 CSV，支持双引号包裹和双引号转义。 */
export function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

/** 把整个 CSV 文件内容解析成多行记录，支持单元格内换行。 */
export function parseCsvRecords(content: string): string[][] {
  const records: string[][] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const next = content[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += char;
      current += next;
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      current += char;
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      if (current.length > 0) records.push(parseCsvLine(current));
      current = "";
      continue;
    }

    current += char;
  }

  if (current.length > 0) records.push(parseCsvLine(current));
  return records;
}

/** 按字段定义把对象序列化成一行 CSV。 */
function stringifyRecord<T extends { created_at?: string }>(fields: FieldSpec<T>[], record: T): string {
  return fields.map((field) => {
    const value = record[field.key];
    return encodeCsvCell(field.type === "json" ? JSON.stringify(value ?? null) : value);
  }).join(",");
}

/** 按字段定义把 CSV 行还原成业务对象。 */
function parseRecord<T>(fields: FieldSpec<T>[], row: string[]): T {
  const record: Record<string, unknown> = {};
  fields.forEach((field, index) => {
    const raw = row[index] ?? "";
    if (field.type === "number") record[field.key] = Number(raw);
    if (field.type === "boolean") record[field.key] = raw === "true";
    if (field.type === "json") record[field.key] = raw ? JSON.parse(raw) : null;
    if (field.type === "string") record[field.key] = raw;
  });
  return record as T;
}

/** 判断一行是否像正常的消息记录，用于修复旧 CSV。 */
function looksLikeMessageRow(row: string[]): boolean {
  return row[0]?.startsWith("m-") && ["user", "assistant", "system"].includes(row[2] ?? "");
}

/** 清理旧版本拆坏的消息片段中混入的尾部字段。 */
function cleanupLegacyMessageFragment(fragment: string): string {
  return fragment
    .replace(/,\d+,\{model:[\s\S]*$/, "")
    .replace(/,\d+,\{\},\d{4}-\d{2}-\d{2}T[\s\S]*$/, "")
    .trimEnd();
}

/** 尝试把旧版本中被错误拆成多行的消息重新合并。 */
function repairLegacyMessageRows(rows: string[][]): string[][] {
  // 早期版本可能把多行消息拆坏，这里读取时尽量修复，避免老数据打不开。
  const repaired: string[][] = [];
  for (const row of rows) {
    if (looksLikeMessageRow(row)) {
      repaired.push([...row]);
      continue;
    }

    const previous = repaired[repaired.length - 1];
    if (!previous || row.every((cell) => cell === "")) continue;

    const fragment = cleanupLegacyMessageFragment(row[0] ?? "");
    if (!fragment) continue;
    previous[3] = `${previous[3] ?? ""}\n${fragment}`;
  }
  return repaired;
}

/** 判断一条记录是否满足查询过滤条件。 */
function matches<T>(record: T, filter: Partial<T>): boolean {
  return Object.entries(filter).every(([key, value]) => {
    if (value === undefined) return true;
    return JSON.stringify(record[key as keyof T]) === JSON.stringify(value);
  });
}

export class CsvRepository<T extends { id: string; created_at: string }> {
  private readonly dir: string;
  private readonly baseDir: string;
  private readonly entity: string;
  private readonly fields: FieldSpec<T>[];

  /** 初始化某个业务实体对应的 CSV 仓库。 */
  constructor(
    baseDir: string,
    entity: string,
    fields: FieldSpec<T>[],
  ) {
    this.baseDir = baseDir;
    this.entity = entity;
    this.fields = fields;
    this.dir = path.join(baseDir, entity);
  }

  /** 插入单条记录，会根据 created_at 写入对应日期文件。 */
  async insert(record: T): Promise<void> {
    await this.insertBatch([record]);
  }

  /** 批量插入记录，并按日期分组减少文件读写次数。 */
  async insertBatch(records: T[]): Promise<void> {
    const grouped = new Map<string, T[]>();
    records.forEach((record) => {
      const date = datePart(record.created_at);
      grouped.set(date, [...(grouped.get(date) ?? []), record]);
    });
    for (const [date, group] of grouped.entries()) {
      const existing = await this.readFile(date);
      await this.writeFile(date, [...existing, ...group]);
    }
  }

  /** 根据 ID 查找单条记录。 */
  async findById(id: string): Promise<T | null> {
    const records = await this.findMany({ id } as Partial<T>, { limit: 1 });
    return records[0] ?? null;
  }

  /** 根据过滤条件查找第一条记录。 */
  async findOne(filter: Partial<T>): Promise<T | null> {
    const records = await this.findMany(filter, { limit: 1 });
    return records[0] ?? null;
  }

  /** 跨日期文件查找多条记录，并支持排序和数量限制。 */
  async findMany(filter: Partial<T> = {}, options: QueryOptions = {}): Promise<T[]> {
    const dates = await this.listDates();
    const orderedDates = options.sort === "asc" ? dates : dates.reverse();
    const found: T[] = [];
    for (const date of orderedDates) {
      const rows = await this.readFile(date);
      const orderedRows = options.sort === "asc" ? rows : rows.reverse();
      for (const row of orderedRows) {
        if (matches(row, filter)) {
          found.push(jsonClone(row));
          if (options.limit && found.length >= options.limit) return found;
        }
      }
    }
    return found;
  }

  /** 根据 ID 找到记录所在日期文件，并合并更新字段。 */
  async update(id: string, patch: Partial<T>): Promise<void> {
    const dates = await this.listDates();
    for (const date of dates) {
      const rows = await this.readFile(date);
      const index = rows.findIndex((row) => row.id === id);
      if (index >= 0) {
        rows[index] = { ...rows[index], ...patch };
        await this.writeFile(date, rows);
        return;
      }
    }
    throw new Error("resource not found");
  }

  /** 根据 ID 删除记录，如果不存在则直接结束。 */
  async delete(id: string): Promise<void> {
    const dates = await this.listDates();
    for (const date of dates) {
      const rows = await this.readFile(date);
      const nextRows = rows.filter((row) => row.id !== id);
      if (nextRows.length !== rows.length) {
        await this.writeFile(date, nextRows);
        return;
      }
    }
  }

  /** 统计满足过滤条件的记录数量。 */
  async count(filter: Partial<T> = {}): Promise<number> {
    return (await this.findMany(filter)).length;
  }

  /** 生成某一天对应的 CSV 文件路径。 */
  private filePath(date: string): string {
    return path.join(this.dir, `${this.entity}_${date}.csv`);
  }

  /** 扫描实体目录，找出已有 CSV 文件对应的日期。 */
  private async listDates(): Promise<string[]> {
    await mkdir(this.dir, { recursive: true });
    const files = await readdir(this.dir);
    return files
      .filter((file) => file.startsWith(`${this.entity}_`) && file.endsWith(".csv"))
      .map((file) => file.replace(`${this.entity}_`, "").replace(".csv", ""))
      .sort();
  }

  /** 读取某一天的 CSV 文件，并转换成业务对象列表。 */
  private async readFile(date: string): Promise<T[]> {
    const file = this.filePath(date);
    try {
      const content = await readFile(file, "utf8");
      const rows = parseCsvRecords(content);
      if (rows.length <= 1) return [];
      const hasMessageSchema = ["id", "conversation_id", "role", "content"].every((key) => this.fields.some((field) => field.key === key));
      const bodyRows = this.entity === "messages" && hasMessageSchema ? repairLegacyMessageRows(rows.slice(1)) : rows.slice(1);
      return bodyRows.map((row) => parseRecord(this.fields, row));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  /** 把某一天的记录完整写回 CSV，使用临时文件降低写坏风险。 */
  private async writeFile(date: string, records: T[]): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    const header = this.fields.map((field) => field.key).join(",");
    const body = records.map((record) => stringifyRecord(this.fields, record));
    const payload = `${[header, ...body].join("\n")}\n`;
    const file = this.filePath(date);
    const temp = `${file}.${process.pid}.tmp`;
    await writeFile(temp, payload, "utf8");
    await rename(temp, file);
  }
}

export class SettingsRepository<T> {
  private readonly file: string;
  private readonly baseDir: string;
  private readonly defaults: T;

  /** 初始化设置仓库，并保存默认设置。 */
  constructor(baseDir: string, defaults: T) {
    this.baseDir = baseDir;
    this.defaults = defaults;
    this.file = path.join(baseDir, "settings", "settings.csv");
  }

  /** 读取设置文件，不存在时返回默认设置副本。 */
  async get(): Promise<T> {
    try {
      const content = await readFile(this.file, "utf8");
      const rows = content.split(/\r?\n/).filter(Boolean);
      if (rows.length < 2) return jsonClone(this.defaults);
      return JSON.parse(parseCsvLine(rows[1])[0]) as T;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return jsonClone(this.defaults);
      throw error;
    }
  }

  /** 保存设置到 CSV，并返回保存后的设置副本。 */
  async set(settings: T): Promise<T> {
    await mkdir(path.dirname(this.file), { recursive: true });
    const payload = `config,updated_at\n${encodeCsvCell(JSON.stringify(settings))},${encodeCsvCell(new Date().toISOString())}\n`;
    const temp = `${this.file}.${process.pid}.tmp`;
    await writeFile(temp, payload, "utf8");
    await rename(temp, this.file);
    return jsonClone(settings);
  }
}
