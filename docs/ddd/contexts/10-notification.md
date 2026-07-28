# 3.10 通知上下文 (Notification)

> **所属上下文**：通知 (Notification)  
> **聚合根**：`Notification` / `NotificationPreference`  
> **对应页面**：通知中心、个人通知偏好；系统级模板配置位于系统管理  
> **配套规范**：[统一语言术语表](../glossary.md)｜[上下文映射](../context-map.md)｜[跨上下文协作契约](../contracts.md)

**边界**：把业务事件转换为面向具体用户、可去重、可投递、可升级和可追踪的通知。通知上下文不拥有审核、任务、预算或发布状态，只保存事件快照和跳转引用。

## 1. 聚合根：Notification

```text
Notification
├── id: string
├── recipientUserId: string
├── projectId: string | null
├── eventType: string
├── sourceEventId: string
├── templateKey: string
├── templateVersion: number
├── priority: info | normal | high | critical
├── title: string
├── body: string
├── target: { type, id, route }
├── deduplicationKey: string
├── status: pending | partially_delivered | delivered | dead_lettered | archived
├── readAt: string | null
├── archivedAt: string | null
├── deliveryAttempts: DeliveryAttempt[]
├── version: number
└── createdAt: string
```

### 1.1 命令

| 命令 | 前置状态 | 产出事件 | 说明 |
|---|---|---|---|
| `CreateNotificationFromEvent` | 不存在 | `NotificationCreated` | 由受信任事件消费者按接收人创建；按 sourceEventId+recipient+templateVersion 幂等 |
| `DispatchNotification` | pending / partially_delivered | `NotificationChannelDelivered` / `NotificationChannelFailed` | 按偏好投递站内/SSE/邮件；重试有上限 |
| `MarkNotificationRead` | 非 archived | `NotificationRead` | 仅接收人本人或受信任系统处理器可执行 |
| `MarkNotificationsReadBatch` | 非 archived | `NotificationsReadBatch` | 同一接收人的幂等批量操作 |
| `ArchiveNotification` | delivered / partially_delivered / dead_lettered | `NotificationArchived` | 用户隐藏，不删除审计和投递记录 |
| `EscalateNotification` | high / critical 且命中 SLA | `NotificationEscalated` | 生成新的接收人通知并关联原通知 |
| `ReplayDeadLetterDelivery` | dead_lettered | `NotificationDeliveryRequeued` | 平台操作员人工重放指定渠道 |

### 1.2 不变量

- 站内渠道对所有业务通知强制存在；用户可关闭邮件，但不能完全关闭 critical 安全/数据事故通知。
- 同一 `deduplicationKey` 在配置窗口内只能有一个活动通知；重复事件只更新投递审计，不增加未读数。
- 模板渲染前必须通过变量 schema；模板输出必须转义，禁止注入脚本或未脱敏凭据。
- 邮件失败不把站内成功改为整体失败；状态按各渠道结果派生。
- `readAt` 按接收人隔离，不得由项目管理员替成员批量标记。
- DeliveryAttempt 追加写，包含渠道、供应商请求 ID、次数、时间、结果和脱敏错误。
- SSE 只用于实时提示，客户端重连必须通过游标/API 补拉，不能把 SSE 当唯一事实来源。

## 2. 聚合根：NotificationPreference

```text
NotificationPreference
├── userId: string
├── categories: { category, inApp, email }[]
├── quietHours: { start, end, timezone } | null
├── digestMode: immediate | hourly | daily
├── version: number
└── updatedAt: string
```

命令：`UpdateNotificationPreference`、`ResetNotificationPreference`。系统必须忽略试图关闭强制 critical 通知的配置，并在响应中返回实际生效值。

## 3. 模板与路由策略

模板属于通知上下文的受控配置，具有 key、schema、渠道内容、locale、版本和 active 状态。模板发布后不可修改，只能新建版本；历史 Notification 保留渲染结果和模板版本。

| 事件类别 | 默认接收人 | 默认优先级 | SLA/升级 |
|---|---|---|---|
| 审核结果/返工 | 提交人、责任人 | high | 24h/48h 按审核策略升级 |
| 任务分配/到期 | assignee | normal/high | 按 WorkItem dueDate |
| 预算 80%/100% | producer、owner、ai_admin | high/critical | 硬上限立即告警 |
| 质检阻断 | 当前制作责任人、reviewer | high | 未处理进入 WorkItem |
| Provider/流水线失败 | 任务发起人、ai_admin | high | 重试耗尽后升级 |
| 发布失败/成功 | publisher、producer | high/normal | 不可重试错误立即升级 |
| 安全/备份恢复事故 | platform_admin | critical | 不受免打扰限制 |

## 4. 领域事件

| 事件 | 消费者 |
|---|---|
| `NotificationCreated` | 通知投递器、SSE 未读投影 |
| `NotificationChannelDelivered` | 投递状态投影、运维指标 |
| `NotificationChannelFailed` | 重试调度器；耗尽后进入通知 DLQ |
| `NotificationRead` | 用户未读数投影 |
| `NotificationEscalated` | SLA 审计与工作项投影 |

## 5. 可靠性与隐私

- 消费业务事件前先写 Inbox；创建 Notification 与 Inbox 完成标记同一事务。
- 邮件等外部投递使用 Outbox/DeliveryAttempt，不在业务请求事务内阻塞。
- 通知保留期默认 180 天；安全通知按审计策略保留，正文到期可脱敏但投递证据保留。
- 跳转目标访问时重新鉴权；收到通知不代表永久拥有目标资源权限。

