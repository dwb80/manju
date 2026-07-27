/**
 * @file pipeline.service.ts
 * @description V2 W5 REQ-PIPE-001-06 节点启停开关 API
 *
 * 端点：
 * - GET  /api/pipeline/stages                    → 8 阶段定义
 * - GET  /api/pipeline/:projectId/state          → 项目阶段状态
 * - GET  /api/pipeline/runs?projectId=xxx        → run 列表（按项目过滤）
 * - GET  /api/pipeline/runs/:runId/nodes         → 列出 run 全部节点
 * - POST /api/pipeline/runs                      → 创建 run
 * - POST /api/pipeline/runs/:runId/nodes/:nodeId/{pause|resume|skip}
 */

import { api } from "@/lib/api-client";
import type { PipelineDependency, PipelineNode, PipelineNodeAction } from "@/lib/app-types";

export interface PipelineStagesResponse {
  stages: Array<{
    name: string;
    label: string;
    color: string;
    dependsOn: string[];
  }>;
  transitions: Record<string, string[]>;
}

export interface PipelineStateResponse {
  projectId: string;
  stageStates: Record<string, string>;
  runnableStages: string[];
  overallProgress: number;
}

export interface PipelineNodesResponse {
  runId: string;
  nodes: PipelineNode[];
  dependencies: PipelineDependency[];
}

export interface PipelineNodeActionResponse {
  runId: string;
  nodeId: string;
  action: PipelineNodeAction;
  node: PipelineNode;
}

/** Pipeline Run 列表项（与后端 listRuns 返回结构对齐） */
export interface PipelineRunListItem {
  id: string;
  project_id?: string | null;
  name?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  nodeCount?: number;
  completedCount?: number;
  progress?: number;
}

export interface PipelineRunsResponse {
  projectId: string | null;
  runs: PipelineRunListItem[];
}

export function buildStagesUrl(): string {
  return "/api/pipeline/stages";
}

export function buildStateUrl(projectId: string): string {
  return `/api/pipeline/${encodeURIComponent(projectId)}/state`;
}

export function buildRunsUrl(projectId?: string): string {
  const base = "/api/pipeline/runs";
  if (!projectId) return base;
  return `${base}?projectId=${encodeURIComponent(projectId)}`;
}

export function buildNodesUrl(runId: string): string {
  return `/api/pipeline/runs/${encodeURIComponent(runId)}/nodes`;
}

export function buildNodeActionUrl(
  runId: string,
  nodeId: string,
  action: PipelineNodeAction,
): string {
  return `/api/pipeline/runs/${encodeURIComponent(runId)}/nodes/${encodeURIComponent(nodeId)}/${action}`;
}

export async function getPipelineStages(): Promise<PipelineStagesResponse> {
  return api<PipelineStagesResponse>(buildStagesUrl(), { method: "GET" });
}

export async function getPipelineState(
  projectId: string,
): Promise<PipelineStateResponse> {
  return api<PipelineStateResponse>(buildStateUrl(projectId), { method: "GET" });
}

export async function listPipelineRuns(
  projectId?: string,
): Promise<PipelineRunsResponse> {
  return api<PipelineRunsResponse>(buildRunsUrl(projectId), { method: "GET" });
}

export async function listRunNodes(runId: string): Promise<PipelineNodesResponse> {
  return api<PipelineNodesResponse>(buildNodesUrl(runId), { method: "GET" });
}

export async function actOnNode(
  runId: string,
  nodeId: string,
  action: PipelineNodeAction,
): Promise<PipelineNodeActionResponse> {
  return api<PipelineNodeActionResponse>(buildNodeActionUrl(runId, nodeId, action), {
    method: "POST",
    body: JSON.stringify({}),
  });
}
