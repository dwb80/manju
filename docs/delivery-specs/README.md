# 功能交付规格索引

> 状态：目标设计基线；不代表当前代码已经实现。  
> 目的：把产品需求逐项转换为可开发、可联调、可测试的四联件。

## 权威顺序

1. `requirements/02-requirements-and-acceptance.md` 与 `requirements/product/` 决定产品范围和验收目标。
2. `domain/` 决定领域归属、聚合、命令、事件和不变量。
3. 本目录决定逐功能页面行为、目标 API、逻辑数据模型和可执行验收场景。
4. `ui-design-improvement-spec.html` 决定视觉、通用组件、异步反馈和无障碍表现。
5. 运行时 OpenAPI、迁移、代码和自动化测试决定“已经实现”的事实。

冲突时不得用实现现状静默降低产品要求；应登记差异并通过变更评审决定修改目标或迁移实现。

## 分册

| 分册 | 功能 |
|---|---|
| [01-common-contract.md](01-common-contract.md) | 四联件模板、共享交互/API/数据/验收约定 |
| [02-project-script-storyboard.md](02-project-script-storyboard.md) | US-001～US-006 |
| [03-comic-presentation.md](03-comic-presentation.md) | MANGA-001～MANGA-008 |
| [04-assets-generation-review.md](04-assets-generation-review.md) | US-007～US-012、US-030～US-032 |
| [05-postproduction-publishing.md](05-postproduction-publishing.md) | US-013～US-017、US-021 |
| [06-collaboration.md](06-collaboration.md) | US-018～US-020 |
| [07-platform-capabilities.md](07-platform-capabilities.md) | US-022～US-029 |
| [08-ai-governance-analytics.md](08-ai-governance-analytics.md) | US-PM-001、US-DS-001 |
| [09-operational-capabilities.md](09-operational-capabilities.md) | CAP-001～CAP-008：成员、模型、流水线、数据集、对话、任务、预算、质量规则 |

阶段性交付规格 Review 已归档至 [历史 Review](../archive/reviews/2026-07-28/README.md)。

## 完成定义

每个功能必须同时具备：

- 页面交互规格：路由、角色、数据范围、页面状态、操作、校验、异常和离开保护；
- API 契约：方法、路径、请求、响应、权限、幂等/并发和稳定错误码；
- 数据模型：事实源、字段、关系、唯一性、版本、删除和审计约束；
- 可执行验收：Given/When/Then 场景，具有稳定场景 ID，可映射到 E2E/契约/集成测试。

未满足任一项的功能不得标记为“开发就绪”。
