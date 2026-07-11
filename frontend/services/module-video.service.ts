/**
 * 视频任务 API（"视频生产线"模块使用的后端实体）
 */

import { api } from "./api-client";
import type { VideoTask } from "@/lib/module-types";

export async function listModuleVideoTasks(projectId?: string): Promise<VideoTask[]> {
  const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
  return api<VideoTask[]>(`/api/module-video-tasks${query}`);
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
}): Promise<VideoTask> {
  return api<VideoTask>("/api/module-video-tasks", {
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
}>): Promise<VideoTask> {
  return api<VideoTask>(`/api/module-video-tasks/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteModuleVideoTask(id: string): Promise<void> {
  await api(`/api/module-video-tasks/${id}`, { method: "DELETE" });
}
