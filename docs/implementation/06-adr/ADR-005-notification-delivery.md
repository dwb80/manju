# ADR-005：通知事实、实时流与渠道投递

## 决策

Notification 是站内事实，按 recipient+dedupeKey 幂等；SSE 只做增量提示，断线以 cursor/Last-Event-ID 补拉。邮件等外部渠道使用独立 DeliveryAttempt，有上限重试和死信。

## 约束

- SSE 丢失不丢通知；未读数从事实/投影恢复。
- 站内成功不掩盖邮件失败；状态可部分失败。
- P0 安全通知不可全部关闭；免打扰只延迟允许延迟的渠道。
- WorkItem 负责处置，Notification 只负责触达。
