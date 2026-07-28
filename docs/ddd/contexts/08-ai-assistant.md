# 3.8 智能助手上下文 (AI Assistant)

> **所属上下文**：智能助手 (AI Assistant)
> **聚合根**：`Conversation` / `WorkItem`
> **对应页面**：AI 对话、项目工作台、驾驶舱、我的待办；通知由独立[通知上下文](10-notification.md)负责
> **配套规范**：[DDD 治理规范](../governance.md)｜[统一语言术语表](../glossary.md)｜[上下文映射](../context-map.md)｜[跨上下文协作契约](../contracts.md)

**边界**：AI 对话、工作项、项目工作台建议、跨上下文查询和操作建议。通知模板、渠道、投递、已读和升级不属于本上下文。

> **项目工作台说明**：项目工作台页面 = CQRS 读模型（跨上下文投影）+ 写操作入口（Conversation / WorkItem 聚合命令）。读模型展示项目进度汇总，写入口允许直接发起对话和创建工作项。

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

> **注意**：驾驶舱和我的待办是跨上下文的 CQRS 读模型，不持有写状态。它们通过订阅多个上下文的领域事件来更新投影。项目工作台同时拥有写入口（Conversation / WorkItem 聚合命令）。
