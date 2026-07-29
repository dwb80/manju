# Architecture Decision Records

| ADR | 决策 | 状态 |
|---|---|---|
| [ADR-001](ADR-001-api-versioning.md) | `/api/v1` canonical API 与旧路径兼容 | Accepted |
| [ADR-002](ADR-002-shot-presentation-storage.md) | Shot 表现采用规范化子表，快照采用 canonical JSON | Accepted |
| [ADR-003](ADR-003-command-consistency.md) | UnitOfWork + 乐观锁 + Idempotency + Outbox | Accepted |
| [ADR-004](ADR-004-auth-and-permissions.md) | 安全 Cookie、CSRF、系统/项目两层 RBAC | Accepted |
| [ADR-005](ADR-005-notification-delivery.md) | 站内事实 + SSE 补拉 + 渠道投递尝试 | Accepted |
| [ADR-006](ADR-006-migration-cutover.md) | Expand/Backfill/Shadow/Dual/Cutover/Contract | Accepted |
| [ADR-007](ADR-007-contract-and-test-sources.md) | OpenAPI、Schema、Test Matrix 的生成与门禁 | Accepted |

ADR 只记录跨切片且难以回退的决策。局部实现细节留在开发卡和代码，不把 ADR 变成长篇需求副本。
