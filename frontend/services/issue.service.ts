/** 问题/风险相关的业务服务 */
import { api } from "./api-client";
import type { ProjectIssue } from "@/lib/app-types";

/** 问题服务接口 */
export interface IssueService {
    /** 获取问题列表 */
    list(projectId: string): Promise<ProjectIssue[]>;
    /** 创建问题 */
    create(projectId: string, draft: Partial<ProjectIssue>): Promise<ProjectIssue>;
    /** 更新问题 */
    update(projectId: string, issueId: string, patch: Partial<ProjectIssue>): Promise<ProjectIssue>;
    /** 删除问题 */
    delete(projectId: string, issueId: string): Promise<void>;
}

/** 获取问题列表 */
export async function listIssues(projectId: string): Promise<ProjectIssue[]> {
    return api<ProjectIssue[]>(`/api/projects/${projectId}/issues`);
}

/** 创建问题 */
export async function createIssue(
    projectId: string,
    draft: Partial<ProjectIssue>
): Promise<ProjectIssue> {
    return api<ProjectIssue>(`/api/projects/${projectId}/issues`, {
        method: "POST",
        body: JSON.stringify(draft),
    });
}

/** 更新问题 */
export async function updateIssue(
    projectId: string,
    issueId: string,
    patch: Partial<ProjectIssue>
): Promise<ProjectIssue> {
    return api<ProjectIssue>(`/api/projects/${projectId}/issues/${issueId}`, {
        method: "PUT",
        body: JSON.stringify(patch),
    });
}

/** 删除问题 */
export async function deleteIssue(projectId: string, issueId: string): Promise<void> {
    await api(`/api/projects/${projectId}/issues/${issueId}`, { method: "DELETE" });
}