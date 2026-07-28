/**
 * @file consistency-pack-history-bridge.ts
 * @description S4.2 A↔B 双向导通核心：把 consistency_pack_images 的 image_type 映射到
 *              *_image_history 的 (shot_type, angle, view_type)，并提供：
 *              1) A→B：generate 时优先从 history 复用
 *              2) B→A：approved 时把一致性包图导入 history（is_applied=1）
 *              3) 主图策略：approved 时第一张自动设为该实体主图（is_primary=1）
 *
 * 三厂同构：本文件只关心"image_type ↔ 三维"映射规则；不关心是 character / scene / prop。
 * 调用方（router / service）按 entityType 选对应 helper（findReusableCharacterImage / findReusableSceneImage / findReusablePropImage）。
 *
 * 单一真相源：本文件的 imageTypeToCriteria 是 image_type → (shot_type, angle, view_type) 的唯一映射。
 * 任何其他文件不要复制第二份。
 */

import type { CharacterImageHistory, PropImageHistory, SceneImageHistory } from "../types/character-image-history.js";

// 注：上面 3 个 type import 在本文件中未直接使用（由 importable record 推断形状即可）。
// 保留它们以便未来扩展时直接引用。

/**
 * image_type → (shot_type, angle, view_type) 映射。
 *
 * 设计原则：
 * - 角色包 13 个：4 视角 + 6 表情 + 3 角度
 *   - full_front / full_side / full_back → shot_type=`full`, angle=front|side|back, view_type=`costume`
 *   - half_body → shot_type=`bust`, angle=`front`, view_type=`costume`
 *   - neutral/happy/sad/angry/surprised/thinking → shot_type=`medium_close`, angle=`front`, view_type=`expression`
 *   - eye_level / low_angle / high_angle → shot_type=`medium`, angle=eye_level|low_angle|high_angle, view_type=`costume`
 * - 场景包 7 个：4 视角 + 3 角度（无表情）
 *   - 视角同角色，view_type=`overall`（场景没有 costume）
 *   - 角度：shot_type=`medium`, angle 同角色，view_type=`overall`
 * - 道具包 7 个：4 视角 + 3 角度（无表情）
 *   - 视角同角色，view_type=`single`
 *   - 角度：shot_type=`medium`, angle 同角色，view_type=`single`
 *
 * 说明：eye_level / low_angle / high_angle 在 history 维度里也用同名（与 `angle` 枚举值的 bird 区分；这里允许 shot_type 复用部分 angle 值）
 * - 在 db 列 `angle` 中存 `eye_level / low_angle / high_angle` 是历史 schema 允许的（type: TEXT，nullable），
 *   只在 application 层的 imageTypeToCriteria 这一个函数里完成映射。
 * - 业务查询时仍走"等值匹配"，不会和 front/side/back 冲突。
 */
/**
 * view_type 候选值（不限枚举字符串，便于未来扩展细分，如 `expression:angry`）：
 * - costume / expression / scene_fit / overall / detail / transition / single / multi_angle / usage
 * - 加上 `expression:<name>` 细分（如 `expression:angry`），保证 1 行 history 只命中 1 个 imageType
 *
 * 注：业务上 view_type 列存任意细分字符串；上面这些是规范值。
 */
export type HistoryViewType =
  | "costume" | "expression" | "scene_fit"
  | "overall" | "detail" | "transition"
  | "single" | "multi_angle" | "usage"
  | `expression:${string}`;

export interface ImageTypeCriteria {
  shot_type: string | null;
  angle: string | null;
  view_type: HistoryViewType | null;
}

const CHARACTER_TYPE_TO_CRITERIA: Record<string, ImageTypeCriteria> = {
  // 4 视角：景别 full + 角度 front/side/back + 视图 costume
  full_front:   { shot_type: "full", angle: "front", view_type: "costume" },
  full_side:    { shot_type: "full", angle: "side",  view_type: "costume" },
  full_back:    { shot_type: "full", angle: "back",  view_type: "costume" },
  half_body:    { shot_type: "bust", angle: "front", view_type: "costume" },
  // 6 表情：景别 medium_close + 角度 front + 视图 各自细分（避免 6 个 expression 互相错配）
  // view_type 用 `expression:<name>` 形式保留视图大类前缀，history 一行只命中 1 个 imageType
  neutral:      { shot_type: "medium_close", angle: "front", view_type: "expression:neutral"   },
  happy:        { shot_type: "medium_close", angle: "front", view_type: "expression:happy"     },
  sad:          { shot_type: "medium_close", angle: "front", view_type: "expression:sad"       },
  angry:        { shot_type: "medium_close", angle: "front", view_type: "expression:angry"     },
  surprised:    { shot_type: "medium_close", angle: "front", view_type: "expression:surprised" },
  thinking:     { shot_type: "medium_close", angle: "front", view_type: "expression:thinking"  },
  // 3 角度：景别 medium + 角度 eye_level/low_angle/high_angle + 视图 costume
  eye_level:    { shot_type: "medium", angle: "eye_level",   view_type: "costume" },
  low_angle:    { shot_type: "medium", angle: "low_angle",   view_type: "costume" },
  high_angle:   { shot_type: "medium", angle: "high_angle",  view_type: "costume" },
};

const SCENE_TYPE_TO_CRITERIA: Record<string, ImageTypeCriteria> = {
  // 4 视角：景别 full + 角度 front/side/back + 视图 overall
  full_front:   { shot_type: "full", angle: "front", view_type: "overall" },
  full_side:    { shot_type: "full", angle: "side",  view_type: "overall" },
  full_back:    { shot_type: "full", angle: "back",  view_type: "overall" },
  half_body:    { shot_type: "bust", angle: "front", view_type: "detail" },
  // 3 角度：景别 medium + 角度 eye_level/low_angle/high_angle + 视图 overall
  eye_level:    { shot_type: "medium", angle: "eye_level",   view_type: "overall" },
  low_angle:    { shot_type: "medium", angle: "low_angle",   view_type: "overall" },
  high_angle:   { shot_type: "medium", angle: "high_angle",  view_type: "overall" },
};

const PROP_TYPE_TO_CRITERIA: Record<string, ImageTypeCriteria> = {
  // 4 视角：景别 full + 角度 front/side/back + 视图 single
  full_front:   { shot_type: "full", angle: "front", view_type: "single" },
  full_side:    { shot_type: "full", angle: "side",  view_type: "single" },
  full_back:    { shot_type: "full", angle: "back",  view_type: "single" },
  half_body:    { shot_type: "bust", angle: "front", view_type: "detail" },
  // 3 角度：景别 medium + 角度 eye_level/low_angle/high_angle + 视图 single
  eye_level:    { shot_type: "medium", angle: "eye_level",   view_type: "single" },
  low_angle:    { shot_type: "medium", angle: "low_angle",   view_type: "single" },
  high_angle:   { shot_type: "medium", angle: "high_angle",  view_type: "single" },
};

/**
 * 把 consistency_pack_images.image_type 翻译为 history 的三维条件。
 *
 * @param entityType 哪个工厂（character/scene/prop）
 * @param imageType 一致性包里的 image_type 字符串
 * @returns 三维条件；image_type 不在已知表中返回 null（调用方按"无匹配"处理）
 */
export function imageTypeToCriteria(
  entityType: "character" | "scene" | "prop",
  imageType: string,
): ImageTypeCriteria | null {
  if (entityType === "character") return CHARACTER_TYPE_TO_CRITERIA[imageType] ?? null;
  if (entityType === "scene")     return SCENE_TYPE_TO_CRITERIA[imageType] ?? null;
  if (entityType === "prop")      return PROP_TYPE_TO_CRITERIA[imageType] ?? null;
  return null;
}

/**
 * 一次性返回某 entityType 的所有 (imageType, criteria) 列表；用于 generate 阶段遍历。
 * 顺序与 router 里的 TYPES[entityType] 一致（保证 13 / 7 / 7 张图按预期顺序生成）。
 */
export function listCriteriaByEntityType(
  entityType: "character" | "scene" | "prop",
  imageTypes: string[],
): Array<{ imageType: string; criteria: ImageTypeCriteria | null }> {
  return imageTypes.map((imageType) => ({ imageType, criteria: imageTypeToCriteria(entityType, imageType) }));
}

// ============================================================
// B → A：把一致性包图导入 history
// ============================================================

export interface ImportableHistoryRecord {
  url: string;
  ratio: string;
  model: string;
  size: string;
  prompt: string;
  negative_prompt?: string;
  response_format: string;
  n: number;
  shot_type: string | null;
  angle: string | null;
  view_type: string | null;
}

/**
 * 给定 image_type 与该张图的元数据，返回"应写入 history 的 record 字段"。
 * 调用方负责拼 entity_id / project_id / id / created_at。
 */
export function buildHistoryRecordFromPackImage(
  entityType: "character" | "scene" | "prop",
  imageType: string,
  meta: {
    url: string;
    ratio: string;
    model: string;
    size: string;
    prompt: string;
    negative_prompt?: string;
    response_format: string;
    n: number;
  },
): ImportableHistoryRecord | null {
  const criteria = imageTypeToCriteria(entityType, imageType);
  if (!criteria) return null;
  return {
    url: meta.url,
    ratio: meta.ratio,
    model: meta.model,
    size: meta.size,
    prompt: meta.prompt,
    negative_prompt: meta.negative_prompt ?? "",
    response_format: meta.response_format,
    n: meta.n,
    shot_type: criteria.shot_type,
    angle: criteria.angle,
    view_type: criteria.view_type,
  };
}

/**
 * type guard：把 imported record 收敛为 3 厂对应的 image history 类型。
 * 仅用于测试；service 层调用方应直接用对应 service 的 append 接口。
 *
 * 这里不做 TypeScript 类型收缩（会让 importable record 的 string|undefined 与目标类型不兼容）；
 * 调用方对返回 record 加 `as` 即可。真正的形状校验由 SqliteRepository insert 阶段完成。
 */
export function validateImportableRecord(rec: ImportableHistoryRecord): void {
  if (typeof rec.url !== "string" || !rec.url) throw new Error("url must be non-empty string");
  if (typeof rec.model !== "string" || !rec.model) throw new Error("model must be non-empty string");
}
