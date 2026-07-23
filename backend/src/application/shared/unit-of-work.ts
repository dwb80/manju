import type { DomainEvent } from "../../domain/shared/domain-event.js";

export interface UnitOfWorkContext {
  enqueueDomainEvent(event: DomainEvent<unknown>): void;
}

export interface UnitOfWork {
  run<TResult>(
    work: (context: UnitOfWorkContext) => Promise<TResult> | TResult,
  ): Promise<TResult>;
}

/**
 * Outbox-compatible representation. `topic` and `payload` map directly to the
 * existing TransactionService envelope, while the event id is preserved.
 */
export interface DomainOutboxEvent {
  readonly id: string;
  readonly topic: string;
  readonly payload: Record<string, unknown>;
  readonly source: string;
}

export function toDomainOutboxEvent(
  event: DomainEvent<unknown>,
): DomainOutboxEvent {
  return {
    id: event.id,
    topic: event.type,
    source: event.aggregateType,
    payload: {
      aggregateId: event.aggregateId,
      aggregateType: event.aggregateType,
      occurredAt: event.occurredAt,
      eventVersion: 1,
      payload: event.payload,
    },
  };
}
