/** 成员相关的业务服务 */
import { api } from "./api-client";
import type { ProjectMember } from "@/lib/app-types";

/** 成员服务接口 */
export interface MemberService {
    /** 获取成员列表 */
    list(projectId: string): Promise<ProjectMember[]>;
    /** 创建成员 */
    create(projectId: string, draft: Partial<ProjectMember>): Promise<ProjectMember>;
    /** 更新成员 */
    update(projectId: string, memberId: string, patch: Partial<ProjectMember>): Promise<ProjectMember>;
    /** 删除成员 */
    delete(projectId: string, memberId: string): Promise<void>;
}

/** 获取成员列表 */
export async function listMembers(projectId: string): Promise<ProjectMember[]> {
    return api<ProjectMember[]>(`/api/projects/${projectId}/members`);
}

/** 创建成员 */
export async function createMember(
    projectId: string,
    draft: Partial<ProjectMember>
): Promise<ProjectMember> {
    return api<ProjectMember>(`/api/projects/${projectId}/members`, {
        method: "POST",
        body: JSON.stringify(draft),
    });
}

/** 更新成员 */
export async function updateMember(
    projectId: string,
    memberId: string,
    patch: Partial<ProjectMember>
): Promise<ProjectMember> {
    return api<ProjectMember>(`/api/projects/${projectId}/members/${memberId}`, {
        method: "PUT",
        body: JSON.stringify(patch),
    });
}

/** 删除成员 */
export async function deleteMember(projectId: string, memberId: string): Promise<void> {
    await api(`/api/projects/${projectId}/members/${memberId}`, { method: "DELETE" });
}