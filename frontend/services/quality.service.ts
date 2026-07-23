/**
 * @file quality.service.ts
 * @description V2 W6 REQ-PIPE-004-05 质检报告与自动配置 API
 *
 * 端点：
 * - GET    /api/quality/auto-config?projectId=xxx       → 读取项目自动质检配置
 * - PUT    /api/quality/auto-config                     → upsert 项目自动质检配置
 * - DELETE /api/quality/auto-config?projectId=xxx       → 删除配置
 * - GET    /api/quality/reports?projectId=&runId=&nodeId=&targetType=&targetId=&limit=&offset=
 * - GET    /api/quality/reports/:reportId               → 读取单条报告
 * - POST   /api/quality/detect                          → 手动触发质检
 * - GET    /api/quality/summary?projectId=xxx           → 报告汇总
 */

import { api } from "@/lib/api-client";

export type QualityTargetType = "image" | "video" | "audio" | "composition";
export type QualityOnFailure = "log" | "review" | "block";

export interface QualityAutoConfig {
  id: string;
  project_id: string;
  enabled: boolean;
  target_types: QualityTargetType[];
  threshold: number;
  on_failure: QualityOnFailure;
  created_at: string;
  updated_at: string;
}

export interface QualityReport {
  id: string;
  project_id: string;
  run_id: string;
  node_id: string;
  check_type: string;
  score: number;
  threshold: number;
  passed: boolean | number;
  details: {
    targetId: string;
    targetType: string;
    overallScore: number;
    technicalScore: number;
    aestheticScore: number;
    consistencyScore: number;
    status: "passed" | "warning" | "failed";
    items: Array<{
      rule: string;
      status: string;
      score: number;
      message: string;
    }>;
    metadata: Record<string, unknown>;
  };
  created_at: string;
}

export interface QualitySummary {
  total: number;
  passed: number;
  failed: number;
  warning: number;
  avgScore: number;
  byTargetType: Record<string, number>;
}

export function buildAutoConfigUrl(projectId: string): string {
  return `/api/quality/auto-config?projectId=${encodeURIComponent(projectId)}`;
}

export function buildReportsListUrl(params: {
  projectId: string;
  runId?: string;
  nodeId?: string;
  targetType?: string;
  targetId?: string;
  limit?: number;
  offset?: number;
}): string {
  const sp = new URLSearchParams({ projectId: params.projectId });
  if (params.runId) sp.set("runId", params.runId);
  if (params.nodeId) sp.set("nodeId", params.nodeId);
  if (params.targetType) sp.set("targetType", params.targetType);
  if (params.targetId) sp.set("targetId", params.targetId);
  if (params.limit != null) sp.set("limit", String(params.limit));
  if (params.offset != null) sp.set("offset", String(params.offset));
  return `/api/quality/reports?${sp.toString()}`;
}

export function buildReportDetailUrl(reportId: string): string {
  return `/api/quality/reports/${encodeURIComponent(reportId)}`;
}

export function buildSummaryUrl(projectId: string): string {
  return `/api/quality/summary?projectId=${encodeURIComponent(projectId)}`;
}

export function buildDetectUrl(): string {
  return `/api/quality/detect`;
}

export async function fetchAutoConfig(projectId: string): Promise<{ projectId: string; config: QualityAutoConfig }> {
  return api(buildAutoConfigUrl(projectId), { cache: "no-store" });
}

export async function saveAutoConfig(
  payload: Pick<QualityAutoConfig, "project_id" | "enabled" | "target_types" | "threshold" | "on_failure">,
): Promise<{ projectId: string; config: QualityAutoConfig }> {
  return api("/api/quality/auto-config", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function deleteAutoConfig(projectId: string): Promise<{ projectId: string; removed: number }> {
  return api(buildAutoConfigUrl(projectId), { method: "DELETE" });
}

export async function listReports(
  params: Parameters<typeof buildReportsListUrl>[0],
): Promise<{ total: number; offset: number; limit: number; reports: QualityReport[] }> {
  return api(buildReportsListUrl(params), { cache: "no-store" });
}

export async function fetchReport(reportId: string): Promise<QualityReport> {
  return api(buildReportDetailUrl(reportId), { cache: "no-store" });
}

export async function fetchSummary(projectId: string): Promise<{ projectId: string; summary: QualitySummary }> {
  return api(buildSummaryUrl(projectId), { cache: "no-store" });
}

export async function triggerDetect(input: {
  projectId: string;
  targetId: string;
  targetType: QualityTargetType;
  runId?: string;
  nodeId?: string;
}): Promise<{ report: { reportId: string; overallScore: number; status: string } }> {
  return api(buildDetectUrl(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
}
