/**
 * @file rejection-reason.value-object.ts
 * @description 驳回原因值对象。驳回必须携带合法原因，原因码由本值对象统一校验。
 *
 * 设计要点：
 *  - 值对象不可变，构造时校验；非法原因码直接抛错。
 *  - 11 种原因码与前端下拉框对齐（原 review-service.ts 的 REJECTION_REASONS）。
 *  - 聚合通过 RejectionReason.create(code) 持有原因，禁止裸字符串绕过校验。
 */

/** 驳回原因码（与 types/horizontal.ts RejectionReasonCode 对齐）。 */
export type RejectionReasonCode =
  | "character_inconsistent"
  | "costume_wrong"
  | "proportion_off"
  | "lighting_unreasonable"
  | "sensitive_content"
  | "dialogue_error"
  | "visual_error"
  | "asset_error"
  | "plot_mismatch"
  | "shot_issue"
  | "other";

/** 前端下拉框用 label 映射。 */
export const REJECTION_REASONS: ReadonlyArray<{
  readonly code: RejectionReasonCode;
  readonly label: string;
}> = [
  { code: "character_inconsistent", label: "人设偏离" },
  { code: "costume_wrong", label: "服装错" },
  { code: "proportion_off", label: "比例失真" },
  { code: "lighting_unreasonable", label: "光影不合理" },
  { code: "sensitive_content", label: "敏感内容" },
  { code: "dialogue_error", label: "对白错误" },
  { code: "visual_error", label: "画面错误" },
  { code: "asset_error", label: "资产错误" },
  { code: "plot_mismatch", label: "剧情不符" },
  { code: "shot_issue", label: "镜头问题" },
  { code: "other", label: "其他" },
];

const REASON_CODE_SET: ReadonlySet<string> = new Set(
  REJECTION_REASONS.map((r) => r.code),
);

/** 获取原因码的中文 label；未知码回退为码本身。 */
export function rejectionReasonLabel(code: RejectionReasonCode | string): string {
  for (const r of REJECTION_REASONS) {
    if (r.code === code) return r.label;
  }
  return String(code);
}

/** 不可变驳回原因值对象。 */
export class RejectionReason {
  private constructor(
    readonly code: RejectionReasonCode,
    readonly label: string,
  ) {}

  /** 校验并构造；非法码抛 TypeError。 */
  static create(code: unknown): RejectionReason {
    if (typeof code !== "string" || !REASON_CODE_SET.has(code)) {
      throw new TypeError(`invalid_rejection_reason: ${String(code)}`);
    }
    return new RejectionReason(code as RejectionReasonCode, rejectionReasonLabel(code));
  }

  /** 是否与给定码相等。 */
  equals(other: RejectionReason | string): boolean {
    if (typeof other === "string") return this.code === other;
    return this.code === other.code;
  }

  toJSON(): RejectionReasonCode {
    return this.code;
  }
}
