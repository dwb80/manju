import {
  toDomainOutboxEvent,
  type UnitOfWork,
} from "../../application/shared/unit-of-work.js";
import type { TransactionService } from "../../services/horizontal/transaction-service.js";

/**
 * Bridges the application UnitOfWork port to the existing SQLite transaction
 * and Outbox service. Aggregate repositories used inside `work` share the raw
 * SQLite transaction opened by TransactionService.
 */
export function createTransactionServiceUnitOfWork(
  transactions: TransactionService,
): UnitOfWork {
  return {
    run: (work) => transactions.run((transaction) => work({
      enqueueDomainEvent: (event) => {
        transaction.enqueueOutboxEvent(toDomainOutboxEvent(event));
      },
    })),
  };
}
