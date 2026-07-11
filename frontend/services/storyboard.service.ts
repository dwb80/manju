/**
 * 分镜 API
 */

import { api } from "./api-client";
import type { Storyboard } from "@/lib/module-types";

export async function listStoryboards(projectId?: string): Promise<Storyboard[]> {
  const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
  return api<Storyboard[]>(`/api/storyboards${query}`);
}

export async function createStoryboard(data: {
  scene_id?: string;
  shot_number?: number;
  description?: string;
  duration?: number;
  camera_angle?: string;
  movement?: string;
  dialogue?: string;
  notes?: string;
  status?: string;
  order?: number;
}): Promise<Storyboard> {
  return api<Storyboard>("/api/storyboards", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateStoryboard(id: string, data: Partial<{
  scene_id: string;
  shot_number: number;
  description: string;
  duration: number;
  camera_angle: string;
  movement: string;
  dialogue: string;
  notes: string;
  status: string;
  order: number;
}>): Promise<Storyboard> {
  return api<Storyboard>(`/api/storyboards/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteStoryboard(id: string): Promise<void> {
  await api(`/api/storyboards/${id}`, { method: "DELETE" });
}
