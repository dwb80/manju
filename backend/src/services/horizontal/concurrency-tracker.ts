/**
 * @file concurrency-tracker.ts
 * @description 节点并发控制追踪器（REQ-PIPE-001-05 节点最大并发）
 *
 * ## 设计目标
 * - 限制"同节点类型"在进程内同时执行的实例数，避免后端被 AI 调用打爆。
 * - 跨 Run 共享同一个计数器（process 级别，DB 关 / Run 失效不影响计数）。
 * - 不持久化：进程崩溃后计数归零，最坏情况是临时超过 max 一次（可接受）。
 * - 线程安全：JS 单线程下无需加锁；future 切到 worker pool 再加锁。
 *
 * ## 数据结构
 * ```
 * tracker
 *   ├─ counts: Map<nodeType, { running: number, lastMax: number }>
 *   └─ waiters: Map<nodeType, Array<{ resolve, reject, timer, createdAt }>>
 * ```
 *
 * ## acquire 流程
 * ```
 * acquire(type, max)
 *   ├─ 当前 running < lastMax → 返回 token（直接放行）
 *   └─ 当前 running >= lastMax → 返回 Promise，挂入 waiters；timeout 5min 自动 fail-open
 *
 * release(token)
 *   └─ 取出队首 waiter → resolve；无 waiter 则 running-- 即可
 * ```
 */
import { rootLogger } from "../../logger.js";

const log = rootLogger.child({ module: "concurrency-tracker" });

/** 全局默认 max（REQ-PIPE-001-05 默认 3）。可被节点 / Run 的 max_concurrent 覆盖。 */
export const DEFAULT_MAX_CONCURRENT: Record<string, number> = {
  image_generation: 3,
  generate_image: 3,
  video_generation: 2,
  generate_video: 2,
  tts: 5,
  composition: 2,
  compose: 2,
  render: 2,
  quality_check: 5,
  review: 5,
  notification: 10,
  webhook: 5,
  wait: 10,
  delay: 10,
};

/** 等待并发槽位的最长等待时间（防止永久卡住）。超时后强制放行（fail-open）。 */
const WAIT_TIMEOUT_MS = 5 * 60 * 1000; // 5 分钟

/** 等待 token：调用方持有直到 release。 */
export interface ConcurrencyToken {
  type: string;
  acquiredAt: number;
}

interface Waiter {
  resolve: (token: ConcurrencyToken) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
  createdAt: number;
}

interface TypeState {
  running: number;
  /** 该类型历史上已分配的 max（最后一次 acquire 写入；仅用于观测，不参与准入）。 */
  lastMax: number;
}

export interface ConcurrencyTracker {
  /**
   * 申请一个并发槽位。若当前 running 数 < max，立即返回 token；
   * 否则挂入等待队列，token 在容量可用时被 resolve。
   * 超过 WAIT_TIMEOUT_MS 强制 resolve（fail-open，避免永久卡住）。
   */
  acquire(type: string, max: number): Promise<ConcurrencyToken>;
  /**
   * 释放一个槽位。若等待队列非空，立即唤醒队首（不实际 running--）。
   * 必须用 token 调用，防止误释放别人的槽位（type 校验）。
   */
  release(token: ConcurrencyToken): void;
  /** 查询当前某类型运行中的数量（观测 / 测试用）。 */
  getRunning(type: string): number;
  /** 当前所有类型 waiting 队列长度（观测 / 测试用）。 */
  getPendingCount(type?: string): number;
  /** 关闭追踪器：清空所有 waiting 的 timer（服务关闭时调用）。 */
  dispose(): void;
}

export function createConcurrencyTracker(): ConcurrencyTracker {
  const counts = new Map<string, TypeState>();
  const waiters = new Map<string, Waiter[]>();

  function getOrCreateState(type: string): TypeState {
    let s = counts.get(type);
    if (!s) {
      s = { running: 0, lastMax: 0 };
      counts.set(type, s);
    }
    return s;
  }

  function getOrCreateWaiterList(type: string): Waiter[] {
    let list = waiters.get(type);
    if (!list) {
      list = [];
      waiters.set(type, list);
    }
    return list;
  }

  return {
    async acquire(type, max) {
      const state = getOrCreateState(type);
      state.lastMax = Math.max(1, max | 0);
      if (state.running < state.lastMax) {
        state.running += 1;
        return { type, acquiredAt: Date.now() };
      }
      return new Promise<ConcurrencyToken>((resolve, reject) => {
        const list = getOrCreateWaiterList(type);
        const createdAt = Date.now();
        const waiter: Waiter = {
          resolve,
          reject,
          createdAt,
          timer: setTimeout(() => {
            const idx = list.indexOf(waiter);
            if (idx >= 0) list.splice(idx, 1);
            if (list.length === 0) waiters.delete(type);
            state.running += 1;
            log.warn(
              {
                event: "concurrency.wait_timeout_failopen",
                type,
                waitedMs: Date.now() - createdAt,
                running: state.running,
                max: state.lastMax,
              },
              `并发等待超过 5min，强制放行（fail-open）`,
            );
            resolve({ type, acquiredAt: Date.now() });
          }, WAIT_TIMEOUT_MS),
        };
        list.push(waiter);
        log.debug(
          { event: "concurrency.waiting", type, running: state.running, max: state.lastMax, queueLen: list.length },
          `并发已满，节点进入等待队列`,
        );
      });
    },

    release(token) {
      const state = counts.get(token.type);
      if (!state) {
        log.warn({ event: "concurrency.release_unknown_type", type: token.type }, `释放未追踪类型`);
        return;
      }
      const list = waiters.get(token.type);
      if (list && list.length > 0) {
        const w = list.shift()!;
        clearTimeout(w.timer);
        if (list.length === 0) waiters.delete(token.type);
        const nextToken: ConcurrencyToken = { type: token.type, acquiredAt: Date.now() };
        try {
          w.resolve(nextToken);
        } catch (err) {
          log.warn(
            { event: "concurrency.waiter_resolve_failed", type: token.type, error: (err as Error).message },
            `等待者 resolve 失败`,
          );
          state.running = Math.max(0, state.running - 1);
        }
        return;
      }
      state.running = Math.max(0, state.running - 1);
    },

    getRunning(type) {
      return counts.get(type)?.running ?? 0;
    },

    getPendingCount(type) {
      if (type) return waiters.get(type)?.length ?? 0;
      let n = 0;
      for (const list of waiters.values()) n += list.length;
      return n;
    },

    dispose() {
      for (const list of waiters.values()) {
        for (const w of list) {
          clearTimeout(w.timer);
          try {
            w.reject(new Error("CONCURRENCY_TRACKER_DISPOSED"));
          } catch {
            // ignore
          }
        }
      }
      waiters.clear();
      counts.clear();
    },
  };
}

/**
 * getNodeMaxConcurrent - 解析某节点的最大并发上限
 *
 * 优先级（高 → 低）：
 * 1. 节点 config.max_concurrent（显式指定）
 * 2. Run workflow_config.max_concurrent_by_type[type]（Run 级别策略）
 * 3. DEFAULT_MAX_CONCURRENT[type]（全局默认）
 * 4. 兜底 3
 */
export function getNodeMaxConcurrent(
  type: string,
  config: Record<string, unknown> | undefined,
  runConfig: Record<string, unknown> | undefined,
): number {
  const nodeOverride = Number((config as any)?.max_concurrent ?? 0);
  if (Number.isFinite(nodeOverride) && nodeOverride >= 1) {
    return Math.min(nodeOverride, 100); // 上限保护（防止恶意配置）
  }
  const byType = (runConfig as any)?.max_concurrent_by_type as Record<string, number> | undefined;
  const runOverride = Number(byType?.[type] ?? 0);
  if (Number.isFinite(runOverride) && runOverride >= 1) {
    return Math.min(runOverride, 100);
  }
  return DEFAULT_MAX_CONCURRENT[type] ?? 3;
}
