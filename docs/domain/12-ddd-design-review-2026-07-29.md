# DDD 设计评审（2026-07-29）

> **评审范围**：`docs/domain/` 10 个限界上下文、统一语言、上下文映射、跨上下文协作、依赖规则及其与需求/交付规格的追溯  
> **前置条件**：H-001、H-002、H-003、Timeline 实体，以及需求/UI 报告 P0/P1 整改已完成  
> **结论**：**Conditional Go**。领域骨架可以作为后续细化基线，但审核质量主链仍有 1 个 P0，另有 3 个 P1；关闭 DDD-P0-001 前不得冻结 Review & Quality 上下文或实现 QC→Review 编排。

## 1. 已通过项

| 评审面 | 结论 | 证据 |
|---|---|---|
| 限界上下文 | 通过 | 10 个上下文有明确核心/支撑域分类、责任、聚合与上下游关系 |
| 统一语言 | 通过 | ScriptAnalysis 仅保留一个权威值对象定义；状态与任务生命周期分离 |
| 状态机 | 通过 | PipelineNode 唯一枚举为 pending/running/completed/failed/skipped/retrying/paused |
| 聚合完整性 | 通过 | Timeline 内 Track/Clip/Cue/Transition 实体及 Effect/Timebase 值对象、版本和哈希不变量完整 |
| 跨上下文一致性 | 基本通过 | Outbox/Inbox、聚合版本顺序、ACL DTO、ID+version 引用和 SQLite UnitOfWork 边界明确 |
| 需求可验收性 | 通过 | 52 个功能、208 个目标 operation、109 个场景通过自动门禁；实现证据仍明确为 unverified |

## 2. 评审发现

### DDD-P0-001：Review Intake 没有正式的持久化流程管理器模型

当前文档已经规定“冻结快照 → QCReport → passed/waived → Review”，交付规格也出现 `review_intakes`，但审核质量上下文只定义 Review、QCReport、QualityRuleSet、ContinuityBaseline、ContinuityCase。`Review Intake` 仍是文字中的协调者，没有正式定义：

- 流程实例 ID、目标四元组、当前状态和版本；
- 启动、重试、阻断、豁免、创建 Review、取消/失效等命令；
- `submissionCommandId`、事件消费去重、QC attempt 链和 reviewId 的关联；
- 进程崩溃后从 Outbox/Inbox 恢复，以及重复 `QCReportCompleted/QCGateWaived` 不得创建第二个 Review 的不变量；
- 新 targetVersion 到达时旧 intake 的失效/终止规则。

这会让关键编排落入 Application Handler 或数据库脚本，无法由领域模型保证“同一目标版本最多创建一个有效 Review”。

**关闭条件**：在审核质量上下文明确 `ReviewIntake` 为 Process Manager（若采用聚合实现则注明聚合边界），补齐状态机、命令、事件、幂等/恢复不变量，并同步上下文契约与追溯矩阵。

### DDD-P1-001：领域追溯矩阵没有接入已生成的目标 API/场景证据

`11-traceability-matrix.md` 的 API/Schema 与验收列仍几乎全部为“待核验”，包括已进入目标 OpenAPI 和 Given/When/Then 的功能。它正确地区分了“目标设计”与“代码实现”，但没有链接 `operationIds`、scenario IDs 和 `requirementIds`，导致领域变更无法自动发现下游影响。

**关闭条件**：将目标契约证据和实现证据拆列；目标列引用生成矩阵，真实 code/migration/test 证据继续保持 unverified，新增门禁检查两者同步。

### DDD-P1-002：平台支撑能力出现在追溯表中，但不属于任何已声明边界

US-022/023、US-026、US-028、US-029 分别使用“平台身份能力、平台配置、平台数据交换、平台运维”，但 10 个限界上下文列表、上下文关系矩阵和 owner 规则没有这些边界。它们既不像纯技术设施（存在命令、状态和生命周期），也未明确归入现有上下文。

**关闭条件**：决定这些能力是独立支撑上下文、通用子域模块，还是现有上下文的应用服务；为每项指定事实源、聚合/流程所有者、事件和依赖方向，避免形成无人拥有的共享模型。

### DDD-P1-003：审核事件的快照字段命名尚未完全统一

Review 聚合字段和 QC 事件使用 `targetSnapshotHash`，但 `ReviewSubmitted`、`ReviewApproved` 等事件表使用 `snapshotHash`。语义虽然可推断，但跨上下文契约应避免同一身份字段出现两个名字。

**关闭条件**：统一为 `targetSnapshotHash`，对既有消费者定义兼容版本或事件 upcaster，并在契约校验中锁定 payload 字段。

## 3. 准入判定

| 范围 | 判定 |
|---|---|
| 继续领域建模、接口细化和边界稳定模块开发 | Go |
| Script、Pipeline、Timeline 相关领域设计 | Go |
| Review & Quality 上下文契约冻结 | No-Go，先关闭 DDD-P0-001 |
| 平台身份/配置/交换/运维能力并行实现 | Conditional Go，先明确 owner，不得建立共享可写模型 |
| 宣称 DDD 设计全面通过 | No-Go |

## 4. 建议关闭顺序

1. 定义 ReviewIntake Process Manager 及其恢复/幂等不变量；
2. 统一审核事件 `targetSnapshotHash`；
3. 将目标 OpenAPI/scenario 反向写入领域追溯矩阵并自动门禁；
4. 裁决平台支撑能力的上下文归属；
5. 复跑设计门禁并对 Review & Quality 做一次聚焦复评。

## 5. 校验证据

- `node scripts/generate-implementation-readiness.mjs`：52 features / 208 operations / 109 scenarios；
- `node scripts/check-implementation-readiness.mjs`：PASS；
- 本轮新增/修改前端文件 ESLint：PASS；
- 全量 TypeScript：未通过，原因是现有 `next` 包缺失声明文件及残留 `.next/.next-build` 类型引用；本轮唯一直接相关告警（通知页未使用 import）已修复。该结果属于实现环境问题，不改变 DDD 评审结论，也不能记为前端类型验收通过。
