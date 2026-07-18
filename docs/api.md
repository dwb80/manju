# 实际 API 接口说明

> 基线日期：2026-07-18。本文记录当前代码中的接口族；详细字段以 TypeScript 类型、路由实现和自动化测试为准。

后端默认地址为 `http://127.0.0.1:3000`。除聊天 SSE、上传和媒体流外，成功响应通常为：

```json
{ "code": 0, "message": "ok", "data": {} }
```

业务失败通常返回非零 `code`；未处理的服务端错误返回通用消息与 `traceId`，不向客户端暴露内部异常。JSON 请求体默认上限为 1 MiB，超限返回 HTTP 413；未知浏览器 Origin 返回 HTTP 403。

## 安全与兼容约定

- 默认仅监听 `127.0.0.1`；允许的浏览器来源由 `CORS_ALLOWED_ORIGINS` 配置。
- `AUTH_MODE=required` 时启用登录、服务端会话、CSRF、三级 RBAC 和项目可见性强制；未登录返回 401，越权返回 403。
- `/api/admin/*`、`/api/settings` 和 `/api/logs` 仅管理员可访问。
- 模型列表和详情会移除 `Authorization`、`api-key` 等敏感头，仅返回 `secret_configured`。
- 模型更新时未传敏感头表示保留服务端已有密钥，客户端不能读取明文。
- `POST /api/chat` 返回 `text/event-stream`，不是 JSON。
- 视频是异步任务；状态为 `pending/processing/success/failed`。

## 接口族总览

| 领域 | 主要接口 | 说明 |
|---|---|---|
| 健康 | `GET /api/health` | 服务状态与非敏感运行配置 |
| 身份与用户 | `/api/auth/login`、`/me`、`/logout`、`/change-password`、`/users`、`/users/:id`、`/users/:id/reset-password` | 登录、本人改密及管理员用户管理 |
| 项目 | `/api/projects`、`/api/projects/:id/*` | 项目 CRUD、摘要、资产、成员、任务、里程碑等 |
| 剧本 | `/api/script-documents`、`/api/script-episodes`、`/api/script-scenes`、`/api/script-dialogues`、`/api/script-comments`、`/api/versions` | 结构化剧本、评论与版本 |
| AI 剧本 | `POST /api/ai/script-analyze`、`/api/ai/script-generate`、`/api/ai/script-optimize` | 分析、生成、优化；失败保持真实失败态 |
| 会话 | `/api/conversations`、`/api/conversations/:id/messages` | 会话 CRUD、项目归属和消息历史 |
| 聊天 | `POST /api/chat`、`/api/chat/stop`、`/api/chat/regenerate` | SSE 聊天、停止和重新生成 |
| 图片 | `POST /api/images/generate`、`POST /api/images/local`、`GET /api/images`、`GET/DELETE /api/images/:id` | 图片生成、落库和任务管理 |
| 视频 | `POST /api/videos/generate`、`GET /api/videos`、`GET/DELETE /api/videos/:id` | 异步视频任务 |
| 工厂资产 | `/api/characters`、`/api/scenes`、`/api/props`、`/api/storyboards`、`/api/audios`、`/api/module-videos`、`/api/clips` | 角色、场景、道具、分镜、音视频和剪辑 CRUD |
| 图片历史 | `/api/character-image-history`、`/api/scene-image-history`、`/api/prop-image-history` | 历史图、应用/取消应用、清理 |
| 审核 | `GET/POST /api/reviews`、`GET /api/reviews/stats`、`POST /api/reviews/:id/approve`、`/reject` | 审核队列和状态流 |
| 发布准备 | `GET /api/publish/videos`、`GET/POST /api/publish/plans`、`PUT/DELETE /api/publish/plans/:id` | 成片和发布计划；不等于第三方自动发布 |
| 数据 | `/api/data/metrics`、`/api/data/ai-cost`、`/api/data/production-efficiency`、`/api/data/project-overview` | 指标、AI 成本、效率和项目概览 |
| 模型 | `GET/POST /api/models`、`GET/PUT/DELETE /api/models/:id`、默认/启停操作 | Provider 配置和模型治理基础能力 |
| AI 任务 | `GET /api/ai/tasks`、`POST /api/ai/tasks/cancel`、`/retry` | 统一任务监控、取消和重试 |
| 流程 | `GET /api/pipeline/stages` 及项目流程接口 | 生产阶段和状态 |
| 系统管理 | `/api/admin/sensitive-words`、`/platform-templates`、`/audit-logs`、`/project-permissions` | 管理员专用的平台配置与项目权限 |
| 其他 | `/api/favorites`、`/api/todos`、`/api/settings`、`/api/logs`、`/api/client-logs` | 收藏、待办、设置和日志 |
| 文件 | `POST /api/uploads`、`GET /media/*`、`GET /project-media/:projectId/*` | 上传与本地媒体访问 |

## 核心请求示例

创建项目：

```json
{ "name": "短剧项目", "storage_mode": "existing", "storage_path": "client-a/short-video" }
```

创建项目会话：

```json
{ "title": "第一集创作", "project_id": "p-xxx" }
```

生成图片：

```json
{
  "conversationId": "c-xxx",
  "prompt": "古风人物在雨夜长街回望",
  "images": ["/media/uploads/reference.png"],
  "ratio": "9:16",
  "n": 2
}
```

创建视频任务：

```json
{ "conversationId": "c-xxx", "prompt": "镜头缓慢推进，人物抬头", "seconds": "5" }
```

## 错误处理

前端应同时判断 HTTP 状态和响应 `code`，展示 `message`，并在报障时记录响应中的 `traceId`。AI 生成失败不得用占位内容伪装为成功资产；视频任务应轮询至终态，并为失败提供明确重试入口。
