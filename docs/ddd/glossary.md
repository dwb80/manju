# 统一语言术语表

> **规则**：以下术语在代码、文档、UI、API 中统一使用。禁止使用"禁止别名"列以外的称呼。
> **配套规范**：[DDD 治理规范](governance.md)

---

## 核心业务概念

| 统一术语 | 英文标识 | 含义 | 禁止别名 |
|---------|---------|------|---------|
| 项目 | Project | 一部漫剧作品的顶层容器 | 作品、番剧 |
| 剧集 | Episode | 项目下的单集 | 集、话 |
| 剧本 | Script | 剧集的文字底稿，含分场分对话 | 文本、文稿 |
| 剧本文档 | ScriptDocument | 剧本的一个版本快照 | 剧本版本、ScriptVersion |
| 分镜 | Shot | 单个镜头的完整描述（画面+运镜+对话+时长） | 镜头、StoryboardItem |
| 分镜板 | Storyboard | 一集剧集的全部分镜集合 | 分镜列表、ShotList |
| 角色 | Character | 剧中人物资产，含立绘+一致性包 | 人物、CharacterAsset |
| 场景 | Scene | 剧中场景资产，含背景图+描述 | 背景、SceneAsset |
| 道具 | Prop | 剧中道具资产 | 物品、PropAsset |
| 资产 | Asset | 角色/场景/道具的统称 | 素材、资源 |
| Prompt 模板 | PromptTemplate | 可复用的 Prompt 资产，含变量化和版本管理 | 提示词、Prompt |
| 流水线 | PipelineRun | AI 生成的多步骤 DAG 执行实例 | 任务流、工作流 |
| 流水线模板 | PipelineTemplate | 可实例化为 PipelineRun 的 DAG 模板 | 工作流模板、WorkflowTemplate |
| 流水线节点 | PipelineNode | 流水线中的单个执行步骤 | 步骤、Task |
| AI 任务 | AITask | 单次 AI 调用（图片/视频/音频/文本） | 生成请求、AIRequest |
| 审核 | Review | 对生成内容的人工审批流程 | 审批、Approval |
| 审核项 | ReviewItem | 单个审核对象（一个分镜/一段视频/一张图） | 审核条目 |
| 质检 | QualityCheck | 对生成内容的自动质量评估 | QC、质量检测 |
| 质检报告 | QCReport | 一次质检的完整结果 | 质检结果、QCReport |
| 成片 | FinalVideo | 审核通过、可发布的最终视频 | 最终视频、成品 |
| 发布计划 | PublishPlan | 按平台和时间的发布排期 | 排期、发布任务 |
| 发布记录 | PublishRecord | 一次发布执行的记录 | 发布日志 |
| 剪辑工程 | EditProject | 一集内容的多轨后期编辑工程 | TimelineProject、剪辑项目 |
| 音频资产 | AudioAsset | 配音、背景音乐或音效的可复用资产 | 音频文件、声音素材 |
| 字幕文档 | SubtitleDocument | 一种语言的一组字幕条目及样式 | 字幕文件、Subtitle |
| 渲染任务 | RenderJob | 将冻结的剪辑工程版本输出为视频制品的异步任务 | 导出任务 |
| 对话会话 | Conversation | AI 助手的一次对话 | 聊天、Chat |
| 工作项 | WorkItem | 用户的待办事项 | 待办、Todo |
| 模型配置 | ModelConfig | AI 模型的连接、参数和能力配置 | 模型设置 |
| 数据集 | Dataset | 训练/微调用的素材集合 | 训练集 |
| 团队成员 | Member | 项目团队成员，含角色和权限 | 成员、Participant |

---

## 状态术语

| 统一术语 | 英文标识 | 含义 |
|---------|---------|------|
| 草稿 | draft | 初始状态，可编辑 |
| 生成中 | generating | AI 正在执行 |
| 就绪 | ready | 生成完成，可送审或发布 |
| 审核中 | in_review | 已提交审核，等待审核决策 |
| 已通过 | approved | 审核通过 |
| 已驳回 | rejected | 审核驳回 |
| 待修复 | needs_fix | 需返工后重新提交 |
| 已归档 | archived | 不可变更，仅可恢复 |
| 已关闭 | closed | 审核流程终结 |
| 已取消 | cancelled | 主动终止 |
| 运行中 | running | 流水线/任务正在执行 |
| 已暂停 | paused | 流水线暂停，可恢复 |
| 已完成 | completed | 正常终结 |
| 已失败 | failed | 异常终结 |
| 活跃 | active | 项目/对话/模型配置处于活跃可用状态 |
| 非活跃 | inactive | 模型配置停用，不可调度 |
| 待处理 | pending | 审核等待开始；流水线已创建待启动 |
| 排队中 | queued | AI 任务等待分发 |
| 打包中 | packaging | 成片正在打包导出 |
| 已排期 | scheduled | 发布计划已排定时间 |
| 执行中 | executing | 发布计划正在执行 |
| 处理中 | in_progress | 工作项正在处理 |
| 导入中 | importing | 数据集正在导入 |
| 导出中 | exporting | 数据集正在导出 |
| 资产已发布 | published | 资产（角色/场景/道具）生命周期的发布阶段：资产可被分镜引用。属资产库上下文，前置状态为 draft/ready，可通过 `Unpublish` 回退到 ready |
| 成片已发布 | published | 成片已发布到外部平台，是发布交付流程的终态。属发布交付上下文，前置状态为 ready，可通过 `UnpublishFinalVideo` 回退（需记录原因与操作人） |
| 分析中 | analyzing | 剧本正在被 AI 分析，不可编辑或删除 |
| 已分析 | analyzed | 剧本 AI 分析完成，产出角色/场景/道具草稿待确认 |
| 已过期 | stale | 流水线节点运行超时且未心跳，待检测处理 |
| 已延迟 | delayed | 里程碑超过截止日期且未完成，自动转入的状态 |

> **"进行中"语义说明**：UI 统一显示为"处理中"的状态，在领域层按业务语义区分：进程类（Pipeline/Task）用 `running`；业务流程类用 `packaging`（打包）、`executing`（发布）、`in_progress`（工作项）、`generating`（生成）。这些是不同业务语义，不应强行统一为同一英文标识。

> **"已发布"（published）语义区分说明**：`published` 在不同限界上下文中具有不同语义，二者不可混用：
>
> | 上下文 | 统一术语 | 英文标识 | 语义 | 前置状态 | 回退命令 | 文档参考 |
> |--------|---------|---------|------|---------|---------|---------|
> | 资产库 | 资产已发布 | `published` | 资产（角色/场景/道具）完成发布，进入**可被分镜引用**的生命周期阶段；是资产生命周期的中间态，非终态 | `draft` / `ready` | `UnpublishCharacter` / `UnpublishScene` / `UnpublishProp` | [04-asset-library.md](contexts/04-asset-library.md) |
> | 发布交付 | 成片已发布 | `published` | 成片已**发布到外部平台**（如 B 站/抖音），是发布交付流程的**终态** | `ready` | `UnpublishFinalVideo`（需记录原因与操作人） | [07-publish-delivery.md](contexts/07-publish-delivery.md) |
>
> - 资产 `published` 的核心约束是"可引用性"：进入该状态后资产不可修改字段，分镜导演可将其引用到分镜中；它是资产生命周期 `draft → ready → published → archived` 的一环。
> - 成片 `published` 的核心约束是"外发完成"：表示成片已通过质检与审核门禁并实际发布到第三方平台，伴随 `FinalVideoPublished` 事件通知项目管控更新进度。
> - 两者虽共用 `published` 这一状态码（遵循 DDD 限界上下文原则：同一术语在不同上下文可有不同含义），但在文档与代码注释中须以"资产已发布"和"成片已发布"区分，避免歧义。

---

## 角色与权限术语

| 统一术语 | 英文标识 | 含义 | 禁止别名 |
|---------|---------|------|---------|
| 项目所有者 | ProjectOwner | 项目最高权限且每个项目唯一，对应领域角色 `owner` | 超管 |
| 项目管理员 | ProjectAdmin | 受项目所有者授权，除所有权转让外管理项目 | 超管 |
| 制片人 | Producer | 负责项目规划、成本和进度管理 | 制作人 |
| 编剧 | Scriptwriter | 负责剧本创作和 AI 文本生成 | Writer |
| 分镜导演 | StoryboardDirector | 负责分镜设计和调整 | 导演、Director |
| 美术设计师 | ArtDesigner | 负责角色、场景和画面设计 | 美术、Designer |
| 视频导演 | VideoDirector | 负责视频生成和分镜调整 | 视频师 |
| 配音人员 | VoiceActor | 负责声音制作 | 配音员 |
| 剪辑人员 | Editor | 负责成片制作 | 剪辑师 |
| 审核人员 | Reviewer | 负责内容审核 | 审核员 |
| 发布运营 | Publisher | 负责发布和数据分析 | 运营 |
| AI 管理员 | AIAdmin | 负责模型、Prompt 和成本管理 | 模型管理员 |

---

## 资产专属术语

| 统一术语 | 英文标识 | 含义 | 禁止别名 |
|---------|---------|------|---------|
| 一致性包 | ConsistencyPack | 角色的立绘+表情+动作的引用集合，用于保持生成一致性 | 一致性组、ConsistencySet |
| 资产图片视图 | AssetImageView | 资产在特定景别/角度/视图类型下的图片，支持多视图管理 | 图片视图、ImageView |
| 主图 | PrimaryImage | 资产的默认展示图片，每个资产仅一张 | 封面图、CoverImage |
| 图片历史 | ImageHistory | 资产图片的生成历史记录，支持应用/取消应用 | 生成记录 |
