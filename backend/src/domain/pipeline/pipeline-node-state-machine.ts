import { invalidPipelineTransition } from "./pipeline-errors.js";

export type PipelineNodeStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped"
  | "retrying"
  | "paused";

export type PipelineNodeCommand =
  | "start"
  | "complete"
  | "fail"
  | "retry"
  | "pause"
  | "resume"
  | "skip";

const NODE_TRANSITIONS: Readonly<
  Record<PipelineNodeCommand, readonly PipelineNodeStatus[]>
> = {
  start: ["pending", "retrying"],
  complete: ["running", "pending"],
  fail: ["running", "retrying"],
  retry: ["failed"],
  pause: ["pending", "retrying"],
  resume: ["paused"],
  skip: ["pending", "retrying", "paused"],
};

export function assertNodeTransition(
  nodeId: string,
  status: PipelineNodeStatus,
  command: PipelineNodeCommand,
): void {
  if (NODE_TRANSITIONS[command].includes(status)) return;
  throw invalidPipelineTransition("node", nodeId, status, command);
}

export function isNodeTerminal(status: PipelineNodeStatus): boolean {
  return status === "completed" || status === "failed" || status === "skipped";
}
