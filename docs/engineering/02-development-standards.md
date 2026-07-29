# 开发与交付规范

> **适用范围**：前端、后端、领域事件、SQLite、AI Provider 和媒体处理。
> **权威关系**：业务规则以 `docs/domain/` 为准；接口以生成的 OpenAPI 为准；当前可发布能力以 `docs/implementation/02-feature-status.md` 为准。

## 1. Definition of Done

功能只有同时满足以下条件才可标记“已完成”：

1. 需求 AC、领域命令/事件、API、迁移和自动化测试可互相追踪。
2. 正常、权限、异常、并发、幂等和恢复路径均有测试。
3. 没有 mock、占位结果或静默降级冒充成功。
4. 日志不包含密钥、Token、Prompt 私密内容或用户敏感信息。
5. `docs/implementation/02-feature-status.md` 已同步真实边界与已知限制。

## 2. API 规范

- OpenAPI 3.0 schema 是 HTTP 契约唯一来源，CI 校验生成结果无漂移。
- 写接口必须支持 `Idempotency-Key`；并发更新必须携带版本或 ETag。
- 异步接口返回任务 ID、状态查询地址和 correlationId。
- API 变更遵循向后兼容；破坏性变更必须升级主版本并提供迁移窗口。
- 分页统一使用 cursor；确需页码分页时必须记录稳定排序字段。

## 3. 数据库与迁移

- 所有 schema 变更通过单调递增、不可改写的迁移文件完成。
- 每个迁移必须有前向验证、回滚/补偿方案和大数据量评估。
- 业务写入与 `outbox_events` 事件写入处于同一 SQLite 事务。
- 禁止在请求路径执行隐式建表或破坏性迁移。
- 软删除、物理清理、媒体孤儿回收分别执行并保留审计记录。

## 4. 领域事件可靠性

- 事件 envelope 必须包含 `eventId/type/schemaVersion/aggregateId/aggregateVersion/projectId/occurredAt/correlationId/causationId/payload`。
- 生产者使用 Transactional Outbox；消费者使用 Inbox 去重。
- 同一聚合按 aggregateVersion 顺序处理，不同聚合不保证全局顺序。
- 消费失败按 1s/5s/30s 重试，随后进入通用 DLQ；支持授权重放。
- 事件 payload 只做向后兼容增加；删除或改义必须发布新 schemaVersion。

## 5. 测试门禁

| 层级 | 最低要求 |
|---|---|
| 领域单元测试 | 每个状态转换和不变量均覆盖；核心领域行/分支覆盖率 ≥80% |
| 应用测试 | 命令幂等、权限、事务和错误映射 |
| 契约测试 | OpenAPI 请求/响应、领域事件 schema、Provider 适配器 |
| 集成测试 | SQLite 迁移、Outbox/Inbox/DLQ、媒体文件生命周期 |
| E2E | 项目→剧本→资产→分镜→生成→审核→后期→成片→发布主链路 |

覆盖率门禁不得低于需求目标；临时降级必须有负责人、原因和到期日。

> **当前差距**：`backend/package.json` 的测试阈值仍低于核心领域 80% 目标；在阈值提升并通过 CI 前，核心功能不得在 `docs/implementation/02-feature-status.md` 标记为“已完成”。前后端格式化工具也必须先写入依赖和 CI，才能宣称满足“ESLint + Prettier”规范。

## 6. 前端规范

- 服务端数据、编辑草稿和纯 UI 状态分层管理，不得共享同一个全局 store。
- 所有异步页面必须覆盖 loading、empty、partial、error、retry 和 stale 状态。
- SSE 断线使用 Last-Event-ID 恢复；重复事件不得重复更新 UI。
- 表单以领域状态决定可操作性，禁止只靠隐藏按钮实现权限控制。
- 支持键盘操作、可见焦点、语义标签和必要的屏幕阅读器提示。

## 7. 可观测性与安全

- HTTP、命令、领域事件、AI Provider 调用和渲染任务传播同一 correlationId。
- 必须监控 P95/P99、错误率、队列长度、事件积压、DLQ、AI 成本和渲染失败率。
- Provider 密钥只保存引用，不出现在 API、日志或领域事件中。
- 上传文件执行大小、扩展名、MIME、魔数和安全扫描校验。
- 权限、审核、发布、删除、导出和密钥变更必须写不可抵赖审计日志。
