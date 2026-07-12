/**
 * 模块共享类型定义
 *
 * 设计原则：
 * - 所有模块共享的数据结构定义
 * - 统一的接口规范
 * - 类型安全保证
 */

// ==================== 基础类型 ====================

/** 内容状态枚举 */
export type ContentStatus =
  | 'draft'      // 草稿
  | 'active'     // 活跃
  | 'review'     // 审核中
  | 'completed'  // 已完成
  | 'archived';  // 已归档

/** 优先级枚举 */
export type Priority = 'low' | 'medium' | 'high' | 'urgent';

/** 基础实体接口 */
export interface BaseEntity {
  id: string;
  created_at: string;
  updated_at: string;
}

/** 分页查询参数 */
export interface PaginationParams {
  page: number;
  page_size: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

/** 分页响应 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// ==================== 统计卡片类型 ====================

/** 统计数据 */
export interface StatData {
  label: string;
  value: string | number;
  trend?: 'up' | 'down' | 'stable';
  change?: string;
  icon?: React.ComponentType<{ className?: string }>;
  color?: 'emerald' | 'blue' | 'purple' | 'orange';
}

// ==================== 剧本中心类型 ====================

/** 剧本实体 */
export interface Script extends BaseEntity {
  title: string;
  description?: string;
  status: ContentStatus;
  words: number;
  chapters: number;
  author: string;
  project_id?: string;
  tags: string[];
  version: number;
}

/** 剧本章节数据 */
export interface ScriptChapter {
  id: string;
  script_id: string;
  title: string;
  content: string;
  order: number;
  words: number;
}

// ==================== 角色工厂类型 ====================

/** 角色类型 */
export type CharacterRole =
  | 'protagonist'  // 主角
  | 'supporting'   // 配角
  | 'antagonist'   // 反派
  | 'minor';       // 次要角色

/** 角色性别 */
export type CharacterGender = 'male' | 'female' | 'other';

/** 角色实体 */
export interface Character extends BaseEntity {
  name: string;
  role: CharacterRole;
  gender?: CharacterGender;
  age?: number;
  traits: string[];
  description?: string;
  image?: string;
  project_id?: string;
  tags: string[];
  /** 资产被引用次数（缓存字段） */
  usage_count?: number;
  /** 当前版本号（任务12：统一版本管理） */
  version?: number;
}

/** 角色关系 */
export interface CharacterRelationship {
  character_id: string;
  related_character_id: string;
  relationship_type: string;
  description?: string;
}

// ==================== 场景工厂类型 ====================

/** 场景类型 */
export type SceneType =
  | 'indoor'   // 室内
  | 'outdoor'  // 室外
  | 'virtual'; // 虚拟

/** 场景实体 */
export interface Scene extends BaseEntity {
  name: string;
  type: SceneType;
  description: string;
  image?: string;
  project_id?: string;
  tags: string[];
  lighting?: string;
  time_of_day?: string;
  weather?: string;
  /** 资产被引用次数（缓存字段） */
  usage_count?: number;
  /** 当前版本号（任务12：统一版本管理） */
  version?: number;
}

// ==================== 道具工厂类型 ====================

/** 道具类别 */
export type PropCategory =
  | 'weapon'     // 武器
  | 'tool'       // 工具
  | 'clothing'   // 服饰
  | 'food'       // 食物
  | 'vehicle'    // 交通工具
  | 'artifact'   // 神器/法宝
  | 'furniture'  // 家具
  | 'other';     // 其他

/** 道具实体 */
export interface Prop extends BaseEntity {
  name: string;
  category: PropCategory;
  description: string;
  appearance?: string;
  material?: string;
  size?: string;
  color?: string;
  image?: string;
  project_id?: string;
  tags: string[];
  /** 资产被引用次数（缓存字段） */
  usage_count?: number;
  /** 当前版本号（任务12：统一版本管理） */
  version?: number;
}

// ==================== 资产版本管理（任务12：统一版本管理） ====================

/** 三厂共性：资产实体类型（任务 12 扩展支持分镜/视频/音频/剪辑的版本管理）。 */
export type AssetEntityType = "character" | "scene" | "prop" | "storyboard" | "video" | "audio" | "clip";

/** 版本变更类型。 */
export type AssetVersionChangeType = "create" | "update" | "restore";

/** 资产版本快照。 */
export interface AssetVersion {
  id: string;
  entity_type: AssetEntityType;
  entity_id: string;
  version: number;
  data: string;
  change_note?: string;
  change_type: AssetVersionChangeType;
  created_at: string;
  created_by?: string;
}

// ==================== 分镜导演台类型 ====================

/** 分镜状态 */
export type StoryboardStatus =
  | 'draft'      // 草稿
  | 'approved'   // 已批准
  | 'production' // 制作中
  | 'completed'; // 已完成

/** 分镜实体 */
export interface Storyboard extends BaseEntity {
  scene_id: string;
  shot_number: number;
  title?: string;
  description: string;
  duration: number; // 秒
  camera_angle?: string;
  movement?: string;
  dialogue?: string;
  notes?: string;
  status: StoryboardStatus;
  project_id?: string;
  order: number;
  episode?: number;
  image_url?: string;
  video_task_id?: string;
  video_url?: string;
  tags?: string[];
}

// ==================== 视频生产线类型 ====================

/** 视频任务状态 */
export type VideoTaskStatus =
  | 'queued'     // 排队中
  | 'processing' // 处理中
  | 'completed'  // 已完成
  | 'failed';    // 失败

/** 视频任务实体 */
export interface VideoTask extends BaseEntity {
  title: string;
  status: VideoTaskStatus;
  progress: number; // 0-100
  duration: number; // 秒
  resolution?: string;
  fps?: number;
  format?: string;
  file_url?: string;
  image_url?: string;
  /** 所属集数。 */
  episode?: number;
  storyboard_id?: string;
  prompt?: string;
  project_id?: string;
  conversation_id?: string;
  tags?: string[];
  error?: string;
}

// ==================== 音频中心类型 ====================

/** 音频类型 */
export type AudioType =
  | 'voiceover' // 配音
  | 'bgm'       // 背景音乐
  | 'sfx';      // 音效

/** 音频实体 */
export interface AudioItem extends BaseEntity {
  name: string;
  type: AudioType;
  duration: number; // 秒
  file_url: string;
  speaker?: string;
  description?: string;
  /** 所属集数。 */
  episode?: number;
  project_id?: string;
  tags: string[];
  format?: string;
  size?: number; // 字节
  /** 关联角色（用于 AI 配音音色）。 */
  character_id?: string;
  /** 关联分镜（这条音频用在哪个镜头）。 */
  storyboard_id?: string;
}

// ==================== 审核中心类型 ====================

/** 审核结果 */
export type ReviewResult = 'approved' | 'rejected' | 'pending';

/** 审核实体 */
export interface Review extends BaseEntity {
  content_type: 'image' | 'video' | 'audio' | 'script';
  content_id: string;
  content_title: string;
  result: ReviewResult;
  score?: number;
  comment?: string;
  reviewer_id: string;
  reviewer_name: string;
  project_id?: string;
}

// ==================== 资产中心类型 ====================

/** 资产类型 */
export type AssetType =
  | 'image'  // 图片
  | 'video'  // 视频
  | 'audio'  // 音频
  | 'document'; // 文档

/** 资产实体 */
export interface Asset extends BaseEntity {
  name: string;
  type: AssetType;
  file_url: string;
  size: number; // 字节
  format: string;
  project_id?: string;
  tags: string[];
  metadata?: Record<string, unknown>;
}

// ==================== 筛选和查询类型 ====================

/** 基础筛选参数 */
export interface BaseFilterParams {
  search?: string;
  status?: string;
  tags?: string[];
  date_from?: string;
  date_to?: string;
}

/** 剧本筛选参数 */
export interface ScriptFilterParams extends BaseFilterParams, PaginationParams {
  author?: string;
  min_words?: number;
  max_words?: number;
}

/** 角色筛选参数 */
export interface CharacterFilterParams extends BaseFilterParams, PaginationParams {
  role?: CharacterRole;
  gender?: CharacterGender;
  age_range?: [number, number];
}

/** 场景筛选参数 */
export interface SceneFilterParams extends BaseFilterParams, PaginationParams {
  type?: SceneType;
  lighting?: string;
  time_of_day?: string;
}

/** 分镜筛选参数 */
export interface StoryboardFilterParams extends BaseFilterParams, PaginationParams {
  scene_id?: string;
  status?: StoryboardStatus;
}

/** 视频任务筛选参数 */
export interface VideoTaskFilterParams extends BaseFilterParams, PaginationParams {
  status?: VideoTaskStatus;
  min_duration?: number;
  max_duration?: number;
}

/** 音频筛选参数 */
export interface AudioFilterParams extends BaseFilterParams, PaginationParams {
  type?: AudioType;
  speaker?: string;
}

/** 审核筛选参数 */
export interface ReviewFilterParams extends BaseFilterParams, PaginationParams {
  result?: ReviewResult;
  content_type?: 'image' | 'video' | 'audio' | 'script';
  reviewer_id?: string;
}

/** 资产筛选参数 */
export interface AssetFilterParams extends BaseFilterParams, PaginationParams {
  type?: AssetType;
  format?: string;
  min_size?: number;
  max_size?: number;
}

// ==================== 图片参数类型（与 app-types 保持一致） ====================

/** 重新导出图片相关类型，方便其他模块统一引入。 */
export type {
  ImageModel,
  ImageSize,
  ImageRatio,
  ImageResponseFormat,
  ImageSettings,
  AspectRatioOption,
  StyleOption,
  StyleValue,
} from "./app-types";