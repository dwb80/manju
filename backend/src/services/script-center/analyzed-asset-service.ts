import { id, nowIso } from "../../utils.js";
import type { AppContext } from "../app.js";
import type { ScriptAnalyzedCharacter, ScriptAnalyzedScene, ScriptAnalyzedProp } from "../../types/script.js";

function normalizeSceneType<T extends { type?: string; scene_type?: string }>(row: T): T {
  if (!row) return row;
  if (!row.type && row.scene_type) {
    return { ...row, type: row.scene_type };
  }
  return row;
}

function normalizePropShape<T>(row: T): T {
  return row;
}

export async function listScriptAnalyzedCharacters(
  ctx: AppContext,
  documentId: string
): Promise<ScriptAnalyzedCharacter[]> {
  return (await ctx.scriptAnalyzedCharacters.findMany(
    { document_id: documentId },
    { sort: "asc" }
  )) as ScriptAnalyzedCharacter[];
}

export async function createScriptAnalyzedCharacter(
  ctx: AppContext,
  input: Omit<ScriptAnalyzedCharacter, "id" | "created_at" | "updated_at">
): Promise<ScriptAnalyzedCharacter> {
  const record: ScriptAnalyzedCharacter = {
    id: id("sac"),
    ...input,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  await ctx.scriptAnalyzedCharacters.insert(record);
  return record;
}

export async function updateScriptAnalyzedCharacter(
  ctx: AppContext,
  characterId: string,
  input: Partial<Omit<ScriptAnalyzedCharacter, "id" | "created_at">>
): Promise<ScriptAnalyzedCharacter> {
  const existing = (await ctx.scriptAnalyzedCharacters.findById(characterId)) as
    | ScriptAnalyzedCharacter
    | undefined;
  if (!existing) throw new Error("分析角色不存在");
  const patch = { ...input, updated_at: nowIso() };
  await ctx.scriptAnalyzedCharacters.update(characterId, patch);
  return { ...existing, ...patch };
}

export async function deleteScriptAnalyzedCharacter(
  ctx: AppContext,
  characterId: string
): Promise<void> {
  await ctx.scriptAnalyzedCharacters.delete(characterId);
}

export async function replaceScriptAnalyzedCharacters(
  ctx: AppContext,
  documentId: string,
  projectId: string,
  characters: Array<Omit<ScriptAnalyzedCharacter, "id" | "document_id" | "project_id" | "created_at" | "updated_at">>
): Promise<ScriptAnalyzedCharacter[]> {
  const existing = (await ctx.scriptAnalyzedCharacters.findMany({ document_id: documentId })) as
    | ScriptAnalyzedCharacter[]
    | undefined;
  for (const e of existing ?? []) {
    await ctx.scriptAnalyzedCharacters.delete(e.id);
  }
  const dedupMap = new Map<string, Omit<ScriptAnalyzedCharacter, "id" | "document_id" | "project_id" | "created_at" | "updated_at">>();
  for (const c of characters) {
    if (!c.name) continue;
    dedupMap.set(c.name.trim(), c);
  }
  const results: ScriptAnalyzedCharacter[] = [];
  for (const c of dedupMap.values()) {
    const record = await createScriptAnalyzedCharacter(ctx, {
      ...c,
      document_id: documentId,
      project_id: projectId,
    });
    results.push(record);
  }
  return results;
}

export async function listScriptAnalyzedScenes(
  ctx: AppContext,
  documentId: string
): Promise<ScriptAnalyzedScene[]> {
  const rows = (await ctx.scriptAnalyzedScenes.findMany(
    { document_id: documentId },
    { sort: "asc" }
  )) as ScriptAnalyzedScene[];
  return rows.map(normalizeSceneType);
}

export async function createScriptAnalyzedScene(
  ctx: AppContext,
  input: Omit<ScriptAnalyzedScene, "id" | "created_at" | "updated_at">
): Promise<ScriptAnalyzedScene> {
  const record: ScriptAnalyzedScene = {
    id: id("sas"),
    ...input,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  await ctx.scriptAnalyzedScenes.insert(record);
  return record;
}

export async function updateScriptAnalyzedScene(
  ctx: AppContext,
  sceneId: string,
  input: Partial<Omit<ScriptAnalyzedScene, "id" | "created_at">>
): Promise<ScriptAnalyzedScene> {
  const existing = (await ctx.scriptAnalyzedScenes.findById(sceneId)) as ScriptAnalyzedScene | undefined;
  if (!existing) throw new Error("分析场景不存在");
  const normalizedInput: Record<string, unknown> = { ...input };
  if (input.type != null) {
    normalizedInput.scene_type = input.type;
  } else if (input.scene_type != null) {
    normalizedInput.type = input.scene_type;
  }
  const patch = { ...normalizedInput, updated_at: nowIso() };
  await ctx.scriptAnalyzedScenes.update(sceneId, patch);
  return normalizeSceneType({ ...existing, ...patch });
}

export async function deleteScriptAnalyzedScene(
  ctx: AppContext,
  sceneId: string
): Promise<void> {
  await ctx.scriptAnalyzedScenes.delete(sceneId);
}

export async function replaceScriptAnalyzedScenes(
  ctx: AppContext,
  documentId: string,
  projectId: string,
  scenes: Array<Omit<ScriptAnalyzedScene, "id" | "document_id" | "project_id" | "created_at" | "updated_at">>
): Promise<ScriptAnalyzedScene[]> {
  const existing = (await ctx.scriptAnalyzedScenes.findMany({ document_id: documentId })) as
    | ScriptAnalyzedScene[]
    | undefined;
  for (const e of existing ?? []) {
    await ctx.scriptAnalyzedScenes.delete(e.id);
  }
  const dedupMap = new Map<string, Omit<ScriptAnalyzedScene, "id" | "document_id" | "project_id" | "created_at" | "updated_at">>();
  for (const s of scenes) {
    if (!s.name) continue;
    dedupMap.set(s.name.trim(), s);
  }
  const results: ScriptAnalyzedScene[] = [];
  for (const s of dedupMap.values()) {
    const record = await createScriptAnalyzedScene(ctx, {
      ...s,
      document_id: documentId,
      project_id: projectId,
    });
    results.push(record);
  }
  return results;
}

export async function listScriptAnalyzedProps(
  ctx: AppContext,
  documentId: string
): Promise<ScriptAnalyzedProp[]> {
  return ((await ctx.scriptAnalyzedProps.findMany(
    { document_id: documentId },
    { sort: "asc" }
  )) as ScriptAnalyzedProp[]).map(normalizePropShape);
}

export async function createScriptAnalyzedProp(
  ctx: AppContext,
  input: Omit<ScriptAnalyzedProp, "id" | "created_at" | "updated_at">
): Promise<ScriptAnalyzedProp> {
  const record: ScriptAnalyzedProp = {
    id: id("sap"),
    ...input,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  await ctx.scriptAnalyzedProps.insert(record);
  return record;
}

export async function updateScriptAnalyzedProp(
  ctx: AppContext,
  propId: string,
  input: Partial<Omit<ScriptAnalyzedProp, "id" | "created_at">>
): Promise<ScriptAnalyzedProp> {
  const existing = (await ctx.scriptAnalyzedProps.findById(propId)) as ScriptAnalyzedProp | undefined;
  if (!existing) throw new Error("分析道具不存在");
  const patch = { ...input, updated_at: nowIso() };
  await ctx.scriptAnalyzedProps.update(propId, patch);
  return { ...existing, ...patch };
}

export async function deleteScriptAnalyzedProp(
  ctx: AppContext,
  propId: string
): Promise<void> {
  await ctx.scriptAnalyzedProps.delete(propId);
}

export async function replaceScriptAnalyzedProps(
  ctx: AppContext,
  documentId: string,
  projectId: string,
  props: Array<Omit<ScriptAnalyzedProp, "id" | "document_id" | "project_id" | "created_at" | "updated_at">>
): Promise<ScriptAnalyzedProp[]> {
  const existing = (await ctx.scriptAnalyzedProps.findMany({ document_id: documentId })) as
    | ScriptAnalyzedProp[]
    | undefined;
  for (const e of existing ?? []) {
    await ctx.scriptAnalyzedProps.delete(e.id);
  }
  const dedupMap = new Map<string, Omit<ScriptAnalyzedProp, "id" | "document_id" | "project_id" | "created_at" | "updated_at">>();
  for (const p of props) {
    if (!p.name) continue;
    dedupMap.set(p.name.trim(), p);
  }
  const results: ScriptAnalyzedProp[] = [];
  for (const p of dedupMap.values()) {
    const record = await createScriptAnalyzedProp(ctx, {
      ...p,
      document_id: documentId,
      project_id: projectId,
    });
    results.push(record);
  }
  return results;
}

export interface ScriptAnalyzedAssetBundle {
  characters: ScriptAnalyzedCharacter[];
  scenes: ScriptAnalyzedScene[];
  props: ScriptAnalyzedProp[];
}

export async function listScriptAnalyzedAssets(
  ctx: AppContext,
  documentId: string
): Promise<ScriptAnalyzedAssetBundle> {
  const [characters, scenes, props] = await Promise.all([
    listScriptAnalyzedCharacters(ctx, documentId),
    listScriptAnalyzedScenes(ctx, documentId),
    listScriptAnalyzedProps(ctx, documentId),
  ]);
  return { characters, scenes, props };
}

export async function replaceScriptAnalyzedAssets(
  ctx: AppContext,
  documentId: string,
  projectId: string,
  assets: {
    characters: Array<Omit<ScriptAnalyzedCharacter, "id" | "document_id" | "project_id" | "created_at" | "updated_at">>;
    scenes: Array<Omit<ScriptAnalyzedScene, "id" | "document_id" | "project_id" | "created_at" | "updated_at">>;
    props: Array<Omit<ScriptAnalyzedProp, "id" | "document_id" | "project_id" | "created_at" | "updated_at">>;
  }
): Promise<ScriptAnalyzedAssetBundle> {
  const [characters, scenes, props] = await Promise.all([
    replaceScriptAnalyzedCharacters(ctx, documentId, projectId, assets.characters),
    replaceScriptAnalyzedScenes(ctx, documentId, projectId, assets.scenes),
    replaceScriptAnalyzedProps(ctx, documentId, projectId, assets.props),
  ]);
  return { characters, scenes, props };
}

export async function deleteScriptAnalyzedAssetsByDocument(
  ctx: AppContext,
  documentId: string
): Promise<{ characters: number; scenes: number; props: number }> {
  const [characters, scenes, props] = await Promise.all([
    (await ctx.scriptAnalyzedCharacters.findMany({ document_id: documentId })) as ScriptAnalyzedCharacter[],
    (await ctx.scriptAnalyzedScenes.findMany({ document_id: documentId })) as ScriptAnalyzedScene[],
    (await ctx.scriptAnalyzedProps.findMany({ document_id: documentId })) as ScriptAnalyzedProp[],
  ]);
  for (const c of characters) await ctx.scriptAnalyzedCharacters.delete(c.id);
  for (const s of scenes) await ctx.scriptAnalyzedScenes.delete(s.id);
  for (const p of props) await ctx.scriptAnalyzedProps.delete(p.id);
  return { characters: characters.length, scenes: scenes.length, props: props.length };
}
