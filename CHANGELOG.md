# CHANGELOG

> manju 后端服务的版本变更记录。版本号遵循 [SemVer](https://semver.org/lang/zh-CN/)（主版本.次版本.补丁版本）。
> BREAKING / FEATURE / FIX / REFACTOR / DOCS / TEST 五类标签标记每一次变更。

---

## [2.1.0] - 2026-07-23

### REFACTOR
- 将 `PipelineRun`、`Shot`、`Review` 三个核心对象加固为独立聚合，关键状态只能通过领域行为和应用命令修改。
- Scheduler 仅负责调度、Executor 仅返回执行结果；Run/Node 最终状态由 `PipelineRunAggregate` 决定。
- `review_items` 成为审核聚合权威存储，审核历史、快照、驳回和重新提交统一由 `ReviewAggregate` 管理。
- Shot 生成、送审、审核结果、归档和恢复统一进入 `ShotAggregate`。

### FEATURE
- 新增 `Review → Shot → Pipeline` Outbox 跨聚合事件链路及稳定 command ID 幂等消费。
- 新增三个专属 SQLite Repository、聚合版本乐观锁和幂等迁移。
- 新增 DDD 架构门禁，禁止白名单外直接修改三个聚合的受保护状态。

### FIX
- 修复模型能力路由被通用 `/api/models` 路由遮蔽的问题。
- 模型约束 HTTP 测试改用隔离端口，并正确传播启动或断言失败。
- 补齐前端主内容 skip-link 目标、会话按钮可访问名称及 E2E 精确定位。

### TEST
- DDD 领域与持久化测试、跨聚合集成测试全部通过。
- 后端全量测试 `205/205`，受保护写入扫描结果为 `0`。
- 前端生产构建通过，关键 Playwright E2E `21/21`。
- SQLite 迁移、备份、恢复及敏感信息扫描通过。

### DOCS
- 完成 Gate 0 契约、状态机 JSON、三条任务线交接报告、协调者验收报告和迭代看板归档。

## [2.0.0-rc.1] - 2026-07-23

### FIX
- 恢复后端安全响应头接线和前端缺失源码，后端与前端生产构建重新通过。
- 修复项目 owner 回归、consistency-pack 后端缺口、SQLite 旧结构迁移与一致性备份。
- 补齐 P0 预算硬拦截：批量任务按本批累计成本校验，Pipeline 创建、追加节点和执行前均复检 hard cap。
- Pipeline 未配置的生成/合成/渲染/Webhook 执行器改为明确失败；审核节点不再默认自动通过，避免空结果被记录为成功。

### TEST
- 后端 `test:all` 全量门禁通过，关键前端 E2E 21/21 连续两次通过。
- 新增 100 请求/并发 10 的性能烟测和显式隔离保护的真实 Provider 条件烟测。
- 新增 `p0-release-guards.test.mjs`，覆盖聚合预算越界、批内累计越界、合成预检与占位执行器 fail closed。

### DOCS
- 新增唯一功能状态基线、RC 验收证据矩阵、已知限制与升级回滚方案。

## [2.0.0] - 2026-07-22

### BREAKING
- **MOD-PROJ 项目基线（REQ-PROJ-001）**：项目字段、错误码、软删模型全面升级。
  - **删除语义变更**：`DELETE /api/projects/:projectId` 由 **硬删改为软删**（PROJ-001-011）。
    旧版直接 `DELETE` 主表 + 解绑会话；V2 先解绑会话、级联硬删子表（任务/成员/剧集/问题/里程碑/剧本/审核/分镜/剪辑/资产/分镜脚本）、最后写 `deleted_at`。已软删项目再 `DELETE` 幂等返回 `alreadyDeleted: true`。
  - **`POST /api/projects` 入参校验**：
    - `name` 缺失/空白返回 `422 name_required`（PROJ-001-006）。
    - `owner` 缺失/空白返回 `422 owner_required`（PROJ-001-007）。
    - `type` 非法值（非 `short_drama`/`mv`/`ad`/`film`）返回 `422 project_type_invalid`（PROJ-001-003）。
  - **错误响应码与 HTTP 状态码对齐**（PROJ-001-008）：
    - `project_not_found` → HTTP **404**（之前：HTTP 400 + 中文文案）
    - `project_not_deleted` → HTTP **409**（恢复未软删项目）
    - `name_required` / `owner_required` / `project_type_invalid` → HTTP **422**
    - 业务错误码新增 1007（VALIDATION）、1008（CONFLICT）。
  - **路由新增**：
    - `GET /api/projects/trash` — 回收站列表（PROJ-001-015），按 `deleted_at` 降序。
    - `POST /api/projects/:projectId/restore` — 恢复已软删项目（PROJ-001-016），未软删返回 409。

### V1 兼容说明
- 旧 `"project not found"`（带空格）和新 `"project_not_found"`（下划线）由 `errorStatusForMessage()` 统一映射到 404，前端无需立即迁移。
- 旧 `DELETE /api/projects/:id` 调用方建议改为先调用 `GET /api/projects/trash` 检查是否需要恢复，再决定是否 `POST .../restore`。
- 旧项目数据（`type`/`deleted_at` 缺失）：`ensureColumns()` 自动 `ALTER TABLE ADD COLUMN`，迁移后旧项目 `type` 为 `NULL`（业务用 `?? "short_drama"` 兜底），`deleted_at` 为 `NULL`（业务用 `!p.deleted_at` 同时兼容 `NULL` 与 `""`）。

### FEATURE
- 新增 `Project.type` 字段（PROJ-001-001/002/003/004）：4 枚举 `short_drama`/`mv`/`ad`/`film`。
- 新增 `Project.deleted_at` 字段（PROJ-001-009/010/011）：ISO 时间戳，空串或缺失表示未删。
- 新增 `GET /api/projects/trash`（PROJ-001-015）。
- 新增 `POST /api/projects/:projectId/restore`（PROJ-001-016）。

### FIX
- 项目子表访问前会先校验项目是否存在且未软删（PROJ-001-017），避免脏读。

### REFACTOR
- `src/services/domain/project.ts` 拆分出 `domain/project.ts`，与 V1 的 `src/services/domain.ts` 解耦。
- 错误消息统一为下划线命名（如 `project_not_found`），V1 带空格的同名消息由 `errorStatusForMessage` 兼容。

### TEST
- 计划新增 e2e 测试 ≥ 25 用例（PROJ-001-021），覆盖：
  - 字段/枚举（type、deleted_at、storage_path、status、category、description、episode_count、owner、due_date、is_default、is_pinned、archived_at）
  - 软删幂等 + 回收站
  - 恢复
  - 错误码与 HTTP 状态码
  - 子表访问拦截

---

## 历史版本

### [1.x] - 历史
- 初版项目 CRUD：`POST /api/projects` / `GET /api/projects` / `PUT /api/projects/:id` / `DELETE /api/projects/:id`（硬删）
- 错误消息中文文案（不带下划线），HTTP 状态码默认 400。
