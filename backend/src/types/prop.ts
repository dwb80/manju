/**
 * @file prop.ts
 * @description 道具资产相关类型定义，包括道具实体、道具分类等
 */

/**
 * 道具分类类型
 * @property weapon - 武器
 * @property tool - 工具
 * @property clothing - 服装
 * @property food - 食物
 * @property vehicle - 车辆
 * @property artifact - 神器
 * @property furniture - 家具
 * @property other - 其他
 */
export type PropCategory = 'weapon' | 'tool' | 'clothing' | 'food' | 'vehicle' | 'artifact' | 'furniture' | 'other';

/** 道具实体（独立模块） */
export interface Prop {
  id: string;
  project_id: string;
  /**
   * 来源剧本 id（可空），与 character.script_id 语义一致
   */
  script_id?: string;
  name: string;
  category: PropCategory;
  description: string;
  appearance?: string;
  material?: string;
  size?: string;
  color?: string;
  image?: string;
  tags: string[];
  /** 资产被引用次数（缓存字段，由后端定期/按需计算） */
  usage_count?: number;
  /** 当前版本号（任务12：统一版本管理），每次 update 自增，初值为 1。 */
  version?: number;
  created_at: string;
  updated_at: string;
  /** 软删除时间戳；为空字符串或 undefined 时表示正常，未设置只读字段。 */
  deleted_at?: string;

  // === AI 剧本分析扩展字段（与 AIProp 对齐） ===
  /** 重要性级别：核心道具 / 普通道具 / 背景道具 */
  importance_level?: string;
  /** 所属角色 */
  owner?: string;
  /** 形状 */
  shape?: string;
  /** 纹理 */
  texture?: string;
  /** 故事功能 */
  story_function?: string;
  /** 视觉特征 JSON 数组字符串 */
  visual_features?: string;
  /** 镜头使用 JSON 数组字符串 */
  camera_usage?: string;
  /** AI 生图标准化提示词 */
  generation_prompt?: string;
  /** 首次出现场次 */
  first_appearance?: string;
  /** 推断可信度：confirmed / inferred */
  confidence?: string;
}
