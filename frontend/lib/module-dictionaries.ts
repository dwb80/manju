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
  draft: "bg-muted/20 text-muted-foreground",
  generating: "bg-info/20 text-info",
  ready: "bg-primary/20 text-primary",
  in_review: "bg-chart-5/20 text-chart-5",
  approved: "bg-success/20 text-success",
  needs_fix: "bg-chart-3/20 text-chart-3",
  rejected: "bg-destructive/20 text-destructive",
  archived: "bg-chart-1/20 text-chart-1",
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
  draft: "bg-muted/20 text-muted-foreground",
  generating: "bg-info/20 text-info",
  ready: "bg-primary/20 text-primary",
  in_review: "bg-chart-5/20 text-chart-5",
  approved: "bg-success/20 text-success",
  needs_fix: "bg-chart-3/20 text-chart-3",
  rejected: "bg-destructive/20 text-destructive",
  archived: "bg-chart-1/20 text-chart-1",
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
  queued: "bg-muted/20 text-muted-foreground",
  processing: "bg-info/20 text-info",
  completed: "bg-primary/20 text-primary",
  failed: "bg-destructive/20 text-destructive",
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
  voiceover: "bg-primary/20 text-primary",
  bgm: "bg-info/20 text-info",
  sfx: "bg-chart-1/20 text-chart-1",
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
  todo: "bg-muted/20 text-muted-foreground",
  editing: "bg-info/20 text-info",
  review: "bg-chart-5/20 text-chart-5",
  done: "bg-primary/20 text-primary",
};

export const PROJECT_CLIP_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "todo", label: "待剪辑" },
  { value: "editing", label: "剪辑中" },
  { value: "review", label: "审核中" },
  { value: "done", label: "已完成" },
];
