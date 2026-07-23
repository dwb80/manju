import {
  assertNodeTransition,
  isNodeTerminal,
  type PipelineNodeStatus,
} from "./pipeline-node-state-machine.js";
import { pipelineInvariant } from "./pipeline-errors.js";

export interface PipelineNodeSnapshot {
  readonly id: string;
  readonly runId: string;
  readonly projectId: string;
  readonly type: string;
  readonly name: string;
  readonly status: PipelineNodeStatus;
  readonly config: Readonly<Record<string, unknown>>;
  readonly input: Readonly<Record<string, unknown>>;
  readonly output: Readonly<Record<string, unknown>>;
  readonly error: string;
  readonly errorCategory: string;
  readonly retryCount: number;
  readonly maxRetries: number;
  readonly idempotencyKey: string;
  readonly priority: number;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly version: number;
}

export class PipelineNode {
  readonly id: string;
  readonly runId: string;
  readonly projectId: string;
  readonly type: string;
  readonly name: string;
  readonly config: Readonly<Record<string, unknown>>;
  readonly input: Readonly<Record<string, unknown>>;
  readonly idempotencyKey: string;
  readonly createdAt: string;
  readonly maxRetries: number;

  private _status: PipelineNodeStatus;
  private _output: Record<string, unknown>;
  private _error: string;
  private _errorCategory: string;
  private _retryCount: number;
  private _priority: number;
  private _startedAt: string;
  private _completedAt: string;
  private _updatedAt: string;
  private _version: number;
  private _persistedVersion: number;

  private constructor(snapshot: PipelineNodeSnapshot) {
    this.id = snapshot.id;
    this.runId = snapshot.runId;
    this.projectId = snapshot.projectId;
    this.type = snapshot.type;
    this.name = snapshot.name;
    this.config = { ...snapshot.config };
    this.input = { ...snapshot.input };
    this.idempotencyKey = snapshot.idempotencyKey;
    this.createdAt = snapshot.createdAt;
    this.maxRetries = snapshot.maxRetries;
    this._status = snapshot.status;
    this._output = { ...snapshot.output };
    this._error = snapshot.error;
    this._errorCategory = snapshot.errorCategory;
    this._retryCount = snapshot.retryCount;
    this._priority = snapshot.priority;
    this._startedAt = snapshot.startedAt;
    this._completedAt = snapshot.completedAt;
    this._updatedAt = snapshot.updatedAt;
    this._version = snapshot.version;
    this._persistedVersion = snapshot.version;
  }

  static rehydrate(snapshot: PipelineNodeSnapshot): PipelineNode {
    return new PipelineNode(snapshot);
  }

  static create(snapshot: PipelineNodeSnapshot): PipelineNode {
    const node = new PipelineNode(snapshot);
    node._persistedVersion = 0;
    return node;
  }

  get status(): PipelineNodeStatus {
    return this._status;
  }
  get output(): Readonly<Record<string, unknown>> {
    return this._output;
  }
  get error(): string {
    return this._error;
  }
  get errorCategory(): string {
    return this._errorCategory;
  }
  get retryCount(): number {
    return this._retryCount;
  }
  get priority(): number {
    return this._priority;
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
  get isDirty(): boolean {
    return this._version !== this._persistedVersion;
  }
  get isTerminal(): boolean {
    return isNodeTerminal(this._status);
  }

  start(at: string): void {
    assertNodeTransition(this.id, this._status, "start");
    this.change("running", at);
    this._startedAt ||= at;
    this._completedAt = "";
    this._error = "";
    this._errorCategory = "";
  }

  complete(
    output: Readonly<Record<string, unknown>>,
    at: string,
    fromIdempotentCache = false,
  ): void {
    assertNodeTransition(this.id, this._status, "complete");
    if (this._status === "pending" && !fromIdempotentCache) {
      throw pipelineInvariant(
        "A pending node may only complete from an idempotent cache hit",
        { nodeId: this.id },
      );
    }
    this.change("completed", at);
    this._output = { ...output };
    this._completedAt = at;
    this._error = "";
    this._errorCategory = "";
  }

  fail(
    error: string,
    errorCategory: string,
    at: string,
    retryable: boolean,
  ): void {
    assertNodeTransition(this.id, this._status, "fail");
    this._retryCount += 1;
    this._error = error;
    this._errorCategory = errorCategory;
    const canRetry = retryable && this._retryCount <= this.maxRetries;
    this.change(canRetry ? "retrying" : "failed", at);
    this._completedAt = canRetry ? "" : at;
  }

  retry(at: string): void {
    assertNodeTransition(this.id, this._status, "retry");
    if (this._retryCount > this.maxRetries) {
      throw pipelineInvariant("Node retry policy is exhausted", {
        nodeId: this.id,
        retryCount: this._retryCount,
        maxRetries: this.maxRetries,
      });
    }
    this.change("pending", at);
    this._completedAt = "";
  }

  pause(at: string): void {
    if (this._status === "paused") return;
    assertNodeTransition(this.id, this._status, "pause");
    this.change("paused", at);
  }

  resume(at: string): void {
    assertNodeTransition(this.id, this._status, "resume");
    this.change("pending", at);
  }

  skip(reason: string, at: string): void {
    if (this._status === "skipped") return;
    assertNodeTransition(this.id, this._status, "skip");
    this.change("skipped", at);
    this._error = reason;
    this._completedAt = at;
  }

  setPriority(priority: number, at: string): void {
    if (this._status !== "pending" && this._status !== "paused") {
      throw pipelineInvariant("Only pending or paused nodes can change priority", {
        nodeId: this.id,
        status: this._status,
      });
    }
    const normalized = Math.max(0, Math.min(3, Math.floor(priority)));
    if (normalized === this._priority) return;
    this._priority = normalized;
    this.touch(at);
  }

  markPersisted(): void {
    this._persistedVersion = this._version;
  }

  toSnapshot(): PipelineNodeSnapshot {
    return {
      id: this.id,
      runId: this.runId,
      projectId: this.projectId,
      type: this.type,
      name: this.name,
      status: this._status,
      config: { ...this.config },
      input: { ...this.input },
      output: { ...this._output },
      error: this._error,
      errorCategory: this._errorCategory,
      retryCount: this._retryCount,
      maxRetries: this.maxRetries,
      idempotencyKey: this.idempotencyKey,
      priority: this._priority,
      startedAt: this._startedAt,
      completedAt: this._completedAt,
      createdAt: this.createdAt,
      updatedAt: this._updatedAt,
      version: this._version,
    };
  }

  private change(status: PipelineNodeStatus, at: string): void {
    this._status = status;
    this.touch(at);
  }

  private touch(at: string): void {
    this._version += 1;
    this._updatedAt = at;
  }
}
