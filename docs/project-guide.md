# 项目结构

这份文档面向第一次看项目的人，先帮你知道“每个目录是干什么的”。

## 根目录

- `README.md`：项目入口说明。
- `start-all.bat`：同时启动前端和后端。
- `start-backend.bat`：只启动后端。
- `start-frontend.bat`：只启动前端。
- `backend/`：后端代码和本地数据。
- `frontend/`：前端页面代码。
- `docs/`：设计、接口、存储和开发说明。
- `scripts/`：清理缓存、测试辅助等脚本。

## 后端目录

- `backend/src/http/router.ts`：HTTP 入口，所有 API 路由从这里进来。
- `backend/src/services/domain.ts`：核心业务逻辑，例如创建会话、生成图片、生成视频、项目管理。
- `backend/src/services/media.ts`：图片/视频下载缓存、上传图片保存、本地媒体读取。
- `backend/src/services/app.ts`：创建后端运行上下文，把 AI 客户端、SQLite 仓库、配置组装在一起。
- `backend/src/ai/agnes-client.ts`：Agnes 官方接口适配层。
- `backend/src/storage/sqlite.ts`：基于 `node:sqlite` 的仓储实现，提供 `SqliteRepository<T>` 与 `SqliteSettingsRepository<T>`。
- `backend/src/storage/schema.ts`：每张业务表有哪些字段，统一在 `FieldSpec<T>` 中声明。
- `backend/src/types.ts`：后端核心数据类型。
- `backend/data/`：运行时数据目录，保存会话、图片、视频、日志。
- `backend/tests/`：后端测试。

## 前端目录

- `frontend/app/page.tsx`：主对话页面，包含聊天、图片、视频、收藏、项目列表。
- `frontend/app/images/[id]/page.tsx`：图片详情页。
- `frontend/app/videos/[id]/page.tsx`：视频详情页。
- `frontend/app/globals.css`：全局样式。
- `frontend/components/ui/`：基础 UI 组件。
- `frontend/tests/e2e/`：端到端测试。

## 先从哪里读代码

建议顺序：

1. `README.md`：知道怎么运行。
2. `docs/storage.md`：知道数据放哪里。
3. `backend/src/types.ts`：知道系统有哪些核心对象。
4. `backend/src/http/router.ts`：知道接口怎么进来。
5. `backend/src/services/domain.ts`：知道具体业务怎么做。
6. `frontend/app/page.tsx`：知道页面怎么调用接口。
