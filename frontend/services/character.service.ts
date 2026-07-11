/**
 * 角色工厂 API
 *
 * 设计原则：
 * - 仅暴露本模块的 CRUD / 软删除 / 引用 / 批量 / 跨项目复制 / 模板。
 * - 通用类型（AssetUsage / CopyToProjectsResult）从本文件导出，
 *   其他工厂可复用，无需重复定义。
 */

import { api } from "./api-client";
import type { Character } from "@/lib/module-types";

/** 角色被哪些内容引用。 */
export interface UsageReferenceItem {
  type: "script" | "storyboard" | "dialogue" | "scene_character" | "scene_location" | "script_center";
  id: string;
  title: string;
  project_id?: string;
  context?: string;
  /** 所属集数（已知时填入）。 */
  episode?: number;
}

export interface AssetUsage {
  id: string;
  total: number;
  storyboards: UsageReferenceItem[];
  scripts: UsageReferenceItem[];
  dialogues: UsageReferenceItem[];
  sceneCharacters: UsageReferenceItem[];
  sceneLocations: UsageReferenceItem[];
  usage_count: number;
}

/** 跨项目复制结果。 */
export interface CopyToProjectsResult<T> {
  copied: number;
  skipped: number;
  items: T[];
}

// ==================== CRUD ====================

export async function listCharacters(projectId?: string): Promise<Character[]> {
  const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
  return api<Character[]>(`/api/characters${query}`);
}

export async function createCharacter(data: {
  name: string;
  role?: string;
  gender?: string;
  age?: number;
  traits?: string[];
  description?: string;
  image?: string;
  tags?: string[];
}): Promise<Character> {
  return api<Character>("/api/characters", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateCharacter(id: string, data: Partial<{
  name: string;
  role: string;
  gender: string;
  age: number;
  traits: string[];
  description: string;
  image: string;
  tags: string[];
}>): Promise<Character> {
  return api<Character>(`/api/characters/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteCharacter(id: string): Promise<void> {
  await api(`/api/characters/${id}`, { method: "DELETE" });
}

export async function restoreCharacter(id: string): Promise<void> {
  await api(`/api/characters/${id}/restore`, { method: "POST" });
}

// ==================== 回收站 ====================

export async function listDeletedCharacters(projectId?: string): Promise<Character[]> {
  const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
  return api<Character[]>(`/api/characters/deleted${query}`);
}

export async function permanentDeleteCharacters(ids: string[]): Promise<void> {
  await api("/api/characters/permanent", {
    method: "POST",
    body: JSON.stringify({ ids }),
  });
}

// ==================== 引用 / 批量 / 跨项目 ====================

export async function getCharacterUsage(id: string): Promise<AssetUsage> {
  return api<AssetUsage>(`/api/characters/${id}/usage`);
}

export async function batchCharacters(
  action: "delete" | "update",
  ids: string[],
  patch?: Record<string, unknown>,
): Promise<{ deleted?: number; updated?: number }> {
  return api<{ deleted?: number; updated?: number }>("/api/characters/batch", {
    method: "POST",
    body: JSON.stringify({ action, ids, patch }),
  });
}

export async function copyCharactersToProjects(
  sourceId: string,
  targetProjectIds: string[],
): Promise<CopyToProjectsResult<Character>> {
  return api<CopyToProjectsResult<Character>>("/api/characters/copy", {
    method: "POST",
    body: JSON.stringify({ sourceId, targetProjectIds }),
  });
}

// ==================== 模板 ====================

/** 角色模板列表（10 个常用预设）。 */
export async function listCharacterTemplates(): Promise<Character[]> {
  return api<Character[]>("/api/templates/characters");
}
