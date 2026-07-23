/**
 * @file app.ts
 * @description 应用上下文模块。负责组装后端运行所需的所有依赖：
 *   - AI 客户端（AgnesClient）
 *   - SQLite 数据库仓库（Repository）
 *   - 媒体目录和运行状态
 *   - 各业务模块的仓储实例（会话、项目、消息、图片、视频、工厂资产等）
 *
 * 该模块是后端服务的核心入口，所有路由和服务都依赖 AppContext 进行数据库访问和 AI 调用。
 */

import path from "node:path";
import { createAIClient, RoutedAIClient, shouldRouteToZhipu, shouldRouteToCerebras, shouldRouteToSenseNova } from "../ai/ai-client-factory.js";
import type { AgnesClient } from "../ai/agnes-client.js";
import type { Conversation, Favorite, ImageTask, Message, Project, Settings, VideoTask, ScriptComment, AssetVersion, CharacterImageHistory, PropImageHistory, SceneImageHistory, Todo, Script, AppLog, WorkItem } from "../types.js";
import type { Character } from "../types/character.js";
import type { Scene } from "../types/scene.js";
import type { Prop } from "../types/prop.js";
import type { CharacterImage, PropImage, SceneImage } from "../types/asset-image.js";
import type { Storyboard, ProjectStoryboard, Shot, ShotSnapshot } from "../types/storyboard.js";
import type { Audio } from "../types/audio.js";
import type { ModuleVideoTask } from "../types/video.js";
import type { ProjectClip, ProjectTask, ProjectEpisode, ProjectIssue, ProjectMember, ProjectMilestone, PublishPlan } from "../types/project.js";
import type { Asset, ProjectAsset } from "../types/asset.js";
import type { Review, ProjectReview } from "../types/review.js";
import type { ModelConfig, ModelQuota, ModelCallLog } from "../types/model.js";
import type { ScriptDocument, ScriptEpisode, ScriptScene, ScriptDialogue, ScriptSceneCharacter, ScriptSceneLocation, ScriptTemplate, ScriptTag, ScriptQualityAssessment, ScriptApproval, ScriptBackup, ProjectScript, ScriptAnalyzedCharacter, ScriptAnalyzedScene, ScriptAnalyzedProp } from "../types/script.js";
import type { SensitiveWord, ProjectBudget, AuditLog, Notification, PublishTemplate, ReviewItem, PublishAccount, PublishRecord, ProjectPermission, ReviewConfig } from "../types/horizontal.js";
import type { CostRecord, ReviewHistory, PublishChannel, PublishJob, PublishMetrics } from "../types/horizontal.js";
import type { ReviewSnapshot, ShotSubtitle, Timeline, TimelineShot, TimelineVersion } from "../types/horizontal.js";
import type { ProjectInvitation } from "../types/project.js";
import type { PipelineRun, PipelineNode, PipelineDependency, PipelineEvent, QualityReport, QualityAutoConfig, RetryPolicy, PipelineDeadLetter } from "../types/pipeline.js";
import { SqliteRepository, SqliteSettingsRepository, closeDatabase, getRawDatabase } from "../storage/sqlite.js";
import { Repository, KeyValueRepository } from "../storage/repository.js";
import {
  conversationFields, favoriteFields, imageTaskFields, messageFields, projectFields, videoTaskFields, scriptCommentFields, assetVersionFields, characterImageHistoryFields, propImageHistoryFields, sceneImageHistoryFields, todoFields, appLogFields, workItemFields,
  projectTaskFields, projectEpisodeFields, projectIssueFields, projectMilestoneFields, projectMemberFields, publishPlanFields,
  characterFields, sceneFields, propFields, storyboardFields, shotFields, shotSnapshotFields, audioFields, moduleVideoTaskFields, projectClipFields, projectStoryboardFields,
  characterImageFields, sceneImageFields, propImageFields,
  scriptFields, assetFields, reviewFields, projectScriptFields, projectAssetFields, projectReviewFields,
  scriptDocumentFields, scriptEpisodeFields, scriptSceneFields, scriptDialogueFields, scriptSceneCharacterFields, scriptSceneLocationFields,
  scriptTemplateFields, scriptTagFields, scriptQualityAssessmentFields, scriptApprovalFields, scriptBackupFields,
  scriptAnalyzedCharacterFields, scriptAnalyzedSceneFields, scriptAnalyzedPropFields,
  modelConfigFields, modelQuotaFields, modelCallLogFields,
  // 4 中心横切：5 张新表（详见 docs/spec.md 第三节）
  sensitiveWordFields, projectBudgetFields, auditLogFields, notificationFields, publishTemplateFields,
  // 4 中心业务（spec 4.1 审核 + 4.2 发布 + 4.4 系统管理）
  reviewItemFields, publishAccountFields, publishRecordFields, projectPermissionFields, reviewConfigFields,
  // P0-08 / 业务扩展
  costRecordFields, reviewHistoryFields, projectInvitationFields, publishChannelFields, publishJobFields, publishMetricsFields,
  // V2 W12 P0 REQ-REVIEW-F01 / REQ-AUDIO-F08-F10 / REQ-EDIT-F01-F10
  reviewSnapshotFields, shotSubtitleFields, timelineFields, timelineShotFields, timelineVersionFields,
} from "../storage/schema.js";
import {
  // V2 MOD-PIPELINE：8 张表 FieldSpec（types/pipeline.js 内部定义，schema.ts 未转出）；W10 新增 pipeline_dead_letters
  pipelineRunFields, pipelineNodeFields, pipelineDependencyFields, qualityReportFields, qualityAutoConfigFields, retryPolicyFields, pipelineEventFields, pipelineDeadLetterFields,
} from "../types/pipeline.js";
import { finalVideoVersionFields } from "../types/av.js";
import type { FinalVideoVersion } from "../types/av.js";
import { rootLogger } from "../logger.js";
import { assertEncryptionConfigured } from "./security/hardening.js";

export interface AppContext {
  /** 停止定时器、等待后台任务排空并关闭数据库。可重复调用。 */
  close(): Promise<void>;
  ai: AgnesClient;
  root: string;
  mediaRoot: string;
  mediaCacheEnabled: boolean;
  /** SQLite 数据库文件路径，单一文件承载所有业务表。 */
  databaseFile: string;
  conversations: Repository<Conversation>;
  projects: Repository<Project>;
  messages: Repository<Message>;
  images: Repository<ImageTask>;
  videos: Repository<VideoTask>;
  favorites: Repository<Favorite>;
  /** 剧本编辑器内行内批注与回复仓储（任务8：评论持久化）。 */
  scriptComments: Repository<ScriptComment>;
  /** 三厂共性：资产版本历史仓储（任务12：统一版本管理）。 */
  assetVersions: Repository<AssetVersion>;
  /** 角色图片生成历史仓储：每次 AI 生成图、设为角色资产、删除都走这里（跨设备持久化）。 */
  characterImageHistory: Repository<CharacterImageHistory>;
  /** 道具图片生成历史仓储：与 character_image_history 同构。 */
  propImageHistory: Repository<PropImageHistory>;
  /** 场景图片生成历史仓储：与 character_image_history 同构。 */
  sceneImageHistory: Repository<SceneImageHistory>;
  settings: KeyValueRepository<Settings>;
  aborts: Map<string, AbortController>;
  /** 三大工厂：角色 / 场景 / 道具。 */
  characters: Repository<Character>;
  scenes: Repository<Scene>;
  props: Repository<Prop>;
  /** 工厂资产图片（一对多）：character_images / scene_images / prop_images。 */
  characterImages: Repository<CharacterImage>;
  sceneImages: Repository<SceneImage>;
  propImages: Repository<PropImage>;
  /** 独立模块：分镜 / 镜头 / 镜头快照 / 音频 / 视频任务 / 剪辑。 */
  storyboards: Repository<Storyboard>;
  shots: Repository<Shot>;
  shotSnapshots: Repository<ShotSnapshot>;
  /** 剧本侧分镜（剧本编辑器中的分镜，独立于工业流水线分镜）。 */
  projectStoryboards: Repository<ProjectStoryboard>;
  audios: Repository<Audio>;
  moduleVideos: Repository<ModuleVideoTask>;
  /** 兼容旧名（module-domain.ts 用 moduleVideoTasks）。 */
  moduleVideoTasks: Repository<ModuleVideoTask>;
  projectClips: Repository<ProjectClip>;
  /** 剧本 / 资产 / 审核 等独立模块仓储（评审 P1-H10 修复：补齐 Path A/B 变体类型） */
  scripts: Repository<Script>;
  projectScripts: Repository<ProjectScript>;
  assets: Repository<Asset>;
  projectAssets: Repository<ProjectAsset>;
  reviews: Repository<Review>;
  projectReviews: Repository<ProjectReview>;
  /** 项目管理域（任务/集数/工单/里程碑/成员）。 */
  projectTasks: Repository<ProjectTask>;
  projectEpisodes: Repository<ProjectEpisode>;
  projectIssues: Repository<ProjectIssue>;
  projectMilestones: Repository<ProjectMilestone>;
  projectMembers: Repository<ProjectMember>;
  /** 统一工作项（评审 P2：合并 task/issue/review/milestone 到单表，下个迭代会删除旧 4 表）。 */
  workItems: Repository<WorkItem>;
  /** 发布中心。 */
  publishPlans: Repository<PublishPlan>;
  /** 模型中心。 */
  modelConfigs: Repository<ModelConfig>;
  modelQuotas: Repository<ModelQuota>;
  modelCallLogs: Repository<ModelCallLog>;
  /** 剧本中心（Path B）相关：剧本文档 / 剧集 / 场景 / 对白 / 关联 / 模板 / 标签 / 评估 / 审批 / 备份。 */
  scriptDocuments: Repository<ScriptDocument>;
  scriptEpisodes: Repository<ScriptEpisode>;
  scriptScenes: Repository<ScriptScene>;
  scriptDialogues: Repository<ScriptDialogue>;
  scriptSceneCharacters: Repository<ScriptSceneCharacter>;
  scriptSceneLocations: Repository<ScriptSceneLocation>;
  scriptTemplates: Repository<ScriptTemplate>;
  scriptTags: Repository<ScriptTag>;
  scriptQualityAssessments: Repository<ScriptQualityAssessment>;
  scriptApprovals: Repository<ScriptApproval>;
  scriptBackups: Repository<ScriptBackup>;
  /** 剧本分析提取的角色/场景/道具（与 script_documents 一对多） */
  scriptAnalyzedCharacters: Repository<ScriptAnalyzedCharacter>;
  scriptAnalyzedScenes: Repository<ScriptAnalyzedScene>;
  scriptAnalyzedProps: Repository<ScriptAnalyzedProp>;
  /** 我的待办（评审优化 P1）。 */
  todos: Repository<Todo>;
  /** 应用审计日志（评审增量 P1-1 / P1-2：状态机变更 + 跨项目复制 + 软删除 / 恢复）。 */
  appLogs: Repository<AppLog>;
  // === 4 中心横切仓储（详见 docs/spec.md 第三节）===
  /** 敏感词库（用于审核/发布/聊天内容前置检查）。 */
  sensitiveWords: Repository<SensitiveWord>;
  /** 项目预算（生图/生视频入口拦截）。 */
  projectBudgets: Repository<ProjectBudget>;
  /** 管理后台审计日志（who/when/what changed）。 */
  auditLogs: Repository<AuditLog>;
  /** 站内通知（顶栏铃铛）。 */
  notifications: Repository<Notification>;
  /** 发布平台模板（5 平台 × 3 物料）。 */
  publishTemplates: Repository<PublishTemplate>;
  // === 4 中心业务（spec 4.1 审核 + 4.2 发布 + 4.4 系统管理）===
  reviewItems: Repository<ReviewItem>;
  // V2 W8 REQ-PIPE-005-03 SLA 升级：审核配置（每项目一份，含 sla_pending_hours/sla_review_hours/升级开关/最大等级）
  reviewConfigs: Repository<ReviewConfig>;
  publishAccounts: Repository<PublishAccount>;
  publishRecords: Repository<PublishRecord>;
  projectPermissions: Repository<ProjectPermission>;
  // P0-08 / 业务扩展
  costRecords: Repository<CostRecord>;
  reviewHistories: Repository<ReviewHistory>;
  projectInvitations: Repository<ProjectInvitation>;
  publishChannels: Repository<PublishChannel>;
  publishJobs: Repository<PublishJob>;
  publishMetrics: Repository<PublishMetrics>;

  // === 4 中心横切服务（详见 docs/spec.md 第三节）===
  /** 敏感词服务（带 5s 缓存，审核/发布/聊天复用）。 */
  sensitiveWordService: import("./horizontal/sensitive-word-service.js").SensitiveWordService;
  /** 项目预算服务（生图/生视频入口拦截）。 */
  budgetService: import("./horizontal/budget-service.js").BudgetService;
  /** 审计日志服务（异步批量写入）。 */
  auditService: import("./horizontal/audit-service.js").AuditService;
  /** 站内通知服务（顶栏铃铛）。 */
  notificationService: import("./horizontal/notification-service.js").NotificationService;
  /** 发布平台模板服务（5 平台 × 3 物料）。 */
  publishTemplateService: import("./horizontal/publish-template-service.js").PublishTemplateService;
  // === 4 中心业务服务（spec 4.1 审核 + 4.2 发布 + 4.4 系统管理）===
  /** 审核中心服务（状态机 + 通知/审计/todo 联动）。 */
  reviewService: import("./horizontal/review-service.js").ReviewService;
  // V2 W8 REQ-PIPE-005-03 SLA 升级：监控器（定时扫描 + 升级 + 配置 CRUD）
  slaMonitor: import("./horizontal/sla-monitor.js").SlaMonitor;

  // === MOD-PIPELINE 任务编排（W0-W5 累计）===
  /** Pipeline Run 仓储（DAG 执行实例）。 */
  pipelineRuns: Repository<PipelineRun>;
  /** Pipeline 节点仓储（DAG 中的单个节点）。 */
  pipelineNodes: Repository<PipelineNode>;
  /** Pipeline 节点依赖仓储（边）。 */
  pipelineDependencies: Repository<PipelineDependency>;
  /** Pipeline 事件流仓储（节点 / Run 生命周期事件，SSE 与事后排查共用）。 */
  pipelineEvents: Repository<PipelineEvent>;
  /** 节点质检报告仓储（黑场/模糊/分辨率 等）。 */
  qualityReports: Repository<QualityReport>;
  /** 节点重试策略仓储。 */
  retryPolicies: Repository<RetryPolicy>;
  /** V2 W6 REQ-PIPE-004-05 配套：每项目级自动质检配置仓储。 */
  qualityAutoConfigs: Repository<QualityAutoConfig>;
  /** V2 W10 REQ-PIPE-006-03 死信队列仓储（重试耗尽 / 永久错误 / 熔断打开的失败节点）。 */
  pipelineDeadLetters: Repository<PipelineDeadLetter>;
  /** V2 W11 P0 REQ-RENDER-F08：成片版本仓储 */
  finalVideoVersions: Repository<FinalVideoVersion>;
  /** V2 W12 P0 REQ-REVIEW-F01：审核快照仓储（不可变 JSON 快照，按 review_id 列表）。 */
  reviewSnapshots: Repository<ReviewSnapshot>;
  // V2 W12 P0 REQ-AUDIO-F08/F09/F10：字幕表（shot 维度）
  subtitles: Repository<ShotSubtitle>;
  /** V2 W12 P0 REQ-EDIT-F01/F02/F03：时间线仓储。 */
  timelines: Repository<Timeline>;
  /** V2 W12 P0 REQ-EDIT-F01/F02/F03：时间线节点仓储（shot ↔ timeline + order + in/out point + subtitle/audio track）。 */
  timelineShots: Repository<TimelineShot>;
  /** V2 W12 P0 REQ-EDIT-F10：时间线版本仓储（不可变快照）。 */
  timelineVersions: Repository<TimelineVersion>;
  /** 节点并发追踪器（per-type 计数，跨 Run 共享，REQ-PIPE-001-05）。 */
  concurrencyTracker: import("./horizontal/concurrency-tracker.js").ConcurrencyTracker;
  /** 节点事件 pub/sub 总线（SSE 实时推送底层，REQ-PIPE-003-01）。 */
  pipelineEventBus: import("./horizontal/pipeline-event-bus.js").PipelineEventBus;
  /** Pipeline Run 服务（CRUD / 状态机 / 节点执行 / 并发调度 / 事件流）。 */
  pipelineRunService: import("./module-domain/pipeline-run-service.js").PipelineRunService;
  /** V2 W6+ REQ-PIPE-004 质检中心服务（detect + 落表 + 自动 hook）。 */
  qualityDetectionService: import("./module-domain/quality-detection-service.js").QualityDetectionService;
  /** V2 W11 RENDER-F01/REVIEW-F20：合成/渲染预检服务（preRenderCheck + 上游审核拦截 + 横/竖版 preset 解析）。 */
  compositionService: import("./module-domain/composition-service.js").CompositionService;
  /** V2 W11 MODEL-F01~F06 模型能力/参数约束服务（声明 + 校验 + 标准化）。 */
  modelConstraintsService: import("./horizontal/model-constraints-service.js").ModelConstraintsService;
  /** V2 W11 ROUTE-F01~F05 路由策略服务（4 维评分 + 决策日志）。 */
  routePolicyService: import("./horizontal/route-policy-service.js").RoutePolicyService;
  /** V2 W11 DATA-F01~F12 指标服务（字典 + 12 个聚合 SQL 视图 + 项目验收报告）。 */
  metricsService: import("./horizontal/metrics-service.js").MetricsService;
  /** V2 W11 AUDIO-F04/F06/F11/F13/F14 配音参数 + 候选 + 口型同步服务。 */
  audioExtrasService: import("./horizontal/audio-extras-service.js").AudioExtrasService;
  /** V2.1 REM-P1-010 内部服务凭证（成片回调 / 渲染回调等"后端-后端"调用）。 */
  internalAuth: import("./internal-auth.js").InternalAuthService;
  /** V2.1 REM-P1-008 跨模块事务/Outbox 管理器。 */
  transactionService: import("./horizontal/transaction-service.js").TransactionService;
  /** V2.1 REM-P1-009 节点级重试策略（质控低分自动重试）。 */
  retryPolicyService: import("./horizontal/retry-policy-service.js").RetryPolicyService;
}

/**
 * 默认应用设置配置。
 * 包含主题、语言、字体大小、默认模型等基础配置项。
 */
export const defaultSettings: Settings = {
  theme: "system",
  language: "zh-CN",
  fontSize: "medium",
  defaultChatModel: "agnes-2.0-flash",
  defaultImageSize: "1024x768",
  defaultVideoRatio: "16:9",
};

/**
 * createAppContext - 创建应用上下文
 * @param {string} root - 应用根目录路径，默认为当前工作目录
 * @param {object} options - 可选配置项
 * @param {boolean} options.mediaCacheEnabled - 是否启用媒体缓存，默认 true
 * @returns {Promise<AppContext>} 应用上下文实例
 */
export async function createAppContext(
  root = process.cwd(),
  options: { mediaCacheEnabled?: boolean; aiClient?: AgnesClient } = {},
): Promise<AppContext> {
  assertEncryptionConfigured();
  const databaseFile = path.join(root, "data", "sqlite.db");
  const ai: AgnesClient = options.aiClient ?? createAIClient();
  const ctx = {
    ai,
    root,
    mediaRoot: path.join(root, "data", "media"),
    mediaCacheEnabled: options.mediaCacheEnabled ?? true,
    databaseFile,
    conversations: new SqliteRepository<Conversation>(databaseFile, "conversations", conversationFields),
    projects: new SqliteRepository<Project>(databaseFile, "projects", projectFields),
    messages: new SqliteRepository<Message>(databaseFile, "messages", messageFields),
    images: new SqliteRepository<ImageTask>(databaseFile, "image_tasks", imageTaskFields),
    videos: new SqliteRepository<VideoTask>(databaseFile, "video_tasks", videoTaskFields),
    favorites: new SqliteRepository<Favorite>(databaseFile, "favorites", favoriteFields),
    scriptComments: new SqliteRepository<ScriptComment>(databaseFile, "script_comments", scriptCommentFields),
    assetVersions: new SqliteRepository<AssetVersion>(databaseFile, "asset_versions", assetVersionFields),
    characterImageHistory: new SqliteRepository<CharacterImageHistory>(databaseFile, "character_image_history", characterImageHistoryFields),
    propImageHistory: new SqliteRepository<PropImageHistory>(databaseFile, "prop_image_history", propImageHistoryFields),
    sceneImageHistory: new SqliteRepository<SceneImageHistory>(databaseFile, "scene_image_history", sceneImageHistoryFields),
    settings: new SqliteSettingsRepository<Settings>(databaseFile, defaultSettings),
    aborts: new Map(),
    // 三大工厂
    characters: new SqliteRepository<Character>(databaseFile, "characters", characterFields),
    scenes: new SqliteRepository<Scene>(databaseFile, "scenes", sceneFields),
    props: new SqliteRepository<Prop>(databaseFile, "props", propFields),
    // 工厂资产图片（一对多）
    characterImages: new SqliteRepository<CharacterImage>(databaseFile, "character_images", characterImageFields),
    sceneImages: new SqliteRepository<SceneImage>(databaseFile, "scene_images", sceneImageFields),
    propImages: new SqliteRepository<PropImage>(databaseFile, "prop_images", propImageFields),
    // 独立模块
    storyboards: new SqliteRepository<Storyboard>(databaseFile, "storyboards", storyboardFields),
    shots: new SqliteRepository<Shot>(databaseFile, "shots", shotFields),
    shotSnapshots: new SqliteRepository<ShotSnapshot>(databaseFile, "shot_snapshots", shotSnapshotFields),
    projectStoryboards: new SqliteRepository<ProjectStoryboard>(databaseFile, "project_storyboards", projectStoryboardFields),
    audios: new SqliteRepository<Audio>(databaseFile, "audios", audioFields),
    moduleVideos: new SqliteRepository<ModuleVideoTask>(databaseFile, "module_video_tasks", moduleVideoTaskFields),
    moduleVideoTasks: new SqliteRepository<ModuleVideoTask>(databaseFile, "module_video_tasks", moduleVideoTaskFields),
    projectClips: new SqliteRepository<ProjectClip>(databaseFile, "project_clips", projectClipFields),
    // 剧本 / 资产 / 审核（Path A/B 共用同一张 SQLite 表，类型由 AppContext 字段用 any 兼容）
    scripts: new SqliteRepository<Script>(databaseFile, "scripts", scriptFields),
    projectScripts: new SqliteRepository<ProjectScript>(databaseFile, "scripts", projectScriptFields),
    assets: new SqliteRepository<Asset>(databaseFile, "assets", assetFields),
    projectAssets: new SqliteRepository<ProjectAsset>(databaseFile, "assets", projectAssetFields),
    reviews: new SqliteRepository<Review>(databaseFile, "reviews", reviewFields),
    projectReviews: new SqliteRepository<ProjectReview>(databaseFile, "reviews", projectReviewFields),
    // 项目管理
    projectTasks: new SqliteRepository<ProjectTask>(databaseFile, "project_tasks", projectTaskFields),
    projectEpisodes: new SqliteRepository<ProjectEpisode>(databaseFile, "project_episodes", projectEpisodeFields),
    projectIssues: new SqliteRepository<ProjectIssue>(databaseFile, "project_issues", projectIssueFields),
    projectMilestones: new SqliteRepository<ProjectMilestone>(databaseFile, "project_milestones", projectMilestoneFields),
    projectMembers: new SqliteRepository<ProjectMember>(databaseFile, "project_members", projectMemberFields),
    // 统一工作项（评审 P2：合并 4 表）
    workItems: new SqliteRepository<WorkItem>(databaseFile, "work_items", workItemFields),
    // 发布中心
    publishPlans: new SqliteRepository<PublishPlan>(databaseFile, "publish_plans", publishPlanFields),
    // 模型中心
    // 修复：之前用 `[]` 创建导致表被识别为 legacy table → seedModelConfigs / listModels 全失败。
    // 现在补齐 schema，让模型中心回到正常业务表状态。
    modelConfigs: new SqliteRepository<ModelConfig>(databaseFile, "model_configs", modelConfigFields),
    modelQuotas: new SqliteRepository<ModelQuota>(databaseFile, "model_quotas", modelQuotaFields),
    modelCallLogs: new SqliteRepository<ModelCallLog>(databaseFile, "model_call_logs", modelCallLogFields),
    // 剧本中心（Path B）
    // 方案 A 迁移：构造 scriptDocuments 时自动回填 Path A `scripts` 表的元数据
    // （仅在目标列为空时回填，已在 ensureColumns 之后）。
    scriptDocuments: (() => {
      const repo = new SqliteRepository<ScriptDocument>(databaseFile, "script_documents", scriptDocumentFields);
      try { repo.backfillFromScriptsTable(); } catch (e) { rootLogger.warn({ err: e }, "从 scripts 表回填 script_documents 失败（不影响启动）"); }
      return repo;
    })(),
    scriptEpisodes: new SqliteRepository<ScriptEpisode>(databaseFile, "script_episodes", scriptEpisodeFields),
    scriptScenes: new SqliteRepository<ScriptScene>(databaseFile, "script_scenes", scriptSceneFields),
    scriptDialogues: new SqliteRepository<ScriptDialogue>(databaseFile, "script_dialogues", scriptDialogueFields),
    scriptSceneCharacters: new SqliteRepository<ScriptSceneCharacter>(databaseFile, "script_scene_characters", scriptSceneCharacterFields),
    scriptSceneLocations: new SqliteRepository<ScriptSceneLocation>(databaseFile, "script_scene_locations", scriptSceneLocationFields),
    scriptTemplates: new SqliteRepository<ScriptTemplate>(databaseFile, "script_templates", scriptTemplateFields),
    scriptTags: new SqliteRepository<ScriptTag>(databaseFile, "script_tags", scriptTagFields),
    scriptQualityAssessments: new SqliteRepository<ScriptQualityAssessment>(databaseFile, "script_quality_assessments", scriptQualityAssessmentFields),
    scriptApprovals: new SqliteRepository<ScriptApproval>(databaseFile, "script_approvals", scriptApprovalFields),
    scriptBackups: new SqliteRepository<ScriptBackup>(databaseFile, "script_backups", scriptBackupFields),
    // 剧本分析提取的资产
    scriptAnalyzedCharacters: new SqliteRepository<ScriptAnalyzedCharacter>(databaseFile, "script_analyzed_characters", scriptAnalyzedCharacterFields),
    scriptAnalyzedScenes: new SqliteRepository<ScriptAnalyzedScene>(databaseFile, "script_analyzed_scenes", scriptAnalyzedSceneFields),
    scriptAnalyzedProps: new SqliteRepository<ScriptAnalyzedProp>(databaseFile, "script_analyzed_props", scriptAnalyzedPropFields),
    // 我的待办
    todos: new SqliteRepository<Todo>(databaseFile, "todos", todoFields),
    // 应用审计日志
    appLogs: new SqliteRepository<AppLog>(databaseFile, "app_logs", appLogFields),
    // === 4 中心横切：5 张新表（详见 docs/spec.md 第三节）===
    sensitiveWords: new SqliteRepository<SensitiveWord>(databaseFile, "sensitive_words", sensitiveWordFields),
    projectBudgets: new SqliteRepository<ProjectBudget>(databaseFile, "project_budgets", projectBudgetFields),
    auditLogs: new SqliteRepository<AuditLog>(databaseFile, "audit_logs", auditLogFields),
    notifications: new SqliteRepository<Notification>(databaseFile, "notifications", notificationFields),
    publishTemplates: new SqliteRepository<PublishTemplate>(databaseFile, "publish_templates", publishTemplateFields),
    // 4 中心业务（spec 4.1 审核 + 4.2 发布 + 4.4 系统管理）
    reviewItems: new SqliteRepository<ReviewItem>(databaseFile, "review_items", reviewItemFields),
    publishAccounts: new SqliteRepository<PublishAccount>(databaseFile, "publish_accounts", publishAccountFields),
    publishRecords: new SqliteRepository<PublishRecord>(databaseFile, "publish_records", publishRecordFields),
    projectPermissions: new SqliteRepository<ProjectPermission>(databaseFile, "project_permissions", projectPermissionFields),
    // P0-08 成本账本 + 审核 / 发布 业务扩展
    costRecords: new SqliteRepository<CostRecord>(databaseFile, "cost_records", costRecordFields),
    reviewHistories: new SqliteRepository<ReviewHistory>(databaseFile, "review_histories", reviewHistoryFields),
    projectInvitations: new SqliteRepository<ProjectInvitation>(databaseFile, "project_invitations", projectInvitationFields),
    publishChannels: new SqliteRepository<PublishChannel>(databaseFile, "publish_channels", publishChannelFields),
    publishJobs: new SqliteRepository<PublishJob>(databaseFile, "publish_jobs", publishJobFields),
    publishMetrics: new SqliteRepository<PublishMetrics>(databaseFile, "publish_metrics", publishMetricsFields),
    // V2 W8 REQ-PIPE-005-03 SLA 升级：审核配置表
    reviewConfigs: new SqliteRepository<ReviewConfig>(databaseFile, "review_configs", reviewConfigFields),
  };

  // === 4 中心横切服务（详见 docs/spec.md 第三节）===
  // 必须在 ctx 构造完成后才能引用仓储；用 Object.assign 挂上去
  // 5 个工厂函数签名都要求完整 AppContext，所以这里需要类型断言（运行时安全）
  const ctxTyped = ctx as unknown as AppContext;
  Object.assign(ctx, {
    sensitiveWordService: (await import("./horizontal/sensitive-word-service.js")).createSensitiveWordService(ctxTyped),
    budgetService: (await import("./horizontal/budget-service.js")).createBudgetService(ctxTyped),
    auditService: (await import("./horizontal/audit-service.js")).createAuditService(ctxTyped),
    notificationService: (await import("./horizontal/notification-service.js")).createNotificationService(ctxTyped),
    publishTemplateService: (await import("./horizontal/publish-template-service.js")).createPublishTemplateService(ctxTyped),
    // 4 中心业务（spec 4.1）
    reviewService: (await import("./horizontal/review-service.js")).createReviewService(ctxTyped),
    // V2 W8 REQ-PIPE-005-03 SLA 升级：监控器
    slaMonitor: (await import("./horizontal/sla-monitor.js")).createSlaMonitor(ctxTyped),
    // REQ-PIPE-001-05：节点并发追踪器（per-type 计数，跨 Run 共享）
    concurrencyTracker: (await import("./horizontal/concurrency-tracker.js")).createConcurrencyTracker(),
    // REQ-PIPE-003-01：节点事件 pub/sub 总线（SSE 实时进度推送底层）
    pipelineEventBus: (await import("./horizontal/pipeline-event-bus.js")).createPipelineEventBus(),
    // V2 W11 P0 REQ-RENDER-F01 / REQ-REVIEW-F20：合成/渲染预检服务
    compositionService: (await import("./module-domain/composition-service.js")).createCompositionService(ctxTyped),
    // V2 W11 MODEL-F01~F06 模型能力/参数约束服务
    modelConstraintsService: (await import("./horizontal/model-constraints-service.js")).getModelConstraintsService(),
    // V2 W11 ROUTE-F01~F05 路由策略服务（注入 databaseFile 走 route_policies / route_decision_logs 两表）
    routePolicyService: (await import("./horizontal/route-policy-service.js")).getRoutePolicyService(databaseFile),
    // V2 W11 DATA-F01~F12 指标服务（字典 + 12 个聚合 SQL 视图）
    metricsService: (await import("./horizontal/metrics-service.js")).getMetricsService(databaseFile),
    // V2 W11 AUDIO-F04/F06/F11/F13/F14 配音参数 + 候选 + 口型同步
    audioExtrasService: (await import("./horizontal/audio-extras-service.js")).getAudioExtrasService(databaseFile),
    // V2.1 REM-P1-010 内部服务凭证
    internalAuth: (await import("./internal-auth.js")).createInternalAuthService(),
    // V2.1 REM-P1-008 跨模块事务/Outbox 管理器
    transactionService: (await import("./horizontal/transaction-service.js")).createTransactionService({
      databaseFile,
    }),
    // V2.1 REM-P1-009 节点级重试策略（质控低分自动重试）
    retryPolicyService: (await import("./horizontal/retry-policy-service.js")).createRetryPolicyService({
      databaseFile,
    }),
  });
  // REQ-PIPE-W0：Pipeline 仓储（用真正的 FieldSpec，不能用 []）
  const { pipelineRunFields, pipelineNodeFields, pipelineDependencyFields, pipelineEventFields, qualityReportFields, qualityAutoConfigFields, retryPolicyFields } = await import("../types/pipeline.js");
  Object.assign(ctx, {
    pipelineRuns: new SqliteRepository<PipelineRun>(databaseFile, "pipeline_runs", pipelineRunFields),
    pipelineNodes: new SqliteRepository<PipelineNode>(databaseFile, "pipeline_nodes", pipelineNodeFields),
    pipelineDependencies: new SqliteRepository<PipelineDependency>(databaseFile, "pipeline_dependencies", pipelineDependencyFields),
    pipelineEvents: new SqliteRepository<PipelineEvent>(databaseFile, "pipeline_events", pipelineEventFields),
    qualityReports: new SqliteRepository<QualityReport>(databaseFile, "quality_reports", qualityReportFields),
    // V2 W6 REQ-PIPE-004-05：项目级自动质检配置（upsert by project_id）
    qualityAutoConfigs: new SqliteRepository<QualityAutoConfig>(databaseFile, "quality_auto_configs", qualityAutoConfigFields),
    // V2 W10 REQ-PIPE-006-03 死信队列：自动建表 pipeline_dead_letters
    pipelineDeadLetters: new SqliteRepository<PipelineDeadLetter>(databaseFile, "pipeline_dead_letters", pipelineDeadLetterFields),
    retryPolicies: new SqliteRepository<RetryPolicy>(databaseFile, "retry_policies", retryPolicyFields),
    // V2 W11 P0 REQ-RENDER-F08：成片版本表
    finalVideoVersions: new SqliteRepository<FinalVideoVersion>(databaseFile, "final_video_versions", finalVideoVersionFields),
    // V2 W12 P0 REQ-REVIEW-F01：审核快照表
    reviewSnapshots: new SqliteRepository<ReviewSnapshot>(databaseFile, "review_snapshots", reviewSnapshotFields),
    // V2 W12 P0 REQ-AUDIO-F08/F09/F10：字幕表（shot 维度）
    subtitles: new SqliteRepository<ShotSubtitle>(databaseFile, "shot_subtitles", shotSubtitleFields),
    // V2 W12 P0 REQ-EDIT-F01/F02/F03：时间线表
    timelines: new SqliteRepository<Timeline>(databaseFile, "timelines", timelineFields),
    // V2 W12 P0 REQ-EDIT-F02：时间线节点表
    timelineShots: new SqliteRepository<TimelineShot>(databaseFile, "timeline_shots", timelineShotFields),
    // V2 W12 P0 REQ-EDIT-F10：时间线版本表
    timelineVersions: new SqliteRepository<TimelineVersion>(databaseFile, "timeline_versions", timelineVersionFields),
  });
  // REQ-PIPE-W0：pipelineRunService 需引用 ctx 里的所有 pipeline 仓储 + bus + tracker
  (ctxTyped as { pipelineRunService: unknown }).pipelineRunService = (await import("./module-domain/pipeline-run-service.js")).createPipelineRunService(ctxTyped);
  // V2 W6+ REQ-PIPE-004 质检中心服务
  (ctxTyped as { qualityDetectionService: unknown }).qualityDetectionService =
    (await import("./module-domain/quality-detection-service.js"))
      .createQualityDetectionService(ctxTyped);
  // V2 W8 REQ-PIPE-005-03：启动 SLA 监控器（默认 60s tick；可被 env SLA_MONITOR_INTERVAL_MS 覆盖）
  (ctxTyped as { slaMonitor?: { start?: () => void; stop?: () => void } }).slaMonitor?.start?.();
  let closePromise: Promise<void> | null = null;
  (ctx as unknown as { close: () => Promise<void> }).close = () => {
    if (closePromise) return closePromise;
    try { (ctxTyped as { slaMonitor?: { stop?: () => void } }).slaMonitor?.stop?.(); } catch { /* ignore */ }
    closePromise = (async () => {
      await ctxTyped.pipelineRunService.waitForIdle();
      try { (ctxTyped as { concurrencyTracker?: { dispose?: () => void } }).concurrencyTracker?.dispose?.(); } catch { /* ignore */ }
      closeDatabase(databaseFile);
    })();
    return closePromise;
  };
  // 数据中心视图（spec 4.3）：3 个 view，一次性启动建。
  // 用 raw connection 直接 exec，不走 Repository（避免 FieldSpec 约束）。
  ensureAnalyticsViews(databaseFile);

  // === 独立模块：从 model_configs 表读取"智谱模型"的真实 API Key 注入到 AI 路由 ===
  // 关键：必须放在 createAppContext 末尾、调用方拿到 ctx 之后立即执行（同步 setup）。
  // 1) findMany 走真实的 modelConfigFields schema（不是 legacy）
  // 2) 命中 model id 以 "glm-" 或 "zhipu-" 开头的，提取 api_config.headers.Authorization 里的 Bearer key
  // 3) 注入到 RoutedAIClient，后续 chat({ model: "glm-4.7-flash", ... }) 自动走 Zhipu API
  try {
    if (!(ai instanceof RoutedAIClient)) throw new Error("非路由 AI Client，跳过运行时密钥注入");
    const models = await ctx.modelConfigs.findMany({});
    for (const m of models) {
      if (!shouldRouteToZhipu(m.id)) continue;
      const auth = (m.api_config as any)?.headers?.Authorization || (m.api_config as any)?.headers?.authorization;
      if (typeof auth === "string" && auth.trim().toLowerCase().startsWith("bearer ")) {
        const key = auth.trim().slice(7).trim();
        if (key && key !== "YOUR_API_KEY") {
          (ai as RoutedAIClient).injectZhipuApiKey(key);
          rootLogger.info(
            { event: "ai.zhipu.key_injected", model: m.id, keyLen: key.length },
            "已从 model_configs 注入智谱 API Key",
          );
          break;
        }
      }
    }
  } catch (e) {
    if (ai instanceof RoutedAIClient) rootLogger.warn({ err: e }, "智谱 API Key 注入失败（不影响启动）");
  }

  // === 独立模块：从 model_configs 表读取"Cerebras 模型"的配置注入到 AI 路由 ===
  // 1) 命中 model id 以 "cerebras-" 开头的，或 provider 为 "Cerebras" 的
  // 2) 提取 api_config.headers.Authorization 里的 Bearer key 和 api_config.proxyURL
  // 3) 注入到 RoutedAIClient，后续 chat({ model: "cerebras-gemma-4-31b", ... }) 自动走 Cerebras API
  try {
    if (!(ai instanceof RoutedAIClient)) throw new Error("非路由 AI Client，跳过运行时密钥注入");
    const models = await ctx.modelConfigs.findMany({});
    for (const m of models) {
      if (!shouldRouteToCerebras(m.id, m.provider)) continue;
      const auth = (m.api_config as any)?.headers?.Authorization || (m.api_config as any)?.headers?.authorization;
      const proxyURL = (m.api_config as any)?.proxyURL;
      if (typeof auth === "string" && auth.trim().toLowerCase().startsWith("bearer ")) {
        const key = auth.trim().slice(7).trim();
        if (key && key !== "YOUR_API_KEY") {
          (ai as RoutedAIClient).injectCerebrasConfig({
            apiKey: key,
            proxyURL: typeof proxyURL === "string" ? proxyURL : undefined,
          }, m.id);
          rootLogger.info(
            { event: "ai.cerebras.config_injected", model: m.id, keyLen: key.length, hasProxy: !!proxyURL },
            "已从 model_configs 注入 Cerebras 配置",
          );
          break;
        }
      }
    }
  } catch (e) {
    if (ai instanceof RoutedAIClient) rootLogger.warn({ err: e }, "Cerebras 配置注入失败（不影响启动）");
  }

  // === 独立模块：从 model_configs 表读取商汤模型的配置注入到 AI 路由 ===
  // 1) 命中 model id 以 "sensenova-" 开头的，或 provider 为 "sensenova"/"商汤" 的
  // 2) 提取 api_config.headers.Authorization 里的 Bearer key 和 api_config.proxyURL
  // 3) 注入到 RoutedAIClient，后续 chat({ model: "sensenova-6.7-flash-lite", ... }) 自动走商汤 API
  try {
    if (!(ai instanceof RoutedAIClient)) throw new Error("非路由 AI Client，跳过运行时密钥注入");
    const models = await ctx.modelConfigs.findMany({});
    for (const m of models) {
      if (!shouldRouteToSenseNova(m.id, m.provider)) continue;
      const auth = (m.api_config as any)?.headers?.Authorization || (m.api_config as any)?.headers?.authorization;
      const proxyURL = (m.api_config as any)?.proxyURL;
      if (typeof auth === "string" && auth.trim().toLowerCase().startsWith("bearer ")) {
        const key = auth.trim().slice(7).trim();
        if (key && key !== "YOUR_API_KEY") {
          (ai as RoutedAIClient).injectSenseNovaConfig({
            apiKey: key,
            proxyURL: typeof proxyURL === "string" ? proxyURL : undefined,
          }, m.id);
          rootLogger.info(
            { event: "ai.sensenova.config_injected", model: m.id, keyLen: key.length, hasProxy: !!proxyURL },
            "已从 model_configs 注入商汤配置",
          );
          break;
        }
      }
    }
  } catch (e) {
    if (ai instanceof RoutedAIClient) rootLogger.warn({ err: e }, "商汤配置注入失败（不影响启动）");
  }

  // V2.1 P1-008：启动 Outbox 后台 dispatcher（默认 2s 周期）。
  // 仅在非测试环境启动，避免测试用例被后台 timer 干扰；测试可显式调用 startBackgroundDispatcher。
  if (process.env.NODE_ENV !== "test" && process.env.MANJU_DISABLE_OUTBOX_DISPATCHER !== "1") {
    try {
      (ctx as any).transactionService.startBackgroundDispatcher({ intervalMs: 2000, batchSize: 32 });
      rootLogger.info({ event: "outbox.dispatcher_started", intervalMs: 2000 }, "Outbox 后台 dispatcher 已启动");
    } catch (e) {
      rootLogger.warn({ err: e }, "Outbox dispatcher 启动失败（不影响主流程）");
    }
  }

  return ctx as unknown as AppContext;
}

/**
 * ensureAnalyticsViews - 一次性创建数据中心 3 个 SQL 视图。
 *  - view_project_costs: 按 project_id 聚合 image/video/chat 任务数和成本估算
 *  - view_project_quality: 按 project_id 聚合 review_items 状态
 *  - view_project_capacity: 按 project_id 聚合各工厂资产计数
 * 失败不抛错（views 是性能优化层，缺失时前端可降级到实时聚合）。
 */
function ensureAnalyticsViews(databaseFile: string): void {
  try {
    const db = getRawDatabase(databaseFile);
    db.exec(`
      CREATE VIEW IF NOT EXISTS view_project_costs AS
      SELECT
        c.project_id AS project_id,
        COALESCE((SELECT COUNT(*) FROM image_tasks i JOIN conversations c2 ON c2.id = i.conversation_id WHERE c2.project_id = c.project_id), 0) AS image_count,
        COALESCE((SELECT COUNT(*) FROM video_tasks v JOIN conversations c2 ON c2.id = v.conversation_id WHERE c2.project_id = c.project_id), 0) AS video_count,
        COALESCE((SELECT SUM(tokens) FROM messages m JOIN conversations c2 ON c2.id = m.conversation_id WHERE c2.project_id = c.project_id AND m.role = 'assistant'), 0) AS chat_tokens,
        ROUND(COALESCE((SELECT COUNT(*) FROM image_tasks i JOIN conversations c2 ON c2.id = i.conversation_id WHERE c2.project_id = c.project_id), 0) * 0.05, 4) AS image_cost_estimate,
        ROUND(COALESCE((SELECT COUNT(*) FROM video_tasks v JOIN conversations c2 ON c2.id = v.conversation_id WHERE c2.project_id = c.project_id), 0) * 0.5, 4) AS video_cost_estimate,
        ROUND(COALESCE((SELECT SUM(tokens) FROM messages m JOIN conversations c2 ON c2.id = m.conversation_id WHERE c2.project_id = c.project_id AND m.role = 'assistant'), 0) * 0.001 / 1000, 4) AS chat_cost_estimate
      FROM conversations c
      WHERE c.project_id IS NOT NULL AND c.project_id <> ''
      GROUP BY c.project_id
    `);
    db.exec(`
      CREATE VIEW IF NOT EXISTS view_project_quality AS
      SELECT
        project_id,
        COUNT(*) AS review_total,
        COALESCE(SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END), 0) AS approved,
        COALESCE(SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END), 0) AS rejected,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) AS pending,
        COALESCE(SUM(CASE WHEN rejected_count >= 3 THEN 1 ELSE 0 END), 0) AS frequent_rejected,
        CASE WHEN COUNT(*) > 0
          THEN ROUND(100.0 * SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) / COUNT(*), 2)
          ELSE 0
        END AS pass_rate
      FROM review_items
      WHERE project_id IS NOT NULL AND project_id <> ''
      GROUP BY project_id
    `);
    db.exec(`
      CREATE VIEW IF NOT EXISTS view_project_capacity AS
      SELECT
        p.id AS project_id,
        COALESCE((SELECT COUNT(*) FROM project_storyboards WHERE project_id = p.id), 0) AS storyboard_count,
        COALESCE((SELECT COUNT(*) FROM scripts WHERE project_id = p.id), 0) AS script_count,
        COALESCE((SELECT COUNT(*) FROM characters WHERE project_id = p.id), 0) AS character_count,
        COALESCE((SELECT COUNT(*) FROM scenes WHERE project_id = p.id), 0) AS scene_count,
        COALESCE((SELECT COUNT(*) FROM props WHERE project_id = p.id), 0) AS prop_count
      FROM projects p
    `);
  } catch (err) {
    rootLogger.warn({ event: "analytics.views_init_failed", err: String(err) }, "数据中心视图初始化失败，前端会降级到实时聚合");
  }
}
