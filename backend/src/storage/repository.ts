/**
 * @file repository.ts
 * @description 仓储层接口与类型定义。
 *              定义 Repository / KeyValueRepository 契约，以及 FieldType / FieldSpec / QueryOptions 类型。
 *              所有持久化实现（如 SqliteRepository）都遵循这套接口。
 */

/** SQLite 字段类型；统一为 4 种以便在 SQL 层用 TEXT/INTEGER 存储。 */
export type FieldType = "string" | "number" | "boolean" | "json";

/** 业务字段定义，描述一个字段在数据库中的列类型。 */
export interface FieldSpec<T> {
  key: keyof T & string;
  type: FieldType;
}

/** 查询选项，用于控制返回结果的排序和数量。 */
export interface QueryOptions {
  /** 最多返回多少条记录，常用于分页或只取第一条。 */
  limit?: number;
  /** 按 created_at 排序的方向，默认由具体仓储实现决定。 */
  sort?: "asc" | "desc";
}

/** 业务数据仓储的统一契约，所有持久化实现（SQLite）都按这套方法工作。 */
export interface Repository<T extends { id: string; created_at: string }> {
  /** 新增一条业务记录。 */
  insert(record: T): Promise<void>;
  /** 批量新增记录，适合剧本拆分成多个分镜时一次写入。 */
  insertBatch(records: T[]): Promise<void>;
  /** 根据主键 ID 查找记录。 */
  findById(id: string): Promise<T | null>;
  /** 按字段等值筛选并返回第一条记录。 */
  findOne(filter: Partial<T>): Promise<T | null>;
  /** 按字段等值筛选记录列表，可附带排序和数量限制。 */
  findMany(filter?: Partial<T>, options?: QueryOptions): Promise<T[]>;
  /** 根据主键 ID 局部更新记录。 */
  update(id: string, patch: Partial<T>): Promise<void>;
  /** 根据主键 ID 删除记录。 */
  delete(id: string): Promise<void>;
  /** 统计满足筛选条件的记录数量。 */
  count(filter?: Partial<T>): Promise<number>;
  /**
   * 按 JSON 字段中的某个 key 等值匹配（如 `meta.taskId`）。
   * 用于 schema 里 type==="json" 的顶层字段（Prepared statement，无注入风险）。
   * 历史数据回填场景：旧记录没有外键字段时用它回查关联消息。
   */
  findOneByJsonPath<K extends keyof T & string>(jsonField: K, jsonKey: string, value: string): Promise<T | null>;
}

/** 单条应用设置的读写契约，用来保存主题、默认模型等全局配置。 */
export interface KeyValueRepository<T> {
  /** 读取当前设置，不存在时由实现返回默认值。 */
  get(): Promise<T>;
  /** 保存设置并返回保存后的值。 */
  set(settings: T): Promise<T>;
}
