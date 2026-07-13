import type { Conversation, Favorite, ImageTask, Message, Project, Settings, VideoTask, ScriptComment, AssetVersion, CharacterImageHistory, Todo, AppLog, WorkItem } from "../types.js";
import type { Script, ProjectScript } from "../types/script.js";
import type { Character } from "../types/character.js";
import type { Scene } from "../types/scene.js";
import type { Prop } from "../types/prop.js";
import type { Storyboard, ProjectStoryboard } from "../types/storyboard.js";
import type { Audio } from "../types/audio.js";
import type { ModuleVideoTask } from "../types/video.js";
import type { ProjectClip } from "../types/project.js";
import type { Asset, ProjectAsset } from "../types/asset.js";
import type { Review, ProjectReview } from "../types/review.js";
import type { ScriptDocument, ScriptEpisode, ScriptScene, ScriptDialogue, ScriptSceneCharacter, ScriptSceneLocation, ScriptTemplate, ScriptTag, ScriptQualityAssessment, ScriptApproval, ScriptBackup } from "../types/script.js";
import type { FieldSpec } from "./repository.js";

export const conversationFields: FieldSpec<Conversation>[] = [
  { key: "id", type: "string" },
  { key: "title", type: "string" },
  { key: "model", type: "string" },
  { key: "is_pinned", type: "boolean" },
  { key: "created_at", type: "string" },
  { key: "updated_at", type: "string" },
  { key: "project_id", type: "string" },
];

export const projectFields: FieldSpec<Project>[] = [
  { key: "id", type: "string" },
  { key: "name", type: "string" },
  { key: "category", type: "string" },
  { key: "status", type: "string" },
  { key: "description", type: "string" },
  { key: "episode_count", type: "number" },
  { key: "owner", type: "string" },
  { key: "due_date", type: "string" },
  { key: "is_default", type: "boolean" },
  { key: "is_pinned", type: "boolean" },
  { key: "created_at", type: "string" },
  { key: "updated_at", type: "string" },
  { key: "storage_path", type: "string" },
  { key: "storage_mode", type: "string" },
  { key: "archived_at", type: "string" },
];

export const messageFields: FieldSpec<Message>[] = [
  { key: "id", type: "string" },
  { key: "conversation_id", type: "string" },
  { key: "role", type: "string" },
  { key: "content", type: "string" },
  { key: "tokens", type: "number" },
  { key: "meta", type: "json" },
  { key: "created_at", type: "string" },
];

export const imageTaskFields: FieldSpec<ImageTask>[] = [
  { key: "id", type: "string" },
  { key: "prompt", type: "string" },
  { key: "negative", type: "string" },
  { key: "params", type: "json" },
  { key: "image_urls", type: "json" },
  { key: "status", type: "string" },
  { key: "error", type: "string" },
  { key: "created_at", type: "string" },
  { key: "conversation_id", type: "string" },
];

export const videoTaskFields: FieldSpec<VideoTask>[] = [
  { key: "id", type: "string" },
  { key: "prompt", type: "string" },
  { key: "image_url", type: "string" },
  { key: "params", type: "json" },
  { key: "video_url", type: "string" },
  { key: "status", type: "string" },
  { key: "error", type: "string" },
  { key: "created_at", type: "string" },
  { key: "conversation_id", type: "string" },
];

export const favoriteFields: FieldSpec<Favorite>[] = [
  { key: "id", type: "string" },
  { key: "type", type: "string" },
  { key: "ref_id", type: "string" },
  { key: "created_at", type: "string" },
];

/** 剧本编辑器行内批注与回复表字段（任务8：评论持久化）。 */
export const scriptCommentFields: FieldSpec<ScriptComment>[] = [
  { key: "id", type: "string" },
  { key: "script_id", type: "string" },
  { key: "episode_id", type: "string" },
  { key: "user_name", type: "string" },
  { key: "content", type: "string" },
  { key: "selected_text", type: "string" },
  { key: "position_from", type: "number" },
  { key: "position_to", type: "number" },
  { key: "parent_id", type: "string" },
  { key: "resolved", type: "boolean" },
  { key: "created_at", type: "string" },
  { key: "updated_at", type: "string" },
];

/**
 * 三厂共性：资产版本历史表字段（任务12：统一版本管理）。
 */
export const assetVersionFields: FieldSpec<AssetVersion>[] = [
  { key: "id", type: "string" },
  { key: "entity_type", type: "string" },
  { key: "entity_id", type: "string" },
  { key: "version", type: "number" },
  { key: "data", type: "string" },
  { key: "change_note", type: "string" },
  { key: "change_type", type: "string" },
  { key: "created_at", type: "string" },
  { key: "created_by", type: "string" },
];

/**
 * 角色图片生成历史表字段。
 *
 * 用于角色图片生成器右侧「历史图片」+「已选资产历史」两个区块的持久化。
 * 单表 + is_applied 区分两种记录；同一 character 下同一 url 唯一（前端调用前会做 URL dedup）。
 */
export const characterImageHistoryFields: FieldSpec<CharacterImageHistory>[] = [
  { key: "id", type: "string" },
  { key: "character_id", type: "string" },
  { key: "project_id", type: "string" },
  { key: "url", type: "string" },
  { key: "ratio", type: "string" },
  { key: "model", type: "string" },
  { key: "size", type: "string" },
  { key: "prompt", type: "string" },
  { key: "negative_prompt", type: "string" },
  { key: "response_format", type: "string" },
  { key: "n", type: "number" },
  { key: "is_applied", type: "boolean" },
  { key: "applied_at", type: "string" },
  { key: "created_at", type: "string" },
];

/** 我的待办字段（评审优化 P1）。 */
export const todoFields: FieldSpec<Todo>[] = [
  { key: "id", type: "string" },
  { key: "owner", type: "string" },
  { key: "title", type: "string" },
  { key: "description", type: "string" },
  { key: "status", type: "string" },
  { key: "priority", type: "string" },
  { key: "due_date", type: "string" },
  { key: "link_type", type: "string" },
  { key: "link_id", type: "string" },
  { key: "link_url", type: "string" },
  { key: "created_at", type: "string" },
  { key: "updated_at", type: "string" },
  { key: "deleted_at", type: "string" },
];

/**
 * 统一工作项字段（评审优化 P2：状态机收敛）。
 * 合并原 project_tasks / project_issues / project_reviews / project_milestones。
 */
export const workItemFields: FieldSpec<WorkItem>[] = [
  { key: "id", type: "string" },
  { key: "project_id", type: "string" },
  { key: "kind", type: "string" },
  { key: "title", type: "string" },
  { key: "status", type: "string" },
  { key: "owner", type: "string" },
  { key: "due_date", type: "string" },
  { key: "severity", type: "string" },
  { key: "target_type", type: "string" },
  { key: "target_id", type: "string" },
  { key: "description", type: "string" },
  { key: "tags", type: "json" },
  { key: "created_at", type: "string" },
  { key: "updated_at", type: "string" },
  { key: "deleted_at", type: "string" },
];

/**
 * 应用审计日志字段（评审增量 P1-1：状态机变更 / P1-2：跨项目复制 + 软删除 / 恢复）。
 *
 * - payload 是 JSON 字符串，便于按字段全文检索；调用方写库前用 JSON.stringify 序列化。
 * - event 字段与 rootLogger event 保持一致（如 "video.status_changed"），
 *   便于日志（file logger）和审计表（app_logs）联合查询。
 */
export const appLogFields: FieldSpec<AppLog>[] = [
  { key: "id", type: "string" },
  { key: "entity_type", type: "string" },
  { key: "entity_id", type: "string" },
  { key: "action", type: "string" },
  { key: "event", type: "string" },
  { key: "payload", type: "string" },
  { key: "operator", type: "string" },
  { key: "project_id", type: "string" },
  { key: "trace_id", type: "string" },
  { key: "created_at", type: "string" },
];

// ==================== 三大工厂：角色/场景/道具 ====================

export const characterFields: FieldSpec<Character>[] = [
  { key: "id", type: "string" },
  { key: "project_id", type: "string" },
  { key: "name", type: "string" },
  { key: "role", type: "string" },
  { key: "gender", type: "string" },
  { key: "age", type: "number" },
  { key: "traits", type: "json" },
  { key: "description", type: "string" },
  { key: "image", type: "string" },
  { key: "tags", type: "json" },
  { key: "usage_count", type: "number" },
  { key: "version", type: "number" },
  { key: "created_at", type: "string" },
  { key: "updated_at", type: "string" },
  { key: "deleted_at", type: "string" },
];

export const sceneFields: FieldSpec<Scene>[] = [
  { key: "id", type: "string" },
  { key: "project_id", type: "string" },
  { key: "name", type: "string" },
  { key: "type", type: "string" },
  { key: "description", type: "string" },
  { key: "image", type: "string" },
  { key: "tags", type: "json" },
  { key: "lighting", type: "string" },
  { key: "time_of_day", type: "string" },
  { key: "weather", type: "string" },
  { key: "usage_count", type: "number" },
  { key: "version", type: "number" },
  { key: "created_at", type: "string" },
  { key: "updated_at", type: "string" },
  { key: "deleted_at", type: "string" },
];

export const propFields: FieldSpec<Prop>[] = [
  { key: "id", type: "string" },
  { key: "project_id", type: "string" },
  { key: "name", type: "string" },
  { key: "category", type: "string" },
  { key: "description", type: "string" },
  { key: "appearance", type: "string" },
  { key: "material", type: "string" },
  { key: "size", type: "string" },
  { key: "color", type: "string" },
  { key: "image", type: "string" },
  { key: "tags", type: "json" },
  { key: "usage_count", type: "number" },
  { key: "version", type: "number" },
  { key: "created_at", type: "string" },
  { key: "updated_at", type: "string" },
  { key: "deleted_at", type: "string" },
];

// ==================== 独立模块：分镜/音频/视频/剪辑 ====================

/** 分镜实体（独立模块，区别于剧本侧分镜） */
export const storyboardFields: FieldSpec<Storyboard>[] = [
  { key: "id", type: "string" },
  { key: "project_id", type: "string" },
  { key: "scene_id", type: "string" },
  { key: "episode", type: "number" },
  { key: "shot_number", type: "number" },
  { key: "title", type: "string" },
  { key: "description", type: "string" },
  { key: "duration", type: "number" },
  { key: "camera_angle", type: "string" },
  { key: "movement", type: "string" },
  { key: "dialogue", type: "string" },
  { key: "notes", type: "string" },
  { key: "image_url", type: "string" },
  { key: "video_task_id", type: "string" },
  { key: "video_url", type: "string" },
  { key: "status", type: "string" },
  { key: "tags", type: "json" },
  { key: "order", type: "number" },
  { key: "usage_count", type: "number" },
  { key: "version", type: "number" },
  { key: "created_at", type: "string" },
  { key: "updated_at", type: "string" },
  { key: "deleted_at", type: "string" },
];

/** 剧本侧分镜（剧本编辑器内的分镜记录） */
export const projectStoryboardFields: FieldSpec<ProjectStoryboard>[] = [
  { key: "id", type: "string" },
  { key: "project_id", type: "string" },
  { key: "episode", type: "number" },
  { key: "scene", type: "string" },
  { key: "shot", type: "string" },
  { key: "title", type: "string" },
  { key: "description", type: "string" },
  { key: "dialogue", type: "string" },
  { key: "characters", type: "json" },
  { key: "character_asset_ids", type: "json" },
  { key: "location", type: "string" },
  { key: "scene_asset_id", type: "string" },
  { key: "shot_size", type: "string" },
  { key: "camera_move", type: "string" },
  { key: "duration", type: "number" },
  { key: "prompt", type: "string" },
  { key: "image_task_id", type: "string" },
  { key: "image_url", type: "string" },
  { key: "video_task_id", type: "string" },
  { key: "video_url", type: "string" },
  { key: "status", type: "string" },
  { key: "notes", type: "string" },
  { key: "created_at", type: "string" },
  { key: "updated_at", type: "string" },
];

/** 音频实体（配音/背景音/音效） */
export const audioFields: FieldSpec<Audio>[] = [
  { key: "id", type: "string" },
  { key: "project_id", type: "string" },
  { key: "name", type: "string" },
  { key: "type", type: "string" },
  { key: "description", type: "string" },
  { key: "duration", type: "number" },
  { key: "file_url", type: "string" },
  { key: "speaker", type: "string" },
  { key: "character_id", type: "string" },
  { key: "storyboard_id", type: "string" },
  { key: "episode", type: "number" },
  { key: "tags", type: "json" },
  { key: "format", type: "string" },
  { key: "size", type: "number" },
  { key: "usage_count", type: "number" },
  { key: "version", type: "number" },
  { key: "created_at", type: "string" },
  { key: "updated_at", type: "string" },
  { key: "deleted_at", type: "string" },
];

/** 视频任务实体（独立模块） */
export const moduleVideoTaskFields: FieldSpec<ModuleVideoTask>[] = [
  { key: "id", type: "string" },
  { key: "project_id", type: "string" },
  { key: "storyboard_id", type: "string" },
  { key: "title", type: "string" },
  { key: "prompt", type: "string" },
  { key: "image_url", type: "string" },
  { key: "params", type: "json" },
  { key: "ai_task_id", type: "string" },
  { key: "status", type: "string" },
  { key: "progress", type: "number" },
  { key: "duration", type: "number" },
  { key: "resolution", type: "string" },
  { key: "fps", type: "number" },
  { key: "format", type: "string" },
  { key: "file_url", type: "string" },
  { key: "episode", type: "number" },
  { key: "tags", type: "json" },
  { key: "error", type: "string" },
  { key: "usage_count", type: "number" },
  { key: "version", type: "number" },
  { key: "created_at", type: "string" },
  { key: "updated_at", type: "string" },
  { key: "deleted_at", type: "string" },
];

/** 剪辑片段实体 */
export const projectClipFields: FieldSpec<ProjectClip>[] = [
  { key: "id", type: "string" },
  { key: "project_id", type: "string" },
  { key: "storyboard_id", type: "string" },
  { key: "episode", type: "number" },
  { key: "scene", type: "string" },
  { key: "shot", type: "string" },
  { key: "title", type: "string" },
  { key: "name", type: "string" },
  { key: "description", type: "string" },
  { key: "source_video_url", type: "string" },
  { key: "thumbnail_url", type: "string" },
  { key: "duration", type: "number" },
  { key: "in_point", type: "string" },
  { key: "out_point", type: "string" },
  { key: "order_index", type: "number" },
  { key: "status", type: "string" },
  { key: "tags", type: "json" },
  { key: "notes", type: "string" },
  { key: "usage_count", type: "number" },
  { key: "version", type: "number" },
  { key: "created_at", type: "string" },
  { key: "updated_at", type: "string" },
  { key: "deleted_at", type: "string" },
];

// ==================== 剧本中心（Path B）相关实体 ====================

export const scriptFields: FieldSpec<Script>[] = [
  { key: "id", type: "string" },
  { key: "project_id", type: "string" },
  { key: "title", type: "string" },
  { key: "description", type: "string" },
  { key: "status", type: "string" },
  { key: "words", type: "number" },
  { key: "chapters", type: "number" },
  { key: "author", type: "string" },
  { key: "tags", type: "json" },
  { key: "version", type: "number" },
  { key: "created_at", type: "string" },
  { key: "updated_at", type: "string" },
  /** 软删时间戳(ISO),null/未设置 = 未删除。30 天后才能"彻底删除"。 */
  { key: "deleted_at", type: "string" },
];

/** 评审 P1-H11 修复：Path B（ProjectScript）的 schema，与 Path A 共用同一张 SQLite 表（scripts）。 */
export const projectScriptFields: FieldSpec<ProjectScript>[] = [
  { key: "id", type: "string" },
  { key: "project_id", type: "string" },
  { key: "episode", type: "number" },
  { key: "title", type: "string" },
  { key: "content", type: "string" },
  { key: "status", type: "string" },
  { key: "notes", type: "string" },
  { key: "created_at", type: "string" },
  { key: "updated_at", type: "string" },
];

export const assetFields: FieldSpec<Asset>[] = [
  { key: "id", type: "string" },
  { key: "project_id", type: "string" },
  { key: "name", type: "string" },
  { key: "type", type: "string" },
  { key: "file_url", type: "string" },
  { key: "size", type: "number" },
  { key: "format", type: "string" },
  { key: "tags", type: "json" },
  { key: "metadata", type: "json" },
  { key: "created_at", type: "string" },
  { key: "updated_at", type: "string" },
];

/** 评审 P1-H11 修复：Path B（ProjectAsset）的 schema */
export const projectAssetFields: FieldSpec<ProjectAsset>[] = [
  { key: "id", type: "string" },
  { key: "project_id", type: "string" },
  { key: "kind", type: "string" },
  { key: "name", type: "string" },
  { key: "created_at", type: "string" },
  { key: "updated_at", type: "string" },
];

export const reviewFields: FieldSpec<Review>[] = [
  { key: "id", type: "string" },
  { key: "project_id", type: "string" },
  { key: "content_type", type: "string" },
  { key: "content_id", type: "string" },
  { key: "content_title", type: "string" },
  { key: "result", type: "string" },
  { key: "score", type: "number" },
  { key: "comment", type: "string" },
  { key: "reviewer_id", type: "string" },
  { key: "reviewer_name", type: "string" },
  { key: "created_at", type: "string" },
  { key: "updated_at", type: "string" },
];

/** 评审 P1-H11 修复：Path B（ProjectReview）的 schema */
export const projectReviewFields: FieldSpec<ProjectReview>[] = [
  { key: "id", type: "string" },
  { key: "project_id", type: "string" },
  { key: "target_type", type: "string" },
  { key: "target_id", type: "string" },
  { key: "reviewer", type: "string" },
  { key: "status", type: "string" },
  { key: "comment", type: "string" },
  { key: "created_at", type: "string" },
  { key: "updated_at", type: "string" },
];

export const scriptDocumentFields: FieldSpec<ScriptDocument>[] = [
  { key: "id", type: "string" },
  { key: "project_id", type: "string" },
  { key: "editor_json", type: "string" },
  { key: "version", type: "number" },
  { key: "created_at", type: "string" },
  { key: "updated_at", type: "string" },
];

export const scriptEpisodeFields: FieldSpec<ScriptEpisode>[] = [
  { key: "id", type: "string" },
  { key: "project_id", type: "string" },
  { key: "document_id", type: "string" },
  { key: "episode_no", type: "number" },
  { key: "title", type: "string" },
  { key: "synopsis", type: "string" },
  { key: "status", type: "string" },
  { key: "created_at", type: "string" },
  { key: "updated_at", type: "string" },
];

export const scriptSceneFields: FieldSpec<ScriptScene>[] = [
  { key: "id", type: "string" },
  { key: "project_id", type: "string" },
  { key: "episode_id", type: "string" },
  { key: "scene_no", type: "number" },
  { key: "location_name", type: "string" },
  { key: "time_of_day", type: "string" },
  { key: "description", type: "string" },
  { key: "notes", type: "string" },
  { key: "created_at", type: "string" },
  { key: "updated_at", type: "string" },
];

export const scriptDialogueFields: FieldSpec<ScriptDialogue>[] = [
  { key: "id", type: "string" },
  { key: "project_id", type: "string" },
  { key: "scene_id", type: "string" },
  { key: "character_id", type: "string" },
  { key: "dialogue", type: "string" },
  { key: "emotion", type: "string" },
  { key: "order", type: "number" },
  { key: "created_at", type: "string" },
];

export const scriptSceneCharacterFields: FieldSpec<ScriptSceneCharacter>[] = [
  { key: "id", type: "string" },
  { key: "project_id", type: "string" },
  { key: "scene_id", type: "string" },
  { key: "character_asset_id", type: "string" },
  { key: "role_type", type: "string" },
  { key: "is_speaking", type: "boolean" },
  { key: "created_at", type: "string" },
];

export const scriptSceneLocationFields: FieldSpec<ScriptSceneLocation>[] = [
  { key: "id", type: "string" },
  { key: "project_id", type: "string" },
  { key: "scene_id", type: "string" },
  { key: "location_asset_id", type: "string" },
  { key: "created_at", type: "string" },
];

export const scriptTemplateFields: FieldSpec<ScriptTemplate>[] = [
  { key: "id", type: "string" },
  { key: "name", type: "string" },
  { key: "category", type: "string" },
  { key: "description", type: "string" },
  { key: "world_setting", type: "string" },
  { key: "character_templates", type: "json" },
  { key: "plot_structure", type: "string" },
  { key: "usage_count", type: "number" },
  { key: "rating", type: "number" },
  { key: "author", type: "string" },
  { key: "is_public", type: "boolean" },
  { key: "created_at", type: "string" },
  { key: "updated_at", type: "string" },
];

export const scriptTagFields: FieldSpec<ScriptTag>[] = [
  { key: "id", type: "string" },
  { key: "project_id", type: "string" },
  { key: "script_id", type: "string" },
  { key: "name", type: "string" },
  { key: "category", type: "string" },
  { key: "color", type: "string" },
  { key: "created_by", type: "string" },
  { key: "created_at", type: "string" },
];

export const scriptQualityAssessmentFields: FieldSpec<ScriptQualityAssessment>[] = [
  { key: "id", type: "string" },
  { key: "project_id", type: "string" },
  { key: "script_id", type: "string" },
  { key: "story_structure", type: "number" },
  { key: "character_development", type: "number" },
  { key: "dialogue_quality", type: "number" },
  { key: "pacing", type: "number" },
  { key: "consistency", type: "number" },
  { key: "originality", type: "number" },
  { key: "total_score", type: "number" },
  { key: "source", type: "string" },
  { key: "suggestions", type: "json" },
  { key: "assessed_by", type: "string" },
  { key: "assessed_at", type: "string" },
  { key: "created_at", type: "string" },
];

export const scriptApprovalFields: FieldSpec<ScriptApproval>[] = [
  { key: "id", type: "string" },
  { key: "project_id", type: "string" },
  { key: "script_id", type: "string" },
  { key: "status", type: "string" },
  { key: "current_step", type: "number" },
  { key: "total_steps", type: "number" },
  { key: "applicants", type: "json" },
  { key: "reviewers", type: "json" },
  { key: "comments", type: "json" },
  { key: "created_by", type: "string" },
  { key: "created_at", type: "string" },
  { key: "updated_at", type: "string" },
];

export const scriptBackupFields: FieldSpec<ScriptBackup>[] = [
  { key: "id", type: "string" },
  { key: "project_id", type: "string" },
  { key: "document_id", type: "string" },
  { key: "type", type: "string" },
  { key: "size", type: "number" },
  { key: "content", type: "json" },
  { key: "status", type: "string" },
  { key: "created_by", type: "string" },
  { key: "created_at", type: "string" },
  { key: "expires_at", type: "string" },
];
