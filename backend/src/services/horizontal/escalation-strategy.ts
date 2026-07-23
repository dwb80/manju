/**
 * @file escalation-strategy.ts
 * @description SLA 升级策略（V2 W8 REQ-PIPE-005-03）。
 *
 * 3 级升级：
 *  - L1：通知 submitted_by（审核提交人）"您提交的审核已超时"
 *  - L2：通知项目 owner "您的项目下有审核超时未处理"
 *  - L3：调 webhook 投递器（V2 占位，无配置时降级为 L2 通知 + audit_log 记录）
 *
 * 升级等级去重：同一 review 同一等级不重复通知（由 shouldEscalateNow 控流）。
 * 所有失败都写 audit_log（action=sla_notify_failed / sla_escalated）。
 */

import { id as makeId, nowIso } from "../../utils.js";
import { rootLogger } from "../../logger.js";
import type { AppContext } from "../app.js";
import type { ReviewItem, ReviewConfig } from "../../types/horizontal.js";
import type { NotificationPayload } from "./notification-service.js";

const log = rootLogger.child({ module: "sla-escalation" });

/** SLA 通知类型常量（前端按 type 字符串路由）。 */
export const SLA_NOTIFY_TYPES = {
  /** 刚进入超时态（升级前哨）。 */
  PENDING_BREACH: "sla_pending_breach",
  /** in_review 状态超时。 */
  REVIEW_BREACH: "sla_review_breach",
  /** L1 升级：通知 reviewer。 */
  ESCALATED_L1: "sla_escalated_l1",
  /** L2 升级：通知 project owner。 */
  ESCALATED_L2: "sla_escalated_l2",
  /** L3 升级：webhook 投递（V2 占位）。 */
  ESCALATED_L3: "sla_escalated_l3",
} as const;

export type SlaNotifyType = (typeof SLA_NOTIFY_TYPES)[keyof typeof SLA_NOTIFY_TYPES];

/** 升级结果。 */
export interface EscalationResult {
  level: number;
  notified: string[]; // 接收人 userId 列表
  auditLogged: boolean;
  webhookAttempted: boolean;
  webhookOk?: boolean;
}

/**
 * EscalationStrategy - 升级执行器
 * @param {AppContext} ctx
 * @returns {EscalationStrategy}
 */
export interface EscalationStrategy {
  escalate(input: {
    review: ReviewItem;
    config: ReviewConfig;
    targetLevel: number;
  }): Promise<EscalationResult>;
}

export function createEscalationStrategy(ctx: AppContext): EscalationStrategy {
  /**
   * 写 audit_log 的辅助函数
   * @param {string} action
   * @param {string} message
   * @param {Record<string, unknown>} metadata
   * @returns {Promise<boolean>}
   */
  async function writeAudit(
    action: string,
    message: string,
    metadata: Record<string, unknown>,
  ): Promise<boolean> {
    try {
      // V1 schema 字段：id/actor_id/action/target_type/target_id/payload/ip/created_at
      // 扩展信息（reviewId/projectId/level）全部塞进 payload JSON 字符串
      const payload = JSON.stringify({ message, ...metadata });
      await ctx.auditLogs.insert({
        id: makeId("audit"),
        actor_id: "system",
        action,
        target_type: "review_item",
        target_id: (metadata.reviewId as string) ?? "",
        payload,
        created_at: nowIso(),
      } as any);
      return true;
    } catch (err) {
      log.error({ err, action, metadata }, "audit_log 写入失败");
      return false;
    }
  }

  /**
   * 发通知 + 失败时回写 audit_log 的辅助函数
   * @param {string} userId
   * @param {SlaNotifyType} type
   * @param {string} title
   * @param {string} body
   * @param {NotificationPayload} payload
   * @returns {Promise<boolean>}
   */
  async function safeNotify(
    userId: string,
    type: SlaNotifyType,
    title: string,
    body: string,
    payload: NotificationPayload,
  ): Promise<boolean> {
    if (!userId) return false;
    try {
      await ctx.notificationService.notify(userId, type, title, body, payload);
      return true;
    } catch (err) {
      log.error({ err, userId, type }, "SLA 通知发送失败");
      await writeAudit("sla_notify_failed", `SLA 通知发送失败: ${type}`, {
        reviewId: payload.reviewId as string,
        projectId: payload.projectId as string,
        recipient: userId,
        type,
        error: (err as Error).message,
      });
      return false;
    }
  }

  return {
    async escalate({ review, config, targetLevel }) {
      const result: EscalationResult = {
        level: targetLevel,
        notified: [],
        auditLogged: false,
        webhookAttempted: false,
      };

      const payload: NotificationPayload = {
        reviewId: review.id,
        projectId: review.project_id,
        targetType: review.target_type,
        targetId: review.target_id,
        escalationLevel: targetLevel,
        breachedAt: review.breached_at,
        href: `/reviews/${review.id}`,
      };

      // L1：通知 reviewer（submitted_by）
      if (targetLevel >= 1) {
        const userId = review.submitted_by;
        if (userId) {
          const ok = await safeNotify(
            userId,
            SLA_NOTIFY_TYPES.ESCALATED_L1,
            "您提交的审核已超时",
            `审核 #${review.id.slice(0, 8)} 等待处理超过 ${config.sla_pending_hours} 小时，请尽快跟进。`,
            { ...payload, recipient: userId },
          );
          if (ok) result.notified.push(userId);
        }
      }

      // L2：通知项目 owner（取 project_members 中 role=owner 的成员）
      if (targetLevel >= 2) {
        try {
          const members = (await ctx.projectMembers.findMany({
            project_id: review.project_id,
            role: "owner",
          } as any)) as Array<{ contact?: string; name?: string }>;
          for (const member of members) {
            const userId = member.contact || member.name || "";
            if (!userId) continue;
            const ok = await safeNotify(
              userId,
              SLA_NOTIFY_TYPES.ESCALATED_L2,
              "项目审核超时未处理",
              `项目 ${review.project_id} 下有 ${result.notified.length === 0 ? "1" : "多条"} 审核超时，请关注。`,
              { ...payload, recipient: userId },
            );
            if (ok) result.notified.push(userId);
          }
        } catch (err) {
          log.warn({ err, projectId: review.project_id }, "查询项目 owner 失败");
        }
      }

      // L3：webhook 投递（V2 占位）
      if (targetLevel >= 3) {
        result.webhookAttempted = true;
        // V2 W8：webhook 配置在 reviewConfigs 中预留（V1 schema 无此字段），
        // 无配置时不投递，结果记 audit_log。V2.1 接入钉钉/飞书 webhook。
        const auditOk = await writeAudit(
          "sla_escalated",
          `L3 webhook 升级（V2 占位，无配置）`,
          {
            reviewId: review.id,
            projectId: review.project_id,
            level: targetLevel,
            note: "L3 webhook not configured in V2.0; 仅写 audit_log",
          },
        );
        result.auditLogged = auditOk;
        result.webhookOk = false;
        return result;
      }

      // L1/L2 路径：写 audit_log
      const auditOk = await writeAudit("sla_escalated", `SLA 升级到 L${targetLevel}`, {
        reviewId: review.id,
        projectId: review.project_id,
        level: targetLevel,
        notified: result.notified,
        escalationEnabled: config.escalation_enabled,
        maxLevel: config.escalation_max_level,
      });
      result.auditLogged = auditOk;
      return result;
    },
  };
}
