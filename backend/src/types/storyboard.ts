/**
 * @file storyboard.ts
 * @description 分镜相关类型定义，包括分镜实体、分镜状态、项目分镜等
 */

/**
 * 分镜状态类型
 * @property draft - 草稿
 * @property approved - 已审批
 * @property production - 制作中
 * @property completed - 已完成
 */
export type StoryboardStatus = 'draft' | 'approved' | 'production' | 'completed';

/** 分镜实体（独立模块）。 */
export interface Storyboard {
  id: string;
  project_id: string;
  scene_id: string;
  /** 所属集数（工业流水线：按集查看分镜）。 */
  episode: number;
  shot_number: number;
  /** 分镜标题（便于在视频生产线显示）。 */
  title: string;
  description: string;
  duration: number;
  camera_angle?: string;
  movement?: string;
  dialogue?: string;
  notes?: string;
  /** 分镜首帧图（用于 AI 视频的关键帧）。 */
  image_url: string;
  /** 关联的视频任务 ID（一键生成视频后回填）。 */
  video_task_id: string;
  /** 关联的视频成品 URL。 */
  video_url: string;
  status: StoryboardStatus;
  tags: string[];
  order: number;
  /** 资产被引用次数（缓存字段）。 */
  usage_count?: number;
  /** 当前版本号，每次 update 自增，初值为 1。 */
  version?: number;
  /**
   * 关联角色资产 ID 列表（来自角色工厂）。
   * 反向展示：角色工厂的 UsageBadge 会统计本字段非空且包含该角色 ID 的分镜数。
   */
  character_asset_ids?: string[];
  /**
   * 关联道具资产 ID 列表（来自道具工厂）。
   * 反向展示：道具工厂的 UsageBadge 会统计本字段非空且包含该道具 ID 的分镜数。
   */
  prop_asset_ids?: string[];
  created_at: string;
  updated_at: string;
  /** 软删除时间戳。 */
  deleted_at?: string;
}

/**
 * 项目分镜状态类型
 * @property draft - 草稿
 * @property scripted - 已编剧
 * @property image - 图片阶段
 * @property video - 视频阶段
 * @property review - 审核中
 * @property done - 已完成
 */
export type ProjectStoryboardStatus = "draft" | "scripted" | "image" | "video" | "review" | "done";

/** 分镜记录，是剧本到图片、视频、审核、剪辑之间的核心桥梁。 */
export interface ProjectStoryboard {
  id: string;
  project_id: string;
  episode: number;
  scene: string;
  shot: string;
  title: string;
  description: string;
  dialogue: string;
  characters: string[];
  character_asset_ids: string[];
  location: string;
  scene_asset_id: string;
  shot_size: string;
  camera_move: string;
  duration: number;
  prompt: string;
  image_task_id: string;
  image_url: string;
  video_task_id: string;
  video_url: string;
  status: ProjectStoryboardStatus;
  notes: string;
  created_at: string;
  updated_at: string;
}
