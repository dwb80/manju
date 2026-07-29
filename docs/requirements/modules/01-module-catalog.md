# 完整模块目录

> 本目录覆盖产品信息架构中的全部模块。每个模块的详细事实只维护一份：产品行为看交付规格，聚合与状态机看 DDD，上线状态看功能状态基线。专项指南仅在确有额外实现细节时提供。

| 序号 | 模块 | 主领域 | 主要聚合/读模型 | 权威详细文档 |
|---|---|---|---|---|
| 01 | 驾驶舱 | 智能助手读模型 | DashboardProjection | [智能助手](../../domain/contexts/08-ai-assistant.md)、[协作规格](../../delivery-specs/06-collaboration.md) |
| 02 | 我的待办 | 智能助手 | WorkItem | [智能助手](../../domain/contexts/08-ai-assistant.md)、[协作规格](../../delivery-specs/06-collaboration.md) |
| 03 | 通知中心 | 通知 | Notification、NotificationPreference | [通知上下文](../../domain/contexts/10-notification.md)、[平台能力规格](../../delivery-specs/07-platform-capabilities.md) |
| 04 | 项目中心 | 项目管控 | Project、Episode、ProjectMember | [项目管控](../../domain/contexts/01-project-management.md)、[项目交付规格](../../delivery-specs/02-project-script-storyboard.md) |
| 05 | 剧本中心 | 剧本创作 | Script、ScriptDocument、ScriptAnalysis | [剧本上下文](../../domain/contexts/02-script-creation.md)、[专项指南](02-script-center-guide.md) |
| 06 | 分镜板 | 分镜导演 | Storyboard、Shot | [分镜上下文](../../domain/contexts/03-storyboard-direction.md)、[项目交付规格](../../delivery-specs/02-project-script-storyboard.md) |
| 07 | 分镜导演台 | 分镜导演 | Shot、PresentationSnapshot | [分镜上下文](../../domain/contexts/03-storyboard-direction.md)、[漫剧表现规格](../../delivery-specs/03-comic-presentation.md) |
| 08 | 角色工厂 | 资产库 | Character | [资产库上下文](../../domain/contexts/04-asset-library.md)、[工厂专项指南](04-factories-assets-and-image-views.md) |
| 09 | 场景工厂 | 资产库 | Scene | [资产库上下文](../../domain/contexts/04-asset-library.md)、[工厂专项指南](04-factories-assets-and-image-views.md) |
| 10 | 道具工厂 | 资产库 | Prop | [资产库上下文](../../domain/contexts/04-asset-library.md)、[工厂专项指南](04-factories-assets-and-image-views.md) |
| 11 | 资产中心 | 资产库 | Character、Scene、Prop、StyleAsset、AssetVersion | [资产库说明](06-asset-library.md)、[资产交付规格](../../delivery-specs/04-assets-generation-review.md) |
| 12 | AI 图片生成 | AI 任务调度 | AITask(type=image) | [AI 图片配置](05-ai-image-config.md)、[资产生成规格](../../delivery-specs/04-assets-generation-review.md) |
| 13 | AI 视频生成／生产线 | AI 任务调度 | PipelineRun、AITask(type=video) | [AI 视频参数](07-ai-video-config.md)、[AI 任务上下文](../../domain/contexts/05-ai-task-orchestration.md)、[资产生成规格](../../delivery-specs/04-assets-generation-review.md) |
| 14 | AI 任务队列 | AI 任务调度 | AITask、AITaskAttempt | [AI 任务上下文](../../domain/contexts/05-ai-task-orchestration.md)、[运营能力规格](../../delivery-specs/09-operational-capabilities.md) |
| 15 | 模型中心 | AI 任务调度 | ModelConfig | [模型专项指南](03-model-center-guide.md)、[运营能力规格](../../delivery-specs/09-operational-capabilities.md) |
| 16 | 流水线模板中心 | AI 任务调度 | PipelineTemplate | [AI 任务上下文](../../domain/contexts/05-ai-task-orchestration.md)、[运营能力规格](../../delivery-specs/09-operational-capabilities.md) |
| 17 | Prompt 中心 | AI 任务调度 | PromptTemplate | [AI 任务上下文](../../domain/contexts/05-ai-task-orchestration.md)、[AI 治理规格](../../delivery-specs/08-ai-governance-analytics.md) |
| 18 | 数据中心 | AI 任务调度 | Dataset、DatasetVersion | [AI 任务上下文](../../domain/contexts/05-ai-task-orchestration.md)、[运营能力规格](../../delivery-specs/09-operational-capabilities.md) |
| 19 | 项目预算与成本 | AI 任务调度 | BudgetPolicy、BudgetReservation、CostRecord | [AI 任务上下文](../../domain/contexts/05-ai-task-orchestration.md)、[AI 治理规格](../../delivery-specs/08-ai-governance-analytics.md) |
| 20 | 审核中心 | 审核质量 | Review | [审核质量](../../domain/contexts/06-review-quality.md)、[资产审核规格](../../delivery-specs/04-assets-generation-review.md) |
| 21 | 质检中心 | 审核质量 | QCReport、QualityRuleSet | [审核质量](../../domain/contexts/06-review-quality.md)、[运营能力规格](../../delivery-specs/09-operational-capabilities.md) |
| 22 | 音频中心 | 后期制作＋AI 任务调度 | AudioAsset、AITask(type=audio) | [AI 音频参数](08-ai-audio-config.md)、[后期制作](../../domain/contexts/09-post-production.md)、[后期交付规格](../../delivery-specs/05-postproduction-publishing.md) |
| 23 | 剪辑中心 | 后期制作 | EditProject、RenderJob | [后期制作](../../domain/contexts/09-post-production.md)、[后期交付规格](../../delivery-specs/05-postproduction-publishing.md) |
| 24 | 发布准备 | 发布交付 | FinalVideo、PublishPlan、PublishRecord | [发布交付](../../domain/contexts/07-publish-delivery.md)、[发布规格](../../delivery-specs/05-postproduction-publishing.md) |
| 25 | AI 对话／创意工作室 | 智能助手＋AI 任务调度 | Conversation、Message、AITask | [智能助手](../../domain/contexts/08-ai-assistant.md)、[运营能力规格](../../delivery-specs/09-operational-capabilities.md) |
| 26 | 项目工作台 | 智能助手读模型＋写入口 | Conversation、WorkItem、项目投影 | [智能助手](../../domain/contexts/08-ai-assistant.md)、[协作规格](../../delivery-specs/06-collaboration.md) |
| 27 | 系统用户与权限 | 项目管控＋认证能力 | User、Session、ProjectMember | [项目管控](../../domain/contexts/01-project-management.md)、[平台能力规格](../../delivery-specs/07-platform-capabilities.md) |
| 28 | 系统设置 | 平台配置＋项目管控 | TypedSetting、PresentationSpec、BudgetPolicy | [平台能力需求](../product/04-platform-capability-requirements.md)、[平台能力规格](../../delivery-specs/07-platform-capabilities.md) |
| 29 | 系统日志与审计 | 平台审计读模型 | AuditRecord | [平台能力需求](../product/04-platform-capability-requirements.md)、[平台能力规格](../../delivery-specs/07-platform-capabilities.md) |
| 30 | 回收站与数据恢复 | 数据生命周期能力 | RecoveryItem、RetentionJob、RestoreJob | [数据生命周期](../product/07-data-lifecycle-and-migration.md)、[平台能力规格](../../delivery-specs/07-platform-capabilities.md) |
| 31 | 导入导出与备份 | 数据生命周期能力 | ImportJob、ExportJob、BackupJob | [数据生命周期](../product/07-data-lifecycle-and-migration.md)、[平台能力规格](../../delivery-specs/07-platform-capabilities.md) |

完整页面到上下文映射以 [DDD 模块映射](../../domain/06-module-map.md) 为准；实现状态以 [功能状态基线](../../implementation/02-feature-status.md) 为准。
