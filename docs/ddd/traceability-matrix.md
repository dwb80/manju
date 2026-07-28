# 需求—领域—实现追踪矩阵

> 本表用于阻止“有用户故事但无领域模型”或“有 API 但无业务规则”的断链。每个 P0/P1 用户故事进入开发前必须补齐全部列。

| 需求 | 主上下文 | 聚合/实体 | 关键命令 | 关键事件 | API/Schema | 验收证据 |
|---|---|---|---|---|---|---|
| US-001/002 项目与剧集 | 项目管控 | Project/Episode/Member | CreateProject/AddEpisode | ProjectCreated/EpisodeAdded | 待核验 | 待核验 |
| US-003/004 剧本与分析 | 剧本创作 | Script/ScriptDocument | PublishScript/AnalyzeScript | ScriptVersionPublished/ScriptAnalyzed | 待核验 | 待核验 |
| US-005/006 分镜 | 分镜导演 | Storyboard/Shot/ShotAssetBinding | AddShot/BindAssetToShot | ShotAdded/ShotAssetBound | 待核验 | 待核验 |
| US-007/008 资产 | 资产库 | Character/Scene/Prop | MarkReady/Publish | AssetPublished | 待核验 | 待核验 |
| US-009/011 AI 生成 | AI 任务调度 | AITask/PipelineRun | Create/Dispatch/Complete | AITaskCompleted | 待核验 | 待核验 |
| US-010/012 图片视频审核 | 审核质量 | Review/ReviewItem | Submit/Approve/RequestChanges | ReviewApproved/ReviewChangesRequested | 待核验 | 待核验 |
| US-013 音频 | 后期制作 | AudioAsset/AudioClip | Create/Publish/AddAudioClip | AudioAssetPublished | 待核验 | 待核验 |
| US-014 字幕 | 后期制作 | SubtitleDocument/SubtitleCue | Import/Generate/Publish | SubtitleDocumentPublished | 待核验 | 待核验 |
| US-015 剪辑 | 后期制作 | EditProject/RenderJob | UpdateTimeline/StartRender | RenderCompleted | 待核验 | 待核验 |
| US-016 成片审核 | 审核质量 | Review(stage=first/second) | Submit/Approve | FinalReviewApproved | 待核验 | 待核验 |
| US-017 发布 | 发布交付 | FinalVideo/PublishPlan/PublishRecord | Precheck/Schedule/Execute | PublishPlanCompleted | 待核验 | 待核验 |
| US-018-021 协作 | 智能助手/后期制作 | WorkItem/EditProject | Start/Complete/Close | WorkItemCompleted | 待核验 | 待核验 |
| MANGA-001 项目表现规格 | 项目管控 | ProjectPresentationSpec | UpdateProjectPresentationSpec | ProjectPresentationSpecUpdated | 目标：projects presentation_spec/version | 待核验 |
| MANGA-002～006 漫剧表现 | 分镜导演 | Shot/CompositionSpec/VisualLayer/TextOverlay/ComicEffectCue/MotionCue | UpdateComposition/Upsert*Cue | Shot*Updated | 目标：Shot 表现结构 + 版本化 API | 待核验 |
| MANGA-007 一致性检查 | 审核质量 | QCReport/QualityRuleSet | GenerateQCReport/TimeoutQCReport | QCReportCompleted/TimedOut | 目标：quality_rule_sets/qc_reports | 待核验 |
| MANGA-008 表现快照 | 分镜导演/审核质量 | PresentationSnapshot/Review | SubmitShotForReview | ShotPresentationFrozen/ReviewSubmitted | 目标：presentation_snapshots + snapshotHash | 待核验 |
| US-022 用户管理 | 平台身份能力 | UserAccount/SystemRole | Create/Invite/Disable/RevokeSessions | UserCreated/UserDisabled/SessionsRevoked | 现有 auth/users 待契约核验 | 待核验 |
| US-023 认证会话 | 平台身份能力 | Session/SSOLink | Login/Logout/ChangePassword/RevokeSession | SessionCreated/Revoked | 现有 auth/session/sso 待安全验收 | 待核验 |
| US-024 通知 | 通知 | Notification/NotificationPreference | CreateFromEvent/Dispatch/MarkRead/Escalate | NotificationCreated/Delivered/Read/Escalated | 现有 notifications 待模板/投递迁移 | 待核验 |
| US-025 回收站 | 各对象上下文 + 回收站读模型 | RecoveryPlan/各聚合 deletedAt | Restore/PermanentDelete/RetentionCleanup | AggregateRestored/PermanentlyDeleted | 目标：统一 trash API + retention job | 待核验 |
| US-026 配置中心 | 项目管控/平台配置 | ProjectPresentationSpec/BudgetPolicy/TypedSetting | Configure*/ResetOverride | ConfigurationChanged | 现有 settings 待作用域/schema 迁移 | 待核验 |
| US-027 审计 | 共享基础设施 | AuditRecord | AppendAudit/ExportAudit | AuditRecorded/ExportCompleted | 现有 app_logs/audit_logs 待收敛 | 待核验 |
| US-028 导入导出 | 平台数据交换 | ImportJob/ExportJob/ProjectPackage | Plan/Confirm/Execute/Cancel | ImportCompleted/ExportCompleted | 目标：versioned package + staging | 待核验 |
| US-029 备份恢复 | 平台运维 | BackupSet/RestoreJob | Create/Verify/Restore | BackupVerified/RestoreCompleted | 现有脚本待全量恢复演练 | 待核验 |
| 成本治理 | 项目管控/AI任务调度 | ProjectBudgetPolicy/BudgetReservation | Configure/Reserve/Settle/Release | BudgetConfigured/ThresholdReached/Exceeded | 目标：project_budgets/reservations/cost_records | 待核验 |
| 质量规则配置 | 审核质量 | QualityRuleSet/QCReport | PublishRuleSet/Assign/Generate/Timeout | RuleSetPublished/QCReportTimedOut | 目标：quality_rule_sets + 配置 API | 待核验 |

## 准入规则

- “API/Schema”和“验收证据”任一为“待核验”，不得将功能标记为已完成。
- 聚合、命令或事件为空，需求不得进入开发排期。
- 需求、领域、API 或存储发生变更时，必须在同一变更中更新本表。
- “目标：”表示已冻结的设计目标，不是已实现证据；只有真实路由、迁移、代码路径和通过的测试编号可替换“待核验”。
