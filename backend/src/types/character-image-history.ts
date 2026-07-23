/**
 * @file character-image-history.ts
 * @description 角色图片生成历史类型定义，用于记录AI生成的图片和已选资产历史
 */

/**
 * 角色图片生成历史实体
 *
 * 用于：
 * 1) "历史图片"——每次 AI 生成的图片（不管是否被设为角色资产）；
 * 2) "已选资产历史"——所有曾被「设为角色资产」的图（即使被新图覆盖也保留）。
 */
export interface CharacterImageHistory {
  id: string;
  character_id: string;
  project_id: string;
  url: string;
  /** 生图时提交的比例（9:16 / 16:9 等），用于右侧卡片正确还原预览比例。 */
  ratio: string;
  model: string;
  size: string;
  prompt: string;
  negative_prompt?: string;
  response_format: string;
  /** 当次生成的数量（用于历史卡片显示「1张/2张」）。 */
  n: number;
  /**
   * 是否曾被「设为角色资产」。
   * - true 后不再变 false（即便后续被新图覆盖、移除角色资产），保证「已选资产历史」不会丢。
   * - 显式从历史里删除该条记录才会真正消失。
   */
  is_applied: boolean;
  /** 最后一次被设为角色资产的时间（ISO）。未应用则为空字符串。 */
  applied_at: string;
  created_at: string;
}

/**
 * 道具图片生成历史实体（结构同 CharacterImageHistory，主体字段指向 prop_id）
 */
export interface PropImageHistory {
  id: string;
  prop_id: string;
  project_id: string;
  url: string;
  ratio: string;
  model: string;
  size: string;
  prompt: string;
  negative_prompt?: string;
  response_format: string;
  n: number;
  is_applied: boolean;
  applied_at: string;
  created_at: string;
}

/**
 * 场景图片生成历史实体（结构同 CharacterImageHistory，主体字段指向 scene_id）
 */
export interface SceneImageHistory {
  id: string;
  scene_id: string;
  project_id: string;
  url: string;
  ratio: string;
  model: string;
  size: string;
  prompt: string;
  negative_prompt?: string;
  response_format: string;
  n: number;
  is_applied: boolean;
  applied_at: string;
  created_at: string;
}
