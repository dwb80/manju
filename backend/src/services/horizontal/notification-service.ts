/**
 * @file notification-service.ts
 * @description 站内通知服务（顶栏铃铛）。为审核 / 任务 / 邀请等事件提供统一收件箱。
 *
 * ## 设计要点
 *  - payload 是 JSON 字符串，前端按需解析。
 *  - 排序按 created_at 倒序，最新在前。
 *  - markAllRead 是 N 次 update（表小可接受），未来可改 batch update。
 *
 * ## 表结构
 *  - notifications(id, user_id, type, title, body, payload, read_at, created_at)
 */
import { rootLogger } from "../../logger.js";
import type { AppContext } from "../app.js";
import type { Notification } from "../../types/horizontal.js";

const log = rootLogger.child({ module: "notification-service" });

/** V1 单用户版默认 user_id。 */
const DEFAULT_USER_ID = "default";

export interface NotificationPayload {
  href?: string;
  refId?: string;
  [key: string]: unknown;
}

export interface NotificationService {
  notify(
    userId: string,
    type: string,
    title: string,
    body: string,
    payload?: NotificationPayload,
  ): Promise<Notification>;
  notifyDefault(
    type: string,
    title: string,
    body: string,
    payload?: NotificationPayload,
  ): Promise<Notification>;
  list(userId: string, options?: { unreadOnly?: boolean; limit?: number }): Promise<Notification[]>;
  countUnread(userId: string): Promise<number>;
  markRead(id: string): Promise<void>;
  markAllRead(userId: string): Promise<void>;
}

export function createNotificationService(ctx: AppContext): NotificationService {
  return {
    async notify(userId, type, title, body, payload) {
      const record: Notification = {
        id: crypto.randomUUID(),
        user_id: userId,
        type,
        title,
        body,
        payload: payload ? JSON.stringify(payload) : "",
        created_at: new Date().toISOString(),
      };
      await ctx.notifications.insert(record);
      log.debug({ userId, type, title }, "通知已发送");
      return record;
    },

    async notifyDefault(type, title, body, payload) {
      return this.notify(DEFAULT_USER_ID, type, title, body, payload);
    },

    async list(userId, options) {
      const all = await ctx.notifications.findMany({ user_id: userId });
      let filtered = all;
      if (options?.unreadOnly) {
        filtered = filtered.filter((n) => !n.read_at);
      }
      filtered.sort((a, b) => b.created_at.localeCompare(a.created_at));
      if (options?.limit) {
        return filtered.slice(0, options.limit);
      }
      return filtered;
    },

    async countUnread(userId) {
      const all = await ctx.notifications.findMany({ user_id: userId });
      return all.filter((n) => !n.read_at).length;
    },

    async markRead(id) {
      const now = new Date().toISOString();
      await ctx.notifications.update(id, { read_at: now });
    },

    async markAllRead(userId) {
      const all = await ctx.notifications.findMany({ user_id: userId });
      const now = new Date().toISOString();
      for (const n of all) {
        if (!n.read_at) {
          await ctx.notifications.update(n.id, { read_at: now });
        }
      }
    },
  };
}
