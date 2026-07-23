# DDD-PIPELINE 交付报告

> 日期：2026-07-23  
> 任务：`DDD-PIPELINE`  
> 状态：任务线实现完成，等待公共 Router 集成

## 已完成

- `PipelineRunAggregate` 统一拥有 Run 与 Node 状态决定权。
- `PipelineNode` Entity 维护独立版本、累计重试次数、输出、错误和时间信息。
- Run/Node 状态机拒绝非法启动、暂停、恢复、完成、失败、重试和跳过。
- `DagPolicy` 校验未知节点、自环、环路和冻结条件类型，并在所有入边求值后区分 ready/unreachable。
- Pipeline 专属 Repository Port、Mapper、SQLite Adapter 和幂等迁移已实现。
- Run、变更 Node、处理过的 command id 和领域 Outbox 在同一 SQLite 事务中保存。
- Run 与 Node 均使用 `WHERE id = ? AND version = ?` 乐观锁。
- Create/Start/Pause/Resume Run，Start/Complete/Fail/Retry/Skip Node，Finalize、节点控制和批量新增 Command Handler 已实现。
- `pipeline-run-service.ts` 的关键状态直写已迁移到 Command Handler。
- Scheduler 仅选择可运行节点、申请并发槽位、做调度前预算检查及派发 Command。
- Executor 不再写 Run/Node、事件或 DLQ，只返回 `success | failure | cancelled` 执行结果。
- 相同 command id 的重复执行结果不重复推进版本或产生 Outbox。
- 手工恢复不会清零累计重试次数。

## 定向验证

- TypeScript 检查中未发现 Pipeline 新增代码错误。当前全项目检查被任务线外 Shot 文件的 2 个错误阻塞：
  - `src/application/storyboard/edit-shot.command.ts`
  - `src/infrastructure/persistence/shot.mapper.ts`
- `ddd-pipeline-domain.test.mjs` 与 `ddd-pipeline-persistence.test.mjs`：8/8 通过。
- 定向覆盖：
  - Run/Node 合法与非法转换
  - DAG 条件分支、不可达分支、环路与非法 expression
  - 两个并发写者的聚合版本冲突
  - 暂停与节点回调竞态
  - 重复 Provider 回调幂等
  - 失败后显式恢复且保留累计次数
  - Outbox 插入失败时 Run/版本原子回滚
- 现有 `pipeline-node-toggle` 失败用例复测：9/9 通过（分两次定向执行）。
- 现有 `pipeline-node-concurrency` 回归中发现 Run 级并发配置未传入后已修复；对应 8 节点/3 并发用例复测通过。
- 未运行全量测试。

## 直接写入残留扫描

三个已迁移文件中没有：

```text
pipelineRuns.update
pipelineNodes.update
UPDATE pipeline_runs
UPDATE pipeline_nodes
```

生产源码仅剩：

- 允许：`sqlite-pipeline-run.repository.ts` 中的乐观锁更新。
- 允许：`pipeline-run-migration.ts` 中的版本回填。
- 待公共集成：`backend/src/http/tasks-router.ts:222` 仍直接执行 `pipelineNodes.update`。

## 集成修改申请

### INT-PIPELINE-001：Tasks Router 节点重置

目标文件（本任务线无写权限）：

```text
backend/src/http/tasks-router.ts
```

请将当前 `failed → pending` 的直接 patch 替换为 `RetryNodeCommand`：

```ts
await retryNodeHandler.execute({
  commandId: `tasks-retry:${requestOrEventId}`,
  type: "RetryPipelineNode",
  issuedAt: nowIso(),
  runId: pipelineNode.run_id,
  nodeId: pipelineNode.id,
});
```

Router 需要从节点 Read Model 取得 `run_id`，不得自行清空 `error`、`retry_count` 或决定目标状态。重复请求必须复用稳定 command id。协调者装配 Handler 后，架构门禁才能将该残留从基线移除。

## 未修改

- Router、AppContext、Use Case、Schema、公共类型
- Shot、Review
- Git 历史（未提交）
