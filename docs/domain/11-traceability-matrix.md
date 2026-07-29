# 需求-领域-实现追踪矩阵

> 每个功能的页面交互、目标 API、逻辑数据模型和可执行场景见 [逐功能交付规格](../delivery-specs/README.md)。本表只在获得真实代码、迁移和测试证据后更新“实现证据/验收测试”。

> 本表用于阻止“有用户故事但无领域模型”或“有 API 但无业务规则”的断链。每个 P0/P1 用户故事进入开发前必须补齐全部列。

| 需求 | 主上下文 | 聚合/实体 | 关键命令 | 关键事件 | API/Schema | 验收证据 |
|---|---|---|---|---|---|---|
| US-001 创建项目 | 项目管控 | Project/Member | CreateProject | ProjectCreated | 待核验 | 待核验 |
| US-002 创建剧集 | 项目管控 | Project/Episode | AddEpisode | EpisodeAdded | 待核验 | 待核验 |
| US-003 剧本文档 | 剧本创作 | Script/ScriptDocument | SaveDraft/PublishScript | ScriptVersionPublished | 待核验 | 待核验 |
| US-004 剧本分析 | 剧本创作/AI任务调度 | Script/AITask | AnalyzeScript/ApplyAnalysis | ScriptAnalyzed | 待核验 | 待核验 |
| US-033 AI辅助剧本创作 | 剧本创作/AI任务调度 | ScriptCreationTask | CreateScriptCreationTask/AdoptCreationCandidate | ScriptCreationTaskCompleted/CreationCandidateAdopted | 目标：script_creation_tasks | 待核验 |
| US-005 创建分镜 | 分镜导演 | Storyboard/Shot/ShotAssetBinding | AddShot/ReorderShots/BindAsset | ShotAdded/ShotAssetBound | 待核验 | 待核验 |
| US-006 AI 分镜建议 | 分镜导演/AI任务调度 | ShotSuggestionJob/ShotSuggestion | Create/ApplySuggestions | ShotSuggestionsGenerated/Applied | 待核验 | 待核验 |
| US-007 角色资产 | 资产库 | Character/CharacterVersion | Create/Update/Publish | CharacterPublished | 待核验 | 待核验 |
| US-008 场景道具资产 | 资产库 | Scene/Prop | Create/Update/Publish | AssetPublished | 待核验 | 待核验 |
| US-030 风格资产 | 资产库 | StyleAsset/StyleAssetVersion | Create/Update/Publish/Archive | StyleAssetVersionPublished | 目标：style_assets/style_asset_versions | 待核验 |
| US-031 跨项目资产复用 | 资产库 | Character/Scene/Prop/StyleAsset + AssetOrigin | CopyPublishedAssetToProject | AssetCopiedToProject | 目标：copied_from exact version | 待核验 |
| US-032 内容安全与权利治理 | 资产库/审核质量/发布交付 | RightsMetadata/SafetyDecision | UpdateRights/Precheck/Decide | RightsMetadataChanged/PublishPrecheckCompleted | 目标：rights snapshots/safety decisions | 待核验 |
| US-009 图片生成 | AI任务调度 | AITask/GeneratedImage | Create/Dispatch/Complete/Adopt | AITaskCompleted/ImageAdopted | 待核验 | 待核验 |
| US-010 图片审核 | 审核质量 | Review/ReviewDecision | Submit/Decide | ReviewApproved/ChangesRequested | 待核验 | 待核验 |
| US-011 视频生成 | AI任务调度 | PipelineRun/AITask/GeneratedVideo | Create/Dispatch/Complete/Adopt | AITaskCompleted/VideoAdopted | 待核验 | 待核验 |
| US-012 视频审核 | 审核质量 | Review/ReviewComment/Decision | Submit/Comment/Decide | ReviewApproved/ChangesRequested | 待核验 | 待核验 |
| US-013 音频 | 后期制作 | AudioAsset/AudioClip | Create/Publish/AddAudioClip | AudioAssetPublished | 待核验 | 待核验 |
| US-014 字幕 | 后期制作 | SubtitleDocument/SubtitleCue | Import/Generate/Publish | SubtitleDocumentPublished | 待核验 | 待核验 |
| US-015 剪辑 | 后期制作 | EditProject/RenderJob | UpdateTimeline/StartRender | RenderCompleted | 待核验 | 待核验 |
| US-016 成片审核 | 审核质量 | Review(stage=first/second) | Submit/Approve | FinalReviewApproved | 待核验 | 待核验 |
| US-017 发布 | 发布交付 | FinalVideo/PublishPlan/PublishRecord | Precheck/Schedule/Execute | PublishPlanCompleted | 待核验 | 待核验 |
| US-018 任务管理 | 智能助手 | WorkItem(type=task) | Create/Assign/Transition | WorkItemAssigned/Completed | 待核验 | 待核验 |
| US-019 问题管理 | 智能助手 | WorkItem(type=issue) | Create/Resolve/Verify | IssueResolved/Verified | 待核验 | 待核验 |
| US-020 里程碑管理 | 智能助手 | WorkItem(type=milestone) | Create/Link/Achieve | MilestoneAchieved | 待核验 | 待核验 |
| US-021 剪辑片段 | 后期制作 | EditProject/VideoClip | Add/Update/Split/RemoveClip | EditProjectVersionCreated | 待核验 | 待核验 |
| US-PM-001 Prompt 模板 | AI任务调度 | PromptTemplate/PromptTemplateVersion | Create/Validate/Publish/Test/Archive | PromptTemplatePublished | 目标：prompt_template_versions | 待核验 |
| US-DS-001 数据统计 | AI任务调度/CQRS | MetricProjection/MetricExportJob | Query/Rebuild/Export | MetricProjectionUpdated/ExportCompleted | 目标：daily_*_metrics/metric_exports | 待核验 |
| MANGA-001 项目表现规格 | 项目管控 | ProjectPresentationSpec | UpdateProjectPresentationSpec | ProjectPresentationSpecUpdated | 目标：projects presentation_spec/version | 待核验 |
| MANGA-002 图层化构图 | 分镜导演 | Shot/CompositionSpec/VisualLayer | UpdateComposition/UpsertVisualLayer/RemoveVisualLayer | ShotCompositionUpdated/VisualLayerUpserted/Removed | 目标：Shot 构图结构 + 版本化 API | 待核验 |
| MANGA-003 对白气泡与旁白 | 分镜导演 | Shot/TextOverlay | UpsertTextOverlay/RemoveTextOverlay | TextOverlayUpserted/Removed | 目标：text_overlays + Script 行引用 | 待核验 |
| MANGA-004 拟声词管理 | 分镜导演/资产库 | Shot/TextOverlay/AudioAsset | UpsertTextOverlay/BindAudioAsset | TextOverlayUpserted/AudioAssetBound | 目标：onomatopoeia 结构 + 音效版本引用 | 待核验 |
| MANGA-005 漫画特效 | 分镜导演 | Shot/ComicEffectCue | UpsertComicEffectCue/RemoveComicEffectCue | ComicEffectCueUpserted/Removed | 目标：comic_effect_cues + 版本化 schema | 待核验 |
| MANGA-006 有限动态编排 | 分镜导演/后期制作 | Shot/MotionCue/EditProject | UpsertMotionCue/RemoveMotionCue/RenderPreview | MotionCueUpserted/Removed | 目标：motion_cues + 统一预览/渲染参数 | 待核验 |
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
| CAP-001 项目成员与权限 | 项目管控 | Project/Member | Add/Update/RemoveMember/TransferOwnership | MemberAdded/Updated/Removed/OwnershipTransferred | 目标：project_members + 命令 API | 待核验 |
| CAP-002 模型配置与路由 | AI任务调度 | ModelConfig | Create/Update/Test/Activate | ModelConfigActivated/RouteChanged | 目标：model_configs/model_route_defaults | 待核验 |
| CAP-003 流水线模板 | AI任务调度 | PipelineTemplate | Create/Validate/Publish/Deactivate | PipelineTemplatePublished | 目标：pipeline_template_versions | 待核验 |
| CAP-004 数据集管理 | AI任务调度 | Dataset | Create/Import/Publish/Export/Archive | DatasetVersionPublished | 目标：datasets/dataset_versions | 待核验 |
| CAP-005 AI 对话与创意工作室 | 智能助手/AI任务调度 | Conversation/Message/AITask | Send/Stop/Regenerate/CreateTask | MessageCompleted/AITaskCreated | 目标：conversations/messages + task ref | 待核验 |
| CAP-006 AI 任务队列运维 | AI任务调度 | AITask/AITaskAttempt | Cancel/Retry/ResolveManually | AITaskCancelled/Retried/Resolved | 目标：ai_task_attempts/resolutions | 待核验 |
| CAP-007 项目预算治理 | 项目管控/AI任务调度 | ProjectBudgetPolicy/BudgetReservation | Configure/Reserve/Settle/Release/Reconcile | BudgetConfigured/ReservationSettled | 目标：project_budgets/reservations/cost_records | 待核验 |
| CAP-008 质量规则配置 | 审核质量 | QualityRuleSet/ProjectQualityPolicy | Validate/Publish/Assign | RuleSetPublished/QualityPolicyChanged | 目标：quality_rule_set_versions/project_quality_policies | 待核验 |
| DEP-001 生产依赖登记 | 智能助手/CQRS | ProductionDependencyEdge | ProjectFromDomainEvents/RebuildProjection | DependencyProjectionRebuilt | 目标：production_dependency_edges/inbox watermark | 待核验 |
| DEP-002 变更影响评估 | 智能助手/CQRS | ImpactAssessment | PreviewChangeImpact/AssessPublishedChange | DependencyImpactAssessed | 目标：impact_assessments/affected_refs | 待核验 |
| DEP-003 新鲜度处置 | 智能助手/CQRS + 目标上下文 | DependencyFreshness/WorkItem | AcknowledgeLockedVersion/CreateUpgradeWorkItems | DependencyFreshnessChanged/WorkItemCreated | 目标：dependency_freshness/acknowledgements | 待核验 |
| DEP-004 增量升级计划 | 智能助手 + 各目标上下文 | ImpactAssessment/WorkItem/目标聚合 | CreateIncrementalUpgradeWorkItems/目标命令 | WorkItemCreated + 各目标事实事件 | 目标：impact correlationId/逐项结果 | 待核验 |
| DEP-005 全链路追溯 | 智能助手/CQRS | TraceabilityChainProjection | GetTraceabilityChain/ExportTraceabilityReport | TraceabilityGapDetected/ExportCompleted | 目标：traceability nodes/edges/report hash | 待核验 |
| OPS-001 Episode 生产矩阵 | 项目管控/智能助手 | ProductionPlan/ProductionControlTower | PublishProductionPlan/ProjectFacts | ProductionPlanPublished + 各领域事实 | 目标：production_plans/control_tower_projection | 待核验 |
| OPS-002 瓶颈与交付预测 | 智能助手/CQRS | ProductionControlTower | RebuildProjection/QueryForecast | ProjectionUpdated | 目标：bottleneck evidence/forecast watermark | 待核验 |
| OPS-003 排产与接管 | 项目管控/智能助手 | ProductionPlan/WorkItem | Reassign/Pause/CreateWorkItem | ProductionPlanItemReassigned/WorkItemCreated | 目标：plan revisions/assignee history | 待核验 |
| SHOT-001 可视化构图 | 分镜导演 | Shot/CompositionSpec/VisualLayer | UpdateComposition/UpsertVisualLayer | ShotCompositionUpdated/ShotVisualLayerUpserted | 目标：normalized canvas schema | 待核验 |
| SHOT-002 序列与时间预览 | 分镜导演 | Shot/Storyboard/PresentationSnapshot | ReorderShots/UpdateCue | ShotsReordered/ShotPresentationFrozen | 目标：sequence impact/preview snapshot | 待核验 |
| CAND-001 候选比较与采纳 | 分镜导演/审核质量 | Shot/MediaCandidate/QCReport | AttachGeneratedImage/AttachGeneratedVideo/AdoptCandidate | ShotImageCandidateAttached/ShotVideoCandidateAttached/ImageAdopted/VideoAdopted | 目标：media_candidates/adoption history | 待核验 |
| CAND-002 候选版本树 | 分镜导演/智能助手 | MediaCandidate/CandidateTreeProjection | Derive/ArchiveMediaCandidate/QueryTree | ShotImageCandidateAttached/ShotVideoCandidateAttached/MediaCandidateArchived | 目标：parent_candidate_id/tree projection | 待核验 |
| CAND-003 批量候选处置 | 分镜导演 | Shot/MediaCandidate | BatchAdopt/RetryFailed | ImageAdopted/VideoAdopted | 目标：per-item result/idempotency | 待核验 |
| CONT-001 连续性基线 | 审核质量 | ContinuityBaseline | Create/Publish/CreateRevision | ContinuityBaselinePublished | 目标：continuity_baseline_versions | 待核验 |
| CONT-002 连续性检查处置 | 审核质量/智能助手 | ContinuityCase/WorkItem | Open/Acknowledge/Resolve/Waive | ContinuityCaseOpened/Resolved/Waived | 目标：continuity_cases/evidence | 待核验 |
| REV-001 同步审片 | 审核质量/CQRS | Review/ReviewComparisonProjection | Start/Approve/Reject | ReviewStarted/Approved/Rejected | 目标：review frozen comparison DTO | 待核验 |
| REV-002 时码区域批注 | 审核质量 | Review/ReviewAnnotation | Add/Resolve/ReopenAnnotation | ReviewAnnotationAdded/Resolved/Reopened | 目标：review_annotations normalized region/time | 待核验 |
| REV-003 返工核销 | 审核质量/智能助手 | Review/ReviewAnnotation/WorkItem | ResubmitReview/ResolveReviewAnnotation/ApproveReview | ReviewResubmitted/ReviewAnnotationResolved/ReviewApproved | 目标：review rounds/fix evidence | 待核验 |
| EDIT-001 多轨时间线 | 后期制作 | EditProject/Track/Clip | Add/Split/Move/SetTrackState | ClipSplit/TrackStateChanged | 目标：timeline revision schema | 待核验 |
| EDIT-002 修订与冲突恢复 | 后期制作 | EditProject/EditProjectRevision | Create/RestoreRevision | EditProjectVersionCreated | 目标：timelineHash/expectedVersion/local recovery contract | 待核验 |
| EDIT-003 渲染预检与导出 | 后期制作 | EditProject/RenderJob/ExportJob | Precheck/StartRender/ExportInterchange | EditRenderRequested/InterchangeExportCompleted | 目标：precheck report/interchange manifest | 待核验 |
| COLLAB-001 编辑租约 | 项目管控 | EditLease | Acquire/Renew/Release/Takeover | EditLeaseAcquired/Expired/TakenOver | 目标：edit_leases/heartbeat | 待核验 |
| COLLAB-002 乐观冲突 | 各业务上下文 | Aggregate version/LocalRecoveryDraft | SaveWithExpectedVersion/Reapply | AggregateFacts/AuditRecorded | 目标：统一 version conflict contract | 待核验 |
| COLLAB-003 评论交接代理 | 智能助手/项目管控 | CommentThread/WorkItem/Delegation | Comment/Transfer/GrantDelegation | CommentAdded/DelegationGranted | 目标：comments/delegations/transfer history | 待核验 |

## 准入规则

- “API/Schema”和“验收证据”任一为“待核验”，不得将功能标记为已完成。
- 聚合、命令或事件为空，需求不得进入开发排期。
- 需求、领域、API 或存储发生变更时，必须在同一变更中更新本表。
- “目标：”表示已冻结的设计目标，不是已实现证据；只有真实路由、迁移、代码路径和通过的测试编号可替换“待核验”。
