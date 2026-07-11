/** 分镜相关的业务服务 */
import { api } from "./api-client";
import type { ProjectStoryboard, ProjectStoryboardStatus, StoryboardDraft } from "@/lib/app-types";

/** 分镜服务接口 */
export interface StoryboardService {
    /** 获取分镜列表 */
    list(projectId: string): Promise<ProjectStoryboard[]>;
    /** 创建分镜 */
    create(projectId: string, draft: Partial<ProjectStoryboard>): Promise<ProjectStoryboard>;
    /** 更新分镜 */
    update(projectId: string, storyboardId: string, patch: Partial<ProjectStoryboard>): Promise<ProjectStoryboard>;
    /** 删除分镜 */
    delete(projectId: string, storyboardId: string): Promise<void>;
    /** 批量更新分镜状态 */
    batchUpdateStatus(projectId: string, ids: string[], status: ProjectStoryboardStatus): Promise<ProjectStoryboard[]>;
    /** 从剧本文本生成分镜 */
    breakdown(projectId: string, script: string, episode: number): Promise<ProjectStoryboard[]>;
}

/** 获取分镜列表 */
export async function listStoryboards(projectId: string): Promise<ProjectStoryboard[]> {
    return api<ProjectStoryboard[]>(`/api/projects/${projectId}/storyboards`);
}

/** 创建分镜 */
export async function createStoryboard(
    projectId: string,
    draft: Partial<ProjectStoryboard>
): Promise<ProjectStoryboard> {
    return api<ProjectStoryboard>(`/api/projects/${projectId}/storyboards`, {
        method: "POST",
        body: JSON.stringify(draft),
    });
}

/** 更新分镜 */
export async function updateStoryboard(
    projectId: string,
    storyboardId: string,
    patch: Partial<ProjectStoryboard>
): Promise<ProjectStoryboard> {
    return api<ProjectStoryboard>(`/api/projects/${projectId}/storyboards/${storyboardId}`, {
        method: "PUT",
        body: JSON.stringify(patch),
    });
}

/** 删除分镜 */
export async function deleteStoryboard(projectId: string, storyboardId: string): Promise<void> {
    await api(`/api/projects/${projectId}/storyboards/${storyboardId}`, { method: "DELETE" });
}

/** 批量更新分镜状态 */
export async function batchUpdateStoryboardsStatus(
    projectId: string,
    ids: string[],
    status: ProjectStoryboardStatus
): Promise<ProjectStoryboard[]> {
    return api<ProjectStoryboard[]>(`/api/projects/${projectId}/storyboards/batch`, {
        method: "POST",
        body: JSON.stringify({ ids, status }),
    });
}

/** 从剧本文本生成分镜 */
export async function breakdownScriptTextToStoryboards(
    projectId: string,
    script: string,
    episode: number
): Promise<ProjectStoryboard[]> {
    return api<ProjectStoryboard[]>(`/api/projects/${projectId}/storyboards/breakdown`, {
        method: "POST",
        body: JSON.stringify({ script, episode }),
    });
}