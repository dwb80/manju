/**
 * @file common.ts
 * @description 通用类型定义，包括角色、任务状态、收藏、用户设置、API响应等基础类型
 */

/**
 * 消息角色类型
 * @property system - 系统消息
 * @property user - 用户消息
 * @property assistant - 助手消息
 */
export type Role = "system" | "user" | "assistant";

/**
 * 任务状态类型
 * @property pending - 等待中
 * @property processing - 处理中
 * @property success - 成功
 * @property failed - 失败
 */
export type TaskStatus = "pending" | "processing" | "success" | "failed";

/**
 * 收藏类型
 * @property chat - 聊天收藏
 * @property image - 图片收藏
 * @property video - 视频收藏
 * @property conversation - 会话收藏
 * @property message - 消息收藏
 */
export type FavoriteType = "chat" | "image" | "video" | "conversation" | "message";

/**
 * 通用资产实体类型（三厂共性）
 * @property character - 角色
 * @property scene - 场景
 * @property prop - 道具
 */
export type AssetEntityType = "character" | "scene" | "prop";

/**
 * 资产版本变更类型
 * @property create - 创建
 * @property update - 更新
 * @property restore - 恢复
 */
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
  user_id?: string;
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
  /** API Key：用于调用 AI 服务（评审优化 P2）。 */
  apiKey?: string;
  /** API Provider：openai / agnes / claude / custom。 */
  apiProvider?: "openai" | "agnes" | "claude" | "custom";
  /** API Base URL（自定义 provider 时使用）。 */
  apiBaseUrl?: string;
  /** 个人信息。 */
  userName?: string;
  userEmail?: string;
}

/** 后端接口统一响应结构，前端 api() 会按这个格式解包。 */
export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

/**
 * 应用审计日志（评审增量 P1-1：状态机变更 + P1-2：跨项目复制 / 软删除 / 恢复）。
 *
 * - 用途：把后端关键业务事件（视频任务状态机、跨项目资产复制、软删除 / 恢复）
 *   以结构化方式持久化，便于事后追踪、对账、构建运维面板。
 * - 不与 file logger（data/logs/*.log）冲突：file logger 用于排障，
 *   app_logs 用于业务侧审计，语义不同。
 * - entity_type + entity_id 指向被审计的业务实体。
 */
/**
 * 应用审计日志实体类型
 * @property video_task - 视频任务
 * @property image_task - 图片任务
 * @property audio_task - 音频任务
 * @property character - 角色
 * @property scene - 场景
 * @property prop - 道具
 * @property storyboard - 分镜
 * @property clip - 剪辑片段
 * @property script - 剧本
 * @property project - 项目
 */
export type AppLogEntityType =
  | "video_task"
  | "image_task"
  | "audio_task"
  | "character"
  | "scene"
  | "prop"
  | "storyboard"
  | "clip"
  | "script"
  | "project";

/**
 * 应用审计日志动作类型
 * @property video.status_changed - 视频状态变更
 * @property video.created - 视频创建
 * @property image.status_changed - 图片状态变更
 * @property audio.status_changed - 音频状态变更
 * @property asset.copied - 资产复制
 * @property asset.soft_deleted - 资产软删除
 * @property asset.restored - 资产恢复
 * @property script.imported - 剧本导入
 * @property script.exported - 剧本导出
 * @property script.soft_deleted - 剧本软删除
 * @property script.restored - 剧本恢复
 * @property script.purged - 剧本清除
 * @property client.error - 客户端错误
 * @property client.warn - 客户端警告
 */
export type AppLogAction =
  | "video.status_changed"
  | "video.created"
  | "image.status_changed"
  | "audio.status_changed"
  | "asset.copied"
  | "asset.soft_deleted"
  | "asset.restored"
  | "script.imported"
  | "script.exported"
  | "script.soft_deleted"
  | "script.restored"
  | "script.purged"
  | "client.error"
  | "client.warn";

export interface AppLog {
  id: string;
  entity_type: AppLogEntityType;
  entity_id: string;
  action: AppLogAction;
  /** 事件名（与 rootLogger event 字段一致），便于联合查询。 */
  event: string;
  /** 关键字段（如视频状态机的 from/to、复制源/目标项目 ID）。 */
  payload: string;
  /** 操作者（系统事件填 system；用户事件填用户名）。 */
  operator: string;
  project_id?: string;
  trace_id?: string;
  created_at: string;
}
