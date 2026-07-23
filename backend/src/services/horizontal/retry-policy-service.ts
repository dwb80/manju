/**
 * @file retry-policy-service.ts
 * @description REM-P1-009：项目级重试策略服务（质控低分自动重试）。
 *
 * ## 动机（V2 架构治理 P1-009）
 *  - 现状：质控失败时（on_failure=block），系统直接 fail 节点。
 *    手工 retry 一次需要用户重跑，效率低。
 *  - 解决：每个项目可配置 1 条"低分自动重试"策略（max retries / 退避 / 分数阈值），
 *    质控不达标时自动重跑节点，最多 max 次；耗尽后转 fail 让人工处理。
 *
 * ## 存储
 *  - 表 `quality_retry_policies`（启动期 ensureSchema 自动建表）
 *  - 每项目 + 单一 trigger 唯一（trigger='quality_low_score'）
 *  - 旧版由 placeholder 占位；本文件实现真实持久化。
 *
 * ## 行为合约
 *  - 任何 createRun / retryNode / quality detection 路径都通过本服务查策略
 *  - 失败模式：策略不存 → 返回 null（上层退化为不自动重试）
 *  - 重试计数由 quality_reports.retried + quality_reports.retry_count 共同决定
 *    （reports 是已有的源；本服务只增策略表，不重造计数）
 */
import { createRequire } from "node:module";
import { rootLogger } from "../../logger.js";
import { getRawDatabase } from "../../storage/sqlite.js";

const log = rootLogger.child({ module: "retry-policy-service" });

export type RetryTrigger = "quality_low_score" | "api_timeout" | "circuit_breaker_open" | "explicit_user";
export type BackoffStrategy = "fixed" | "linear" | "exponential";

export interface RetryPolicy {
  id: string;
  projectId: string;
  trigger: RetryTrigger;
  maxRetries: number;
  backoffStrategy: BackoffStrategy;
  backoffBaseMs: number;
  backoffMaxMs: number;
  /** 仅在 trigger=quality_low_score 时生效：低于此分自动重试（0-100）。 */
  minScoreThreshold?: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RetryPolicyService {
  resolvePolicy(input: { projectId: string; trigger: RetryTrigger }): Promise<RetryPolicy | null>;
  upsert(input: Omit<RetryPolicy, "id" | "createdAt" | "updatedAt"> & { id?: string }): Promise<RetryPolicy>;
  listByProject(projectId: string): Promise<RetryPolicy[]>;
  disable(policyId: string): Promise<void>;
  /** 计算下次退避时间（毫秒）。不持久化，只读策略。 */
  computeBackoffMs(policy: RetryPolicy, attemptIndex: number): number;
  /** 一次性建表。 */
  ensureSchema(): void;
  /** 项目默认 policy（trigger=quality_low_score）初始化 helper。 */
  defaultPolicy(projectId: string): RetryPolicy;
}

interface CreateRetryPolicyServiceOptions {
  databaseFile: string;
}

export function createRetryPolicyService(opts: CreateRetryPolicyServiceOptions): RetryPolicyService {
  const { databaseFile } = opts;

  function ensureSchema(): void {
    const db = getRawDatabase(databaseFile) as unknown as { exec: (sql: string) => void };
    db.exec(`
      CREATE TABLE IF NOT EXISTS quality_retry_policies (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        trigger TEXT NOT NULL,
        max_retries INTEGER NOT NULL DEFAULT 2,
        backoff_strategy TEXT NOT NULL DEFAULT 'exponential',
        backoff_base_ms INTEGER NOT NULL DEFAULT 2000,
        backoff_max_ms INTEGER NOT NULL DEFAULT 60000,
        min_score_threshold INTEGER,
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_retry_policies_project ON quality_retry_policies(project_id, trigger);
    `);
  }

  function rowToPolicy(row: Record<string, unknown>): RetryPolicy {
    return {
      id: String(row.id ?? ""),
      projectId: String(row.project_id ?? ""),
      trigger: String(row.trigger ?? "quality_low_score") as RetryTrigger,
      maxRetries: Number(row.max_retries ?? 0),
      backoffStrategy: String(row.backoff_strategy ?? "exponential") as BackoffStrategy,
      backoffBaseMs: Number(row.backoff_base_ms ?? 2000),
      backoffMaxMs: Number(row.backoff_max_ms ?? 60000),
      minScoreThreshold: row.min_score_threshold === null || row.min_score_threshold === undefined
        ? undefined
        : Number(row.min_score_threshold),
      enabled: Number(row.enabled ?? 1) === 1,
      createdAt: String(row.created_at ?? ""),
      updatedAt: String(row.updated_at ?? ""),
    };
  }

  function defaultPolicy(projectId: string): RetryPolicy {
    const now = new Date().toISOString();
    return {
      id: `policy_${projectId}_default`,
      projectId,
      trigger: "quality_low_score",
      maxRetries: 2,
      backoffStrategy: "exponential",
      backoffBaseMs: 2000,
      backoffMaxMs: 60_000,
      minScoreThreshold: 60,
      enabled: false,
      createdAt: now,
      updatedAt: now,
    };
  }

  function computeBackoffMs(policy: RetryPolicy, attemptIndex: number): number {
    const idx = Math.max(1, attemptIndex);
    let ms = policy.backoffBaseMs;
    if (policy.backoffStrategy === "fixed") {
      ms = policy.backoffBaseMs;
    } else if (policy.backoffStrategy === "linear") {
      ms = policy.backoffBaseMs * idx;
    } else {
      // exponential
      ms = policy.backoffBaseMs * Math.pow(2, idx - 1);
    }
    return Math.min(ms, policy.backoffMaxMs);
  }

  function resolvePolicy(input: { projectId: string; trigger: RetryTrigger }): Promise<RetryPolicy | null> {
    ensureSchema();
    const db = getRawDatabase(databaseFile) as unknown as {
      prepare: (sql: string) => { get: (...args: unknown[]) => Record<string, unknown> | undefined };
    };
    const row = db
      .prepare(`SELECT * FROM quality_retry_policies WHERE project_id=? AND trigger=? AND enabled=1 ORDER BY updated_at DESC LIMIT 1`)
      .get(input.projectId, input.trigger) as Record<string, unknown> | undefined;
    if (!row) return Promise.resolve(null);
    return Promise.resolve(rowToPolicy(row));
  }

  function upsert(input: Omit<RetryPolicy, "id" | "createdAt" | "updatedAt"> & { id?: string }): Promise<RetryPolicy> {
    ensureSchema();
    const db = getRawDatabase(databaseFile) as unknown as {
      prepare: (sql: string) => {
        get: (...args: unknown[]) => Record<string, unknown> | undefined;
        run: (...args: unknown[]) => unknown;
      };
    };
    const now = new Date().toISOString();
    // 查现有（projectId+trigger 唯一）
    const existing = db
      .prepare(`SELECT id, created_at FROM quality_retry_policies WHERE project_id=? AND trigger=?`)
      .get(input.projectId, input.trigger) as { id: string; created_at: string } | undefined;
    const id = input.id ?? existing?.id ?? `policy_${input.projectId}_${input.trigger}_${Date.now()}`;
    const createdAt = existing?.created_at ?? now;
    db
      .prepare(
        `INSERT OR REPLACE INTO quality_retry_policies
          (id, project_id, trigger, max_retries, backoff_strategy, backoff_base_ms, backoff_max_ms, min_score_threshold, enabled, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.projectId,
        input.trigger,
        input.maxRetries,
        input.backoffStrategy,
        input.backoffBaseMs,
        input.backoffMaxMs,
        input.minScoreThreshold ?? null,
        input.enabled ? 1 : 0,
        createdAt,
        now,
      );
    log.info(
      { event: "retry_policy.upserted", id, projectId: input.projectId, trigger: input.trigger, maxRetries: input.maxRetries },
      `重试策略已保存`,
    );
    return Promise.resolve({
      ...input,
      id,
      createdAt,
      updatedAt: now,
    } as RetryPolicy);
  }

  function listByProject(projectId: string): Promise<RetryPolicy[]> {
    ensureSchema();
    const db = getRawDatabase(databaseFile) as unknown as {
      prepare: (sql: string) => { all: (...args: unknown[]) => Record<string, unknown>[] };
    };
    const rows = db
      .prepare(`SELECT * FROM quality_retry_policies WHERE project_id=? ORDER BY trigger ASC`)
      .all(projectId) as Record<string, unknown>[];
    return Promise.resolve(rows.map(rowToPolicy));
  }

  function disable(policyId: string): Promise<void> {
    ensureSchema();
    const db = getRawDatabase(databaseFile) as unknown as {
      prepare: (sql: string) => { run: (...args: unknown[]) => unknown };
    };
    db
      .prepare(`UPDATE quality_retry_policies SET enabled=0, updated_at=? WHERE id=?`)
      .run(new Date().toISOString(), policyId);
    return Promise.resolve();
  }

  return {
    resolvePolicy,
    upsert,
    listByProject,
    disable,
    computeBackoffMs,
    ensureSchema,
    defaultPolicy,
  };
}
