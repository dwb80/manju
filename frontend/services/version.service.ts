/**
 * 资产版本管理（任务12：统一版本管理）
 *
 * 跨"角色 / 场景 / 道具"三个工厂的版本历史读写接口。
 * 与 FactoryCRUDPage 的 fetchVersions 配合使用。
 */

import { api } from "./api-client";
import type { AssetVersion } from "@/lib/module-types";

/** 列出某资产的全部历史版本，按 version 倒序。 */
export async function listVersions(
  entityType: string,
  entityId: string,
): Promise<AssetVersion[]> {
  const query = `?entity_type=${encodeURIComponent(entityType)}&entity_id=${encodeURIComponent(entityId)}`;
  return api<AssetVersion[]>(`/api/versions${query}`);
}

/** 根据版本 ID 获取单条版本记录。 */
export async function getVersion(versionId: string): Promise<AssetVersion> {
  return api<AssetVersion>(`/api/versions/${versionId}`);
}

/** 回滚某条版本到对应实体，会自动新增一条 restore 版本。 */
export async function restoreVersion(versionId: string): Promise<AssetVersion> {
  return api<AssetVersion>(`/api/versions/${versionId}/restore`, { method: "POST" });
}
