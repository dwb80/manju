# 有序开发待办任务表

> 排序原则：先建立契约与平台安全底座，再完成项目/漫剧事实模型，然后接入生成、审核、后期和发布，最后开放迁移与灾备。每项为可独立验收的纵向切片，不是单纯前端或后端任务。

## 阶段 0：工程门禁

| 顺序 | 任务 | 输出 | 完成条件 |
|---:|---|---|---|
| 0.1 | DEV-GATE-001 OpenAPI 门禁 | 校验脚本、operationId 清单、契约漂移检查 | CI 可解析 OpenAPI、解析全部 `$ref`、拒绝重复 operationId |
| 0.2 | DEV-GATE-002 Migration Runner | schema_migrations、事务与 checksum | 空库和旧库副本可重复执行，失败不留下半迁移 |
| 0.3 | DEV-GATE-003 测试基线 | Fixtures、契约/集成/E2E 目录 | 可在无外部 Provider 环境运行 smoke tests |
| 0.4 | DEV-GATE-004 API 兼容层 | `/api/v1` 路由入口和旧 `/api` deprecation | 同一应用服务承载两路径，不产生双事实源 |
| 0.5 | DEV-GATE-005 客户端命令契约 | 公共请求封装生成/透传 `X-Correlation-Id`、`Idempotency-Key`、`If-Match`、`commandId` | US-001～006 契约测试证明必填、重放和冲突行为；禁止各页面自行拼装不一致 Header |

## 阶段 1：身份、权限与治理底座

| 顺序 | 切片 | 优先级 | 依赖 | 主要证据 |
|---:|---|---:|---|---|
| 1.1 | US-023 认证与会话安全 | P0 | Gate | US-023-S01/S02、安全测试 |
| 1.2 | US-022 用户与组织成员 | P0 | US-023 | US-022-S01/S02 |
| 1.3 | CAP-001 项目成员与权限 | P0 | US-022 | CAP-001-S01/S02 |
| 1.4 | US-027 统一审计 | P0 | US-023 | US-027-S01/S02 |
| 1.5 | US-026 类型化配置 | P0/P1 | US-027 | US-026-S01/S02 |
| 1.6 | US-024 通知中心 | P0/P1 | US-022,US-026 | US-024-S01/S02 |
| 1.7 | CAP-007 预算治理 | P0 | US-027,US-026 | CAP-007-S01/S02 |
| 1.8 | CAP-002 模型配置与路由 | P0 | US-026,US-027 | CAP-002-S01/S02 |
| 1.9 | CAP-006 AI 任务队列运维 | P0 | CAP-002,CAP-007 | CAP-006-S01/S02 |
| 1.10 | CAP-008 质量规则配置 | P0 | US-026,US-027 | CAP-008-S01/S02 |

## 阶段 2：项目、剧本与漫剧事实模型

| 顺序 | 切片 | 优先级 | 依赖 | 主要证据 |
|---:|---|---:|---|---|
| 2.1 | US-001 创建项目 | P0 | CAP-001 | US-001-S01/S02 |
| 2.2 | US-002 创建剧集 | P0 | US-001 | US-002-S01/S02 |
| 2.3 | MANGA-001 项目表现规格 | P0 | US-001 | MANGA-001-S01/S02 |
| 2.4 | US-003 剧本版本与编辑锁 | P0 | US-002 | US-003-S01/S02 |
| 2.5 | US-005 Shot/Storyboard 原子编排 | P0 | US-002 | US-005-S01/S02 |
| 2.6 | MANGA-002 图层化构图 | P0 | US-005,MANGA-001 | MANGA-002-S01/S02 |
| 2.7 | MANGA-003 对白气泡与旁白 | P0 | US-003,MANGA-002 | MANGA-003-S01/S02 |
| 2.8 | US-013 AudioAsset 新模型 | P0 | US-001 | US-013-S01/S02 |
| 2.9 | MANGA-004 拟声词与 SFX | P0 | MANGA-003,US-013 | MANGA-004-S01/S02 |
| 2.10 | MANGA-005 漫画特效 | P0 | MANGA-002 | MANGA-005-S01/S02 |
| 2.11 | MANGA-006 有限动态 | P0 | MANGA-002,US-013 | MANGA-006-S01/S02 |
| 2.12 | MANGA-008 表现快照 | P0 | MANGA-002..006 | MANGA-008-S01/S02 |

### 阶段 2 迁移卡（不新增产品范围）

| 顺序 | 迁移卡 | 优先级 | 主要工作 | 完成证据 |
|---:|---|---:|---|---|
| 2.M1 | MIG-PROJECT-EPISODE 项目/剧集收敛 | P0/上线阻断 | 旧项目字段映射；owner/status 服务端派生；Project Episode 单一事实源；deletion-precheck；创建时原子初始化 Script/Storyboard | US-001/002 契约、幂等、回滚与孤儿核对报告 |
| 2.M2 | MIG-SCRIPT-CONTRACT 剧本契约收敛 | P0/上线阻断 | 正式深链；编辑锁租约与只读降级；显式发布和发布后不可变；`/compare` 迁移到版本 diff；`editor_json` 规范化迁移 | US-003-S01/S02、深链 E2E、content hash 对账 |
| 2.M3 | MIG-STORYBOARD-CONTRACT 分镜契约收敛 | P0 | 项目级分镜深链和 Shot 导演台；shot-order + If-Match；batch-duration；资产绑定表迁移 | US-005-S01/S02、并发排序、批量逐项结果、绑定核对 |

## 阶段 3：资产、生成、质检与审核

| 顺序 | 切片 | 优先级 | 依赖 | 主要证据 |
|---:|---|---:|---|---|
| 3.1 | US-007 角色资产版本 | P0 | US-001 | US-007-S01/S02 |
| 3.2 | US-008 场景/道具资产版本 | P0 | US-001 | US-008-S01/S02 |
| 3.3 | US-004 剧本分析与资产草稿 | P1 | US-003,US-007/008,CAP-006 | US-004-S01/S02 |
| 3.4 | US-006 AI 分镜建议 | P1 | US-004,US-005 | US-006-S01/S02 |
| 3.5 | US-PM-001 Prompt 模板 | P1 | CAP-002,US-027 | US-PM-001-S01/S02 |
| 3.6 | CAP-003 Pipeline 模板 | P1 | CAP-002,CAP-006 | CAP-003-S01/S02 |
| 3.7 | US-009 图片生成 | P0 | MANGA-008,CAP-007 | US-009-S01/S02 |
| 3.8 | US-010 图片审核 | P0 | US-009,US-027 | US-010-S01/S02 |
| 3.9 | US-011 视频生成 | P0 | US-010,CAP-003 | US-011-S01/S02 |
| 3.10 | US-012 视频审核 | P0 | US-011 | US-012-S01/S02 |
| 3.11 | MANGA-007 一致性检查 | P0 | CAP-008,MANGA-008 | MANGA-007-S01/S02 |

### 阶段 3 迁移卡（不新增产品范围）

| 顺序 | 迁移卡 | 优先级 | 主要工作 | 完成证据 |
|---:|---|---:|---|---|
| 3.M1 | MIG-SCRIPT-ANALYSIS 同步分析迁移 | P1 | `/api/ai/script-analyze` 迁移到 analysis-jobs；真实队列/阶段/attempt/cost；stale 与最多3次重试 | US-004-S01/S02、超时/重试/成本契约测试 |
| 3.M2 | MIG-SHOT-SUGGESTION US-006 落地 | P1 | 建议任务、部分结果、人工采纳；承接 US-033 split_shots，去除前端模拟进度和直接建 Shot 路径 | US-006-S01/S02/S03、跨上下文幂等测试 |
| 3.M3 | MIG-LEGACY-FEATURE-MAP 旧增强端点归并 | P1 | 将审批/评分/连续性/标签/统计/评论、自动拆分、复制、生成视频、局部回收站逐项映射到正式 Review/QC/统计/US-006/US-011/US-025 命令；无归属端点先停止新增调用 | 每个旧端点有 retain/merge/deprecate 决定、owner、successor operationId 和删除门槛 |

## 阶段 4：后期、协作与发布

| 顺序 | 切片 | 优先级 | 依赖 | 主要证据 |
|---:|---|---:|---|---|
| 4.1 | US-014 字幕版本 | P0/P1 | US-003,US-013 | US-014-S01/S02 |
| 4.2 | US-021 EditProject 内 Clip | P0 | US-011 | US-021-S01/S02 |
| 4.3 | US-015 多轨剪辑与渲染 | P0/P1 | US-014,US-021,MANGA-008 | US-015-S01/S02 |
| 4.4 | US-016 成片两级审核 | P0 | US-015,MANGA-007 | US-016-S01/S02 |
| 4.5 | US-018 项目任务 | P0 | CAP-001,US-024 | US-018-S01/S02 |
| 4.6 | US-019 问题与返工 | P1 | US-018,US-010/012 | US-019-S01/S02 |
| 4.7 | US-020 里程碑 | P1 | US-018 | US-020-S01/S02 |
| 4.8 | US-017 多平台发布 | P0/P1 | US-016,US-026 | US-017-S01/S02 |
| 4.9 | US-DS-001 数据统计 | P1 | 成本/生成/审核/发布事件 | US-DS-001-S01/S02 |
| 4.10 | CAP-005 AI 对话与 Studio | P1 | CAP-006,US-022 | CAP-005-S01/S02 |
| 4.11 | CAP-004 数据集管理 | P1 | US-027,US-026 | CAP-004-S01/S02 |

## 阶段 5：生命周期与上线门禁

| 顺序 | 切片 | 优先级 | 依赖 | 主要证据 |
|---:|---|---:|---|---|
| 5.1 | US-025 统一回收站 | P0/P1 | 主聚合迁移完成 | US-025-S01/S02 |
| 5.2 | US-028 版本化项目包 | P1 | 主聚合 Schema 稳定 | US-028-S01/S02 |
| 5.3 | US-029 备份与灾难恢复 | 上线阻断 | 所有 migration | US-029-S01/S02 |
| 5.4 | MIG-AUDIO Audio/Clip 切换 | 上线阻断 | US-013,US-021 | inventory、shadow read、核对、回滚演练 |
| 5.5 | MIG-API 错误与 `/api/v1` 切换 | 上线阻断 | 全部 v1 operation | 兼容期指标、弃用头、无旧客户端阻断 |
| 5.6 | MIG-ROUTES 正式深链切换 | 上线阻断 | Script/Storyboard/Shot 正式详情路由、旧链接 replace、父链鉴权 | 直接访问/刷新/返回/分享/404/403/归属冲突 E2E；无重定向循环 |

## 卡片统一字段

每张研发卡必须填写：`featureId`、`scenarioIds`、`operationIds`、`tables`、`pageRoutes`、`permissionKeys`、`migrationId`、`testPaths`、`metrics`、`rollback`。缺少任一适用字段则退回 Backlog，不进入开发。
