import type { AppContext } from "../app.js";
import type { Prop, PropCategory } from "../../types/prop.js";
import { id, nowIso } from "../../utils.js";
import { recordVersion } from "./asset-version.js";
import { recordAppLog } from "../audit-log.js";

export type PropInput = {
  project_id?: string;
  name?: string;
  category?: PropCategory | string;
  description?: string;
  appearance?: string;
  material?: string;
  size?: string;
  color?: string;
  image?: string;
  tags?: string[];
};

export async function listProps(
  ctx: AppContext,
  projectId?: string,
  name?: string,
): Promise<Prop[]> {
  const filter: Partial<Prop> = { ...(projectId ? { project_id: projectId } : {}) };
  if (name) filter.name = name;
  const items = await ctx.props.findMany(filter, { sort: "desc" });
  return items.filter((item) => !item.deleted_at);
}

export async function createProp(ctx: AppContext, input: PropInput): Promise<Prop> {
  const projectId = input.project_id ?? "";
  const name = (input.name ?? "").trim();
  if (projectId && name) {
    const existing = await ctx.props.findMany({ project_id: projectId, name });
    if (existing.length > 0) {
      return existing[0];
    }
  }
  const prop: Prop = {
    id: id("prop"),
    project_id: projectId,
    name,
    category: (input.category as Prop["category"]) ?? "other",
    description: input.description ?? "",
    appearance: input.appearance,
    material: input.material,
    size: input.size,
    color: input.color,
    image: input.image,
    tags: input.tags ?? [],
    usage_count: 0,
    version: 1,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  await ctx.props.insert(prop);
  await recordVersion(ctx, {
    entityType: "prop",
    entityId: prop.id,
    entity: prop,
    changeType: "create",
  });
  return prop;
}

export async function updateProp(ctx: AppContext, propId: string, input: PropInput): Promise<Prop> {
  const existing = await ctx.props.findById(propId);
  if (!existing) throw new Error("道具不存在");
  if (existing.deleted_at) throw new Error("已删除的道具不可编辑");
  const nextVersion = (existing.version ?? 1) + 1;
  const patch: Partial<Prop> = {
    ...input,
    category: input.category ? (input.category as Prop["category"]) : undefined,
    version: nextVersion,
    updated_at: nowIso(),
  };
  await ctx.props.update(propId, patch);
  const updated = { ...existing, ...patch } as Prop;
  await recordVersion(ctx, {
    entityType: "prop",
    entityId: propId,
    entity: updated,
    changeType: "update",
    changeNote: `升级到 v${nextVersion}`,
  });
  return updated;
}

export async function deleteProp(ctx: AppContext, propId: string): Promise<void> {
  const existing = await ctx.props.findById(propId);
  if (!existing) throw new Error("道具不存在");
  await ctx.props.update(propId, { deleted_at: nowIso() } as Partial<Prop>);
}

export async function restoreProp(ctx: AppContext, propId: string): Promise<void> {
  const existing = await ctx.props.findById(propId);
  if (!existing) throw new Error("道具不存在");
  await ctx.props.update(propId, { deleted_at: "" } as Partial<Prop>);
}

export async function listDeletedProps(ctx: AppContext, projectId?: string): Promise<Prop[]> {
  const filter: Partial<Prop> = projectId ? { project_id: projectId } : {};
  const items = await ctx.props.findMany(filter, { sort: "desc" });
  return items.filter((item) => Boolean(item.deleted_at));
}

export async function permanentDeleteProps(ctx: AppContext, ids: string[]): Promise<void> {
  for (const entityId of ids) {
    await ctx.props.delete(entityId);
  }
}

export async function batchDeleteProps(ctx: AppContext, ids: string[]): Promise<void> {
  const ts = nowIso();
  for (const entityId of ids) {
    const existing = await ctx.props.findById(entityId);
    await ctx.props.update(entityId, { deleted_at: ts } as Partial<Prop>);
    void recordAppLog(ctx, {
      entityType: "prop",
      entityId: entityId,
      action: "asset.soft_deleted",
      event: "asset.soft_deleted",
      payload: { assetType: "prop", batch: true },
      projectId: existing?.project_id,
    });
  }
}

export async function batchUpdateProps(ctx: AppContext, ids: string[], patch: PropInput): Promise<void> {
  const partial: Partial<Prop> = {
    ...patch,
    category: patch.category ? (patch.category as Prop["category"]) : undefined,
    updated_at: nowIso(),
  };
  for (const entityId of ids) {
    await ctx.props.update(entityId, partial);
  }
}
