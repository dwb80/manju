import type { DomainEvent } from "./domain-event.js";

/** Public aggregate contract frozen by the V2.1 three-aggregate iteration. */
export interface AggregateRoot {
  readonly id: string;
  readonly version: number;
  pullDomainEvents(): DomainEvent[];
}

/** Repository port. Implementations must enforce expectedVersion atomically. */
export interface AggregateRepository<TAggregate extends AggregateRoot> {
  get(id: string): Promise<TAggregate | null>;
  save(aggregate: TAggregate, expectedVersion: number): Promise<void>;
}
