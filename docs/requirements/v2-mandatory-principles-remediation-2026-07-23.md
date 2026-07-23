# V2 开发、设计与模块化强制原则整改记录 v1.1.0

## 1. 文档信息

- 编制日期：2026-07-23
- 最后更新：2026-07-23
- 适用范围：V2 Pipeline、Quality、Final Video、Storyboard/Shot、前端生产页及 CI
- 整改依据：V2 强制开发原则、设计原则、模块边界与 2026-07-23 代码复审结果
- 结论：P0 业务安全问题已闭环；P1 架构治理完成首轮收口，仍存在需持续拆分的历史大类

## 2. 已完成整改

| ID | 优先级 | 问题 | 整改结果 | 自动化证据 |
|---|---|---|---|---|
| REM-P0-001 | P0 | 质检服务缺失或检测器异常时生成随机分数和报告 | 路由服务缺失返回 HTTP 503；检测器异常固定返回 0 分、`passed=false`、`failClosed=true`；禁止任何随机质量分 | P0 专项测试、架构门禁 |
| REM-P0-002 | P0 | `on_failure=block` 仅记录日志和事件 | 自动质检在节点完成前同步执行；未通过时返回真实阻断决定并抛出不可重试门禁错误，节点不进入 completed | P0 专项测试、后端构建 |
| REM-P0-003 | P0 | 任意项目成员可创建 ready 成片并写质量分 | 非管理员回调返回 403；成片初始状态固定为 pending，质量分由系统报告写入 | P0 专项测试 |
| REM-P0-004 | P0 | ready 和下载不校验来源、质检、审核 | ready 与每次下载均校验已完成渲染节点、通过报告、approved 审核和本地文件 | P0 专项测试 |
| REM-P0-005 | P0 | 视频任务把镜头写入非法 `completed` | 视频模块调用镜头域公开命令，镜头推进到合法 `ready`；AppContext 已实际装配 shots/shotSnapshots 仓储 | P0 专项测试、后端构建 |
| REM-P0-006 | P0 | `updateShot` 可绕过状态机并修改归属字段 | 增加显式状态迁移表、版本冲突检查和可编辑字段白名单；专项测试验证非法迁移被拒绝且归属字段不变 | P0 专项测试 |
| REM-P1-001 | P1 | 调度器 fire-and-forget，数据库关闭后仍写入 | 服务登记活动 Run；`AppContext.close()` 等待排空后关闭数据库 | 并发/启停 33 项测试 |
| REM-P1-002 | P1 | Pipeline 服务直接读写 Todo | 返工 Todo 迁入 `horizontal/rework-todo-service.ts` | 架构门禁 |
| REM-P1-003 | P1 | 条件解析混在 PipelineRunService | 提取为无 IO 的 `pipeline-condition.ts` | 后端构建 |
| REM-P1-004 | P1 | V2 Router 直接写 Repository | Quality 与 Final Video 写入口收拢到应用服务 | 架构门禁 |
| REM-P1-005 | P1 | 无自动化模块边界检查 | 新增 `check-v2-architecture.mjs` 并接入 `npm test` 与 GitHub Actions | `npm run check:architecture` |

## 3. 当前强制门禁

`backend/scripts/check-v2-architecture.mjs` 当前阻断以下回归：

1. Pipeline、Quality、Final Video Router 直接调用 Repository 写方法。
2. 质量路由恢复随机分数或伪报告。
3. 视频模块直接写 shots/storyboards 仓储。
4. PipelineRunService 重新直接访问 todos。
5. PipelineRunService 超过当前 2100 行整改基线。
6. Pipeline 页面向用户展示直接执行 SQL 的操作指引。

CI 工作流 `.github/workflows/v2-quality-gate.yml` 强制执行架构检查、后端构建与测试、前端类型检查。

## 4. 尚未完成的 P1/P2

| ID | 优先级 | 剩余项 | 完成标准 |
|---|---|---|---|
| REM-P1-006 | P1 | PipelineRunService 仍约 2000 行 | 将运行生命周期、节点执行器、调度器、事件存储分别拆成独立 Application/Domain 服务；主服务降至 800 行以内 |
| REM-P1-007 | P1 | AppContext 仍暴露大量 Repository | 各模块只注入自身端口；Router 只依赖 Use Case 接口 |
| REM-P1-008 | P1 | 多仓储写入缺少统一事务/Outbox | Run 创建、镜头快照、状态+事件等操作具备原子事务；跨模块事件使用持久化 Outbox |
| REM-P1-009 | P1 | 质量低分自动重试策略已移除但未重建 | 门禁失败后按显式 RetryPolicy 决定自动重试或人工放行；具备次数、退避、审计和幂等测试 |
| REM-P1-010 | P1 | 成片回调仅以管理员身份代替服务身份 | 增加独立内部服务凭证和 callback scope，人员管理员不再充当系统回调 |
| REM-P2-001 | P2 | 其余历史 E2E 脚本可能仍存在“内部断言失败但进程返回 0” | `sec-w17.test.mjs` 已修复；其余自定义脚本逐步迁移至 Node Test，并统一按总失败数返回非零退出码 |

## 5. 验收结论

- P0 发布安全：已执行，专项测试 9/9 通过。
- 基础编译：后端 `npm run build` 通过；前端 `npm run lint` 通过。
- 架构回归门禁：`npm run check:architecture` 通过。
- 全量后端测试：业务测试执行到 83/87；4 个自定义 HTTP 测试文件因固定复用 3000 端口、子进程退出竞态和 Windows libuv 关闭断言失败。失败文件内部业务断言多数通过，另有后续测试命中旧进程产生 429。该问题归入 REM-P2-001 测试基础设施整改，不影响本次 P0 专项 9/9 结论，但在修复前不得将全量后端门禁标记为通过。
- 模块化最终目标：未完全达成。REM-P1-006 至 REM-P1-010 完成前，不得宣称 V2 已完全遵守全部强制原则。

## 6. P0 执行记录

| 执行项 | 结果 |
|---|---|
| `npm run check:architecture` | 通过 |
| `npm run build`（backend） | 通过 |
| `node --test tests/p0-release-guards.test.mjs` | 9/9 通过 |
| `npm run lint`（frontend，执行 `tsc --noEmit`） | 通过 |
| `npm test`（backend 全量） | 未通过：83/87，测试服务器固定端口与进程关闭竞态 |

本次 P0 执行新增修复：

1. 删除 `quality-detection-service.ts` 中异常兜底的随机 60–95 分，统一改为 0 分失败关闭。
2. 扩展架构门禁，禁止质检服务重新引入随机分数或伪通过。
3. 补齐 `AppContext` 对 `shots`、`shotSnapshots` 的实际仓储装配，使声明、运行时依赖与镜头服务一致。
4. 新增真实 block 决策、非管理员成片回调、镜头状态绕过和归属字段保护测试。
