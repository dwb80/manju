import type { Conversation, Favorite, ImageTask, Message, Project, Settings, VideoTask, ScriptComment, AssetVersion } from "../types.js";
import type { Script } from "../types/script.js";
import type { Character } from "../types/character.js";
import type { Scene } from "../types/scene.js";
import type { Prop } from "../types/prop.js";
import type { Storyboard, ProjectStoryboard } from "../types/storyboard.js";
import type { Audio } from "../types/audio.js";
import type { ModuleVideoTask } from "../types/video.js";
import type { ProjectClip } from "../types/project.js";
import type { Asset } from "../types/asset.js";
import type { Review } from "../types/review.js";
import type { ScriptDocument, ScriptEpisode, ScriptScene, ScriptDialogue, ScriptSceneCharacter, ScriptSceneLocation, ScriptTemplate, ScriptTag, ScriptQualityAssessment, ScriptApproval, ScriptBackup } from "../types/script.js";
import type { FieldSpec } from "./csv.js";

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
  { key: "type", type: "string" },
  { key: "size", type: "number" },
  { key: "content", type: "json" },
  { key: "status", type: "string" },
  { key: "created_by", type: "string" },
  { key: "created_at", type: "string" },
  { key: "expires_at", type: "string" },
];
