import { invalidPipelineTransition } from "./pipeline-errors.js";

export type PipelineRunStatus =
  | "pending"
  | "running"
  | "paused"
  | "completed"
  | "failed";

const RUN_TRANSITIONS: Readonly<Record<string, readonly PipelineRunStatus[]>> = {
  start: ["pending"],
  pause: ["running"],
  resume: ["paused"],
  finalize: ["running"],
  recover: ["failed"],
};

export function assertRunTransition(
  runId: string,
  status: PipelineRunStatus,
  command: keyof typeof RUN_TRANSITIONS,
): void {
  if (RUN_TRANSITIONS[command].includes(status)) return;
  throw invalidPipelineTransition("run", runId, status, command);
}

export function isRunTerminal(status: PipelineRunStatus): boolean {
  return status === "completed" || status === "failed";
}
