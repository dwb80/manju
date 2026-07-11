export type Role = "system" | "user" | "assistant";
export type TaskStatus = "pending" | "processing" | "success" | "failed";
export type FavoriteType = "chat" | "image" | "video";

/** 三厂共性：通用资产版本类型（任务12：统一版本管理）。 */
export type AssetEntityType = "character" | "scene" | "prop";
export type AssetVersionChangeType = "create" | "update" | "restore";

/**
 * 资产版本快照（任务12：统一版本管理）。
 *
 * - entity_type + entity_id 指向具体的角色/场景/道具。
 * - version 是自增编号，从 1 开始。
 * - data 是该版本的完整 JSON 序列化（包含快照时刻的所有字段）。
 * - change_type 用于区分新建/修改/回滚来源。
 */
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

/** 收藏引用，ref_id 指向被收藏的会话、图片或视频任务。 */
export interface Favorite {
  id: string;
  type: FavoriteType;
  ref_id: string;
  created_at: string;
}

/** 用户偏好设置，当前由后端统一保存，前端启动后读取。 */
export interface Settings {
  theme: "light" | "dark" | "system";
  language: "zh-CN" | "en-US";
  fontSize: "small" | "medium" | "large";
  defaultChatModel: string;
  defaultImageSize: "1024x768" | "768x1024" | "1024x1024" | "1152x768" | "768x1152";
  defaultVideoRatio: "16:9" | "9:16" | "1:1";
}

/** 后端接口统一响应结构，前端 api() 会按这个格式解包。 */
export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}
