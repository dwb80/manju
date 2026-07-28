# DDD 领域需求规格 — 索引

> **文档状态**：活跃（唯一权威来源）
> **制定日期**：2026-07-27
> **目标读者**：架构师、后端开发、前端开发、产品经理
> **权威性**：本目录下所有文档是平台领域边界、聚合定义、事件契约和统一语言的权威来源。任何代码、API、UI 涉及业务对象时，必须以本目录文档为准。
>
> **配套规范**：
> - [DDD 治理规范](governance.md) — 文档结构、跨文档引用规范、统一语言使用规则、变更管理流程。
> - [产品级需求基线](../product/README.md) — 产品范围、漫剧专业需求、用户旅程、权限矩阵和交付门禁；产品决策确认后再变更领域契约。

---

## 目录

### 治理规范
- [DDD 治理规范](governance.md) — 文档结构、跨文档引用规范、统一语言使用规则、变更管理流程

### 基础规范
- [统一语言术语表](glossary.md) — 代码、UI、API 中使用的全部业务概念和状态术语
- [上下文映射](context-map.md) — 10 个限界上下文的边界、上下游关系和共享内核
- [跨上下文协作契约](contracts.md) — 事件链、消费者注册表、防腐层、CQRS 投影
- [统一错误与 HTTP 响应契约](error-contract.md) — 字符串错误码、HTTP 映射、响应 envelope 和旧数字码迁移
- [模块-上下文映射表](module-map.md) — 页面到上下文和聚合根的对应关系

### 上下文规格（10 个限界上下文）

| 编号 | 上下文 | 文档 |
|------|--------|------|
| §3.1 | 项目管控 (Project Management) | [contexts/01-project-management.md](contexts/01-project-management.md) |
| §3.2 | 剧本创作 (Script Creation) | [contexts/02-script-creation.md](contexts/02-script-creation.md) |
| §3.3 | 分镜导演 (Storyboard Direction) | [contexts/03-storyboard-direction.md](contexts/03-storyboard-direction.md) |
| §3.4 | 资产库 (Asset Library) | [contexts/04-asset-library.md](contexts/04-asset-library.md) |
| §3.5 | AI 任务调度 (AI Task Orchestration) | [contexts/05-ai-task-orchestration.md](contexts/05-ai-task-orchestration.md) |
| §3.6 | 审核质量 (Review & Quality) | [contexts/06-review-quality.md](contexts/06-review-quality.md) |
| §3.7 | 发布交付 (Publish & Delivery) | [contexts/07-publish-delivery.md](contexts/07-publish-delivery.md) |
| §3.8 | 智能助手 (AI Assistant) | [contexts/08-ai-assistant.md](contexts/08-ai-assistant.md) |
| §3.9 | 后期制作 (Post Production) | [contexts/09-post-production.md](contexts/09-post-production.md) |
| §3.10 | 通知 (Notification) | [contexts/10-notification.md](contexts/10-notification.md) |

### 迭代与基础设施
- [迭代优先级](iteration-priority.md) — 聚合实现优先级与建议迭代节奏
- [公共领域基础设施](infrastructure.md) — 聚合根接口、仓储接口、领域事件接口、公共错误码
- [依赖方向约束](dependency-rules.md) — 分层依赖图、跨聚合引用规则
- [需求—领域—实现追踪矩阵](traceability-matrix.md) — 用户故事到领域与实现证据的闭环
- [开发与交付规范](../development-standards.md) — Definition of Done、事件可靠性、迁移与测试门禁

---

## 读者指引

| 角色 | 推荐阅读顺序 |
|------|-------------|
| 架构师 | [上下文映射](context-map.md) → [依赖方向约束](dependency-rules.md) → [跨上下文协作契约](contracts.md) |
| 后端开发 | [统一语言术语表](glossary.md) → 你负责的上下文文件 → [公共领域基础设施](infrastructure.md) |
| 前端开发 | [模块-上下文映射表](module-map.md) → [统一语言术语表](glossary.md) → 对应上下文 |
| 产品经理 | [统一语言术语表](glossary.md) → [模块-上下文映射表](module-map.md) → [迭代优先级](iteration-priority.md) |
| 测试工程师 | 你负责的上下文文件 → [依赖方向约束](dependency-rules.md) |

---

## 与现有文档的关系

- `docs/product-design-spec.md` 定义产品功能规格，本目录补充其领域维度。
- `docs/architecture-and-development.md` 定义技术架构、数据库、API 路由。
- `docs/requirements-and-acceptance.md` 给出用户视角的需求和验收标准。
- `DESIGN.md` 定义 UI 设计系统，与本目录无重叠。
