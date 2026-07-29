# ADR-003：命令一致性组合

## 决策

所有写操作使用：Command ID、适用时 Idempotency-Key、聚合 If-Match、单库 UnitOfWork 和事务 Outbox。跨库/Provider 使用 Saga 状态和补偿，不把网络调用放进 SQLite 事务。

## 约束

- Create/Add/Execute/Generate/Publish/Import 等重放危险操作必须幂等。
- 聚合更新以 `WHERE id=? AND version=?` 执行；影响0行返回 `version_conflict`。
- 事件与事实同事务写 Outbox；消费者按 eventId 幂等。
- Provider accepted-but-unknown 进入 `unknown_result`，先 reconcile 再重试。
