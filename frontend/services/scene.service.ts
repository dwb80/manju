/**
 * 场景工厂 API
 *
 * 与 character.service.ts 同构，模式与契约完全一致。
 * AssetUsage / CopyToProjectsResult 类型在 character.service 中已定义，
 * 这里只重新导出，避免重复声明。
 */

import { api } from "./api-client";
import type { Scene } from "@/lib/module-types";
import type { AssetUsage, CopyToProjectsResult } from "./character.service";

export type { AssetUsage, CopyToProjectsResult };

// ==================== CRUD ====================

export async function listScenes(projectId?: string): Promise<Scene[]> {
  const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
  return api<Scene[]>(`/api/scenes${query}`);
}

export async function createScene(data: {
  name: string;
  type?: string;
  description?: string;
  image?: string;
  tags?: string[];
  lighting?: string;
  time_of_day?: string;
  weather?: string;
}): Promise<Scene> {
  return api<Scene>("/api/scenes", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateScene(id: string, data: Partial<{
  name: string;
  type: string;
  description: string;
  image: string;
  tags: string[];
  lighting: string;
  time_of_day: string;
  weather: string;
}>): Promise<Scene> {
  return api<Scene>(`/api/scenes/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteScene(id: string): Promise<void> {
  await api(`/api/scenes/${id}`, { method: "DELETE" });
}

export async function restoreScene(id: string): Promise<void> {
  await api(`/api/scenes/${id}/restore`, { method: "POST" });
}

// ==================== 回收站 ====================

export async function listDeletedScenes(projectId?: string): Promise<Scene[]> {
  const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
  return api<Scene[]>(`/api/scenes/deleted${query}`);
}

export async function permanentDeleteScenes(ids: string[]): Promise<void> {
  await api("/api/scenes/permanent", {
    method: "POST",
    body: JSON.stringify({ ids }),
  });
}

// ==================== 引用 / 批量 / 跨项目 ====================

export async function getSceneUsage(id: string): Promise<AssetUsage> {
  return api<AssetUsage>(`/api/scenes/${id}/usage`);
}

export async function batchScenes(
  action: "delete" | "update",
  ids: string[],
  patch?: Record<string, unknown>,
): Promise<{ deleted?: number; updated?: number }> {
  return api<{ deleted?: number; updated?: number }>("/api/scenes/batch", {
    method: "POST",
    body: JSON.stringify({ action, ids, patch }),
  });
}

export async function copyScenesToProjects(
  sourceId: string,
  targetProjectIds: string[],
): Promise<CopyToProjectsResult<Scene>> {
  return api<CopyToProjectsResult<Scene>>("/api/scenes/copy", {
    method: "POST",
    body: JSON.stringify({ sourceId, targetProjectIds }),
  });
}

// ==================== 模板 ====================

/** 场景模板列表（8 个常用预设）。 */
export async function listSceneTemplates(): Promise<Scene[]> {
  return api<Scene[]>("/api/templates/scenes");
}
