import type { AppContext } from "../app.js";
import type { Scene } from "../../types/scene.js";
import { id, nowIso } from "../../utils.js";
import { recordVersion } from "./asset-version.js";
import { recordAppLog } from "../audit-log.js";

export type SceneInput = {
  project_id?: string;
  name?: string;
  type?: string;
  description?: string;
  image?: string;
  tags?: string[];
  lighting?: string;
  time_of_day?: string;
  weather?: string;
};

export async function listScenes(
  ctx: AppContext,
  projectId?: string,
  name?: string,
): Promise<Scene[]> {
  const filter: Partial<Scene> = { ...(projectId ? { project_id: projectId } : {}) };
  if (name) filter.name = name;
  const items = await ctx.scenes.findMany(filter, { sort: "desc" });
  return items.filter((item) => !item.deleted_at);
}

export async function createScene(ctx: AppContext, input: SceneInput): Promise<Scene> {
  const projectId = input.project_id ?? "";
  const name = (input.name ?? "").trim();
  if (projectId && name) {
    const existing = await ctx.scenes.findMany({ project_id: projectId, name });
    if (existing.length > 0) {
      return existing[0];
    }
  }
  const scene: Scene = {
    id: id("scene"),
    project_id: projectId,
    name,
    type: (input.type as Scene["type"]) ?? "indoor",
    description: input.description ?? "",
    image: input.image,
    tags: input.tags ?? [],
    lighting: input.lighting,
    time_of_day: input.time_of_day,
    weather: input.weather,
    usage_count: 0,
    version: 1,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  await ctx.scenes.insert(scene);
  await recordVersion(ctx, {
    entityType: "scene",
    entityId: scene.id,
    entity: scene,
    changeType: "create",
  });
  return scene;
}

export async function updateScene(ctx: AppContext, sceneId: string, input: SceneInput): Promise<Scene> {
  const existing = await ctx.scenes.findById(sceneId);
  if (!existing) throw new Error("场景不存在");
  if (existing.deleted_at) throw new Error("已删除的场景不可编辑");
  const nextVersion = (existing.version ?? 1) + 1;
  const patch: Partial<Scene> = {
    ...input,
    type: input.type ? (input.type as Scene["type"]) : undefined,
    version: nextVersion,
    updated_at: nowIso(),
  };
  await ctx.scenes.update(sceneId, patch);
  const updated = { ...existing, ...patch } as Scene;
  await recordVersion(ctx, {
    entityType: "scene",
    entityId: sceneId,
    entity: updated,
    changeType: "update",
    changeNote: `升级到 v${nextVersion}`,
  });
  return updated;
}

export async function deleteScene(ctx: AppContext, sceneId: string): Promise<void> {
  const existing = await ctx.scenes.findById(sceneId);
  await ctx.scenes.update(sceneId, { deleted_at: nowIso() } as Partial<Scene>);
  void recordAppLog(ctx, {
    entityType: "scene",
    entityId: sceneId,
    action: "asset.soft_deleted",
    event: "asset.soft_deleted",
    payload: { assetType: "scene" },
    projectId: existing?.project_id,
  });
}

export async function restoreScene(ctx: AppContext, sceneId: string): Promise<void> {
  const existing = await ctx.scenes.findById(sceneId);
  await ctx.scenes.update(sceneId, { deleted_at: "" } as Partial<Scene>);
  void recordAppLog(ctx, {
    entityType: "scene",
    entityId: sceneId,
    action: "asset.restored",
    event: "asset.restored",
    payload: { assetType: "scene" },
    projectId: existing?.project_id,
  });
}

export async function listDeletedScenes(ctx: AppContext, projectId?: string): Promise<Scene[]> {
  const filter: Partial<Scene> = projectId ? { project_id: projectId } : {};
  const items = await ctx.scenes.findMany(filter, { sort: "desc" });
  return items.filter((item) => Boolean(item.deleted_at));
}

export async function permanentDeleteScenes(ctx: AppContext, ids: string[]): Promise<void> {
  for (const entityId of ids) {
    await ctx.scenes.delete(entityId);
  }
}

export async function batchDeleteScenes(ctx: AppContext, ids: string[]): Promise<void> {
  const ts = nowIso();
  for (const entityId of ids) {
    await ctx.scenes.update(entityId, { deleted_at: ts } as Partial<Scene>);
  }
}

export async function batchUpdateScenes(ctx: AppContext, ids: string[], patch: SceneInput): Promise<void> {
  const partial: Partial<Scene> = {
    ...patch,
    type: patch.type ? (patch.type as Scene["type"]) : undefined,
    updated_at: nowIso(),
  };
  for (const entityId of ids) {
    await ctx.scenes.update(entityId, partial);
  }
}
