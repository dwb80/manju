/**
 * @file pipeline-event-service.ts
 * @description Pipeline 节点事件流服务（REQ-PIPE-003-03）。
 *
 * 职责：
 *  - recordEvent：把节点 / Run 生命周期事件写入 pipeline_events + 推 pipelineEventBus
 *  - listNodeEvents：按节点 ID + 类型过滤查询（前端时间线 + 排查）
 *  - pruneNodeEvents：每个节点最多保留 N 条事件，异步裁剪
 *
 * 拆分原因（REM-P1-006）：
 *  原 pipeline-run-service.ts 内嵌了事件落库 + 事件总线 + 裁剪三件事，
 *  和节点执行/调度混合在一起难以单独测试。拆出后该服务只依赖
 *  AppContext.pipelineEvents + AppContext.pipelineEventBus 两个端口。
 */
import type { AppContext } from "../app.js";
import { rootLogger } from "../../logger.js";
import type { PipelineEvent, PipelineEventType } from "../../types/pipeline.js";

const log = rootLogger.child({ module: "pipeline-event-service" });

/** 每个节点最多保留的事件数（REQ-PIPE-003-03 保留策略）。 */
const NODE_EVENTS_RETAIN_LIMIT = 1000;

export interface PipelineEventService {
  recordEvent(input: {
    runId: string;
    nodeId: string;
    projectId: string;
    type: PipelineEventType;
    payload: Record<string, unknown>;
  }): Promise<PipelineEvent | null>;
  listNodeEvents(
    nodeId: string,
    options?: { limit?: number; type?: PipelineEventType },
  ): Promise<PipelineEvent[]>;
  /** 异步裁剪某节点最早的多余事件；不阻塞主流程。 */
  pruneNodeEvents(nodeId: string, retainCount?: number): Promise<number>;
}

export function createPipelineEventService(ctx: AppContext): PipelineEventService {
  async function pruneNodeEvents(nodeId: string, retainCount: number = NODE_EVENTS_RETAIN_LIMIT): Promise<number> {
    if (!nodeId) return 0;
    const all = (await ctx.pipelineEvents.findMany(
      { node_id: nodeId } as any,
      { sort: "asc", limit: NODE_EVENTS_RETAIN_LIMIT * 2 },
    )) as PipelineEvent[];
    if (all.length <= retainCount) return 0;
    const toDelete = all.slice(0, all.length - retainCount);
    for (const e of toDelete) {
      try {
        await ctx.pipelineEvents.delete(e.id);
      } catch {
        // 单条失败不阻塞
      }
    }
    return toDelete.length;
  }

  return {
    async recordEvent(input) {
      const { runId, nodeId, projectId, type, payload } = input;
      const now = new Date().toISOString();
      const event: PipelineEvent = {
        id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        run_id: runId,
        node_id: nodeId,
        project_id: projectId,
        type,
        payload: payload ?? {},
        created_at: now,
      };
      try {
        await ctx.pipelineEvents.insert(event as any);
      } catch (err) {
        log.warn(
          {
            event: "pipeline.event.write_failed",
            runId,
            nodeId,
            type,
            error: (err as Error).message,
          },
          `写入节点事件失败，跳过（不影响主流程）`,
        );
        return null;
      }
      try {
        ctx.pipelineEventBus?.publish(event);
      } catch (busErr) {
        log.debug(
          {
            event: "pipeline.event_bus.publish_failed",
            runId,
            nodeId,
            type,
            error: (busErr as Error).message,
          },
          `事件总线 publish 失败（不影响主流程）`,
        );
      }
      pruneNodeEvents(nodeId).catch((err) => {
        log.debug(
          { event: "pipeline.event.prune_failed", nodeId, error: (err as Error).message },
          `节点事件裁剪失败（可忽略，下次写入会重试）`,
        );
      });
      return event;
    },

    async listNodeEvents(nodeId, options) {
      const limit = Math.max(1, Math.min(options?.limit ?? 200, NODE_EVENTS_RETAIN_LIMIT));
      const all = (await ctx.pipelineEvents.findMany(
        { node_id: nodeId } as any,
        { sort: "asc", limit: NODE_EVENTS_RETAIN_LIMIT },
      )) as PipelineEvent[];
      const filtered = options?.type ? all.filter((e) => e.type === options.type) : all;
      return filtered.slice(-limit);
    },

    pruneNodeEvents,
  };
}
