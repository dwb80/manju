# 3.8 智能助手上下文 (AI Assistant)

> **所属上下文**：智能助手 (AI Assistant)
> **聚合根**：`Conversation` / `WorkItem` / `CommentThread`
> **对应页面**：AI 对话、项目工作台、驾驶舱、我的待办；通知由独立[通知上下文](10-notification.md)负责
> **配套规范**：[DDD 治理规范](../02-governance.md)｜[统一语言术语表](../03-glossary.md)｜[上下文映射](../04-context-map.md)｜[跨上下文协作契约](../05-contracts.md)

**边界**：AI 对话、工作项、项目工作台建议、跨上下文查询和操作建议。通知模板、渠道、投递、已读和升级不属于本上下文。

> **项目工作台说明**：项目工作台页面 = CQRS 读模型（跨上下文投影）+ Conversation / WorkItem / CommentThread 写入口。读模型展示项目进度汇总，写入口允许发起对话、工作项和绑定确切对象版本的讨论。

> **事件表说明**：聚合的"领域事件"表仅列出有消费者的关键事件。命令表"产出事件"列是事件全量来源。

---

## 1. 聚合根：Conversation

```
Conversation (Aggregate Root)
├── id: string
├── userId: string
├── projectId: string | null       // 关联项目（可选）
├── title: string
├── mode: string                   // general | project_assistant | script_helper
├── modelConfigId: string          // 使用的模型配置
├── status: ConversationStatus     // active | archived
├── isPinned: boolean
├── unreadCount: number
├── version: number
├── createdAt: string
├── updatedAt: string
└── messageCount: number           // 消息单独分页持久化，不无限内嵌
```

`Message` 是 Conversation 边界内实体，但通过独立仓储分页装载：`id/conversationId/role/content/tokens/modelConfigId/createdAt/correlationId`。单次命令只装载必要窗口，避免会话增长导致聚合无限膨胀。

### 1.1 状态机

```
┌────────┐  archive  ┌──────────┐
│ active │──────────▶│ archived │
└────────┘          └────┬─────┘
     ▲                     │ restore
     └─────────────────────┘
```

### 1.2 命令

| 命令 | 前置状态 | 产出事件 | 说明 |
|------|---------|---------|------|
| `StartConversation` | 不存在 | `ConversationStarted` | 创建对话会话 |
| `SendMessage` | active | `MessageSent` | 发送消息，触发 AI 回复 |
| `ArchiveConversation` | active | `ConversationArchived` | 归档对话 |
| `RestoreConversation` | archived | `ConversationRestored` | 恢复对话后即可发送消息 |
| `PinConversation` | active | `ConversationPinned` | 置顶 |
| `ClearHistory` | active | `HistoryCleared` | 清空消息历史 |

### 1.3 不变量

- 消息角色只能是 `user` / `assistant` / `system`。
- AI 回复消息必须携带 `tokens` 消耗。
- 归档对话不可发送新消息（`SendMessage` 校验 status = active）。
- 恢复后（`archived → active`）即可正常发送消息。

### 1.4 领域事件

| 事件 | Payload | 消费者 |
|------|---------|-------|
| `ConversationStarted` | conversationId, userId, projectId | 智能助手（更新对话列表） |
| `MessageSent` | conversationId, role, tokens | 智能助手（消息统计） |
| `ConversationArchived` | conversationId | 智能助手（更新对话列表） |
| `ConversationRestored` | conversationId | 智能助手（更新对话列表） |
| `ConversationPinned` | conversationId | 智能助手 |
| `HistoryCleared` | conversationId | 智能助手 |

### 1.5 实体

```
Message (Entity)
├── id: string                    // 消息唯一标识
├── conversationId: string        // 所属对话 ID
├── role: string                  // 消息角色：user | assistant | system
├── content: string               // 消息正文
├── contentType: string           // 内容类型：text | markdown | json | tool_call
├── metadata: Record<string, unknown>  // 附加元数据（模型名、引用来源等）
├── createdAt: string             // 创建时间
└── tokens: number                // Token 消耗（仅 assistant 消息记录）
```

---

## 2. 聚合根：WorkItem

```
WorkItem (Aggregate Root)
├── id: string
├── userId: string
├── projectId: string | null
├── category: WorkItemCategory      // task | issue | milestone
├── type: WorkItemType             // review_task | fix_task | publish_task | custom
├── title: string
├── description: string
├── status: WorkItemStatus         // task/issue: pending | in_progress | completed | cancelled | closed
│                                   // milestone: pending | in_progress | completed | delayed
├── priority: number               // 1-5
├── severity: string | null        // 仅 issue: P0 | P1 | P2 | P3
├── sourceType: string             // review | quality | pipeline | manual
├── sourceId: string | null        // 来源对象 ID
├── linkedWorkItemIds: string[]    // 关联工作项 ID（milestone 关联 task；issue 关联对象）
├── dueDate: string | null
├── completedAt: string | null
├── closedAt: string | null        // 仅 task/issue 的 closed 终态
├── version: number
├── createdAt: string
└── updatedAt: string
```

### 2.1 状态机

**task / issue（5 态）**：

```
┌─────────┐  start  ┌─────────────┐  complete  ┌───────────┐  close  ┌────────┐
│ pending │────────▶│ in_progress │───────────▶│ completed │────────▶│ closed │
└────┬────┘         └──────┬──────┘            └───────────┘         └────────┘
     │ cancel               │ cancel
     ▼                      ▼
┌──────────┐           ┌──────────┐
│cancelled │           │cancelled │
└──────────┘           └──────────┘
```

**milestone（4 态）**：

```
┌─────────┐  start  ┌─────────────┐  complete(全部关联task完成)  ┌───────────┐
│ pending │────────▶│ in_progress │───────────────────────────▶│ completed │
└─────────┘         └──────┬──────┘                             └───────────┘
                           │ 超过 dueDate 且非 completed（定时任务）
                           ▼
                    ┌─────────┐  恢复（关联task完成或延期调整）  ┌─────────────┐
                    │ delayed │───────────────────────────────▶│ in_progress │
                    └─────────┘                                 └─────────────┘
```

### 2.2 命令

| 命令 | 前置状态 | 产出事件 | 说明 |
|------|---------|---------|------|
| `CreateWorkItem` | 不存在 | `WorkItemCreated` | 创建工作项。`category` 创建后不可变更 |
| `StartWorkItem` | pending | `WorkItemStarted` | 开始处理 |
| `CompleteWorkItem` | in_progress | `WorkItemCompleted` | 用户完成。`sourceType=review` 时拒绝；milestone 要求关联 task 全部 completed |
| `CompleteSystemWorkItem` | pending / in_progress | `WorkItemCompleted` | 仅受信任事件处理器可执行，用于审核/质检/流水线事件闭环 |
| `CloseWorkItem` | completed | `WorkItemClosed` | 关闭（仅 task/issue，终态）。issue 关闭必须填写关闭原因 |
| `CancelWorkItem` | pending / in_progress | `WorkItemCancelled` | 取消 |
| `UpdatePriority` | 任意非终态 | `WorkItemPriorityUpdated` | 调整优先级 |
| `DelayMilestone` | in_progress | `MilestoneDelayed` | milestone 超过 `dueDate` 且非 `completed` 时由定时任务自动触发 |

### 2.3 `sourceType=review` 完成机制

- 来源为审核的工作项由 `ReviewApproved` / `ReviewRejected` / `ReviewClosed` 事件驱动完成（监听器调用 `CompleteSystemWorkItem`），用户界面无完成按钮。
- 手动 `CompleteWorkItem` 时若 `sourceType=review` 直接抛 `workitem_source_review_locked` 错误。

### 2.4 不变量

- 已完成的工作项不可重新打开，但 task/issue 可执行一次 `completed → closed` 归档关闭；`closed` 才是最终终态。milestone 的 `completed` 为最终终态。
- 来源为 `review` 的工作项，其状态变更由审核事件驱动，不可手动 `CompleteWorkItem`。
- `category` 创建后不可变更。
- milestone 的 `CompleteWorkItem` 前置条件：所有 `linkedWorkItemIds` 中的 task 必须 `completed`，否则抛 `aggregate_invariant_violated`。
- milestone 超过 `dueDate` 且非 `completed` 时自动转为 `delayed`（每日 0 点定时任务扫描）。
- issue 关闭（`CloseWorkItem`）必须填写关闭原因（≥ 10 字符），记录在 `description` 或专用字段。

### 2.5 领域事件

| 事件 | Payload | 消费者 |
|------|---------|-------|
| `WorkItemCreated` | workItemId, userId, category, type, sourceType, sourceId | 智能助手 |
| `WorkItemStarted` | workItemId, userId | 智能助手 |
| `WorkItemCompleted` | workItemId, userId, category | 智能助手（更新驾驶舱） |
| `WorkItemClosed` | workItemId, userId, category | 智能助手 |
| `WorkItemCancelled` | workItemId, userId | 智能助手 |
| `WorkItemPriorityUpdated` | workItemId, priority | 智能助手 |
| `MilestoneDelayed` | workItemId, userId, dueDate | 通知上下文（通知负责人并按 SLA 升级） |

---

## 3. 读模型

| 读模型 | 数据来源 | 页面 |
|-------|---------|------|
| 驾驶舱仪表盘 | 跨上下文聚合查询（CQRS 投影） | 驾驶舱 |
| 我的待办列表 | WorkItem + 跨上下文待审/待修复（CQRS 投影） | 我的待办 |
| 项目工作台 | Project + Script + Shot + Review + Pipeline + FinalVideo（CQRS 投影）+ Conversation/WorkItem 写入口 | 项目工作台 |
| 生产依赖投影 | 各上下文不可变版本、快照、采纳、剪辑、渲染、审核和发布事实事件 | 变更影响、对象详情 |
| 追溯链投影 | 生产依赖投影 + AI 执行快照 + 审核/发布证据 | 成片/候选“依赖与追溯”页签、追溯导出 |
| 生产控制塔 | ProductionPlan + 各上下文生产事实 + WorkItem + 预算/任务/审核 SLA | Episode 生产矩阵、瓶颈与交付预测 |
| 候选版本树 | Shot 候选附加/采纳/归档 + AITask/QC 证据 | 候选比较台、版本树 |
| 协作状态投影 | EditLease + Presence 心跳 + Member/Delegation | 对象详情、团队与权限；Presence 仅作提示 |

> **注意**：驾驶舱和我的待办是跨上下文的 CQRS 读模型，不持有写状态。它们通过订阅多个上下文的领域事件来更新投影。项目工作台同时拥有写入口（Conversation / WorkItem 聚合命令）。

---

## 4. DEP 变更影响与全链路追溯

### 4.1 边界决策

DEP 属于智能助手上下文的跨上下文查询能力，不增加第 11 个限界上下文，也不复制源上下文状态。投影可以回答“谁依赖谁、是否可能过期、证据链是否完整”，但不得：

- 自动把下游对象切换到上游最新版本；
- 直接把 Shot、Review、EditProject 或 FinalVideo 改为某业务状态；
- 以投影中的对象摘要替代源上下文聚合、审计日志或不可变快照；
- 把跨项目资产复制关系解释为可变引用或自动同步关系。

用户确认升级、重生成、重新送审或重新渲染后，应用层逐项调用对象所属上下文的公开命令；调用必须携带 `impactAssessmentId` 作为 correlationId，结果再通过事实事件回流投影。

### 4.2 读模型

```text
ProductionDependencyEdge
├── edgeId
├── projectId
├── sourceRef: { type, id, versionOrHash }
├── targetRef: { type, id, versionOrHash }
├── dependencyType: direct | derived | review | publish | rights
├── evidenceEventId
├── evidenceOccurredAt
└── projectionVersion

ImpactAssessment
├── assessmentId
├── projectId
├── triggerEventId
├── sourceBeforeRef / sourceAfterRef
├── affectedRefs[]: { ref, path, reason, severity, freshness }
├── completeness: complete | partial | rebuilding
├── projectionWatermark
└── assessedAt

TraceabilityChainProjection
├── rootRef
├── upstreamNodes[] / downstreamNodes[]
├── edges[]
├── evidenceGaps[]
├── projectionWatermark
└── integrityHash
```

`DependencyFreshness = current | potentially_stale | stale | blocked` 是读模型叠加属性，不属于 Shot、AITask、Review 等聚合的状态机。`potentially_stale` 表示依赖了非最新但仍存在的版本；`stale` 表示已确认需要返工；`blocked` 表示权利撤销/到期、版本不可用或证据断链导致交付被阻断。

### 4.3 输入领域事件与最小证据

| 领域事件 | 发布上下文 | DEP 使用的最小证据 |
|---|---|---|
| `ScriptVersionPublished` | 剧本创作 | scriptId, documentId, version, documentHash, previousDocumentId, changeSummary |
| `CharacterVersionPublished` / `SceneVersionPublished` / `PropVersionPublished` / `StyleAssetVersionPublished` | 资产库 | assetId, assetType, versionId, version, versionHash, previousVersionId, rightsSnapshotHash |
| `RightsMetadataChanged` | 资产库 | assetRef, previousRightsHash, currentRightsHash, validity, changedFields |
| `ShotPresentationFrozen` | 分镜导演 | shotId, snapshotId, snapshotHash, dependencyRefs[] |
| `ImageAdopted` / `VideoAdopted` | AI 任务调度 | shotId, mediaVersionId, taskId, executionSnapshotHash, presentationSnapshotHash |
| `AudioAssetPublished` / `SubtitleDocumentPublished` | 后期制作 | asset/document version, source refs, contentHash |
| `EditProjectVersionCreated` / `RenderCompleted` | 后期制作 | editProjectId, revision, dependencyRefs[], renderArtifactId, artifactHash, renderSnapshotHash |
| `ReviewSubmitted` / `ReviewApproved` / `ReviewChangesRequested` | 审核质量 | targetRef, snapshotHash, stage, decisionId |
| `FinalVideoCreated` / `FinalVideoPublished` / `PublishRecordCreated` | 发布交付 | finalVideoId, artifactRevision/hash, precheck/review refs, channel record ref |
| `ModelConfigUpdated` / `PromptTemplatePublished` / `PromptTemplateArchived` | AI 任务调度 | config/template exact version, previous version, capability/status change |

事件 payload 缺少确切版本或哈希时，投影记录 `evidence_gap`，不得猜测“当时的当前版本”。

### 4.4 投影事实事件

以下事件由 DEP 投影处理器在投影事务成功后发布，属于可订阅的投影事实，不作为修改源聚合的命令：

| 事件 | Payload | 消费者 |
|---|---|---|
| `DependencyImpactAssessed` | assessmentId, projectId, triggerEventId, affectedCount, blockedCount, completeness, projectionWatermark | 智能助手（刷新影响视图）、通知（仅存在 blocked/P0 影响时） |
| `DependencyFreshnessChanged` | projectId, targetRef, before, after, reason, assessmentId | 智能助手（刷新徽标/筛选） |
| `TraceabilityGapDetected` | projectId, rootRef, missingEvidenceTypes, severity, projectionWatermark | 智能助手（创建处置工作项）、通知（发布阻断时） |
| `DependencyProjectionRebuilt` | projectId, fromEventPosition, toEventPosition, edgeCount, completedAt | 智能助手（解除 rebuilding 提示） |

投影事实采用 Outbox/Inbox、eventId 幂等和 schemaVersion 规则，但不得被源上下文消费后直接改变聚合状态。

### 4.5 查询与操作入口

| 入口 | 类型 | 返回/行为 |
|---|---|---|
| `PreviewChangeImpact` | 查询 | 基于拟变更与当前水位返回预评估，不持久化、不改状态 |
| `GetImpactAssessment` | 查询 | 返回正式影响、路径、原因、完整性和水位 |
| `GetDependencyGraph` | 查询 | 按对象向上/向下分页展开依赖图 |
| `GetTraceabilityChain` | 查询 | 返回证据链、缺口、完整性哈希和脱敏结果 |
| `ExportTraceabilityReport` | 应用服务 | 生成带水位和完整性哈希的 JSON/PDF，写审计记录 |
| `CreateIncrementalUpgradeWorkItems` | 应用服务 | 仅在用户确认后创建 WorkItem，并编排各上下文命令；不由投影直接写聚合 |

### 4.6 投影不变量与服务等级

- 每条边必须连接确切版本/哈希；`latest`、空版本或可变 URL 不合法。
- 同一 `evidenceEventId + sourceRef + targetRef` 只能形成一条有效边。
- 投影必须支持按项目从事件存储重建；重建和事件缺口期间 `completeness != complete`。
- ACL 先按用户可读对象集合裁剪节点和边；无权节点以“受限节点”占位，不泄露名称、Prompt 或权利材料。
- 常规负载下直接影响查询 P95 ≤ 2 秒；单项目 1 万条边内完整链路查询 P95 ≤ 5 秒，超限转异步导出。

---

## 5. 生产控制塔读模型

```text
ProductionControlTower
├── projectId
├── currentPlanId / planVersion
├── episodeStageCells[]
├── bottlenecks[]
├── deliveryForecast: { earliest, expected, latest, assumptions, confidence }
├── workloadByRoleAndUser[]
├── projectionWatermark
└── completeness: complete | partial | rebuilding
```

- 计划值来自 ProductionPlan；实际量只由剧本、资产、Shot、AITask、Review、ContinuityCase、EditProject、RenderJob 和 PublishPlan 事实投影。
- 预测不是领域承诺，必须展示水位、假设和置信度；证据不足返回 unavailable。
- 瓶颈只提供证据和建议。调整计划走 ProductionPlan 命令，任务处置走源上下文命令，控制塔不得直接改派生状态。
- 同一事实事件重复消费不重复计数；事件版本缺口使相关单元格进入 partial。

## 6. 聚合根：CommentThread

```text
CommentThread
├── id: string
├── projectId: string
├── targetRef: { type, id, versionOrHash }
├── status: open | resolved
├── comments: Comment[]
├── version: number
└── createdAt / updatedAt

Comment
├── id / parentCommentId
├── authorUserId
├── body
├── mentionedUserIds[]
├── status: visible | deleted
└── createdAt / deletedAt
```

命令：`CreateCommentThread`、`AddComment`、`ReplyComment`、`ResolveCommentThread`、`ReopenCommentThread`、`SoftDeleteComment`。

- targetRef 必须是用户有权读取的确切对象版本/哈希；评论不改变目标状态或审核决定。
- @成员必须仍是项目成员且至少可读目标；被移除成员保留历史署名但不可新增指派。
- 删除只隐藏正文并保留作者、时间和审计占位；resolved 后仍可通过 Reopen 恢复讨论。

| 事件 | Payload | 消费者 |
|---|---|---|
| `CommentThreadCreated` / `CommentAdded` | threadId, projectId, targetRef, commentId, author, mentionedUserIds | 智能助手（对象讨论）、通知（@成员） |
| `CommentThreadResolved` / `CommentThreadReopened` | threadId, projectId, targetRef, operator | 智能助手 |
| `CommentSoftDeleted` | threadId, commentId, deletedBy | 智能助手、审计投影 |
