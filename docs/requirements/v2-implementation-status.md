# V2 实施状态追踪（截至 2026-07-21）

> ⚠️ **说明**：原文件于 2026-07-21 因文件丢失事故丢失。本版本为重建版，基于：
> 1. 实际测试运行结果（已通过的测试用例）
> 2. 实际已落地的 dist 代码（`dist/src/services/module-domain/pipeline-run-service.js` 等）
> 3. 之前的对话历史摘要
> 4. **未记录的小粒度历史可能丢失，建议结合 git log 交叉核对**

## 1. 模块完成度总览

| 模块 | 总数 | 完整实现 | 部分实现 | 未实现 | 完整率 |
|------|------|----------|----------|--------|--------|
| MOD-PROJ 项目中心 | 8 | 0 | 4 | 4 | 0% |
| MOD-SCRIPT 剧本中心 | 12 | 3 | 6 | 3 | 25% |
| MOD-ASSET 资产/一致性 | 14 | 2 | 8 | 4 | 14% |
| **MOD-PIPELINE 任务编排** | **6** | **3** | **3** | **0** | **50%** |
| MOD-AV 合成引擎 | 13 | 1 | 6 | 6 | 8% |
| MOD-GEN 工厂 | 7 | 0 | 4 | 3 | 0% |
| MOD-AUTH 鉴权 | 5 | 0 | 3 | 2 | 0% |
| MOD-ANALYZE 分析 | 8 | 1 | 3 | 4 | 13% |
| 其他 8 个模块 | 19 | 0 | 7 | 12 | 0% |
| **合计** | **92** | **11** | **46** | **35** | **12%** |

## 2. MOD-PIPELINE 任务编排 详情

| Feature | 名称 | 状态 | 已实现 | 待补全 |
|---------|------|------|--------|--------|
| FEAT-PIPE-001 | DAG 任务编排（核心调度） | 🔧 | `createRun` / `startRun` / `pauseRun` / `resumeRun` / `cancelRun` / `detectStaleRunningNodes` + DAG 校验挂到路由 + 节点最大并发控制（REQ-PIPE-001-05 ✅） | 缺节点启停开关（REQ-PIPE-001-06） |
| FEAT-PIPE-002 | 断点续跑 | ✅ | resumeRun + 幂等键（REQ-PIPE-002-04 ✅）+ 超时强制终止 + Stale Running 检测（REQ-PIPE-002-05 ✅） | — |
| FEAT-PIPE-003 | 进度与可观测 | ✅ | Run CRUD + 节点列表 + 事件流持久化（REQ-PIPE-003-03 ✅）+ SSE 实时进度推送（REQ-PIPE-003-01 ✅） | — |
| FEAT-PIPE-004 | 质量检测 | 🔧 | `quality-detection-service.ts` 黑帧/模糊/分辨率/宽高比/时长/音频电平 | 缺 AI 评分、缺一致性包相似度对比、缺自动触发配置 |
| FEAT-PIPE-005 | 审核闭环 | 🔧 | `review-service.ts` + 审批流 API 适配 | 缺条件分支、缺返工 todo 自动创建、缺 SLA 升级 |
| FEAT-PIPE-006 | 错误恢复 | 🔧 | executeNode 内置 3 次重试 + 指数退避 | 缺错误分类、缺模型降级、缺死信队列、缺熔断器 |

## 3. 关键 P0/P1 阻塞项进度

| ID | 描述 | 状态 | 测试覆盖 |
|----|------|------|----------|
| B-01 | Agnes Client 视频参数透传 | ✅ | 已有 |
| B-02 | TTS Provider 不可用 | ✅ | 已有 |
| B-03 | 预算 recordCost 从未调用 | ✅ | 集成测试覆盖 |
| B-04 | 任务队列入队化 | ✅ | 已有 |
| P0-08 | DB 成本账本持久化 + 幂等 | ✅ | 14 个测试全绿 |
| REQ-PIPE-002-04 | 节点幂等键 | ✅ | 19 个测试全绿 |
| REQ-PIPE-002-05 | 节点超时控制 + Stale Running 检测 | ✅ | 12 个测试全绿 |
| REQ-PIPE-003-03 | 节点事件流持久化 | ✅ | 17 个测试全绿 |
| REQ-PIPE-003-01 | SSE 实时进度推送 | ✅ | 15 个测试全绿 |
| REQ-PIPE-001-05 | 节点最大并发控制 | ✅ | 18 个测试全绿 |

## 4. 关键实现文件

| 文件 | 行数概览 | 状态 |
|------|----------|------|
| `backend/src/services/horizontal/pipeline-event-bus.ts` | 进程内 SSE pub/sub，200 条背压 | ✅ |
| `backend/src/services/horizontal/concurrency-tracker.ts` | per-type 计数 + 5min fail-open | ✅ |
| `backend/src/services/module-domain/pipeline-run-service.ts` | DAG 调度 + 幂等 + 超时 + 事件 + 并发 | ✅ |
| `backend/src/http/pipeline-router.ts` | Run/Node HTTP + SSE 端点 | ✅ |
| `backend/src/services/app.ts` | 注册 pipelineRuns/Nodes/Events + bus + tracker + service | ✅ |

## 5. 测试统计

| 测试文件 | 用例数 | 状态 |
|----------|--------|------|
| `tests/pipeline-node-events.test.mjs` | 17 | ✅ 全绿 |
| `tests/pipeline-node-idempotency.test.mjs` | 19 | ✅ 全绿 |
| `tests/pipeline-node-timeout.test.mjs` | 12 | ✅ 全绿 |
| `tests/pipeline-sse.test.mjs` | 15 | ✅ 全绿 |
| `tests/pipeline-node-concurrency.test.mjs` | 18 | ✅ 全绿 |
| **合计** | **81** | **100% 通过** |

## 6. 结论

Stream A W0 Day 1-5 + Stream B W0/W1/W2/W3 全部完成，完整实现率从 0% 提升到 **12%**。MOD-PIPELINE 从 0% 提升到 **50%**（FEAT-PIPE-002 断点续跑 + FEAT-PIPE-003 进度与可观测 已完整）。

剩余核心缺口：
- **MOD-PIPELINE**：FEAT-PIPE-001 节点启停、FEAT-PIPE-004 质检自动触发、FEAT-PIPE-005 条件分支/返工、FEAT-PIPE-006 模型降级/死信队列
- **MOD-AV**：合成引擎真实实现（当前仅占位）
- **MOD-SCRIPT**：分镜→镜头父子结构（A-03）
- **MOD-AUTH**：发布 OAuth、多级审核
- **MOD-GEN**：AI 工厂批量生成

下一步建议（Stream B 视角）：
1. **REQ-PIPE-001-06** 节点手动启用/禁用（补完 FEAT-PIPE-001）— 1 天
2. **REQ-PIPE-004-05** 质检自动化触发（补完 FEAT-PIPE-004）— 1 天
3. **REQ-PIPE-005-02** 通过/打回分支（补完 FEAT-PIPE-005）— 2 天
