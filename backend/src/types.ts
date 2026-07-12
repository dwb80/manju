// 兼容层：从新的领域类型文件 re-export 出去，旧模块 (`../types.js`) 引用这些类型时仍可解析。
import type { VideoParams } from "./types/video.js";
export type {
  Script,
  ProjectScript,
  ScriptDocument,
  ScriptEpisode,
  ScriptScene,
  ScriptDialogue,
  ScriptSceneCharacter,
  ScriptSceneLocation,
  ScriptTemplate,
  ScriptTag,
  ScriptQualityAssessment,
  ScriptApproval,
  ScriptBackup,
  ScriptComment,
  AIScriptGenerationRequest,
  AIScriptOptimizationRequest,
  AISceneGenerationRequest,
  AIDialogueGenerationRequest,
  AIStoryboardSplitRequest,
} from "./types/script.js";
export type { Character, CharacterRole, CharacterGender } from "./types/character.js";
export type { Scene, SceneType } from "./types/scene.js";
export type { Prop, PropCategory } from "./types/prop.js";
export type { Storyboard, StoryboardStatus, ProjectStoryboard, ProjectStoryboardStatus } from "./types/storyboard.js";
export type { Audio, AudioType } from "./types/audio.js";
export type { VideoParams, ModuleVideoTask, ModuleVideoTaskStatus } from "./types/video.js";
// VideoTask 由本文件维护（兼容历史/legacy 调用方），包含 task_id/video_id/progress/seconds/size。
export type { ProjectClip, ProjectClipStatus, ProjectTask, ProjectTaskStatus, ProjectMember, ProjectMilestone, ProjectMilestoneStatus, ProjectIssue, ProjectIssueStatus, ProjectIssueSeverity, ProjectEpisode, PublishPlan, PublishPlanStatus, PublishPlatform, PublishedVideo } from "./types/project.js";
export type { ChatChunk, ChatToolCall, ChatParams } from "./types/chat.js";
export type { ModelType, ModelPricing, ModelApiConfig, ModelCapabilities, ModelParameterRule, ModelConfig, ModelProvider, ModelPermission, ModelCallLog, ModelQuota, ModelRecommendationRequest, ModelRecommendation } from "./types/model.js";
export type { Review, ReviewResult, ProjectReview, ProjectReviewStatus } from "./types/review.js";
export type { ImageParams, ImageTask } from "./types/image.js";
export type { ProjectAsset, ProjectAssetKind, Asset, AssetType } from "./types/asset.js";
export type { ContentStatus } from "./types/script.js";
export type { Todo, TodoStatus, TodoPriority } from "./types/todo.js";
export type { WorkItem, WorkItemKind, WorkItemStatus, WorkItemSeverity, WorkItemTargetType } from "./types/work-item.js";
export type { AppLog, AppLogAction, AppLogEntityType } from "./types/common.js";
// Dashboard 等占位类型直接 re-export 自 types/extra.ts，避免与 types/project.ts 命名冲突。
export type {
  AITaskMonitor,
  CostBreakdown,
  DashboardData,
  DashboardKPI,
  ProductionHealth,
  ProductionPipeline,
  ProjectProgress,
  RecentGeneration,
  ResourceMonitorData,
  ReviewCenterData,
  TeamActivity,
  ImageTaskStatus,
} from "./types/extra.js";

export type Role = "system" | "user" | "assistant";
export type TaskStatus = "pending" | "processing" | "success" | "failed";
export type FavoriteType = "chat" | "image" | "video";

export interface Conversation {
  id: string;
  title: string;
  model: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
  project_id: string;
}

export interface Project {
  id: string;
  name: string;
  is_default: boolean;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
  storage_path: string;
  storage_mode: string;
  archived_at: string;
  status?: string;
  category?: string;
  description?: string;
  episode_count?: number;
  owner?: string;
  due_date?: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: Role;
  content: string;
  tokens: number;
  meta: Record<string, unknown>;
  created_at: string;
}

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

export interface Favorite {
  id: string;
  type: FavoriteType;
  ref_id: string;
  created_at: string;
}

export interface Settings {
  theme: "light" | "dark" | "system";
  language: "zh-CN" | "en-US";
  fontSize: "small" | "medium" | "large";
  defaultChatModel: string;
  defaultImageSize: "1024x768" | "768x1024" | "1024x1024" | "1152x768" | "768x1152";
  defaultVideoRatio: "16:9" | "9:16" | "1:1";
}

/** VideoParams 由 ./types/video.js re-export，此处不再重复定义，避免冲突。 */

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

// ScriptComment 由 ./types/script.js 统一导出（兼容编辑器行内批注）。

// ==================== 任务12：统一版本管理 ====================

/** 资产实体类型（角色 / 场景 / 道具）。 */
export type AssetEntityType = "character" | "scene" | "prop";

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
