import { randomUUID } from "node:crypto";

export const DEFAULT_MODEL = "agnes-2.0-flash";

/** 返回当前时间的 ISO 字符串，用作记录创建和更新时间。 */
export function nowIso(): string {
  return new Date().toISOString();
}

/** 从 ISO 时间中截取日期部分，用来按天拆分 CSV 文件。 */
export function datePart(iso: string): string {
  return iso.slice(0, 10);
}

/** 生成带业务前缀的唯一 ID，例如 c-xxx、img-xxx。 */
export function id(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}

/** 粗略估算文本 token 数，用于本地记录和展示。 */
export function estimateTokens(text: string): number {
  const asciiWords = text.match(/[A-Za-z0-9_]+/g)?.length ?? 0;
  const cjkChars = text.match(/[\u4e00-\u9fff]/g)?.length ?? 0;
  return Math.max(1, asciiWords + Math.ceil(cjkChars / 2));
}

/** 校验接口入参必须是非空字符串，并返回去掉首尾空格后的值。 */
export function requireString(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${name} is required`);
  }
  return value.trim();
}

/** 把用户传入的数字限制在指定范围内，非法值则使用默认值。 */
export function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
}

/** 用 JSON 序列化做一次深拷贝，避免直接修改原始对象。 */
export function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
