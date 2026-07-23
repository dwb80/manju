import {
  DOMAIN_EVENT_TYPES,
  type DomainEvent,
  type PipelineNodeEventPayload,
  type PipelineRunEventPayload,
} from "../shared/domain-event.js";

export type PipelineDomainEvent =
  | DomainEvent<PipelineRunEventPayload>
  | DomainEvent<PipelineNodeEventPayload>;

export function pipelineRunEvent(
  type:
    | typeof DOMAIN_EVENT_TYPES.pipelineRunStarted
    | typeof DOMAIN_EVENT_TYPES.pipelineRunCompleted
    | typeof DOMAIN_EVENT_TYPES.pipelineRunFailed,
  input: {
    commandId: string;
    runId: string;
    projectId: string;
    runVersion: number;
    occurredAt: string;
  },
): DomainEvent<PipelineRunEventPayload> {
  return {
    id: `${type}:${input.commandId}`,
    type,
    aggregateId: input.runId,
    aggregateType: "PipelineRun",
    occurredAt: input.occurredAt,
    payload: {
      runId: input.runId,
      projectId: input.projectId,
      runVersion: input.runVersion,
    },
  };
}

export function pipelineNodeEvent(
  type:
    | typeof DOMAIN_EVENT_TYPES.pipelineNodeCompleted
    | typeof DOMAIN_EVENT_TYPES.pipelineNodeFailed,
  input: {
    commandId: string;
    runId: string;
    projectId: string;
    runVersion: number;
    nodeId: string;
    nodeType: string;
    errorCode?: string;
    occurredAt: string;
  },
): DomainEvent<PipelineNodeEventPayload> {
  return {
    id: `${type}:${input.commandId}`,
    type,
    aggregateId: input.runId,
    aggregateType: "PipelineRun",
    occurredAt: input.occurredAt,
    payload: {
      runId: input.runId,
      projectId: input.projectId,
      runVersion: input.runVersion,
      nodeId: input.nodeId,
      nodeType: input.nodeType,
      commandId: input.commandId,
      ...(input.errorCode ? { errorCode: input.errorCode } : {}),
    },
  };
}
