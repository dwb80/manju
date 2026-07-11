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
  episode?: number;
  description?: string;
  character_id?: string;
  storyboard_id?: string;
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
  episode: number;
  description: string;
  character_id: string;
  storyboard_id: string;
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

// ==================== 回收站 ====================

export async function listDeletedAudios(projectId?: string): Promise<AudioItem[]> {
  const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
  return api<AudioItem[]>(`/api/audios/deleted${query}`);
}

export async function restoreAudio(id: string): Promise<void> {
  await api(`/api/audios/${id}/restore`, { method: "POST" });
}

export async function permanentDeleteAudios(ids: string[]): Promise<void> {
  await api("/api/audios/permanent", {
    method: "POST",
    body: JSON.stringify({ ids }),
  });
}

// ==================== 跨项目复制 / TTS 生成 ====================

/**
 * 跨项目复制（与角色/场景/道具同构：传入目标项目 ID 数组，逐个调用后端单目标接口）。
 */
export async function copyAudioToProjects(
  sourceId: string,
  targetProjectIds: string[],
): Promise<{ copied: number; skipped: number }> {
  let copied = 0;
  let skipped = 0;
  for (const targetProjectId of targetProjectIds) {
    try {
      await api(`/api/audios/${sourceId}/copy`, {
        method: "POST",
        body: JSON.stringify({ targetProjectId }),
      });
      copied += 1;
    } catch (err) {
      console.warn("copy audio failed", sourceId, targetProjectId, err);
      skipped += 1;
    }
  }
  return { copied, skipped };
}

export async function generateTTS(
  audioId: string,
  body: { text: string; speaker?: string; voice_id?: string; speed?: number } & Record<string, unknown>,
): Promise<unknown> {
  return api(`/api/audios/${audioId}/tts`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
