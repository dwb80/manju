/**
 * 视频任务 API（"视频生产线"模块使用的后端实体）
 *
 * 注意：后端路由前缀为 /api/module-videos（与前端 service 命名稍有出入，但保持一致）。
 */

import { api } from "./api-client";
import type { VideoTask } from "@/lib/module-types";

export async function listModuleVideoTasks(projectId?: string): Promise<VideoTask[]> {
  const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
  return api<VideoTask[]>(`/api/module-videos${query}`);
}

export async function createModuleVideoTask(data: {
  title: string;
  status?: string;
  progress?: number;
  duration?: number;
  resolution?: string;
  fps?: number;
  format?: string;
  file_url?: string;
  episode?: number;
  storyboard_id?: string;
  image_url?: string;
  prompt?: string;
  tags?: string[];
  error?: string;
}): Promise<VideoTask> {
  return api<VideoTask>("/api/module-videos", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateModuleVideoTask(id: string, data: Partial<{
  title: string;
  status: string;
  progress: number;
  duration: number;
  resolution: string;
  fps: number;
  format: string;
  file_url: string;
  episode: number;
  storyboard_id: string;
  image_url: string;
  prompt: string;
  tags: string[];
  error: string;
}>): Promise<VideoTask> {
  return api<VideoTask>(`/api/module-videos/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteModuleVideoTask(id: string): Promise<void> {
  await api(`/api/module-videos/${id}`, { method: "DELETE" });
}

// ==================== 回收站 ====================

export async function listDeletedVideos(projectId?: string): Promise<VideoTask[]> {
  const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
  return api<VideoTask[]>(`/api/module-videos/deleted${query}`);
}

export async function restoreVideo(id: string): Promise<void> {
  await api(`/api/module-videos/${id}/restore`, { method: "POST" });
}

export async function permanentDeleteVideos(ids: string[]): Promise<void> {
  await api("/api/module-videos/permanent", {
    method: "POST",
    body: JSON.stringify({ ids }),
  });
}

// ==================== 跨项目复制 / 任务控制 ====================

/**
 * 跨项目复制（与角色/场景/道具同构：传入目标项目 ID 数组，逐个调用后端单目标接口）。
 */
export async function copyVideoToProjects(
  sourceId: string,
  targetProjectIds: string[],
): Promise<{ copied: number; skipped: number }> {
  let copied = 0;
  let skipped = 0;
  for (const targetProjectId of targetProjectIds) {
    try {
      await api(`/api/module-videos/${sourceId}/copy`, {
        method: "POST",
        body: JSON.stringify({ targetProjectId }),
      });
      copied += 1;
    } catch (err) {
      console.warn("copy video failed", sourceId, targetProjectId, err);
      skipped += 1;
    }
  }
  return { copied, skipped };
}

export async function retryVideoTask(id: string): Promise<unknown> {
  return api(`/api/module-videos/${id}/retry`, { method: "POST" });
}

export async function regenerateVideo(id: string, body: Record<string, unknown> = {}): Promise<unknown> {
  return api(`/api/module-videos/${id}/regenerate`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function syncVideoTaskStatus(id: string, body: Record<string, unknown> = {}): Promise<unknown> {
  return api(`/api/module-videos/${id}/sync-status`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
