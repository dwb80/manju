/** HTTP facade for chapter-8 P1 review, cost, template and operations features. */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AppContext } from "../services/app.js";
import { readJsonBody, sendJson } from "./http-utils.js";
import { createP2Template, getP2Template, type TemplateKind } from "../services/module-domain/p2-features-service.js";
import {
  addReviewAnnotation, assignReview, compareReviewVersions, getTemplateLifecycle, initializeTemplateVersion,
  listReviewAnnotations, listReviewAssignments, listTemplateVersions, previewTemplate, publishTemplate,
  qualifiedVideoCost, recordCostRefund, recordProviderActualCost, rollbackTemplate, saveReviewScorecard,
  updateTemplateLifecycle, validateTemplateVariables,
} from "../services/module-domain/p1-features-service.js";
import { getHttpPerformanceSummary } from "../services/horizontal/http-performance-service.js";
import { listProviderRateLimits, recordProviderRateLimit, recordProviderRecovered } from "../services/horizontal/provider-rate-limit-service.js";

interface Access { userId: string; isAdmin: boolean; canAccessProject(projectId: string): Promise<boolean> }
function fail(res: ServerResponse, status: number, message: string): true { sendJson(res, status, { ok: false, code: message.startsWith("version_conflict") ? "version_conflict" : "invalid_request", message }); return true; }
async function allowed(access: Access, projectId: string, res: ServerResponse) { if (!projectId) return fail(res, 400, "projectId 必填"); if (!access.isAdmin && !(await access.canAccessProject(projectId))) return fail(res, 403, "无权访问该项目"); return true; }

export async function handleP1FeaturesRouter(ctx: AppContext, req: IncomingMessage, res: ServerResponse, access: Access, parts: string[]): Promise<boolean> {
  if (parts[0] !== "api" || parts[1] !== "p1") return false;
  const method = req.method ?? "GET"; const url = new URL(req.url ?? "/", "http://localhost");
  let body: Record<string, unknown> = {}; if (method === "POST" || method === "PATCH" || method === "PUT") body = await readJsonBody(req) as Record<string, unknown>;
  try {
    if (parts[2] === "reviews") {
      const reviewId = decodeURIComponent(parts[3] ?? ""); const review = await ctx.reviewItems.findById(reviewId);
      if (!review) return fail(res, 404, "review_not_found"); if (!(await allowed(access, review.project_id, res))) return true;
      const action = parts[4];
      if (action === "assign" && method === "POST") { sendJson(res, 201, { ok: true, data: await assignReview(ctx.databaseFile, reviewId, String(body.reviewerId ?? ""), access.userId) }); return true; }
      if (action === "assignments" && method === "GET") { sendJson(res, 200, { ok: true, data: { items: listReviewAssignments(ctx.databaseFile, reviewId) } }); return true; }
      if (action === "annotations" && method === "POST") { sendJson(res, 201, { ok: true, data: addReviewAnnotation(ctx.databaseFile, reviewId, body, access.userId) }); return true; }
      if (action === "annotations" && method === "GET") { sendJson(res, 200, { ok: true, data: { items: listReviewAnnotations(ctx.databaseFile, reviewId) } }); return true; }
      if (action === "scorecard" && (method === "PUT" || method === "POST")) { sendJson(res, 200, { ok: true, data: saveReviewScorecard(ctx.databaseFile, reviewId, body.dimensions, access.userId) }); return true; }
      if (action === "compare" && method === "GET") { sendJson(res, 200, { ok: true, data: compareReviewVersions(ctx.databaseFile, reviewId, url.searchParams.get("left") ?? undefined, url.searchParams.get("right") ?? undefined) }); return true; }
    }

    if (parts[2] === "cost") {
      if (parts[3] === "provider-callback" && method === "POST") { const projectId = String(body.projectId ?? ""); if (!(await allowed(access, projectId, res))) return true; sendJson(res, 201, { ok: true, data: recordProviderActualCost(ctx.databaseFile, { projectId, monthKey: String(body.monthKey ?? ""), actualAmount: Number(body.actualAmount), idempotencyKey: String(body.idempotencyKey ?? ""), refType: body.refType ? String(body.refType) : undefined, refId: body.refId ? String(body.refId) : undefined, provider: body.provider ? String(body.provider) : undefined }) }); return true; }
      if (parts[3] === "refunds" && method === "POST") { const projectId = String(body.projectId ?? ""); if (!(await allowed(access, projectId, res))) return true; sendJson(res, 201, { ok: true, data: recordCostRefund(ctx.databaseFile, { projectId, monthKey: String(body.monthKey ?? ""), amount: Number(body.amount), originalRecordId: String(body.originalRecordId ?? ""), reason: body.reason ? String(body.reason) : undefined, idempotencyKey: String(body.idempotencyKey ?? "") }) }); return true; }
      if (parts[3] === "qualified-video" && method === "GET") { const projectId = url.searchParams.get("projectId") ?? ""; if (!(await allowed(access, projectId, res))) return true; sendJson(res, 200, { ok: true, data: qualifiedVideoCost(ctx.databaseFile, projectId, url.searchParams.get("finalVideoId") ?? "") }); return true; }
    }

    if (parts[2] === "templates") {
      if (parts.length === 3 && method === "POST") { const projectId = String(body.projectId ?? ""); if (!(await allowed(access, projectId, res))) return true; const created = createP2Template(ctx.databaseFile, { projectId, kind: String(body.kind ?? "prompt") as TemplateKind, name: String(body.name ?? ""), content: String(body.content ?? ""), tags: body.tags, createdBy: access.userId }); sendJson(res, 201, { ok: true, data: initializeTemplateVersion(ctx.databaseFile, created.id, body.variables, access.userId) }); return true; }
      const templateId = decodeURIComponent(parts[3] ?? ""); const template = getP2Template(ctx.databaseFile, templateId); if (!template) return fail(res, 404, "template_not_found"); if (!(await allowed(access, template.project_id, res))) return true;
      const action = parts[4];
      if (parts.length === 4 && method === "GET") { sendJson(res, 200, { ok: true, data: getTemplateLifecycle(ctx.databaseFile, templateId) }); return true; }
      if (parts.length === 4 && method === "PATCH") { sendJson(res, 200, { ok: true, data: updateTemplateLifecycle(ctx.databaseFile, templateId, body, Number(body.expectedVersion), access.userId) }); return true; }
      if (action === "validate" && method === "POST") { sendJson(res, 200, { ok: true, data: validateTemplateVariables(ctx.databaseFile, templateId, body.values) }); return true; }
      if (action === "preview" && method === "POST") { sendJson(res, 200, { ok: true, data: previewTemplate(ctx.databaseFile, templateId, body.values) }); return true; }
      if (action === "publish" && method === "POST") { sendJson(res, 200, { ok: true, data: publishTemplate(ctx.databaseFile, templateId, Number(body.expectedVersion), access.userId) }); return true; }
      if (action === "versions" && method === "GET") { sendJson(res, 200, { ok: true, data: { items: listTemplateVersions(ctx.databaseFile, templateId) } }); return true; }
      if (action === "rollback" && method === "POST") { sendJson(res, 200, { ok: true, data: rollbackTemplate(ctx.databaseFile, templateId, Number(body.targetVersion), Number(body.expectedVersion), access.userId) }); return true; }
    }

    if (parts[2] === "operations" && parts[3] === "performance" && method === "GET") { if (!access.isAdmin) return fail(res, 403, "仅管理员可查看性能指标"); sendJson(res, 200, { ok: true, data: getHttpPerformanceSummary(Number(url.searchParams.get("windowMinutes") ?? 15)) }); return true; }
    if (parts[2] === "route" && parts[3] === "rate-limits") {
      if (method === "GET") { sendJson(res, 200, { ok: true, data: { items: listProviderRateLimits() } }); return true; }
      if (method === "POST") { const provider = String(body.provider ?? ""); if (body.recovered === true) { recordProviderRecovered(provider); sendJson(res, 200, { ok: true, data: { provider, recovered: true } }); } else sendJson(res, 201, { ok: true, data: recordProviderRateLimit(provider, Number(body.retryAfterMs ?? 30_000)) }); return true; }
    }
  } catch (caught) { const message = caught instanceof Error ? caught.message : String(caught); return fail(res, message.includes("not_found") ? 404 : message.startsWith("version_conflict") ? 409 : 400, message); }
  return false;
}
