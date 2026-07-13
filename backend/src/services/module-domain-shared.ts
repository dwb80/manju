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

export async function permanentDelete(ctx: AppContext, repo: Repository<any>, entityId: string): Promise<void> {
  await repo.delete(entityId);
}

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
