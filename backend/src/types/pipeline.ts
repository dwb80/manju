/**
 * @file pipeline.ts
 * @description MOD-PIPELINE 任务编排相关类型定义
 *
 * 包含：
 *  - 节点 / Run / Dependency / Event 的实体类型
 *  - 状态枚举（Node / Run）
 *  - 质检 / 重试 / 事件类型
 *  - 6 张表对应的 FieldSpec
 *
 * 历史：
 *  - W0：初版（6 表）
 *  - W2：+ 节点超时 + Stale Running（task 增加 timeout_sec / grace_sec，事件流加 timeout_cancelled / stale_running）
 *  - W3：+ 幂等键（node.idempotency_key 字段）
 *  - W4：+ 事件流（pipeline_events 表 + 13 种事件类型）
 *  - W5：+ 节点启停控制（PipelineNodeStatus 加 `paused`；事件流加 `node_paused`/`node_resumed`/`node_skipped`）
 *  - W6：+ 边条件分支（PipelineDependency 加 `condition_type` / `condition_expr`，`on_approve` / `on_reject` / `on_skip`）
 */
import type { FieldSpec } from "../storage/repository.js";

/* ==================== 节点类型枚举 ==================== */
/** 节点类型白名单（V1 已有 + V2 扩展）。 */
export type PipelineNodeType =
  | "image_generation"
  | "video_generation"
  | "tts"
  | "composition"
  | "render"
  | "review"
  | "quality_check"
  | "notification"
  | "wait"
  | "webhook";

/* ==================== 状态枚举 ==================== */
/** 节点状态：pending → running → (completed | failed | skipped)，retrying 视作 running 的子态。
 *
 *  V2 W5 REQ-PIPE-001-06 新增 `paused`：节点级别启停开关。paused 节点不进 ready-set，
 *  等同于"手动冻结"，可由 resumeNode 恢复成 pending。
 */
export type PipelineNodeStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped"
  | "retrying"
  | "paused";

/** Run 状态：pending → running → (completed | failed | paused)。 */
export type PipelineRunStatus = "pending" | "running" | "completed" | "failed" | "paused";

/* ==================== PipelineNode ==================== */
/** 节点实体。每个节点属于一个 Run（run_id），类型受白名单约束。 */
export interface PipelineNode {
  id: string;
  run_id: string;
  project_id: string;
  type: PipelineNodeType;
  name: string;
  status: PipelineNodeStatus;
  config: Record<string, unknown>;
  input_data: Record<string, unknown>;
  output_data: Record<string, unknown>;
  error: string;
  retry_count: number;
  started_at: string;
  completed_at: string;
  created_at: string;
  updated_at: string;
  /** REQ-PIPE-002-04：幂等键，用于同项目下重跑复用历史结果。 */
  idempotency_key: string;
  /** V2 W11 TASK-F16 节点优先级：low=0 / normal=1 / high=2 / urgent=3。整数便于排序。数值越大越优先。 */
  priority: number;
}

export const pipelineNodeFields: FieldSpec<PipelineNode>[] = [
  { key: "id", type: "string" },
  { key: "run_id", type: "string" },
  { key: "project_id", type: "string" },
  { key: "type", type: "string" },
  { key: "name", type: "string" },
  { key: "status", type: "string" },
  { key: "config", type: "json" },
  { key: "input_data", type: "json" },
  { key: "output_data", type: "json" },
  { key: "error", type: "string" },
  { key: "retry_count", type: "number" },
  { key: "started_at", type: "string" },
  { key: "completed_at", type: "string" },
  { key: "created_at", type: "string" },
  { key: "updated_at", type: "string" },
  { key: "idempotency_key", type: "string" },
  { key: "priority", type: "number" },
];

/** TASK-F16：节点优先级类型,数值越大越优先。默认值 1 (normal)。 */
export type PipelineNodePriority = 0 | 1 | 2 | 3;
export const PIPELINE_NODE_PRIORITY: Record<"low" | "normal" | "high" | "urgent", PipelineNodePriority> = {
  low: 0,
  normal: 1,
  high: 2,
  urgent: 3,
};
export const DEFAULT_PIPELINE_NODE_PRIORITY: PipelineNodePriority = 1;

/* ==================== PipelineDependency ==================== */
/** DAG 边：source_node 完成 → target_node 才能开始。 */
/**
 * 边的条件类型（V2 W6 REQ-PIPE-005-02 节点级条件分支）。
 *  - always      ：源节点任意终态都激活下游（默认，向后兼容）
 *  - on_approve  ：仅源节点 output_data.decision === "approved" 时激活（review 节点通过）
 *  - on_reject   ：仅源节点 output_data.decision === "rejected" 时激活（review 节点拒绝 → 走返工）
 *  - on_skip     ：仅源节点 status === "skipped" 时激活
 */
export type PipelineDependencyCondition =
  | "always"
  | "on_approve"
  | "on_reject"
  | "on_skip";

/** PipelineDependency 边条件在 DB 中的默认值。 */
export const DEFAULT_DEPENDENCY_CONDITION: PipelineDependencyCondition = "always";

/** PipelineDependency（边）。 */
export interface PipelineDependency {
  id: string;
  run_id: string;
  source_node_id: string;
  target_node_id: string;
  created_at: string;
  /** V2 W6 REQ-PIPE-005-02：边条件类型，默认 always。 */
  condition_type: PipelineDependencyCondition;
  /** V2 W6 REQ-PIPE-005-02：可选条件表达式（JSON 字符串），V2.0 MVP 暂未使用，预留给 V2.1。 */
  condition_expr: string;
  /**
   * V2 W7 REQ-PIPE-005-02：边条件对象（JSON 形态）。
   * 结构与 isValidCondition / evaluateCondition 输入一致。
   * 入参（外部 API 透传）：
   *   - createRun 接收 `condition` 字段（object|null），合法时 JSON.stringify 入库。
   *   - 入参 `condition_type === "expression"` 时若缺 `condition` 则退化为 always。
   *   - 非法形态（isValidCondition=false）→ 强制存 null（fail-safe）。
   * 出参（API 返回）：
   *   - DB 字符串反序列化为对象；非对象/空串/null 统一归一为 null。
   */
  condition: string | object | null;
}

export const pipelineDependencyFields: FieldSpec<PipelineDependency>[] = [
  { key: "id", type: "string" },
  { key: "run_id", type: "string" },
  { key: "source_node_id", type: "string" },
  { key: "target_node_id", type: "string" },
  { key: "created_at", type: "string" },
  { key: "condition_type", type: "string" },
  { key: "condition_expr", type: "string" },
  { key: "condition", type: "json" },
];

/* ==================== PipelineRun ==================== */
/** 一次 DAG 执行实例。 */
export interface PipelineRun {
  id: string;
  project_id: string;
  name: string;
  status: PipelineRunStatus;
  workflow_config: Record<string, unknown>;
  start_node_id: string;
  current_node_id: string;
  error: string;
  started_at: string;
  completed_at: string;
  created_at: string;
  updated_at: string;
}

export const pipelineRunFields: FieldSpec<PipelineRun>[] = [
  { key: "id", type: "string" },
  { key: "project_id", type: "string" },
  { key: "name", type: "string" },
  { key: "status", type: "string" },
  { key: "workflow_config", type: "json" },
  { key: "start_node_id", type: "string" },
  { key: "current_node_id", type: "string" },
  { key: "error", type: "string" },
  { key: "started_at", type: "string" },
  { key: "completed_at", type: "string" },
  { key: "created_at", type: "string" },
  { key: "updated_at", type: "string" },
];

/* ==================== QualityReport ==================== */
/**
 * V2 W12+ REQ-PIPE-004 质检 check_type 完整枚举（24 项 Feature ID 落点）
 *  - W6 已有：black_frame / blur / resolution / aspect_ratio / audio_level / duration
 *  - W12 新增：media_readable / fps / face_count / role_similarity / frozen_frame /
 *              exposure / human_body / flicker / subtitle_safe / sensitive_content
 */
export type QualityCheckType =
  | "black_frame"
  | "blur"
  | "resolution"
  | "aspect_ratio"
  | "audio_level"
  | "duration"
  | "media_readable"
  | "fps"
  | "face_count"
  | "role_similarity"
  | "frozen_frame"
  | "exposure"
  | "human_body"
  | "flicker"
  | "subtitle_safe"
  | "sensitive_content";

export interface QualityReport {
  id: string;
  project_id: string;
  run_id: string;
  node_id: string;
  check_type: QualityCheckType;
  score: number;
  threshold: number;
  passed: boolean;
  details: Record<string, unknown>;
  created_at: string;
  /** V2 W12+ REQ-PIPE-004-22 人工复核反馈字段（QA-F22） */
  reviewer_note: string;
  reviewed_by: string;
  reviewed_at: string;
  /** V2 W12+ REQ-PIPE-004-24 低分自动重试标记（QA-F24） */
  retried: boolean;
  retry_triggered_at: string;
}

export const qualityReportFields: FieldSpec<QualityReport>[] = [
  { key: "id", type: "string" },
  { key: "project_id", type: "string" },
  { key: "run_id", type: "string" },
  { key: "node_id", type: "string" },
  { key: "check_type", type: "string" },
  { key: "score", type: "number" },
  { key: "threshold", type: "number" },
  { key: "passed", type: "boolean" },
  { key: "details", type: "json" },
  { key: "created_at", type: "string" },
  { key: "reviewer_note", type: "string" },
  { key: "reviewed_by", type: "string" },
  { key: "reviewed_at", type: "string" },
  { key: "retried", type: "boolean" },
  { key: "retry_triggered_at", type: "string" },
];

/* ==================== QualityAutoConfig ==================== */
/**
 * V2 W6 REQ-PIPE-004-05 配套：每项目级自动质检配置。
 *  - target_types 决定哪些节点产出类型自动触发质检
 *  - threshold 为及格线（0-100）
 *  - on_failure 决定失败时的下游动作（log 仅记录 / review 触发审核 / block 阻断流水线）
 */
export type QualityTargetType = "image" | "video" | "audio" | "composition";
export type QualityOnFailure = "log" | "review" | "block" | "auto_retry";

export interface QualityAutoConfig {
  id: string;
  project_id: string;
  enabled: boolean;
  target_types: QualityTargetType[];
  threshold: number;
  on_failure: QualityOnFailure;
  created_at: string;
  updated_at: string;
}

export const qualityAutoConfigFields: FieldSpec<QualityAutoConfig>[] = [
  { key: "id", type: "string" },
  { key: "project_id", type: "string" },
  { key: "enabled", type: "boolean" },
  { key: "target_types", type: "json" },
  { key: "threshold", type: "number" },
  { key: "on_failure", type: "string" },
  { key: "created_at", type: "string" },
  { key: "updated_at", type: "string" },
];

/* ==================== RetryPolicy ==================== */
export type RetryStrategy = "fixed" | "exponential" | "linear";

/**
 * 错误类别（V2 W10 REQ-PIPE-006-01）。
 *  - transient       临时性错误（5xx、服务不可用），可重试
 *  - permanent       永久性错误（404/无权限/资源不存在），不重试
 *  - rate_limit      限流（429），按 backoff 退避后重试
 *  - timeout         超时（>NodeAbortedError 标记的 NODE_TIMEOUT）
 *  - model_error     模型调用错误（AI 接口报错/返回空），可触发降级
 *  - network_error   网络层错误（ECONNREFUSED/ECONNRESET/DNS 失败）
 *  - validation_error 参数校验失败（4xx），不重试
 *  - unknown         未知错误，默认按 transient 处理
 */
export type ErrorCategory =
  | "transient"
  | "permanent"
  | "rate_limit"
  | "timeout"
  | "model_error"
  | "network_error"
  | "validation_error"
  | "unknown";

export interface RetryPolicy {
  id: string;
  name: string;
  node_type: PipelineNodeType;
  max_retries: number;
  strategy: RetryStrategy;
  initial_delay_ms: number;
  max_delay_ms: number;
  enabled: boolean;
  // V2 W10 REQ-PIPE-006-02 模型降级链（按数组顺序逐个降级，最后一档失败才进 DLQ）
  fallback_models: string[];
  // V2 W10 REQ-PIPE-006-04 熔断器配置
  circuit_breaker_enabled: boolean;
  circuit_breaker_threshold: number;   // 连续失败 N 次打开熔断
  circuit_breaker_open_ms: number;     // 打开后持续 N 毫秒进入 half_open
  created_at: string;
  updated_at: string;
}

export const retryPolicyFields: FieldSpec<RetryPolicy>[] = [
  { key: "id", type: "string" },
  { key: "name", type: "string" },
  { key: "node_type", type: "string" },
  { key: "max_retries", type: "number" },
  { key: "strategy", type: "string" },
  { key: "initial_delay_ms", type: "number" },
  { key: "max_delay_ms", type: "number" },
  { key: "enabled", type: "boolean" },
  { key: "fallback_models", type: "json" },
  { key: "circuit_breaker_enabled", type: "boolean" },
  { key: "circuit_breaker_threshold", type: "number" },
  { key: "circuit_breaker_open_ms", type: "number" },
  { key: "created_at", type: "string" },
  { key: "updated_at", type: "string" },
];

/* ==================== PipelineDeadLetter (V2 W10 REQ-PIPE-006-03) ==================== */
export type DeadLetterStatus = "pending" | "replayed" | "dropped";

export interface PipelineDeadLetter {
  id: string;
  project_id: string;
  run_id: string;
  node_id: string;
  node_type: string;
  error_category: ErrorCategory;
  error_message: string;
  /** 失败时的 input_data / config / 重试次数 / 模型名 / fallback 路径等完整 context */
  payload: Record<string, unknown>;
  retry_count: number;
  status: DeadLetterStatus;
  created_at: string;
  updated_at: string;
  /** replayed_at / dropped_at 记录（status 变更时间） */
  resolved_at: string;
}

export const pipelineDeadLetterFields: FieldSpec<PipelineDeadLetter>[] = [
  { key: "id", type: "string" },
  { key: "project_id", type: "string" },
  { key: "run_id", type: "string" },
  { key: "node_id", type: "string" },
  { key: "node_type", type: "string" },
  { key: "error_category", type: "string" },
  { key: "error_message", type: "string" },
  { key: "payload", type: "json" },
  { key: "retry_count", type: "number" },
  { key: "status", type: "string" },
  { key: "created_at", type: "string" },
  { key: "updated_at", type: "string" },
  { key: "resolved_at", type: "string" },
];

/* ==================== PipelineEvent（REQ-PIPE-003-03）==================== */
/** 节点 / Run 生命周期事件类型。 */
export type PipelineEventType =
  | "node_started"
  | "node_progress"
  | "node_completed"
  | "node_failed"
  | "node_retried"
  | "node_idempotent_hit"
  | "node_timeout_cancelled"
  | "node_stale_running"
  | "node_paused"
  | "node_resumed"
  | "node_skipped"
  | "run_started"
  | "run_paused"
  | "run_resumed"
  | "run_completed"
  | "run_failed"
  | "rework_todo_created"
  | "rework_todo_updated"
  // V2 W10 REQ-PIPE-006-01~04 错误恢复事件族
  | "node_error_classified"      // 错误分类完成
  | "node_model_fallback"        // 触发模型降级
  | "node_circuit_breaker_open"  // 熔断器打开
  | "node_circuit_breaker_half_open" // 熔断器半开探测
  | "node_circuit_breaker_close" // 熔断器恢复
  | "node_dead_letter_recorded"  // 写入死信队列
  | "node_dead_letter_replayed"  // 死信被重放
  | "node_dead_letter_dropped"   // 死信被丢弃
  // V2 W11 TASK-F11/F16/F17/F18 任务管理增强事件族
  | "node_priority_changed"      // 节点优先级变更
  | "nodes_batch_added";         // 批量新增节点

/** 节点事件流记录。SSE 推送 + 事后排查共用。 */
export interface PipelineEvent {
  id: string;
  run_id: string;
  node_id: string;
  project_id: string;
  type: PipelineEventType;
  payload: Record<string, unknown>;
  created_at: string;
}

export const pipelineEventFields: FieldSpec<PipelineEvent>[] = [
  { key: "id", type: "string" },
  { key: "run_id", type: "string" },
  { key: "node_id", type: "string" },
  { key: "project_id", type: "string" },
  { key: "type", type: "string" },
  { key: "payload", type: "json" },
  { key: "created_at", type: "string" },
];
