# 公共领域基础设施

> **配套规范**：[DDD 治理规范](governance.md)

以下接口由 `domain/shared/` 定义，全部上下文共享：

```ts
export interface AggregateRoot {
  readonly id: string;
  readonly version: number;
  pullDomainEvents(): DomainEvent[];
}

export interface AggregateRepository<TAggregate> {
  get(id: string): Promise<TAggregate | null>;
  save(aggregate: TAggregate, expectedVersion: number): Promise<void>;
}

export interface DomainEvent<TPayload = unknown> {
  id: string;
  type: string;
  schemaVersion: number;
  aggregateId: string;
  aggregateType: string;
  aggregateVersion: number;
  projectId: string;
  occurredAt: string;
  correlationId: string;
  causationId?: string;
  payload: TPayload;
}

export interface DomainCommand {
  readonly aggregateId: string;
  readonly commandId: string;
  readonly occurredAt: string;
  readonly metadata: CommandMetadata;
}

export interface CommandMetadata {
  readonly userId: string;
  readonly projectId: string;
  readonly correlationId?: string;
  readonly idempotencyKey?: string;
}

export interface EventStore {
  append(events: DomainEvent[], expectedVersion: number): Promise<void>;
  load(aggregateId: string, fromVersion?: number): Promise<DomainEvent[]>;
  subscribe(eventTypes: string[], handler: (event: DomainEvent) => Promise<void>): Promise<Subscription>;
}

export interface IdempotencyKeyProvider {
  computeKey(command: DomainCommand, whitelistedFields: readonly string[]): string;
  isProcessed(commandId: string): Promise<boolean>;
  markProcessed(commandId: string, result: unknown): Promise<void>;
}

export interface CircuitBreaker {
  execute<T>(fn: () => Promise<T>): Promise<T>;
  getState(): CircuitBreakerState;
  reset(): void;
}

type CircuitBreakerState = 'closed' | 'open' | 'half_open';

export interface Subscription {
  unsubscribe(): Promise<void>;
}
```

公共错误码：

> 完整响应 envelope、HTTP 映射、错误目录与数字旧码迁移以[统一错误与 HTTP 响应契约](error-contract.md)为准。下表是共享领域错误子集，`DomainError.code` 必须使用同一稳定字符串，禁止另设数字 code 或通过 message 推断状态。

| 错误码 | 含义 |
|-------|------|
| `aggregate_not_found` | 聚合不存在 |
| `invalid_state_transition` | 当前状态不允许执行该行为 |
| `aggregate_version_conflict` | 聚合已被其他请求修改 |
| `aggregate_invariant_violated` | 操作破坏业务不变量 |
| `command_already_processed` | 幂等命令已经处理 |
| `permission_denied` | 当前用户角色无权执行该命令 |
| `member_already_exists` | 重复添加同一团队成员 |
| `workitem_source_review_locked` | 来源为 review 的工作项拒绝手动完成 |
| `event_store_unavailable` | 事件存储不可用（持久化失败或连接中断） |
| `circuit_breaker_open` | 熔断器处于开启状态，请求被拒绝 |
| `idempotency_key_collision` | 幂等键计算冲突（不同命令生成了相同键） |
| `command_validation_error` | 命令参数校验失败（字段缺失或格式错误） |
| `rate_limit_exceeded` | 请求频率超限 |
| `concurrent_modification_detected` | 乐观锁检测到并发修改 |
| `deadline_exceeded` | 命令执行超时 |
| `quota_exceeded` | 项目或用户配额耗尽 |
