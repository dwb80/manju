import type { Conversation, Favorite, ImageTask, Message, Project, VideoTask } from "../types.js";
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
