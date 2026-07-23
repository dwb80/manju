export type ConditionExpr =
  | { op: ">=" | "<=" | ">" | "<" | "==" | "!="; left: string; right: unknown }
  | { op: "in" | "not_in"; left: string; right: unknown[] }
  | { op: "exists" | "not_exists" | "truthy" | "falsy"; left: string }
  | { all: ConditionExpr[] }
  | { any: ConditionExpr[] }
  | { not: ConditionExpr }
  | null
  | undefined;

const SIMPLE_OPS_WITH_RIGHT = new Set([">=", "<=", ">", "<", "==", "!="]);
const ARRAY_OPS = new Set(["in", "not_in"]);
const UNARY_OPS = new Set(["exists", "not_exists", "truthy", "falsy"]);

export function isValidCondition(cond: unknown): boolean {
  if (cond == null || typeof cond !== "object" || Array.isArray(cond)) return false;
  const obj = cond as Record<string, unknown>;
  if (Array.isArray(obj.all)) return obj.all.length > 0 && obj.all.every(isValidCondition);
  if (Array.isArray(obj.any)) {
    return obj.all === undefined && obj.any.length > 0 && obj.any.every(isValidCondition);
  }
  if (obj.not !== undefined && obj.op === undefined) return isValidCondition(obj.not);
  if (typeof obj.op !== "string") return false;
  if (SIMPLE_OPS_WITH_RIGHT.has(obj.op)) {
    return typeof obj.left === "string" && obj.left.length > 0 && obj.right !== undefined;
  }
  if (ARRAY_OPS.has(obj.op)) {
    return typeof obj.left === "string" && obj.left.length > 0 && Array.isArray(obj.right);
  }
  return UNARY_OPS.has(obj.op) && typeof obj.left === "string" && obj.left.length > 0;
}

export function resolvePath(node: Record<string, unknown>, path: string): unknown {
  if (!path.startsWith("$.")) return undefined;
  const expr = path.slice(2);
  if (!expr) return undefined;
  const mapped = expr.startsWith("output.") ? `output_data.${expr.slice("output.".length)}` : expr;
  const parts = mapped.replace(/\[(\d+)\]/g, ".$1").split(".").filter(Boolean);
  let cursor: unknown = node;
  for (const part of parts) {
    if (cursor == null || typeof cursor !== "object") return undefined;
    cursor = (cursor as Record<string, unknown>)[part];
  }
  return cursor;
}

export function evaluateCondition(cond: ConditionExpr, node: Record<string, unknown>): boolean {
  if (cond == null) return true;
  if (!isValidCondition(cond)) return false;
  if ("all" in cond) return cond.all.every((item) => evaluateCondition(item, node));
  if ("any" in cond) return cond.any.some((item) => evaluateCondition(item, node));
  if ("not" in cond) return !evaluateCondition(cond.not, node);
  const value = resolvePath(node, cond.left);
  switch (cond.op) {
    case ">=": return Number(value) >= Number(cond.right);
    case "<=": return Number(value) <= Number(cond.right);
    case ">": return Number(value) > Number(cond.right);
    case "<": return Number(value) < Number(cond.right);
    case "==": return value === cond.right;
    case "!=": return value !== cond.right;
    case "in": return cond.right.includes(value);
    case "not_in": return !cond.right.includes(value);
    case "exists": return value !== undefined && value !== null;
    case "not_exists": return value === undefined || value === null;
    case "truthy": return Boolean(value);
    case "falsy": return !value;
  }
}

export const __condition = { isValidCondition, evaluateCondition, resolvePath };
