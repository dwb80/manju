/** 剪辑相关的业务服务（与分镜/视频/音频同构：顶层 REST + 软删除 + 回收站 + 跨项目） */
import { api } from "./api-client";
import type { ProjectClip } from "@/lib/app-types";

/** 获取剪辑列表（排除已软删除）。 */
export async function listClips(projectId: string): Promise<ProjectClip[]> {
  return api<ProjectClip[]>(`/api/clips?projectId=${encodeURIComponent(projectId)}`);
}

/** 创建剪辑。 */
export async function createClip(projectId: string, draft: Partial<ProjectClip>): Promise<ProjectClip> {
  return api<ProjectClip>("/api/clips", {
    method: "POST",
    body: JSON.stringify({ ...draft, project_id: projectId }),
  });
}

/** 更新剪辑。 */
export async function updateClip(
  projectId: string,
  clipId: string,
  patch: Partial<ProjectClip>,
): Promise<ProjectClip> {
  return api<ProjectClip>(`/api/clips/${clipId}`, {
    method: "PUT",
    body: JSON.stringify(patch),
  });
}

/** 软删除剪辑（5 秒内可撤销 / 进入回收站）。 */
export async function deleteClip(projectId: string, clipId: string): Promise<void> {
  await api(`/api/clips/${clipId}`, { method: "DELETE" });
}

/** 同步剪辑（从已生成视频的分镜同步）。 */
export async function syncClips(projectId: string): Promise<ProjectClip[]> {
  return api<ProjectClip[]>(`/api/clips/sync`, {
    method: "POST",
    body: JSON.stringify({ project_id: projectId }),
  });
}

// ==================== 回收站 ====================

/** 获取回收站列表（已软删除的剪辑）。 */
export async function listDeletedClips(projectId: string): Promise<ProjectClip[]> {
  return api<ProjectClip[]>(`/api/clips/deleted?projectId=${encodeURIComponent(projectId)}`);
}

/** 恢复单个剪辑。 */
export async function restoreClip(clipId: string): Promise<void> {
  await api(`/api/clips/${clipId}/restore`, { method: "POST" });
}

/** 永久删除（不可恢复）。 */
export async function permanentDeleteClips(ids: string[]): Promise<void> {
  await api("/api/clips/permanent", {
    method: "POST",
    body: JSON.stringify({ ids }),
  });
}

// ==================== 跨项目复制 ====================

/**
 * 跨项目复制（与角色/场景/道具同构：传入目标项目 ID 数组，逐个调用后端单目标接口）。
 */
export async function copyClipToProjects(
  sourceId: string,
  targetProjectIds: string[],
): Promise<{ copied: number; skipped: number }> {
  let copied = 0;
  let skipped = 0;
  for (const targetProjectId of targetProjectIds) {
    try {
      await api(`/api/clips/${sourceId}/copy`, {
        method: "POST",
        body: JSON.stringify({ targetProjectId }),
      });
      copied += 1;
    } catch (err) {
      console.warn("copy clip failed", sourceId, targetProjectId, err);
      skipped += 1;
    }
  }
  return { copied, skipped };
}
