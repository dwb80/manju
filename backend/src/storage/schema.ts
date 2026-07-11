import type { Conversation, Favorite, ImageTask, Message, Project, VideoTask, ScriptComment, AssetVersion } from "../types.js";
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
 *
 * - data 字段为 JSON 字符串，存放对应实体的完整快照。
 * - version 自增，从 1 开始。
 * - change_type 区分 create/update/restore。
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
