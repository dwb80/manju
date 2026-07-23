/**
 * @file consistency-pack.ts
 * @description 一致性包（角色/场景/道具的多视角参考图集合），用于保证后续出图人物/风格一致。
 *
 * ## 5 状态机
 *  draft → pending_review → (approved | rejected) → locked
 *
 * ## 3 视图
 *  - reference_images：4 视角（full_front / full_side / full_back / half_body）
 *  - expressions：6 表情（neutral / happy / sad / angry / surprised / thinking）
 *  - angles：3 角度（eye_level / low_angle / high_angle）
 */
export type ConsistencyPackStatus = "draft" | "pending_review" | "approved" | "rejected" | "locked";
export type ConsistencyPackReferenceType = "full_front" | "full_side" | "full_back" | "half_body";
export type ConsistencyPackExpressionType = "neutral" | "happy" | "sad" | "angry" | "surprised" | "thinking";
export type ConsistencyPackAngleType = "eye_level" | "low_angle" | "high_angle";
export type ConsistencyPackImageType = ConsistencyPackReferenceType | ConsistencyPackExpressionType | ConsistencyPackAngleType;

export interface ConsistencyPack {
  id: string;
  project_id: string;
  entity_id: string;
  entity_type: "character" | "scene" | "prop";
  /** JSON 字符串：{ full_front: url, full_side: url, ... }。 */
  reference_images?: string;
  /** JSON 字符串：{ neutral: url, happy: url, ... }。 */
  expressions?: string;
  /** JSON 字符串：{ eye_level: url, low_angle: url, ... }。 */
  angles?: string;
  /** 文字描述：面部特征（瞳色、发型、疤痕等）。 */
  facial_features?: string;
  /** 文字描述：体型（瘦削、健壮、高矮等）。 */
  body_type?: string;
  /** 文字描述：人物空间关系（"女主在男主左侧"）。 */
  spatial_relation?: string;
  /** JSON 字符串：{ model_id, seed, size, negative_prompt }，让后续出图可复用参数。 */
  recommended_params?: string;
  status: ConsistencyPackStatus;
  version: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface ConsistencyPackImage {
  id: string;
  project_id: string;
  pack_id: string;
  image_type: string;
  url?: string;
  prompt?: string;
  negative_prompt?: string;
  model_id?: string;
  seed?: number;
  status: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface ConsistencyPackInput {
  project_id: string;
  entity_id: string;
  entity_type: "character" | "scene" | "prop";
  reference_images?: Record<ConsistencyPackReferenceType, string>;
  expressions?: Record<ConsistencyPackExpressionType, string>;
  angles?: Record<ConsistencyPackAngleType, string>;
  facial_features?: string;
  body_type?: string;
  spatial_relation?: string;
  recommended_params?: {
    model_id: string;
    seed: number;
    size: string;
    negative_prompt?: string;
  };
}
