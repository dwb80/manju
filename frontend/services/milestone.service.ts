/** 里程碑相关的业务服务 */
import { api } from "./api-client";
import type { ProjectMilestone } from "@/lib/app-types";

/** 里程碑服务接口 */
export interface MilestoneService {
    /** 获取里程碑列表 */
    list(projectId: string): Promise<ProjectMilestone[]>;
    /** 创建里程碑 */
    create(projectId: string, draft: Partial<ProjectMilestone>): Promise<ProjectMilestone>;
    /** 更新里程碑 */
    update(projectId: string, milestoneId: string, patch: Partial<ProjectMilestone>): Promise<ProjectMilestone>;
    /** 删除里程碑 */
    delete(projectId: string, milestoneId: string): Promise<void>;
}

/** 获取里程碑列表 */
export async function listMilestones(projectId: string): Promise<ProjectMilestone[]> {
    return api<ProjectMilestone[]>(`/api/projects/${projectId}/milestones`);
}

/** 创建里程碑 */
export async function createMilestone(
    projectId: string,
    draft: Partial<ProjectMilestone>
): Promise<ProjectMilestone> {
    return api<ProjectMilestone>(`/api/projects/${projectId}/milestones`, {
        method: "POST",
        body: JSON.stringify(draft),
    });
}

/** 更新里程碑 */
export async function updateMilestone(
    projectId: string,
    milestoneId: string,
    patch: Partial<ProjectMilestone>
): Promise<ProjectMilestone> {
    return api<ProjectMilestone>(`/api/projects/${projectId}/milestones/${milestoneId}`, {
        method: "PUT",
        body: JSON.stringify(patch),
    });
}

/** 删除里程碑 */
export async function deleteMilestone(projectId: string, milestoneId: string): Promise<void> {
    await api(`/api/projects/${projectId}/milestones/${milestoneId}`, { method: "DELETE" });
}