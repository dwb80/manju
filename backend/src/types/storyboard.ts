/** 分镜状态 */
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
  created_at: string;
  updated_at: string;
  /** 软删除时间戳。 */
  deleted_at?: string;
}

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
