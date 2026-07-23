/**
 * @file transaction-service.ts
 * @description REM-P1-008：跨仓储原子事务 + 跨模块事件 Outbox。
 *
 * ## 动机（V2 架构治理 P1-008）
 *  - 现状：业务编排里多次出现"先改 run 状态、再发事件"这种两步操作。
 *    如果中间崩溃，状态与事件会不一致；多个项目对同一 run 并发写还会产生竞态。
 *  - 解决：
 *    1) 提供 `run(fn)`：在 SQLite 事务中执行回调，回调中所有仓库操作在同一连接上
 *       串行，要么全部提交要么全部回滚。
 *    2) 提供 `enqueueOutboxEvent(event)`：把跨模块事件落到 `outbox_events` 表
 *       （与业务写入同一事务），由后台 Dispatcher 周期性 fetch + dispatch。
 *       失败的事件会以"outbox_pending → outbox_dead"两种终态记录，运维可重放。
 *
 * ## Outbox 主题
 *  - 通用 topic 字符串（建议前缀规范："run.lifecycle."、"node.lifecycle."、"quality."、
 *    "final_video."），Consumer 端按前缀订阅。
 *  - payload 必须是 JSON 安全对象（不写 BLOB）
 *
 * ## 失败模式
 *  - DB 写失败：事务自动回滚，Outbox 事件一并消失（保证"事件不会孤立于业务状态"）
 *  - Dispatch 失败：事件保留为 status=pending，下一次循环重试；超阈值的进 dead 表
 *  - 进程崩溃：下次启动 Outbox dispatcher 重新拉取所有 pending 事件
 */
import { createRequire } from "node:module";
import { rootLogger } from "../../logger.js";
import { getRawDatabase } from "../../storage/sqlite.js";

const require2 = createRequire(import.meta.url);
const _sqlite = require2("node:sqlite") as { DatabaseSync: new (filename: string) => unknown };

const log = rootLogger.child({ module: "transaction-service" });

/** Outbox 事件结构。 */
export interface OutboxEvent {
  id?: string;
  /** 主题：建议 "domain.entity.verb"，如 "run.lifecycle.started"。 */
  topic: string;
  /** 业务负载；写库时 JSON 化。 */
  payload: Record<string, unknown>;
  /** 来源（service 名），用于审计。 */
  source?: string;
  /** 已尝试次数。Dispatcher 内部递增。 */
  attempts?: number;
  /** 最大尝试次数；超过后置为 dead。 */
  maxAttempts?: number;
  /** 可选：第一次计划触发时间（毫秒 unix 戳）。 */
  notBefore?: number;
}

/** 事务上下文：回调中通过此参数追加 Outbox 事件。 */
export interface TransactionContext {
  readonly id: string;
  /** 当前事务中的 outbox 事件队列。事务提交后由 Dispatcher 处理。 */
  enqueueOutboxEvent(event: OutboxEvent): void;
  /** 事务内部执行原始 SQL（仅供极少数受信任的 migration / repair 用）。 */
  execRaw(sql: string): void;
}

export interface OutboxRecord extends OutboxEvent {
  id: string;
  status: "pending" | "dispatching" | "done" | "dead";
  createdAt: string;
  updatedAt: string;
  lastError: string;
}

export interface TransactionService {
  /** 在 SQLite 事务中执行回调；事务内写入的 outbox 事件会在 commit 后被 Dispatcher 拉走。 */
  run<T>(fn: (tx: TransactionContext) => Promise<T> | T): Promise<T>;
  /** 在事务外异步追加一个 Outbox 事件（单独开事务）。 */
  enqueueOutboxEvent(event: OutboxEvent): Promise<string>;
  /** 列出待处理事件（按 createdAt asc，limit 由调用方控制）。 */
  listPendingOutbox(limit: number): Promise<OutboxRecord[]>;
  /** 标记事件为 done。 */
  markOutboxDone(id: string): Promise<void>;
  /** 标记事件为 dead（写入错误信息）。 */
  markOutboxDead(id: string, error: string): Promise<void>;
  /** 递增 attempts；若达到 maxAttempts 会自动置为 dead。 */
  bumpOutboxAttempt(id: string, error: string): Promise<{ reached: boolean; attempts: number }>;
  /** Dispatcher 入口：拉取一批 pending，循环 dispatch。返回处理统计。 */
  dispatchPendingOutbox(options?: { batchSize?: number; publish?: (event: OutboxRecord) => Promise<void> }): Promise<{ processed: number; failed: number; dead: number }>;
  /** 启动后台 dispatcher 循环。多次调用幂等。 */
  startBackgroundDispatcher(options?: { intervalMs?: number; batchSize?: number; publish?: (event: OutboxRecord) => Promise<void> }): void;
  /** 停止后台 dispatcher。 */
  stopBackgroundDispatcher(): Promise<void>;
  /** 一次性建表（启动期调用一次）。 */
  ensureSchema(): void;
}

function genEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

interface CreateTransactionServiceOptions {
  databaseFile: string;
  /** 默认 publisher（可选）。如未提供则只把事件置为 done，不真正推外部。 */
  defaultPublish?: (event: OutboxRecord) => Promise<void>;
}

export function createTransactionService(opts: CreateTransactionServiceOptions): TransactionService {
  const { databaseFile, defaultPublish } = opts;

  function ensureSchema(): void {
    const db = getRawDatabase(databaseFile) as unknown as {
      exec: (sql: string) => void;
    };
    db.exec(`
      CREATE TABLE IF NOT EXISTS outbox_events (
        id TEXT PRIMARY KEY,
        topic TEXT NOT NULL,
        payload TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'pending',
        attempts INTEGER NOT NULL DEFAULT 0,
        max_attempts INTEGER NOT NULL DEFAULT 5,
        not_before INTEGER NOT NULL DEFAULT 0,
        last_error TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_outbox_events_status ON outbox_events(status, created_at);
    `);
  }

  function listPendingOutbox(limit: number): Promise<OutboxRecord[]> {
    const db = getRawDatabase(databaseFile) as unknown as {
      prepare: (sql: string) => { all: (...args: unknown[]) => Record<string, unknown>[] };
    };
    ensureSchema();
    const rows = db
      .prepare(
        `SELECT * FROM outbox_events WHERE status='pending' AND not_before <= ? ORDER BY created_at ASC LIMIT ?`,
      )
      .all(Date.now(), limit) as Record<string, unknown>[];
    return Promise.resolve(rows.map(rowToRecord));
  }

  function markOutboxDone(id: string): Promise<void> {
    const db = getRawDatabase(databaseFile) as unknown as {
      prepare: (sql: string) => { run: (...args: unknown[]) => unknown };
    };
    db
      .prepare(
        `UPDATE outbox_events SET status='done', updated_at=? WHERE id=?`,
      )
      .run(nowIso(), id);
    return Promise.resolve();
  }

  function markOutboxDead(id: string, error: string): Promise<void> {
    const db = getRawDatabase(databaseFile) as unknown as {
      prepare: (sql: string) => { run: (...args: unknown[]) => unknown };
    };
    db
      .prepare(
        `UPDATE outbox_events SET status='dead', last_error=?, updated_at=? WHERE id=?`,
      )
      .run(error, nowIso(), id);
    return Promise.resolve();
  }

  function bumpOutboxAttempt(id: string, error: string): Promise<{ reached: boolean; attempts: number }> {
    const db = getRawDatabase(databaseFile) as unknown as {
      prepare: (sql: string) => {
        get: (...args: unknown[]) => Record<string, unknown> | undefined;
        run: (...args: unknown[]) => unknown;
      };
    };
    const current = db
      .prepare(`SELECT attempts, max_attempts FROM outbox_events WHERE id=?`)
      .get(id) as { attempts: number; max_attempts: number } | undefined;
    if (!current) return Promise.resolve({ reached: false, attempts: 0 });
    const next = (current.attempts ?? 0) + 1;
    if (next >= (current.max_attempts ?? 5)) {
      db
        .prepare(
          `UPDATE outbox_events SET attempts=?, status='dead', last_error=?, updated_at=? WHERE id=?`,
        )
        .run(next, error, nowIso(), id);
      return Promise.resolve({ reached: true, attempts: next });
    }
    db
      .prepare(
        `UPDATE outbox_events SET attempts=?, last_error=?, updated_at=? WHERE id=?`,
      )
      .run(next, error, nowIso(), id);
    return Promise.resolve({ reached: false, attempts: next });
  }

  async function dispatchPendingOutbox(options?: {
    batchSize?: number;
    publish?: (event: OutboxRecord) => Promise<void>;
  }): Promise<{ processed: number; failed: number; dead: number }> {
    ensureSchema();
    const batchSize = options?.batchSize ?? 32;
    const publish = options?.publish ?? defaultPublish;
    const items = await listPendingOutbox(batchSize);
    let processed = 0;
    let failed = 0;
    let dead = 0;
    for (const item of items) {
      try {
        if (publish) {
          await publish(item);
        }
        await markOutboxDone(item.id);
        processed += 1;
      } catch (err) {
        const errMsg = (err as Error).message ?? String(err);
        const { reached } = await bumpOutboxAttempt(item.id, errMsg);
        if (reached) {
          dead += 1;
          log.error(
            { event: "outbox.dead", id: item.id, topic: item.topic, error: errMsg },
            `Outbox 事件达到最大重试次数，转 dead: ${errMsg}`,
          );
        } else {
          failed += 1;
        }
      }
    }
    return { processed, failed, dead };
  }

  let backgroundStarted = false;
  let backgroundTimer: NodeJS.Timeout | null = null;
  let backgroundRunning = false;

  function startBackgroundDispatcher(options?: {
    intervalMs?: number;
    batchSize?: number;
    publish?: (event: OutboxRecord) => Promise<void>;
  }) {
    if (backgroundStarted) return;
    backgroundStarted = true;
    const intervalMs = options?.intervalMs ?? 2000;
    const tick = async () => {
      if (backgroundRunning) return;
      backgroundRunning = true;
      try {
        const result = await dispatchPendingOutbox({
          batchSize: options?.batchSize,
          publish: options?.publish,
        });
        if (result.processed > 0 || result.dead > 0) {
          log.debug(
            { event: "outbox.tick", ...result },
            `Outbox dispatcher 周期：processed=${result.processed} failed=${result.failed} dead=${result.dead}`,
          );
        }
      } catch (err) {
        log.warn({ event: "outbox.tick_error", error: (err as Error).message }, `Outbox dispatcher 周期异常`);
      } finally {
        backgroundRunning = false;
      }
    };
    backgroundTimer = setInterval(tick, intervalMs);
    if (typeof backgroundTimer.unref === "function") backgroundTimer.unref();
  }

  async function stopBackgroundDispatcher() {
    if (backgroundTimer) {
      clearInterval(backgroundTimer);
      backgroundTimer = null;
    }
    backgroundStarted = false;
    // 等待当前 tick 结束
    while (backgroundRunning) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  function run<T>(fn: (tx: TransactionContext) => Promise<T> | T): Promise<T> {
    ensureSchema();
    const txId = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const outbox: OutboxEvent[] = [];
    const db = getRawDatabase(databaseFile) as unknown as {
      exec: (sql: string) => void;
      prepare: (sql: string) => { run: (...args: unknown[]) => unknown };
    };
    db.exec("BEGIN");
    let committed = false;
    let failed = false;
    const ctx: TransactionContext = {
      id: txId,
      enqueueOutboxEvent: (event) => {
        outbox.push(event);
      },
      execRaw: (sql) => {
        db.exec(sql);
      },
    };
    const finalize = () => {
      if (committed || failed) return;
      // 异常路径：未显式提交则回滚
      try {
        db.exec("ROLLBACK");
      } catch (err) {
        log.error({ event: "tx.rollback_failed", txId, error: (err as Error).message }, `事务回滚失败`);
      }
    };
    process.once("uncaughtException", finalize);
    return Promise.resolve()
      .then(() => fn(ctx))
      .then((value) => {
        // 提交前：把 outbox 事件也写入同一事务
        for (const event of outbox) {
          const id = event.id ?? genEventId();
          db.prepare(
            `INSERT INTO outbox_events
              (id, topic, payload, source, status, attempts, max_attempts, not_before, last_error, created_at, updated_at)
              VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, '', ?, ?)`,
          ).run(
            id,
            event.topic,
            JSON.stringify(event.payload ?? {}),
            event.source ?? "",
            event.attempts ?? 0,
            event.maxAttempts ?? 5,
            event.notBefore ?? 0,
            nowIso(),
            nowIso(),
          );
        }
        db.exec("COMMIT");
        committed = true;
        return value;
      })
      .catch((err) => {
        failed = true;
        try {
          db.exec("ROLLBACK");
        } catch (rollbackErr) {
          log.error({ event: "tx.rollback_error", txId, error: (rollbackErr as Error).message }, `事务回滚失败`);
        }
        log.warn(
          { event: "tx.rolled_back", txId, error: (err as Error).message },
          `事务回滚：${(err as Error).message}`,
        );
        throw err;
      })
      .finally(() => {
        process.off("uncaughtException", finalize);
      }) as Promise<T>;
  }

  function enqueueOutboxEvent(event: OutboxEvent): Promise<string> {
    ensureSchema();
    const db = getRawDatabase(databaseFile) as unknown as {
      prepare: (sql: string) => { run: (...args: unknown[]) => unknown };
    };
    const id = event.id ?? genEventId();
    db.prepare(
      `INSERT INTO outbox_events
        (id, topic, payload, source, status, attempts, max_attempts, not_before, last_error, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, '', ?, ?)`,
    ).run(
      id,
      event.topic,
      JSON.stringify(event.payload ?? {}),
      event.source ?? "",
      event.attempts ?? 0,
      event.maxAttempts ?? 5,
      event.notBefore ?? 0,
      nowIso(),
      nowIso(),
    );
    return Promise.resolve(id);
  }

  return {
    run,
    enqueueOutboxEvent,
    listPendingOutbox,
    markOutboxDone,
    markOutboxDead,
    bumpOutboxAttempt,
    dispatchPendingOutbox,
    startBackgroundDispatcher,
    stopBackgroundDispatcher,
    ensureSchema,
  };
}

function rowToRecord(row: Record<string, unknown>): OutboxRecord {
  return {
    id: String(row.id ?? ""),
    topic: String(row.topic ?? ""),
    payload: (() => {
      try {
        return JSON.parse(String(row.payload ?? "{}"));
      } catch {
        return {};
      }
    })(),
    source: typeof row.source === "string" ? row.source : "",
    status: String(row.status ?? "pending") as OutboxRecord["status"],
    attempts: Number(row.attempts ?? 0),
    maxAttempts: Number(row.max_attempts ?? 5),
    notBefore: Number(row.not_before ?? 0),
    lastError: String(row.last_error ?? ""),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}
