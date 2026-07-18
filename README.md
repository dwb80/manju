# Manju AI 漫剧生产工作台

Manju（历史名称 Agnes AI Studio）是一套本地优先的 AI 漫剧生产工作台，覆盖项目、剧本、分镜、角色/场景/道具资产、图片、视频、音频、剪辑、审核、发布准备、数据分析、模型配置和任务监控。

当前产品边界是“单机或单团队试点版”：核心生产链路可运行，但尚未提供登录、组织、多租户和强制 RBAC；发布模块负责成片、计划、平台物料和发布包，不代表已接入第三方平台自动投放。准确能力状态见 [功能状态基线](docs/feature-status.md)，目标产品设计见 [竞争性产品 PRD](docs/platform-diagnosis-and-competitive-prd.md)。

## 核心能力

- 项目工作台：项目、剧集、任务、里程碑、问题、成员信息和项目目录。
- 剧本生产：导入、结构化编辑、场景/对白拆解、版本、AI 分析、生成与优化。
- 资产与分镜：角色、场景、道具、音频、分镜、图片历史、跨项目复制和使用关系。
- AI 生产：聊天、图片、视频、任务队列、取消/重试、模型配置与本地媒体保存。
- 质量与交付：审核队列、通过/驳回、成片管理、发布计划、发布包和数据看板。
- 本地基础设施：Node.js HTTP 服务、SQLite、结构化日志、请求追踪和可注入 AI Provider。

## 技术结构

- `backend/`：Node.js 24 + TypeScript，提供 HTTP API、领域服务、AI Provider 和 SQLite 存储。
- `frontend/`：Next.js 15 + React 19 + Tailwind CSS。
- `scripts/`：启动、E2E、编码和密钥检查脚本。
- `docs/`：产品、需求、架构、API、诊断与代码评审文档。

## 环境要求

- Node.js `24.3.x`（项目通过 `.nvmrc` 和 `engines` 锁定）。
- npm；Windows 可使用 `start-all.bat`。
- 真实 AI 生成需要在 `backend/.env` 配置 Provider 密钥。测试使用显式 FakeAIClient，不需要网络或真实密钥。

## 安装与启动

```powershell
cd backend
npm install
Copy-Item .env.example .env

cd ..\frontend
npm install

cd ..
.\start-all.bat
```

默认地址：

- 前端：`http://127.0.0.1:3001`
- 后端：`http://127.0.0.1:3000`
- 健康检查：`http://127.0.0.1:3000/api/health`

后端默认只监听本机。若确需局域网访问，应显式配置 `HOST`、`CORS_ALLOWED_ORIGINS`，并先补充身份认证和访问控制。

## 配置

参考 `backend/.env.example`。至少选择并配置一个可用 AI Provider；不要把真实密钥写入源码、文档或提交到 Git。模型接口只返回 `secret_configured`，不会把敏感请求头回传浏览器。

## 验证命令

```powershell
cd backend
npm test

# 编码、密钥、后端测试、前端生产构建和关键 E2E
npm run test:all
```

前端的 `npm run test:e2e` 执行稳定的关键链路冒烟测试；历史全量页面用例保留为 `npm run test:e2e:legacy`，用于逐步清理旧断言。

## 推荐文档

- [文档索引](docs/README.md)
- [功能状态基线](docs/feature-status.md)
- [竞争性产品 PRD 与差异整改](docs/platform-diagnosis-and-competitive-prd.md)
- [架构与开发指南](docs/architecture-and-development.md)
- [实际 API 说明](docs/api.md)
- [代码评审与工程整改](docs/code-review-report-2026-07-18.md)

## 已知边界

- 当前没有真实登录、组织、多租户和强制 RBAC，不应直接暴露到公网。
- 第三方平台账号授权、自动发布、回执和投后数据回流尚未接入。
- 个别 Provider 不支持 TTS；界面和接口必须按实际 Provider 能力显示。
- SQLite 适合本地/小团队试点；多人并发和高可用部署需要迁移到服务端数据库与对象存储。
