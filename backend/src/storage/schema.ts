/**
 * @file schema.ts
 * @description 数据库表结构定义。
 *              导出所有业务实体的字段规格（FieldSpec），供 SqliteRepository 创建表、编解码字段使用。
 *              每个字段规格对应一张 SQLite 表的列定义。
 */

import type { Conversation, Favorite, ImageTask, Message, Project, Settings, VideoTask, ScriptComment, AssetVersion, CharacterImageHistory, PropImageHistory, SceneImageHistory, Todo, AppLog, WorkItem } from "../types.js";
import type { ModelConfig, ModelQuota, ModelCallLog } from "../types/model.js";
import type { Script, ProjectScript } from "../types/script.js";
import type { Character } from "../types/character.js";
import type { Scene } from "../types/scene.js";
import type { Prop } from "../types/prop.js";
import type { CharacterImage, PropImage, SceneImage } from "../types/asset-image.js";
import type { Storyboard, ProjectStoryboard, Shot, ShotSnapshot } from "../types/storyboard.js";
import type { Audio } from "../types/audio.js";
import type { ModuleVideoTask } from "../types/video.js";
import type { ProjectClip, ProjectTask, ProjectEpisode, ProjectIssue, ProjectMilestone, ProjectMember, PublishPlan } from "../types/project.js";
import type { Asset, ProjectAsset } from "../types/asset.js";
import type { Review, ProjectReview } from "../types/review.js";
import type { ScriptDocument, ScriptEpisode, ScriptScene, ScriptDialogue, ScriptSceneCharacter, ScriptSceneLocation, ScriptTemplate, ScriptTag, ScriptQualityAssessment, ScriptApproval, ScriptBackup, ScriptAnalyzedCharacter, ScriptAnalyzedScene, ScriptAnalyzedProp } from "../types/script.js";
import type { FieldSpec } from "./repository.js";
import type {
  SensitiveWord, ProjectBudget, AuditLog, Notification, PublishTemplate,
  ReviewItem, ReviewHistory, ReviewAssignment, ReviewPool, ReviewConfig,
  PublishAccount, PublishRecord, PublishChannel, PublishJob, PublishMetrics, ProjectPermission,
  ReviewSnapshot, ShotSubtitle, Timeline, TimelineShot, TimelineVersion,
} from "../types/horizontal.js";
import type { ProjectInvitation } from "../types/project.js";
import type { CostRecord } from "../types/horizontal.js";

export const conversationFields: FieldSpec<Conversation>[] = [
  { key: "id", type: "string" },
  { key: "user_id", type: "string" },
  { key: "title", type: "string" },
  { key: "model", type: "string" },
  { key: "mode", type: "string" },
  { key: "is_pinned", type: "boolean" },
  { key: "created_at", type: "string" },
  { key: "updated_at", type: "string" },
  { key: "project_id", type: "string" },
  // 未读助手消息计数：assistant 消息落库时 +1，进入会话时归零。
  // 0 视为已读；>0 在侧栏显示数字徽标。
  { key: "unread_count", type: "number" },
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
  // V2 增量字段（REQ-PROJ-001, 2026-07-22）。由 ensureColumns() 自动迁移：
  // 新表直接含此列，旧表 ALTER TABLE ADD COLUMN。旧数据此字段为 NULL，
  // 业务代码用 !p.deleted_at 同时兼容 NULL 与 ''。
  { key: "type", type: "string" },
  { key: "deleted_at", type: "string" },
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
  { key: "user_id", type: "string" },
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
  { key: "user_id", type: "string" },
  { key: "prompt", type: "string" },
  { key: "image_url", type: "string" },
  { key: "params", type: "json" },
  { key: "video_url", type: "string" },
  { key: "status", type: "string" },
  { key: "error", type: "string" },
  { key: "created_at", type: "string" },
  { key: "conversation_id", type: "string" },
  /** 关联的助手消息 ID，用于 queryVideo 把状态写回会话。 */
  { key: "message_id", type: "string" },
];

export const favoriteFields: FieldSpec<Favorite>[] = [
  { key: "id", type: "string" },
  { key: "user_id", type: "string" },
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

/**
 * 道具图片生成历史表字段。
 * 与 character_image_history 同构。
 */
export const propImageHistoryFields: FieldSpec<PropImageHistory>[] = [
  { key: "id", type: "string" },
  { key: "prop_id", type: "string" },
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

/**
 * 场景图片生成历史表字段。
 * 与 character_image_history 同构。
 */
export const sceneImageHistoryFields: FieldSpec<SceneImageHistory>[] = [
  { key: "id", type: "string" },
  { key: "scene_id", type: "string" },
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

/** 项目工作台任务。保留独立表以兼容现有工作台 API 与历史数据。 */
export const projectTaskFields: FieldSpec<ProjectTask>[] = [
  { key: "id", type: "string" }, { key: "project_id", type: "string" },
  { key: "title", type: "string" }, { key: "status", type: "string" },
  { key: "owner", type: "string" }, { key: "due_date", type: "string" },
  { key: "notes", type: "string" }, { key: "created_at", type: "string" },
  { key: "updated_at", type: "string" },
];

export const projectEpisodeFields: FieldSpec<ProjectEpisode>[] = [
  { key: "id", type: "string" }, { key: "project_id", type: "string" },
  { key: "episode", type: "number" }, { key: "title", type: "string" },
  { key: "status", type: "string" }, { key: "summary", type: "string" },
  { key: "due_date", type: "string" }, { key: "notes", type: "string" },
  { key: "created_at", type: "string" }, { key: "updated_at", type: "string" },
];

export const projectIssueFields: FieldSpec<ProjectIssue>[] = [
  { key: "id", type: "string" }, { key: "project_id", type: "string" },
  { key: "title", type: "string" }, { key: "severity", type: "string" },
  { key: "status", type: "string" }, { key: "owner", type: "string" },
  { key: "target_type", type: "string" }, { key: "target_id", type: "string" },
  { key: "notes", type: "string" }, { key: "created_at", type: "string" },
  { key: "updated_at", type: "string" },
];

export const projectMilestoneFields: FieldSpec<ProjectMilestone>[] = [
  { key: "id", type: "string" }, { key: "project_id", type: "string" },
  { key: "title", type: "string" }, { key: "status", type: "string" },
  { key: "owner", type: "string" }, { key: "due_date", type: "string" },
  { key: "description", type: "string" }, { key: "created_at", type: "string" },
  { key: "updated_at", type: "string" },
];

export const projectMemberFields: FieldSpec<ProjectMember>[] = [
  { key: "id", type: "string" }, { key: "project_id", type: "string" },
  { key: "name", type: "string" }, { key: "role", type: "string" },
  { key: "contact", type: "string" }, { key: "notes", type: "string" },
  { key: "created_at", type: "string" }, { key: "updated_at", type: "string" },
];

export const publishPlanFields: FieldSpec<PublishPlan>[] = [
  { key: "id", type: "string" }, { key: "project_id", type: "string" }, { key: "name", type: "string" },
  { key: "status", type: "string" }, { key: "plannedDate", type: "string" },
  { key: "publishedDate", type: "string" }, { key: "videos", type: "json" },
  { key: "platforms", type: "json" }, { key: "assignee", type: "string" },
  { key: "notes", type: "string" }, { key: "created_at", type: "string" },
  { key: "updated_at", type: "string" },
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

// ==================== 模型中心（任务：把 model_configs 从 legacy 迁回正常表） ====================

/**
 * 模型配置表字段。
 *
 * 历史问题：modelConfigs / modelQuotas / modelCallLogs 之前以 `[]` 形式创建 SqliteRepository，
 * 被 SqliteRepository 视为 legacy table → `findMany` 返回 []、`insert/update/delete` 抛错，
 * 直接导致 `seedModelConfigs()` 失败、`GET /api/models` 返回错误，前端模型中心一片空白。
 * 这里补齐 schema，让三张表回到正常业务表状态。
 */
export const modelConfigFields: FieldSpec<ModelConfig>[] = [
  { key: "id", type: "string" },
  { key: "name", type: "string" },
  { key: "type", type: "string" },
  { key: "description", type: "string" },
  { key: "isDefault", type: "boolean" },
  { key: "is_enabled", type: "boolean" },
  { key: "version", type: "string" },
  { key: "provider", type: "string" },
  { key: "api_config", type: "json" },
  { key: "capabilities", type: "json" },
  { key: "parameters", type: "json" },
  { key: "parameter_rules", type: "json" },
  { key: "pricing", type: "json" },
  { key: "performance", type: "json" },
  { key: "usageStats", type: "json" },
  { key: "tags", type: "json" },
  { key: "created_at", type: "string" },
  { key: "updated_at", type: "string" },
];

/**
 * 模型用户配额表字段（每日/每周/每月调用次数与预算上限）。
 */
export const modelQuotaFields: FieldSpec<ModelQuota>[] = [
  { key: "id", type: "string" },
  { key: "user_id", type: "string" },
  { key: "model_id", type: "string" },
  { key: "daily_limit", type: "number" },
  { key: "daily_used", type: "number" },
  { key: "weekly_limit", type: "number" },
  { key: "weekly_used", type: "number" },
  { key: "monthly_limit", type: "number" },
  { key: "monthly_used", type: "number" },
  { key: "budget_limit", type: "number" },
  { key: "budget_used", type: "number" },
  { key: "reset_at", type: "string" },
  { key: "created_at", type: "string" },
  { key: "updated_at", type: "string" },
];

/**
 * 模型调用日志表字段。
 */
export const modelCallLogFields: FieldSpec<ModelCallLog>[] = [
  { key: "id", type: "string" },
  { key: "user_id", type: "string" },
  { key: "model_id", type: "string" },
  { key: "model_type", type: "string" },
  { key: "task_type", type: "string" },
  { key: "input_tokens", type: "number" },
  { key: "output_tokens", type: "number" },
  { key: "cost", type: "number" },
  { key: "duration", type: "number" },
  { key: "status", type: "string" },
  { key: "error_message", type: "string" },
  { key: "created_at", type: "string" },
];

// ==================== 三大工厂：角色/场景/道具 ====================

export const characterFields: FieldSpec<Character>[] = [
  { key: "id", type: "string" },
  { key: "project_id", type: "string" },
  { key: "script_id", type: "string" },
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
  // === AI 剧本分析扩展字段 ===
  { key: "identity", type: "string" },
  { key: "face", type: "string" },
  { key: "hair", type: "string" },
  { key: "body", type: "string" },
  { key: "temperament", type: "string" },
  { key: "costume_name", type: "string" },
  { key: "costume_description", type: "string" },
  { key: "costume_color", type: "string" },
  { key: "costume_material", type: "string" },
  { key: "costume_style", type: "string" },
  { key: "accessories", type: "json" },
  { key: "emotion_states", type: "string" },
  { key: "action_assets", type: "string" },
  { key: "relationships", type: "string" },
  { key: "first_appearance", type: "string" },
  { key: "dialogue_count", type: "number" },
  { key: "generation_prompt", type: "string" },
  { key: "confidence", type: "string" },
  // === 4 中心横切：参考图锁定（详见 docs/spec.md 3.3）===
  { key: "reference_image_id", type: "string" },
];

export const sceneFields: FieldSpec<Scene>[] = [
  { key: "id", type: "string" },
  { key: "project_id", type: "string" },
  // 来源剧本 id（可空），由 AI apply 流程在首次创建时填入
  { key: "script_id", type: "string" },
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
  // === AI 剧本分析扩展字段（与 AIScene 对齐） ===
  { key: "category", type: "string" },
  { key: "indoor_outdoor", type: "string" },
  { key: "location", type: "string" },
  { key: "architecture", type: "string" },
  { key: "terrain", type: "string" },
  { key: "plants", type: "string" },
  { key: "objects", type: "string" },
  { key: "period", type: "string" },
  { key: "tone", type: "string" },
  { key: "visual_style", type: "string" },
  { key: "atmosphere_emotion", type: "string" },
  { key: "suitable_shots", type: "string" },
  { key: "reusable_elements", type: "string" },
  { key: "generation_prompt", type: "string" },
  { key: "first_appearance", type: "string" },
  { key: "confidence", type: "string" },
  // === 4 中心横切：参考图锁定 ===
  { key: "reference_image_id", type: "string" },
];

export const propFields: FieldSpec<Prop>[] = [
  { key: "id", type: "string" },
  { key: "project_id", type: "string" },
  { key: "script_id", type: "string" },
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
  // === AI 剧本分析扩展字段（与 AIProp 对齐） ===
  { key: "importance_level", type: "string" },
  { key: "owner", type: "string" },
  { key: "shape", type: "string" },
  { key: "texture", type: "string" },
  { key: "story_function", type: "string" },
  { key: "visual_features", type: "string" },
  { key: "camera_usage", type: "string" },
  { key: "generation_prompt", type: "string" },
  { key: "first_appearance", type: "string" },
  { key: "confidence", type: "string" },
];

// ==================== 工厂资产图片（一对多） ====================

/**
 * 角色图片（一对多）
 * - url: 图 URL 或 base64
 * - view_type: portrait / full-body / action / costume / close-up
 * - is_primary: 0 或 1，只允许一条为 1（同一 character 内）
 * - prompt: 生成该图的 prompt
 * - script_id: 该图对应的来源剧本（可空，跨剧本通用图不设）
 */
export const characterImageFields: FieldSpec<CharacterImage>[] = [
  { key: "id", type: "string" },
  { key: "character_id", type: "string" },
  { key: "project_id", type: "string" },
  { key: "script_id", type: "string" },
  { key: "url", type: "string" },
  { key: "prompt", type: "string" },
  { key: "view_type", type: "string" },
  { key: "is_primary", type: "number" },
  { key: "created_at", type: "string" },
  { key: "updated_at", type: "string" },
];

/**
 * 场景图片（一对多）
 * - view_type: day / night / rain / sunset / wide / close 等
 */
export const sceneImageFields: FieldSpec<SceneImage>[] = [
  { key: "id", type: "string" },
  { key: "scene_id", type: "string" },
  { key: "project_id", type: "string" },
  { key: "script_id", type: "string" },
  { key: "url", type: "string" },
  { key: "prompt", type: "string" },
  { key: "view_type", type: "string" },
  { key: "is_primary", type: "number" },
  { key: "created_at", type: "string" },
  { key: "updated_at", type: "string" },
];

/**
 * 道具图片（一对多）
 * - view_type: front / side / detail / context 等
 */
export const propImageFields: FieldSpec<PropImage>[] = [
  { key: "id", type: "string" },
  { key: "prop_id", type: "string" },
  { key: "project_id", type: "string" },
  { key: "script_id", type: "string" },
  { key: "url", type: "string" },
  { key: "prompt", type: "string" },
  { key: "view_type", type: "string" },
  { key: "is_primary", type: "number" },
  { key: "created_at", type: "string" },
  { key: "updated_at", type: "string" },
];

// ==================== 独立模块：分镜/音频/视频/剪辑 ====================

/** 分镜实体（V2：纯分镜，导演台层面）。 */
export const storyboardFields: FieldSpec<Storyboard>[] = [
  { key: "id", type: "string" },
  { key: "project_id", type: "string" },
  { key: "episode_id", type: "string" },
  { key: "scene_id", type: "string" },
  { key: "episode", type: "number" },
  { key: "storyboard_number", type: "string" },
  { key: "title", type: "string" },
  { key: "description", type: "string" },
  { key: "dialogue", type: "string" },
  { key: "notes", type: "string" },
  { key: "status", type: "string" },
  { key: "order", type: "number" },
  { key: "character_asset_ids", type: "json" },
  { key: "prop_asset_ids", type: "json" },
  { key: "version", type: "number" },
  { key: "created_at", type: "string" },
  { key: "updated_at", type: "string" },
  { key: "deleted_at", type: "string" },
];

/** 镜头实体（V2 新增，属于一个分镜）。 */
export const shotFields: FieldSpec<Shot>[] = [
  { key: "id", type: "string" },
  { key: "project_id", type: "string" },
  { key: "storyboard_id", type: "string" },
  { key: "scene_id", type: "string" },
  { key: "episode", type: "number" },
  { key: "shot_number", type: "string" },
  { key: "title", type: "string" },
  { key: "description", type: "string" },
  { key: "duration", type: "number" },
  { key: "shot_size", type: "string" },
  { key: "camera_angle", type: "string" },
  { key: "camera_movement", type: "string" },
  { key: "dialogue", type: "string" },
  { key: "notes", type: "string" },
  { key: "image_url", type: "string" },
  { key: "video_task_id", type: "string" },
  { key: "video_url", type: "string" },
  { key: "status", type: "string" },
  { key: "order", type: "number" },
  { key: "character_asset_ids", type: "json" },
  { key: "prop_asset_ids", type: "json" },
  { key: "version", type: "number" },
  { key: "created_at", type: "string" },
  { key: "updated_at", type: "string" },
  { key: "deleted_at", type: "string" },
];

/** 镜头快照表（不可变版本历史）。 */
export const shotSnapshotFields: FieldSpec<ShotSnapshot>[] = [
  { key: "id", type: "string" },
  { key: "project_id", type: "string" },
  { key: "shot_id", type: "string" },
  { key: "version", type: "number" },
  { key: "data", type: "string" },
  { key: "change_note", type: "string" },
  { key: "created_by", type: "string" },
  { key: "created_at", type: "string" },
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
  /* V2 W11 AUDIO-F14：口型结果绑定字段 */
  { key: "lip_sync_job_id", type: "string" },
  { key: "lip_sync_status", type: "string" },
  { key: "lip_sync_video_id", type: "string" },
  { key: "lip_sync_error", type: "string" },
  { key: "lip_sync_completed_at", type: "string" },
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
  { key: "deleted_at", type: "string" },
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
  // ===== 方案 A 合并（Path A → Path B）：元数据并入 document =====
  { key: "title", type: "string" },
  { key: "author", type: "string" },
  { key: "status", type: "string" },
  { key: "genre", type: "string" },
  { key: "words", type: "number" },
  { key: "chapters", type: "number" },
  // ===== 原有内容字段 =====
  { key: "editor_json", type: "string" },
  { key: "version", type: "number" },
  { key: "created_at", type: "string" },
  { key: "updated_at", type: "string" },
  { key: "tags", type: "json" },
  { key: "deleted_at", type: "string" },
  // ===== 剧本导入：完整 AI 数据持久化字段 =====
  { key: "ai_raw_data", type: "string" },
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
  { key: "updated_at", type: "string" },
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

/** 剧本分析提取的角色字段（与 Character 表字段对齐；图片走 factory，不在此处） */
export const scriptAnalyzedCharacterFields: FieldSpec<ScriptAnalyzedCharacter>[] = [
  { key: "id", type: "string" },
  { key: "document_id", type: "string" },
  { key: "project_id", type: "string" },
  { key: "name", type: "string" },
  { key: "role", type: "string" },
  { key: "gender", type: "string" },
  { key: "age", type: "string" },
  { key: "description", type: "string" },
  { key: "appearance", type: "string" },
  { key: "personality", type: "string" },
  { key: "traits", type: "json" },
  { key: "tags", type: "json" },
  { key: "factory_character_id", type: "string" },
  { key: "status", type: "string" },
  { key: "created_at", type: "string" },
  { key: "updated_at", type: "string" },
  // === AI 剧本分析扩展字段（与 characterFields 对齐） ===
  { key: "identity", type: "string" },
  { key: "face", type: "string" },
  { key: "hair", type: "string" },
  { key: "body", type: "string" },
  { key: "temperament", type: "string" },
  { key: "costume_name", type: "string" },
  { key: "costume_description", type: "string" },
  { key: "costume_color", type: "string" },
  { key: "costume_material", type: "string" },
  { key: "costume_style", type: "string" },
  { key: "accessories", type: "json" },
  { key: "emotion_states", type: "string" },
  { key: "action_assets", type: "string" },
  { key: "relationships", type: "string" },
  { key: "first_appearance", type: "string" },
  { key: "dialogue_count", type: "number" },
  { key: "generation_prompt", type: "string" },
  { key: "confidence", type: "string" },
];

/** 剧本分析提取的场景字段（与 Scene 表字段对齐：type 替代 scene_type） */
export const scriptAnalyzedSceneFields: FieldSpec<ScriptAnalyzedScene>[] = [
  { key: "id", type: "string" },
  { key: "document_id", type: "string" },
  { key: "project_id", type: "string" },
  { key: "name", type: "string" },
  /** 场景类型：indoor / outdoor / virtual —— 与 factory.sceneFields 字段名一致
   *  旧数据有 scene_type 列会被 ensureColumns 自动添加并保留，
   *  读取时由 service 层回退处理（sceneType ?? type） */
  { key: "type", type: "string" },
  { key: "scene_type", type: "string" },
  { key: "description", type: "string" },
  { key: "lighting", type: "string" },
  { key: "time_of_day", type: "string" },
  { key: "weather", type: "string" },
  { key: "tags", type: "json" },
  { key: "factory_scene_id", type: "string" },
  { key: "status", type: "string" },
  { key: "created_at", type: "string" },
  { key: "updated_at", type: "string" },
  // === AI 剧本分析扩展字段（与 sceneFields 对齐） ===
  { key: "category", type: "string" },
  { key: "indoor_outdoor", type: "string" },
  { key: "location", type: "string" },
  { key: "architecture", type: "string" },
  { key: "terrain", type: "string" },
  { key: "plants", type: "string" },
  { key: "objects", type: "string" },
  { key: "period", type: "string" },
  { key: "tone", type: "string" },
  { key: "visual_style", type: "string" },
  { key: "atmosphere_emotion", type: "string" },
  { key: "suitable_shots", type: "json" },
  { key: "reusable_elements", type: "json" },
  { key: "generation_prompt", type: "string" },
  { key: "first_appearance", type: "string" },
  { key: "confidence", type: "string" },
];

/** 剧本分析提取的道具字段（与 Prop 表字段对齐：补 appearance / size） */
export const scriptAnalyzedPropFields: FieldSpec<ScriptAnalyzedProp>[] = [
  { key: "id", type: "string" },
  { key: "document_id", type: "string" },
  { key: "project_id", type: "string" },
  { key: "name", type: "string" },
  { key: "category", type: "string" },
  { key: "description", type: "string" },
  { key: "appearance", type: "string" },
  { key: "material", type: "string" },
  { key: "size", type: "string" },
  { key: "color", type: "string" },
  { key: "tags", type: "json" },
  { key: "factory_prop_id", type: "string" },
  { key: "status", type: "string" },
  { key: "created_at", type: "string" },
  { key: "updated_at", type: "string" },
  // === AI 剧本分析扩展字段（与 propFields 对齐） ===
  { key: "importance_level", type: "string" },
  { key: "owner", type: "string" },
  { key: "shape", type: "string" },
  { key: "texture", type: "string" },
  { key: "story_function", type: "string" },
  { key: "visual_features", type: "json" },
  { key: "camera_usage", type: "json" },
  { key: "generation_prompt", type: "string" },
  { key: "first_appearance", type: "string" },
  { key: "confidence", type: "string" },
];

// ==================== 4 中心横切能力（详见 docs/spec.md 第三节）====================
//
// 5 张横切表（sensitive_words / project_budgets / audit_logs / notifications / publish_templates）
// 的 FieldSpec 与类型定义统一在 types/horizontal.ts 维护，这里 re-export 出去，
// 让 app.ts 等调用方沿用 `import { ... } from "../storage/schema.js"` 的旧约定。

export {
  sensitiveWordFields,
  projectBudgetFields,
  auditLogFields,
  notificationFields,
  publishTemplateFields,
  // 4 中心（spec 4.1 审核 + 4.2 发布 + 4.4 系统管理）
  reviewItemFields,
  publishAccountFields,
  publishRecordFields,
  projectPermissionFields,
  // P0-08 / 业务扩展
  costRecordFields,
  reviewHistoryFields,
  reviewAssignmentFields,
  reviewPoolFields,
  reviewConfigFields,
  // V2 W12 P0 REQ-REVIEW-F01 / REQ-AUDIO-F08-F10 / REQ-EDIT-F01-F10
  reviewSnapshotFields,
  shotSubtitleFields,
  timelineFields,
  timelineShotFields,
  timelineVersionFields,
  publishChannelFields,
  publishJobFields,
  publishMetricsFields,
} from "../types/horizontal.js";

/** 项目成员邀请表字段。表名 project_invitations。 */
export const projectInvitationFields: FieldSpec<ProjectInvitation>[] = [
  { key: "id", type: "string" },
  { key: "project_id", type: "string" },
  { key: "email", type: "string" },
  { key: "role", type: "string" },
  { key: "token", type: "string" },
  { key: "status", type: "string" },
  { key: "invited_by", type: "string" },
  { key: "expires_at", type: "string" },
  { key: "created_at", type: "string" },
  { key: "responded_at", type: "string" },
];
export type {
  SensitiveWord,
  SensitiveWordCategory,
  SensitiveWordSeverity,
  ProjectBudget,
  AuditLog,
  Notification,
  PublishTemplate,
  PublishContentType,
  // 4 中心（spec 4.1 审核 + 4.2 发布 + 4.4 系统管理）
  ReviewItem,
  ReviewTargetType,
  ReviewStatus,
  RejectionReasonCode,
  PublishAccount,
  PublishRecord,
  ProjectPermission,
  ProjectVisibility,
  // P0-08 / 业务扩展
  CostRecord,
  ReviewHistory,
  ReviewAction,
  ReviewAssignment,
  ReviewAssignmentStatus,
  ReviewPool,
  ReviewConfig,
  PublishChannel,
  PublishChannelCode,
  PublishJob,
  PublishJobStatus,
  PublishMetrics,
} from "../types/horizontal.js";
