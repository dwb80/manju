# 3.6 审核质量上下文 (Review & Quality)

> **所属上下文**：审核质量 (Review & Quality)
> **聚合根**：`Review` / `QCReport` / `ContinuityBaseline` / `ContinuityCase`
> **对应页面**：审核中心、专业审片台、质检中心、连续性检查台
> **配套规范**：[DDD 治理规范](../02-governance.md)｜[统一语言术语表](../03-glossary.md)｜[上下文映射](../04-context-map.md)｜[跨上下文协作契约](../05-contracts.md)

**边界**：人工审核与结构化批注；自动质检配置、执行和报告；Episode 连续性基线、问题发现、豁免和复检闭环。

> **事件表说明**：聚合的"领域事件"表仅列出有消费者的关键事件。命令表"产出事件"列是事件全量来源。

---

## 1. 聚合根：Review

```
Review (Aggregate Root)
├── id: string
├── projectId: string
├── targetType: string               // shot | video | image | audio | final_video | subtitle
├── targetId: string                 // 被审核对象 ID
├── targetVersion: number            // 审核对象不可变版本
├── targetSnapshotHash: string        // Shot/FinalVideo 等送审快照哈希
├── status: ReviewStatus             // pending | in_review | approved | rejected | needs_fix | closed | cancelled
├── stage: ReviewStage               // single | first | second
├── policyVersion: number             // 冻结的审核策略版本
├── round: number                    // 返工重提轮次，从 1 开始
├── reviewer: string | null          // 审核人 UserId
├── assignedBy: string               // 分配人 UserId
├── reason: string | null            // 驳回/返工原因
├── decision: string | null          // 审核决策说明
├── previousReviewId: string | null  // 前序审核 ID（重新提交时链接）
├── returnStage: string | null       // script | image | video | audio | subtitle | edit
├── items: ReviewItem[]              // 维度评分和意见
├── annotations: ReviewAnnotation[]  // 绑定当前目标版本/快照的时码与区域批注
├── version: number
├── createdAt: string
├── updatedAt: string
└── closedAt: string | null
```

> **权威转换规则**：`in_review` 可执行通过、驳回或请求修改；`RequestReviewChanges` 直接进入 `needs_fix`，不是先进入 `rejected`。`RejectReview` 进入 `rejected` 并终结本轮。图示如与本规则冲突，以本表和命令表为准。

### 1.1 状态机（7 态）

```text
pending ─StartReview─▶ in_review ─ApproveReview─▶ approved ─CloseReview─▶ closed
   │                       ├─RejectReview─▶ rejected ─CloseReview─▶ closed
   │                       └─RequestReviewChanges─▶ needs_fix ─ResubmitReview─▶ pending
   └─CancelReview─▶ cancelled
```

### 1.2 命令

| 命令 | 前置状态 | 产出事件 | 说明 |
|------|---------|---------|------|
| `SubmitReview` | 不存在 | `ReviewSubmitted` | 创建审核（由 `ShotSubmittedForReview` 事件触发） |
| `AssignReviewer` | pending | `ReviewAssigned` | 分配审核人 |
| `StartReview` | pending | `ReviewStarted` | 开始审核 |
| `ApproveReview` | in_review | `ReviewStageApproved` / `ReviewApproved` | first 阶段通过后创建 second 阶段待审；single/second 通过才发布 ReviewApproved |
| `RejectReview` | in_review | `ReviewRejected` | 审核驳回（必须携带原因） |
| `RequestReviewChanges` | in_review | `ReviewChangesRequested` | 请求修改并记录打回环节，进入 needs_fix |
| `AddReviewAnnotation` | in_review | `ReviewAnnotationAdded` | 新增版本化时码/画面区域批注 |
| `ResolveReviewAnnotation` | needs_fix / in_review | `ReviewAnnotationResolved` | 提交修复说明和修复版本；不自动批准审核 |
| `ReopenReviewAnnotation` | in_review | `ReviewAnnotationReopened` | 复审发现未修复时重新打开 |
| `ResubmitReview` | needs_fix | `ReviewResubmitted` | 重新提交审核 |
| `CloseReview` | approved / rejected | `ReviewClosed` | 关闭审核 |
| `CancelReview` | pending | `ReviewCancelled` | 取消审核 |

### 1.3 领域事件

| 事件 | Payload | 消费者 |
|------|---------|-------|
| `ReviewSubmitted` | reviewId, projectId, targetType, targetId, targetVersion, snapshotHash, stage | 智能助手（创建审核工作项、DEP 审核依赖） |
| `ReviewAssigned` | reviewId, projectId, reviewer | 通知（通知审核人） |
| `ReviewApproved` | reviewId, projectId, targetType, targetId, targetVersion, snapshotHash, stage, decisionId | 分镜导演（驱动 Shot → approved）、AI任务调度（驱动 Pipeline 审核节点）、智能助手（工作项与 DEP 审核证据） |
| `ReviewStageApproved` | reviewId, projectId, targetId, completedStage, nextStage | 智能助手（创建下一阶段审核工作项） |
| `ReviewRejected` | reviewId, projectId, targetId, reason | 分镜导演（驱动 Shot → rejected）、AI任务调度（失败/路由 Pipeline 审核节点）、智能助手（新增返工工作项） |
| `ReviewChangesRequested` | reviewId, projectId, targetType, targetId, targetVersion, snapshotHash, returnStage, reason, decisionId | 目标上下文（进入 needs_fix）、智能助手（返工工作项与 DEP 审核证据） |
| `ReviewAnnotationAdded` | reviewId, annotationId, targetVersion, snapshotHash, dimension, severity, timeRange, region, returnStage | 智能助手（返工明细）、目标上下文（只读提示） |
| `ReviewAnnotationResolved` | reviewId, annotationId, resolvedBy, resolution, fixedTargetVersion, fixedSnapshotHash | 智能助手（返工核销视图） |
| `ReviewAnnotationReopened` | reviewId, annotationId, reviewer, reason | 智能助手（恢复返工项） |
| `ReviewResubmitted` | reviewId, projectId, targetId | 智能助手 |
| `ReviewClosed` | reviewId, projectId | 智能助手 |
| `ReviewCancelled` | reviewId, projectId | 智能助手 |

### 1.4 不变量

- 只有 `in_review` 状态允许审核决策或驳回。
- 驳回必须携带有效原因。
- FinalVideo 审核必须包含内容合规、版权、质量、剧情连贯性四个 ReviewItem，单项 1-5 分。
- 配置为两级审核时，只有 second 阶段通过才允许发布 `ReviewApproved`；first 阶段通过不得使目标对象进入 approved。
- 首个正式产品的审核策略固定为：`final_video=first+second`，shot/image/video/audio/subtitle=`single`；暂不支持用户任意编排会签。策略变化必须创建版本且不影响进行中 Review。
- FinalVideo 的 first 与 second 阶段不得由同一用户完成；审核人不得批准自己作为主要制作者提交的制品，owner/admin 仅可重新分配或走有审计的紧急覆盖流程。
- Review 必须固定 `targetVersion`，对象产生新版本后原审核结论不得自动继承。
- 对支持快照的目标必须同时固定 `targetSnapshotHash`；哈希变化时旧结论立即失效且不得进入发布预检。
- 重新提交只能从 `needs_fix` 进入。
- 外部服务（非审核质量上下文）不得修改审核状态，只能通过事件驱动。
- 批注坐标使用归一化坐标，时间使用整数毫秒；批注必须绑定 Review 的 `targetVersion + targetSnapshotHash`。
- `RequestReviewChanges` 必须至少存在一条 open/reopened 批注或结构化原因；阻断批注未解决时 `ApproveReview` 被拒绝。
- 修复者只能提交解决说明和修复版本，不能替审核员批准；新版本中的复制批注默认为待复核。
- Review closed 后批注只读；批注软删除仅隐藏正文并保留作者、时间和审计占位。

---

## 2. 聚合根：QCReport

```
QCReport (Aggregate Root)
├── id: string
├── projectId: string
├── targetType: string             // shot | video | image | audio
├── targetId: string               // 被质检对象 ID
├── status: QCReportStatus         // running | completed | failed | timed_out
├── previousReportId: string | null  // 前序报告 ID（重新生成时链接）
├── config: QCConfig               // 质检配置（值对象）
├── ruleSetId: string
├── ruleSetVersion: number          // 运行时冻结的规则集版本
├── deadlineAt: string
├── attempt: number
├── scores: QCScores               // 评分汇总（值对象）
├── rules: QCRuleResult[]          // 逐条规则结果
├── overallScore: number           // 综合分 0-100
├── passed: boolean | null         // 是否通过阈值
├── version: number
├── createdAt: string
├── completedAt: string | null
└── errorMessage: string | null
```

### 2.1 状态机

```
                ┌────────┐
                │running │──complete──▶┌───────────┐
                └───┬────┘             │ completed │  (终态，不可变更)
                    │ fail             └───────────┘
                    ▼
                ┌────────┐
                │ failed │  (终态，不可变更)
                └────────┘

重新生成 = 创建新的 QCReport 聚合实例（新 id），previousReportId 链接旧报告。
原报告保持终态不变。
```

### 2.2 命令

| 命令 | 前置状态 | 产出事件 | 说明 |
|------|---------|---------|------|
| `GenerateQCReport` | 不存在 | `QCReportGenerationStarted` | 触发质检（首次或重新生成均用此命令创建新实例） |
| `StartQCReport` | 不存在 | `QCReportStarted` | 状态机进入 running（`GenerateQCReport` 创建后内部立即调用） |
| `CompleteQCReport` | running | `QCReportCompleted` | 质检完成 |
| `FailQCReport` | running | `QCReportFailed` | 质检异常 |
| `TimeoutQCReport` | running 且超过 deadlineAt | `QCReportTimedOut` | 定时扫描原子抢占；按策略重试、人工接管或阻断 |

> 重新生成的语义等同于 `GenerateQCReport`（创建新聚合实例），通过 `previousReportId` 链接旧报告。`completed` 和 `failed` 均为终态，原报告保持不变。

### 2.3 不变量

- 报告生成后不可修改，只能创建新报告聚合（通过 `previousReportId` 链接）。
- `overallScore` 由各规则得分加权计算，不可直接设置。
- `passed` 由 `overallScore` 与 `config.threshold` 比较得出。
- `running` 状态以外的报告不可执行 `CompleteQCReport`。
- 创建报告时必须冻结已发布 QualityRuleSet 的 ID+版本；运行中配置变化不影响本报告。
- `deadlineAt` 必须由规则集 timeoutSeconds 计算；Complete 与 Timeout 通过乐观锁只允许一个成功。
- timeout/failed 重试必须创建新 QCReport 并递增 attempt；达到 maxAttempts 后创建人工质量 WorkItem。
- `failureStrategy=block` 时，质检 failed/timed_out 均阻止送审或发布；`warn` 需要有权限的审核员填写豁免原因。

### 2.4 领域事件

| 事件 | Payload | 消费者 |
|------|---------|-------|
| `QCReportGenerationStarted` | reportId, projectId, targetId | 智能助手 |
| `QCReportStarted` | reportId, projectId, targetId | — |
| `QCReportCompleted` | reportId, projectId, targetId, overallScore, passed | 分镜导演（质检报告标记）、智能助手（创建质检工作项） |
| `QCReportFailed` | reportId, projectId, targetId, errorMessage | 智能助手（创建质量工作项）、通知（告警质量负责人） |
| `QCReportTimedOut` | reportId, projectId, targetId, deadlineAt, attempt | 重试调度器、智能助手（耗尽后创建工作项）、通知 |

---

## 3. 聚合根：QualityRuleSet

```text
QualityRuleSet
├── id: string
├── projectId: string | null       // null 为系统规则集
├── name: string
├── targetTypes: string[]
├── status: draft | published | archived
├── rules: QualityRule[]
├── threshold: number
├── failureStrategy: block | warn
├── timeoutSeconds: number
├── maxAttempts: number
├── version: number
└── updatedAt: string
```

命令：`CreateQualityRuleSet`、`AddOrUpdateQualityRule`、`RemoveQualityRule`、`PublishQualityRuleSet`、`CreateNewQualityRuleSetVersion`、`ArchiveQualityRuleSet`、`AssignProjectQualityRuleSet`。

规则：

- 规则具有稳定 `ruleCode`、实现版本、权重、参数 schema、适用 targetType、严重级别和是否可豁免。
- 只有 draft 可编辑；published 不可原地修改，只能新建版本。
- 权重必须非负且合计为 1；阈值 0～100；timeoutSeconds 和 maxAttempts 必须在平台安全范围内。
- 项目级规则可覆盖系统默认，但不能关闭系统标记为 mandatory 的合规/安全规则。
- 发布和项目指派使用 `quality_rule.configure` 权限并写 AuditRecord。

## 4. 聚合根：ContinuityBaseline

```text
ContinuityBaseline
├── id: string
├── projectId: string
├── episodeId: string
├── status: draft | published | archived
├── baselineVersion: number
├── scriptDocumentId / scriptVersion
├── assetVersionRefs[]
├── styleAssetVersionRefs[]
├── ruleSetId / ruleSetVersion
├── rules: ContinuityRule[]
├── previousBaselineId: string | null
├── publishedAt: string | null
└── version: number
```

命令：`CreateContinuityBaseline`、`UpsertContinuityRule`、`PublishContinuityBaseline`、`CreateContinuityBaselineRevision`、`ArchiveContinuityBaseline`。

不变量：published 不可原地修改；同一 Episode 同时只有一个当前 published 基线；引用必须是确切已发布版本；mandatory 规则不可由项目普通角色删除或降级。

领域事件：

| 事件 | Payload | 消费者 |
|---|---|---|
| `ContinuityBaselinePublished` | baselineId, projectId, episodeId, baselineVersion, dependencyRefs, baselineHash | 智能助手（DEP 影响）、分镜导演（连续性提示）、审核质量（新检查使用） |
| `ContinuityBaselineArchived` | baselineId, projectId, episodeId, baselineVersion | 智能助手 |

## 5. 聚合根：ContinuityCase

```text
ContinuityCase
├── id: string
├── projectId / episodeId / shotId
├── targetVersion: number
├── baselineId / baselineVersion
├── ruleCode / ruleVersion
├── category: character | scene | prop | direction | style | voice | custom
├── severity: info | warning | blocking
├── status: open | acknowledged | fixing | resolved | waived
├── evidence: { timeRange, region, comparedRefs, detail }
├── assigneeId: string | null
├── resolution: string | null
├── fixedTargetVersion: number | null
├── verificationReportId: string | null
├── waiver: { by, reason, scope, expiresAt } | null
└── version: number
```

### 5.1 命令与规则

| 命令 | 前置状态 | 产出事件 | 说明 |
|---|---|---|---|
| `OpenContinuityCase` | 不存在 | `ContinuityCaseOpened` | 由检查结果或有权限用户创建，必须携带证据 |
| `AcknowledgeContinuityCase` | open | `ContinuityCaseAcknowledged` | 确认问题并可指派责任人 |
| `StartContinuityFix` | acknowledged | `ContinuityFixStarted` | 进入返工 |
| `ResolveContinuityCase` | fixing | `ContinuityCaseResolved` | 关联修复版本与复检报告 |
| `WaiveContinuityCase` | open/acknowledged + waivable | `ContinuityCaseWaived` | 带权限、原因、范围和有效期豁免 |
| `ReopenContinuityCase` | resolved/waived | `ContinuityCaseReopened` | 目标/规则版本变化或复检失败时重开 |

- mandatory 或 blocking 且不可豁免的规则不能执行 `WaiveContinuityCase`。
- resolved 必须引用高于发现时版本的修复对象和 passed 的复检证据。
- 基线、规则或目标版本变化后，旧 waiver 不自动继承；投影重新评估是否重开。
- ContinuityCase 只记录质量结论，通过 WorkItem/目标上下文命令返工，不直接修改 Shot 或媒体。

### 5.2 领域事件

| 事件 | Payload | 消费者 |
|---|---|---|
| `ContinuityCaseOpened` | caseId, projectId, episodeId, shotId, targetVersion, category, severity, evidence | 智能助手（连续性看板/返工项）、通知（blocking） |
| `ContinuityCaseAcknowledged` / `ContinuityFixStarted` | caseId, assigneeId, status | 智能助手 |
| `ContinuityCaseResolved` | caseId, fixedTargetVersion, verificationReportId | 智能助手（核销）、分镜导演（刷新告警） |
| `ContinuityCaseWaived` | caseId, waiverBy, reason, scope, expiresAt | 智能助手、审计投影 |
| `ContinuityCaseReopened` | caseId, reason, currentTargetVersion | 智能助手（恢复返工项）、通知 |

## 6. 值对象

| 值对象 | 字段 | 说明 |
|-------|------|------|
| `QCConfig` | `checkTypes: string[]`, `threshold: number`, `failureStrategy: "block" \| "warn"`, `timeoutSeconds: number`, `maxAttempts: number` | 从规则集冻结的质检配置 |
| `QualityRule` | `ruleCode`, `implementationVersion`, `weight`, `parameters`, `severity`, `waivable`, `mandatory` | 可版本化质检规则 |
| `QCScores` | `technical: number`, `aesthetic: number`, `consistency: number` | 技术分/美学分/一致性分 |
| `QCRuleResult` | `ruleName: string`, `score: number`, `maxScore: number`, `detail: string` | 单条规则结果 |
| `RejectionReason` | `code: string`, `description: string` | 驳回原因 |
| `ReviewItem` | `dimension: compliance | copyright | quality | continuity`, `score: number`, `comment: string` | 审核维度评分；FinalVideo 必须四项齐全 |
| `ReviewAnnotation` | `id`, `text`, `dimension`, `severity`, `returnStage`, `timeRange`, `region`, `status`, `fixedTargetVersion`, `createdBy`, `createdAt` | 绑定审核版本的结构化时码/区域批注 |
| `ContinuityRule` | `ruleCode`, `category`, `mandatory`, `waivable`, `parameters`, `implementationVersion` | 连续性基线中的可版本化规则 |
