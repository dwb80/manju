/** 分镜状态 */
export type StoryboardStatus = 'draft' | 'approved' | 'production' | 'completed';

/** 分镜实体（独立模块） */
export interface Storyboard {
  id: string;
  project_id: string;
  scene_id: string;
  shot_number: number;
  description: string;
  duration: number;
  camera_angle?: string;
  movement?: string;
  dialogue?: string;
  notes?: string;
  status: StoryboardStatus;
  order: number;
  created_at: string;
  updated_at: string;
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
