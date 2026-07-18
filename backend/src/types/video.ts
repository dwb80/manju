/**
 * @file video.ts
 * @description 视频生成相关类型定义，包括视频参数、视频任务等
 */

import type { TaskStatus } from "./common.js";

/**
 * 视频生成入参，兼容文生视频、图生视频和关键帧模式
 */
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
  /**
   * 关联的助手消息 ID。生成时由 generateVideo 写入；queryVideo 状态变更时通过该字段
   * 定位会话里"视频生成中…"占位消息并回填 status/videoUrl/content。
   * 旧任务该字段可能为空，queryVideo 会回退到按 meta.taskId 搜索。
   */
  message_id: string;
  created_at: string;
}

/**
 * 视频任务状态类型（独立模块）
 * @property queued - 排队中
 * @property processing - 处理中
 * @property completed - 已完成
 * @property failed - 失败
 */
export type ModuleVideoTaskStatus = 'queued' | 'processing' | 'completed' | 'failed';

/** 视频任务实体（独立模块）。 */
export interface ModuleVideoTask {
  id: string;
  project_id: string;
  /** 来源分镜（一键生成时回填）。 */
  storyboard_id: string;
  title: string;
  /** 提示词（来自分镜描述）。 */
  prompt: string;
  /** 首帧图（来自分镜 image_url）。 */
  image_url: string;
  params: VideoParams;
  /** 关联的 Agnes AI 任务 ID（用于轮询 / 重试）。 */
  ai_task_id: string;
  status: ModuleVideoTaskStatus;
  progress: number;
  duration: number;
  resolution: string;
  fps: number;
  format: string;
  file_url: string;
  /** 所属集数。 */
  episode: number;
  tags: string[];
  error: string;
  /** 资产被引用次数（缓存字段）。 */
  usage_count?: number;
  /** 当前版本号，每次 update 自增，初值为 1。 */
  version?: number;
  created_at: string;
  updated_at: string;
  /** 软删除时间戳。 */
  deleted_at?: string;
}
