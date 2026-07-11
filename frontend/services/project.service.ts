/** 项目相关的业务服务，封装项目 CRUD、导出、文件夹操作 */
import { api, apiUrl } from "./api-client";
import type {
    Project,
    ProjectSummary,
    ProjectFormDraft,
} from "@/lib/app-types";

/** 项目服务接口 */
export interface ProjectService {
    /** 获取项目列表 */
    list(): Promise<Project[]>;
    /** 获取项目详情 */
    get(id: string): Promise<Project>;
    /** 创建项目 */
    create(draft: ProjectFormDraft, storageMode: "managed" | "existing"): Promise<Project>;
    /** 更新项目 */
    update(id: string, patch: Partial<ProjectFormDraft>): Promise<Project>;
    /** 删除项目 */
    delete(id: string): Promise<void>;
    /** 置顶项目 */
    pin(id: string): Promise<Project>;
    /** 取消置顶项目 */
    unpin(id: string): Promise<Project>;
    /** 归档项目 */
    archive(id: string): Promise<void>;
    /** 打开项目文件夹 */
    openFolder(id: string): Promise<void>;
    /** 获取项目摘要 */
    summary(id: string): Promise<ProjectSummary>;
    /** 导出项目清单 */
    exportManifest(id: string): void;
    /** 导出分镜 CSV */
    exportStoryboardCsv(id: string): void;
    /** 导出剧本文本 */
    exportScriptsTxt(id: string): void;
    /** 导出剪辑清单 */
    exportEditList(id: string): void;
    /** 生成交付包索引 */
    generatePackageIndex(id: string): Promise<{ path: string; files: string[] }>;
}

/** 获取项目列表 */
export async function listProjects(): Promise<Project[]> {
    return api<Project[]>("/api/projects");
}

/** 获取项目详情 */
export async function getProject(id: string): Promise<Project> {
    return api<Project>(`/api/projects/${id}`);
}

/** 创建项目 */
export async function createProject(
    draft: ProjectFormDraft,
    storageMode: "managed" | "existing"
): Promise<Project> {
    const body = {
        name: draft.name,
        category: draft.category ?? "",
        status: draft.status ?? "策划中",
        description: draft.description ?? "",
        episode_count: Number(draft.episode_count ?? 0),
        owner: draft.owner ?? "",
        due_date: draft.due_date ?? "",
        storage_path: draft.storage_path ?? "",
    };
    if (storageMode === "managed") {
        return api<Project>("/api/projects", {
            method: "POST",
            body: JSON.stringify(body),
        });
    }
    return api<Project>("/api/projects/existing", {
        method: "POST",
        body: JSON.stringify(body),
    });
}

/** 更新项目 */
export async function updateProject(
    id: string,
    patch: Partial<ProjectFormDraft>
): Promise<Project> {
    return api<Project>(`/api/projects/${id}`, {
        method: "PUT",
        body: JSON.stringify({
            name: patch.name,
            category: patch.category ?? "",
            status: patch.status ?? "",
            description: patch.description ?? "",
            episode_count: Number(patch.episode_count ?? 0),
            owner: patch.owner ?? "",
            due_date: patch.due_date ?? "",
        }),
    });
}

/** 删除项目 */
export async function deleteProject(id: string): Promise<void> {
    await api(`/api/projects/${id}`, { method: "DELETE" });
}

/** 置顶/取消置顶项目 */
export async function toggleProjectPin(id: string): Promise<Project> {
    return api<Project>(`/api/projects/${id}/pin`, { method: "POST" });
}

/** 归档项目 */
export async function archiveProject(id: string): Promise<void> {
    await api(`/api/projects/${id}/archive`, { method: "POST" });
}

/** 打开项目文件夹 */
export async function openProjectFolder(id: string): Promise<void> {
    await api(`/api/projects/${id}/folder`, { method: "POST" });
}

/** 获取项目摘要 */
export async function getProjectSummary(id: string): Promise<ProjectSummary> {
    return api<ProjectSummary>(`/api/projects/${id}/summary`);
}

/** 导出项目清单 */
export function exportProjectManifest(id: string): void {
    window.open(apiUrl(`/api/projects/${id}/exports/manifest.json`), "_blank", "noopener,noreferrer");
}

/** 导出分镜 CSV */
export function exportStoryboardCsv(id: string): void {
    window.open(apiUrl(`/api/projects/${id}/exports/storyboards.csv`), "_blank", "noopener,noreferrer");
}

/** 导出剧本文本 */
export function exportScriptsTxt(id: string): void {
    window.open(apiUrl(`/api/projects/${id}/exports/scripts.txt`), "_blank", "noopener,noreferrer");
}

/** 导出剪辑清单 */
export function exportEditList(id: string): void {
    window.open(apiUrl(`/api/projects/${id}/exports/edit-list.csv`), "_blank", "noopener,noreferrer");
}

/** 生成交付包索引 */
export async function generatePackageIndex(id: string): Promise<{ path: string; files: string[] }> {
    return api<{ path: string; files: string[] }>(`/api/projects/${id}/exports/package`, { method: "POST" });
}