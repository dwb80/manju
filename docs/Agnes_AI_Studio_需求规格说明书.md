# Agnes AI Studio 详细需求规格说明书

> 版本：v1.3
> 文档状态：待评审
> 最后更新：2026-07-12
> 适用阶段：MVP + V2 全量规划
> **v1.3 变更**：持久化存储统一为 **SQLite（`backend/data/sqlite.db`）**，状态机收敛到 `work_items`，新增 `app_logs` 审计日志。

---

## 0. 文档说明

本文档基于产品初始构想（参考 `xuqiu.txt`）进行结构化、规范化整理，输出符合 IEEE 830 / BABOK 标准的可执行需求规格说明书（SRS），用于指导开发、测试、设计与项目管理。

**阅读对象**：产品经理、研发、测试、UI/UX 设计师、运维、项目经理。

**术语约定**：
- **MUST**：强制需求，缺失则产品不可用。
- **SHOULD**：建议需求，强烈推荐实现。
- **MAY**：可选需求，根据资源情况决定。

---

## 1. 项目概述

### 1.1 项目名称
**Agnes AI Studio**

### 1.2 一句话定位
对标 **ChatGPT + Midjourney + Runway** 的一站式 AI 创作平台，集成聊天、图片生成、视频生成三大核心能力。

### 1.3 项目目标
1. 提供基于 Agnes AI 官方 API 的统一 AI 创作入口。
2. 支持多模态（文本/图片/视频）输入输出与多轮上下文交互。
3. 提供完整的会话管理、历史回溯、收藏能力。
4. 打造轻量、可本地运行的个人 AI 创作工具。

### 1.4 项目范围
**范围内（In Scope）**：
- Web 端（PC 优先，响应式适配移动端）。
- 会话系统、内容生成。
- 三大核心能力：聊天（Agnes 2.0 Flash）、图片生成（Agnes Image 2.1 Flash）、视频生成（Agnes Video V2.0）。

**范围外（Out of Scope）**：
- 登录/注册、用户管理、RBAC 权限系统。
- 移动原生 App（iOS/Android）。
- 第三方开放平台 API 接入（仅作为 V3 阶段考虑）。
- 离线模型部署。

### 1.5 业务价值
- **个人用户**：降低 AI 创作门槛，提升创作效率，一站式完成聊天、生图、生视频。

---

## 2. 业务背景与目标


### 2.2 业务目标（SMART）
| 目标 | 指标 | 衡量方式 |
|------|------|----------|
| 完成 MVP | 1.0 版本功能可用 | 全部 P0 需求通过验收 |
| 系统可用性 | SLA ≥ 99.5% | 监控告警 |

### 2.3 成功标准
- MVP 版本全部 P0 需求通过验收测试。
- 系统可承载 ≥ 100 并发（个人本地使用）。

---

## 3. 用户角色与场景

### 3.1 用户角色定义

> 本项目为个人本地使用，不区分用户角色，无需登录。所有功能对单一用户完全开放。

### 3.2 用户画像

**画像 A：个人创作者**
- 25-40 岁，自媒体人/设计师/产品经理。
- 痛点：跨平台协作成本高，AI 工具分散。
- 需求：聊天生成脚本 → 一键生成封面图 → 转换为短视频。

### 3.3 典型用户故事（User Stories）

| ID | 作为 | 我想要 | 以便 | 优先级 |
|----|------|--------|------|--------|
| US-003 | 用户 | 与 AI 进行多轮对话 | 完成复杂任务 | P0 |
| US-004 | 用户 | 流式查看 AI 回复 | 实时看到生成过程 | P0 |
| US-005 | 用户 | 停止/继续/重新生成回答 | 灵活控制交互 | P0 |
| US-006 | 用户 | 输入 Prompt 生成图片 | 创作视觉内容 | P0 |
| US-007 | 用户 | 调整图片参数（尺寸、Seed 等） | 控制生成效果 | P0 |
| US-008 | 用户 | 输入 Prompt 生成视频 | 创作视频内容 | P0 |
| US-009 | 用户 | 上传图片生成视频 | 实现图生视频 | P0 |
| US-010 | 用户 | 查看聊天/图片/视频历史 | 回溯过往内容 | P0 |
| US-011 | 用户 | 收藏/置顶/重命名会话 | 高效管理 | P0 |
| US-012 | 用户 | 上传图片供聊天识别 | 实现多模态交互 | P1 |
| US-013 | 用户 | 上传文件供 AI 解析 | 处理文档任务 | P1 |
| US-017 | 用户 | 自定义主题/语言/默认参数 | 个性化体验 | P2 |

---

## 4. 功能需求

#### 4.1.6 RBAC

> 本项目为个人使用，无需 RBAC 权限系统。

---

### 4.2 聊天模块（P0）

#### 4.2.1 会话管理
- **创建会话**：首次进入自动创建；可手动新建。
- **会话列表**：按更新时间倒序展示。
- **支持操作**：搜索、删除、重命名、置顶、导出。
- **存储字段**：`id, title, model, is_pinned, created_at, updated_at`。
> 无需 user_id，个人使用不分用户。

#### 4.2.2 消息管理
- **消息类型**：`user` / `assistant` / `system`。
- **内容格式**：Markdown、Latex、Mermaid、代码高亮。
- **支持操作**：复制、编辑、删除、重新生成、点赞、点踩。
- **多模态**：图片预览、视频预览、文件附件。

#### 4.2.3 流式输出（SSE）
- **协议**：Server-Sent Events。
- **首字节响应**：< 1s。
- **可中断**：客户端断开 → 后端停止调用。
- **断点续传**：记录已接收的 token 位置。

#### 4.2.4 上下文管理
- **滑动窗口**：默认保留最近 20 轮 + 系统提示。
- **Token 统计**：每条消息显示 token 数。
- **模型选择**：Agnes 2.0 Flash（MVP），未来扩展 GPT-4/Claude。

#### 4.2.5 输入能力
- 文本输入、Enter 发送、Shift+Enter 换行。
- 图片上传（拖拽 + 点击）。
- 文件上传（PDF/TXT/MD 等）。
- 快捷指令（`/clear`、`/system` 等）。

#### 4.2.6 高级控制
- 停止生成：调用方主动 cancel。
- 继续生成：从截断位置续写。
- 重新生成：清除最新 assistant 消息后重发。

#### 4.2.7 性能与体验
- 渲染：Markdown 实时解析、代码高亮（highlight.js / shiki）。
- Skeleton：消息流加载占位。
- 暗黑模式自适应。

---

### 4.3 图片生成模块（P0）

#### 4.3.1 输入参数
| 参数 | 类型 | 必填 | 默认 | 说明 |
|------|------|------|------|------|
| prompt | string | 是 | - | 提示词 |
| negative_prompt | string | 否 | - | 反向提示词 |
| size | enum | 否 | 1024x1024 | 512/1024/2048 |
| ratio | enum | 否 | 1:1 | 1:1/3:2/2:3/16:9/9:16 |
| n | int | 否 | 1 | 1-4 |
| seed | int | 否 | -1 | -1 为随机 |
| steps | int | 否 | 25 | 1-50 |
| cfg | float | 否 | 7 | 1-20 |

#### 4.3.2 输出展示
- 瀑布流布局。
- 加载 Skeleton。
- 操作：放大预览、下载、删除、收藏、继续编辑、重新生成。

#### 4.3.3 历史记录
- 字段：`id, user_id, prompt, params, image_urls, status, created_at`。
- 支持按时间/参数筛选。

#### 4.3.4 继续编辑
- 在图片基础上再次发起生成（保留原参数 + 新 prompt）。

---

### 4.4 视频生成模块（P0）

#### 4.4.1 输入参数
| 参数 | 类型 | 必填 | 默认 | 说明 |
|------|------|------|------|------|
| prompt | string | 是 | - | 提示词 |
| image | file/url | 否 | - | 图生视频 |
| ratio | enum | 否 | 16:9 | 16:9/9:16/1:1 |
| duration | int | 否 | 5 | 5/10 秒 |
| model | string | 否 | agnes-video-v20 | 模型选择 |

#### 4.4.2 异步任务
- 提交后返回 `task_id`。
- 任务状态：`pending` / `processing` / `success` / `failed`。
- 轮询策略：客户端每 3 秒查询一次，最多 5 分钟；超时后切换为长轮询/Webhook。
- 自动刷新：列表自动重新获取。

#### 4.4.3 视频操作
- 在线播放、下载、删除、收藏。
- 失败重试：消耗配额不变，提示错误原因。

---

### 4.5 历史记录与收藏（P0）

#### 4.5.1 聊天历史
- 列表 + 详情页（点击恢复会话）。

#### 4.5.2 图片历史
- 网格 + 详情。

#### 4.5.3 视频历史
- 列表 + 任务状态。

#### 4.5.4 收藏
- 跨模块统一收藏夹。
- 字段：`id, user_id, type, ref_id, created_at`。

---

### 4.6 用户中心（P0）

> 本项目为个人使用，无需用户中心模块。API Key 等配置直接写入本地配置文件或环境变量。

---

### 4.7 设置（P1）

| 设置项 | 类型 | 默认 |
|--------|------|------|
| 主题 | 浅色/深色/跟随系统 | 跟随系统 |
| 语言 | zh-CN/en-US | zh-CN |
| 字体大小 | 小/中/大 | 中 |
| 默认聊天模型 | enum | Agnes 2.0 Flash |
| 默认图片尺寸 | enum | 1024x1024 |
| 默认视频比例 | enum | 16:9 |

---

### 4.8 后台管理（P1）

> 本项目为个人使用，无需后台管理模块。

---

## 5. 非功能需求

### 5.1 性能
- 页面首屏 < 2s（4G）。
- API P95 响应 < 500ms（不含 AI 调用）。
- AI 流式首字节 < 1s。
- 并发支持 ≥ 1,000。

### 5.2 可用性
- SLA ≥ 99.5%。
- 7x24 小时运行，RTO < 30min，RPO < 5min。

### 5.3 安全
- RBAC。
- 接口签名（防重放）。
- Rate Limit（IP + User 维度）。
- XSS 过滤、CSRF Token、SQL 注入防护（参数化语句 + 输入校验）。
- 文件上传类型/大小校验。
- 敏感词过滤。

### 5.4 兼容性
- 浏览器：Chrome/Edge/Safari/Firefox 最近 2 个大版本。
- 屏幕：≥ 1280px 主用，768-1280px 适配，< 768px 提供基础浏览。

### 5.5 可维护性
- 模块化、DDD 分层、依赖注入。
- TypeScript 严格模式，禁止 `any`。
- ESLint + Prettier。
- 单元测试覆盖率 ≥ 70%。

### 5.6 可观测性
- 日志：Request/Response/Error/AI 调用日志。
- 指标：QPS、延迟、错误率、Token 消耗。
- 告警：阈值告警 + 异常告警。
- 链路追踪：OpenTelemetry。

---

## 6. 技术架构

### 6.1 整体架构
```
┌─────────────────────────────────────────────┐
│              Web (Next.js)                  │
│  React19 + TS + Tailwind + ShadcnUI         │
└────────────────┬────────────────────────────┘
                 │ HTTPS / SSE
┌────────────────▼────────────────────────────┐
│         NestJS Backend (Node.js)            │
│  模块：Chat/Image/Video/Setting             │
│  SDK：AgnesClient（统一封装）               │
│  存储：SqliteRepository（统一 SQLite 表）   │
└─────┬──────────┬────────────┬────────────┘
      │          │            │
      ▼          ▼            ▼
  SQLite DB    Redis      Agnes AI
  (单一文件)  (Cache)      APIs
```

### 6.2 前端技术栈
- React 19 / Next.js (App Router)
- TypeScript
- TailwindCSS
- Shadcn UI
- Framer Motion（动效）
- React Query（服务端状态）
- Zustand（客户端状态）
- Axios（HTTP）
- React Hook Form + Zod（表单）
- i18next（国际化）
- highlight.js / shiki（代码高亮）
- mermaid / katex（图表 / 公式）

### 6.3 后端技术栈
- Node.js 20 LTS
- NestJS
- TypeScript
- **SqliteRepository**（基于 Node 24 `node:sqlite` 内置模块，参数化语句、WAL 模式、软删除）
- Swagger
- Winston / Pino（日志）
- Jest（单元测试）

### 6.4 AI SDK 统一封装（AgnesClient）
```ts
class AgnesClient {
  chat(params: ChatParams): AsyncIterable<ChatChunk>;
  generateImage(params: ImageParams): Promise<ImageResult>;
  generateVideo(params: VideoParams): Promise<{ taskId: string }>;
  queryTask(taskId: string): Promise<TaskStatus>;
  uploadFile(file: Buffer): Promise<{ url: string }>;
}
```
**能力**：
- 统一异常处理（重试 / 熔断 / 降级）。
- 统一日志（调用耗时、Token、错误）。
- 统一 Token 统计。
- 自动重试（指数退避，最多 3 次）。
- 超时控制。

---

## 7. 数据存储设计（SQLite 单一数据库）

### 7.1 设计原则
- **存储介质**：单一 SQLite 数据库文件 `backend/data/sqlite.db`（WAL 模式）。
- **引擎**：Node 24 自带 `node:sqlite`，参数化语句避免注入。
- **连接释放**：HTTP server 关闭时调用 `ctx.close()`，释放 SQLite 连接。
- **可移植性**：未来可平滑切换到 MySQL / Postgres，仅需替换 `SqliteRepository<T>` 实现，`Repository<T>` 抽象保持不变。

### 7.2 目录结构
```
/data
├── sqlite.db              # 主数据库
├── sqlite.db-shm          # WAL 共享内存
├── sqlite.db-wal          # WAL 日志
├── media/                 # 通用媒体（图片、视频、上传）
├── projects/              # 每个项目自己的媒体目录
└── logs/                  # 业务日志 + 审计日志
```

### 7.3 Repository 抽象
`backend/src/storage/repository.ts` 提供：
- `Repository<T extends { id: string; created_at: string }>`：标准 CRUD。
- `KeyValueRepository<T>`：设置类实体。
- `FieldSpec<T>`：把领域字段声明为 `string` / `number` / `boolean` / `json` 四种类型，由 `SqliteRepository<T>` 自动建表与读写。

### 7.4 核心业务表
| 表名 | 用途 |
|------|------|
| `projects` | 项目基础信息与本地存储目录 |
| `conversations` | 聊天 / 图片 / 视频生成会话 |
| `messages` | 聊天消息 |
| `project_members` | 项目成员与职责分工 |
| `project_episodes` | 剧集规划 |
| `project_storyboards` | 分镜中心 |
| `project_clips` | 剪辑清单 |
| `project_assets` | 项目资产库（图片 / 视频 / 角色 / 场景 / 风格 / 提示词） |
| `project_versions` | 资产与剧本文档的版本历史 |
| `image_tasks` | 图片生成任务 |
| `video_tasks` | 视频生成任务 |
| `favorites` | 收藏记录 |
| `work_items` | 统一工作项（任务 / 问题 / 评审 / 里程碑，状态机收敛后的唯一表） |
| `app_logs` | 业务审计日志（视频状态变化、跨项目复制、软删 / 恢复等） |
| `settings` | 应用设置（KV 形式） |

`scripts` / `project_assets` / `project_reviews` 等表同时被 Path A（`Script` / `Asset` / `Review`）和 Path B（`ProjectScript` / `ProjectAsset` / `ProjectReview`）共用——通过 `id` 主键保持一致。

### 7.5 软删除
所有业务表均带 `deleted_at` 字段。删除操作仅写入 `deleted_at` 时间戳，UI 仍可在"5 秒撤销"内恢复。真正物理删除需要走专门的管理接口。

### 7.6 写入与并发安全
1. **参数化语句**：所有读写都通过 `?` 占位符，避免任何 SQL 注入风险。
2. **WAL 模式**：读写并发不互斥，前端轮询与业务写入可以同时进行。
3. **事务**：批量插入使用 `db.exec("BEGIN")` / `db.exec("COMMIT")` 包裹。
4. **关闭释放**：`ctx.close()` 在 server 关闭时调用，避免 Windows 下文件被锁。

### 7.7 备份与归档
| 周期 | 动作 |
|------|------|
| 每日 02:00 | `sqlite.db` → `sqlite.db.YYYY-MM-DD.bak` |
| 每周日 03:00 | 全量 tar 备份至 OSS / S3 |
| 实时 | 通过 `rclone` / `rsync` 同步至异地 |

## 8. API 设计

### 8.1 设计原则
- RESTful 风格，资源名词复数。
- 统一响应结构：
```json
{ "code": 0, "message": "ok", "data": {} }
```
- 错误码规范：业务错误 1xxx，系统错误 5xxx，鉴权 401x。
- 列表接口：分页（page/size）、过滤、排序。
- 所有接口必须 DTO 校验（class-validator）+ Swagger 注释。

### 8.2 接口清单（核心）

| 模块 | Method | Path | 说明 |
|------|--------|------|------|
| Chat | GET | /api/conversations | 会话列表 |
| Chat | POST | /api/conversations | 新建会话 |
| Chat | DELETE | /api/conversations/:id | 删除 |
| Chat | PUT | /api/conversations/:id | 重命名/置顶 |
| Chat | GET | /api/conversations/:id/messages | 消息列表 |
| Chat | POST | /api/chat | 流式聊天（SSE） |
| Chat | POST | /api/chat/regenerate | 重新生成 |
| Chat | POST | /api/chat/stop | 停止生成 |
| Image | POST | /api/images/generate | 生成图片 |
| Image | GET | /api/images | 图片历史 |
| Image | DELETE | /api/images/:id | 删除 |
| Video | POST | /api/videos/generate | 提交视频任务 |
| Video | GET | /api/videos | 视频历史 |
| Video | GET | /api/videos/:taskId | 轮询任务 |
| Favorite | POST | /api/favorites | 添加 |
| Favorite | DELETE | /api/favorites/:id | 取消 |
| Favorite | GET | /api/favorites | 列表 |
| Setting | GET | /api/settings | 获取 |
| Setting | PUT | /api/settings | 更新 |

### 8.3 错误码
| Code | 含义 |
|------|------|
| 0 | 成功 |
| 1001 | 参数错误 |
| 1004 | 资源不存在 |
| 1005 | 配额不足 |
| 4299 | 频率限制 |
| 5000 | 系统错误 |
| 5001 | AI 服务异常 |
| 5002 | 第三方超时 |

---

## 9. UI/UX 设计规范

### 9.1 视觉风格
- **风格**：参考 ChatGPT，极简现代。
- **主题**：默认深色，支持浅色/跟随系统。
- **特效**：玻璃拟态（Glassmorphism）、毛玻璃、圆角 12px、阴影柔和。
- **留白**：大量留白，重要信息层级清晰。
- **动效**：Framer Motion，缓动函数统一 `cubic-bezier(0.4, 0, 0.2, 1)`。

### 9.2 布局
- **桌面（≥ 1280px）**：左侧栏 260px + 主内容区自适应。
- **平板（768-1280px）**：左侧栏可收起。
- **移动（< 768px）**：底部 Tab Bar + 全屏内容。

### 9.3 设计 Token
| 类别 | Token |
|------|-------|
| 主色 | `#10A37F`（Agnes 绿） |
| 辅助色 | `#7C3AED`、`#F59E0B`、`#EF4444` |
| 中性色 | `#0D0D0D` ~ `#FAFAFA` |
| 字体 | Inter / 思源黑体 |
| 圆角 | sm 6 / md 10 / lg 16 |
| 间距 | 4 / 8 / 12 / 16 / 24 / 32 |

### 9.4 组件库
- Shadcn UI 作为基础（可定制）。
- 自研：MessageBubble、ChatInput、ParamForm、ImageGrid、VideoCard、TaskStatus。

### 9.5 关键页面线框（文字描述）
- **聊天页**：左侧会话列表 + 右侧消息流（顶部模型切换 + 右侧详情抽屉）。
- **图片页**：左侧参数面板 + 右侧瀑布流。
- **视频页**：左侧 Prompt/上传 + 右侧任务列表。
- **设置页**：主题、语言、默认参数等配置。

---

## 10. 安全设计

> 本项目为个人本地使用，无需认证授权系统。以下安全设计主要针对 API 调用和文件处理。

### 10.1 接口安全
- Rate Limit：IP 维度 100/min。
- 输入：class-validator + XSS 过滤（DOMPurify）。
- 输出：响应转义。
- SQL 注入防护：所有用户输入字段经参数化语句处理，配合输入校验与最小权限 SQLite 账户。

### 10.2 文件上传
- 类型白名单（图片 jpg/png/webp，视频 mp4，文件 pdf/txt/md）。
- 大小限制：图片 10MB，视频 100MB，文件 20MB。

### 10.3 数据安全
- API Key 存储在本地环境变量或配置文件中，不对外暴露。
- SQLite 数据库安全：
  - `data/sqlite.db` 文件权限 600，进程专属用户。
  - `data/media` 目录权限 700。

### 10.4 内容安全
- 提示词审核（敏感词 + AI 审核）。
- 输出内容过滤。

---

## 11. 部署与运维

### 11.1 部署架构
```
[CDN] → [Nginx] → [Next.js (SSR)] → [NestJS] → [SQLite (/data/sqlite.db) + Redis + OSS]
                                    → [Agnes AI APIs]
```
- `/data` 目录挂载为独立数据卷（建议 NVMe SSD），支持后续迁移到 NAS / OSS。
- 多实例部署时 `/data` 需挂载共享存储（NFS / OSSFS），并启用 Redis 分布式锁。


### 11.3 CI/CD
- **GitHub Actions**：
  - PR 触发：lint + 单测 + 构建。
  - main 合并：构建镜像 → 推送 Registry → 部署到预发布。
  - 手动：部署到生产。
- 蓝绿发布（V2）。

### 11.4 监控告警
- Prometheus + Grafana：业务指标 + 系统指标。
- Loki / ELK：日志聚合。
- Sentry：前端异常 + 后端异常。
- 告警通道：飞书 / 邮件 / 短信。

---

## 12. 测试策略

| 测试类型 | 工具 | 覆盖率目标 |
|----------|------|------------|
| 单元测试 | Jest | ≥ 70% |
| 接口测试 | Jest + Supertest | 100% 核心接口 |
| 组件测试 | React Testing Library | 关键组件 |
| E2E | Playwright | 核心流程 |
| 性能测试 | k6 | 关键接口 |
| 安全扫描 | OWASP ZAP | 关键漏洞 |

**关键场景**：
- 聊天 → 生成图片 → 生成视频 → 收藏 → 历史回溯。
- 断网重连、断点续传。
- 并发压测、异常注入。

---

## 13. 项目里程碑

### 13.1 MVP（v1.0，6 周）
- 阶段 1：产品设计（1 周）— PRD、UI 原型、SQLite 存储设计、API 设计。
- 阶段 2：前端（2 周）— 框架、聊天、图片、视频页面。
- 阶段 3：后端（2 周）— 聊天、图片、视频、SDK 封装、Redis、SqliteRepository。
- 阶段 4：联调 + 部署（1 周）— 联调、Docker、CI/CD、上线。

**MVP 验收**：全部 P0 需求通过验收测试，核心流程跑通。

### 13.2 V2.0（再 6 周）
- 多模态输入（图片、文件）。
- 监控告警完善。
- 性能优化（缓存、SSR）。
- 多语言。

### 13.3 V3.0（规划中）
- 移动端 App。
- 开放 API。
- 插件市场。

---

## 14. 风险分析

| 风险 | 类型 | 严重度 | 概率 | 缓解措施 |
|------|------|--------|------|----------|
| Agnes API 不稳定 | 技术 | 高 | 中 | 多级重试、降级方案、限流兜底 |
| API 成本超支 | 业务 | 高 | 中 | 配额管理、Redis 缓存 |
| 流式输出断连 | 技术 | 中 | 高 | 断点续传、客户端重试 |
| 视频任务超时 | 技术 | 中 | 中 | Webhook + 长轮询、用户提示 |
| 内容合规风险 | 合规 | 高 | 中 | 敏感词过滤、AI 审核 |
| 第三方依赖升级 | 技术 | 中 | 中 | 锁版本、抽象接口、定期升级窗口 |
| 需求频繁变更 | 业务 | 中 | 高 | 需求评审、变更控制、文档化 |
| **SQLite 大库查询慢** | 技术 | 中 | 中 | 关键列建索引 + 软删除过滤条件 + 必要时拆库 |
| **SQLite 写并发瓶颈** | 技术 | 中 | 中 | WAL 模式 + 批量事务 + 业务侧限流 |
| **SQLite 备份一致性** | 运维 | 中 | 中 | `VACUUM INTO` 或 `sqlite3 .backup`，每日 02:00 全量 |
| **SQL 注入 / 字段污染** | 安全 | 高 | 中 | 参数化语句 + 输入校验 + DTO 强校验 |
| **磁盘容量耗尽** | 运维 | 中 | 中 | 监控 + 90 天自动清理 + 压缩归档 |

---

## 15. 验收标准

### 15.1 MVP 验收
1. 全部 P0 需求实现并通过测试。
2. 核心流程 E2E 跑通：
   - 发起聊天 → 流式接收 → 停止/重新生成。
   - 设置参数 → 生成图片 → 历史查看 → 下载。
   - 提交视频任务 → 轮询 → 播放下载。
4. 性能基线：首屏 < 2s，流式首字节 < 1s，API P95 < 500ms。
6. 文档：API 文档、部署文档、用户手册完整。

### 15.2 V2 验收
- 监控告警完整。
- 多语言支持完善。

---

## 16. 附录

### 16.1 术语表
| 术语 | 解释 |
|------|------|
| AgnesClient | 统一 AI 能力调用 SDK |
| SSE | Server-Sent Events，服务端推送 |
| RBAC | 基于角色的访问控制 |
| DTO | Data Transfer Object |
| Skeleton | 骨架屏，loading 占位 |
| Token | 模型计费单位 |

### 16.2 参考资料
- Agnes 2.0 Flash：https://agnes-ai.com/zh-Hans/docs/agnes-20-flash
- Agnes Image 2.1 Flash：https://agnes-ai.com/zh-Hans/docs/agnes-image-21-flash
- Agnes Video V2.0：https://agnes-ai.com/zh-Hans/docs/agnes-video-v20
- IEEE 830-1998 软件需求规格说明书标准
- BABOK v3 业务分析知识体系

### 16.3 变更记录
| 版本 | 日期 | 变更 | 作者 |
|------|------|------|------|
| v1.0 | 2026-07-01 | 初始版本 | 产品/BA |
| v1.1 | 2026-07-01 | 存储介质由 MySQL 调整为本地文件存储方案（**该方案已于 v1.3 下线**） | 产品/BA |
| v1.2 | 2026-07-01 | 调整为**个人本地使用**模式：移除登录/注册、用户管理、RBAC、后台管理、JWT 鉴权等模块；简化数据存储（移除 users/login_logs/operation_logs 表）；简化安全设计；调整里程碑 | 产品/BA |
| v1.3 | 2026-07-12 | 持久化存储统一为 **SQLite（`backend/data/sqlite.db`）**：新增 SqliteRepository；状态机收敛到 `work_items`；新增 `app_logs` 审计日志 | 产品/BA |

---

**声明**：本文档为产品需求规格说明，具体实现细节以详细设计文档为准。任何需求变更必须经过评审并更新本文档。
