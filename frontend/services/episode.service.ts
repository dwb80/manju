/** 剧集相关的业务服务 */
import { api } from "./api-client";
import type { ProjectEpisode } from "@/lib/app-types";

/** 剧集服务接口 */
export interface EpisodeService {
    /** 获取剧集列表 */
    list(projectId: string): Promise<ProjectEpisode[]>;
    /** 创建剧集 */
    create(projectId: string, draft: Partial<ProjectEpisode>): Promise<ProjectEpisode>;
    /** 更新剧集 */
    update(projectId: string, episodeId: string, patch: Partial<ProjectEpisode>): Promise<ProjectEpisode>;
    /** 删除剧集 */
    delete(projectId: string, episodeId: string): Promise<void>;
}

/** 获取剧集列表 */
export async function listEpisodes(projectId: string): Promise<ProjectEpisode[]> {
    return api<ProjectEpisode[]>(`/api/projects/${projectId}/episodes`);
}

/** 创建剧集 */
export async function createEpisode(
    projectId: string,
    draft: Partial<ProjectEpisode>
): Promise<ProjectEpisode> {
    return api<ProjectEpisode>(`/api/projects/${projectId}/episodes`, {
        method: "POST",
        body: JSON.stringify(draft),
    });
}

/** 更新剧集 */
export async function updateEpisode(
    projectId: string,
    episodeId: string,
    patch: Partial<ProjectEpisode>
): Promise<ProjectEpisode> {
    return api<ProjectEpisode>(`/api/projects/${projectId}/episodes/${episodeId}`, {
        method: "PUT",
        body: JSON.stringify(patch),
    });
}

/** 删除剧集 */
export async function deleteEpisode(projectId: string, episodeId: string): Promise<void> {
    await api(`/api/projects/${projectId}/episodes/${episodeId}`, { method: "DELETE" });
}