/**
 * @file audit-service.ts
 * @description 审计日志服务（异步批量写入）。
 *
 * ## 设计要点
 *  - log() 是 fire-and-forget，立即返回，调用方不需要 await。
 *  - 内部维护 50 条一批的写入队列，避免高频操作（如 review 流）打爆 DB。
 *  - flush() 在进程退出时调用，确保队列里的数据落库。
 *
 * ## 表结构
 *  - audit_logs(id, actor_id, action, target_type, target_id, payload, ip, created_at)
 */
import { rootLogger } from "../../logger.js";
import type { AppContext } from "../app.js";
import type { AuditLog } from "../../types/horizontal.js";

const log = rootLogger.child({ module: "audit-service" });

/** 批量写入上限。 */
const FLUSH_BATCH = 50;

export interface AuditSearchFilter {
  actorId?: string;
  action?: string;
  targetType?: string;
  targetId?: string;
  from?: string;
  to?: string;
  limit?: number;
}

export interface AuditService {
  log(actor: string, action: string, target: { type: string; id?: string; payload?: unknown }): void;
  search(filter: AuditSearchFilter): Promise<AuditLog[]>;
  flush(): Promise<void>;
}

export function createAuditService(ctx: AppContext): AuditService {
  const writeQueue: AuditLog[] = [];
  let drainPromise: Promise<void> | null = null;

  function drainQueue(): Promise<void> {
    if (drainPromise) return drainPromise;
    if (writeQueue.length === 0) return Promise.resolve();
    drainPromise = (async () => {
      while (writeQueue.length > 0) {
        const batch = writeQueue.splice(0, FLUSH_BATCH);
        try {
          await ctx.auditLogs.insertBatch(batch);
          log.debug({ count: batch.length, remaining: writeQueue.length }, "审计日志批量写入");
        } catch (err) {
          log.error({ err: err instanceof Error ? err.message : String(err) }, "审计日志批量写入失败");
        }
      }
    })().finally(() => {
      drainPromise = null;
    });
    return drainPromise;
  }

  return {
    log(actor, action, target) {
      const record: AuditLog = {
        id: crypto.randomUUID(),
        actor_id: actor,
        action,
        target_type: target.type,
        target_id: target.id,
        payload: target.payload === undefined ? "" : JSON.stringify(target.payload),
        created_at: new Date().toISOString(),
      };
      writeQueue.push(record);
      void drainQueue();
    },

    async search(filter) {
      const all = await ctx.auditLogs.findMany({});
      const filtered = all.filter((row) => {
        if (filter.actorId && row.actor_id !== filter.actorId) return false;
        if (filter.action && row.action !== filter.action) return false;
        if (filter.targetType && row.target_type !== filter.targetType) return false;
        if (filter.targetId && row.target_id !== filter.targetId) return false;
        if (filter.from && row.created_at < filter.from) return false;
        if (filter.to && row.created_at > filter.to) return false;
        return true;
      });
      filtered.sort((a, b) => b.created_at.localeCompare(a.created_at));
      if (filter.limit) {
        return filtered.slice(0, filter.limit);
      }
      return filtered;
    },

    async flush() {
      await drainQueue();
    },
  };
}
