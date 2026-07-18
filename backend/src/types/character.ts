/**
 * @file character.ts
 * @description 角色资产相关类型定义，包括角色实体、角色类型、角色性别等
 */

/**
 * 角色类型
 * @property protagonist - 主角
 * @property supporting - 配角
 * @property antagonist - 反派
 * @property minor - 次要角色
 */
export type CharacterRole = 'protagonist' | 'supporting' | 'antagonist' | 'minor';

/**
 * 角色性别类型
 * @property male - 男性
 * @property female - 女性
 * @property other - 其他
 */
export type CharacterGender = 'male' | 'female' | 'other';

/** 角色实体（独立模块） */
export interface Character {
  id: string;
  project_id: string;
  /**
   * 来源剧本 id（可空）
   * - 工厂侧新建时，标记"该资产最先是从哪个剧本 AI 提取出来的"
   * - 跨剧本复用的资产保留原始 script_id，不随引用而改变
   */
  script_id?: string;
  name: string;
  role: CharacterRole;
  gender?: CharacterGender;
  age?: number;
  traits: string[];
  description: string;
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

  // === AI 剧本分析扩展字段 ===
  /** 角色身份，如 剑客、公主、侦探 */
  identity?: string;
  /** 面部特征 */
  face?: string;
  /** 发型、发色、长度 */
  hair?: string;
  /** 身材体型 */
  body?: string;
  /** 气质，如 优雅、粗犷、冷峻 */
  temperament?: string;
  /** 服装名称 */
  costume_name?: string;
  /** 服装详细描述 */
  costume_description?: string;
  /** 服装主色调 */
  costume_color?: string;
  /** 服装材质 */
  costume_material?: string;
  /** 服装风格 */
  costume_style?: string;
  /** 配饰列表，如 玉佩、耳环、腰带 */
  accessories?: string[];
  /** 情绪状态 JSON 数组字符串 */
  emotion_states?: string;
  /** 动作资产 JSON 数组字符串 */
  action_assets?: string;
  /** 人物关系 JSON 数组字符串 */
  relationships?: string;
  /** 首次出现场次，如 EP01-Scene01 */
  first_appearance?: string;
  /** 对白数量 */
  dialogue_count?: number;
  /** AI 生图标准化提示词 */
  generation_prompt?: string;
  /** 推断可信度：confirmed / inferred */
  confidence?: string;
  /**
   * 参考图 ID（指向 character_images.id）。
   * 设为锁定后，前端生图时自动以该图为 img2img 参考，确保角色一致性。
   * V1 用单张图；V2 可扩展为多图集。
   */
  reference_image_id?: string;
}
