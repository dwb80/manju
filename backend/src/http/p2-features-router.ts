/** HTTP routes for all chapter-8 P2 backend capabilities. */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AppContext } from "../services/app.js";
import { readJsonBody, sendJson } from "./http-utils.js";
import {
  copyWorkflowTemplate,
  createP2Template,
  getP2Metrics,
  getP2Template,
  listP2Templates,
  listReconciliations,
  logManualWork,
  reconcileProviderBill,
  recordTemplateUsage,
  updateTemplateTags,
  type TemplateKind,
} from "../services/module-domain/p2-features-service.js";

interface Access {
  userId: string;
  isAdmin: boolean;
  canAccessProject(projectId: string): Promise<boolean>;
}

function error(res: ServerResponse, status: number, message: string): true {
  sendJson(res, status, { ok: false, code: status === 404 ? "not_found" : "invalid_request", message });
  return true;
}

async function requireProject(access: Access, projectId: string, res: ServerResponse): Promise<boolean> {
  if (!projectId) return error(res, 400, "projectId 必填");
  if (!access.isAdmin && !(await access.canAccessProject(projectId))) return error(res, 403, "无权访问该项目");
  return true;
}

export async function handleP2FeaturesRouter(
  ctx: AppContext,
  req: IncomingMessage,
  res: ServerResponse,
  access: Access,
  parts: string[],
): Promise<boolean> {
  const method = req.method ?? "GET";
  const url = new URL(req.url ?? "/", "http://localhost");
  const body = method === "POST" || method === "PATCH" ? await readJsonBody(req) as Record<string, unknown> : {};

  try {
    // POST/GET /api/p2/templates; PATCH /:id/tags; POST /:id/copy|usage; GET /:id/stats
    if (parts[1] === "p2" && parts[2] === "templates") {
      if (parts.length === 3 && method === "POST") {
        const projectId = String(body.projectId ?? body.project_id ?? "");
        if (!(await requireProject(access, projectId, res))) return true;
        const item = createP2Template(ctx.databaseFile, {
          projectId, kind: String(body.kind ?? "") as TemplateKind, name: String(body.name ?? ""),
          content: String(body.content ?? ""), tags: body.tags, createdBy: access.userId,
        });
        sendJson(res, 201, { ok: true, data: item }); return true;
      }
      if (parts.length === 3 && method === "GET") {
        const projectId = url.searchParams.get("projectId") ?? "";
        if (!(await requireProject(access, projectId, res))) return true;
        const rawKind = url.searchParams.get("kind");
        const kind = rawKind === "prompt" || rawKind === "workflow" ? rawKind : undefined;
        sendJson(res, 200, { ok: true, data: { items: listP2Templates(ctx.databaseFile, projectId, kind) } }); return true;
      }
      const templateId = decodeURIComponent(parts[3] ?? "");
      const current = getP2Template(ctx.databaseFile, templateId);
      if (!current) return error(res, 404, "模板不存在");
      if (!(await requireProject(access, current.project_id, res))) return true;
      if (parts[4] === "tags" && method === "PATCH") {
        sendJson(res, 200, { ok: true, data: updateTemplateTags(ctx.databaseFile, templateId, body.tags) }); return true;
      }
      if (parts[4] === "copy" && method === "POST") {
        const targetProject = String(body.projectId ?? current.project_id);
        if (!(await requireProject(access, targetProject, res))) return true;
        sendJson(res, 201, { ok: true, data: copyWorkflowTemplate(ctx.databaseFile, templateId, { projectId: targetProject, name: body.name ? String(body.name) : undefined, createdBy: access.userId }) }); return true;
      }
      if (parts[4] === "usage" && method === "POST") {
        sendJson(res, 201, { ok: true, data: recordTemplateUsage(ctx.databaseFile, templateId, { passed: body.passed === true, durationMs: Number(body.durationMs ?? 0), createdBy: access.userId }) }); return true;
      }
      if (parts[4] === "stats" && method === "GET") {
        sendJson(res, 200, { ok: true, data: current }); return true;
      }
    }

    // Provider bill reconciliation.
    if (parts[1] === "cost" && parts[2] === "reconciliations") {
      if (method === "POST") {
        const projectId = String(body.projectId ?? "");
        if (!(await requireProject(access, projectId, res))) return true;
        const result = reconcileProviderBill(ctx.databaseFile, {
          projectId, provider: String(body.provider ?? ""), monthKey: String(body.monthKey ?? ""),
          billedAmount: Number(body.billedAmount), currency: body.currency ? String(body.currency) : undefined,
          externalRef: body.externalRef ? String(body.externalRef) : undefined,
          tolerance: body.tolerance === undefined ? undefined : Number(body.tolerance),
        }, access.userId);
        sendJson(res, 201, { ok: true, data: result }); return true;
      }
      if (method === "GET") {
        const projectId = url.searchParams.get("projectId") ?? "";
        if (!(await requireProject(access, projectId, res))) return true;
        sendJson(res, 200, { ok: true, data: { items: listReconciliations(ctx.databaseFile, projectId, url.searchParams.get("monthKey") ?? undefined) } }); return true;
      }
    }

    // Manual-work logging and the three P2 data metrics.
    if (parts[1] === "data" && parts[2] === "manual-work" && method === "POST") {
      const projectId = String(body.projectId ?? "");
      if (!(await requireProject(access, projectId, res))) return true;
      sendJson(res, 201, { ok: true, data: logManualWork(ctx.databaseFile, {
        projectId, workType: String(body.workType ?? ""), durationSeconds: Number(body.durationSeconds),
        operatorId: access.userId, refType: body.refType ? String(body.refType) : undefined,
        refId: body.refId ? String(body.refId) : undefined, note: body.note ? String(body.note) : undefined,
        startedAt: body.startedAt ? String(body.startedAt) : undefined, endedAt: body.endedAt ? String(body.endedAt) : undefined,
      }) }); return true;
    }
    if (parts[1] === "data" && parts[2] === "p2-metrics" && method === "GET") {
      const projectId = url.searchParams.get("projectId") ?? "";
      if (!(await requireProject(access, projectId, res))) return true;
      sendJson(res, 200, { ok: true, data: getP2Metrics(ctx.databaseFile, projectId) }); return true;
    }
  } catch (caught) {
    return error(res, 400, caught instanceof Error ? caught.message : String(caught));
  }
  return false;
}
