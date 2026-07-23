/**
 * @file storyboard.ts
 * @description 分镜与镜头类型定义（V2 父子结构）。
 *              V1: storyboard = 分镜+镜头合并
 *              V2: storyboard = 纯分镜, shot = 镜头(属于分镜)
 */

// ==================== 分镜状态（导演台层面） ====================

/**
 * 分镜状态类型（8 状态机）
 * @property draft - 草稿
 * @property generating - 生成中（AI 生图/生视频）
 * @property ready - 就绪（可提交审核）
 * @property in_review - 审核中
 * @property approved - 已通过
 * @property needs_fix - 需修复（审核打回）
 * @property rejected - 已驳回
 * @property archived - 已归档
 */
export type StoryboardStatus =
  | "draft"
  | "generating"
  | "ready"
  | "in_review"
  | "approved"
  | "needs_fix"
  | "rejected"
  | "archived";

/** 分镜实体（V2：纯分镜，不含镜头细节）。 */
export interface Storyboard {
  id: string;
  project_id: string;
  /** 所属剧集 ID（关联 script_episodes）。 */
  episode_id: string;
  /** 所属场景 ID（关联 scenes）。 */
  scene_id: string;
  /** 集数序号（冗余，便于按集查看）。 */
  episode: number;
  /** 分镜编号（如 SB-001）。 */
  storyboard_number: string;
  /** 分镜标题。 */
  title: string;
  /** 分镜描述（导演意图、场景概述）。 */
  description: string;
  /** 对白文本（完整对白，用于 AI 拆分镜头）。 */
  dialogue?: string;
  /** 备注。 */
  notes?: string;
  /** 分镜状态。 */
  status: StoryboardStatus;
  /** 排序号。 */
  order: number;
  /** 关联角色资产 ID 列表。 */
  character_asset_ids?: string[];
  /** 关联道具资产 ID 列表。 */
  prop_asset_ids?: string[];
  /** 当前版本号。 */
  version?: number;
  created_at: string;
  updated_at: string;
  /** 软删除时间戳。 */
  deleted_at?: string;
}

// ==================== 镜头状态（生产层面） ====================

/**
 * 镜头状态类型（8 状态机，与分镜状态对齐但独立）
 */
export type ShotStatus =
  | "draft"
  | "generating"
  | "ready"
  | "in_review"
  | "approved"
  | "needs_fix"
  | "rejected"
  | "archived";

/** 景别枚举。 */
export type ShotSize =
  | "extreme_close_up"
  | "close_up"
  | "medium_close_up"
  | "medium_shot"
  | "full_shot"
  | "long_shot"
  | "extreme_long_shot"
  | "over_shoulder"
  | "point_of_view"
  | "two_shot"
  | "three_shot"
  | "group_shot";

/** 镜头角度枚举。 */
export type CameraAngle =
  | "eye_level"
  | "low_angle"
  | "high_angle"
  | "dutch_angle"
  | "overhead"
  | "worm_eye_view"
  | "bird_eye_view"
  | "profile"
  | "three_quarter"
  | "rear_view";

/** 镜头运动枚举。 */
export type CameraMovement =
  | "static"
  | "pan"
  | "tilt"
  | "dolly_in"
  | "dolly_out"
  | "truck"
  | "crane"
  | "handheld"
  | "steadicam"
  | "zoom_in"
  | "zoom_out"
  | "rack_focus";

/** 镜头实体（V2 新增，属于一个分镜）。 */
export interface Shot {
  id: string;
  project_id: string;
  /** 所属分镜 ID（外键，必填）。 */
  storyboard_id: string;
  /** 所属场景 ID（冗余，便于查询）。 */
  scene_id: string;
  /** 所属集数。 */
  episode: number;
  /** 镜头编号（同一分镜内唯一，如 shot_001）。 */
  shot_number: string;
  /** 镜头标题。 */
  title: string;
  /** 镜头描述（用于 AI 生图的视觉描述）。 */
  description: string;
  /** 时长（秒，0.1-30.0）。 */
  duration: number;
  /** 景别。 */
  shot_size?: ShotSize;
  /** 镜头角度。 */
  camera_angle?: CameraAngle;
  /** 镜头运动。 */
  camera_movement?: CameraMovement;
  /** 对白。 */
  dialogue?: string;
  /** 备注。 */
  notes?: string;
  /** 分镜首帧图（用于 AI 视频的关键帧）。 */
  image_url: string;
  /** 关联的视频任务 ID。 */
  video_task_id: string;
  /** 关联的视频成品 URL。 */
  video_url: string;
  /** 镜头状态。 */
  status: ShotStatus;
  /** 排序号（同一分镜内）。 */
  order: number;
  /** 关联角色资产 ID 列表。 */
  character_asset_ids?: string[];
  /** 关联道具资产 ID 列表。 */
  prop_asset_ids?: string[];
  /** 当前版本号。 */
  version?: number;
  created_at: string;
  updated_at: string;
  /** 软删除时间戳。 */
  deleted_at?: string;
}

// ==================== 镜头快照（不可变） ====================

/** 镜头快照状态（用于版本历史）。 */
export interface ShotSnapshot {
  id: string;
  project_id: string;
  shot_id: string;
  /** 快照版本号。 */
  version: number;
  /** 快照数据（完整 Shot JSON）。 */
  data: string;
  /** 变更说明。 */
  change_note?: string;
  created_by: string;
  created_at: string;
}

// ==================== 项目分镜（剧本侧，保持不变） ====================

/**
 * 项目分镜状态类型
 * @property draft - 草稿
 * @property scripted - 已编剧
 * @property image - 图片阶段
 * @property video - 视频阶段
 * @property review - 审核中
 * @property done - 已完成
 */
export type ProjectStoryboardStatus =
  | "draft"
  | "scripted"
  | "image"
  | "video"
  | "review"
  | "done";

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
