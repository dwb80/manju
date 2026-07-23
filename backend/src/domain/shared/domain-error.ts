export const DOMAIN_ERROR_CODES = {
  aggregateNotFound: "aggregate_not_found",
  invalidStateTransition: "invalid_state_transition",
  aggregateVersionConflict: "aggregate_version_conflict",
  aggregateInvariantViolated: "aggregate_invariant_violated",
  commandAlreadyProcessed: "command_already_processed",
} as const;

export type DomainErrorCode =
  (typeof DOMAIN_ERROR_CODES)[keyof typeof DOMAIN_ERROR_CODES];

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(
    code: DomainErrorCode,
    message: string = code,
    details: Readonly<Record<string, unknown>> = {},
  ) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.details = details;
  }
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}
