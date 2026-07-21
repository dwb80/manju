import type { AppContext } from "../app.js";
import type { CharacterImage, PropImage, SceneImage } from "../../types/asset-image.js";

const newId = (prefix: string): string =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const nowIso = (): string => new Date().toISOString();

type AssetImageTable = "characterImages" | "sceneImages" | "propImages";

async function ensureSinglePrimary<T extends { id: string; is_primary: 0 | 1 }>(
  ctx: AppContext,
  table: AssetImageTable,
  assetIdField: string,
  assetId: string,
  keepId: string
): Promise<void> {
  const rows = (await (ctx[table] as any).findMany({ [assetIdField]: assetId })) as T[];
  for (const r of rows) {
    if (r.id === keepId) continue;
    if (r.is_primary === 1) {
      await (ctx[table] as any).update(r.id, { is_primary: 0, updated_at: nowIso() });
    }
  }
}

export async function listCharacterImages(ctx: AppContext, characterId: string): Promise<CharacterImage[]> {
  const rows = (await ctx.characterImages.findMany({ character_id: characterId })) as CharacterImage[];
  return rows.sort((a, b) => {
    if (a.is_primary !== b.is_primary) return b.is_primary - a.is_primary;
    return (a.created_at || "").localeCompare(b.created_at || "");
  });
}

export interface CreateCharacterImageInput {
  character_id: string;
  project_id: string;
  script_id?: string;
  url: string;
  prompt?: string;
  view_type?: string;
  is_primary?: 0 | 1;
}

export async function createCharacterImage(ctx: AppContext, input: CreateCharacterImageInput): Promise<CharacterImage> {
  const now = nowIso();
  if (input.is_primary === 1) {
    await ensureSinglePrimary(ctx, "characterImages", "character_id", input.character_id, "__new__");
  }
  const record: CharacterImage = {
    id: newId("chimg"),
    character_id: input.character_id,
    project_id: input.project_id,
    script_id: input.script_id,
    url: input.url,
    prompt: input.prompt,
    view_type: input.view_type,
    is_primary: input.is_primary ?? 0,
    created_at: now,
    updated_at: now,
  };
  await ctx.characterImages.insert(record);
  return record;
}

export async function updateCharacterImage(
  ctx: AppContext,
  id: string,
  patch: Partial<CharacterImage>
): Promise<CharacterImage | null> {
  const existing = (await ctx.characterImages.findById(id)) as CharacterImage | null;
  if (!existing) return null;
  const updated: CharacterImage = { ...existing, ...patch, id, updated_at: nowIso() };
  if (patch.is_primary === 1) {
    await ensureSinglePrimary(ctx, "characterImages", "character_id", existing.character_id, id);
  }
  await ctx.characterImages.update(id, updated);
  return updated;
}

export async function deleteCharacterImage(ctx: AppContext, id: string): Promise<boolean> {
  const existing = (await ctx.characterImages.findById(id)) as CharacterImage | null;
  if (!existing) return false;
  await ctx.characterImages.delete(id);
  return true;
}

export async function cascadeDeleteCharacterImages(ctx: AppContext, characterId: string): Promise<number> {
  const rows = (await ctx.characterImages.findMany({ character_id: characterId })) as CharacterImage[];
  for (const r of rows) {
    await ctx.characterImages.delete(r.id);
  }
  return rows.length;
}

export async function listSceneImages(ctx: AppContext, sceneId: string): Promise<SceneImage[]> {
  const rows = (await ctx.sceneImages.findMany({ scene_id: sceneId })) as SceneImage[];
  return rows.sort((a, b) => {
    if (a.is_primary !== b.is_primary) return b.is_primary - a.is_primary;
    return (a.created_at || "").localeCompare(b.created_at || "");
  });
}

export interface CreateSceneImageInput {
  scene_id: string;
  project_id: string;
  script_id?: string;
  url: string;
  prompt?: string;
  view_type?: string;
  is_primary?: 0 | 1;
}

export async function createSceneImage(ctx: AppContext, input: CreateSceneImageInput): Promise<SceneImage> {
  const now = nowIso();
  if (input.is_primary === 1) {
    await ensureSinglePrimary(ctx, "sceneImages", "scene_id", input.scene_id, "__new__");
  }
  const record: SceneImage = {
    id: newId("scimg"),
    scene_id: input.scene_id,
    project_id: input.project_id,
    script_id: input.script_id,
    url: input.url,
    prompt: input.prompt,
    view_type: input.view_type,
    is_primary: input.is_primary ?? 0,
    created_at: now,
    updated_at: now,
  };
  await ctx.sceneImages.insert(record);
  return record;
}

export async function updateSceneImage(
  ctx: AppContext,
  id: string,
  patch: Partial<SceneImage>
): Promise<SceneImage | null> {
  const existing = (await ctx.sceneImages.findById(id)) as SceneImage | null;
  if (!existing) return null;
  const updated: SceneImage = { ...existing, ...patch, id, updated_at: nowIso() };
  if (patch.is_primary === 1) {
    await ensureSinglePrimary(ctx, "sceneImages", "scene_id", existing.scene_id, id);
  }
  await ctx.sceneImages.update(id, updated);
  return updated;
}

export async function deleteSceneImage(ctx: AppContext, id: string): Promise<boolean> {
  const existing = (await ctx.sceneImages.findById(id)) as SceneImage | null;
  if (!existing) return false;
  await ctx.sceneImages.delete(id);
  return true;
}

export async function cascadeDeleteSceneImages(ctx: AppContext, sceneId: string): Promise<number> {
  const rows = (await ctx.sceneImages.findMany({ scene_id: sceneId })) as SceneImage[];
  for (const r of rows) {
    await ctx.sceneImages.delete(r.id);
  }
  return rows.length;
}

export async function listPropImages(ctx: AppContext, propId: string): Promise<PropImage[]> {
  const rows = (await ctx.propImages.findMany({ prop_id: propId })) as PropImage[];
  return rows.sort((a, b) => {
    if (a.is_primary !== b.is_primary) return b.is_primary - a.is_primary;
    return (a.created_at || "").localeCompare(b.created_at || "");
  });
}

export interface CreatePropImageInput {
  prop_id: string;
  project_id: string;
  script_id?: string;
  url: string;
  prompt?: string;
  view_type?: string;
  is_primary?: 0 | 1;
}

export async function createPropImage(ctx: AppContext, input: CreatePropImageInput): Promise<PropImage> {
  const now = nowIso();
  if (input.is_primary === 1) {
    await ensureSinglePrimary(ctx, "propImages", "prop_id", input.prop_id, "__new__");
  }
  const record: PropImage = {
    id: newId("ppimg"),
    prop_id: input.prop_id,
    project_id: input.project_id,
    script_id: input.script_id,
    url: input.url,
    prompt: input.prompt,
    view_type: input.view_type,
    is_primary: input.is_primary ?? 0,
    created_at: now,
    updated_at: now,
  };
  await ctx.propImages.insert(record);
  return record;
}

export async function updatePropImage(
  ctx: AppContext,
  id: string,
  patch: Partial<PropImage>
): Promise<PropImage | null> {
  const existing = (await ctx.propImages.findById(id)) as PropImage | null;
  if (!existing) return null;
  const updated: PropImage = { ...existing, ...patch, id, updated_at: nowIso() };
  if (patch.is_primary === 1) {
    await ensureSinglePrimary(ctx, "propImages", "prop_id", existing.prop_id, id);
  }
  await ctx.propImages.update(id, updated);
  return updated;
}

export async function deletePropImage(ctx: AppContext, id: string): Promise<boolean> {
  const existing = (await ctx.propImages.findById(id)) as PropImage | null;
  if (!existing) return false;
  await ctx.propImages.delete(id);
  return true;
}

export async function cascadeDeletePropImages(ctx: AppContext, propId: string): Promise<number> {
  const rows = (await ctx.propImages.findMany({ prop_id: propId })) as PropImage[];
  for (const r of rows) {
    await ctx.propImages.delete(r.id);
  }
  return rows.length;
}
