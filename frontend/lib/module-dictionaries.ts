/**
 * 模块共享的"状态/类型"枚举与中文标签字典。
 *
 * 设计原则：
 * - 各模块不再独立硬编码 statusLabels / statusOptions / statusColors。
 * - 字典集中维护，新增状态时只改这一处即可全局生效。
 * - 与后端枚举值保持一一对应（snake_case 内部值 + 中文 label）。
 */

import type { FilterOption } from "@/components/factory";

/** 分镜状态。 */
export type StoryboardStatus = "draft" | "approved" | "production" | "completed";

export const STORYBOARD_STATUS_LABELS: Record<StoryboardStatus, string> = {
  draft: "草稿",
  approved: "已批准",
  production: "制作中",
  completed: "已完成",
};

export const STORYBOARD_STATUS_COLORS: Record<StoryboardStatus, string> = {
  draft: "bg-gray-500/20 text-gray-400",
  approved: "bg-emerald-500/20 text-emerald-400",
  production: "bg-yellow-500/20 text-yellow-400",
  completed: "bg-purple-500/20 text-purple-400",
};

export const STORYBOARD_STATUS_OPTIONS: FilterOption[] = [
  { value: "draft", label: "草稿" },
  { value: "approved", label: "已批准" },
  { value: "production", label: "制作中" },
  { value: "completed", label: "已完成" },
];

/** 视频任务状态。 */
export type VideoTaskStatus = "queued" | "processing" | "completed" | "failed";

export const VIDEO_STATUS_LABELS: Record<VideoTaskStatus, string> = {
  queued: "排队中",
  processing: "处理中",
  completed: "已完成",
  failed: "失败",
};

export const VIDEO_STATUS_COLORS: Record<VideoTaskStatus, string> = {
  queued: "bg-gray-500/20 text-gray-400",
  processing: "bg-blue-500/20 text-blue-400",
  completed: "bg-emerald-500/20 text-emerald-400",
  failed: "bg-red-500/20 text-red-400",
};

export const VIDEO_STATUS_OPTIONS: FilterOption[] = [
  { value: "queued", label: "排队中" },
  { value: "processing", label: "处理中" },
  { value: "completed", label: "已完成" },
  { value: "failed", label: "失败" },
];

/** 音频类型。 */
export type AudioKind = "voiceover" | "bgm" | "sfx";

export const AUDIO_TYPE_LABELS: Record<AudioKind, string> = {
  voiceover: "配音",
  bgm: "背景音乐",
  sfx: "音效",
};

export const AUDIO_TYPE_COLORS: Record<AudioKind, string> = {
  voiceover: "bg-emerald-500/20 text-emerald-400",
  bgm: "bg-blue-500/20 text-blue-400",
  sfx: "bg-purple-500/20 text-purple-400",
};

export const AUDIO_TYPE_OPTIONS: FilterOption[] = [
  { value: "voiceover", label: "配音" },
  { value: "bgm", label: "背景音乐" },
  { value: "sfx", label: "音效" },
];

/** 给 FilterSelect 用的"全部 + 子项"快捷构造。 */
export function withAll<T extends FilterOption>(options: T[], allLabel = "全部"): FilterOption[] {
  return [{ value: "", label: allLabel }, ...options];
}

/** 剪辑状态（与 ProjectClipStatus 对应）。 */
export const PROJECT_CLIP_STATUS_LABELS: Record<string, string> = {
  todo: "待剪辑",
  editing: "剪辑中",
  review: "审核中",
  done: "已完成",
};

export const PROJECT_CLIP_STATUS_COLORS: Record<string, string> = {
  todo: "bg-gray-500/20 text-gray-400",
  editing: "bg-blue-500/20 text-blue-400",
  review: "bg-yellow-500/20 text-yellow-400",
  done: "bg-emerald-500/20 text-emerald-400",
};
