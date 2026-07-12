# SQLite 存储说明

系统使用 SQLite 作为**唯一**主数据存储，数据库文件位于：

```text
backend/data/sqlite.db
```

WAL 模式下还会伴随 `sqlite.db-shm` 与 `sqlite.db-wal` 两个文件。CSV 不再承担持久化角色。

## 为什么使用 SQLite

AI 漫剧项目会产生大量关联数据：

- 项目
- 会话
- 剧本和分镜
- 分镜底图
- 图生视频任务
- 角色资产
- 场景资产
- 风格和提示词资产
- 审核和导出记录

这些数据需要稳定查询、更新和关联。SQLite 提供事务、参数化语句与软删除友好的列式字段，比按天分文件 CSV 更适合做长期主存储。

## 仓储抽象

`backend/src/storage/repository.ts` 定义通用接口：

- `Repository<T extends { id: string; created_at: string }>`：标准 CRUD。
- `KeyValueRepository<T>`：设置类实体。
- `FieldSpec<T>`：把领域字段声明为 `string` / `number` / `boolean` / `json` 四种类型，供 `SqliteRepository<T>` 自动建表与读写。

`backend/src/storage/sqlite.ts` 提供 `SqliteRepository<T>` 与 `SqliteSettingsRepository<T>` 两种实现，统一使用 Node 24 自带的 `node:sqlite`。

## 当前核心表

- `projects`：项目基础信息和本地存储目录。
- `conversations`：聊天、图片、视频生成会话。
- `messages`：聊天消息。
- `project_members`：项目成员和职责分工。
- `project_episodes`：剧集规划。
- `project_storyboards`：分镜中心。
- `project_clips`：剪辑清单。
- `project_assets`：项目资产库（图片 / 视频 / 角色 / 场景 / 风格 / 提示词）。
- `project_versions`：资产与剧本文档的版本历史。
- `image_tasks`：图片生成任务。
- `video_tasks`：视频生成任务。
- `favorites`：收藏记录。
- `work_items`：统一工作项（任务 / 问题 / 评审 / 里程碑，状态机收敛后的唯一工作项表）。
- `app_logs`：审计日志（业务事件、跨项目复制、软删 / 恢复等）。
- `settings`：应用设置（KV 形式）。

`scripts` / `project_assets` / `project_reviews` 等表由 Path A（`Script` / `Asset` / `Review`）与 Path B（`ProjectScript` / `ProjectAsset` / `ProjectReview`）共用。

## 分镜表关键字段

```text
id
project_id
episode
scene
shot
title
description
dialogue
characters
location
shot_size
camera_move
duration
prompt
image_task_id
image_url
video_task_id
video_url
status
notes
created_at
updated_at
```

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

这样做的好处是：数据库轻、文件好备份、后续导出项目素材包更直接。

## 连接释放

后端使用 Node 24 自带的 `node:sqlite`。HTTP server 关闭时会调用应用上下文的 `close()`，释放 SQLite 连接，避免 Windows 下 `sqlite.db` 文件被锁住。

## 历史背景

v1.1 之前的版本曾以 CSV 按天分文件存储（`backend/data/csv/`）。该方案已于 2026-07-12 全面下线——`CsvRepository` 不再被任何运行时路径引用，`backend/data/csv/` 目录已删除，所有业务表统一走 SQLite。
