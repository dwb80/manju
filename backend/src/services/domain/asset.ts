import type { AppContext } from "../app.js";
import type { ProjectAsset, ProjectAssetKind } from "../../types.js";
import { id, nowIso } from "../../utils.js";
import { normalizeStringList } from "./storyboard.js";

const projectAssetKinds: ProjectAssetKind[] = ["image", "video", "character", "scene", "style", "prompt", "project", "storyboard"];

type ProjectAssetInput = {
  kind?: string;
  name?: string;
  prompt?: string;
  image_task_id?: string;
  image_url?: string;
  video_task_id?: string;
  video_url?: string;
  folder?: string;
  tags?: unknown;
  is_favorite?: boolean;
  resolution?: string;
  duration?: string;
  role_images?: unknown;
  role_traits?: unknown;
  style_keywords?: unknown;
  notes?: string;
};

/** 把资产类型规整成系统支持的六类资产，不认识的类型默认当作图片资产。 */
function normalizeProjectAssetKind(kind: unknown): ProjectAssetKind {
  return projectAssetKinds.includes(kind as ProjectAssetKind) ? kind as ProjectAssetKind : "image";
}

/** 查询项目资产库，支持类型、关键词、标签和收藏状态筛选。 */
export async function listProjectAssets(ctx: AppContext, projectId: string, filters: { kind?: string | null; q?: string | null; tag?: string | null; favorite?: string | null } = {}): Promise<ProjectAsset[]> {
  if (!await ctx.projects.findById(projectId)) throw new Error("project not found");
  const filter: Partial<ProjectAsset> = { project_id: projectId };
  if (filters.kind && filters.kind !== "all") filter.kind = normalizeProjectAssetKind(filters.kind);
  let assets = await ctx.projectAssets.findMany(filter, { sort: "asc" });
  if (filters.favorite === "true") assets = assets.filter((asset) => asset.is_favorite);
  if (filters.tag) assets = assets.filter((asset) => (asset.tags ?? []).includes(filters.tag ?? ""));
  if (filters.q) {
    const keyword = filters.q.trim().toLowerCase();
    if (keyword) {
      assets = assets.filter((asset) => [
        asset.name,
        asset.prompt,
        asset.notes,
        asset.folder,
        ...(asset.tags ?? []),
      ].join(" ").toLowerCase().includes(keyword));
    }
  }
  return assets;
}

/** 新增项目资产库条目，把表单字段清洗后保存到主数据库。 */
export async function createProjectAsset(ctx: AppContext, projectId: string, input: ProjectAssetInput): Promise<ProjectAsset> {
  if (!await ctx.projects.findById(projectId)) throw new Error("project not found");
  const now = nowIso();
  const asset: ProjectAsset = {
    id: id("pa"),
    project_id: projectId,
    kind: normalizeProjectAssetKind(input.kind),
    name: input.name?.trim() || "新资产",
    prompt: input.prompt?.trim() || "",
    image_url: input.image_url?.trim() || "",
    video_url: input.video_url?.trim() || "",
    folder: input.folder?.trim() || "",
    tags: normalizeStringList(input.tags),
    is_favorite: Boolean(input.is_favorite),
    resolution: input.resolution?.trim() || "",
    duration: input.duration?.trim() || "",
    role_images: normalizeStringList(input.role_images),
    role_traits: normalizeStringList(input.role_traits),
    style_keywords: normalizeStringList(input.style_keywords),
    notes: input.notes?.trim() || "",
    created_at: now,
    updated_at: now,
  };
  await ctx.projectAssets.insert(asset);
  return asset;
}

/** 更新项目资产库条目，只覆盖本次请求明确传入的字段。 */
export async function updateProjectAsset(ctx: AppContext, projectId: string, assetId: string, patch: ProjectAssetInput): Promise<ProjectAsset> {
  const existing = await ctx.projectAssets.findById(assetId);
  if (!existing || existing.project_id !== projectId) throw new Error("project asset not found");
  const next: Partial<ProjectAsset> = { updated_at: nowIso() };
  if (typeof patch.kind === "string") next.kind = normalizeProjectAssetKind(patch.kind);
  if (typeof patch.name === "string") next.name = patch.name.trim() || existing.name;
  if (typeof patch.prompt === "string") next.prompt = patch.prompt.trim();
  if (typeof patch.image_url === "string") next.image_url = patch.image_url.trim();
  if (typeof patch.video_url === "string") next.video_url = patch.video_url.trim();
  if (typeof patch.folder === "string") next.folder = patch.folder.trim();
  if (patch.tags !== undefined) next.tags = normalizeStringList(patch.tags);
  if (typeof patch.is_favorite === "boolean") next.is_favorite = patch.is_favorite;
  if (typeof patch.resolution === "string") next.resolution = patch.resolution.trim();
  if (typeof patch.duration === "string") next.duration = patch.duration.trim();
  if (patch.role_images !== undefined) next.role_images = normalizeStringList(patch.role_images);
  if (patch.role_traits !== undefined) next.role_traits = normalizeStringList(patch.role_traits);
  if (patch.style_keywords !== undefined) next.style_keywords = normalizeStringList(patch.style_keywords);
  if (typeof patch.notes === "string") next.notes = patch.notes.trim();
  await ctx.projectAssets.update(assetId, next);
  return (await ctx.projectAssets.findById(assetId)) as ProjectAsset;
}

/** 删除项目资产库条目。 */
export async function deleteProjectAsset(ctx: AppContext, projectId: string, assetId: string): Promise<void> {
  const existing = await ctx.projectAssets.findById(assetId);
  if (!existing || existing.project_id !== projectId) throw new Error("project asset not found");
  await ctx.projectAssets.delete(assetId);
}
