# SQLite 迁移、回填与回滚计划

> 目标 Schema：[target-schema.sql](target-schema.sql)。现有库不得直接执行目标全量 SQL；迁移 Runner 逐个执行带 checksum 的 migration，并记录到 `schema_migrations`。

## 1. 总体策略

采用 `Inventory → Expand → Backfill → Shadow Read → Dual Write → Cutover → Stabilize → Contract`：

- Expand 只新增表、列、索引或兼容视图，不删除旧事实。
- Backfill 按稳定主键分页，每批独立提交，记录游标、数量、哈希和失败项。
- Shadow Read 同时读取新旧模型但只返回旧结果，记录字段级差异。
- Dual Write 由同一应用命令写新旧模型；新写失败则整个命令失败，不异步制造永久分叉。
- Cutover 通过 feature flag 按项目灰度，读新写双；达到门槛后写新读新。
- Contract 只能在兼容窗口、零旧客户端流量和可恢复备份均满足后执行。

## 2. Migration Runner 契约

每个 migration 文件必须包含：

```text
id            例如 001_identity_expand
checksum      文件 SHA-256
transaction   required / forbidden
precheck      只读 SQL 或脚本
up            前滚 SQL/脚本
verify        数量、引用、哈希、不变量
rollback      回滚 SQL/脚本；不可逆时只允许前滚修复并明确说明
```

Runner 规则：

1. 启动时启用 `PRAGMA foreign_keys=ON`、`busy_timeout`，生产迁移前执行 `quick_check`。
2. 相同 id 不同 checksum 立即停止；已完成 migration 不重复执行。
3. DDL 可事务化时使用 `BEGIN IMMEDIATE`；大文件复制不得长时间持有数据库写锁。
4. 每一步保存 `correlationId`、开始/完成时间、行数和验证摘要；日志不得含凭据或内容正文。
5. 失败保持旧路径可服务；不得自动删除 backup/staging。

## 3. 有序迁移批次

| ID | 阶段 | 旧事实源 | 目标 | 前置条件 | Cutover 门槛 |
|---|---|---|---|---|---|
| 001 | 身份 | `auth_users/auth_sessions/auth_memberships` | `users/sessions/user_system_roles/project_members` | 备份、用户名/邮箱冲突报告 | 活跃用户、角色、会话数量核对；最后管理员不变量通过 |
| 002 | API 基础 | 各路由幂等日志/局部 Outbox | `idempotency_records/outbox_events` | operationId 清单冻结 | P0 命令均写 correlationId/Outbox；重放测试通过 |
| 003 | 项目配置 | `settings` KV、projects JSON、旧 budget | `setting_definitions/typed_settings/project_presentation_specs/project_budgets` | 配置 key 分类清单 | 生效值逐 key 相同；敏感值完成加密引用 |
| 004 | 审计通知 | `audit_logs/app_logs/notifications` | `audit_records/notification_*` | 日志与审计语义分类 | P0 命令审计覆盖100%；通知去重/补拉通过 |
| 005 | 资产版本 | `characters/scenes/props` 及多视图表 | `asset_roots/asset_versions/asset_images` | 名称冲突、主图、授权 inventory | 对象/版本/主图/引用计数一致 |
| 006 | Shot 表现 | `shots` 旧字段/JSON、`shot_snapshots` | VisualLayer/TextOverlay/Effect/Motion/PresentationSnapshot | 项目表现默认值已生成 | 每个 Shot 可规范化、hash 稳定、预检可运行 |
| 007 | Audio | `audios` 与音频扩展表 | `audio_assets/audio_asset_versions` | 文件存在、hash、媒体探测报告 | 所有活动引用解析；冻结快照不变 |
| 008 | AI/预算 | image/video tasks、pipeline、旧 cost | `ai_tasks/attempts/generated_media/budget_reservations/cost_records` | Provider requestId 去重报告 | 任务终态、成本总额、未知结果核对一致 |
| 009 | 审核质量 | reviews、snapshots、quality reports/config | 新 Review/QC/QualityRuleSet | 决策人/目标版本可解析 | 历史决定不可变；两级职责分离测试通过 |
| 010 | 后期 | `project_clips/timelines/subtitles/final_videos` | EditProject/Clip/Subtitle/Render/FinalVideo 版本 | 媒体引用/时长 inventory | 时间线时长、轨道、源版本和成片 hash 一致 |
| 011 | 发布协作 | publish plans/records、todos/tasks/issues/milestones | 新 PublishRecord/WorkItem | 平台记录和 source event 去重 | 远端 ID 不重复；工作项数量/负责人一致 |
| 012 | 生命周期 | 局部软删、dataset、backup snapshot | retention/recovery/import/export/backup/restore | 目标主 Schema 稳定 | 项目包往返、恢复演练、RPO/RTO 通过 |

## 4. 关键字段映射

### 4.1 Audio

| 旧字段 | 新字段 | 规则 |
|---|---|---|
| `audios.id` | `audio_assets.id` | 保持 ID，便于兼容引用 |
| `audios.project_id` | `audio_assets.project_id` | 无项目记录进入隔离，不创建悬空行 |
| `type/name/status` | 同语义字段 | 未知 type 映射失败清单，禁止猜测 |
| `file_path/url` | `media_objects.storage_key` | 解析为受控相对 storage key；计算 SHA-256 |
| duration/sample rate | `audio_asset_versions` | 使用 ffprobe/等价工具验证，缺失值不得伪造 |
| shot/character binding | Shot overlay/AudioClip/driver ref | 按用途迁移，不保留多义外键 |

### 4.2 Clip/Timeline

| 旧事实 | 新事实 | 规则 |
|---|---|---|
| `project_clips` | `edit_clips` | 必须找到唯一 EditProject/track；无法定位进入冲突报告 |
| `timelines` | `edit_projects` | 每项目/剧集生成明确工程，不以 projectId 代替工程 ID |
| timeline nodes | `edit_tracks/edit_clips` | 按类型分轨，保留稳定排序和源入出点 |
| video URL/version | source id/version + snapshot id | 旧记录缺 snapshot 时标为 legacy provenance，不伪造 hash |

### 4.3 漫剧表现

- 旧 Shot 的 character/scene/prop 绑定转为 `shot_asset_bindings`，固定已发布版本；无法确定版本时使用迁移时的当前发布版本并记录 provenance。
- 旧 dialogue 仅生成初始 TextOverlay 草稿，不能假装已有人工排版；位置使用项目默认模板并标记 `needs_layout_review`。
- 旧 movement/camera 字段可映射为基础 MotionCue；只有规则完全确定时自动转换，否则保留为 legacy note。
- 历史 ShotSnapshot 不等同 PresentationSnapshot；只有资产、字体、模型、音频和规范化 hash 齐全后才能升级为正式快照。

### 4.4 配置、审计与通知

- `settings.key/value` 先经过 `setting-key-catalog.json` 分类；未知 key 保留在兼容只读表，不进入无 schema 的 typed setting。
- `app_logs` 只保留运行诊断，不回填 AuditRecord；`audit_logs` 仅在 actor/action/target/result 可证明时迁移。
- 旧通知缺 templateVersion/dedupeKey 时生成迁移模板版本和确定性 `sha256(recipient,eventType,target,occurredBucket)`；只迁移站内历史，不重发邮件。

## 5. 每批验证

每个 Backfill 批次输出 JSON 报告：

```json
{
  "migrationId": "006_shot_presentation_backfill",
  "cursorFrom": "shot_0001",
  "cursorTo": "shot_1000",
  "sourceCount": 1000,
  "targetCount": 1000,
  "sourceDigest": "sha256:...",
  "targetDigest": "sha256:...",
  "warnings": [],
  "failures": []
}
```

全局门槛：

- `PRAGMA quick_check = ok`、`foreign_key_check` 为空。
- 源/目标主对象数量一致；允许排除项有逐项原因和批准记录。
- 文件存在率和 hash 核对率 100%；缺失文件阻断 Cutover。
- 活跃引用可解析率 100%；历史不可解析项只能进入隔离报告，不能静默丢弃。
- Shadow Read 连续 7 天或不少于 10,000 次读取无 P0/P1 差异。
- Dual Write 连续 7 天无永久分叉，对账任务无未处置失败。

## 6. 回滚与前滚修复

| 阶段 | 回退方法 |
|---|---|
| Expand | 停用 feature flag；新表可保留，不急于 DROP |
| Backfill | 依据 migration batch/journal 删除该批目标行；不触碰旧表 |
| Shadow Read | 关闭 shadow；旧读路径不变 |
| Dual Write | 回到旧读/旧主写，保留新表用于差异诊断；用 journal 反向补偿 |
| Cutover | feature flag 回切旧读；冻结新写或恢复双写并执行反向回填 |
| Contract | 只有 Contract 前完整备份可恢复；DROP 后不承诺即时 SQL 回滚，使用恢复演练过的备份或前滚修复 |

禁止使用 `git reset`、覆盖生产库文件或未验证的手工 SQL 作为数据回滚方案。

## 7. Contract 删除清单

只有全部门槛满足才删除：旧 `/api` 写路由、数字 `code:0` envelope、`audios` 聚合写入口、独立 `project_clips` 写入口、无类型 `settings` 写入口、重复 `app_logs/audit_logs` 业务审计、旧 Shot 表现字段。删除前至少保留一个正式发布周期的弃用指标。
