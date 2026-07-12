import { randomUUID } from "node:crypto";
import type { AppContext } from "./app.js";
import type { AppLog, AppLogAction, AppLogEntityType } from "../types.js";
import { nowIso } from "../utils.js";
import { currentLogContext, rootLogger } from "../logger.js";

/** 写一条应用审计日志。失败时仅记 rootLogger，不抛出，避免审计阻塞业务。 */
export async function recordAppLog(
  ctx: AppContext,
  params: {
    entityType: AppLogEntityType;
    entityId: string;
    action: AppLogAction;
    event: string;
    payload?: Record<string, unknown>;
    operator?: string;
    projectId?: string;
  },
): Promise<void> {
  try {
    const ctxFields = currentLogContext();
    const log: AppLog = {
      id: randomUUID(),
      entity_type: params.entityType,
      entity_id: params.entityId,
      action: params.action,
      event: params.event,
      payload: JSON.stringify(params.payload ?? {}),
      operator: params.operator ?? "system",
      project_id: params.projectId ?? "",
      trace_id: ctxFields.traceId ?? "",
      created_at: nowIso(),
    };
    await ctx.appLogs.insert(log);
    rootLogger.info(
      {
        event: params.event,
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
        projectId: log.project_id,
        operator: log.operator,
        ...(params.payload ?? {}),
      },
      `app_log: ${params.action} ${params.entityType}#${params.entityId}`,
    );
  } catch (err) {
    rootLogger.error(
      { event: "appLog.writeFailed", err, entityType: params.entityType, entityId: params.entityId },
      "recordAppLog failed",
    );
  }
}
