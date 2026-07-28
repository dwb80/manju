# 漫剧 AI 生产平台 — DDD 领域需求规格

> **文档定位**：DDD 文档体系入口与概述
> **制定日期**：2026-07-27
> **适用范围**：全平台页面/模块的领域设计；具体数量以模块映射表为准
> **目标读者**：架构师、后端开发、前端开发、产品经理
> **权威性**：本目录（`docs/ddd/`）是平台领域边界、聚合定义、事件契约和统一语言的权威来源。任何代码、API、UI 涉及业务对象时，必须以本目录文档为准。
>
> **配套规范**：
> - [DDD 治理规范](governance.md) — 文档结构、跨文档引用规范、统一语言使用规则、变更管理流程。
> - [DDD 索引](README.md) — 文档导航与读者指引。

---

## 1. 文档结构

DDD 文档已按**职责拆分**为以下子文档：

| 类别 | 文档 | 职责 |
|------|------|------|
| 索引 | [README.md](README.md) | 文档导航、读者指引、推荐阅读顺序 |
| 规范 | [governance.md](governance.md) | 文档体系、跨文档引用规范、统一语言使用规则、变更管理流程 |
| 基础规范 | [glossary.md](glossary.md) | 统一语言术语表（业务概念 + 状态术语 + 禁止别名） |
| 基础规范 | [context-map.md](context-map.md) | 10 个限界上下文的边界、关系矩阵、共享内核 |
| 基础规范 | [contracts.md](contracts.md) | 跨上下文事件链路、消费者注册表、防腐层、CQRS 投影 |
| 基础规范 | [module-map.md](module-map.md) | 页面到上下文和聚合根的对应关系 |
| 基础规范 | [iteration-priority.md](iteration-priority.md) | 聚合实现优先级与建议迭代节奏 |
| 基础规范 | [infrastructure.md](infrastructure.md) | 共享内核代码位置、接口定义、公共错误码 |
| 基础规范 | [dependency-rules.md](dependency-rules.md) | 分层依赖图与跨聚合引用规则 |
| 上下文规格 | [contexts/0N-*.md](contexts/) | 单一上下文的完整规格 |

---

## 2. 10 个限界上下文一览

| 编号 | 上下文 | 聚合根 | 对应页面 | 文件 |
|------|--------|-------|---------|------|
| §3.1 | 项目管控 (Project Management) | `Project` | 项目中心 | [contexts/01-project-management.md](contexts/01-project-management.md) |
| §3.2 | 剧本创作 (Script Creation) | `Script` | 剧本中心 | [contexts/02-script-creation.md](contexts/02-script-creation.md) |
| §3.3 | 分镜导演 (Storyboard Direction) | `Shot` / `Storyboard` | 分镜导演台、分镜板 | [contexts/03-storyboard-direction.md](contexts/03-storyboard-direction.md) |
| §3.4 | 资产库 (Asset Library) | `Character` / `Scene` / `Prop` | 角色/场景/道具工厂、资产中心 | [contexts/04-asset-library.md](contexts/04-asset-library.md) |
| §3.5 | AI 任务调度 (AI Task Orchestration) | `PipelineRun` / `AITask` / `ModelConfig` / `PipelineTemplate` / `Dataset` / `PromptTemplate` / `CapabilityTemplate` | AI 任务队列、视频生产线、模型中心、流水线模板中心、数据中心、Prompt 中心 | [contexts/05-ai-task-orchestration.md](contexts/05-ai-task-orchestration.md) |
| §3.6 | 审核质量 (Review & Quality) | `Review` / `QCReport` | 审核中心、质检中心 | [contexts/06-review-quality.md](contexts/06-review-quality.md) |
| §3.7 | 发布交付 (Publish & Delivery) | `FinalVideo` / `PublishPlan` | 发布准备 | [contexts/07-publish-delivery.md](contexts/07-publish-delivery.md) |
| §3.8 | 智能助手 (AI Assistant) | `Conversation` / `WorkItem` | AI 对话、项目工作台、驾驶舱、我的待办 | [contexts/08-ai-assistant.md](contexts/08-ai-assistant.md) |
| §3.9 | 后期制作 (Post Production) | `EditProject` / `AudioAsset` / `SubtitleDocument` / `RenderJob` | 音频中心、剪辑中心 | [contexts/09-post-production.md](contexts/09-post-production.md) |
| §3.10 | 通知 (Notification) | `Notification` / `NotificationPreference` | 通知中心、通知偏好、投递与升级 | [contexts/10-notification.md](contexts/10-notification.md) |

完整上下文映射图、关系矩阵、共享内核定义见 [context-map.md](context-map.md)。

---

## 3. 核心协作模式

### 3.1 事件驱动

所有跨上下文协作通过领域事件完成。完整事件链路、消费者注册表、防腐层定义见 [contracts.md](contracts.md)。

### 3.2 CQRS 读模型

驾驶舱、我的待办、项目工作台等跨上下文页面通过 CQRS 读模型投影实现，投影映射表与一致性级别见 [contracts.md §4](contracts.md#4-cqrs-读模型投影映射)。

### 3.3 防腐层（ACL）

智能助手上下文通过 ACL 只读访问其他上下文的聚合 DTO。详细接口清单与规则见 [contracts.md §3](contracts.md#3-防腐层acl)。

### 3.4 跨聚合引用

跨聚合引用必须通过 ID 持有，不得持有对象引用。完整规则与生命周期约束见 [dependency-rules.md §2](dependency-rules.md#2-跨聚合引用规则)。

---

## 4. 读者指引

| 角色 | 推荐阅读顺序 |
|------|-------------|
| 架构师 | [README.md](README.md) → [context-map.md](context-map.md) → [dependency-rules.md](dependency-rules.md) → [contracts.md](contracts.md) |
| 后端开发 | [glossary.md](glossary.md) → 你负责的 `contexts/0N-*.md` → [infrastructure.md](infrastructure.md) → [dependency-rules.md](dependency-rules.md) |
| 前端开发 | [module-map.md](module-map.md) → [glossary.md](glossary.md) → 对应 `contexts/0N-*.md` |
| 产品经理 | [glossary.md](glossary.md) → [module-map.md](module-map.md) → [iteration-priority.md](iteration-priority.md) |
| 测试工程师 | 你负责的 `contexts/0N-*.md` → [dependency-rules.md](dependency-rules.md) → [infrastructure.md](infrastructure.md) |

---

## 5. 与现有文档的关系

| 文档 | 关系 |
|------|------|
| `docs/product-design-spec.md` | 定义产品功能规格，本目录补充其领域维度 |
| `docs/architecture-and-development.md` | 定义技术架构、数据库、API 路由 |
| `docs/requirements-and-acceptance.md` | 给出用户视角的需求和验收标准 |
| `docs/api.md` | 按上下文分组的 API 契约 |
| `docs/sqlite-plan.md` | 按上下文归属的物理表设计 |
| `docs/feature-status.md` | 聚合/功能实现状态 |
| `DESIGN.md` | 定义 UI 设计系统，与本目录无重叠 |

跨文档引用规范、引用矩阵、引用模板统一由 [governance.md](governance.md) 规定。
