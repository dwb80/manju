/**
 * @file sla-router.ts
 * @description SLA 监控路由模块（V2 W8 REQ-PIPE-005-03）。
 *
 * 提供 6 个端点：
 *  - GET    /api/sla/reviews?projectId=                列表（带 sla_due_at / breached / level）
 *  - GET    /api/sla/reviews/:id                       单条详情
 *  - GET    /api/sla/stats?projectId=                  统计（已超时 / 已升级 / 各等级计数）
 *  - GET    /api/sla/config?projectId=                 读 SLA 配置
 *  - PUT    /api/sla/config?projectId=                 改 SLA 配置（owner）
 *  - POST   /api/sla/reviews/:id/escalate              手动升级（admin / owner）
 *  - GET    /api/sla/monitor/stats                     监控器运行统计
 *
 * 设计要点：
 *  - 不在路由里做权限二次开发：复用主路由的 canAccessProject / isAdmin。
 *  - 配置改完后由 sla-monitor 内部重算非终态 review 的 sla_due_at。
 *  - 手动升级：跳过 shouldEscalateNow 的 delay 判定，直接到下一级。
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { AppContext } from "../services/app.js";
import { rootLogger } from "../logger.js";
import { isReviewActive, isSlaBreached } from "../services/horizontal/sla-utils.js";
import { hasPermission, getMemberByUserId } from "../services/horizontal/project-member-service.js";
import type { ReviewItem } from "../types/horizontal.js";

const log = rootLogger.child({ module: "sla-router" });

/** 路由访问上下文（由主路由注入）。 */
export interface SlaAccess {
  userId: string;
  isAdmin: boolean;
  canAccessProject(projectId: string): Promise<boolean>;
}

/** SLA 视图条目（补两个计算字段，不改原表结构）。 */
export interface SlaReviewView extends ReviewItem {
  /** 是否已超时（运行时计算）。 */
  sla_breached: boolean;
  /** 距 SLA 到期剩余秒数（负数=已超时秒数；空=无 SLA）。 */
  sla_seconds_remaining: number;
}

/**
 * 计算 SLA 视图字段（不修改原 review）。
 * @param r review
 */
function toView(r: ReviewItem, now: Date = new Date()): SlaReviewView {
  const breached = isSlaBreached(r, now);
  let secondsRemaining = 0;
  if (r.sla_due_at && !r.deleted_at) {
    const dueMs = Date.parse(r.sla_due_at);
    if (Number.isFinite(dueMs)) {
      secondsRemaining = Math.floor((dueMs - now.getTime()) / 1000);
    }
  }
  return { ...r, sla_breached: breached, sla_seconds_remaining: secondsRemaining };
}

/** 解析 URL 路径为段。 */
function partsOf(url: string): string[] {
  const u = new URL(url, "http://localhost");
  return u.pathname.split("/").filter(Boolean);
}

/** 读取 JSON 请求体（错误返回 400）。 */
async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf-8");
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(new Error("invalid_json"));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(payload));
}

/**
 * 路由入口。
 */
export async function handleSlaRouter(
  ctx: AppContext,
  req: IncomingMessage,
  res: ServerResponse,
  access: SlaAccess,
): Promise<void> {
  const parts = partsOf(req.url ?? "/");
  const method = (req.method ?? "GET").toUpperCase();
  if (parts[0] !== "api" || parts[1] !== "sla") return;

  try {
    // GET /api/sla/monitor/stats
    if (method === "GET" && parts[2] === "monitor" && parts[3] === "stats" && !parts[4]) {
      if (!access.isAdmin) {
        sendJson(res, 403, { error: "forbidden" });
        return;
      }
      sendJson(res, 200, ctx.slaMonitor.stats());
      return;
    }

    // === /api/sla/reviews ===
    if (parts[2] === "reviews") {
      const url = new URL(req.url ?? "/", "http://localhost");
      const projectId = url.searchParams.get("projectId");

      // POST /api/sla/reviews/:id/escalate
      if (method === "POST" && parts[3] && parts[4] === "escalate") {
        const reviewId = parts[3];
        const review = await ctx.reviewItems.findById(reviewId);
        if (!review) {
          sendJson(res, 404, { error: "review_not_found" });
          return;
        }
        if (!(await access.canAccessProject(review.project_id))) {
          sendJson(res, 403, { error: "forbidden" });
          return;
        }
        if (!access.isAdmin) {
          const member = await getMemberByUserId(ctx, review.project_id, access.userId);
          if (!member || member.role !== "owner" || !hasPermission(member, "review.approve")) {
            sendJson(res, 403, { error: "forbidden_owner_or_admin_only" });
            return;
          }
        }
        const result = await ctx.slaMonitor.escalateOne(reviewId, "manual");
        if (!result) {
          sendJson(res, 200, { escalated: false, reason: "no_escalation_needed" });
          return;
        }
        sendJson(res, 200, { escalated: true, ...result });
        return;
      }

      // GET /api/sla/reviews/:id
      if (method === "GET" && parts[3] && !parts[4]) {
        const review = await ctx.reviewItems.findById(parts[3]);
        if (!review) {
          sendJson(res, 404, { error: "review_not_found" });
          return;
        }
        if (!(await access.canAccessProject(review.project_id))) {
          sendJson(res, 403, { error: "forbidden" });
          return;
        }
        sendJson(res, 200, toView(review as ReviewItem));
        return;
      }

      // GET /api/sla/reviews?projectId=&breachedOnly=1&level=
      if (method === "GET" && !parts[3]) {
        if (!projectId) {
          sendJson(res, 400, { error: "projectId required" });
          return;
        }
        if (!(await access.canAccessProject(projectId))) {
          sendJson(res, 403, { error: "forbidden" });
          return;
        }
        const breachedOnly = url.searchParams.get("breachedOnly") === "1";
        const levelParam = url.searchParams.get("level");
        const level = levelParam != null ? Number(levelParam) : null;
        const all = (await ctx.reviewItems.findMany({ project_id: projectId } as any)) as ReviewItem[];
        const active = all.filter(isReviewActive);
        const views = active.map((r) => toView(r));
        const filtered = views.filter((v) => {
          if (breachedOnly && !v.sla_breached) return false;
          if (level != null && v.escalation_level !== level) return false;
          return true;
        });
        sendJson(res, 200, filtered);
        return;
      }
    }

    // === /api/sla/stats ===
    if (method === "GET" && parts[2] === "stats" && !parts[3]) {
      const url = new URL(req.url ?? "/", "http://localhost");
      const projectId = url.searchParams.get("projectId");
      if (!projectId) {
        sendJson(res, 400, { error: "projectId required" });
        return;
      }
      if (!(await access.canAccessProject(projectId))) {
        sendJson(res, 403, { error: "forbidden" });
        return;
      }
      const all = (await ctx.reviewItems.findMany({ project_id: projectId } as any)) as ReviewItem[];
      const active = all.filter(isReviewActive);
      const breached = active.filter((r) => isSlaBreached(r)).length;
      const byLevel: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
      for (const r of active) {
        const lvl = Number(r.escalation_level ?? 0);
        if (lvl in byLevel) byLevel[lvl] += 1;
        else byLevel[lvl] = 1;
      }
      sendJson(res, 200, {
        project_id: projectId,
        total_active: active.length,
        breached,
        breached_rate: active.length > 0 ? breached / active.length : 0,
        by_level: byLevel,
        monitor: ctx.slaMonitor.stats(),
        generated_at: new Date().toISOString(),
      });
      return;
    }

    // === /api/sla/config ===
    if (parts[2] === "config" && !parts[3]) {
      const url = new URL(req.url ?? "/", "http://localhost");
      const projectId = url.searchParams.get("projectId");
      if (!projectId) {
        sendJson(res, 400, { error: "projectId required" });
        return;
      }
      if (!(await access.canAccessProject(projectId))) {
        sendJson(res, 403, { error: "forbidden" });
        return;
      }

      if (method === "GET") {
        const config = await ctx.slaMonitor.getOrCreateConfig(projectId);
        sendJson(res, 200, config);
        return;
      }

      if (method === "PUT") {
        if (!access.isAdmin) {
          const member = await getMemberByUserId(ctx, projectId, access.userId);
          if (!member || member.role !== "owner" || !hasPermission(member, "project.edit")) {
            sendJson(res, 403, { error: "forbidden_owner_or_admin_only" });
            return;
          }
        }
        const body = await readJsonBody(req);
        const patch: { sla_pending_hours?: number; sla_review_hours?: number; escalation_enabled?: boolean; escalation_max_level?: number } = {};
        if (typeof body.sla_pending_hours === "number") patch.sla_pending_hours = body.sla_pending_hours;
        if (typeof body.sla_review_hours === "number") patch.sla_review_hours = body.sla_review_hours;
        if (typeof body.escalation_enabled === "boolean") patch.escalation_enabled = body.escalation_enabled;
        if (typeof body.escalation_max_level === "number") patch.escalation_max_level = body.escalation_max_level;
        try {
          const updated = await ctx.slaMonitor.updateConfig(projectId, patch);
          sendJson(res, 200, updated);
          return;
        } catch (err) {
          const msg = (err as Error).message || "config_update_failed";
          sendJson(res, 400, { error: msg });
          return;
        }
      }
    }

    sendJson(res, 404, { error: "sla route not found" });
  } catch (err) {
    log.error({ err, url: req.url, method }, "SLA 路由错误");
    sendJson(res, 500, { error: (err as Error).message || "internal_error" });
  }
}
