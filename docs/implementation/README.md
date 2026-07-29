# 开发就绪实施包

> 目标：把产品与领域设计转换为可拆卡、可生成、可迁移、可原型验证、可自动检查的工程制品。  
> Gate：本目录通过 Review 代表“可以进入开发”，不代表 47 个业务功能已实现。

## 制品索引

| 制品 | 作用 | 状态 |
|---|---|---|
| [01-development-backlog.md](01-development-backlog.md) | 47 个纵向开发切片、依赖、优先级和完成证据 | 已准备 |
| [02-feature-status.md](02-feature-status.md) | 当前代码能力、证据和已知边界的状态基线 | 持续维护 |
| [02-openapi/openapi.json](02-openapi/openapi.json) | OpenAPI 3.1 机器可读目标契约 | 已生成并校验 |
| [03-database/target-schema.sql](03-database/target-schema.sql) | SQLite 目标物理模型、索引和约束 | 已执行并通过 FK 校验 |
| [03-database/01-migration-plan.md](03-database/01-migration-plan.md) | Expand/Backfill/Shadow/Cutover/Contract 与回滚 | 已评审 |
| [04-prototypes/index.html](04-prototypes/index.html) | 29 个 P0/P1 页面组和六类状态原型 | 已用 Chromium 验证 |
| [04-prototypes/01-page-api-map.md](04-prototypes/01-page-api-map.md) | 页面—功能—API—状态映射 | 已校验 |
| [05-testing/test-matrix.json](05-testing/test-matrix.json) | 需求—场景—API—表—页面映射 | 已生成并校验 |
| [05-testing/01-test-strategy.md](05-testing/01-test-strategy.md) | 测试分层、Fixtures、环境和门禁 | 已评审 |
| [05-testing/02-fixture-catalog.md](05-testing/02-fixture-catalog.md) | 测试数据、身份、异常和外部服务夹具 | 已评审 |
| [06-adr/README.md](06-adr/README.md) | 7 项实现关键决策记录 | 已接受 |
| [07-operations/01-readiness.md](07-operations/01-readiness.md) | 环境、可观测性、发布、回滚和恢复门禁 | 已评审 |
| [07-operations/environment.schema.json](07-operations/environment.schema.json) | 运行配置、密钥、旧别名与透传变量清单 | 已与代码核对 |

Gate 2 Review 证据已归档至 [历史 Review](../archive/reviews/2026-07-28/README.md)。

## 开发就绪定义（DoR）

一个开发切片只有同时满足以下条件才可进入 `Ready`：

1. 有唯一需求 ID、负责人角色、前置依赖和验收场景。
2. 页面操作与状态已定义；纯后端切片明确无页面。
3. 所有外部 HTTP 操作进入 OpenAPI，含 operationId、权限、幂等/并发和错误响应。
4. 所有新增/变更事实进入目标 Schema 和迁移阶段，含回滚或前滚策略。
5. 至少有单元/契约/集成/E2E 中适用的测试映射和 Fixture。
6. 敏感数据、审计、日志、指标和告警要求明确。
7. 不依赖未冻结的产品决策；例外有 ADR。

## 功能完成定义（DoD）

- 实现通过 OpenAPI 契约校验，不使用未登记的响应 envelope。
- Migration 在旧数据副本上完成前滚、核对和回滚演练。
- 对应 Scenario 自动化通过；P0 同时覆盖权限、并发/幂等和失败恢复。
- 前端覆盖加载、空、成功、失败、无权限、冲突和投影延迟状态。
- 监控、审计、日志脱敏和运行手册更新。
- [领域追踪矩阵](../domain/11-traceability-matrix.md)与 [02-feature-status.md](02-feature-status.md) 回填真实证据后方可宣称完成。
