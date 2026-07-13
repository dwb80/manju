/** 剧本相关的业务服务 */
import { api } from "./api-client";
import type { ProjectScript, ScriptFormDraft } from "@/lib/app-types";

/** 剧本服务接口 */
export interface ScriptService {
    /** 获取剧本列表（默认过滤软删） */
    list(projectId: string): Promise<ProjectScript[]>;
    /** 创建剧本 */
    create(projectId: string, draft: Partial<ProjectScript>): Promise<ProjectScript>;
    /** 更新剧本 */
    update(projectId: string, scriptId: string, patch: Partial<ProjectScript>): Promise<ProjectScript>;
    /** 软删除剧本（保留 30 天） */
    delete(projectId: string, scriptId: string): Promise<{ deleted_at: string }>;
    /** 恢复软删除剧本 */
    restore(projectId: string, scriptId: string): Promise<ProjectScript>;
    /** 彻底删除剧本（需软删≥30天） */
    purge(projectId: string, scriptId: string): Promise<{ script_id: string; deleted_at: string; purged_at: string; grace_days: number; cascade: Record<string, number> }>;
    /** 获取回收站列表（已软删剧本） */
    listDeleted(projectId: string): Promise<ProjectScript[]>;
    /** 从剧本生成分镜 */
    breakdown(projectId: string, scriptId: string): Promise<void>;
}

/** 获取剧本列表 */
export async function listScripts(projectId: string): Promise<ProjectScript[]> {
    return api<ProjectScript[]>(`/api/projects/${projectId}/scripts`);
}

/** 创建剧本 */
export async function createScript(
    projectId: string,
    draft: Partial<ProjectScript>
): Promise<ProjectScript> {
    return api<ProjectScript>(`/api/projects/${projectId}/scripts`, {
        method: "POST",
        body: JSON.stringify(draft),
    });
}

/** 更新剧本 */
export async function updateScript(
    projectId: string,
    scriptId: string,
    patch: Partial<ProjectScript>
): Promise<ProjectScript> {
    return api<ProjectScript>(`/api/projects/${projectId}/scripts/${scriptId}`, {
        method: "PUT",
        body: JSON.stringify(patch),
    });
}

/** 删除剧本（软删除：写入 deleted_at，保留 30 天） */
export async function deleteScript(
    projectId: string,
    scriptId: string
): Promise<{ deleted_at: string }> {
    return api<{ deleted_at: string }>(`/api/projects/${projectId}/scripts/${scriptId}`, {
        method: "DELETE",
    });
}

/** 恢复软删除的剧本 */
export async function restoreScript(projectId: string, scriptId: string): Promise<ProjectScript> {
    return api<ProjectScript>(`/api/projects/${projectId}/scripts/${scriptId}/restore`, {
        method: "POST",
    });
}

/** 彻底删除剧本（需软删≥30天） */
export async function purgeScript(
    projectId: string,
    scriptId: string
): Promise<{ script_id: string; deleted_at: string; purged_at: string; grace_days: number; cascade: Record<string, number> }> {
    return api(`/api/projects/${projectId}/scripts/${scriptId}/purge`, {
        method: "DELETE",
    });
}

/** 获取回收站列表（已软删剧本） */
export async function listDeletedScripts(projectId: string): Promise<ProjectScript[]> {
    return api<ProjectScript[]>(`/api/projects/${projectId}/scripts/recycle-bin`);
}

/** 从剧本生成分镜 */
export async function breakdownScriptToStoryboards(
    projectId: string,
    scriptId: string
): Promise<void> {
    await api(`/api/projects/${projectId}/storyboards/breakdown`, {
        method: "POST",
        body: JSON.stringify({ script_id: scriptId }),
    });
}