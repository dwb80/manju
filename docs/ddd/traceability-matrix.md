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

## 准入规则

- “API/Schema”和“验收证据”任一为“待核验”，不得将功能标记为已完成。
- 聚合、命令或事件为空，需求不得进入开发排期。
- 需求、领域、API 或存储发生变更时，必须在同一变更中更新本表。

