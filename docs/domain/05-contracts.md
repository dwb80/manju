# 跨上下文协作契约

> **配套规范**：[DDD 治理规范](02-governance.md)｜[上下文映射](04-context-map.md)｜[统一语言术语表](03-glossary.md)

所有跨上下文协作通过领域事件完成，禁止上下文间直接方法调用或直接修改对方聚合。

> 跨上下文契约只定义"事件 → 消费上下文 → 消费动作（高层描述）"，不暴露消费上下文的内部命令名。消费上下文内部调用什么命令是它自己的实现细节。

---

## 1. 事件驱动的跨上下文链路

### 1.1 核心业务链路

> 以下链路描述以 [§2 事件消费者注册表](#2-事件消费者注册表) 为权威来源，注册表中存在但链路中遗漏的消费者和事件已补全。

```
项目创建
  ProjectCreated
    → 智能助手上下文: 初始化项目工作台

项目更新
  ProjectUpdated
    → 智能助手上下文: 更新项目摘要

生产排产与协作
  ProductionPlanPublished / ProductionPlanItemReassigned / ProductionPlanItemCompleted
    → 智能助手上下文: 更新 Episode 生产矩阵、责任和预测
  EditLeaseAcquired / EditLeaseReleased / EditLeaseExpired / EditLeaseTakenOver
    → 智能助手上下文: 更新协作状态
  DelegationGranted / DelegationRevoked / DelegationExpired
    → 智能助手上下文: 更新有效权限和待办代理提示

剧本分析完成
  ScriptAnalyzed
    → 资产库上下文: 创建角色/场景/道具草稿（待人工确认入库）

剧本分析失败
  ScriptAnalysisFailed
    → 通知上下文: 告警编剧/项目负责人

AI 辅助剧本创作任务创建
  ScriptCreationTaskCreated
    → AI 任务调度上下文: 创建 AITask 执行 AI 文本生成调用

AI 辅助剧本创作任务完成
  ScriptCreationTaskCompleted
    → 通知上下文: 通知用户预览候选结果

AI 辅助剧本创作任务失败
  ScriptCreationTaskFailed
    → 通知上下文: 告警用户失败原因

创作候选被采纳
  CreationCandidateAdopted
    → 智能助手上下文: DEP 影响评估、更新版本列表
    → 分镜导演上下文: （仅 split_shots 类型）创建 Shot 草稿（待人工确认）

剧本文档发布
  ScriptVersionPublished
    → 分镜导演上下文: 允许创建分镜板

剧本新版本创建
  ScriptNewVersionCreated
    → 智能助手上下文: 更新版本列表

分镜送审
  ShotSubmittedForReview
    → 审核质量上下文: 启动 Review Intake，先创建绑定同一 shotVersion + snapshotHash 的 QCReport

质检准入
  QCReportCompleted(passed=true)
    → 审核质量上下文: 创建 Review pending
  QCReportCompleted(passed=false) / QCReportFailed / QCReportTimedOut
    → 审核质量上下文: 按 QualityRuleSet 的 block/warn 策略阻断、重试或等待显式豁免
  QCGateWaived
    → 审核质量上下文: 校验权限、mandatory 规则和 AuditRecord 后创建 Review pending
  ReviewIntakeBlocked
    → 目标上下文: 进入 needs_fix
    → 智能助手上下文: 创建结构化返工工作项

审核通过
  ReviewApproved
    → 分镜导演上下文: 标记分镜通过
    → AI任务调度上下文: 完成 Pipeline 审核节点（status → completed）
    → 智能助手上下文: 移除审核工作项

审核驳回
  ReviewRejected
    → 分镜导演上下文: 标记分镜驳回（status → rejected）
    → AI任务调度上下文: 失败/路由 Pipeline 审核节点（status → failed 或分支条件判定）
    → 智能助手上下文: 新增返工工作项

审核重新提交
  ReviewResubmitted
    → 智能助手上下文: 刷新工作项

审核指派
  ReviewAssigned
    → 通知上下文: 通知被指派人

审核关闭/取消
  ReviewClosed / ReviewCancelled
    → 智能助手上下文: 移除审核工作项

质检完成
  QCReportCompleted
    → 分镜导演上下文: 标记质检报告
    → 智能助手上下文: 创建质检工作项（如未通过）

连续性与专业批注
  ContinuityBaselinePublished
    → 分镜导演上下文: 更新镜头连续性提示基线
    → 智能助手上下文: 更新 DEP 与连续性看板
  ContinuityCaseOpened / Reopened / Resolved / Waived
    → 智能助手上下文: 创建、恢复或核销连续性工作项
  ReviewAnnotationAdded / Resolved / Reopened
    → 智能助手上下文: 更新返工明细和核销状态

质检失败
  QCReportFailed
    → 通知上下文: 告警任务责任人

分镜通过
  ShotApproved
    → 后期制作上下文: 分镜视频可进入剪辑工程

AI 任务完成
  AITaskCompleted (按 type 路由，见 [05-ai-task-orchestration](contexts/05-ai-task-orchestration.md))
    → type=video: 分镜导演上下文: 绑定生成视频到分镜
    → type=image: 资产库上下文: 绑定生成图片到资产候选
    → type=text: 剧本创作上下文: 绑定 AI 辅助文本
    → type=audio: 后期制作上下文: 创建或绑定音频资产候选

AI 任务失败
  AITaskFailed
    → 分镜导演上下文: 标记生成失败
    → 智能助手上下文: 创建告警工作项

AI 任务取消
  AITaskCancelled
    → 智能助手上下文: 更新任务状态

流水线状态变更
  PipelineRunStarted / PipelineRunCompleted / PipelineRunFailed / PipelineRunCancelled / PipelineRunPaused / PipelineRunResumed / PipelineRunRetried
    → 智能助手上下文: 更新流水线状态
    → 分镜导演上下文: 通知分镜生成完成/取消（仅 Completed/Cancelled）

成片创建/打包
  FinalVideoCreated / PackagingStarted / PackagingCompleted / PackagingFailed
    → 智能助手上下文: 更新成片列表/打包状态

成片发布
  FinalVideoPublished
    → 项目管控上下文: 更新项目进度
    → 智能助手上下文: 创建发布确认工作项

成片撤销发布
  FinalVideoUnpublished
    → 项目管控上下文: 更新项目进度

成片删除
  FinalVideoDeleted
    → 智能助手上下文: 移除成片

发布计划状态变更
  PublishPlanCreated / PublishPlanScheduled / PublishPlanExecutionStarted / PublishPlanCompleted / PublishPlanFailed / PublishPlanCancelled
    → 智能助手上下文: 更新发布计划状态
    → 项目管控上下文: 标记剧集发布完成（仅 Completed）

剧集删除
  EpisodeDeleted
    → 剧本创作上下文: 级联软删除剧本
    → 分镜导演上下文: 级联清理分镜板

项目归档
  ProjectArchived
    → 全部上下文: 标记关联资源为只读

项目恢复
  ProjectRestored
    → 全部上下文: 解除资源只读
    → 智能助手上下文: 恢复工作台

项目删除
  ProjectDeleted
    → 智能助手上下文: 移除工作台

角色发布/归档/恢复
  CharacterPublished / CharacterUnpublished / CharacterArchived / CharacterRestored
    → 分镜导演上下文: 引用可用/失效/恢复提醒

场景发布/归档/恢复
  ScenePublished / SceneUnpublished / SceneArchived / SceneRestored
    → 分镜导演上下文: 引用可用/失效/恢复提醒

道具发布/归档/恢复
  PropPublished / PropUnpublished / PropArchived / PropRestored
    → 分镜导演上下文: 引用可用/失效/恢复提醒

一致性包更新
  ConsistencyPackUpdated
    → AI任务调度上下文: 更新生成参数缓存

分镜资产绑定
  ShotAssetBound / ShotAssetUnbound
    → 资产库上下文: 幂等更新引用计数投影

后期制作与渲染
  EditRenderRequested
    → 后期渲染器: 调度 RenderJob
  RenderCompleted
    → 发布交付上下文: 创建 FinalVideo 草稿
    → 智能助手上下文: 更新导出状态
  RenderFailed
    → 智能助手上下文: 创建告警工作项

成片终审与发布预检
  FinalVideoReviewSubmitted
    → 审核质量上下文: 创建 final_video 两级审核
  ReviewApproved(targetType=final_video)
    → 发布交付上下文: 标记当前 artifactRevision 审核通过
  PublishPrecheckCompleted
    → 智能助手上下文: 更新发布阻断项

模板实例化
  TemplateInstantiated
    → 智能助手上下文: 更新流水线列表

数据集变更
  DatasetCreated / DatasetImportCompleted / DatasetExportCompleted / DatasetArchived / DatasetDeleted
    → 智能助手上下文: 更新数据集状态

团队成员变更
  MemberAdded / MemberRemoved / MemberRolesUpdated / OwnershipTransferred / PermissionUpdated
    → 智能助手上下文: 更新团队列表

模型配置变更
  ModelConfigCreated / ModelConfigUpdated
    → 智能助手上下文: 更新模型列表/状态

Prompt 模板变更
  PromptTemplateCreated / PromptTemplateUpdated / PromptTemplatePublished / PromptTemplateArchived
    → 智能助手上下文: 更新模板列表/状态

生产版本与证据变更（DEP）
  ScriptVersionPublished
  CharacterVersionPublished / SceneVersionPublished / PropVersionPublished / StyleAssetVersionPublished
  RightsMetadataChanged
  ShotPresentationFrozen / ImageAdopted / VideoAdopted
  AITaskCompleted / AudioAssetPublished / SubtitleDocumentPublished
  EditProjectVersionCreated / RenderCompleted
  ReviewSubmitted / ReviewApproved / ReviewChangesRequested
  FinalVideoCreated / FinalVideoPublished / PublishRecordCreated
    → 智能助手上下文: 幂等更新 ProductionDependencyProjection / TraceabilityChainProjection
    → 投影完成后发布 DependencyImpactAssessed / DependencyFreshnessChanged / TraceabilityGapDetected

DEP 投影事实
  DependencyImpactAssessed / DependencyFreshnessChanged
    → 智能助手上下文: 刷新影响清单、对象新鲜度徽标和增量处置入口
  TraceabilityGapDetected
    → 智能助手上下文: 创建证据修复工作项
    → 通知上下文: 仅在发布阻断或 P0 影响时告警
  DependencyProjectionRebuilt
    → 智能助手上下文: 解除 rebuilding/结果不完整提示
```

---

## 2. 事件消费者注册表

> 区分跨上下文（必须出现在注册表中）和上下文内部（不必出现）。

| 事件 | 发布上下文 | 消费上下文 | 消费动作 | 事件类型 |
|------|-----------|-----------|---------|---------|
| `ProjectCreated` | 项目管控 | 智能助手 | 初始化项目工作台 | 跨上下文 |
| `ProjectUpdated` | 项目管控 | 智能助手 | 更新项目摘要 | 跨上下文 |
| `ProductionPlanCreated` / `ProductionPlanItemChanged` / `ProductionPlanPublished` / `ProductionPlanSuperseded` | 项目管控 | 智能助手 | 更新控制塔计划版本和矩阵计划值 | 跨上下文 |
| `ProductionPlanItemPaused` / `ProductionPlanItemReassigned` / `ProductionPlanItemCompleted` | 项目管控 | 智能助手 | 更新阶段责任、状态和完成证据 | 跨上下文 |
| `EditLeaseAcquired` / `EditLeaseRenewed` / `EditLeaseReleased` / `EditLeaseExpired` | 项目管控 | 智能助手 | 更新对象协作状态 | 跨上下文 |
| `EditLeaseTakenOver` | 项目管控 | 智能助手 / 通知 | 更新持有人并通知原持有人 | 跨上下文 |
| `DelegationGranted` / `DelegationRevoked` / `DelegationExpired` | 项目管控 | 智能助手 / 通知 | 更新代理权限显示并通知当事人 | 跨上下文 |
| `ProjectArchived` | 项目管控 | 全部上下文 | 标记关联资源为只读 | 跨上下文 |
| `ProjectRestored` | 项目管控 | 全部上下文 / 智能助手 | 解除资源只读 / 恢复工作台 | 跨上下文 |
| `ProjectDeleted` | 项目管控 | 智能助手 | 移除工作台 | 跨上下文 |
| `EpisodeAdded` | 项目管控 | 剧本创作 | 允许为该剧集创建剧本 | 跨上下文 |
| `EpisodeUpdated` | 项目管控 | 智能助手 | 更新剧集列表 | 跨上下文 |
| `EpisodeDeleted` | 项目管控 | 剧本创作 | 级联软删除剧本 | 跨上下文 |
| `EpisodeDeleted` | 项目管控 | 分镜导演 | 级联清理分镜板 | 跨上下文 |
| `ScriptCreated` | 剧本创作 | 智能助手 | 更新剧本列表 | 跨上下文 |
| `ScriptUpdated` | 剧本创作 | 智能助手 | 刷新内容缓存 | 跨上下文 |
| `ScriptAnalyzed` | 剧本创作 | 资产库 | 创建资产草稿 | 跨上下文 |
| `ScriptAnalysisFailed` | 剧本创作 | 通知 | 告警编剧/项目负责人 | 跨上下文 |
| `ScriptVersionPublished` | 剧本创作 | 分镜导演 | 允许创建分镜板 | 跨上下文 |
| `ScriptVersionPublished` | 剧本创作 | 智能助手 | 更新 DEP 版本依赖并评估下游影响 | 跨上下文 |
| `ScriptNewVersionCreated` | 剧本创作 | 智能助手 | 更新版本列表 | 跨上下文 |
| `ScriptDeleted` | 剧本创作 | 智能助手 | 移除剧本 | 跨上下文 |
| `CharacterCreated` | 资产库 | 智能助手 | 更新角色列表 | 跨上下文 |
| `CharacterUpdated` | 资产库 | 智能助手 | 刷新角色摘要 | 跨上下文 |
| `CharacterMarkedReady` | 资产库 | 智能助手 | 更新角色状态 | 跨上下文 |
| `CharacterPublished` | 资产库 | 分镜导演 | 可引用提示 | 跨上下文 |
| `CharacterVersionPublished` | 资产库 | 智能助手 | 登记角色版本依赖并评估影响 | 跨上下文 |
| `CharacterUnpublished` | 资产库 | 分镜导演 | 引用失效提醒 | 跨上下文 |
| `CharacterArchived` | 资产库 | 分镜导演 | 引用失效提醒 | 跨上下文 |
| `CharacterRestored` | 资产库 | 分镜导演 | 引用恢复提示 | 跨上下文 |
| `CharacterDeleted` | 资产库 | 智能助手 | 移除角色 | 跨上下文 |
| `ConsistencyPackUpdated` | 资产库 | AI任务调度 | 更新生成参数 | 跨上下文 |
| `SceneCreated` | 资产库 | 智能助手 | 更新场景列表 | 跨上下文 |
| `SceneUpdated` | 资产库 | 智能助手 | 刷新场景摘要 | 跨上下文 |
| `SceneMarkedReady` | 资产库 | 智能助手 | 更新场景状态 | 跨上下文 |
| `ScenePublished` | 资产库 | 分镜导演 | 可引用提示 | 跨上下文 |
| `SceneVersionPublished` | 资产库 | 智能助手 | 登记场景版本依赖并评估影响 | 跨上下文 |
| `SceneUnpublished` | 资产库 | 分镜导演 | 引用失效提醒 | 跨上下文 |
| `SceneArchived` | 资产库 | 分镜导演 | 引用失效提醒 | 跨上下文 |
| `SceneRestored` | 资产库 | 分镜导演 | 引用恢复提示 | 跨上下文 |
| `SceneDeleted` | 资产库 | 智能助手 | 移除场景 | 跨上下文 |
| `PropCreated` | 资产库 | 智能助手 | 更新道具列表 | 跨上下文 |
| `PropUpdated` | 资产库 | 智能助手 | 刷新道具摘要 | 跨上下文 |
| `PropMarkedReady` | 资产库 | 智能助手 | 更新道具状态 | 跨上下文 |
| `PropPublished` | 资产库 | 分镜导演 | 可引用提示 | 跨上下文 |
| `PropVersionPublished` | 资产库 | 智能助手 | 登记道具版本依赖并评估影响 | 跨上下文 |
| `PropUnpublished` | 资产库 | 分镜导演 | 引用失效提醒 | 跨上下文 |
| `PropArchived` | 资产库 | 分镜导演 | 引用失效提醒 | 跨上下文 |
| `PropRestored` | 资产库 | 分镜导演 | 引用恢复提示 | 跨上下文 |
| `PropDeleted` | 资产库 | 智能助手 | 移除道具 | 跨上下文 |
| `StyleAssetCreated` / `StyleAssetUpdated` / `StyleAssetMarkedReady` | 资产库 | 智能助手 | 更新风格资产列表 | 跨上下文 |
| `StyleAssetPublished` / `StyleAssetUnpublished` / `StyleAssetArchived` / `StyleAssetRestored` | 资产库 | 分镜导演 | 更新风格版本可引用提示 | 跨上下文 |
| `StyleAssetVersionPublished` | 资产库 | 智能助手 | 登记风格版本依赖并评估影响 | 跨上下文 |
| `StyleAssetDeleted` | 资产库 | 智能助手 | 移除风格资产 | 跨上下文 |
| `AssetCopiedToProject` | 资产库 | 智能助手 | 登记复制来源证据，不建立可变同步关系 | 跨上下文 |
| `RightsMetadataChanged` | 资产库 | 智能助手 | 更新 DEP 权利影响和 blocked 标记 | 跨上下文 |
| `RightsMetadataChanged` | 资产库 | 发布交付 | 重新评估发布权利预检 | 跨上下文 |
| `ShotSubmittedForReview` | 分镜导演 | 审核质量 | 创建审核项 | 跨上下文 |
| `ShotImageCandidateAttached` / `ShotVideoCandidateAttached` / `MediaCandidateArchived` | 分镜导演 | 智能助手 | 更新候选版本树 | 跨上下文 |
| `ShotPresentationFrozen` | 分镜导演 | 智能助手 | 登记表现快照及其确切依赖 | 跨上下文 |
| `ImageAdopted` / `VideoAdopted` | 分镜导演 | 智能助手 | 登记已采纳媒体与 AI 执行证据 | 跨上下文 |
| `ShotAssetBound` | 分镜导演 | 资产库 | 引用计数 +1（按 eventId 幂等） | 跨上下文 |
| `ShotAssetUnbound` | 分镜导演 | 资产库 | 引用计数 -1（按 eventId 幂等） | 跨上下文 |
| `ShotApproved` | 分镜导演 | 后期制作 | 分镜视频可进入剪辑工程 | 跨上下文 |
| `ShotArchived` | 分镜导演 | 分镜导演 | Storyboard 清理引用 | 上下文内 |
| `ReviewApproved` | 审核质量 | 分镜导演 | 标记分镜通过 | 跨上下文 |
| `ReviewApproved` | 审核质量 | AI任务调度 | 完成 Pipeline 审核节点 | 跨上下文 |
| `ReviewApproved` | 审核质量 | 智能助手 | 移除审核工作项 | 跨上下文 |
| `ReviewRejected` | 审核质量 | 分镜导演 | 标记分镜驳回 | 跨上下文 |
| `ReviewRejected` | 审核质量 | AI任务调度 | 失败/路由 Pipeline 审核节点 | 跨上下文 |
| `ReviewRejected` | 审核质量 | 智能助手 | 新增返工工作项 | 跨上下文 |
| `ReviewChangesRequested` | 审核质量 | 目标上下文 / 智能助手 | 目标进入 needs_fix / 新增返工工作项 | 跨上下文 |
| `ReviewAnnotationAdded` / `ReviewAnnotationResolved` / `ReviewAnnotationReopened` | 审核质量 | 智能助手 | 更新结构化返工明细和核销状态 | 跨上下文 |
| `ContinuityBaselinePublished` | 审核质量 | 分镜导演 / 智能助手 | 更新连续性基线提示和 DEP 投影 | 跨上下文 |
| `ContinuityCaseOpened` / `ContinuityCaseReopened` | 审核质量 | 智能助手 / 通知 | 创建/恢复连续性返工项；阻断项通知 | 跨上下文 |
| `ContinuityCaseResolved` / `ContinuityCaseWaived` | 审核质量 | 智能助手 / 分镜导演 | 核销工作项并刷新镜头告警 | 跨上下文 |
| `ReviewSubmitted` / `ReviewApproved` / `ReviewChangesRequested` | 审核质量 | 智能助手 | 登记审核快照、阶段和决策证据 | 跨上下文 |
| `ReviewStageApproved` | 审核质量 | 智能助手 | 创建下一阶段审核工作项 | 跨上下文 |
| `ReviewResubmitted` | 审核质量 | 智能助手 | 刷新工作项 | 跨上下文 |
| `ReviewClosed` | 审核质量 | 智能助手 | 移除审核工作项 | 跨上下文 |
| `ReviewCancelled` | 审核质量 | 智能助手 | 移除审核工作项 | 跨上下文 |
| `ReviewAssigned` | 审核质量 | 通知 | 通知被指派人 | 跨上下文 |
| `QCReportCompleted` | 审核质量 | Review Intake / 分镜导演 | passed 时创建 Review；否则标记门禁阻断 | 上下文内编排 / 跨上下文 |
| `QCReportCompleted` | 审核质量 | 智能助手 | 创建质检工作项（如未通过） | 跨上下文 |
| `QCReportFailed` | 审核质量 | 智能助手 | 创建质量工作项 | 跨上下文 |
| `QCReportFailed` / `QCReportTimedOut` | 审核质量 | 通知 | 告警质量负责人 | 跨上下文 |
| `QCGateWaived` | 审核质量 | Review Intake / 智能助手 | 经审计放行并登记证据链 | 上下文内编排 / 跨上下文 |
| `ReviewIntakeBlocked` | 审核质量 | 目标上下文 / 智能助手 / 通知 | 目标进入 needs_fix，创建返工项并通知 | 跨上下文 |
| `PipelineRunStarted` | AI任务调度 | 智能助手 | 流水线状态为运行中 | 跨上下文 |
| `PipelineRunCompleted` | AI任务调度 | 分镜导演 | 通知分镜生成完成 | 跨上下文 |
| `PipelineRunCompleted` | AI任务调度 | 智能助手 | 流水线状态为已完成 | 跨上下文 |
| `PipelineRunFailed` | AI任务调度 | 智能助手 | 创建告警工作项 | 跨上下文 |
| `PipelineRunFailed` | AI任务调度 | 通知 | 告警任务责任人/ai_admin | 跨上下文 |
| `PipelineRunCancelled` | AI任务调度 | 分镜导演 | 通知分镜生成取消 | 跨上下文 |
| `PipelineRunPaused` | AI任务调度 | 智能助手 | 流水线状态为暂停 | 跨上下文 |
| `PipelineRunResumed` | AI任务调度 | 智能助手 | 流水线状态为运行中 | 跨上下文 |
| `PipelineRunRetried` | AI任务调度 | 智能助手 | 流水线状态回退为待处理 | 跨上下文 |
| `AITaskCreated` | AI任务调度 | 调度器 | 分发任务 | 上下文内 |
| `AITaskCompleted` | AI任务调度 | 分镜导演 / 资产库 / 剧本创作 / 后期制作 | 按 type+target 路由创建候选，不自动采纳 | 跨上下文 |
| `AITaskCompleted` | AI任务调度 | 智能助手 | 登记模型、Prompt、参数、输入版本、尝试和成本证据 | 跨上下文 |
| `AITaskFailed` | AI任务调度 | 分镜导演 | 标记生成失败 | 跨上下文 |
| `AITaskFailed` | AI任务调度 | 智能助手 | 创建告警工作项 | 跨上下文 |
| `AITaskFailed` | AI任务调度 | 通知 | 告警任务责任人/ai_admin | 跨上下文 |
| `AITaskCancelled` | AI任务调度 | 智能助手 | 更新任务状态 | 跨上下文 |
| `EditRenderRequested` | 后期制作 | 后期渲染器 | 创建并调度 RenderJob | 上下文内 |
| `RenderCompleted` | 后期制作 | 发布交付 / 智能助手 | 创建成片草稿 / 更新导出状态 | 跨上下文 |
| `EditProjectVersionCreated` | 后期制作 | 智能助手 | 登记剪辑 revision 与媒体/音频/字幕依赖 | 跨上下文 |
| `AudioAssetPublished` / `SubtitleDocumentPublished` | 后期制作 | 智能助手 | 登记后期版本证据 | 跨上下文 |
| `RenderFailed` | 后期制作 | 智能助手 | 创建告警工作项 | 跨上下文 |
| `InterchangeExportRequested` / `InterchangeExportCompleted` | 后期制作 | 智能助手 | 更新交换包导出任务和下载状态 | 跨上下文 |
| `RenderFailed` | 后期制作 | 通知 | 告警剪辑/制片责任人 | 跨上下文 |
| `AudioGenerationRequested` | 后期制作 | AI任务调度 | 创建 audio AI 任务 | 跨上下文 |
| `FinalVideoReviewSubmitted` | 发布交付 | 审核质量 | 创建 final_video 审核 | 跨上下文 |
| `FinalVideoApproved` | 发布交付 | 智能助手 | 更新成片终审状态 | 跨上下文 |
| `PublishPrecheckCompleted` | 发布交付 | 智能助手 | 更新发布阻断项 | 跨上下文 |
| `PublishRecordCreated` | 发布交付 | 智能助手 | 更新发布历史 | 跨上下文 |
| `DependencyImpactAssessed` / `DependencyFreshnessChanged` | 智能助手 | 智能助手 | 刷新影响清单和对象新鲜度徽标 | 上下文内投影事实 |
| `TraceabilityGapDetected` | 智能助手 | 智能助手 / 通知 | 创建证据修复工作项；发布阻断时告警 | 跨上下文投影事实 |
| `DependencyProjectionRebuilt` | 智能助手 | 智能助手 | 解除投影重建提示 | 上下文内投影事实 |
| `FinalVideoCreated` | 发布交付 | 智能助手 | 更新成片列表 | 跨上下文 |
| `PackagingStarted` | 发布交付 | 智能助手 | 更新打包状态 | 跨上下文 |
| `PackagingCompleted` | 发布交付 | 智能助手 | 更新打包状态 | 跨上下文 |
| `PackagingFailed` | 发布交付 | 智能助手 | 创建后期工作项 | 跨上下文 |
| `PackagingFailed` | 发布交付 | 通知 | 告警剪辑/制片责任人 | 跨上下文 |
| `FinalVideoPublished` | 发布交付 | 项目管控 | 更新项目进度 | 跨上下文 |
| `FinalVideoPublished` | 发布交付 | 智能助手 | 创建发布确认工作项 | 跨上下文 |
| `FinalVideoUnpublished` | 发布交付 | 项目管控 | 更新项目进度 | 跨上下文 |
| `FinalVideoDeleted` | 发布交付 | 智能助手 | 移除成片 | 跨上下文 |
| `PublishPlanCreated` | 发布交付 | 智能助手 | 更新发布计划列表 | 跨上下文 |
| `PublishPlanScheduled` | 发布交付 | 智能助手 | 更新发布计划状态 | 跨上下文 |
| `PublishPlanExecutionStarted` | 发布交付 | 智能助手 | 更新执行状态 | 跨上下文 |
| `PublishPlanCompleted` | 发布交付 | 项目管控 | 标记剧集发布完成 | 跨上下文 |
| `PublishPlanCompleted` | 发布交付 | 智能助手 | 更新发布状态 | 跨上下文 |
| `PublishPlanFailed` | 发布交付 | 智能助手 | 创建发布工作项 | 跨上下文 |
| `PublishPlanFailed` | 发布交付 | 通知 | 告警发布运营/制片人 | 跨上下文 |
| `PublishPlanCancelled` | 发布交付 | 智能助手 | 更新发布状态 | 跨上下文 |
| `MemberAdded` | 项目管控 | 智能助手 | 更新团队列表 | 跨上下文 |
| `MemberRemoved` | 项目管控 | 智能助手 | 更新团队列表 | 跨上下文 |
| `MemberRolesUpdated` | 项目管控 | 智能助手 | 更新团队角色和权限展示 | 跨上下文 |
| `OwnershipTransferred` | 项目管控 | 智能助手 | 更新团队负责人 | 跨上下文 |
| `PermissionUpdated` | 项目管控 | 智能助手 | 更新权限显示 | 跨上下文 |
| `ModelConfigCreated` | AI任务调度 | 智能助手 | 更新模型列表 | 跨上下文 |
| `ModelConfigUpdated` | AI任务调度 | 智能助手 | 更新模型状态 | 跨上下文 |
| `PromptTemplateCreated` | AI任务调度 | 智能助手 | 更新模板列表 | 跨上下文 |
| `PromptTemplateUpdated` | AI任务调度 | 智能助手 | 更新模板状态 | 跨上下文 |
| `TemplateCreated` | AI任务调度 | 智能助手 | 更新模板列表 | 跨上下文 |
| `TemplatePublished` | AI任务调度 | 智能助手 | 更新模板状态 | 跨上下文 |
| `TemplateArchived` | AI任务调度 | 智能助手 | 更新模板状态 | 跨上下文 |
| `TemplateUpdated` | AI任务调度 | 智能助手 | 更新模板状态 | 跨上下文 |
| `TemplateInstantiated` | AI任务调度 | 智能助手 | 更新流水线列表 | 跨上下文 |
| `DatasetCreated` | AI任务调度 | 智能助手 | 更新数据集列表 | 跨上下文 |
| `DatasetImportCompleted` | AI任务调度 | 智能助手 | 更新数据集状态 | 跨上下文 |
| `DatasetExportCompleted` | AI任务调度 | 智能助手 | 更新数据集状态 | 跨上下文 |
| `DatasetArchived` | AI任务调度 | 智能助手 | 更新数据集状态 | 跨上下文 |
| `DatasetDeleted` | AI任务调度 | 智能助手 | 移除数据集 | 跨上下文 |
| `ConversationStarted` | 智能助手 | 智能助手 | 更新对话列表 | 上下文内 |
| `ConversationArchived` | 智能助手 | 智能助手 | 更新对话列表 | 上下文内 |
| `WorkItemCreated` | 智能助手 | 通知 | 推送任务分配/创建通知 | 跨上下文 |
| `WorkItemCompleted` | 智能助手 | 智能助手 | 更新驾驶舱 | 上下文内 |
| `WorkItemClosed` | 智能助手 | 智能助手 | 更新工作项列表 | 上下文内 |
| `MilestoneDelayed` | 智能助手 | 通知 | 通知负责人并按 SLA 升级 | 跨上下文 |

---

## 3. 防腐层（ACL）

智能助手上下文访问其他上下文时，必须通过防腐层转换：

| 外部上下文 | 防腐层接口 | 转换内容 |
|-----------|-----------|---------|
| 项目管控 | `ProjectSummaryAdapter` | Project → 项目摘要 DTO（只读） |
| 剧本创作 | `ScriptSummaryAdapter` | ScriptDocument → 剧本摘要 DTO（只读，含版本号和发布状态） |
| 分镜导演 | `ShotSummaryAdapter` | Shot → 分镜摘要 DTO（只读） |
| 资产库 | `AssetSummaryAdapter` | Character/Scene/Prop → 资产摘要 DTO（只读，含发布状态和引用计数） |
| 后期制作 | `PostProductionSummaryAdapter` | EditProject/AudioAsset/SubtitleDocument/RenderJob → 后期摘要 DTO（只读） |
| 审核质量 | `ReviewQueueAdapter` | Review → 工作项列表 DTO（只读） |
| AI任务调度 | `PipelineStatusAdapter` | PipelineRun → 流水线状态 DTO（只读） |
| AI任务调度 | `ModelConfigSummaryAdapter` | ModelConfig → 模型配置摘要 DTO（只读，供数据中心/驾驶舱展示） |
| 发布交付 | `PublishProgressAdapter` | PublishPlan → 发布进度 DTO（只读） |
| 发布交付 | `FinalVideoSummaryAdapter` | FinalVideo → 成片摘要 DTO（只读，含状态和关联分镜列表） |

防腐层规则：
- 只暴露只读 DTO，不暴露聚合对象。
- DTO 字段精简到驾驶舱/工作台所需的最小集。
- 防腐层接口在 `application/shared/` 定义，实现在 `infrastructure/` 层。

---

## 4. CQRS 读模型投影映射

> 定义读模型的事件-投影映射，明确实现团队需要知道的事件到读模型的更新规则。

### 4.1 投影映射表

| 事件 | 读模型 | 更新动作 |
|------|--------|---------|
| `ProjectCreated` | 驾驶舱 | 插入项目卡片 |
| `ProjectUpdated` | 驾驶舱 | 更新项目摘要字段 |
| `ProjectArchived` | 驾驶舱 | 项目卡片标记为已归档 |
| `ProjectRestored` | 驾驶舱 | 项目卡片恢复 |
| `EpisodeAdded` | 项目工作台 | 剧集列表新增条目 |
| `ScriptVersionPublished` | 项目工作台 | 剧本状态更新为已发布 |
| `ShotApproved` | 驾驶舱 | 项目进度 approvedCount +1 |
| `ShotApproved` | 项目工作台 | 分镜进度更新 |
| `ReviewApproved` | 我的待办 | 移除对应审核工作项 |
| `ReviewRejected` | 我的待办 | 新增返工工作项 |
| `PipelineRunStarted` | 驾驶舱 | 流水线状态更新为运行中 |
| `PipelineRunCompleted` | 驾驶舱 | 流水线状态更新为已完成 |
| `PipelineRunFailed` | 驾驶舱 | 风险面板新增告警 |
| `AITaskCompleted` (type=video) | 项目工作台 | 分镜生成状态更新 |
| `FinalVideoPublished` | 驾驶舱 | 项目进度发布计数 +1 |
| `FinalVideoUnpublished` | 驾驶舱 | 项目进度发布计数 -1 |
| `PublishPlanCompleted` | 驾驶舱 | 发布状态更新为已完成 |
| `WorkItemCreated` | 我的待办 | 新增工作项条目 |
| `WorkItemCompleted` | 我的待办 | 移除已完成条目 |
| `ProductionPlanPublished` / `ProductionPlanItemReassigned` / `ProductionPlanItemCompleted` + 各上下文生产事实 | 生产控制塔 | 更新 Episode×阶段矩阵、责任、瓶颈和预测水位 |
| `ShotImageCandidateAttached` / `ShotVideoCandidateAttached` / `ImageAdopted` / `VideoAdopted` / `MediaCandidateArchived` | 候选版本树 | 更新父子分支、采纳、QC 和归档显示 |
| `EditLeaseAcquired` / `EditLeaseRenewed` / `EditLeaseReleased` / `EditLeaseExpired` / `EditLeaseTakenOver` / `MemberRolesUpdated` / `DelegationGranted` / `DelegationRevoked` / `DelegationExpired` | 协作状态投影 | 更新查看/编辑提示和有效代理范围 |
| `ScriptVersionPublished` / `CharacterVersionPublished` / `SceneVersionPublished` / `PropVersionPublished` / `StyleAssetVersionPublished` | 生产依赖投影 | 新增版本节点、计算旧版本下游影响 |
| `ShotPresentationFrozen` / `ImageAdopted` / `VideoAdopted` | 生产依赖投影 | 登记 Shot 快照、媒体候选与 AI 执行边 |
| `EditProjectVersionCreated` / `RenderCompleted` / `FinalVideoCreated` | 追溯链投影 | 登记剪辑、渲染制品与成片链路 |
| `ReviewSubmitted` / `ReviewApproved` / `PublishRecordCreated` | 追溯链投影 | 登记人工审核和外发证据 |
| `RightsMetadataChanged` | 生产依赖投影 | 重算权利影响与 blocked 标记 |

### 4.2 一致性级别

- **一致性模型**：最终一致。
- **投影滞后容忍度**：≤ 2 秒（从事件持久化到读模型更新完成，常规业务负载下）。
- **幂等性要求**：投影更新必须幂等——同一事件重复消费不应产生副作用（通过事件 ID + 读模型版本号去重）。
- **投影重建**：支持从事件存储全量重放重建读模型（用于灾难恢复或读模型结构变更）。

---

## 5. 可靠交付与跨上下文校验

### 5.1 事件交付

- 聚合状态与 `outbox_events` 事件在同一 SQLite 事务提交；事务提交前不得发布到 EventBus。
- dispatcher 从 `outbox_events` 投递，成功后记录 `published_at`；失败按 1s/5s/30s 重试，随后进入 `event_dlq`。
- 消费者先写 `inbox_events` 去重记录，再在同一消费事务内更新本地聚合或投影。
- 同一聚合以 `aggregateVersion` 顺序消费；发现版本缺口时暂停该聚合并告警，不得跳过。
- 所有事件包含 `schemaVersion`；payload 只允许向后兼容增加字段。

### 5.2 跨上下文不变量

“所有跨上下文协作通过事件完成”不等于禁止一致性查询。以下命令需要应用层策略读取只读端口，并在本地保存校验快照：

| 命令 | 只读端口 | 校验内容 |
|---|---|---|
| `ArchiveProject` | ProjectClosurePolicy | 进行中的 Pipeline、Review、RenderJob、PublishPlan |
| `CreateFinalVideo` | RenderArtifactReader | RenderJob 已完成、来源分镜已审核 |
| `SchedulePublishPlan` | PublishEligibilityReader | 成片版本、终审和发布预检结果 |
| `BindAssetToShot` | PublishedAssetReader | 同项目、已发布、资产版本存在 |

只读端口返回 DTO，不返回对方聚合；需要强一致时由应用层编排事务/锁或采用预留记录，领域层不得直接调用其他上下文 Repository。

### 5.3 通知事件扇出

业务上下文只发布事实事件，不直接发送邮件或修改用户未读数。通知上下文按[通知契约](contexts/10-notification.md)解析接收人、模板、偏好、去重、投递和升级；智能助手仅在需要人工处置时创建 WorkItem。

| 业务事件 | WorkItem 消费 | Notification 消费 |
|---|---|---|
| `ReviewAssigned` | — | 通知审核人 |
| `ReviewChangesRequested` / `ReviewRejected` | 创建返工工作项 | 通知提交人、责任人 |
| `QCReportFailed` / `QCReportTimedOut` | 重试耗尽后创建质量工作项 | 告警质量负责人 |
| `AITaskFailed` / `PipelineRunFailed` | 重试耗尽后创建故障工作项 | 告警任务责任人、ai_admin |
| `BudgetThresholdReached` / `BudgetExceeded` | 需要审批时创建预算工作项 | 通知 producer、owner、ai_admin |
| `RenderFailed` / `PackagingFailed` | 创建后期工作项 | 通知 editor、producer |
| `PublishPlanFailed` | 创建发布工作项 | 通知 publisher、producer |
| `MilestoneDelayed` | 更新/创建延期工作项 | 通知 assignee、producer |
| 安全、备份、恢复事故 | 由平台运行流程承接 | critical 通知 platform_admin |

### 5.4 同上下文跨聚合原子命令

`AddShot`、`RemoveShot` 等同一上下文内同时修改 Storyboard 和 Shot 的命令不通过异步事件模拟原子性，必须采用[Shot–Storyboard 事务边界](contexts/03-storyboard-direction.md)中的 UnitOfWork。跨上下文事件只在事务提交后从 Outbox 发布。
