# 数据和文件保存位置

Agnes AI Studio 当前使用 SQLite 作为主数据存储，媒体文件仍然保存在本地文件系统中。

## 总览

运行时数据主要在：

```text
backend/data/
```

常见内容：

- `backend/data/sqlite.db`：SQLite 主数据库，WAL 模式下会附带 `sqlite.db-shm` / `sqlite.db-wal` 两个文件。
- `backend/data/media/`：不属于某个项目的通用图片、视频、上传文件。
- `backend/data/projects/`：每个项目自己的媒体目录。
- `backend/data/logs/`：后端请求日志与审计日志。

## SQLite 数据

所有业务实体统一存放在一份 SQLite 数据库中。表结构与字段定义集中在：

```text
backend/src/storage/schema.ts
```

实体按业务域拆表，例如：

- `scripts` / `script_documents`：剧本与剧本文档。
- `project_storyboards` / `project_clips`：分镜与剪辑清单。
- `characters` / `scenes` / `props`：角色、场景、道具工厂。
- `image_tasks` / `video_tasks`：图片与视频生成任务。
- `conversations` / `messages`：聊天会话与消息。
- `favorites`：收藏记录。
- `work_items`：统一工作项（任务 / 问题 / 评审 / 里程碑）。
- `settings`：应用设置（KV 形式存于同一份数据库）。

`scripts` / `project_assets` / `project_reviews` 等表同时被 Path A（`Script`/`Asset`/`Review`）和 Path B（`ProjectScript`/`ProjectAsset`/`ProjectReview`）共用——通过 `id` 主键保持一致。

## 项目目录

新建项目时，可以选择：

- `新建空白项目`：后端自动生成一个项目目录。
- `使用现有文件夹`：输入一个相对目录名，后端在 `backend/data/projects/` 下创建或复用它。

项目目录结构：

```text
backend/data/projects/{项目目录}/
  media/
    images/
    videos/
  uploads/
```

项目记录里有两个字段：

- `storage_path`：项目目录相对路径。
- `storage_mode`：`managed` 表示系统创建，`existing` 表示使用现有目录名。

## 图片和视频

普通媒体 URL：

```text
/media/images/...
/media/videos/...
```

项目媒体 URL：

```text
/project-media/{projectId}/images/...
/project-media/{projectId}/videos/...
```

当图片或视频属于某个项目下的会话时，后端会优先缓存到该项目的 `media` 目录中。

## 用户下载导出

业务仍然允许把分镜表、剪辑清单导出为 CSV 文件供 Excel / 剪辑团队使用，这些 CSV 是用户下载的产物，**不是存储介质**：

- `GET /api/projects/:id/exports/storyboards.csv`
- `GET /api/projects/:id/exports/edit-list.csv`

编码逻辑封装在 `backend/src/storage/csv-export.ts`，遵循 RFC 4180。

## 删除规则

删除历史会话时，会删除：

- 这个会话的消息记录。
- 这个会话的图片任务记录。
- 这个会话的视频任务记录。
- 指向这些图片/视频任务的收藏记录。

注意：如果后续要做"彻底删除物理文件"，需要在删除任务时同时清理 `media` 下的文件。当前重点是保证记录归属和页面不再展示。
