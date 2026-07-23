/**
 * @file pipeline-idempotency.ts
 * @description Pipeline 节点幂等键计算工具。
 *
 * 规则：节点类型 + 项目 ID + 归一化后的 input + config → sha256 前 16 位 + 类型首字母
 * wait / delay 节点返回空串（无业务计算结果，无复用价值）。
 */
import { createHash } from "node:crypto";

/** 参与幂等键的输入字段白名单（REQ-PIPE-002-04）。 */
const IDEMPOTENT_INPUT_KEYS = new Set([
  "prompt",
  "negative_prompt",
  "negative",
  "model",
  "size",
  "ratio",
  "n",
  "seed",
  "duration",
  "duration_seconds",
  "durationMs",
  "voice",
  "format",
  "speed",
  "text",
  "image_url",
  "image_urls",
  "images",
  "mode",
  "num_frames",
  "frame_rate",
  "fps",
  "width",
  "height",
  "template_id",
  "bgm_id",
  "sfx_id",
]);

/** 递归筛选白名单字段，避免输入抖动。 */
function pickIdempotentFields(value: unknown, prefix = ""): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map((item) => pickIdempotentFields(item, prefix));
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${k}` : k;
      if (IDEMPOTENT_INPUT_KEYS.has(k) || IDEMPOTENT_INPUT_KEYS.has(path)) {
        out[k] = pickIdempotentFields(v, path);
      }
    }
    return out;
  }
  return value;
}

/** 稳定 JSON 序列化：键名按字典序排序，相同输入永远产出相同字符串。 */
export function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return JSON.stringify(value);
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return "[" + value.map(stableStringify).join(",") + "]";
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return (
    "{" +
    keys
      .map((k) => JSON.stringify(k) + ":" + stableStringify(obj[k]))
      .join(",") +
    "}"
  );
}

/**
 * 计算节点幂等键。
 * 规则：节点类型 + 项目 ID + 归一化后的 input + config → sha256 前 16 位 + 类型首字母
 * wait / delay 节点返回空串（无业务计算结果，无复用价值）。
 */
export function computeNodeIdempotencyKey(input: {
  type: string;
  project_id: string;
  input_data: Record<string, unknown>;
  config: Record<string, unknown>;
}): string {
  const { type, project_id, input_data, config } = input;
  if (type === "wait" || type === "delay") return "";
  const pickedInput = pickIdempotentFields(input_data);
  const pickedConfig = pickIdempotentFields(config);
  const stable = stableStringify({
    t: type,
    p: project_id,
    i: pickedInput,
    c: pickedConfig,
  });
  const hash = createHash("sha256").update(stable).digest("hex").slice(0, 16);
  const typeChar = (type[0] ?? "x").toLowerCase();
  return `${typeChar}:${hash}`;
}
