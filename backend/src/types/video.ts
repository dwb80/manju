import type { TaskStatus } from "./common.js";

/** 视频生成入参，兼容文生视频、图生视频和关键帧模式。 */
export interface VideoParams {
  prompt: string;
  image?: string;
  images?: string[];
  ratio?: "16:9" | "9:16" | "1:1" | "4:3" | "3:4";
  mode?: "ti2vid" | "keyframes" | string;
  duration?: 3 | 5 | 10 | 18;
  width?: number;
  height?: number;
  num_frames?: number;
  frame_rate?: number;
  num_inference_steps?: number;
  seed?: number;
  negative_prompt?: string;
  extra_body?: Record<string, unknown>;
  model?: string;
}

/** 视频生成任务，保存 Agnes 任务信息、结果视频 URL、进度和规格。 */
export interface VideoTask {
  id: string;
  task_id: string;
  video_id: string;
  conversation_id: string;
  prompt: string;
  image_url: string;
  params: VideoParams;
  video_url: string;
  status: TaskStatus;
  progress: number;
  seconds: string;
  size: string;
  error: string;
  created_at: string;
}

/** 视频任务状态（独立模块） */
export type ModuleVideoTaskStatus = 'queued' | 'processing' | 'completed' | 'failed';

/** 视频任务实体（独立模块） */
export interface ModuleVideoTask {
  id: string;
  project_id: string;
  title: string;
  status: ModuleVideoTaskStatus;
  progress: number;
  duration: number;
  resolution?: string;
  fps?: number;
  format?: string;
  file_url?: string;
  created_at: string;
  updated_at: string;
}
