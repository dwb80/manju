/**
 * @file metrics-router.ts
 * @description V2 W11 DATA-F01~F12 指标 HTTP API
 *
 * 端点:
 *  - GET    /api/metrics                      指标字典列表
 *  - GET    /api/metrics/:key                 单个指标定义
 *  - GET    /api/metrics/:key/value           实际查询(渲染 SQL + 走 DB)
 *      query: projectId / userId / month / day / startDate / endDate / limit / extraFilter
 *  - GET    /api/metrics/feature/:featureId   按业务 ID 取定义
 *  - GET    /api/metrics/project/:projectId/acceptance  项目验收报告
 *  - GET    /api/metrics/health               服务健康
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { getMetricsService, type MetricsService } from "../services/horizontal/metrics-service.js";
import type { QueryParams } from "../types/metrics-dictionary.js";

interface AccessCtx {
  userId: string;
  isAdmin: boolean;
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(payload));
}

function sendError(res: ServerResponse, status: number, message: string): void {
  sendJson(res, status, { code: status, message, data: null });
}

export async function handleMetricsRouter(
  _ctx: unknown,
  req: IncomingMessage,
  res: ServerResponse,
  _access: AccessCtx,
): Promise<void> {
  const url = req.url ?? "/";
  const qIdx = url.indexOf("?");
  const path = (qIdx >= 0 ? url.slice(0, qIdx) : url).split("/").filter(Boolean);
  const method = (req.method ?? "GET").toUpperCase();
  if (path[0] !== "api" || path[1] !== "metrics") {
    sendError(res, 404, "not_found");
    return;
  }
  const svc: MetricsService = getMetricsService();
  const qs = qIdx >= 0 ? url.slice(qIdx + 1) : "";
  const params = new URLSearchParams(qs);

  // 健康
  if (path.length === 3 && path[2] === "health" && method === "GET") {
    return sendJson(res, 200, svc.healthCheck());
  }

  // 指标字典列表
  if (path.length === 2 && method === "GET") {
    const filter: { featureId?: string; priority?: "P0" | "P1" | "P2"; enabled?: boolean } = {};
    if (params.get("featureId")) filter.featureId = String(params.get("featureId"));
    const p = params.get("priority");
    if (p === "P0" || p === "P1" || p === "P2") filter.priority = p;
    const en = params.get("enabled");
    if (en === "true" || en === "1") filter.enabled = true;
    else if (en === "false" || en === "0") filter.enabled = false;
    const list = svc.listMetrics(filter);
    return sendJson(res, 200, { metrics: list, total: list.length });
  }

  // 按 featureId 取定义
  if (path.length === 4 && path[2] === "feature" && method === "GET") {
    const featureId = decodeURIComponent(path[3]);
    const m = svc.getMetricsByFeature(featureId);
    if (!m) return sendError(res, 404, `metric_not_found_for_feature: ${featureId}`);
    return sendJson(res, 200, { metric: m });
  }

  // 项目验收报告
  if (path.length === 5 && path[3] === "acceptance" && method === "GET") {
    const projectId = decodeURIComponent(path[2]);
    const r = svc.queryAcceptanceReport(projectId);
    if (!r) return sendError(res, 404, `project_not_found_or_no_data: ${projectId}`);
    return sendJson(res, 200, { projectId, report: r });
  }

  // 单个指标定义
  if (path.length === 4 && path[3] !== "value" && method === "GET") {
    const key = decodeURIComponent(path[2]) + "/" + decodeURIComponent(path[3]);
    const m = svc.getMetric(key);
    if (!m) return sendError(res, 404, `metric_not_found: ${key}`);
    return sendJson(res, 200, { metric: m });
  }
  if (path.length === 3 && method === "GET") {
    // 已处理列表
  }

  // 单个指标查询 (path: /api/metrics/:key/value)
  if (path.length === 4 && path[3] === "value" && method === "GET") {
    const key = decodeURIComponent(path[2]);
    const qp: QueryParams = {};
    if (params.get("projectId")) qp.projectId = String(params.get("projectId"));
    if (params.get("userId")) qp.userId = String(params.get("userId"));
    if (params.get("month")) qp.month = String(params.get("month"));
    if (params.get("day")) qp.day = String(params.get("day"));
    if (params.get("startDate")) qp.startDate = String(params.get("startDate"));
    if (params.get("endDate")) qp.endDate = String(params.get("endDate"));
    if (params.get("limit")) qp.limit = parseInt(String(params.get("limit")), 10);
    if (params.get("extraFilter")) qp.extraFilter = String(params.get("extraFilter"));
    const result = svc.queryMetric(key, qp);
    if (!result.metric.enabled) {
      return sendError(res, 404, `metric_not_found_or_disabled: ${key}`);
    }
    return sendJson(res, 200, { result });
  }

  sendError(res, 404, "not_found");
}
