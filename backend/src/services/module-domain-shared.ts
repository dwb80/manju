/**
 * @file module-domain-shared.ts
 * @description 提供软删除、恢复、永久删除、跨项目复制等通用操作的工具函数
 */

import type { AppContext } from "./app.js";
import { id, nowIso } from "../utils.js";
import type { Repository } from "../storage/repository.js";

export async function softDelete(ctx: AppContext, repo: Repository<any>, entityId: string): Promise<{ id: string }> {
  const existing = await repo.findById(entityId);
  if (!existing) throw new Error("记录不存在");
  const deletedAt = nowIso();
  await repo.update(entityId, { deleted_at: deletedAt, updated_at: deletedAt } as any);
  return { id: entityId, deleted_at: deletedAt } as any;
}

/**
 * restoreDeleted - 恢复已软删除的实体
 * @param {AppContext} ctx - 应用上下文
 * @param {Repository<any>} repo - 数据仓库实例
 * @param {string} entityId - 实体 ID
 * @returns {Promise<void>}
 */
export async function restoreDeleted(ctx: AppContext, repo: Repository<any>, entityId: string): Promise<void> {
  const existing = await repo.findById(entityId);
  if (!existing) throw new Error("记录不存在或已被永久删除");
  const restoredAt = nowIso();
  await repo.update(entityId, { deleted_at: "", updated_at: restoredAt } as any);
}

export async function listDeletedInRepo(repo: Repository<any>, projectId?: string): Promise<any[]> {
  const filter: any = projectId ? { project_id: projectId } : {};
  const all = await repo.findMany(filter);
  return all.filter((it: any) => !!it.deleted_at);
}

/**
 * permanentDelete - 永久删除指定实体
 * @param {AppContext} ctx - 应用上下文
 * @param {Repository<any>} repo - 数据仓库实例
 * @param {string} entityId - 实体 ID
 * @returns {Promise<void>}
 */
export async function permanentDelete(ctx: AppContext, repo: Repository<any>, entityId: string): Promise<void> {
  await repo.delete(entityId);
}

/**
 * copyToProject - 将实体复制到目标项目
 * @template T - 实体类型，包含 id、project_id、created_at 等字段
 * @param {AppContext} ctx - 应用上下文
 * @param {Repository<T>} repo - 数据仓库实例
 * @param {string} sourceId - 源实体 ID
 * @param {string} targetProjectId - 目标项目 ID
 * @returns {Promise<T>} 复制后的实体
 */
export async function copyToProject<T extends { id: string; project_id: string; created_at: string; name?: string; title?: string }>(
  ctx: AppContext,
  repo: Repository<T>,
  sourceId: string,
  targetProjectId: string
): Promise<T> {
  const source = await repo.findById(sourceId);
  if (!source) throw new Error("源记录不存在");
  const prefix = "transferred-";
  const dup = await repo.findMany({ project_id: targetProjectId } as any);
  const existing = dup.find((d: any) => (d as any).name === (source as any).name);
  if (existing) return existing as T;
  const { id: _ignored, created_at: _ca, updated_at: _ua, deleted_at: _da, ...rest } = source as any;
  const now = nowIso();
  const cloned: any = {
    ...rest,
    id: id("cp"),
    project_id: targetProjectId,
    name: (source as any).name ? prefix + (source as any).name : source.name,
    title: (source as any).title ? prefix + (source as any).title : source.title,
    created_at: now,
    updated_at: now,
  };
  await repo.insert(cloned);
  return cloned as T;
}
