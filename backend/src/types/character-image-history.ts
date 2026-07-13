/**
 * 角色图片生成历史
 *
 * 用于：
 * 1) "历史图片"——每次 AI 生成的图片（不管是否被设为角色资产）；
 * 2) "已选资产历史"——所有曾被「设为角色资产」的图（即使被新图覆盖也保留）。
 *
 * 设计要点：
 * - 单表设计：history / assetHistory 在 UI 上是两个区块，但后端用同一张表 + is_applied 区分；
 *   前端 GET 全量后本地按 is_applied 过滤，避免拆两张表带来的「取消应用」状态丢失。
 * - 自动裁剪：append 时按 character_id 计数，超过 MAX(20) 就删最老的。
 * - URL 唯一：同一 character 下同一 url 只能存在一条（按 url 重复点「设为角色资产」会被 dedup）。
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
