/** 资产相关的业务服务 */
import { api } from "./api-client";
import type { ProjectAsset, ProjectAssetKind, AssetDraft } from "@/lib/app-types";

/** 资产服务接口 */
export interface AssetService {
    /** 获取资产列表 */
    list(projectId: string, query?: string): Promise<ProjectAsset[]>;
    /** 创建资产 */
    create(projectId: string, draft: Partial<ProjectAsset>): Promise<ProjectAsset>;
    /** 更新资产 */
    update(projectId: string, assetId: string, patch: Partial<ProjectAsset>): Promise<ProjectAsset>;
    /** 删除资产 */
    delete(projectId: string, assetId: string): Promise<void>;
    /** 切换收藏状态 */
    toggleFavorite(projectId: string, assetId: string): Promise<ProjectAsset>;
}

/** 获取资产列表 */
export async function listAssets(projectId: string, query?: string): Promise<ProjectAsset[]> {
    const url = query ? `/api/projects/${projectId}/assets?${query}` : `/api/projects/${projectId}/assets`;
    return api<ProjectAsset[]>(url);
}

/** 创建资产 */
export async function createAsset(
    projectId: string,
    draft: Partial<ProjectAsset>
): Promise<ProjectAsset> {
    return api<ProjectAsset>(`/api/projects/${projectId}/assets`, {
        method: "POST",
        body: JSON.stringify(draft),
    });
}

/** 更新资产 */
export async function updateAsset(
    projectId: string,
    assetId: string,
    patch: Partial<ProjectAsset>
): Promise<ProjectAsset> {
    return api<ProjectAsset>(`/api/projects/${projectId}/assets/${assetId}`, {
        method: "PUT",
        body: JSON.stringify(patch),
    });
}

/** 删除资产 */
export async function deleteAsset(projectId: string, assetId: string): Promise<void> {
    await api(`/api/projects/${projectId}/assets/${assetId}`, { method: "DELETE" });
}

/** 切换资产收藏状态 */
export async function toggleAssetFavorite(projectId: string, assetId: string): Promise<ProjectAsset> {
    return api<ProjectAsset>(`/api/projects/${projectId}/assets/${assetId}`, {
        method: "PUT",
        body: JSON.stringify({ is_favorite: true }), // 后端会自动切换
    });
}