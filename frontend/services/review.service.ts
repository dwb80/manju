/** 审核相关的业务服务 */
import { api } from "./api-client";
import type { ProjectReview } from "@/lib/app-types";

/** 审核服务接口 */
export interface ReviewService {
    /** 获取审核列表 */
    list(projectId: string): Promise<ProjectReview[]>;
    /** 创建审核意见 */
    create(projectId: string, draft: Partial<ProjectReview>): Promise<ProjectReview>;
    /** 更新审核意见 */
    update(projectId: string, reviewId: string, patch: Partial<ProjectReview>): Promise<ProjectReview>;
    /** 删除审核意见 */
    delete(projectId: string, reviewId: string): Promise<void>;
}

/** 获取审核列表 */
export async function listReviews(projectId: string): Promise<ProjectReview[]> {
    return api<ProjectReview[]>(`/api/projects/${projectId}/reviews`);
}

/** 创建审核意见 */
export async function createReview(
    projectId: string,
    draft: Partial<ProjectReview>
): Promise<ProjectReview> {
    return api<ProjectReview>(`/api/projects/${projectId}/reviews`, {
        method: "POST",
        body: JSON.stringify(draft),
    });
}

/** 更新审核意见 */
export async function updateReview(
    projectId: string,
    reviewId: string,
    patch: Partial<ProjectReview>
): Promise<ProjectReview> {
    return api<ProjectReview>(`/api/projects/${projectId}/reviews/${reviewId}`, {
        method: "PUT",
        body: JSON.stringify(patch),
    });
}

/** 删除审核意见 */
export async function deleteReview(projectId: string, reviewId: string): Promise<void> {
    await api(`/api/projects/${projectId}/reviews/${reviewId}`, { method: "DELETE" });
}