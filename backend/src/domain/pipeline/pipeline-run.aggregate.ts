import type { AggregateRoot } from "../shared/aggregate-root.js";
import { DOMAIN_EVENT_TYPES, type DomainEvent } from "../shared/domain-event.js";
import { DagPolicy, type PipelineDependency } from "./dag-policy.js";
import {
  PipelineNode,
  type PipelineNodeSnapshot,
} from "./pipeline-node.entity.js";
import {
  pipelineNodeEvent,
  pipelineRunEvent,
} from "./pipeline-events.js";
import { pipelineInvariant } from "./pipeline-errors.js";
import {
  assertRunTransition,
  isRunTerminal,
  type PipelineRunStatus,
} from "./pipeline-state-machine.js";

export interface PipelineRunSnapshot {
  readonly id: string;
  readonly projectId: string;
  readonly name: string;
  readonly status: PipelineRunStatus;
  readonly workflowConfig: Readonly<Record<string, unknown>>;
  readonly startNodeId: string;
  readonly currentNodeId: string;
  readonly error: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly version: number;
  readonly processedCommandIds: readonly string[];
  readonly nodes: readonly PipelineNodeSnapshot[];
  readonly dependencies: readonly PipelineDependency[];
}

export interface CreatePipelineNode {
  readonly id: string;
  readonly type: string;
  readonly name: string;
  readonly config?: Readonly<Record<string, unknown>>;
  readonly input?: Readonly<Record<string, unknown>>;
  readonly idempotencyKey?: string;
  readonly priority?: number;
  readonly maxRetries?: number;
}

export interface CreatePipelineRun {
  readonly id: string;
  readonly projectId: string;
  readonly name: string;
  readonly workflowConfig?: Readonly<Record<string, unknown>>;
  readonly startNodeId?: string;
  readonly nodes: readonly CreatePipelineNode[];
  readonly dependencies: readonly PipelineDependency[];
  readonly createdAt: string;
}

export interface NodeFailure {
  readonly message: string;
  readonly category: string;
  readonly retryable: boolean;
}

export class PipelineRunAggregate implements AggregateRoot {
  readonly id: string;
  readonly projectId: string;
  readonly name: string;
  readonly workflowConfig: Readonly<Record<string, unknown>>;
  readonly startNodeId: string;
  readonly createdAt: string;
  readonly dependencies: readonly PipelineDependency[];

  private _status: PipelineRunStatus;
  private _currentNodeId: string;
  private _error: string;
  private _startedAt: string;
  private _completedAt: string;
  private _updatedAt: string;
  private _version: number;
  private _persistedVersion: number;
  private readonly nodeMap: Map<string, PipelineNode>;
  private readonly processedCommandIds: Set<string>;
  private domainEvents: DomainEvent[] = [];

  private constructor(snapshot: PipelineRunSnapshot) {
    this.id = snapshot.id;
    this.projectId = snapshot.projectId;
    this.name = snapshot.name;
    this.workflowConfig = { ...snapshot.workflowConfig };
    this.startNodeId = snapshot.startNodeId;
    this.createdAt = snapshot.createdAt;
    this.dependencies = snapshot.dependencies.map((edge) => ({ ...edge }));
    this._status = snapshot.status;
    this._currentNodeId = snapshot.currentNodeId;
    this._error = snapshot.error;
    this._startedAt = snapshot.startedAt;
    this._completedAt = snapshot.completedAt;
    this._updatedAt = snapshot.updatedAt;
    this._version = snapshot.version;
    this._persistedVersion = snapshot.version;
    this.nodeMap = new Map(
      snapshot.nodes.map((node) => [node.id, PipelineNode.rehydrate(node)]),
    );
    this.processedCommandIds = new Set(snapshot.processedCommandIds);
  }

  static create(input: CreatePipelineRun): PipelineRunAggregate {
    if (!input.id || !input.projectId || !input.name) {
      throw pipelineInvariant("Pipeline run id, project id and name are required");
    }
    if (input.nodes.length === 0) {
      throw pipelineInvariant("Pipeline run requires at least one node");
    }
    DagPolicy.validate(
      input.nodes.map((node) => node.id),
      input.dependencies,
    );
    const nodes = input.nodes.map<PipelineNodeSnapshot>((node) => ({
      id: node.id,
      runId: input.id,
      projectId: input.projectId,
      type: node.type,
      name: node.name,
      status: "pending",
      config: { ...(node.config ?? {}) },
      input: { ...(node.input ?? {}) },
      output: {},
      error: "",
      errorCategory: "",
      retryCount: 0,
      maxRetries: Math.max(0, Math.floor(node.maxRetries ?? 2)),
      idempotencyKey: node.idempotencyKey ?? "",
      priority: Math.max(0, Math.min(3, Math.floor(node.priority ?? 1))),
      startedAt: "",
      completedAt: "",
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
      version: 1,
    }));
    return new PipelineRunAggregate({
      id: input.id,
      projectId: input.projectId,
      name: input.name,
      status: "pending",
      workflowConfig: { ...(input.workflowConfig ?? {}) },
      startNodeId: input.startNodeId ?? nodes[0].id,
      currentNodeId: "",
      error: "",
      startedAt: "",
      completedAt: "",
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
      version: 1,
      processedCommandIds: [],
      nodes,
      dependencies: input.dependencies,
    });
  }

  static rehydrate(snapshot: PipelineRunSnapshot): PipelineRunAggregate {
    DagPolicy.validate(
      snapshot.nodes.map((node) => node.id),
      snapshot.dependencies,
    );
    return new PipelineRunAggregate(snapshot);
  }

  get status(): PipelineRunStatus {
    return this._status;
  }
  get currentNodeId(): string {
    return this._currentNodeId;
  }
  get error(): string {
    return this._error;
  }
  get startedAt(): string {
    return this._startedAt;
  }
  get completedAt(): string {
    return this._completedAt;
  }
  get updatedAt(): string {
    return this._updatedAt;
  }
  get version(): number {
    return this._version;
  }
  get persistedVersion(): number {
    return this._persistedVersion;
  }
  get nodes(): readonly PipelineNode[] {
    return [...this.nodeMap.values()];
  }
  get isTerminal(): boolean {
    return isRunTerminal(this._status);
  }

  hasProcessed(commandId: string): boolean {
    return this.processedCommandIds.has(commandId);
  }

  start(commandId: string, at: string): boolean {
    if (!this.acceptCommand(commandId)) return false;
    assertRunTransition(this.id, this._status, "start");
    this._status = "running";
    this._startedAt ||= at;
    this._completedAt = "";
    this._error = "";
    this.touch(at);
    this.domainEvents.push(
      pipelineRunEvent(DOMAIN_EVENT_TYPES.pipelineRunStarted, {
        commandId,
        runId: this.id,
        projectId: this.projectId,
        runVersion: this._version,
        occurredAt: at,
      }),
    );
    return true;
  }

  pause(commandId: string, at: string): boolean {
    if (!this.acceptCommand(commandId)) return false;
    assertRunTransition(this.id, this._status, "pause");
    this._status = "paused";
    this.touch(at);
    return true;
  }

  resume(commandId: string, at: string): boolean {
    if (!this.acceptCommand(commandId)) return false;
    assertRunTransition(this.id, this._status, "resume");
    this._status = "running";
    this.touch(at);
    return true;
  }

  startNode(commandId: string, nodeId: string, at: string): boolean {
    if (!this.acceptCommand(commandId)) return false;
    if (this._status !== "running") {
      throw pipelineInvariant("Run must be running before a node can start", {
        runId: this.id,
        status: this._status,
      });
    }
    const node = this.requireNode(nodeId);
    const decision = DagPolicy.decisionFor(
      nodeId,
      this.nodeMap,
      this.dependencies,
    );
    if (decision !== "ready") {
      throw pipelineInvariant("Node DAG prerequisites are not satisfied", {
        runId: this.id,
        nodeId,
        decision,
      });
    }
    node.start(at);
    this._currentNodeId = nodeId;
    this.touch(at);
    return true;
  }

  completeNode(
    commandId: string,
    nodeId: string,
    output: Readonly<Record<string, unknown>>,
    at: string,
    fromIdempotentCache = false,
  ): boolean {
    if (!this.acceptCommand(commandId)) return false;
    if (this.isTerminal) {
      throw pipelineInvariant("A terminal run cannot accept node results", {
        runId: this.id,
        status: this._status,
      });
    }
    const node = this.requireNode(nodeId);
    if (
      fromIdempotentCache &&
      node.status === "pending" &&
      this._status !== "running"
    ) {
      throw pipelineInvariant(
        "Paused runs cannot schedule an idempotent cache completion",
        { runId: this.id, nodeId, status: this._status },
      );
    }
    node.complete(output, at, fromIdempotentCache);
    this._currentNodeId = nodeId;
    this.touch(at);
    this.domainEvents.push(
      pipelineNodeEvent(DOMAIN_EVENT_TYPES.pipelineNodeCompleted, {
        commandId,
        runId: this.id,
        projectId: this.projectId,
        runVersion: this._version,
        nodeId,
        nodeType: node.type,
        occurredAt: at,
      }),
    );
    return true;
  }

  failNode(
    commandId: string,
    nodeId: string,
    failure: NodeFailure,
    at: string,
  ): boolean {
    if (!this.acceptCommand(commandId)) return false;
    if (this.isTerminal) {
      throw pipelineInvariant("A terminal run cannot accept node results", {
        runId: this.id,
        status: this._status,
      });
    }
    const node = this.requireNode(nodeId);
    node.fail(failure.message, failure.category, at, failure.retryable);
    this._currentNodeId = nodeId;
    this.touch(at);
    if (node.status === "failed") {
      this.domainEvents.push(
        pipelineNodeEvent(DOMAIN_EVENT_TYPES.pipelineNodeFailed, {
          commandId,
          runId: this.id,
          projectId: this.projectId,
          runVersion: this._version,
          nodeId,
          nodeType: node.type,
          errorCode: failure.category,
          occurredAt: at,
        }),
      );
    }
    return true;
  }

  retryNode(commandId: string, nodeId: string, at: string): boolean {
    if (!this.acceptCommand(commandId)) return false;
    const node = this.requireNode(nodeId);
    if (node.status !== "failed") {
      throw pipelineInvariant("node_not_failed", {
        runId: this.id,
        nodeId,
        status: node.status,
      });
    }
    if (this._status === "failed") {
      assertRunTransition(this.id, this._status, "recover");
      this._status = "running";
      this._completedAt = "";
      this._error = "";
    }
    if (this._status !== "running" && this._status !== "paused") {
      throw pipelineInvariant("Run does not allow node retry", {
        runId: this.id,
        status: this._status,
      });
    }
    node.retry(at);
    this.touch(at);
    return true;
  }

  pauseNode(commandId: string, nodeId: string, at: string): boolean {
    if (!this.acceptCommand(commandId)) return false;
    this.requireNode(nodeId).pause(at);
    this.touch(at);
    return true;
  }

  resumeNode(commandId: string, nodeId: string, at: string): boolean {
    if (!this.acceptCommand(commandId)) return false;
    this.requireNode(nodeId).resume(at);
    this.touch(at);
    return true;
  }

  skipNode(
    commandId: string,
    nodeId: string,
    reason: string,
    at: string,
  ): boolean {
    if (!this.acceptCommand(commandId)) return false;
    this.requireNode(nodeId).skip(reason, at);
    this.touch(at);
    return true;
  }

  setNodePriority(
    commandId: string,
    nodeId: string,
    priority: number,
    at: string,
  ): boolean {
    if (!this.acceptCommand(commandId)) return false;
    this.requireNode(nodeId).setPriority(priority, at);
    this.touch(at);
    return true;
  }

  addNodes(
    commandId: string,
    inputs: readonly CreatePipelineNode[],
    at: string,
  ): readonly string[] {
    if (!this.acceptCommand(commandId)) return [];
    if (this.isTerminal) {
      throw pipelineInvariant("Cannot add nodes to a terminal pipeline run", {
        runId: this.id,
        status: this._status,
      });
    }
    const allIds = [...this.nodeMap.keys(), ...inputs.map((input) => input.id)];
    DagPolicy.validate(allIds, this.dependencies);
    const added: string[] = [];
    for (const input of inputs) {
      const node = PipelineNode.create({
        id: input.id,
        runId: this.id,
        projectId: this.projectId,
        type: input.type,
        name: input.name,
        status: "pending",
        config: { ...(input.config ?? {}) },
        input: { ...(input.input ?? {}) },
        output: {},
        error: "",
        errorCategory: "",
        retryCount: 0,
        maxRetries: Math.max(0, Math.floor(input.maxRetries ?? 2)),
        idempotencyKey: input.idempotencyKey ?? "",
        priority: Math.max(0, Math.min(3, Math.floor(input.priority ?? 1))),
        startedAt: "",
        completedAt: "",
        createdAt: at,
        updatedAt: at,
        version: 1,
      });
      this.nodeMap.set(node.id, node);
      added.push(node.id);
    }
    this.touch(at);
    return added;
  }

  finalize(commandId: string, at: string): boolean {
    if (!this.acceptCommand(commandId)) return false;
    assertRunTransition(this.id, this._status, "finalize");
    if (this.nodes.some((node) => !node.isTerminal)) {
      throw pipelineInvariant("Pipeline run cannot finalize with active nodes", {
        runId: this.id,
      });
    }
    const failed = this.nodes.filter((node) => node.status === "failed");
    this._status = failed.length > 0 ? "failed" : "completed";
    this._error = failed.map((node) => node.error).filter(Boolean).join("; ");
    this._completedAt = at;
    this.touch(at);
    this.domainEvents.push(
      pipelineRunEvent(
        failed.length > 0
          ? DOMAIN_EVENT_TYPES.pipelineRunFailed
          : DOMAIN_EVENT_TYPES.pipelineRunCompleted,
        {
          commandId,
          runId: this.id,
          projectId: this.projectId,
          runVersion: this._version,
          occurredAt: at,
        },
      ),
    );
    return true;
  }

  runnableNodes(): readonly PipelineNode[] {
    if (this._status !== "running") return [];
    return this.nodes
      .filter(
        (node) =>
          (node.status === "pending" || node.status === "retrying") &&
          DagPolicy.decisionFor(node.id, this.nodeMap, this.dependencies) ===
            "ready",
      )
      .sort(
        (left, right) =>
          right.priority - left.priority ||
          left.createdAt.localeCompare(right.createdAt),
      );
  }

  unreachableNodes(): readonly PipelineNode[] {
    if (this._status !== "running") return [];
    return this.nodes.filter(
      (node) =>
        node.status === "pending" &&
        DagPolicy.decisionFor(node.id, this.nodeMap, this.dependencies) ===
          "unreachable",
    );
  }

  getNode(nodeId: string): PipelineNode | null {
    return this.nodeMap.get(nodeId) ?? null;
  }

  pullDomainEvents(): DomainEvent[] {
    const events = this.domainEvents;
    this.domainEvents = [];
    return events;
  }

  pendingDomainEvents(): readonly DomainEvent[] {
    return [...this.domainEvents];
  }

  markPersisted(): void {
    this._persistedVersion = this._version;
    for (const node of this.nodes) node.markPersisted();
    this.domainEvents = [];
  }

  toSnapshot(): PipelineRunSnapshot {
    return {
      id: this.id,
      projectId: this.projectId,
      name: this.name,
      status: this._status,
      workflowConfig: { ...this.workflowConfig },
      startNodeId: this.startNodeId,
      currentNodeId: this._currentNodeId,
      error: this._error,
      startedAt: this._startedAt,
      completedAt: this._completedAt,
      createdAt: this.createdAt,
      updatedAt: this._updatedAt,
      version: this._version,
      processedCommandIds: [...this.processedCommandIds],
      nodes: this.nodes.map((node) => node.toSnapshot()),
      dependencies: this.dependencies.map((edge) => ({ ...edge })),
    };
  }

  private acceptCommand(commandId: string): boolean {
    if (!commandId) throw pipelineInvariant("Pipeline command id is required");
    if (this.processedCommandIds.has(commandId)) return false;
    this.processedCommandIds.add(commandId);
    if (this.processedCommandIds.size > 512) {
      const oldest = this.processedCommandIds.values().next().value as
        | string
        | undefined;
      if (oldest) this.processedCommandIds.delete(oldest);
    }
    return true;
  }

  private requireNode(nodeId: string): PipelineNode {
    const node = this.nodeMap.get(nodeId);
    if (!node) {
      throw pipelineInvariant("Pipeline node does not belong to run", {
        runId: this.id,
        nodeId,
      });
    }
    return node;
  }

  private touch(at: string): void {
    this._version += 1;
    this._updatedAt = at;
  }
}
