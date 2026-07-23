# DDD-REVIEW 交付报告

> 日期：2026-07-23
> 任务：`DDD-REVIEW`（迭代计划 §6）
> 状态：任务线实现完成，定向测试全通过，等待公共 Router 集成与全量门禁

## 已完成

- `ReviewAggregate` 统一拥有审核七状态机；状态、驳回次数、重新提交次数、驳回原因只能由本聚合修改。
- 七状态机冻结定义在 `review-state-machine.ts`，与 `v2.1-ddd-state-machines.json#review` 对齐：
  `pending → in_review → (approved | rejected) → (closed | needs_fix) → pending → ...`，共 8 条迁移。
- `RejectionReason` 值对象校验 11 种冻结驳回原因码，聚合 `reject` 必须携带有效原因。
- 领域错误复用共享错误码：`aggregate_not_found` / `invalid_state_transition` /
  `aggregate_version_conflict` / `aggregate_invariant_violated` / `command_already_processed`。
- 领域事件工厂产出 `ReviewSubmitted` / `ReviewApproved` / `ReviewRejected` / `ReviewResubmitted`，
  事件名与 payload 来自 `domain/shared/domain-event.ts` 冻结契约。
- `review_items` 设为本迭代权威审核聚合存储；旧 `reviews` 表冻结只读（CRUD 改为抛弃用错误）。
- Review 专属 Repository Port（`review.repository.ts`）由 `SqliteReviewRepository` 实现，
  位于架构门禁白名单目录 `src/infrastructure/persistence/`。
- `ReviewMapper` 只读写聚合权威字段，不触碰 SLA 元数据（`sla_due_at` / `escalation_level` /
  `escalated_at` / `breached_at`）和展示字段（`title` / `priority` / `approved_by` 等）。
- `save` 使用 `WHERE id = ? AND version = ?` 乐观锁；影响行数 0 抛 `aggregate_version_conflict`。
- `recordCommand` 通过 `review_command_log(id PK)` 去重；重复 commandId 抛 `command_already_processed`。
- 7 个命令处理器（submit / start / approve / reject / resubmit / close / cancel）在 UnitOfWork
  事务内加载聚合、执行命令、保存、记录幂等键、入队领域事件。
- 状态、历史、快照与 Outbox 在同一 SQLite 事务提交；回调抛错时全部回滚。
- 驳回语义保持：`reject` 命令在同一 UoW 事务内连续执行 `reject + markNeedsFix`，使被打回方可以直接 `resubmit`。
- 快照规则：仅在显著状态（`approved` / `rejected` / `needs_fix` / `closed` / `cancelled`）写快照，
  `pending` / `in_review` 中间态不打快照，聚焦决策点审计。
- `review-service.ts` 完全重写为 V2.1 DDD 版：所有变更走 Application Command Handler，
  保留横切副作用（通知、审计、返工 todo）在命令事务提交后执行。
- `review-module.ts` 旧 `reviews` 表 CRUD 冻结，`listReviews` 保留为只读兼容。
- 审核结果只产生领域事件，不直接修改 Shot（迭代计划 §6.1：跨聚合协作通过命令和事件完成）。

## 定向验证

- TypeScript 检查中未发现 Review 新增代码错误。当前全项目检查被任务线外 Shot 文件的错误阻塞：
  - `src/application/storyboard/edit-shot.command.ts(72,45)`：`shot_size` 类型不兼容
  - 该文件为未授权范围（Shot 任务线），未修改。
- `ddd-review-domain.test.mjs`：31/31 通过。
- `ddd-review-persistence.test.mjs`：9/9 通过。
- 定向覆盖（迭代计划 §6.7）：
  - 七状态机全部覆盖（8 条迁移 + 终态保护）
  - 重复审批、重复驳回、非法重新提交测试
  - 两名审核人并发处理的版本冲突测试（乐观锁 `WHERE id = ? AND version = ?`）
  - 历史/快照/Outbox 事务回滚测试（UoW 内 save + enqueue 后抛错，全部回滚）
  - SLA 更新不影响聚合状态测试（Repository UPDATE 只 SET 权威字段）
  - 幂等去重测试（重复 commandId 抛 `command_already_processed`）
  - 返工循环测试（reject → markNeedsFix → resubmit，`rejectedCount` / `reSubmitCount` / `previousReviewId` 持久化）
  - Outbox 提交测试（命令提交后 `outbox_events` 写入对应领域事件）
- 未运行全量测试。

## 改动文件清单

### 新增文件

**领域层**（`backend/src/domain/review/`）
- `review.aggregate.ts` — Review 聚合根（七状态机、版本、历史、事件、rehydrate）
- `review-state-machine.ts` — 冻结状态机定义（7 状态、8 迁移、终态）
- `review-events.ts` — 领域事件工厂（Submitted/Approved/Rejected/Resubmitted）
- `review-errors.ts` — Review 语义错误构造器（复用共享错误码）
- `review.repository.ts` — Repository Port 接口
- `rejection-reason.value-object.ts` — 11 种驳回原因值对象

**应用层**（`backend/src/application/review/`）
- `review-command-handler.ts` — 共享依赖类型与公共辅助（loadReviewOrThrow / assertCommandNotProcessed / enqueuePulledEvents）
- `submit-review.command.ts` — 提交审核命令
- `start-review.command.ts` — 开始审核命令
- `approve-review.command.ts` — 通过命令
- `reject-review.command.ts` — 驳回命令（reject + markNeedsFix 同事务）
- `resubmit-review.command.ts` — 重新提交命令（needs_fix → pending）
- `close-review.command.ts` — 终态化命令（approved/rejected → closed）
- `cancel-review.command.ts` — 取消命令（pending → cancelled）

**基础设施层**（`backend/src/infrastructure/persistence/`）
- `review-migration.ts` — 幂等迁移（`review_command_log` 表 + review_items 列补齐）
- `review.mapper.ts` — Review 聚合 ↔ SQLite 行双向映射
- `sqlite-review.repository.ts` — SQLiteReviewRepository 实现（乐观锁 + 事务参与 + 幂等去重 + 快照）

**测试**（`backend/tests/`，被 `.gitignore` 忽略但磁盘存在）
- `ddd-review-domain.test.mjs` — 纯内存领域层单元测试（31 用例）
- `ddd-review-persistence.test.mjs` — 持久化与事务集成测试（9 用例）

### 修改文件

- `backend/src/services/horizontal/review-service.ts` — 完全重写为 V2.1 DDD 版
- `backend/src/services/module-domain/review-module.ts` — 旧 reviews 表 CRUD 冻结

## 跨任务线边界说明（未授权文件未修改）

以下文件在实现过程中识别到"如需修改应写入交付报告"的事项，按限制要求仅记录，未修改：

- **SLA 文件**（`sla-monitor.ts` / `sla-monitor` 相关）：Repository 的 UPDATE 语句只 SET 聚合权威字段，
  不修改 `sla_due_at` / `escalation_level` / `escalated_at` / `breached_at`。SLA 服务继续独占这些字段。
  无需修改 SLA 文件。
- **Snapshot 文件**（`review-snapshot-service.ts`）：该服务仍提供只读快照查询 API（`listReviewSnapshots` 等），
  供 Read Model 使用。聚合写入快照由 `SqliteReviewRepository.insertSnapshot` 在事务内完成，
  与该服务不冲突。无需修改。
- **Assignment 文件**：未识别到需要修改的 Assignment 文件。
- **Shot 文件**（`edit-shot.command.ts` / `shot.mapper.ts`）：存在任务线外编译错误（`shot_size` 类型不兼容），
  属于 Shot 任务线职责，未修改。审核结果只产生事件，不直接修改 Shot。
- **Pipeline 文件**：未修改。审核与 Pipeline 的跨聚合协作通过领域事件完成。

## 待后续集成

- Router 层接入：HTTP 路由需从旧 `reviewService.*` 直调迁移到命令处理器入口。
- Shot 消费者：`ReviewApproved` / `ReviewRejected` 事件的跨聚合消费者（由 Shot 任务线负责）
  需读取 Outbox 并驱动 Shot 状态变更。
- 全量门禁：Shot 任务线编译错误修复后，运行 `npm run check:architecture` + 全量测试。
- Review 直接状态写入残留扫描：输出扫描报告（迭代计划 §6.7 最后一项）。
