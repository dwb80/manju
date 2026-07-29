# 3.5 AI 任务调度上下文 (AI Task Orchestration)

> **所属上下文**：AI 任务调度 (AI Task Orchestration)
> **聚合根**：`PipelineRun` / `AITask` / `ModelConfig` / `PipelineTemplate` / `Dataset` / `PromptTemplate` / `CapabilityTemplate`（P4 远期规划）
> **领域服务**：`BudgetCheckService`
> **对应页面**：AI 任务队列、视频生产线、模型中心、流水线模板中心、数据中心、Prompt 中心
> **配套规范**：[DDD 治理规范](../02-governance.md)｜[统一语言术语表](../03-glossary.md)｜[上下文映射](../04-context-map.md)｜[跨上下文协作契约](../05-contracts.md)

**边界**：AI 生成任务的创建、调度、执行、回调；模型配置管理（含能力标签和路由策略）；流水线模板管理；预算检查；数据集管理（训练/引用/导出）；Prompt 模板的创建、编辑、版本管理、变量化、发布和归档；项目数据统计（任务量 / Token 消耗 / 成本汇总）。

> **事件表说明**：聚合的"领域事件"表仅列出有消费者的关键事件。命令表"产出事件"列是事件全量来源。

---

## 1. 聚合根：PipelineRun

```text
PipelineRun
├── id: string
├── projectId: string
├── templateId: string
├── templateVersion: number
├── status: pending | running | paused | completed | failed | cancelled
├── nodes: PipelineNode[]
├── retryCount: number
├── maxRetry: number
├── version: number
├── createdAt: string
└── completedAt: string | null

PipelineNode
├── id: string
├── type: ai_task | review_gate | render | transform
├── status: pending | running | completed | failed | skipped | retrying | paused
├── dependencyIds: string[]
├── inputContract: DataContract
├── outputContract: DataContract
├── taskId: string | null
├── retryCount: number
├── heartbeatAt: string | null
└── outputSnapshot: unknown | null
```

### 1.1 Run 状态机（6 态）

```
pending ──start──▶ running ──finalize──▶ completed
                       │                     ▲
                    pause│              finalize
                       ▼                     │
                    paused ──resume──▶ running
                       │
                  running ──fail──▶ failed ──retryRun──▶ pending
                  running ──cancel──▶ cancelled
                  paused ──cancel──▶ cancelled
```

### 1.2 命令

`createRun` / `startRun` / `pauseRun` / `resumeRun` / `startNode` / `completeNode` / `failNode` / `retryNode` / `skipNode` / `finalizeRun` / `cancelRun` / `retryRun`

### 1.3 命令详情

| 命令 | 前置状态 | 产出事件 | 说明 |
|------|---------|---------|------|
| `cancelRun` | running / paused | `PipelineRunCancelled` | 用户主动取消流水线，终止执行。已完成的节点结果保留，未完成节点标记为 skipped |
| `retryRun` | failed | `PipelineRunRetried` | 重试失败的流水线，回退到 `pending` 等待重新启动。保留原 DAG 定义和已完成节点的结果，仅重试失败节点及其下游。受最大重试次数限制（默认 3 次） |

### 1.4 领域事件

`PipelineRunStarted` / `PipelineNodeCompleted` / `PipelineNodeFailed` / `PipelineRunCompleted` / `PipelineRunFailed` / `PipelineRunCancelled` / `PipelineRunPaused` / `PipelineRunResumed` / `PipelineRunRetried`

### 1.5 不变量

- DAG 前置依赖未满足时不能启动节点。
- 暂停中的 Run 不得调度新节点。
- 终态节点不能被重复完成。
- Retry 必须受重试策略和次数限制。
- 预算检查必须在实际调度前完成（通过 `BudgetCheckService`）。
- 重复执行结果通过幂等键去重。
- `cancelRun` 后已完成的节点结果保留不可回滚。
- `retryRun` 仅允许从 `failed` 状态触发，回退到 `pending`；重试次数耗尽后拒绝执行。
- `PipelineNodeStatus` 在本上下文中唯一合法取值为 `pending | running | completed | failed | skipped | retrying | paused`，与 §1.6 及代码状态机保持一致。
- `stale` 不是节点执行状态，而是节点输入或产出相对当前上游版本的**新鲜度**。新鲜度由 DEP/追溯读模型表达；发现过期时不得把节点状态改成 `stale`，而应保留原终态并创建重跑计划或新节点执行。
- 节点转换为：`pending → running`；`running → completed | failed`；`failed → retrying → running`；`pending | retrying → paused → pending`；`pending | retrying | paused → skipped`。`completed | failed | skipped` 为终态，其中 `failed` 只有经显式 `retryNode` 才进入 `retrying`。
- 项目归档后（收到 `ProjectArchived` 事件），本上下文所有 PipelineRun / AITask / PipelineTemplate / 项目级 PromptTemplate 资源标记为只读，拒绝执行 `createRun` / `startRun` / `CreateAITask` / `DispatchAITask` / `InstantiateTemplate` / `retryRun` / `CreatePromptTemplate` / `UpdatePromptTemplate` / `PublishPromptTemplate` / `CreateNewPromptVersion` / `ArchivePromptTemplate` 等写命令（全局 PromptTemplate 不受影响）；进行中的 Run 允许完成或取消，但不可新建；项目恢复后（`ProjectRestored`）解除只读。

### 1.6 值对象 / 内部实体

```
PipelineNode (Entity)
├── id: string                    // 节点唯一标识
├── runId: string                 // 所属 Run ID
├── projectId: string             // 所属项目 ID
├── type: PipelineNodeType        // 节点类型：image_generation | video_generation | tts | composition | render | review | quality_check | notification | wait | webhook
├── name: string                  // 节点名称
├── status: PipelineNodeStatus    // 节点状态：pending | running | completed | failed | skipped | retrying | paused
├── config: Record<string, unknown>  // 节点配置（模型引用、参数等）
├── inputData: Record<string, unknown>  // 输入数据
├── outputData: Record<string, unknown> // 输出数据
├── error: string                 // 错误信息
├── retryCount: number            // 重试次数
├── startedAt: string             // 开始执行时间
├── completedAt: string           // 完成时间
├── idempotencyKey: string        // 幂等键（同项目下重跑复用历史结果）
├── priority: number              // 节点优先级：0=low | 1=normal | 2=high | 3=urgent（数值越大越优先）
├── createdAt: string             // 创建时间
└── updatedAt: string             // 更新时间
```

---

## 2. 聚合根：AITask

```
AITask (Aggregate Root)
├── id: string
├── projectId: string
├── type: AITaskType                // image | video | audio | text
├── status: AITaskStatus            // queued | running | completed | failed | cancelled
├── provider: string                // AI 服务商标识
├── modelConfigId: string           // 引用模型配置
├── input: AITaskInput              // 输入参数（值对象）
├── output: AITaskOutput | null     // 输出结果（值对象）
├── cost: number | null             // 本次消耗（仅 CompleteAITask 设置）
├── idempotencyKey: string          // 防止同一次用户意图重复创建
├── providerRequestId: string | null // Dispatch 后由 Provider 返回
├── target: AITaskTarget            // shot | asset | edit_project | script
├── pipelineRunId: string | null    // 关联流水线
├── pipelineNodeId: string | null
├── shotId: string | null           // 关联分镜
├── retryCount: number
├── maxRetry: number
├── version: number
├── createdAt: string
├── completedAt: string | null
└── errorMessage: string | null
```

### 2.1 状态机

```
┌────────┐  dispatch  ┌────────┐  complete  ┌───────────┐
│ queued │──────────▶│ running│───────────▶│ completed │
└───┬────┘           └───┬────┘            └───────────┘
    │ cancel              │ cancel
    ▼                     ▼
┌──────────┐         ┌──────────┐
│cancelled │         │cancelled │
└──────────┘         └──────────┘
                         │
                         │ fail
                         ▼
                    ┌────────┐  retry  ┌────────┐
                    │ failed │────────▶│ queued │
                    └────────┘         └────────┘
```

### 2.2 命令

| 命令 | 前置状态 | 产出事件 | 说明 |
|------|---------|---------|------|
| `CreateAITask` | 不存在 | `AITaskCreated` | 创建 AI 任务 |
| `DispatchAITask` | queued | `AITaskDispatched` | 分发给 Provider |
| `CompleteAITask` | running | `AITaskCompleted` | Provider 回调成功。payload 携带 `type` 字段，消费者按类型路由（路由规则见下表） |
| `FailAITask` | running | `AITaskFailed` | Provider 回调失败 |
| `CancelAITask` | queued / running | `AITaskCancelled` | 主动取消 |
| `RetryAITask` | failed | `AITaskRetried` | 重试（受 maxRetry 限制，retryCount + 1） |

### 2.3 `AITaskCompleted` 按 type 路由规则

| type | 消费上下文 | 消费动作 |
|------|-----------|---------|
| `video` | 分镜导演 | 创建视频候选版本（不自动采纳） |
| `image` + target=shot | 分镜导演 | 创建图片候选版本（不自动采纳） |
| `image` + target=asset | 资产库 | 创建资产图片候选版本（不自动发布） |
| `audio` | 后期制作 | 创建或绑定 AudioAsset 候选 |
| `text` | 剧本创作 | 绑定 AI 辅助文本到剧本 |

### 2.4 不变量

- 相同 `idempotencyKey` 的创建请求只产生一个任务；同一分镜允许以不同生成意图创建多个候选。
- Provider 回调按 `providerRequestId` 幂等；回调还必须匹配 taskId、目标版本和当前 aggregateVersion。
- `maxRetry` 耗尽后 `RetryAITask` 被拒绝。
- `CompleteAITask` 必须携带有效 `output`，且 `cost` 仅在 `CompleteAITask` 时设置（其他命令不可修改 `cost`）。
- 失败任务不可 `CompleteAITask`。
- `queued` / `running` 状态不可直接跳到 `completed`（必须经过 dispatch）。

### 2.5 领域事件

| 事件 | Payload | 消费者 |
|------|---------|-------|
| `AITaskCreated` | taskId, projectId, type, shotId | 调度器（上下文内） |
| `AITaskDispatched` | taskId, provider, modelConfigId | 调度器（上下文内） |
| `AITaskCompleted` | taskId, projectId, type, target, outputMediaVersions[], cost, executionSnapshot, executionSnapshotHash | 按 type 和 target 路由创建候选；智能助手登记 DEP 执行证据 |
| `AITaskFailed` | taskId, projectId, type, errorMessage | 分镜导演（标记生成失败）、智能助手（重试耗尽后创建工作项）、通知（告警责任人） |
| `AITaskCancelled` | taskId, projectId, type | 智能助手 |
| `AITaskRetried` | taskId, retryCount | 调度器（上下文内） |

---

## 3. 聚合根：ModelConfig

```
ModelConfig (Aggregate Root)
├── id: string
├── name: string
├── provider: string               // openai | stability | agnes | ...
├── modelType: string              // image | video | audio | text
├── apiConfig: ApiConfig           // 端点和密钥（值对象）
├── parameters: ModelParameters    // 默认参数（值对象）
├── quota: ModelQuota              // 配额限制（值对象）
├── capabilities: ModelCapability[]  // 能力标签
├── sceneTags: string[]            // 适用场景：character_design | scene | storyboard | poster
├── ratings: ModelRating           // 评分：质量/速度/成本
├── isDefault: boolean             // 是否为某场景的默认模型
├── priority: number               // 路由优先级
├── status: ConfigStatus           // inactive | active
├── version: number
├── createdAt: string
└── updatedAt: string
```

### 3.1 状态机

```
┌──────────┐  activate  ┌────────┐
│ inactive │───────────▶│ active │
└──────────┘             └───┬───┘
    ▲                         │ deactivate
    └─────────────────────────┘
```

### 3.2 命令

| 命令 | 前置状态 | 产出事件 | 说明 |
|------|---------|---------|------|
| `CreateModelConfig` | 不存在 | `ModelConfigCreated` | 注册新模型 |
| `UpdateModelConfig` | active / inactive | `ModelConfigUpdated` | 修改参数/能力标签/场景标签 |
| `ActivateModelConfig` | inactive | `ModelConfigActivated` | 启用模型 |
| `DeactivateModelConfig` | active | `ModelConfigDeactivated` | 停用模型 |
| `UpdateQuota` | active | `ModelConfigQuotaUpdated` | 调整配额 |

### 3.3 不变量

- 同一 provider + modelType 下名称不可重复。
- 配额耗尽时新任务自动排队，不拒绝创建。
- 密钥字段不通过 API 返回。
- 同一 sceneTag 下只能有一个 `isDefault = true` 的模型（修改时如产生冲突，旧默认模型的 `isDefault` 必须先置 `false`）。

### 3.4 领域事件

| 事件 | Payload | 消费者 |
|------|---------|-------|
| `ModelConfigCreated` | modelConfigId, provider, modelType, capabilities | 智能助手（更新模型列表） |
| `ModelConfigUpdated` | modelConfigId, changedFields | 智能助手 |
| `ModelConfigActivated` | modelConfigId | 调度器（可分配新任务） |
| `ModelConfigDeactivated` | modelConfigId | 调度器（停止分配新任务） |
| `ModelConfigQuotaUpdated` | modelConfigId, quota | 调度器（更新配额缓存） |

---

## 4. 聚合根：PipelineTemplate

> PipelineTemplate 是流水线模板中心的核心载体：可配置的生产流水线模板，可实例化为 PipelineRun。

```
PipelineTemplate (Aggregate Root)
├── id: string
├── name: string
├── description: string
├── status: TemplateStatus          // draft | published | archived
├── nodes: TemplateNode[]           // DAG 节点定义
├── edges: TemplateEdge[]           // DAG 边定义（依赖关系）
├── variables: TemplateVariable[]   // 可变参数定义
├── version: number
├── createdAt: string
├── updatedAt: string
├── publishedAt: string | null
└── archivedAt: string | null
```

### 4.1 状态机

```
┌────────┐  publish  ┌───────────┐  archive  ┌──────────┐
│ draft  │─────────▶│ published │──────────▶│ archived │
└────────┘           └───────────┘           └────┬─────┘
                                                   │ restore
                                                   ▼
                                              ┌───────────┐
                                              │ published │
                                              └───────────┘
```

### 4.2 命令

| 命令 | 前置状态 | 产出事件 | 说明 |
|------|---------|---------|------|
| `CreateTemplate` | 不存在 | `TemplateCreated` | 创建流水线模板 |
| `UpdateTemplate` | draft | `TemplateUpdated` | 编辑模板节点和边 |
| `PublishTemplate` | draft | `TemplatePublished` | 发布模板，可被实例化 |
| `ArchiveTemplate` | published | `TemplateArchived` | 归档模板 |
| `RestoreTemplate` | archived | `TemplateRestored` | 恢复归档模板 |
| `InstantiateTemplate` | published | `TemplateInstantiated` | 从模板创建 PipelineRun 实例 |

### 4.3 不变量

- 已发布模板不可修改节点结构，只能新建版本或归档后修改。
- DAG 不能存在环（模板发布前校验）。
- 模板变量必须有默认值或标记为必填。

### 4.4 领域事件

| 事件 | Payload | 消费者 |
|------|---------|-------|
| `TemplateCreated` | templateId, name | 智能助手 |
| `TemplateUpdated` | templateId, changedFields | 智能助手 |
| `TemplatePublished` | templateId, name, version | 智能助手 |
| `TemplateArchived` | templateId | 智能助手 |
| `TemplateRestored` | templateId | 调度器 |
| `TemplateInstantiated` | templateId, pipelineRunId | 智能助手（更新流水线列表） |

### 4.5 值对象

```
TemplateNode (Value Object)
├── id: string                    // 节点唯一标识
├── type: string                  // 节点类型：ai_task | transform | condition | io
├── name: string                  // 节点名称
├── config: Record<string, unknown>  // 节点配置（模型引用、参数等）
├── inputs: Port[]                // 输入端口定义
└── outputs: Port[]               // 输出端口定义

TemplateEdge (Value Object)
├── fromNodeId: string            // 起始节点 ID
├── toNodeId: string              // 目标节点 ID
└── condition: string | null      // 边触发条件（空表示无条件依赖）

TemplateVariable (Value Object)
├── name: string                  // 变量名（与模板中占位符对应）
├── type: string                  // 变量类型：text | number | select
├── defaultValue: string          // 默认值
├── required: boolean             // 是否必填（必填时实例化必须提供）
└── description: string           // 变量用途说明
```

---

## 5. 领域服务：BudgetCheckService

> BudgetCheckService 是"AI 成本可控"原则的核心机制。预算检查是跨上下文横切关注点，依赖外部状态（项目累计消耗），不适合作为聚合不变量。

```
BudgetCheckService (Domain Service)
├── checkBeforeDispatch(task: AITask): BudgetResult
│   // 在 AITask 分发前检查项目预算余量
├── recordConsumption(task: AITask, cost: number): void
│   // 在 AITask 完成后记录消耗
├── getRemainingBudget(projectId: string, period: BudgetPeriod): number
│   // 查询项目在指定周期内的剩余预算
└── getProjectConsumption(projectId: string, period: BudgetPeriod): ConsumptionSummary
    // 查询项目在指定周期内的消耗汇总
```

```
BudgetPeriod (Value Object)
├── type: string               // daily | weekly | monthly | total
├── startDate: string
└── endDate: string

BudgetResult (Value Object)
├── allowed: boolean
├── remaining: number
├── limit: number
└── message: string | null
```

> 预算检查集成点：`PipelineRun.startNode` 和 `AITask.DispatchAITask` 在执行前调用 `BudgetCheckService.checkBeforeDispatch`，`AITask.CompleteAITask` 在完成后调用 `recordConsumption`。

预算检查必须采用“预占—结算—释放”：Dispatch 前原子预占估算成本，完成后按实际成本结算，失败或取消时释放预占，避免并发任务共同穿透预算。

```text
BudgetReservation
├── id: string
├── projectId: string
├── taskId: string
├── policyVersion: number
├── estimatedCost: number
├── settledCost: number | null
├── currency: string
├── status: reserved | settled | released | expired
├── expiresAt: string
├── idempotencyKey: string
└── updatedAt: string
```

预算闭环规则：

1. 项目预算由项目管控 `ConfigureProjectBudget` 管理；AI任务调度只消费 `ProjectBudgetConfigured` 投影，不反向修改 Project。
2. `DispatchAITask` 在同一事务内检查可用余额、创建 BudgetReservation、更新预算计数并写 Outbox；预算不足不创建外部 Provider 请求。
3. 达到 `alertThreshold` 但未达到 hardCap 时返回/发布预算警告；是否需要 owner/admin 确认由 policy 决定。
4. 达到 hardCap 时使用 `budget_exceeded` 阻断；不得通过换路由、重试或拆分任务绕过。
5. 完成后按 Provider 账单/计价快照结算；差额释放。失败、取消、创建外部请求失败和预约过期均释放。
6. 预约释放、结算和过期扫描均以 reservationId 幂等；任何 reservation 不得同时 settled 和 released。
7. 价格表、币种和汇率版本必须随任务冻结；历史成本不随新价格重算。
8. 每日执行 reservation—task—cost_records 对账；不一致生成审计告警和人工 WorkItem。
9. `BudgetThresholdReached`、`BudgetExceeded`、`BudgetReconciliationFailed` 由通知上下文路由给 producer/owner/ai_admin。

配置入口：项目设置“预算与成本”页提供周期、limit、hardCap、alertThreshold、超阈值审批和币种；修改使用乐观锁、命令级权限和 AuditRecord，不能直接编辑 `project_budgets` 投影表。

### 5.1 跨聚合数据获取方式（CQRS 读模型投影）

> BudgetCheckService 是跨聚合的领域服务，**不直接访问 AITask 聚合或 Project 聚合**。所有跨聚合数据均通过 CQRS 读模型投影（查询侧）获取，遵循"写侧产出事件 / 记账 → 投影更新读模型 → 领域服务查询读模型"的单向数据流，避免聚合间的直接引用耦合。

| 数据需求 | 读模型（投影表） | 数据来源（写侧） | 更新触发 |
|---------|----------------|----------------|---------|
| 项目预算配置（`monthly_limit` / `hard_cap` / `alert_threshold`） | `project_budgets` | 项目管控上下文 Project 聚合的预算设置 | 预算设置 / 更新时写入投影表 |
| 项目累计消耗 | `cost_records` | 本上下文 `AITask.CompleteAITask` 完成后调用 `recordConsumption` | AITask 完成事件驱动记账（带 `idempotency_key` 幂等去重） |

**数据流说明**：

1. **预算配置**：项目管控上下文管理预算配置（属于 Project 聚合的横切配置），预算设置 / 更新时写入 `project_budgets` 投影表。BudgetCheckService 通过 `getRemainingBudget` 查询该投影表获取预算上限，不直接访问 Project 聚合。
2. **消耗累计**：AITask 完成后（`CompleteAITask`），本上下文调用 `recordConsumption` 将单次消耗写入 `cost_records` 审计表（按 `YYYY-MM` 月份键归档，带 `idempotency_key` 防重入）。BudgetCheckService 通过 `getProjectConsumption` 聚合查询该表获得项目累计消耗，不直接遍历 AITask 聚合。
3. **预算检查**：`checkBeforeDispatch` 综合查询上述两个读模型投影——读取预算上限（`project_budgets`）和当前累计消耗（`cost_records`），计算剩余预算并判定是否放行（fail-closed：预估超额即拒绝调度）。

> **实现对应**：代码实现中，`BudgetService`（`backend/src/services/horizontal/budget-service.ts`）通过 `project_budgets` 和 `cost_records` 两张投影表完成预算查询与成本记账；`assertBudgetCapacityForNodes`（`backend/src/services/module-domain/pipeline-budget.ts`）在 Pipeline 节点调度前调用 `estimateCost` 进行前置校验。领域服务不持有任何聚合根引用，仅依赖读模型投影。

---

## 6. 聚合根：Dataset

> Dataset 管理训练/引用/导出数据集，为 AI 模型训练和任务执行提供数据支撑。

```
Dataset (Aggregate Root)
├── id: string
├── name: string
├── type: DatasetType              // training | reference | export
├── status: DatasetStatus          // draft | importing | exporting | ready | archived
├── projectId: string | null       // null = 全局数据集
├── itemCount: number
├── storagePath: string
├── version: number
├── createdAt: string
├── updatedAt: string
└── deletedAt: string | null
```

### 6.1 状态机

```
┌────────┐  import  ┌──────────┐  complete  ┌────────┐  archive  ┌──────────┐
│ draft  │────────▶│importing │───────────▶│ ready  │──────────▶│ archived │
└────────┘          └──────────┘            └────┬───┘           └──────────┘
                                                  │ export
                                                  ▼
                                          ┌──────────┐  complete  ┌────────┐
                                          │exporting │───────────▶│ ready  │
                                          └──────────┘             └────────┘
```

### 6.2 命令

| 命令 | 前置状态 | 产出事件 | 说明 |
|------|---------|---------|------|
| `CreateDataset` | 不存在 | `DatasetCreated` | 创建数据集 |
| `ImportData` | draft / ready | `DatasetImportStarted` | 导入数据 |
| `CompleteImport` | importing | `DatasetImportCompleted` | 导入完成（itemCount 更新） |
| `ExportDataset` | ready | `DatasetExportStarted` | 导出数据集 |
| `CompleteExport` | exporting | `DatasetExportCompleted` | 导出完成 |
| `ArchiveDataset` | ready | `DatasetArchived` | 归档 |
| `SoftDeleteDataset` | draft / ready / archived | `DatasetDeleted` | 软删除数据集，写入 `deletedAt`；支持 5 秒撤销，30 天宽限期内可恢复，超期走物理删除（管理接口） |

### 6.3 不变量

- 训练数据集的 `itemCount` 必须大于 0 才能标记为 `ready`。
- 引用数据集不可删除被模型配置引用的项。
- 导入/导出进行中不可执行其他操作（`importing` / `exporting` 状态下拒绝非完成命令）。
- 数据集软删除统一使用 `deletedAt` 字段标记，与工厂实体（Character/Scene/Prop）、Script、Episode 等保持一致；支持 5 秒撤销，30 天宽限期内可恢复，超过后走物理删除（管理接口）。
- `archived` 是数据集的生命周期状态（归档后不可导入/导出，仅可软删除），与 `deletedAt` 软删除相互独立：归档不等于删除，软删除不改变 `status`，与工厂实体 `archived` 状态语义一致。

### 6.4 领域事件

| 事件 | Payload | 消费者 |
|------|---------|-------|
| `DatasetCreated` | datasetId, name, type, projectId | 智能助手（更新数据集列表） |
| `DatasetImportCompleted` | datasetId, itemCount | 智能助手（更新数据集状态） |
| `DatasetExportCompleted` | datasetId, storagePath | 智能助手（更新数据集状态） |
| `DatasetArchived` | datasetId | 智能助手（更新数据集状态） |
| `DatasetDeleted` | datasetId | 智能助手 |

### 6.5 读模型

| 读模型 | 数据来源 | 页面 |
|-------|---------|------|
| AI 调用日志 | ModelCallLog（审计表） | 数据中心 — 调用记录 |
| 模型配置列表 | ModelConfig 聚合（上下文内直接访问） | 数据中心 — 模型管理 |
| 数据集列表 | Dataset 聚合 | 数据中心 — 数据集 |
| 项目 AI 统计 | `AITaskCompleted` / `AITaskFailed` 事件聚合 + `BudgetCheckService` 消耗记录（按 `projectId` 维度汇总：任务量 / Token / 成本 / 预算余量） | 数据中心 — 统计概览 |

---

## 7. 聚合根：PromptTemplate

> PromptTemplate 管理 Prompt 模板的创建、编辑、版本管理、变量化、发布和归档，为 AI 任务提供标准化 Prompt 输入。

```
PromptTemplate (Aggregate Root)
├── id: string
├── projectId: string | null       // null = 全局模板
├── name: string
├── description: string
├── status: PromptTemplateStatus    // draft | published | archived
├── category: string                // character_design | scene | storyboard | poster | script_analysis | custom
├── content: string                 // Prompt 正文（含变量占位符 {{variable}}）
├── variables: PromptVariable[]     // 变量定义
├── sceneTags: string[]             // 适用场景标签
├── modelType: string               // 适用模型类型 text | image | video | audio
├── previousVersionId: string | null  // 上一版本 ID
├── currentVersion: number
├── version: number                 // 乐观锁
├── createdAt: string
├── updatedAt: string
├── publishedAt: string | null
└── archivedAt: string | null
```

### 7.1 状态机

```
┌────────┐  publish  ┌───────────┐  archive  ┌──────────┐
│ draft  │─────────▶│ published │──────────▶│ archived │
└────────┘           └─────┬─────┘           └────┬─────┘
                           │ createNewVersion      │ restore
                           ▼                       ▼
                      ┌────────┐            ┌───────────┐
                      │ draft  │            │ published │
                      │(新实例) │            └───────────┘
                      └────────┘
```

> `createNewVersion` 实际是创建新聚合实例并通过 `previousVersionId` 形成版本链，原 `published` 实例保持终态不变。

### 7.2 命令

| 命令 | 前置状态 | 产出事件 | 说明 |
|------|---------|---------|------|
| `CreatePromptTemplate` | 不存在 | `PromptTemplateCreated` | 创建 Prompt 模板 |
| `UpdatePromptTemplate` | draft | `PromptTemplateUpdated` | 编辑 Prompt 内容和变量 |
| `PublishPromptTemplate` | draft | `PromptTemplatePublished` | 发布版本，创建不可变快照 |
| `CreateNewPromptVersion` | published | `PromptNewVersionCreated` | 从已发布版本创建新草稿版本（新实例，previousVersionId 链接） |
| `ArchivePromptTemplate` | published | `PromptTemplateArchived` | 归档 |
| `RestorePromptTemplate` | archived | `PromptTemplateRestored` | 恢复归档到 published |

### 7.3 不变量

- 已发布版本的 `content` 不可修改，只能通过 `CreateNewPromptVersion` 创建新版本。
- 变量占位符必须与 `variables` 定义一一对应（发布前校验）。
- 新版本引用 `previousVersionId`，形成版本链。
- AI 任务调度引用 Prompt 时，必须引用已发布版本（`status = published`）。
- 全局模板（`projectId = null`）仅 admin 可创建/修改/发布；项目级模板受项目权限约束。
- 项目归档后，项目级 PromptTemplate 标记为只读，拒绝写命令（详见 §1.5 不变量）；全局模板不受影响。

### 7.4 领域事件

| 事件 | Payload | 消费者 |
|------|---------|-------|
| `PromptTemplateCreated` | templateId, projectId, category | 智能助手 |
| `PromptTemplateUpdated` | templateId, projectId | 智能助手 |
| `PromptTemplatePublished` | templateId, projectId, version | 本上下文（可引用提示） |
| `PromptNewVersionCreated` | templateId, projectId, previousVersionId, newVersion | 本上下文 |
| `PromptTemplateArchived` | templateId, projectId | 本上下文（引用失效提醒） |
| `PromptTemplateRestored` | templateId, projectId | 本上下文 |

---

## 8. 值对象

| 值对象 | 字段 | 说明 |
|-------|------|------|
| `ApiConfig` | `endpoint: string`, `apiKeyRef: string`, `timeout: number` | API 端点和密钥引用 |
| `ModelParameters` | `temperature: number`, `maxTokens: number`, `custom: Record<string, unknown>` | 模型默认参数 |
| `ModelQuota` | `dailyLimit: number`, `monthlyLimit: number`, `currentDaily: number`, `currentMonthly: number` | 配额限制 |
| `ModelCapability` | `type: string`, `tags: string[]`, `score: number` | 能力标签。type: text_reasoning \| image_gen \| image_edit \| video_gen \| audio_gen；tags: [角色一致性, 真实风格, 古风, 动画, 电影感]；score: 1-5 |
| `ModelRating` | `quality: number`, `speed: number`, `cost: number` | 评分（1-5） |
| `AITaskInput` | `prompt: string`, `params: Record<string, unknown>`, `references: string[]` | 任务输入 |
| `AITaskOutput` | `url: string`, `metadata: Record<string, unknown>`, `duration: number` | 任务输出 |
| `AITaskTarget` | `type: "shot" | "asset" | "edit_project" | "script"`, `id: string`, `version: number` | 明确结果归属和回调版本，禁止仅依赖可空 shotId 路由 |
| `ModelExecutionSnapshot` | `provider`, `modelId`, `modelVersion`, `promptTemplateId`, `promptVersion`, `resolvedPrompt`, `parameters`, `seed`, `referenceVersions` | 任务创建时冻结，确保结果可追溯和可复现 |
| `PromptVariable` | `name: string`, `type: "text" \| "number" \| "select"`, `defaultValue: string`, `required: boolean`, `options: string[]` | Prompt 变量定义 |
| `TemplateNode` | `id`, `type`, `inputContract`, `outputContract`, `config`, `retryPolicy` | 流水线模板节点定义 |
| `TemplateEdge` | `fromNodeId`, `toNodeId`, `condition` | DAG 依赖边；发布前执行无环校验 |
| `TemplateVariable` | `name`, `type`, `required`, `defaultValue`, `validation` | 实例化参数定义 |
| `DataContract` | `mediaType`, `schemaVersion`, `requiredFields` | 节点间输入输出契约 |

---

## 9. 聚合根：CapabilityTemplate（P4 远期规划）

### CapabilityTemplate 聚合（P4 远期规划）

> AI 能力模板是高级编排能力，用于串联多模型节点形成复合流水线。

**聚合根**：`CapabilityTemplate`
**状态**：draft → published → archived
**关键不变量**：节点间数据契约必须匹配（上游输出类型 = 下游输入类型）
