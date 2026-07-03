# 数据和文件保存位置

Agnes AI Studio 当前使用本地文件保存数据，不依赖数据库。这样方便查看、备份和迁移。

## 总览

运行时数据主要在：

```text
backend/data/
```

常见目录：

- `backend/data/csv/`：会话、消息、图片任务、视频任务、收藏、项目等 CSV 数据。
- `backend/data/media/`：不属于某个项目的通用图片、视频、上传文件。
- `backend/data/projects/`：每个项目自己的存储目录。
- `backend/data/logs/`：后端请求日志。

## CSV 数据

CSV 按实体和日期拆分，例如：

```text
backend/data/csv/conversations/conversations_2026-07-02.csv
backend/data/csv/messages/messages_2026-07-02.csv
backend/data/csv/image_tasks/image_tasks_2026-07-02.csv
backend/data/csv/video_tasks/video_tasks_2026-07-02.csv
backend/data/csv/projects/projects_2026-07-02.csv
```

每一类数据都有固定字段，字段定义在：

```text
backend/src/storage/schema.ts
```

## 项目目录

新建项目时，可以选择：

- `新建空白项目`：后端自动生成一个项目目录。
- `使用现有文件夹`：输入一个相对目录名，后端在 `backend/data/projects/` 下创建或复用它。

项目目录结构：

```text
backend/data/projects/{项目目录}/
  csv/
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

## 删除规则

删除历史会话时，会删除：

- 这个会话的消息记录。
- 这个会话的图片任务记录。
- 这个会话的视频任务记录。
- 指向这些图片/视频任务的收藏记录。

注意：如果后续要做“彻底删除物理文件”，需要在删除任务时同时清理 `media` 下的文件。当前重点是保证记录归属和页面不再展示。
