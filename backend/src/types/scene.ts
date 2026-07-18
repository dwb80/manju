/**
 * @file scene.ts
 * @description 场景资产相关类型定义，包括场景实体、场景类型等
 */

/**
 * 场景类型
 * @property indoor - 室内场景
 * @property outdoor - 室外场景
 * @property virtual - 虚拟场景
 */
export type SceneType = 'indoor' | 'outdoor' | 'virtual';

/** 场景实体（独立模块） */
export interface Scene {
  id: string;
  project_id: string;
  /**
   * 来源剧本 id（可空），与 character.script_id 语义一致
   */
  script_id?: string;
  name: string;
  type: SceneType;
  description: string;
  image?: string;
  tags: string[];
  lighting?: string;
  time_of_day?: string;
  weather?: string;
  /** 资产被引用次数（缓存字段，由后端定期/按需计算） */
  usage_count?: number;
  /** 当前版本号（任务12：统一版本管理），每次 update 自增，初值为 1。 */
  version?: number;
  created_at: string;
  updated_at: string;
  /** 软删除时间戳；为空字符串或 undefined 时表示正常，未设置只读字段。 */
  deleted_at?: string;

  // === AI 剧本分析扩展字段（与 AIScene 对齐） ===
  /** 场景分类，如 古代街道、宫殿内室、战场 */
  category?: string;
  /** 室内/室外/混合 */
  indoor_outdoor?: string;
  /** 具体地点描述 */
  location?: string;
  /** 建筑风格 */
  architecture?: string;
  /** 地形特征 */
  terrain?: string;
  /** 植物描述 */
  plants?: string;
  /** 场景中物体描述 */
  objects?: string;
  /** 时代/时期 */
  period?: string;
  /** 氛围基调 */
  tone?: string;
  /** 视觉风格 */
  visual_style?: string;
  /** 氛围情绪 */
  atmosphere_emotion?: string;
  /** 适合镜头 JSON 数组字符串 */
  suitable_shots?: string;
  /** 可复用元素 JSON 数组字符串 */
  reusable_elements?: string;
  /** AI 生图标准化提示词 */
  generation_prompt?: string;
  /** 首次出现场次 */
  first_appearance?: string;
  /** 推断可信度：confirmed / inferred */
  confidence?: string;
  /**
   * 参考图 ID（指向 scene_images.id）。
   * 设为锁定后，前端生图时自动以该图为 img2img 参考，确保场景一致性。
   */
  reference_image_id?: string;
}
