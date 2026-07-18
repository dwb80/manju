/**
 * @file prop.service.ts
 * @description 道具工厂 API，提供道具的 CRUD、软删除、引用统计、批量操作等接口
 */

import { api } from "./api-client";
import type { Prop } from "@/lib/module-types";
import type { AssetUsage, CopyToProjectsResult } from "./character.service";

// ==================== CRUD ====================

/**
 * listProps - 获取道具列表
 * @param {string} projectId - 项目 ID（可选）
 * @returns {Promise<Prop[]> 道具列表
 */
export async function listProps(projectId?: string): Promise<Prop[]> {
  const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
  return api<Prop[]>(`/api/props${query}`);
}

export async function getProp(id: string): Promise<Prop | null> {
  try {
    return await api<Prop>(`/api/props/${encodeURIComponent(id)}`);
  } catch (err) {
    // 404 等视为不存在
    if (err instanceof Error && /404/.test(err.message)) return null;
    throw err;
  }
}

export async function createProp(data: {
  name: string;
  category?: string;
  description?: string;
  image?: string;
  appearance?: string;
  material?: string;
  size?: string;
  color?: string;
  tags?: string[];
  // === AI 剧本分析扩展字段 ===
  importance_level?: string;
  owner?: string;
  shape?: string;
  texture?: string;
  story_function?: string;
  visual_features?: string;
  camera_usage?: string;
  generation_prompt?: string;
  first_appearance?: string;
  confidence?: string;
}): Promise<Prop> {
  return api<Prop>("/api/props", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateProp(id: string, data: Partial<{
  name: string;
  category: string;
  description: string;
  image: string;
  appearance: string;
  material: string;
  size: string;
  color: string;
  tags: string[];
  // === AI 剧本分析扩展字段 ===
  importance_level: string;
  owner: string;
  shape: string;
  texture: string;
  story_function: string;
  visual_features: string;
  camera_usage: string;
  generation_prompt: string;
  first_appearance: string;
  confidence: string;
}>): Promise<Prop> {
  return api<Prop>(`/api/props/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteProp(id: string): Promise<void> {
  await api(`/api/props/${id}`, { method: "DELETE" });
}

export async function restoreProp(id: string): Promise<void> {
  await api(`/api/props/${id}/restore`, { method: "POST" });
}

// ==================== 回收站 ====================

export async function listDeletedProps(projectId?: string): Promise<Prop[]> {
  const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
  return api<Prop[]>(`/api/props/deleted${query}`);
}

export async function permanentDeleteProps(ids: string[]): Promise<void> {
  await api("/api/props/permanent", {
    method: "POST",
    body: JSON.stringify({ ids }),
  });
}

// ==================== 引用 / 批量 / 跨项目 ====================

export async function getPropUsage(id: string): Promise<AssetUsage> {
  return api<AssetUsage>(`/api/props/${id}/usage`);
}

export async function batchProps(
  action: "delete" | "update",
  ids: string[],
  patch?: Record<string, unknown>,
): Promise<{ deleted?: number; updated?: number }> {
  return api<{ deleted?: number; updated?: number }>("/api/props/batch", {
    method: "POST",
    body: JSON.stringify({ action, ids, patch }),
  });
}

export async function copyPropsToProjects(
  sourceId: string,
  targetProjectIds: string[],
): Promise<CopyToProjectsResult<Prop>> {
  return api<CopyToProjectsResult<Prop>>("/api/props/copy", {
    method: "POST",
    body: JSON.stringify({ sourceId, targetProjectIds }),
  });
}

// ==================== 模板 ====================

/** 道具模板列表（10 个常用预设）。 */
export async function listPropTemplates(): Promise<Prop[]> {
  return api<Prop[]>("/api/templates/props");
}
