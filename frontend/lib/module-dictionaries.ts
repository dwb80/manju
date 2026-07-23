/**
 * 模块共享的"状态/类型"枚举与中文标签字典。
 *
 * 设计原则：
 * - 各模块不再独立硬编码 statusLabels / statusOptions / statusColors。
 * - 字典集中维护，新增状态时只改这一处即可全局生效。
 * - 与后端枚举值保持一一对应（snake_case 内部值 + 中文 label）。
 */

import type { FilterOption } from "@/components/factory";

/** 分镜状态（8 状态机）。 */
export type StoryboardStatus =
  | "draft"
  | "generating"
  | "ready"
  | "in_review"
  | "approved"
  | "needs_fix"
  | "rejected"
  | "archived";

export const STORYBOARD_STATUS_LABELS: Record<StoryboardStatus, string> = {
  draft: "草稿",
  generating: "生成中",
  ready: "就绪",
  in_review: "审核中",
  approved: "已通过",
  needs_fix: "需修复",
  rejected: "已驳回",
  archived: "已归档",
};

export const STORYBOARD_STATUS_COLORS: Record<StoryboardStatus, string> = {
  draft: "bg-gray-500/20 text-gray-400",
  generating: "bg-blue-500/20 text-blue-400",
  ready: "bg-emerald-500/20 text-emerald-400",
  in_review: "bg-yellow-500/20 text-yellow-400",
  approved: "bg-green-500/20 text-green-400",
  needs_fix: "bg-orange-500/20 text-orange-400",
  rejected: "bg-red-500/20 text-red-400",
  archived: "bg-purple-500/20 text-purple-400",
};

export const STORYBOARD_STATUS_OPTIONS: FilterOption[] = [
  { value: "draft", label: "草稿" },
  { value: "generating", label: "生成中" },
  { value: "ready", label: "就绪" },
  { value: "in_review", label: "审核中" },
  { value: "approved", label: "已通过" },
  { value: "needs_fix", label: "需修复" },
  { value: "rejected", label: "已驳回" },
  { value: "archived", label: "已归档" },
];

/** 镜头状态（8 状态机，与分镜对齐但独立）。 */
export type ShotStatus =
  | "draft"
  | "generating"
  | "ready"
  | "in_review"
  | "approved"
  | "needs_fix"
  | "rejected"
  | "archived";

export const SHOT_STATUS_LABELS: Record<ShotStatus, string> = {
  draft: "草稿",
  generating: "生成中",
  ready: "就绪",
  in_review: "审核中",
  approved: "已通过",
  needs_fix: "需修复",
  rejected: "已驳回",
  archived: "已归档",
};

export const SHOT_STATUS_COLORS: Record<ShotStatus, string> = {
  draft: "bg-gray-500/20 text-gray-400",
  generating: "bg-blue-500/20 text-blue-400",
  ready: "bg-emerald-500/20 text-emerald-400",
  in_review: "bg-yellow-500/20 text-yellow-400",
  approved: "bg-green-500/20 text-green-400",
  needs_fix: "bg-orange-500/20 text-orange-400",
  rejected: "bg-red-500/20 text-red-400",
  archived: "bg-purple-500/20 text-purple-400",
};

export const SHOT_STATUS_OPTIONS: FilterOption[] = [
  { value: "draft", label: "草稿" },
  { value: "generating", label: "生成中" },
  { value: "ready", label: "就绪" },
  { value: "in_review", label: "审核中" },
  { value: "approved", label: "已通过" },
  { value: "needs_fix", label: "需修复" },
  { value: "rejected", label: "已驳回" },
  { value: "archived", label: "已归档" },
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

export const PROJECT_CLIP_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "todo", label: "待剪辑" },
  { value: "editing", label: "剪辑中" },
  { value: "review", label: "审核中" },
  { value: "done", label: "已完成" },
];
