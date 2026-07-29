# 实际 API 接口说明

> **领域归属**：[跨上下文协作契约](../domain/05-contracts.md) + 10 个上下文文件（按 API 分组对应）

> **权威来源声明**：产品目标以 [02-requirements-and-acceptance.md §5.6](../requirements/02-requirements-and-acceptance.md#56-核心接口契约) 为准；当前可调用接口以运行时生成并经 CI 校验的 OpenAPI 为准。在 OpenAPI 门禁完成前，本文档、路由实现和自动化测试共同描述现状，任何差异必须登记到 [implementation/02-feature-status.md](../implementation/02-feature-status.md)，不得用目标需求冒充已实现接口。

后端默认地址为 `http://127.0.0.1:3000`。除对话会话 SSE、上传和媒体流外，成功响应通常为：

```json
{ "code": 0, "message": "ok", "data": {} }
```

业务失败通常返回非零 `code`；未处理的服务端错误返回通用消息与 `traceId`，不向客户端暴露内部异常。JSON 请求体默认上限为 1 MiB，超限返回 HTTP 413；未知浏览器 Origin 返回 HTTP 403。

## 安全与兼容约定

- 默认仅监听 `127.0.0.1`；允许的浏览器来源由 `CORS_ALLOWED_ORIGINS` 配置
- `AUTH_MODE=required` 时启用登录、服务端会话、CSRF、三级 RBAC 和项目可见性强制；未登录返回 401，越权返回 403
- `/api/admin/*`、`/api/settings` 和 `/api/logs` 仅管理员可访问
- 模型列表和详情会移除 `Authorization`、`api-key` 等敏感头，仅返回 `secret_configured`
- 模型更新时未传敏感头表示保留服务端已有密钥，客户端不能读取明文
- `POST /api/chat` 返回 `text/event-stream`，不是 JSON
- 视频是异步任务；状态为 `pending / processing / success / failed`（实际代码值，对应 [03-glossary.md](../domain/03-glossary.md) 领域术语映射：`pending` → 排队中 `queued`、`processing` → 生成中 `generating`、`success` → 已完成 `completed`、`failed` → 已失败 `failed`）

## 分页规范

所有返回列表的查询接口统一采用 **基于页码的分页（page-based pagination）**，不使用 cursor/offset 游标分页。

### 请求参数

| 参数 | 类型 | 默认值 | 约束 | 说明 |
|------|------|--------|------|------|
| `page` | integer | `1` | ≥ 1 | 页码，从 1 开始计数 |
| `pageSize` | integer | `20` | 1 ≤ n ≤ 100 | 每页条数；服务端对上限做 clamp，超限自动截断为 100 |

> **命名约定**：查询参数沿用项目统一的 **camelCase** 风格（与 `projectId`、`conversationId`、`publishStatus` 等现有参数一致），故使用 `pageSize` 而非 `page_size`。分页参数通过 URL query string 传递，例如 `GET /api/ai/tasks?page=2&pageSize=20`。

### 响应结构

列表查询的标准响应在 `data` 中同时返回**数据数组**与**分页元数据**：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "items": [],
    "total": 156,
    "page": 2,
    "pageSize": 20,
    "hasMore": false
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `items` | array | 当前页数据数组（数组键名可按资源语义命名，如 `tasks`、`characters`，等价于 `items`） |
| `total` | integer | 满足筛选条件的**总记录数**，用于前端计算总页数 |
| `page` | integer | 当前页码（回显请求值或 clamp 后的实际值） |
| `pageSize` | integer | 当前每页条数（回显请求值或 clamp 后的实际值） |
| `hasMore` | boolean | 是否还有下一页（`page * pageSize < total` 时为 `true`），前端可据此控制"加载更多"按钮 |

> `total` 与 `hasMore` 二者均返回，便于不同前端交互模式（分页器 vs 无限滚动）直接使用，无需重复计算。

### 与当前实现的对齐说明

当前代码库的分页实现存在两种模式，正在向上述统一规范迁移：

| 模式 | 参考实现 | 参数 | 响应元数据 | 状态 |
|------|---------|------|-----------|------|
| 标准分页（目标） | `GET /api/ai/tasks`（`ai-tasks-router.ts`） | `page` + `pageSize` | `total` + `page` + `pageSize` | 已对齐，**缺少 `hasMore`** 待补充 |
| 仅 limit（遗留） | `GET /api/final-videos`、`GET /api/logs` 等（`router.ts`、`final-videos-router.ts` 等） | `limit`（无 page） | 无分页元数据，仅返回数组 | 待迁移 |

**迁移原则**：
1. 新增列表端点必须采用标准分页（`page` + `pageSize`，响应含 `total` / `hasMore`）
2. 遗留 `limit` 端点在后续迭代中逐步补充分页元数据；迁移期间 `limit` 参数保持向后兼容
3. 数据量确定较小的字典/配置类接口（如模型列表、平台模板）可不分页，直接返回全量数组

## 版本管理策略

API 采用 **URL 路径版本管理（URI path versioning）**，通过路径中的版本段区分 API 大版本。

### 版本规则

| 路径形态 | 含义 | 示例 |
|---------|------|------|
| `/api/v1/...` | 显式版本路径，**新增端点的推荐形式** | `/api/v1/projects` |
| `/api/...`（无版本段） | 隐式 v1，当前历史端点的遗留形态 | `/api/projects` |

- **当前状态**：现有端点均位于 `/api/` 下，未携带版本段，语义上等同于 `v1`。这是历史实现，短期内保持不变以保证向后兼容。
- **版本变更规则**：仅**不兼容变更（breaking change）**才递增主版本号。兼容性变更（新增字段、新增可选参数、新增端点）不递增版本号。
- **未来演进**：当需要引入不兼容变更时，新版本端点使用 `/api/v2/...` 路径，旧版本 `/api/v1/...`（及无版本段的遗留路径）在过渡期内保持可用，直至废弃。
- **版本与契约路径的关系**：[requirements §5.6](../requirements/02-requirements-and-acceptance.md#56-核心接口契约) 定义的契约路径为权威目标；版本段叠加在契约路径之上，迁移时一并补齐版本段（如 `POST /api/v1/episodes/{id}/scripts`）。

> **不采用 Header 版本**：Header 版本（如 `Accept: application/vnd.api+json;version=1`）对浏览器侧调试和缓存不友好，且本项目的 API 面向本地单机部署的 Web 前端，路径版本更直观、更易调试。

## 接口族总览（按限界上下文分组）

### 项目管控上下文

| 主要接口 | 说明 |
|---|---|
| `/api/projects`、`/api/projects/:id/*` | 项目 CRUD、摘要、资产、团队成员、任务、里程碑等 |

### 剧本创作上下文

| 主要接口 | 说明 |
|---|---|
| `/api/script-documents`、`/api/script-episodes`、`/api/script-scenes`、`/api/script-dialogues`、`/api/script-comments`、`/api/versions` | 结构化剧本、评论与版本。契约路径见 [§5.1.3](../requirements/02-requirements-and-acceptance.md#513-post-apiepisodesidscripts) |
| `POST /api/ai/script-analyze`、`/api/ai/script-generate`、`/api/ai/script-optimize` | 分析、生成、优化；失败保持真实失败态。契约路径见 [§5.1.4](../requirements/02-requirements-and-acceptance.md#514-post-apiscriptsidanalyze) |

### 智能助手上下文

| 主要接口 | 说明 |
|---|---|
| `/api/conversations`、`/api/conversations/:id/messages` | 会话 CRUD、项目归属和消息历史 |
| `POST /api/chat`、`/api/chat/stop`、`/api/chat/regenerate` | SSE 对话会话、停止和重新生成 |

### AI 任务调度上下文

| 主要接口 | 说明 |
|---|---|
| `POST /api/images/generate`、`POST /api/images/local`、`GET /api/images`、`GET/DELETE /api/images/:id` | 图片生成、落库和任务管理 |
| `POST /api/videos/generate`、`GET /api/videos`、`GET/DELETE /api/videos/:id` | 异步视频任务 |
| `GET /api/ai/tasks`、`POST /api/ai/tasks/cancel`、`/retry` | 统一任务监控、取消和重试 |
| `GET/POST /api/models`、`GET/PUT/DELETE /api/models/:id`、默认/启停操作 | Provider 配置和模型治理基础能力 |
| `GET /api/pipeline/stages` 及项目流程接口 | 生产阶段和状态 |

### 资产库上下文

| 主要接口 | 说明 |
|---|---|
| `/api/characters`、`/api/scenes`、`/api/props` | 角色、场景、道具 CRUD。契约路径见 [§5.1.7](../requirements/02-requirements-and-acceptance.md#517-post-apiprojectsidcharacters)、[§5.1.8](../requirements/02-requirements-and-acceptance.md#518-post-apiprojectsidscenes) |
| `/api/characters/:id/images`、`/api/scenes/:id/images`、`/api/props/:id/images` | 每个实体的多视图图片：GET（按景别/角度/视图类型筛选）/ POST / PATCH / DELETE / PUT primary / POST apply（标记为资产）。完整契约见 [04-factories-assets-and-image-views.md](../requirements/modules/04-factories-assets-and-image-views.md) |
| `/api/character-image-history`、`/api/scene-image-history`、`/api/prop-image-history` | 历史图、应用/取消应用、清理。POST 入参支持 `shot_type` / `angle` / `view_type` 三维字段；`view_type` 表情类使用 `expression:<name>` 命名空间避免与 `costume/overall/single` 冲突 |
| `/api/storyboards`、`/api/clips` | 分镜板与剪辑片段 |

### 审核质量上下文

| 主要接口 | 说明 |
|---|---|
| `GET/POST /api/reviews`、`GET /api/reviews/stats`、`POST /api/reviews/:id/approve`、`/reject` | 审核队列和状态流。契约路径见 [§5.1.11](../requirements/02-requirements-and-acceptance.md#511-post-apireviews)、[§5.1.12](../requirements/02-requirements-and-acceptance.md#512-put-apireviewsid) |

### 发布交付上下文

| 主要接口 | 说明 |
|---|---|
| `/api/final-videos` | 成片 CRUD（受质检与 Review 门禁） |
| `/api/publish/videos`、`GET/POST /api/publish/plans`、`PUT/DELETE /api/publish/plans/:id` | 成片和发布计划；不等于第三方自动发布。契约路径见 [§5.1.20](../requirements/02-requirements-and-acceptance.md#520-post-apipublish-plans)、[§5.1.21](../requirements/02-requirements-and-acceptance.md#521-post-apipublish-plansidexecute) |

### AI 任务调度上下文 — Prompt 模板

| 主要接口 | 说明 |
|---|---|
| `/api/prompt-templates` | Prompt 模板 CRUD、版本管理 |

### AI 任务调度上下文 — 数据集与指标

| 主要接口 | 说明 |
|---|---|
| `/api/datasets` | 数据集导入、导出、清理 |
| `/api/data/metrics`、`/api/data/ai-cost`、`/api/data/production-efficiency`、`/api/data/project-overview` | 指标、AI 成本、效率和项目概览 |

### 系统管理

| 主要接口 | 说明 |
|---|---|
| `/api/admin/sensitive-words`、`/platform-templates`、`/audit-logs`、`/project-permissions` | 管理员专用的平台配置与项目权限 |
| `/api/favorites`、`/api/work-items`、`/api/settings`、`/api/logs`、`/api/client-logs` | 收藏、工作项、设置和日志 |
| `/api/uploads`、`GET /media/*`、`GET /project-media/:projectId/*` | 上传与本地媒体访问 |

### 健康与身份

| 主要接口 | 说明 |
|---|---|
| `GET /api/health` | 服务状态与非敏感运行配置 |
| `/api/auth/login`、`/me`、`/logout`、`/change-password`、`/users`、`/users/:id`、`/users/:id/reset-password` | 登录、本人改密及管理员用户管理 |

## 契约对齐说明

> 以下列出当前实际实现路径与 [requirements §5.6](../requirements/02-requirements-and-acceptance.md#56-核心接口契约) 契约路径的差异。**契约路径为权威目标**，实际实现的迁移状态见 [implementation/02-feature-status.md](../implementation/02-feature-status.md)。

| 资源 | 契约路径（requirements 权威） | 当前实际实现路径 | 差异说明 |
|------|------|------|------|
| 剧本文档 | `POST /api/episodes/{id}/scripts` | `POST /api/script-documents`（按 `episodeId` 查询参数关联） | 实际实现使用扁平资源路径，契约要求嵌套到 episode 下 |
| 剧本分析 | `POST /api/scripts/{id}/analyze` | `POST /api/ai/script-analyze`（按 `scriptId` 请求体关联） | 实际实现放在 `/api/ai/` 前缀下，契约要求嵌套到 script 下 |
| 剧本生成/优化 | `POST /api/scripts/{id}/creation-tasks` | `POST /api/ai/script-generate`、`POST /api/ai/script-optimize` | 契约已定义为 `creation-tasks` 统一端点，实际实现拆分为 `script-generate` 和 `script-optimize` 两个独立端点；需迁移至契约路径，旧端点兼容期保留 |
| 角色资产 | `POST /api/projects/{id}/characters` | `POST /api/characters`（按 `projectId` 查询参数关联） | 实际实现使用扁平路径，契约要求嵌套到 project 下 |
| 场景资产 | `POST /api/projects/{id}/scenes` | `POST /api/scenes`（按 `projectId` 查询参数关联） | 同上 |
| 道具资产 | `POST /api/projects/{id}/props`（隐含） | `POST /api/props`（按 `projectId` 查询参数关联） | 同上 |
| 审核决策 | `PUT /api/reviews/{id}`（请求体携带 `decision` 字段） | `POST /api/reviews/:id/approve`、`POST /api/reviews/:id/reject` | 实际实现拆分为独立端点，契约使用统一 PUT + decision 字段 |
| 图片任务查询 | `GET /api/images/tasks/{id}` | `GET /api/images/:id` | 实际实现省略 `/tasks/` 中间段 |
| 视频任务查询 | `GET /api/videos/tasks/{id}` | `GET /api/videos/:id` | 同上 |
| 发布计划 | `POST /api/publish-plans`、`POST /api/publish-plans/{id}/execute` | `POST /api/publish/plans`、`PUT /api/publish/plans/:id`（无 execute 子路径） | 实际实现使用 `/api/publish/plans` 路径，契约使用连字符 `/api/publish-plans` |
| 工作项（任务/问题/里程碑） | `POST /api/projects/{id}/tasks`、`POST /api/projects/{id}/issues`、`POST /api/projects/{id}/milestones` | `GET/POST /api/work-items`（统一工作项表，按 `type` 区分） | 实际实现合并为统一工作项端点，契约按类型拆分到 project 子路径 |
| 剪辑片段 | `POST /api/projects/{id}/clips`、`GET /api/projects/{id}/clips` | `POST /api/clips`、`GET /api/clips` | 实际实现使用扁平路径，契约要求嵌套到 project 下 |

**对齐原则**：
1. 新增端点必须遵循 requirements §5.6 契约路径
2. 上述差异端点在后续迭代中逐步迁移至契约路径
3. 迁移期间保持向后兼容（旧路径不立即移除）
4. 迁移完成后更新本文档移除差异条目

## 核心请求示例

### 创建项目

```json
{ "name": "短剧项目", "storage_mode": "existing", "storage_path": "client-a/short-video" }
```

### 创建项目会话

```json
{ "title": "第一集创作", "project_id": "p-xxx" }
```

### 生成图片

请求：

```json
{
  "conversationId": "c-xxx",
  "prompt": "古风人物在雨夜长街回望",
  "images": ["/media/uploads/reference.png"],
  "ratio": "9:16",
  "n": 2
}
```

响应（标准 envelope）：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "imageUrls": ["https://cdn.../img-1.png", "https://cdn.../img-2.png"],
    "requestId": "agn-abc123"
  }
}
```

- `imageUrls`：成功图片 URL 列表（按入参顺序）
- `requestId`：顶层字段，与 `providerMeta.requestId` 同源。`n>1` 时取成功集**第一个**的 requestId（与"主图 = 第 1 张"对齐）。厂商未返回时为 `undefined`
- 超时默认值：单次生图 **180s**（`utils.ts:282` 的 `AI_TIMEOUTS.generateImage`，可由 `AGNES_TIMEOUT_GENERATE_IMAGE_MS` 环境变量覆盖）

### 创建视频任务

```json
{ "conversationId": "c-xxx", "prompt": "镜头缓慢推进，人物抬头", "seconds": "5" }
```

## 错误处理

前端应同时判断 HTTP 状态和响应 `code`，展示 `message`，并在报障时记录响应中的 `traceId`。AI 生成失败不得用占位内容伪装为成功资产；视频任务应轮询至终态，并为失败提供明确重试入口。
