/**
 * @file pipeline-event-bus.ts
 * @description 节点事件 pub/sub 总线（REQ-PIPE-003-01 SSE 实时进度推送底层）
 *
 * ## 设计目标
 * - 进程内 pub/sub：service.recordEvent 写入 → 实时推送给所有订阅该 runId 的客户端。
 * - 每个订阅者有独立队列（避免一个慢消费者拖死其他订阅者）。
 * - 队列满（200）时丢最旧的、计 droppedCount（背压策略）。
 * - 不持久化：DB 是事件流的真源，bus 只承担"实时通知"职责。
 *
 * ## 典型用法
 * ```
 * const bus = createPipelineEventBus();
 * const sub = bus.subscribe(runId);
 * // ... node started/completed ...
 * bus.publish(event);
 * sub.queue  // → 实时拿到事件
 * bus.unsubscribe(sub);
 * ```
 */
import { rootLogger } from "../../logger.js";
import type { PipelineEvent } from "../../types/pipeline.js";

const log = rootLogger.child({ module: "pipeline-event-bus" });

/** 单订阅者队列容量。超出按 FIFO 丢最旧。 */
const SUBSCRIBER_QUEUE_MAX = 200;

export interface PipelineEventSubscriber {
  id: string;
  runId: string;
  queue: PipelineEvent[];
  closed: boolean;
  enqueuedCount: number;
  droppedCount: number;
}

export interface PipelineEventBus {
  /**
   * 订阅指定 runId 的事件流。返回的 subscriber 持有独立 queue。
   * 调用方需轮询 subscriber.queue（或直接拿整个 array）。
   */
  subscribe(runId: string): PipelineEventSubscriber;
  /**
   * 取消订阅。会把 subscriber 标 closed 并不再接收新事件。
   * 多次调用安全（重复 unsubscribe 静默忽略）。
   */
  unsubscribe(subscriber: PipelineEventSubscriber): void;
  /**
   * 发布事件到所有订阅者。事件按 subscriber 各自的 queue 容量进行背压。
   * 失败由 try/catch 吞掉（不影响调用方主流程）。
   */
  publish(event: PipelineEvent): void;
  /** 当前订阅者总数（观测 / 测试用）。 */
  size(): number;
  /**
   * 清空指定 runId 的所有订阅者（run 完成 / 异常时由 service 显式调用）。
   * 返回被清空的订阅者数量。
   */
  clearRun(runId: string): number;
}

export function createPipelineEventBus(): PipelineEventBus {
  // runId → Set<PipelineEventSubscriber>
  const subscribers = new Map<string, Set<PipelineEventSubscriber>>();

  function getOrCreateRunSet(runId: string): Set<PipelineEventSubscriber> {
    let set = subscribers.get(runId);
    if (!set) {
      set = new Set();
      subscribers.set(runId, set);
    }
    return set;
  }

  return {
    subscribe(runId) {
      const subscriber: PipelineEventSubscriber = {
        id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        runId,
        queue: [],
        closed: false,
        enqueuedCount: 0,
        droppedCount: 0,
      };
      getOrCreateRunSet(runId).add(subscriber);
      log.debug(
        { event: "pipeline.event_bus.subscribed", runId, subscriberId: subscriber.id, totalSubs: getOrCreateRunSet(runId).size },
        `新订阅者已加入`,
      );
      return subscriber;
    },

    unsubscribe(subscriber) {
      if (subscriber.closed) return;
      subscriber.closed = true;
      const set = subscribers.get(subscriber.runId);
      if (set) {
        set.delete(subscriber);
        if (set.size === 0) subscribers.delete(subscriber.runId);
      }
      log.debug(
        { event: "pipeline.event_bus.unsubscribed", runId: subscriber.runId, subscriberId: subscriber.id, dropped: subscriber.droppedCount, enqueued: subscriber.enqueuedCount },
        `订阅者已退出`,
      );
    },

    publish(event) {
      const set = subscribers.get(event.run_id);
      if (!set || set.size === 0) return;
      for (const sub of set) {
        if (sub.closed) continue;
        try {
          if (sub.queue.length >= SUBSCRIBER_QUEUE_MAX) {
            // 背压：丢最旧的
            sub.queue.shift();
            sub.droppedCount += 1;
          }
          sub.queue.push(event);
          sub.enqueuedCount += 1;
        } catch (err) {
          // 单个订阅者异常不能影响其他人
          log.warn(
            { event: "pipeline.event_bus.publish_failed", runId: event.run_id, subscriberId: sub.id, error: (err as Error).message },
            `向订阅者投递事件失败（已忽略）`,
          );
        }
      }
    },

    size() {
      let n = 0;
      for (const set of subscribers.values()) n += set.size;
      return n;
    },

    clearRun(runId) {
      const set = subscribers.get(runId);
      if (!set) return 0;
      const count = set.size;
      for (const sub of set) sub.closed = true;
      subscribers.delete(runId);
      log.info({ event: "pipeline.event_bus.run_cleared", runId, cleared: count }, `已清空 runId 的所有订阅者`);
      return count;
    },
  };
}
