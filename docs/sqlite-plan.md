# SQLite 存储说明

系统现在默认使用 SQLite 作为主数据存储，数据库文件位于：

```text
backend/data/app.sqlite
```

旧的 CSV 仓储代码仍然保留，用于测试、导出思路和后续兼容迁移，但运行时主数据已经写入 SQLite。

## 为什么切到 SQLite

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

这些数据需要稳定查询、更新和关联。CSV 适合简单备份和人工查看，但不适合作为长期主存储。

## 当前核心表

- `projects`：项目基础信息和本地存储目录。
- `conversations`：聊天、图片、视频生成会话。
- `messages`：聊天消息。
- `project_members`：项目成员和职责分工。
- `project_episodes`：剧集规划，保存每集标题、阶段、简介、截止日期和备注。
- `project_issues`：项目问题和风险跟踪。
- `project_milestones`：项目里程碑和交付节点。
- `project_tasks`：项目任务看板。
- `project_storyboards`：分镜中心。
- `project_clips`：剪辑清单，保存片段顺序、入点、出点、状态和备注。
- `project_assets`：项目资产库，包含图片、视频、角色、场景、风格、提示词等。
- `image_tasks`：图片生成任务。
- `video_tasks`：视频生成任务。
- `favorites`：收藏记录。
- `settings`：应用设置。

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

后端使用 Node 24 自带的 `node:sqlite`。HTTP server 关闭时会调用应用上下文的 `close()`，释放 SQLite 连接，避免 Windows 下 `app.sqlite` 文件被锁住。

## 旧 CSV 迁移

如果需要把旧版本 `backend/data/csv/` 里的数据导入 SQLite，可以执行：

```bash
cd backend
npm run migrate:csv
```

迁移脚本会：

1. 读取 `backend/data/csv/` 下的旧 CSV。
2. 按 `backend/src/storage/schema.ts` 的字段定义解析。
3. 跳过 SQLite 中已经存在的同 ID 记录，避免重复插入。
4. 写入 `backend/data/app.sqlite`。
5. 打印每类记录的总数、插入数和跳过数。

迁移完成后建议保留旧 CSV 作为备份，不再让运行时继续写入 CSV。
