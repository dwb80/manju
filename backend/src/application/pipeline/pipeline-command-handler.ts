import type { Command } from "../shared/command.js";
import type { PipelineRunRepository } from "../../domain/pipeline/pipeline-run.repository.js";
import {
  PipelineRunAggregate,
  type CreatePipelineRun,
  type NodeFailure,
} from "../../domain/pipeline/pipeline-run.aggregate.js";
import { pipelineNotFound } from "../../domain/pipeline/pipeline-errors.js";

export interface PipelineCommand extends Command {
  readonly runId: string;
}

abstract class ExistingRunHandler<TCommand extends PipelineCommand, TResult = void> {
  constructor(protected readonly repository: PipelineRunRepository) {}

  async execute(command: TCommand): Promise<TResult> {
    const aggregate = await this.repository.get(command.runId);
    if (!aggregate) throw pipelineNotFound(command.runId);
    const expectedVersion = aggregate.version;
    const result = await this.apply(aggregate, command);
    if (aggregate.version !== expectedVersion) {
      await this.repository.save(aggregate, expectedVersion);
    }
    return result;
  }

  protected abstract apply(
    aggregate: PipelineRunAggregate,
    command: TCommand,
  ): Promise<TResult> | TResult;
}

export interface CreateRunCommand extends Command {
  readonly type: "CreatePipelineRun";
  readonly run: Omit<CreatePipelineRun, "createdAt">;
}

export class CreateRunHandler {
  constructor(private readonly repository: PipelineRunRepository) {}

  async execute(command: CreateRunCommand): Promise<PipelineRunAggregate> {
    const aggregate = PipelineRunAggregate.create({
      ...command.run,
      createdAt: command.issuedAt,
    });
    await this.repository.create(aggregate);
    return aggregate;
  }
}

export interface StartRunCommand extends PipelineCommand {
  readonly type: "StartPipelineRun";
}
export class StartRunHandler extends ExistingRunHandler<StartRunCommand> {
  protected apply(aggregate: PipelineRunAggregate, command: StartRunCommand): void {
    aggregate.start(command.commandId, command.issuedAt);
  }
}

export interface PauseRunCommand extends PipelineCommand {
  readonly type: "PausePipelineRun";
}
export class PauseRunHandler extends ExistingRunHandler<PauseRunCommand> {
  protected apply(aggregate: PipelineRunAggregate, command: PauseRunCommand): void {
    aggregate.pause(command.commandId, command.issuedAt);
  }
}

export interface ResumeRunCommand extends PipelineCommand {
  readonly type: "ResumePipelineRun";
}
export class ResumeRunHandler extends ExistingRunHandler<ResumeRunCommand> {
  protected apply(aggregate: PipelineRunAggregate, command: ResumeRunCommand): void {
    aggregate.resume(command.commandId, command.issuedAt);
  }
}

export interface StartNodeCommand extends PipelineCommand {
  readonly type: "StartPipelineNode";
  readonly nodeId: string;
}
export interface StartNodeResult {
  readonly started: boolean;
  readonly cached: boolean;
}
export class StartNodeHandler extends ExistingRunHandler<
  StartNodeCommand,
  StartNodeResult
> {
  protected async apply(
    aggregate: PipelineRunAggregate,
    command: StartNodeCommand,
  ): Promise<StartNodeResult> {
    if (aggregate.hasProcessed(command.commandId)) {
      return { started: false, cached: false };
    }
    const node = aggregate.getNode(command.nodeId);
    if (!node) {
      aggregate.startNode(command.commandId, command.nodeId, command.issuedAt);
      return { started: true, cached: false };
    }
    const cached = await this.repository.findCompletedOutputByIdempotencyKey(
      aggregate.projectId,
      node.idempotencyKey,
      node.id,
    );
    if (cached) {
      aggregate.completeNode(
        command.commandId,
        node.id,
        { ...cached, idempotent_reused_from: true },
        command.issuedAt,
        true,
      );
      return { started: false, cached: true };
    }
    aggregate.startNode(command.commandId, command.nodeId, command.issuedAt);
    return { started: true, cached: false };
  }
}

export interface CompleteNodeCommand extends PipelineCommand {
  readonly type: "CompletePipelineNode";
  readonly nodeId: string;
  readonly output: Readonly<Record<string, unknown>>;
}
export class CompleteNodeHandler extends ExistingRunHandler<CompleteNodeCommand> {
  protected apply(
    aggregate: PipelineRunAggregate,
    command: CompleteNodeCommand,
  ): void {
    aggregate.completeNode(
      command.commandId,
      command.nodeId,
      command.output,
      command.issuedAt,
    );
  }
}

export interface FailNodeCommand extends PipelineCommand {
  readonly type: "FailPipelineNode";
  readonly nodeId: string;
  readonly failure: NodeFailure;
}
export class FailNodeHandler extends ExistingRunHandler<FailNodeCommand> {
  protected apply(aggregate: PipelineRunAggregate, command: FailNodeCommand): void {
    aggregate.failNode(
      command.commandId,
      command.nodeId,
      command.failure,
      command.issuedAt,
    );
  }
}

export interface RetryNodeCommand extends PipelineCommand {
  readonly type: "RetryPipelineNode";
  readonly nodeId: string;
}
export class RetryNodeHandler extends ExistingRunHandler<RetryNodeCommand> {
  protected apply(aggregate: PipelineRunAggregate, command: RetryNodeCommand): void {
    aggregate.retryNode(command.commandId, command.nodeId, command.issuedAt);
  }
}

export interface SkipNodeCommand extends PipelineCommand {
  readonly type: "SkipPipelineNode";
  readonly nodeId: string;
  readonly reason: string;
}
export class SkipNodeHandler extends ExistingRunHandler<SkipNodeCommand> {
  protected apply(aggregate: PipelineRunAggregate, command: SkipNodeCommand): void {
    aggregate.skipNode(
      command.commandId,
      command.nodeId,
      command.reason,
      command.issuedAt,
    );
  }
}

export interface PauseNodeCommand extends PipelineCommand {
  readonly type: "PausePipelineNode";
  readonly nodeId: string;
}
export class PauseNodeHandler extends ExistingRunHandler<PauseNodeCommand> {
  protected apply(aggregate: PipelineRunAggregate, command: PauseNodeCommand): void {
    aggregate.pauseNode(command.commandId, command.nodeId, command.issuedAt);
  }
}

export interface ResumeNodeCommand extends PipelineCommand {
  readonly type: "ResumePipelineNode";
  readonly nodeId: string;
}
export class ResumeNodeHandler extends ExistingRunHandler<ResumeNodeCommand> {
  protected apply(aggregate: PipelineRunAggregate, command: ResumeNodeCommand): void {
    aggregate.resumeNode(command.commandId, command.nodeId, command.issuedAt);
  }
}

export interface SetNodePriorityCommand extends PipelineCommand {
  readonly type: "SetPipelineNodePriority";
  readonly nodeId: string;
  readonly priority: number;
}
export class SetNodePriorityHandler extends ExistingRunHandler<SetNodePriorityCommand> {
  protected apply(
    aggregate: PipelineRunAggregate,
    command: SetNodePriorityCommand,
  ): void {
    aggregate.setNodePriority(
      command.commandId,
      command.nodeId,
      command.priority,
      command.issuedAt,
    );
  }
}

export interface AddNodesCommand extends PipelineCommand {
  readonly type: "AddPipelineNodes";
  readonly nodes: readonly import("../../domain/pipeline/pipeline-run.aggregate.js").CreatePipelineNode[];
}
export class AddNodesHandler extends ExistingRunHandler<
  AddNodesCommand,
  readonly string[]
> {
  protected apply(
    aggregate: PipelineRunAggregate,
    command: AddNodesCommand,
  ): readonly string[] {
    return aggregate.addNodes(command.commandId, command.nodes, command.issuedAt);
  }
}

export interface FinalizeRunCommand extends PipelineCommand {
  readonly type: "FinalizePipelineRun";
}
export class FinalizeRunHandler extends ExistingRunHandler<FinalizeRunCommand> {
  protected apply(
    aggregate: PipelineRunAggregate,
    command: FinalizeRunCommand,
  ): void {
    aggregate.finalize(command.commandId, command.issuedAt);
  }
}
