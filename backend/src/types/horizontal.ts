/**
 * @file horizontal.ts
 * @description 4 中心横切业务实体类型定义（敏感词 / 预算 / 审计 / 通知 / 发布 / 审核）。
 *
 * 来源：V1 业务表的 SQL 表结构 + V2 扩展。
 * 表名空间：sensitive_words / project_budgets / cost_records / audit_logs /
 *          notifications / publish_templates / review_items / review_histories /
 *          review_assignments / review_pools / review_configs / publish_accounts /
 *          publish_records / publish_channels / publish_jobs / publish_metrics /
 *          project_permissions
 */
import type { FieldSpec } from "../storage/repository.js";

/* ==================== 敏感词库（V1）==================== */
export type SensitiveWordCategory = "politics" | "porn" | "violence" | "ad" | "platform";
export type SensitiveWordSeverity = 1 | 2;

export interface SensitiveWord {
  id: string;
  word: string;
  category: SensitiveWordCategory;
  severity: SensitiveWordSeverity;
  enabled: boolean;
  created_at: string;
  created_by?: string;
}

export const sensitiveWordFields: FieldSpec<SensitiveWord>[] = [
  { key: "id", type: "string" },
  { key: "word", type: "string" },
  { key: "category", type: "string" },
  { key: "severity", type: "number" },
  { key: "enabled", type: "boolean" },
  { key: "created_at", type: "string" },
  { key: "created_by", type: "string" },
];

/* ==================== 项目预算（V1）==================== */
export interface ProjectBudget {
  id: string;
  project_id: string;
  monthly_limit: number | null;
  alert_threshold: number;
  hard_cap: number | null;
  created_at: string;
  updated_at: string;
  updated_by?: string;
}

export const projectBudgetFields: FieldSpec<ProjectBudget>[] = [
  { key: "id", type: "string" },
  { key: "project_id", type: "string" },
  { key: "monthly_limit", type: "number" },
  { key: "alert_threshold", type: "number" },
  { key: "hard_cap", type: "number" },
  { key: "created_at", type: "string" },
  { key: "updated_at", type: "string" },
  { key: "updated_by", type: "string" },
];

/* ==================== 成本流水（P0-08）==================== */
export type CostSource = "image" | "video" | "tts" | "manual";

export interface CostRecord {
  id: string;
  project_id: string;
  /** 月份键，格式 `YYYY-MM`，按 UTC。 */
  month_key: string;
  amount: number;
  source: CostSource;
  ref_type: string;
  ref_id: string;
  /** 幂等键：image_task_id / video_task_id / tts_task_id + 业务侧 hash，避免重试重入。 */
  idempotency_key: string;
  note: string;
  created_at: string;
}

export const costRecordFields: FieldSpec<CostRecord>[] = [
  { key: "id", type: "string" },
  { key: "project_id", type: "string" },
  { key: "month_key", type: "string" },
  { key: "amount", type: "number" },
  { key: "source", type: "string" },
  { key: "ref_type", type: "string" },
  { key: "ref_id", type: "string" },
  { key: "idempotency_key", type: "string" },
  { key: "note", type: "string" },
  { key: "created_at", type: "string" },
];

/* ==================== 审计日志（V1）==================== */
export interface AuditLog {
  id: string;
  actor_id: string;
  action: string;
  target_type: string;
  target_id?: string;
  /** JSON 字符串，包含变更详情（diff 摘要 / 关联 id）。 */
  payload: string;
  ip?: string;
  created_at: string;
}

export const auditLogFields: FieldSpec<AuditLog>[] = [
  { key: "id", type: "string" },
  { key: "actor_id", type: "string" },
  { key: "action", type: "string" },
  { key: "target_type", type: "string" },
  { key: "target_id", type: "string" },
  { key: "payload", type: "string" },
  { key: "ip", type: "string" },
  { key: "created_at", type: "string" },
];

/* ==================== 通知（V1）==================== */
export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  /** JSON 字符串，href / refId 等扩展字段。 */
  payload: string;
  read_at?: string;
  created_at: string;
}

export const notificationFields: FieldSpec<Notification>[] = [
  { key: "id", type: "string" },
  { key: "user_id", type: "string" },
  { key: "type", type: "string" },
  { key: "title", type: "string" },
  { key: "body", type: "string" },
  { key: "payload", type: "string" },
  { key: "read_at", type: "string" },
  { key: "created_at", type: "string" },
];

/* ==================== 发布平台模板（V1）==================== */
type HorizontalPublishPlatform = "xiaohongshu" | "douyin" | "bilibili" | "weixin_video" | "weibo";
export { type HorizontalPublishPlatform };
export type PublishContentType = "title" | "cover" | "intro";

export interface PublishTemplate {
  id: string;
  platform: HorizontalPublishPlatform;
  content_type: PublishContentType;
  /** 模板字符串，`{title}` `{character}` 等占位符由 publish-template-service 渲染。 */
  template: string;
  created_by?: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
}

export const publishTemplateFields: FieldSpec<PublishTemplate>[] = [
  { key: "id", type: "string" },
  { key: "platform", type: "string" },
  { key: "content_type", type: "string" },
  { key: "template", type: "string" },
  { key: "created_by", type: "string" },
  { key: "updated_by", type: "string" },
  { key: "created_at", type: "string" },
  { key: "updated_at", type: "string" },
];

/* ==================== 审核中心（spec 4.1）==================== */
export type ReviewTargetType =
  | "script"
  | "storyboard"
  | "character_image"
  | "scene_image"
  | "audio"
  | "video"
  | "shot"
  | "character"
  | "scene"
  | "prop"
  | "project"
  | "episode"
  | "dialogue"
  | "pipeline_run"
  | "pipeline_node";

/** 3 → 7 状态机：pending → in_review → (approved | rejected) → (closed | needs_fix) → ...  */
export type ReviewStatus =
  | "pending"
  | "in_review"
  | "approved"
  | "rejected"
  | "needs_fix"
  | "closed"
  | "cancelled";

export type RejectionReasonCode =
  | "character_inconsistent"
  | "costume_wrong"
  | "proportion_off"
  | "lighting_unreasonable"
  | "sensitive_content"
  | "dialogue_error"
  | "visual_error"
  | "asset_error"
  | "plot_mismatch"
  | "shot_issue"
  | "other";

export interface ReviewItem {
  id: string;
  target_type: ReviewTargetType;
  target_id: string;
  project_id: string;
  status: ReviewStatus;
  rejected_count: number;
  rejection_reason: RejectionReasonCode | "";
  approved_at: string;
  submitted_by: string;
  reviewed_by: string;
  created_at: string;
  updated_at: string;
  // V2 扩展字段
  title?: string;
  description?: string;
  priority?: string;
  approved_by?: string;
  rejected_by?: string;
  rejected_at?: string;
  rejection_reason_code?: string;
  re_submit_count?: number;
  approval_level?: number;
  current_level?: number;
  version?: number;
  deleted_at?: string;
  // V2 W8 REQ-PIPE-005-03 SLA 升级：状态字段（V1 业务无；由 ensureColumns() 自动迁移）
  /** SLA 到期时间（ISO 字符串）。空串/NULL/缺失表示无 SLA 约束（V1 兼容）。
   *  pending 状态 = created_at + sla_pending_hours
   *  in_review 状态 = updated_at（进入 in_review 的时刻）+ sla_review_hours
   */
  sla_due_at: string;
  /** SLA 升级等级：0=未升级 / 1=L1 reviewer / 2=L2 owner / 3=L3 webhook。
   *  单调递增，不允许降级（除非管理员手动 reset）。
   */
  escalation_level: number;
  /** 最后一次升级时间（ISO 字符串）。空串表示从未升级。 */
  escalated_at: string;
  /** 首次进入超时态时间（ISO 字符串）。空串表示未超时。幂等：不覆盖已有值。 */
  breached_at: string;
  // V2 W12 P0 REQ-REVIEW-F16：前序 review 链（resubmit 时写入）
  previous_review_id: string;
  chain_id: string;
}

export const reviewItemFields: FieldSpec<ReviewItem>[] = [
  { key: "id", type: "string" },
  { key: "target_type", type: "string" },
  { key: "target_id", type: "string" },
  { key: "project_id", type: "string" },
  { key: "status", type: "string" },
  { key: "rejected_count", type: "number" },
  { key: "rejection_reason", type: "string" },
  { key: "approved_at", type: "string" },
  { key: "submitted_by", type: "string" },
  { key: "reviewed_by", type: "string" },
  { key: "created_at", type: "string" },
  { key: "updated_at", type: "string" },
  { key: "title", type: "string" },
  { key: "description", type: "string" },
  { key: "priority", type: "string" },
  { key: "approved_by", type: "string" },
  { key: "rejected_by", type: "string" },
  { key: "rejected_at", type: "string" },
  { key: "rejection_reason_code", type: "string" },
  { key: "re_submit_count", type: "number" },
  { key: "approval_level", type: "number" },
  { key: "current_level", type: "number" },
  { key: "version", type: "number" },
  { key: "deleted_at", type: "string" },
  // V2 W8 REQ-PIPE-005-03 SLA 升级：状态字段
  { key: "sla_due_at", type: "string" },
  { key: "escalation_level", type: "number" },
  { key: "escalated_at", type: "string" },
  { key: "breached_at", type: "string" },
  // V2 W12 P0 REQ-REVIEW-F16：前序 review 链
  { key: "previous_review_id", type: "string" },
  { key: "chain_id", type: "string" },
];

export type ReviewAction =
  | "submit"
  | "approve"
  | "reject"
  | "cancel"
  | "close"
  | "resubmit"
  | "assign"
  | "transfer"
  | "start_review";

export interface ReviewHistory {
  id: string;
  review_id: string;
  from_status: ReviewStatus | "";
  to_status: ReviewStatus;
  action: ReviewAction;
  actor_id: string;
  comment: string;
  /** JSON 字符串，扩展元数据（rejectedCount、reasonCode、reSubmitCount 等）。 */
  metadata: string;
  created_at: string;
}

export const reviewHistoryFields: FieldSpec<ReviewHistory>[] = [
  { key: "id", type: "string" },
  { key: "review_id", type: "string" },
  { key: "from_status", type: "string" },
  { key: "to_status", type: "string" },
  { key: "action", type: "string" },
  { key: "actor_id", type: "string" },
  { key: "comment", type: "string" },
  { key: "metadata", type: "string" },
  { key: "created_at", type: "string" },
];

export type ReviewAssignmentStatus = "pending" | "in_progress" | "completed" | "transferred";

export interface ReviewAssignment {
  id: string;
  review_id: string;
  reviewer_id: string;
  level: number;
  status: ReviewAssignmentStatus;
  assigned_at: string;
  completed_at: string;
  created_at: string;
}

export const reviewAssignmentFields: FieldSpec<ReviewAssignment>[] = [
  { key: "id", type: "string" },
  { key: "review_id", type: "string" },
  { key: "reviewer_id", type: "string" },
  { key: "level", type: "number" },
  { key: "status", type: "string" },
  { key: "assigned_at", type: "string" },
  { key: "completed_at", type: "string" },
  { key: "created_at", type: "string" },
];

export interface ReviewPool {
  id: string;
  project_id: string;
  user_id: string;
  is_available: boolean;
  available_until: string;
  load_count: number;
  created_at: string;
  updated_at: string;
}

export const reviewPoolFields: FieldSpec<ReviewPool>[] = [
  { key: "id", type: "string" },
  { key: "project_id", type: "string" },
  { key: "user_id", type: "string" },
  { key: "is_available", type: "boolean" },
  { key: "available_until", type: "string" },
  { key: "load_count", type: "number" },
  { key: "created_at", type: "string" },
  { key: "updated_at", type: "string" },
];

export interface ReviewConfig {
  id: string;
  project_id: string;
  approval_levels: number;
  auto_assign_enabled: boolean;
  load_threshold: number;
  sla_pending_hours: number;
  sla_review_hours: number;
  // V2 W8 REQ-PIPE-005-03 SLA 升级：开关与上限
  /** 是否启用 SLA 自动升级（true=监控器扫描并升级；false=只标记 breached_at 不升级）。默认 true。 */
  escalation_enabled: boolean;
  /** 升级最大等级：0=不升级 / 1=L1 reviewer / 2=L2 owner / 3=L3 webhook。默认 2。 */
  escalation_max_level: number;
  created_at: string;
  updated_at: string;
}

export const reviewConfigFields: FieldSpec<ReviewConfig>[] = [
  { key: "id", type: "string" },
  { key: "project_id", type: "string" },
  { key: "approval_levels", type: "number" },
  { key: "auto_assign_enabled", type: "boolean" },
  { key: "load_threshold", type: "number" },
  { key: "sla_pending_hours", type: "number" },
  { key: "sla_review_hours", type: "number" },
  // V2 W8 REQ-PIPE-005-03 SLA 升级
  { key: "escalation_enabled", type: "boolean" },
  { key: "escalation_max_level", type: "number" },
  { key: "created_at", type: "string" },
  { key: "updated_at", type: "string" },
];

/** ReviewConfig 默认值（V2 W8 REQ-PIPE-005-03）。 */
export const DEFAULT_REVIEW_CONFIG: Omit<ReviewConfig, "id" | "project_id" | "created_at" | "updated_at"> = {
  approval_levels: 1,
  auto_assign_enabled: false,
  load_threshold: 5,
  sla_pending_hours: 24,
  sla_review_hours: 48,
  escalation_enabled: true,
  escalation_max_level: 2,
};

/** ReviewConfig 字段范围约束（V2 W8 REQ-PIPE-005-03）。 */
export const REVIEW_CONFIG_LIMITS = {
  /** sla_pending_hours 最小值（小时）。 */
  SLA_PENDING_HOURS_MIN: 1,
  /** sla_pending_hours 最大值（小时）。 */
  SLA_PENDING_HOURS_MAX: 24 * 30, // 30 天
  /** sla_review_hours 最小值（小时）。 */
  SLA_REVIEW_HOURS_MIN: 1,
  /** sla_review_hours 最大值（小时）。 */
  SLA_REVIEW_HOURS_MAX: 24 * 30, // 30 天
  /** escalation_max_level 最大值（0-3）。 */
  ESCALATION_MAX_LEVEL_MAX: 3,
} as const;

/* ==================== 发布中心（spec 4.2）==================== */
export interface PublishAccount {
  id: string;
  project_id: string;
  platform: string;
  account_name: string;
  login_note: string;
  created_at: string;
  updated_at: string;
  channel_id?: string;
  open_id?: string;
  access_token?: string;
  refresh_token?: string;
  token_expires_at?: string;
  status?: string;
  group_id?: string;
  last_synced_at?: string;
  deleted_at?: string;
}

export const publishAccountFields: FieldSpec<PublishAccount>[] = [
  { key: "id", type: "string" },
  { key: "project_id", type: "string" },
  { key: "platform", type: "string" },
  { key: "account_name", type: "string" },
  { key: "login_note", type: "string" },
  { key: "created_at", type: "string" },
  { key: "updated_at", type: "string" },
  { key: "channel_id", type: "string" },
  { key: "open_id", type: "string" },
  { key: "access_token", type: "string" },
  { key: "refresh_token", type: "string" },
  { key: "token_expires_at", type: "string" },
  { key: "status", type: "string" },
  { key: "group_id", type: "string" },
  { key: "last_synced_at", type: "string" },
  { key: "deleted_at", type: "string" },
];

export interface PublishRecord {
  id: string;
  episode_id: string;
  project_id: string;
  platform: string;
  published_at: string;
  external_url: string;
  metrics_json: string;
  created_at: string;
  updated_at: string;
}

export const publishRecordFields: FieldSpec<PublishRecord>[] = [
  { key: "id", type: "string" },
  { key: "episode_id", type: "string" },
  { key: "project_id", type: "string" },
  { key: "platform", type: "string" },
  { key: "published_at", type: "string" },
  { key: "external_url", type: "string" },
  { key: "metrics_json", type: "string" },
  { key: "created_at", type: "string" },
  { key: "updated_at", type: "string" },
];

export type PublishChannelCode =
  | "douyin"
  | "kuaishou"
  | "bilibili"
  | "xiaohongshu"
  | "wechat_channel";

export interface PublishChannel {
  id: string;
  code: PublishChannelCode;
  name: string;
  api_endpoint: string;
  oauth_authorize_url: string;
  oauth_token_url: string;
  spec_template: string;
  capabilities: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const publishChannelFields: FieldSpec<PublishChannel>[] = [
  { key: "id", type: "string" },
  { key: "code", type: "string" },
  { key: "name", type: "string" },
  { key: "api_endpoint", type: "string" },
  { key: "oauth_authorize_url", type: "string" },
  { key: "oauth_token_url", type: "string" },
  { key: "spec_template", type: "string" },
  { key: "capabilities", type: "string" },
  { key: "is_active", type: "boolean" },
  { key: "created_at", type: "string" },
  { key: "updated_at", type: "string" },
];

export type PublishJobStatus =
  | "pending"
  | "uploading"
  | "reviewing"
  | "published"
  | "failed"
  | "cancelled"
  | "scheduled";

export interface PublishJob {
  id: string;
  project_id: string;
  composition_id: string;
  channel_id: string;
  account_id: string;
  template_id?: string;
  title: string;
  description?: string;
  tags?: string;
  cover_url?: string;
  status: PublishJobStatus;
  external_url?: string;
  external_post_id?: string;
  scheduled_at?: string;
  started_at?: string;
  completed_at?: string;
  error_code?: string;
  error_message?: string;
  retry_count: number;
  priority: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export const publishJobFields: FieldSpec<PublishJob>[] = [
  { key: "id", type: "string" },
  { key: "project_id", type: "string" },
  { key: "composition_id", type: "string" },
  { key: "channel_id", type: "string" },
  { key: "account_id", type: "string" },
  { key: "template_id", type: "string" },
  { key: "title", type: "string" },
  { key: "description", type: "string" },
  { key: "tags", type: "string" },
  { key: "cover_url", type: "string" },
  { key: "status", type: "string" },
  { key: "external_url", type: "string" },
  { key: "external_post_id", type: "string" },
  { key: "scheduled_at", type: "string" },
  { key: "started_at", type: "string" },
  { key: "completed_at", type: "string" },
  { key: "error_code", type: "string" },
  { key: "error_message", type: "string" },
  { key: "retry_count", type: "number" },
  { key: "priority", type: "number" },
  { key: "created_by", type: "string" },
  { key: "created_at", type: "string" },
  { key: "updated_at", type: "string" },
  { key: "deleted_at", type: "string" },
];

export interface PublishMetrics {
  id: string;
  publish_job_id: string;
  channel_id: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  favorites: number;
  completion_rate?: number;
  captured_at: string;
  created_at: string;
}

export const publishMetricsFields: FieldSpec<PublishMetrics>[] = [
  { key: "id", type: "string" },
  { key: "publish_job_id", type: "string" },
  { key: "channel_id", type: "string" },
  { key: "views", type: "number" },
  { key: "likes", type: "number" },
  { key: "comments", type: "number" },
  { key: "shares", type: "number" },
  { key: "favorites", type: "number" },
  { key: "completion_rate", type: "number" },
  { key: "captured_at", type: "string" },
  { key: "created_at", type: "string" },
];

/* ==================== 项目可见性 / 权限（spec 4.4）==================== */
export type ProjectVisibility = "all" | "admin_only" | "specified";

export interface ProjectPermission {
  id: string;
  project_id: string;
  visibility: ProjectVisibility;
  /** JSON 字符串：当 visibility = specified 时，记录允许的 user_id 列表。 */
  allowed_user_ids_json: string;
  created_at: string;
  updated_at: string;
}

export const projectPermissionFields: FieldSpec<ProjectPermission>[] = [
  { key: "id", type: "string" },
  { key: "project_id", type: "string" },
  { key: "visibility", type: "string" },
  { key: "allowed_user_ids_json", type: "string" },
  { key: "created_at", type: "string" },
  { key: "updated_at", type: "string" },
];

/* ==================== V2 W12 P0 REQ-REVIEW-F01：审核快照（不可变）==================== */
/**
 * 审核快照：每次 review 进入新状态（submit / approve / reject / resubmit）时
 * 对 review 当时的完整字段做一次快照写入。数据走 JSON 字符串，永久不可变。
 * - 防止 review 主表更新后历史状态丢失
 * - 前端做"打回前 vs 打回后"对比时直接读 snapshot_data
 */
export interface ReviewSnapshot {
  id: string;
  project_id: string;
  review_id: string;
  /** 触发快照的动作：submit / approve / reject / resubmit / close / cancel。 */
  action: string;
  /** 当时的 review 完整 JSON 字符串。 */
  snapshot_data: string;
  /** 触发快照的 user_id。 */
  actor_id: string;
  created_at: string;
}

export const reviewSnapshotFields: FieldSpec<ReviewSnapshot>[] = [
  { key: "id", type: "string" },
  { key: "project_id", type: "string" },
  { key: "review_id", type: "string" },
  { key: "action", type: "string" },
  { key: "snapshot_data", type: "string" },
  { key: "actor_id", type: "string" },
  { key: "created_at", type: "string" },
];

/* ==================== V2 W12 P0 REQ-AUDIO-F08/F09/F10：字幕（shot 维度）==================== */
export type ShotSubtitleStatus = "draft" | "approved" | "archived";

export interface ShotSubtitleStyle {
  fontFamily: string;
  fontSize: number;
  color: string;
  backgroundColor: string;
  position: "top" | "center" | "bottom";
  alignment: "left" | "center" | "right";
  outlineColor: string;
  outlineWidth: number;
}

export const DEFAULT_SUBTITLE_STYLE: ShotSubtitleStyle = {
  fontFamily: "Noto Sans SC",
  fontSize: 42,
  color: "#FFFFFF",
  backgroundColor: "#00000099",
  position: "bottom",
  alignment: "center",
  outlineColor: "#000000",
  outlineWidth: 2,
};

/** 字幕条目（按 shot 内时间码；区别于 av.ts 的 storyboard 级 Subtitle）。 */
export interface ShotSubtitle {
  id: string;
  project_id: string;
  /** 所属镜头 ID。 */
  shot_id: string;
  /** 字幕文本（一行）。 */
  text: string;
  /** 入点（秒，相对镜头 0 点）。 */
  start_time: number;
  /** 出点（秒）。 */
  end_time: number;
  /** 角色 ID（可选，关联 character 音色）。 */
  character_id: string;
  /** TTS 音色 ID（Edge-TTS / Agnes-TTS）。 */
  voice_id: string;
  /** 关联的 TTS 音频 ID（audios.id，可空——字幕可独立于 TTS 存在）。 */
  audio_id: string;
  /** 语言代码（zh-CN / en-US 等）。 */
  language: string;
  /** 渲染样式；JSON 存储并可按条编辑。 */
  subtitle_style: ShotSubtitleStyle;
  /** 字幕版本号（同 shot 内单调递增，初值 1，每次 update 自增）。 */
  version: number;
  /** 状态。 */
  status: ShotSubtitleStatus;
  /** 创建人。 */
  created_by: string;
  created_at: string;
  updated_at: string;
}

export const shotSubtitleFields: FieldSpec<ShotSubtitle>[] = [
  { key: "id", type: "string" },
  { key: "project_id", type: "string" },
  { key: "shot_id", type: "string" },
  { key: "text", type: "string" },
  { key: "start_time", type: "number" },
  { key: "end_time", type: "number" },
  { key: "character_id", type: "string" },
  { key: "voice_id", type: "string" },
  { key: "audio_id", type: "string" },
  { key: "language", type: "string" },
  { key: "subtitle_style", type: "json" },
  { key: "version", type: "number" },
  { key: "status", type: "string" },
  { key: "created_by", type: "string" },
  { key: "created_at", type: "string" },
  { key: "updated_at", type: "string" },
];

/* ==================== V2 W12 P0 REQ-EDIT-F01/F02/F03：时间线 ==================== */
export type TimelineStatus = "draft" | "ready" | "archived";

/** 时间线（一个项目可有多个时间线：横版/竖版/编辑版/客户版等）。 */
export interface Timeline {
  id: string;
  project_id: string;
  /** 时间线名称（如 "横版 1080p 母版" / "竖版 抖音版"）。 */
  name: string;
  /** 描述。 */
  description: string;
  /** 横版 16:9 / 竖版 9:16 / 1:1 等。 */
  ratio: string;
  /** 关联最终成片 ID（final_video_versions.id，可空）。 */
  final_video_id: string;
  /** 状态。 */
  status: TimelineStatus;
  /** 当前活跃版本号（指向 timeline_versions.version）。 */
  active_version: number;
  /** 版本总数（冗余字段，便于排序展示）。 */
  version_count: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export const timelineFields: FieldSpec<Timeline>[] = [
  { key: "id", type: "string" },
  { key: "project_id", type: "string" },
  { key: "name", type: "string" },
  { key: "description", type: "string" },
  { key: "ratio", type: "string" },
  { key: "final_video_id", type: "string" },
  { key: "status", type: "string" },
  { key: "active_version", type: "number" },
  { key: "version_count", type: "number" },
  { key: "created_by", type: "string" },
  { key: "created_at", type: "string" },
  { key: "updated_at", type: "string" },
  { key: "deleted_at", type: "string" },
];

/** 时间线节点：镜头在该时间线内的位置（带顺序、in_point、out_point、音量、转场）。 */
export interface TimelineShot {
  id: string;
  project_id: string;
  timeline_id: string;
  /** 镜头 ID。 */
  shot_id: string;
  /** 在时间线中的顺序（0-based，单调递增，drag-reorder 时交换 order）。 */
  order: number;
  /** 入点（秒，相对镜头 0 点，默认 0）。 */
  in_point: number;
  /** 出点（秒，相对镜头 0 点，默认 shot.duration）。 */
  out_point: number;
  /** 字幕轨道 ID（subtitle.id，可空）。 */
  subtitle_id: string;
  /** 音频轨道 ID（audio.id，可空）。 */
  audio_id: string;
  /** 音频音量倍率（0.0-2.0，默认 1.0；0=静音，1.0=原始音量，2.0=放大 2 倍）。 */
  volume: number;
  /** 转场类型（节点与下一节点之间的过渡效果，默认 'cut'）。 */
  transition_type: TimelineTransitionType;
  /** 转场时长（毫秒，0-2000，默认 0 即"cut"/无转场）。 */
  transition_duration_ms: number;
  created_at: string;
  updated_at: string;
}

/** 时间线节点支持的转场类型（基础 5 种）。 */
export type TimelineTransitionType = "cut" | "dissolve" | "fade" | "wipe" | "slide";

/** 合法转场类型常量。 */
export const TIMELINE_TRANSITION_TYPES: readonly TimelineTransitionType[] = [
  "cut",
  "dissolve",
  "fade",
  "wipe",
  "slide",
] as const;

/** 音量合法范围 [min, max]。 */
export const TIMELINE_VOLUME_MIN = 0;
export const TIMELINE_VOLUME_MAX = 2;

/** 转场时长合法范围（毫秒）。 */
export const TIMELINE_TRANSITION_DURATION_MIN = 0;
export const TIMELINE_TRANSITION_DURATION_MAX = 2000;

/** 校验 volume：0-2 之间。 */
export function validateTimelineVolume(v: unknown): { ok: boolean; value: number; reason?: string } {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return { ok: false, value: 1.0, reason: "volume_not_finite" };
  if (n < TIMELINE_VOLUME_MIN || n > TIMELINE_VOLUME_MAX) {
    return { ok: false, value: Math.max(TIMELINE_VOLUME_MIN, Math.min(TIMELINE_VOLUME_MAX, n)), reason: "volume_out_of_range" };
  }
  return { ok: true, value: n };
}

/** 校验 transition_type：必须为合法枚举。 */
export function validateTimelineTransitionType(
  v: unknown,
): { ok: boolean; value: TimelineTransitionType; reason?: string } {
  const s = String(v ?? "");
  if (TIMELINE_TRANSITION_TYPES.includes(s as TimelineTransitionType)) {
    return { ok: true, value: s as TimelineTransitionType };
  }
  return { ok: false, value: "cut", reason: "invalid_transition_type" };
}

/** 校验 transition_duration_ms：0-2000 整数。 */
export function validateTimelineTransitionDuration(
  v: unknown,
): { ok: boolean; value: number; reason?: string } {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return { ok: false, value: 0, reason: "duration_not_finite" };
  if (n < TIMELINE_TRANSITION_DURATION_MIN || n > TIMELINE_TRANSITION_DURATION_MAX) {
    return {
      ok: false,
      value: Math.max(TIMELINE_TRANSITION_DURATION_MIN, Math.min(TIMELINE_TRANSITION_DURATION_MAX, n)),
      reason: "duration_out_of_range",
    };
  }
  return { ok: true, value: Math.trunc(n) };
}

export const timelineShotFields: FieldSpec<TimelineShot>[] = [
  { key: "id", type: "string" },
  { key: "project_id", type: "string" },
  { key: "timeline_id", type: "string" },
  { key: "shot_id", type: "string" },
  { key: "order", type: "number" },
  { key: "in_point", type: "number" },
  { key: "out_point", type: "number" },
  { key: "subtitle_id", type: "string" },
  { key: "audio_id", type: "string" },
  { key: "volume", type: "number" },
  { key: "transition_type", type: "string" },
  { key: "transition_duration_ms", type: "number" },
  { key: "created_at", type: "string" },
  { key: "updated_at", type: "string" },
];

/** 时间线版本（每次保存快照：完整节点列表 + 编排元数据）。 */
export interface TimelineVersion {
  id: string;
  project_id: string;
  timeline_id: string;
  /** 版本号（1-based，单调递增）。 */
  version: number;
  /** 完整 JSON：节点列表 + 字幕/音频绑定 + 转场 + 备注。 */
  snapshot_data: string;
  /** 变更说明。 */
  change_note: string;
  created_by: string;
  created_at: string;
}

export const timelineVersionFields: FieldSpec<TimelineVersion>[] = [
  { key: "id", type: "string" },
  { key: "project_id", type: "string" },
  { key: "timeline_id", type: "string" },
  { key: "version", type: "number" },
  { key: "snapshot_data", type: "string" },
  { key: "change_note", type: "string" },
  { key: "created_by", type: "string" },
  { key: "created_at", type: "string" },
];
