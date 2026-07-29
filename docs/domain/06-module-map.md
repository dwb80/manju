# 模块-上下文映射表

> **配套规范**：[DDD 治理规范](02-governance.md)｜[上下文映射](04-context-map.md)｜[统一语言术语表](03-glossary.md)

| 一级分组 | 页面 | 主上下文 | 聚合根 |
|---------|------|---------|-------|
| — | 驾驶舱 | 智能助手（CQRS 读模型） | — |
| — | 我的待办 | 智能助手 | WorkItem |
| — | 通知中心 | 通知 | Notification, NotificationPreference |
| 生产创作 | AI任务队列 | AI任务调度 | AITask |
| 生产创作 | 剧本中心 | 剧本创作 | Script |
| 生产创作 | 角色工厂 | 资产库 | Character |
| 生产创作 | 场景工厂 | 资产库 | Scene |
| 生产创作 | 道具工厂 | 资产库 | Prop |
| 生产创作 | 分镜导演台 | 分镜导演 | Shot |
| 生产创作 | 分镜板 | 分镜导演 | Storyboard |
| 生产创作 | 视频生产线 | AI任务调度 | PipelineRun |
| 生产创作 | 模型中心 | AI任务调度 | ModelConfig |
| 生产创作 | 流水线模板中心 | AI任务调度 | PipelineTemplate |
| 生产创作 | Prompt 中心 | AI任务调度 | PromptTemplate |
| 生产创作 | 音频中心 | 后期制作 + AI任务调度 | AudioAsset + AITask(type=audio) |
| 生产创作 | 剪辑中心 | 后期制作 | EditProject / RenderJob |
| 资产与数据 | 资产中心 | 资产库 | Character/Scene/Prop |
| 资产与数据 | 数据中心 | AI任务调度 | Dataset |
| 运营与管控 | 项目中心 | 项目管控 | Project |
| 运营与管控 | 审核中心 | 审核质量 | Review |
| 运营与管控 | 质检中心 | 审核质量 | QCReport |
| 运营与管控 | 发布准备 | 发布交付 | FinalVideo, PublishPlan |
| 智能助手 | AI对话 | 智能助手 | Conversation |
| 智能助手 | 项目工作台 | 智能助手（读模型 + 写入口） | Conversation, WorkItem |
| 智能助手 | 创意工作室 | 智能助手 + AI任务调度 | Conversation, AITask |
| 系统管理 | 系统日志/审计 | 平台审计能力（CQRS 只读） | AuditRecord（追加写证据模型） |
| 系统管理 | 系统设置 | 平台配置能力 + 项目管控 | TypedSetting, ProjectPresentationSpec, ProjectBudgetPolicy |

> AI 配音调用由 AI 任务调度负责；音频资产、字幕、多轨时间线和渲染由后期制作负责。发布交付只接收已完成的渲染制品。
>
> 创意工作室（`/studio`）以会话为载体承载 AI 问答 / 图片 / 视频 / 收藏的统一创作入口，写操作落到智能助手（Conversation）与 AI 任务调度（AITask）。系统日志与设置现有实现仍包含 `app_logs`/`audit_logs` 和无类型 `settings` KV，但产品目标以[平台基础能力需求](../requirements/product/04-platform-capability-requirements.md)为准：审计收敛为追加写 AuditRecord，配置按 system/project/user 作用域和类型 schema 管理。通知中心由独立通知上下文负责。
