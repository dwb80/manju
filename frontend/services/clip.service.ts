/** 剪辑相关的业务服务 */
import { api } from "./api-client";
import type { ProjectClip, ProjectClipStatus } from "@/lib/app-types";

/** 剧集服务接口 */
export interface ClipService {
    /** 获取剪辑列表 */
    list(projectId: string): Promise<ProjectClip[]>;
    /** 创建剪辑 */
    create(projectId: string, draft: Partial<ProjectClip>): Promise<ProjectClip>;
    /** 更新剪辑 */
    update(projectId: string, clipId: string, patch: Partial<ProjectClip>): Promise<ProjectClip>;
    /** 删除剪辑 */
    delete(projectId: string, clipId: string): Promise<void>;
    /** 同步剪辑（从已生成视频的分镜同步） */
    sync(projectId: string): Promise<ProjectClip[]>;
}

/** 获取剪辑列表 */
export async function listClips(projectId: string): Promise<ProjectClip[]> {
    return api<ProjectClip[]>(`/api/projects/${projectId}/clips`);
}

/** 创建剪辑 */
export async function createClip(
    projectId: string,
    draft: Partial<ProjectClip>
): Promise<ProjectClip> {
    return api<ProjectClip>(`/api/projects/${projectId}/clips`, {
        method: "POST",
        body: JSON.stringify(draft),
    });
}

/** 更新剪辑 */
export async function updateClip(
    projectId: string,
    clipId: string,
    patch: Partial<ProjectClip>
): Promise<ProjectClip> {
    return api<ProjectClip>(`/api/projects/${projectId}/clips/${clipId}`, {
        method: "PUT",
        body: JSON.stringify(patch),
    });
}

/** 删除剪辑 */
export async function deleteClip(projectId: string, clipId: string): Promise<void> {
    await api(`/api/projects/${projectId}/clips/${clipId}`, { method: "DELETE" });
}

/** 同步剪辑（从已生成视频的分镜同步） */
export async function syncClips(projectId: string): Promise<ProjectClip[]> {
    return api<ProjectClip[]>(`/api/projects/${projectId}/clips/sync`, { method: "POST" });
}