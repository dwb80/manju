/**
 * 音频中心 API
 */

import { api } from "./api-client";
import type { AudioItem } from "@/lib/module-types";

export async function listAudios(projectId?: string): Promise<AudioItem[]> {
  const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
  return api<AudioItem[]>(`/api/audios${query}`);
}

export async function createAudio(data: {
  name: string;
  type?: string;
  duration?: number;
  file_url?: string;
  speaker?: string;
  tags?: string[];
  format?: string;
  size?: number;
}): Promise<AudioItem> {
  return api<AudioItem>("/api/audios", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateAudio(id: string, data: Partial<{
  name: string;
  type: string;
  duration: number;
  file_url: string;
  speaker: string;
  tags: string[];
  format: string;
  size: number;
}>): Promise<AudioItem> {
  return api<AudioItem>(`/api/audios/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteAudio(id: string): Promise<void> {
  await api(`/api/audios/${id}`, { method: "DELETE" });
}
