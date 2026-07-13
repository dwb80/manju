import type { AppContext } from "../app.js";
import type { Asset } from "../../types/asset.js";
import { id, nowIso } from "../../utils.js";

export type AssetInput = {
  project_id?: string;
  name?: string;
  type?: string;
  file_url?: string;
  size?: number;
  format?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
};

export async function listAssets(ctx: AppContext, projectId?: string): Promise<Asset[]> {
  const filter: Partial<Asset> = projectId ? { project_id: projectId } : {};
  return ctx.assets.findMany(filter, { sort: "desc" });
}

export async function createAsset(ctx: AppContext, input: AssetInput): Promise<Asset> {
  const asset: Asset = {
    id: id("asset"),
    project_id: input.project_id ?? "",
    name: input.name ?? "",
    type: (input.type as Asset["type"]) ?? "image",
    file_url: input.file_url ?? "",
    size: input.size ?? 0,
    format: input.format ?? "",
    tags: input.tags ?? [],
    metadata: input.metadata,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  await ctx.assets.insert(asset);
  return asset;
}

export async function updateAsset(ctx: AppContext, assetId: string, input: AssetInput): Promise<Asset> {
  const existing = await ctx.assets.findById(assetId);
  if (!existing) throw new Error("资产不存在");
  const patch: Partial<Asset> = {
    ...input,
    type: input.type ? (input.type as Asset["type"]) : undefined,
    updated_at: nowIso(),
  };
  await ctx.assets.update(assetId, patch);
  return { ...existing, ...patch } as Asset;
}

export async function deleteAsset(ctx: AppContext, assetId: string): Promise<void> {
  await ctx.assets.delete(assetId);
}
