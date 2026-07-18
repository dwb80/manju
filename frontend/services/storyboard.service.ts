/**
 * 分镜 API
 */

import { api } from "./api-client";
import type { Storyboard } from "@/lib/module-types";

export async function listStoryboards(projectId?: string): Promise<Storyboard[]> {
  const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
  return api<Storyboard[]>(`/api/storyboards${query}`);
}

export interface CreateStoryboardInput {
  scene_id?: string;
  shot_number?: number;
  episode?: number;
  title?: string;
  description?: string;
  duration?: number;
  camera_angle?: string;
  movement?: string;
  dialogue?: string;
  notes?: string;
  status?: string;
  order?: number;
  image_url?: string;
  video_url?: string;
  tags?: string[];
  /** 关联角色资产 ID 列表。 */
  character_asset_ids?: string[];
  /** 关联道具资产 ID 列表。 */
  prop_asset_ids?: string[];
  /** 项目 ID（批量剧本分析 / 跨模块调用时由调用方显式传入）。 */
  project_id?: string;
}

export async function createStoryboard(data: CreateStoryboardInput): Promise<Storyboard> {
  return api<Storyboard>("/api/storyboards", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateStoryboard(id: string, data: Partial<CreateStoryboardInput>): Promise<Storyboard> {
  return api<Storyboard>(`/api/storyboards/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteStoryboard(id: string): Promise<void> {
  await api(`/api/storyboards/${id}`, { method: "DELETE" });
}

// ==================== 回收站 ====================

export async function listDeletedStoryboards(projectId?: string): Promise<Storyboard[]> {
  const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
  return api<Storyboard[]>(`/api/storyboards/deleted${query}`);
}

export async function restoreStoryboard(id: string): Promise<void> {
  await api(`/api/storyboards/${id}/restore`, { method: "POST" });
}

export async function permanentDeleteStoryboards(ids: string[]): Promise<void> {
  await api("/api/storyboards/permanent", {
    method: "POST",
    body: JSON.stringify({ ids }),
  });
}

// ==================== 跨项目复制 / 一键生成视频 ====================

/**
 * 跨项目复制（与角色/场景/道具同构：传入目标项目 ID 数组，逐个调用后端单目标接口）。
 */
export async function copyStoryboardToProjects(
  sourceId: string,
  targetProjectIds: string[],
): Promise<{ copied: number; skipped: number }> {
  let copied = 0;
  let skipped = 0;
  for (const targetProjectId of targetProjectIds) {
    try {
      await api(`/api/storyboards/${sourceId}/copy`, {
        method: "POST",
        body: JSON.stringify({ targetProjectId }),
      });
      copied += 1;
    } catch (err) {
      console.warn("copy storyboard failed", sourceId, targetProjectId, err);
      skipped += 1;
    }
  }
  return { copied, skipped };
}

export async function generateVideoFromStoryboard(
  storyboardId: string,
  body: Record<string, unknown> = {},
): Promise<unknown> {
  return api(`/api/storyboards/${storyboardId}/generate-video`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** 在三厂「插入到分镜」中复用：从资产快速创建一个新的分镜。 */
export async function createStoryboardFromAsset(asset: {
  name?: string;
  title?: string;
  description?: string;
  image?: string;
  image_url?: string;
  tags?: string[];
  type: "character" | "scene" | "prop";
  project_id?: string;
  /** 资产 ID（用于注入到 character_asset_ids / prop_asset_ids / scene_asset_id）。 */
  asset_id?: string;
}): Promise<Storyboard> {
  const sourceName = asset.title ?? asset.name ?? "未命名资产";
  const title = `${sourceName} · 分镜`;
  const typeLabel = asset.type === "character" ? "角色" : asset.type === "scene" ? "场景" : "道具";

  // 根据资产类型注入反向引用：让"角色/道具被分镜引用"的结构化关联自动建立。
  const character_asset_ids = asset.type === "character" && asset.asset_id ? [asset.asset_id] : [];
  const prop_asset_ids = asset.type === "prop" && asset.asset_id ? [asset.asset_id] : [];
  const scene_id = asset.type === "scene" && asset.asset_id ? asset.asset_id : "";

  return createStoryboard({
    title,
    description: asset.description ?? "",
    notes: `从${typeLabel}资产创建`,
    image_url: asset.image_url ?? asset.image ?? "",
    tags: asset.tags ?? [],
    status: "draft",
    character_asset_ids,
    prop_asset_ids,
    scene_id,
    project_id: asset.project_id,
  });
}
