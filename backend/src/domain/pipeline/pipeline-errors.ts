import { DOMAIN_ERROR_CODES, DomainError } from "../shared/domain-error.js";

export function pipelineNotFound(id: string): DomainError {
  return new DomainError(
    DOMAIN_ERROR_CODES.aggregateNotFound,
    `Pipeline run not found: ${id}`,
    { aggregateType: "PipelineRun", aggregateId: id },
  );
}

export function invalidPipelineTransition(
  entity: "run" | "node",
  id: string,
  from: string,
  command: string,
): DomainError {
  const compatibilityPrefix =
    entity === "node" && (from === "completed" || from === "failed" || from === "skipped")
      ? "node_terminal: "
      : entity === "node" && from === "running"
        ? "node_running: "
        : entity === "node" && command === "resume"
          ? "node_not_paused: "
          : "";
  return new DomainError(
    DOMAIN_ERROR_CODES.invalidStateTransition,
    `${compatibilityPrefix}${entity} ${id} cannot ${command} from ${from}`,
    { entity, id, from, command },
  );
}

export function pipelineInvariant(
  message: string,
  details: Readonly<Record<string, unknown>> = {},
): DomainError {
  return new DomainError(
    DOMAIN_ERROR_CODES.aggregateInvariantViolated,
    message,
    details,
  );
}

export function pipelineVersionConflict(
  id: string,
  expectedVersion: number,
): DomainError {
  return new DomainError(
    DOMAIN_ERROR_CODES.aggregateVersionConflict,
    `Pipeline aggregate version conflict: ${id}`,
    { aggregateId: id, expectedVersion },
  );
}

export function pipelineCommandAlreadyProcessed(commandId: string): DomainError {
  return new DomainError(
    DOMAIN_ERROR_CODES.commandAlreadyProcessed,
    `Pipeline command already processed: ${commandId}`,
    { commandId },
  );
}
