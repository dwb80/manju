/**
 * V2 W10 FEAT-PIPE-006 错误恢复总入口
 *  - REQ-PIPE-006-01 错误分类（classifyError）
 *  - REQ-PIPE-006-02 模型降级（tryModelFallback）
 *  - REQ-PIPE-006-03 死信队列（recordDeadLetter + list/replay/drop）
 *  - REQ-PIPE-006-04 熔断器（CircuitBreakerRegistry + get/record/reset）
 *
 * 设计原则：
 *  - 错误分类纯函数，无 IO，单元测试友好
 *  - 熔断器状态在内存中（per process），不持久化——process 重启后重新计数（接受冷启动）
 *  - 死信队列持久化到 pipeline_dead_letters 表，可重放可丢弃
 *  - 所有 IO 包在 try/catch，fail-safe
 */
import type {
  AppContext,
} from "../app.js";
import type {
  ErrorCategory,
  PipelineDeadLetter,
  RetryPolicy,
} from "../../types/pipeline.js";
import { id as makeId, nowIso } from "../../utils.js";

/* ============================================================== */
/* REQ-PIPE-006-01：错误分类                                       */
/* ============================================================== */

/** 错误分类不可重试列表。 */
export const NON_RETRYABLE_CATEGORIES: ReadonlySet<ErrorCategory> = new Set([
  "permanent",
  "validation_error",
]);

/** 错误分类可降级列表（可触发模型降级）。 */
export const FALLBACK_ELIGIBLE_CATEGORIES: ReadonlySet<ErrorCategory> = new Set([
  "model_error",
  "rate_limit",
]);

/**
 * 根据 Error 对象的 message / name / stack 推断 ErrorCategory。
 * 优先看 err.name（标准错误如 AbortError / TypeError / RangeError），
 * 其次匹配 message 关键字（429/504/EAI_AGAIN 等），最后回退 unknown。
 */
export function classifyError(err: unknown): ErrorCategory {
  if (!err) return "unknown";
  const e = err as { name?: string; message?: string; code?: string; status?: number; statusCode?: number };
  const name = String(e.name ?? "");
  const msg = String(e.message ?? "").toLowerCase();
  const status = Number(e.status ?? e.statusCode ?? 0);

  // 1) timeout 优先（NodeAbortedError 是 executeNode 内定义）
  if (name === "NodeAbortedError" || /node_timeout/.test(msg) || /timeout/.test(msg)) {
    return "timeout";
  }
  if (name === "AbortError" && /timeout/.test(msg)) return "timeout";

  // 2) rate_limit（429 / TooManyRequests）
  if (status === 429 || /too many|rate.?limit|throttl/.test(msg) || name === "TooManyRequestsError") {
    return "rate_limit";
  }

  // 3) permanent（401/403/404/410 — "重试也没用"优先于 validation）
  if (status === 404 || status === 403 || status === 410 || status === 401) return "permanent";
  if (/not found|forbidden|unauthorized|gone/.test(msg)) return "permanent";

  // 4) model_error（AI 接口特定错误，model_/openai_/anthropic_/gemini_/qwen_/glm_ 等前缀）— 优先于 validation，避免 "model_error: api key invalid" 被 "invalid" 误判
  if (/model_error|model.?call|api.?error|completion|embedding|image.?generation|llm/.test(msg)) {
    return "model_error";
  }
  if (/^model_|^openai_|^anthropic_|^gemini_|^qwen_|^glm_|^claude_/.test(msg)) {
    return "model_error";
  }

  // 5) validation（4xx 其他客户端错误：400/422/451 等）
  if (status >= 400 && status < 500) return "validation_error";
  if (name === "ValidationError" || /invalid|validation|bad request/.test(msg)) {
    return "validation_error";
  }

  // 6) network_error（系统级错误码）
  const networkCodes = ["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN", "ENETUNREACH"];
  if (networkCodes.includes(name) || networkCodes.some((c) => msg.includes(c.toLowerCase()))) {
    return "network_error";
  }
  if (/network|fetch failed|socket hang up/.test(msg)) return "network_error";

  // 7) 5xx 服务端错误 → transient
  if (status >= 500 && status < 600) return "transient";
  if (/internal.?server|service.?unavailable|bad.?gateway|gateway.?timeout/.test(msg)) {
    return "transient";
  }

  return "unknown";
}

/** 该分类是否可重试（含熔断降级路径）。 */
export function isRetryable(category: ErrorCategory): boolean {
  return !NON_RETRYABLE_CATEGORIES.has(category);
}

/** 该分类是否可触发模型降级。 */
export function isFallbackEligible(category: ErrorCategory): boolean {
  return FALLBACK_ELIGIBLE_CATEGORIES.has(category);
}

/* ============================================================== */
/* REQ-PIPE-006-04：熔断器（内存状态机）                            */
/* ============================================================== */

export type CircuitState = "closed" | "open" | "half_open";

interface CircuitStateData {
  state: CircuitState;
  /** 连续失败计数（closed 状态下累计，达阈值转 open） */
  failureCount: number;
  /** 上次状态变更时间戳（ms） */
  stateChangedAt: number;
  /** 上次失败时间戳（ms） */
  lastFailureAt: number;
  /** half_open 探测计数（成功 1 次转 closed，失败立即转 open） */
  halfOpenProbes: number;
}

/**
 * 熔断器注册表：per process，per key（key 通常是 model_name 或 node_type）。
 * 单例模式（lazy init）。
 */
class CircuitBreakerRegistryImpl {
  private readonly states = new Map<string, CircuitStateData>();

  /** 读取当前状态（lazy init closed）。 */
  getState(key: string): CircuitStateData {
    let data = this.states.get(key);
    if (!data) {
      data = {
        state: "closed",
        failureCount: 0,
        stateChangedAt: Date.now(),
        lastFailureAt: 0,
        halfOpenProbes: 0,
      };
      this.states.set(key, data);
    }
    return data;
  }

  /**
   * 是否允许本次调用。closed → 允许；open → 看 open_ms 是否到期，到期转 half_open 允许 1 次；
   * half_open → 允许最多 threshold 次探测。
   */
  canAcquire(key: string, openMs: number): { allowed: boolean; state: CircuitState } {
    const data = this.getState(key);
    const now = Date.now();
    if (data.state === "closed") return { allowed: true, state: "closed" };
    if (data.state === "open") {
      if (now - data.stateChangedAt >= openMs) {
        // 进入 half_open
        data.state = "half_open";
        data.stateChangedAt = now;
        data.halfOpenProbes = 1;
        return { allowed: true, state: "half_open" };
      }
      return { allowed: false, state: "open" };
    }
    // half_open：允许 threshold 次探测
    if (data.halfOpenProbes < 1) {
      data.halfOpenProbes += 1;
      return { allowed: true, state: "half_open" };
    }
    return { allowed: false, state: "half_open" };
  }

  /** 记录成功。half_open 状态下成功立即转 closed；其他情况清零失败计数。 */
  recordSuccess(key: string): void {
    const data = this.getState(key);
    if (data.state === "half_open") {
      data.state = "closed";
      data.stateChangedAt = Date.now();
      data.failureCount = 0;
      data.halfOpenProbes = 0;
      return;
    }
    data.failureCount = 0;
  }

  /**
   * 记录失败。
   *  - closed 累计失败，达阈值转 open
   *  - half_open 任何失败立即转 open（不等待）
   *  - open 状态调用方不该调用此方法（canAcquire 拦截）
   * 返回 { opened: boolean } 通知调用方是否刚打开熔断器（用于写事件）。
   */
  recordFailure(key: string, threshold: number, openMs: number): { opened: boolean; newState: CircuitState } {
    const data = this.getState(key);
    const now = Date.now();
    data.failureCount += 1;
    data.lastFailureAt = now;
    if (data.state === "half_open") {
      data.state = "open";
      data.stateChangedAt = now;
      data.halfOpenProbes = 0;
      return { opened: true, newState: "open" };
    }
    if (data.state === "closed" && data.failureCount >= threshold) {
      data.state = "open";
      data.stateChangedAt = now;
      return { opened: true, newState: "open" };
    }
    return { opened: false, newState: data.state };
  }

  /** 手动重置（清零失败计数 + 转 closed）。 */
  reset(key: string): void {
    const data = this.getState(key);
    data.state = "closed";
    data.failureCount = 0;
    data.stateChangedAt = Date.now();
    data.halfOpenProbes = 0;
  }

  /** 列出所有 key（用于状态查询 / debug）。 */
  keys(): string[] {
    return Array.from(this.states.keys());
  }
}

export const circuitBreakerRegistry = new CircuitBreakerRegistryImpl();

/* ============================================================== */
/* REQ-PIPE-006-02：模型降级                                       */
/* ============================================================== */

/**
 * 查询节点类型对应的 RetryPolicy，取 fallback_models 链。
 * 无策略 / 未启用 / 无 fallback_models 全部返 null。
 */
export async function getFallbackChain(
  ctx: AppContext,
  nodeType: string,
): Promise<string[] | null> {
  try {
    const policies = (await ctx.retryPolicies.findMany({} as any)) as RetryPolicy[];
    const matched = policies.find(
      (p) => p && p.enabled && p.node_type === nodeType && Array.isArray(p.fallback_models) && p.fallback_models.length > 0,
    );
    if (!matched) return null;
    return matched.fallback_models.slice();
  } catch {
    return null;
  }
}

/**
 * 模型降级决策：给定当前尝试的 model 列表，返回下一个要试的 model 名。
 *  - chain 为空 → 返 null
 *  - currentModel 未在 chain 中 → 返 chain[0]（降级到首选）
 *  - currentModel 是 chain 末位 → 返 null（已到底）
 *  - currentModel 是 chain 中间 → 返下一档
 */
export function pickNextModel(chain: string[], currentModel: string | null): string | null {
  if (chain.length === 0) return null;
  if (!currentModel) return chain[0] ?? null;
  const idx = chain.indexOf(currentModel);
  if (idx < 0) return chain[0] ?? null;
  if (idx >= chain.length - 1) return null;
  return chain[idx + 1] ?? null;
}

/* ============================================================== */
/* REQ-PIPE-006-03：死信队列                                        */
/* ============================================================== */

export interface RecordDeadLetterOpts {
  projectId: string;
  runId: string;
  nodeId: string;
  nodeType: string;
  errorCategory: ErrorCategory;
  errorMessage: string;
  payload: Record<string, unknown>;
  retryCount: number;
}

/**
 * 写入死信队列。fail-safe：ctx.pipelineDeadLetters 缺失 / IO 失败 → 不抛错。
 */
export async function recordDeadLetter(
  ctx: AppContext,
  opts: RecordDeadLetterOpts,
): Promise<string | null> {
  try {
    if (!ctx.pipelineDeadLetters) return null;
    const now = nowIso();
    const id = makeId("dlq");
    const letter: PipelineDeadLetter = {
      id,
      project_id: opts.projectId,
      run_id: opts.runId,
      node_id: opts.nodeId,
      node_type: opts.nodeType,
      error_category: opts.errorCategory,
      error_message: String(opts.errorMessage).slice(0, 2000),
      payload: opts.payload,
      retry_count: opts.retryCount,
      status: "pending",
      created_at: now,
      updated_at: now,
      resolved_at: "",
    };
    await ctx.pipelineDeadLetters.insert(letter as any);
    return id;
  } catch {
    return null;
  }
}

/** 死信列表查询。 */
export async function listDeadLetters(
  ctx: AppContext,
  filter: { projectId?: string; status?: string; limit?: number } = {},
): Promise<PipelineDeadLetter[]> {
  try {
    if (!ctx.pipelineDeadLetters) return [];
    const where: Record<string, unknown> = {};
    if (filter.projectId) where.project_id = filter.projectId;
    if (filter.status) where.status = filter.status;
    const rows = (await ctx.pipelineDeadLetters.findMany(where as any)) as PipelineDeadLetter[];
    const sorted = rows
      .filter(Boolean)
      .sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")));
    return sorted.slice(0, filter.limit ?? 50);
  } catch {
    return [];
  }
}

/** 死信重放：标记 status=replayed，由调用方（HTTP API）后续触发重新调度。 */
export async function markDeadLetterReplayed(
  ctx: AppContext,
  id: string,
): Promise<{ ok: boolean; reason?: string }> {
  try {
    if (!ctx.pipelineDeadLetters) return { ok: false, reason: "dlq_repo_missing" };
    const cur = (await ctx.pipelineDeadLetters.findById(id)) as PipelineDeadLetter | null;
    if (!cur) return { ok: false, reason: "not_found" };
    if (cur.status !== "pending") return { ok: false, reason: `not_pending:${cur.status}` };
    const now = nowIso();
    await ctx.pipelineDeadLetters.update(id, {
      status: "replayed",
      updated_at: now,
      resolved_at: now,
    } as any);
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: (e as Error).message };
  }
}

/** 死信丢弃：标记 status=dropped。 */
export async function markDeadLetterDropped(
  ctx: AppContext,
  id: string,
): Promise<{ ok: boolean; reason?: string }> {
  try {
    if (!ctx.pipelineDeadLetters) return { ok: false, reason: "dlq_repo_missing" };
    const cur = (await ctx.pipelineDeadLetters.findById(id)) as PipelineDeadLetter | null;
    if (!cur) return { ok: false, reason: "not_found" };
    if (cur.status !== "pending") return { ok: false, reason: `not_pending:${cur.status}` };
    const now = nowIso();
    await ctx.pipelineDeadLetters.update(id, {
      status: "dropped",
      updated_at: now,
      resolved_at: now,
    } as any);
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: (e as Error).message };
  }
}
