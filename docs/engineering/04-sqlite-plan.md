# SQLite 存储说明

> **领域归属**：[依赖方向约束](../domain/09-dependency-rules.md) + 10 个上下文文件（按表归属对应）

> 领域实体的聚合边界、命名、状态机以 [DDD 领域需求规格](../domain/01-domain-requirements-spec.md) 为权威来源；本文档描述**物理表**的清单、字段命名约定、媒体文件位置和连接管理。物理表与领域实体的对应关系见 [01-architecture-and-development.md §6](01-architecture-and-development.md)。

系统使用 SQLite 作为**唯一**主数据存储，数据库文件位于：

```text
backend/data/sqlite.db
```

WAL 模式下还会伴随 `sqlite.db-shm` 与 `sqlite.db-wal` 两个文件。

## 为什么使用 SQLite

AI 漫剧项目会产生大量关联数据：

- 项目、剧集、剧本文档
- 分镜板与分镜
- 角色、场景、道具资产
- 流水线、AI 任务、质检报告
- 审核与发布

这些数据需要稳定查询、更新和关联。SQLite 提供事务、参数化语句与软删除友好的列式字段，适合做长期主存储。

## 仓储抽象

`backend/src/storage/repository.ts` 定义通用接口：

- `Repository<T extends { id: string; created_at: string }>`：标准 CRUD
- `KeyValueRepository<T>`：设置类实体
- `FieldSpec<T>`：把领域字段声明为 `string` / `number` / `boolean` / `json` 四种类型，供 `SqliteRepository<T>` 自动建表与读写

`backend/src/storage/sqlite.ts` 提供 `SqliteRepository<T>` 与 `SqliteSettingsRepository<T>` 两种实现，统一使用 Node 24 自带的 `node:sqlite`。

## 核心物理表

下表按 [DDD §1 限界上下文](../domain/01-domain-requirements-spec.md) 定义目标物理契约及所属上下文。表名出现在本文不代表已经实现；实际存在性和发布状态以 [implementation/02-feature-status.md](../implementation/02-feature-status.md) 的代码核验证据为准。**表与领域实体的映射**见 [01-architecture-and-development.md §6.2](01-architecture-and-development.md)。

### 项目管控上下文

| 物理表 | 用途 |
|--------|------|
| `projects` | 项目基础信息和本地存储目录 |
| `project_members` | 团队成员和职责分工 |
| `project_episodes` | 剧集规划 |

### 剧本创作上下文

| 物理表 | 用途 |
|--------|------|
| `scripts` | 剧本元数据（Path A，与 Path B `project_scripts` 共用同一张物理表，含状态 / 字数 / 章节数 / 软删） |
| `script_documents` | 剧本文档（结构化，含编辑器 JSON、版本号与 AI 原始数据） |
| `script_episodes` | 剧本关联的剧集 |
| `script_scenes` | 剧本场景 |
| `script_scene_characters` | 剧本场景角色关联（记录出场角色、角色类型与是否发言） |
| `script_scene_locations` | 剧本场景地点关联（绑定场景资产） |
| `script_dialogues` | 剧本对白 |
| `script_comments` | 剧本评论 |
| `script_templates` | 剧本模板（世界观 / 角色模板 / 情节结构，可复用） |
| `script_tags` | 剧本标签（按分类着色） |
| `script_quality_assessments` | 剧本质量评估（多维打分：结构 / 角色 / 对白 / 节奏 / 一致性 / 原创性） |
| `script_approvals` | 剧本审批（多步审批流，含申请人 / 审批人 / 评论） |
| `script_backups` | 剧本备份（手动 / 自动快照，含过期清理） |
| `script_analyzed_characters` | 剧本分析提取的角色（AI 解析结果，字段与 `characters` 对齐） |
| `script_analyzed_scenes` | 剧本分析提取的场景（AI 解析结果，字段与 `scenes` 对齐） |
| `script_analyzed_props` | 剧本分析提取的道具（AI 解析结果，字段与 `props` 对齐） |
| `project_versions` | 资产与剧本文档的版本历史 |

### 分镜导演上下文

| 物理表 | 用途 |
|--------|------|
| `project_storyboards` | 分镜板（聚合根） |
| `project_clips` | 历史剪辑片段兼容表；新写入迁移到后期制作上下文 |

### 资产库上下文

| 物理表 | 用途 |
|--------|------|
| `characters` | 角色资产 |
| `scenes` | 场景资产 |
| `props` | 道具资产 |
| `character_image_history` | 角色图片历史 |
| `scene_image_history` | 场景图片历史 |
| `prop_image_history` | 道具图片历史 |
| `project_assets` | 通用资产库（图片 / 视频 / 风格 / Prompt 模板） |
| `prompt_templates` | Prompt 模板 |

### AI 任务调度上下文

| 物理表 | 用途 |
|--------|------|
| `image_tasks` | 图片生成任务 |
| `video_tasks` | 视频生成任务 |
| `models` | 模型配置 |
| `pipeline_runs` | 流水线执行实例 |
| `pipeline_nodes` | 流水线节点 |
| `pipeline_dead_letters` | 流水线死信 |

### 审核质量上下文

| 物理表 | 用途 |
|--------|------|
| `reviews` | 审核项 |
| `qc_reports` | 质检报告 |
| `quality_configs` | 质检策略 |

### 发布交付上下文

| 物理表 | 用途 |
|--------|------|
| `final_videos` | 成片 |
| `publish_plans` | 发布计划 |
| `publish_records` | 发布记录 |

### 后期制作上下文

| 物理表 | 用途 |
|--------|------|
| `edit_projects` | 剪辑工程及 current revision |
| `edit_project_revisions` | 冻结的时间线版本快照 |
| `video_tracks` | 视频轨道与片段 |
| `audio_tracks` | 配音/BGM/音效轨道与片段 |
| `audio_assets` | 音频资产及版权元数据 |
| `subtitle_documents` | 字幕文档元数据 |
| `subtitle_cues` | 字幕条目与时间码 |
| `render_jobs` | 渲染任务、输入 revision、进度和输出 |

### 智能助手上下文

| 物理表 | 用途 |
|--------|------|
| `conversations` | 对话会话 / 图片 / 视频生成会话 |
| `messages` | 对话会话消息 |
| `work_items` | 统一工作项（任务 / 问题 / 评审 / 里程碑，状态机收敛后的唯一工作项表） |

### AI 任务调度上下文 — 数据集

| 物理表 | 用途 |
|--------|------|
| `datasets` | 数据集 |

### 系统与历史

| 物理表 | 用途 |
|--------|------|
| `favorites` | 收藏记录 |
| `todos` | 历史工作项（与 `work_items` 并存，由 P0 整改方案收口） |
| `app_logs` | 审计日志（业务事件、跨项目复制、软删 / 恢复等） |
| `settings` | 应用设置（KV 形式） |
| `users` | 用户与认证 |

### 领域事件可靠性

| 物理表 | 用途 |
|--------|------|
| `outbox_events` | 与聚合写入同事务保存的待发布事件 |
| `inbox_events` | 消费端 eventId 去重、处理结果和消费时间 |
| `event_dlq` | 通用领域事件死信、失败原因和授权重放记录 |
| `projection_checkpoints` | CQRS 投影消费位点和版本 |

> **字段命名约定**：物理表字段全部使用 `snake_case`；领域层使用 camelCase。仓储层在读写时做命名转换，对应用层透明。

## 分镜表关键字段

`project_storyboards` 表的关键字段集合：

```text
id
project_id
episode_id
title
description
shot_ids
status
created_at
updated_at
```

完整字段以 `backend/src/storage/schema.ts` 中 `project_storyboards` 的 `FieldSpec` 定义为准。

## 媒体文件位置

SQLite 只保存记录和 URL，不把图片、视频二进制直接塞进数据库。

通用媒体目录：

```text
backend/data/media/
```

项目媒体目录：

```text
backend/data/projects/{project}/media/
```

这样做的好处是：数据库轻、文件好备份、后续导出项目资产包更直接。

## 连接释放

后端使用 Node 24 自带的 `node:sqlite`。HTTP server 关闭时会调用应用上下文的 `close()`，释放 SQLite 连接，避免 Windows 下 `sqlite.db` 文件被锁住。

## 索引策略

> 索引的创建与管理分散在仓储层自动建表与各服务 / 迁移脚本中，本节统一说明索引策略原则与现状。

### 索引创建原则

1. **主键索引**：所有业务表主键为 `id`（TEXT），建表时声明 `PRIMARY KEY`，SQLite 自动创建主键索引，无需手动建。
2. **时间排序索引**：所有带 `created_at` 字段的业务表，由 `SqliteRepository.ensureTable()` 自动创建 `<table>_created_at_idx` 索引，覆盖按时间倒序分页查询（列表页默认按 `created_at DESC` 排序）。
3. **外键过滤索引**：以 `project_id` 为高频过滤条件的业务表（角色、场景、道具、分镜、任务等），应建立 `project_id` 索引，避免全表扫描。当前由各服务按需在迁移脚本中创建。
4. **状态机索引**：含状态机字段的表（如 `status`），若存在"按状态筛选"的高频查询（如待审核列表、流水线运行中节点），应建立 `status` 索引或 `(project_id, status)` 复合索引。
5. **幂等键索引**：命令日志表（`*_command_log`）与幂等相关表须在幂等键字段上建立索引或唯一索引，保证幂等校验的查询性能。
6. **唯一约束索引**：业务上要求唯一的字段（如 `review_scorecards.review_id`）使用 `CREATE UNIQUE INDEX`，由数据库层强制约束。
7. **索引命名约定**：手动索引统一以 `idx_<表名简写>_<字段>` 命名（如 `idx_pipeline_nodes_run`），自动索引以 `<table>_created_at_idx` 命名。

### 自动索引

`SqliteRepository`（`backend/src/storage/sqlite.ts`）在建表时自动执行：

```sql
CREATE INDEX IF NOT EXISTS "<table>_created_at_idx" ON "<table>" ("created_at")
```

仅当表的 `FieldSpec` 包含 `created_at` 字段时创建。该索引覆盖所有业务表的列表排序查询。

### 手动索引现状

以下索引由各服务 / 迁移脚本按需创建（均使用 `CREATE INDEX IF NOT EXISTS`，幂等可重复执行）：

| 索引 | 表 | 字段 | 用途 | 来源 |
|------|----|------|------|------|
| `idx_outbox_events_status` | `outbox_events` | `(status, created_at)` | Outbox Dispatcher 按 pending 状态拉取 | `transaction-service.ts` |
| `idx_pipeline_nodes_run` | `pipeline_nodes` | `run_id` | 按 Run 查询节点列表 | `pipeline-run-migration.ts` |
| `idx_pipeline_dependencies_run` | `pipeline_dependencies` | `run_id` | 按 Run 查询依赖关系 | `pipeline-run-migration.ts` |
| `idx_pipeline_nodes_idempotency` | `pipeline_nodes` | 幂等键 | 节点幂等复用查询 | `pipeline-run-migration.ts` |
| `idx_pipeline_command_log_run` | `pipeline_command_log` | `run_id` | 命令日志按聚合查询 | `pipeline-run-migration.ts` |
| `idx_shot_command_log_shot` | `shot_command_log` | `shot_id` | 分镜命令日志查询 | `shot-migration.ts` |
| `idx_review_command_log_review` | `review_command_log` | `review_id` | 审核命令日志查询 | `review-migration.ts` |
| `consistency_pack_entity_idx` | `consistency_packs` | 实体引用 | 按实体查询一致性包 | `consistency-pack-router.ts` |
| `consistency_pack_images_pack_idx` | `consistency_pack_images` | `pack_id` | 按包查询图片 | `consistency-pack-router.ts` |
| `idx_review_assignments_review` | `review_assignments` | `(review_id, assigned_at)` | 按审核查询分配记录 | `p1-features-service.ts` |
| `idx_review_annotations_review` | `review_annotations` | `(review_id, created_at)` | 按审核查询批注 | `p1-features-service.ts` |
| `idx_review_scorecards_review` | `review_scorecards` | `review_id`（唯一） | 评分卡一对一约束 | `p1-features-service.ts` |
| `idx_retry_policies_project` | `quality_retry_policies` | `(project_id, trigger)` | 按项目查询重试策略 | `retry-policy-service.ts` |
| `idx_auth_sessions_token` | `auth_sessions` | `token_hash` | 会话令牌查找 | `auth.ts` |
| `idx_auth_memberships_user` | `auth_memberships` | `user_id` | 用户成员关系查询 | `auth.ts` |

### 索引使用约束

- 所有索引创建语句使用 `IF NOT EXISTS`，保证启动期重复执行不报错。
- 索引创建在服务初始化阶段（建表 / 迁移）完成，不在请求处理路径中创建。
- 新增业务表时，若存在高频过滤字段（`project_id` / `status` / `deleted_at`），应在对应迁移脚本中补充索引，不可仅依赖全表扫描。
- 软删除字段 `deleted_at` 的过滤（`WHERE deleted_at IS NULL OR deleted_at = ''`）在数据量增长后可能成为瓶颈，高频查询的表应评估是否需要部分索引。

## 备份与归档

| 周期 | 动作 |
|------|------|
| 每日 02:00 | `sqlite.db` → `sqlite.db.YYYY-MM-DD.bak` |
| 每周日 03:00 | 全量 tar 备份至 OSS / S3 |
| 实时 | 通过 `rclone` / `rsync` 同步至异地 |

完整升级与回滚策略见 [05-release-rollback.md](../governance/05-release-rollback.md)。
