/**
 * @file pipeline-command-handler.ts
 * @description PipelineRun 应用命令处理器（V2.1 UoW 接入版本）。
 *
 * 职责：
 *  - 在 UnitOfWork 事务内加载聚合、执行命令、保存、记录幂等键、入队领域事件。
 *  - 状态/节点/幂等键与 Outbox（由 TransactionService 在 commit 前统一写入）原子提交。
 *  - 不再自开 BEGIN/COMMIT；不再直写 outbox_events。
 *  - 幂等键权威源是 `pipeline_command_log(id PK)`：跨进程重启可恢复，事务回滚时一并消失。
 *
 * 跨聚合边界：
 *  - Review 审批/驳回通过协调者的 `aggregate-event-dispatcher` → `updatePipeline` 驱动
 *    `CompleteNodeHandler`/`FailNodeHandler`；本文件不直接订阅事件。
 */

import type { Command } from "../shared/command.js";
import type { UnitOfWork } from "../shared/unit-of-work.js";
import type { PipelineRunRepository } from "../../domain/pipeline/pipeline-run.repository.js";
import {
  PipelineRunAggregate,
  type CreatePipelineRun,
  type NodeFailure,
} from "../../domain/pipeline/pipeline-run.aggregate.js";
import { pipelineNotFound } from "../../domain/pipeline/pipeline-errors.js";
import {
  DOMAIN_ERROR_CODES,
  DomainError,
} from "../../domain/shared/domain-error.js";

export interface PipelineCommand extends Command {
  readonly runId: string;
}

/** Pipeline handler 共享依赖（与 Shot/Review 同构）。 */
export interface PipelineHandlerDeps {
  readonly repo: PipelineRunRepository;
  readonly uow: UnitOfWork;
}

export type { PipelineRunAggregate, NodeFailure };

/**
 * 入口统一守门：拒绝空 commandId 进入 Pipeline 任意可写命令。
 * 与 Shot/Review 行为对齐；底层仓储虽已对空串抛 invariant，
 * 此处更早 fail 能给出可读的上下文。
 */
export function assertCommandId(commandId: string, commandName: string): void {
  if (!commandId || typeof commandId !== "string") {
    throw new DomainError(
      DOMAIN_ERROR_CODES.aggregateInvariantViolated,
      `pipeline 命令 ${commandName} 缺少 commandId`,
      { commandName, commandId: String(commandId ?? "") },
    );
  }
}

/**
 * 已有 Run 的命令处理基类。在 UoW 事务内：
 *  1) repo.get 加载聚合
 *  2) repo.isCommandProcessed 检查幂等
 *  3) aggregate.* 执行业务方法（可能产生领域事件）
 *  4) repo.save 持久化
 *  5) repo.recordCommand 落幂等键
 *  6) ctx.enqueueDomainEvent 入队事件
 *
 * 子类只需实现 `apply(agg, cmd)`。
 */
abstract class ExistingRunHandler<TCommand extends PipelineCommand, TResult = void> {
  constructor(protected readonly deps: PipelineHandlerDeps) {}

  /**
   * 子类声明其命令名，用于 assertCommandId 报错时给出可读上下文。
   * 默认从 `command.type` 读取；子类可重写以提供更友好的中文名。
   */
  protected commandName(): string {
    return this.constructor.name.replace(/Handler$/, "");
  }

  async execute(command: TCommand): Promise<TResult> {
    // 入口守门：空 commandId 必须在进事务前 fail；避免污染 UoW 事务上下文。
    // 注意：assertCommandId 抛 DomainError 时会被外层 caller 视为业务错误。
    assertCommandId(command.commandId, this.commandName());
    return this.deps.uow.run(async (ctx) => {
      if (await this.deps.repo.isCommandProcessed(command.commandId)) {
        return undefined as unknown as TResult;
      }
      const aggregate = await this.deps.repo.get(command.runId);
      if (!aggregate) throw pipelineNotFound(command.runId);
      const expectedVersion = aggregate.version;
      const result = await this.apply(aggregate, command);
      await this.deps.repo.save(aggregate, expectedVersion);
      await this.deps.repo.recordCommand(
        command.commandId,
        command.runId,
        command.type,
      );
      for (const evt of aggregate.pullDomainEvents()) {
        ctx.enqueueDomainEvent(evt);
      }
      return result;
    });
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
  constructor(private readonly deps: PipelineHandlerDeps) {}

  async execute(command: CreateRunCommand): Promise<PipelineRunAggregate> {
    // 与 ExistingRunHandler 行为对齐：空 commandId 必须在进事务前 fail。
    assertCommandId(command.commandId, "CreatePipelineRun");
    return this.deps.uow.run(async (ctx) => {
      if (await this.deps.repo.isCommandProcessed(command.commandId)) {
        // 幂等：同 commandId 已处理；理论上 CreateRun 不会重试，但保险起见仍走查表
        const existing = await this.deps.repo.get(
          (command.run as { id: string }).id,
        );
        if (existing) return existing;
        // M2：若 commandId 已被记录但 Run 不存在，说明之前发生过回滚／竞态删除；
        // 不允许再继续，否则 recordCommand 仍会撞 PK 而失败。这里按 invariant 抛错，
        // 让 caller 决定是重发新 commandId 还是上层治理。
        throw new DomainError(
          DOMAIN_ERROR_CODES.aggregateInvariantViolated,
          "CreateRun 幂等键存在但 Run 缺失，疑似中间态被破坏",
          { commandId: command.commandId, runId: command.run.id },
        );
      }
      const aggregate = PipelineRunAggregate.create({
        ...command.run,
        createdAt: command.issuedAt,
      });
      await this.deps.repo.create(aggregate);
      await this.deps.repo.recordCommand(
        command.commandId,
        aggregate.id,
        command.type,
      );
      for (const evt of aggregate.pullDomainEvents()) {
        ctx.enqueueDomainEvent(evt);
      }
      return aggregate;
    });
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
    const cached = await this.deps.repo.findCompletedOutputByIdempotencyKey(
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
    aggregate.failNode(command.commandId, command.nodeId, command.failure, command.issuedAt);
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
    aggregate.setNodePriority(command.commandId, command.nodeId, command.priority, command.issuedAt);
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
  protected apply(aggregate: PipelineRunAggregate, command: FinalizeRunCommand): void {
    aggregate.finalize(command.commandId, command.issuedAt);
  }
}
