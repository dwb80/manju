# V2 实施状态追踪（截至 2026-07-21）

> ⚠️ **本版本依据**：项目记忆 `project_memory.md` + 今日 `topics.md`（Stream B 会话 6a5b1a49 + Stream C 会话 6a5e29fa）+ dist 实际代码 + 已通过的测试结果。
>
> **重要纠正**：项目实际只有 **Stream B（AI 生成与合成）** 和 **Stream C（项目/审核/发布）** 两条线，**没有 Stream A**。之前的"Stream A W0 Day 1-5"描述不实，已删除。

## 1. 整体进度（按 W 周迭代）

| 阶段 | Stream B（AI 生成与合成） | Stream C（项目/审核/发布） |
|------|---------------------------|----------------------------|
| W0 | ✅ 完成（修复 B-01/B-02 + DB 迁移 10 新表 + MOD-GEN 队列化 + 预算原子性） | ✅ 完成（MOD-PROJ 5 表 + MOD-REVIEW 4 表 + MOD-PUBLISH 3 表 = 12 新表 + 12 Repository） |
| W1 | ✅ 完成（MOD-PIPELINE DAG 校验、COMPOSITION 引擎、Render Job） | ✅ 完成（C-01 软删验收 + C-02 审核状态机 3→7 状态 + C-03 打回原因对齐前端） |
| W2 | ✅ 完成（processRun 异步 + Render Job 执行器 + composition/pipeline-run 测试） | ✅ 完成（MOD-PUBLISH OAuth 5 渠道：douyin/kuaishou/bilibili/xiaohongshu/wechat_channel） |
| W3 | ✅ 完成（4 个新 service：BGM/SFX/字幕/音画模板 + 29 测试全绿） | 未推进 |
| W4 | ✅ 完成（B-03 recordCost 修复 + 全量回归 68 用例全绿） | 未推进 |
| 当前 | **继续推进 W5+ REQ-PIPE-001/002/003 系列**（节点并发/幂等/超时/事件流/SSE） | 已收尾（OAUth 阶段无 P0 阻塞） |

## 2. Stream B 详细完成项（MOD-PIPELINE 持续推进）

| REQ ID | 名称 | 状态 | 测试 |
|--------|------|------|------|
| B-01 | Agnes Client 视频参数透传 | ✅ | 已有 |
| B-02 | TTS Provider 不可用 | ✅ | 已有 |
| B-03 | 预算 recordCost 同步路径修复 | ✅ | 6 用例全绿 |
| B-04 | 任务队列入队化 | ✅ | 已有 |
| REQ-PIPE-002-04 | 节点幂等键 | ✅ | 19 用例全绿 |
| REQ-PIPE-002-05 | 节点超时控制 + Stale Running 检测 | ✅ | 12 用例全绿 |
| REQ-PIPE-003-03 | 节点事件流持久化 | ✅ | 17 用例全绿 |
| REQ-PIPE-003-01 | SSE 实时进度推送 | ✅ | 15 用例全绿 |
| REQ-PIPE-001-05 | 节点最大并发控制 | ✅ | 18 用例全绿 |
| P0-08 | DB 成本账本持久化 + 幂等 | ✅ | 14 用例全绿 |
| **小计** | **Stream B 累计通过测试 ~111+ 用例** | | **100% 通过** |

## 3. Stream B MOD-PIPELINE 6 个 Feature 状态

| Feature | 名称 | 状态 | 已实现 | 待补全 |
|---------|------|------|--------|--------|
| FEAT-PIPE-001 | DAG 任务编排（核心调度） | 🔧 | createRun/startRun/pauseRun/resumeRun/cancelRun/detectStaleRunningNodes + DAG 校验 + 节点最大并发（REQ-PIPE-001-05） | 缺节点启停开关（REQ-PIPE-001-06） |
| FEAT-PIPE-002 | 断点续跑 | ✅ | resumeRun + 幂等键（REQ-PIPE-002-04）+ 超时强制终止 + Stale Running 检测（REQ-PIPE-002-05） | — |
| FEAT-PIPE-003 | 进度与可观测 | ✅ | Run CRUD + 节点列表 + 事件流持久化（REQ-PIPE-003-03）+ SSE 实时进度推送（REQ-PIPE-003-01） | — |
| FEAT-PIPE-004 | 质量检测 | 🔧 | quality-detection-service.ts（黑帧/模糊/分辨率/宽高比/时长/音频电平） | 缺 AI 评分、缺一致性包相似度对比、缺自动触发配置 |
| FEAT-PIPE-005 | 审核闭环 | 🔧 | review-service.ts + 审批流 API 适配 | 缺条件分支、缺返工 todo 自动创建、缺 SLA 升级 |
| FEAT-PIPE-006 | 错误恢复 | 🔧 | executeNode 内置 3 次重试 + 指数退避 | 缺错误分类、缺模型降级、缺死信队列、缺熔断器 |

**MOD-PIPELINE 完整率 2/6 = 33%**（FEAT-PIPE-002 断点续跑 + FEAT-PIPE-003 进度与可观测 已完整）

## 4. Stream C 详细完成项

| 项 | 名称 | 状态 |
|----|------|------|
| MOD-PROJ 项目中心 | C-01 软删 + W0 schema | ✅ 收尾 |
| MOD-REVIEW 审核 | W0 schema + C-02 状态机 3→7 | ✅ 收尾 |
| MOD-PUBLISH 发布 | W0 schema + W2 OAuth 5 渠道 + publish-account-service | ✅ 收尾 |
| C-03 打回原因枚举对齐前端 | 11 个 ReviewStatus/TargetType Records | ✅ |

## 5. 跨 Stream 阻塞与遗留

| 类别 | 内容 | 责任 Stream |
|------|------|-------------|
| P0 已修复 | B-01 / B-02 / B-03 / B-04 | Stream B |
| P0 已修复 | C-01 / C-02 / C-03 | Stream C |
| 已知遗留（非阻塞） | `api.test.mjs` 仍有 `readJson` 导入失败（`router.js` 导出问题） | — |
| 当前进行中 | REQ-PIPE-001-06 节点启停 / REQ-PIPE-004-05 质检自动触发 / REQ-PIPE-005-02 条件分支 | Stream B |

## 6. 文件 / 代码现状

| 文件 | 状态 | 备注 |
|------|------|------|
| `backend/src/services/module-domain/pipeline-run-service.ts` | ⚠️ 不在 src | dist 里有完整新版（scheduleConcurrentRun），但 src 缺失（被 stash/外部清掉过） |
| `backend/src/services/horizontal/concurrency-tracker.ts` | ⚠️ 不在 src | 同上，dist 完整 |
| `backend/src/services/horizontal/pipeline-event-bus.ts` | ⚠️ 不在 src | 同上，dist 完整 |
| `backend/src/services/app.ts` | ✅ src 存在 | 已被多次修改，可能有未提交 |
| `dist/src/services/*` | ✅ 完整 | 含全部 Stream B W0-W5 代码 |
| `docs/requirements/v2-implementation-status.md` | ✅ 本次重建 | 内容以本文件为准 |

## 7. 结论与下一步

- Stream B W0-W5 持续推进，MOD-PIPELINE 从 0% → 33% 完整（2/6 Feature 完整）
- Stream C W0-W2 收尾，OAUth 5 渠道全部就绪
- 整体 V2 进度仍属"**核心通路打通，但横向能力（质检/审核/错误恢复/启停控制）未到位**"阶段
- 测试覆盖 ~111+ 用例（Stream B 累计），Stream C 端有 17 个 mock server smoke test 通过
- **建议下一步（Stream B）**：REQ-PIPE-001-06 节点启停（1 天）或 REQ-PIPE-004-05 质检自动触发（1 天）
- **Stream C 下一步候选**：MOD-PROJ 项目基线 REQ-PROJ-001（用户曾在 W1 后期考虑过）

---

## 附录：本版本数据来源

1. `c:\Users\Administrator\.trae-cn\memory\projects\-d-trae-manju\20260721\topics.md` — 5 条摘要（覆盖 W0/W1/W2/W3/W4）
2. `c:\Users\Administrator\.trae-cn\memory\projects\-d-trae-manju\project_memory.md` — 11 条 W 阶段经验记录
3. `dist/src/services/module-domain/pipeline-run-service.js` — 含 scheduleConcurrentRun / 事件记录 / 幂等键 / 超时控制
4. `dist/src/services/horizontal/concurrency-tracker.ts` — per-type 并发追踪
5. `dist/src/services/horizontal/pipeline-event-bus.ts` — 进程内 SSE pub/sub
6. 测试运行结果（`tests/pipeline-*.test.mjs` 全部通过）
