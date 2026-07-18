/**
 * @file audit-log.ts
 * @description 应用审计日志服务。提供操作审计日志的写入功能：
 *   - 记录实体变更（创建/更新/删除/恢复）
 *   - 记录跨项目复制等敏感操作
 *   - 支持追踪 ID 关联日志上下文
 * 
 * 设计原则：
 *   - 审计日志写入失败时仅记录错误日志，不抛出异常，避免阻塞业务流程
 *   - 同时写入结构化日志（pino）和数据库（app_logs 表）
 */

import { randomUUID } from "node:crypto";
import type { AppContext } from "./app.js";
import type { AppLog, AppLogAction, AppLogEntityType } from "../types.js";
import { nowIso } from "../utils.js";
import { currentLogContext, rootLogger } from "../logger.js";

/**
 * recordAppLog - 写入应用审计日志
 * @param {AppContext} ctx - 应用上下文
 * @param {object} params - 日志参数
 * @param {AppLogEntityType} params.entityType - 实体类型
 * @param {string} params.entityId - 实体 ID
 * @param {AppLogAction} params.action - 操作类型
 * @param {string} params.event - 事件名称
 * @param {Record<string, unknown>} params.payload - 负载数据
 * @param {string} params.operator - 操作者
 * @param {string} params.projectId - 项目 ID
 * @returns {Promise<void>} 无返回值
 */
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
      `审计日志：${params.action} ${params.entityType}#${params.entityId}`,
    );
  } catch (err) {
    rootLogger.error(
      { event: "appLog.writeFailed", err, entityType: params.entityType, entityId: params.entityId },
      "审计日志写入失败",
    );
  }
}
