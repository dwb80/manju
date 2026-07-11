/** 剧本相关的业务服务 */
import { api } from "./api-client";
import type { ProjectScript, ScriptFormDraft } from "@/lib/app-types";

/** 剧本服务接口 */
export interface ScriptService {
    /** 获取剧本列表 */
    list(projectId: string): Promise<ProjectScript[]>;
    /** 创建剧本 */
    create(projectId: string, draft: Partial<ProjectScript>): Promise<ProjectScript>;
    /** 更新剧本 */
    update(projectId: string, scriptId: string, patch: Partial<ProjectScript>): Promise<ProjectScript>;
    /** 删除剧本 */
    delete(projectId: string, scriptId: string): Promise<void>;
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

/** 删除剧本 */
export async function deleteScript(projectId: string, scriptId: string): Promise<void> {
    await api(`/api/projects/${projectId}/scripts/${scriptId}`, { method: "DELETE" });
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