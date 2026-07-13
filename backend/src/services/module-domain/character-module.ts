import type { AppContext } from "../app.js";
import type { Character } from "../../types/character.js";
import { id, nowIso } from "../../utils.js";
import { recordVersion } from "./asset-version.js";
import { recordAppLog } from "../audit-log.js";

export type CharacterInput = {
  project_id?: string;
  name?: string;
  role?: string;
  gender?: string;
  age?: number;
  traits?: string[];
  description?: string;
  image?: string;
  tags?: string[];
};

export async function listCharacters(
  ctx: AppContext,
  projectId?: string,
  name?: string,
): Promise<Character[]> {
  const filter: Partial<Character> = { ...(projectId ? { project_id: projectId } : {}) };
  if (name) filter.name = name;
  const items = await ctx.characters.findMany(filter, { sort: "desc" });
  return items.filter((item) => !item.deleted_at);
}

export async function getCharacter(ctx: AppContext, characterId: string): Promise<Character | null> {
  const ch = await ctx.characters.findById(characterId);
  if (!ch || ch.deleted_at) return null;
  return ch;
}

export async function createCharacter(ctx: AppContext, input: CharacterInput): Promise<Character> {
  const projectId = input.project_id ?? "";
  const name = (input.name ?? "").trim();
  if (projectId && name) {
    const existing = await ctx.characters.findMany({ project_id: projectId, name });
    if (existing.length > 0) {
      return existing[0];
    }
  }
  const character: Character = {
    id: id("char"),
    project_id: projectId,
    name,
    role: (input.role as Character["role"]) ?? "supporting",
    gender: input.gender as Character["gender"],
    age: input.age,
    traits: input.traits ?? [],
    description: input.description ?? "",
    image: input.image,
    tags: input.tags ?? [],
    usage_count: 0,
    version: 1,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  await ctx.characters.insert(character);
  await recordVersion(ctx, {
    entityType: "character",
    entityId: character.id,
    entity: character,
    changeType: "create",
  });
  return character;
}

export async function updateCharacter(ctx: AppContext, characterId: string, input: CharacterInput): Promise<Character> {
  const existing = await ctx.characters.findById(characterId);
  if (!existing) throw new Error("角色不存在");
  if (existing.deleted_at) throw new Error("已删除的角色不可编辑");
  const nextVersion = (existing.version ?? 1) + 1;
  const patch: Partial<Character> = {
    ...input,
    role: input.role ? (input.role as Character["role"]) : undefined,
    gender: input.gender ? (input.gender as Character["gender"]) : undefined,
    version: nextVersion,
    updated_at: nowIso(),
  };
  await ctx.characters.update(characterId, patch);
  const updated = { ...existing, ...patch } as Character;
  await recordVersion(ctx, {
    entityType: "character",
    entityId: characterId,
    entity: updated,
    changeType: "update",
    changeNote: `升级到 v${nextVersion}`,
  });
  return updated;
}

export async function deleteCharacter(ctx: AppContext, characterId: string): Promise<void> {
  const existing = await ctx.characters.findById(characterId);
  await ctx.characters.update(characterId, { deleted_at: nowIso() } as Partial<Character>);
  void recordAppLog(ctx, {
    entityType: "character",
    entityId: characterId,
    action: "asset.soft_deleted",
    event: "asset.soft_deleted",
    payload: { assetType: "character" },
    projectId: existing?.project_id,
  });
}

export async function restoreCharacter(ctx: AppContext, characterId: string): Promise<void> {
  const existing = await ctx.characters.findById(characterId);
  await ctx.characters.update(characterId, { deleted_at: "" } as Partial<Character>);
  void recordAppLog(ctx, {
    entityType: "character",
    entityId: characterId,
    action: "asset.restored",
    event: "asset.restored",
    payload: { assetType: "character" },
    projectId: existing?.project_id,
  });
}

export async function listDeletedCharacters(ctx: AppContext, projectId?: string): Promise<Character[]> {
  const filter: Partial<Character> = projectId ? { project_id: projectId } : {};
  const items = await ctx.characters.findMany(filter, { sort: "desc" });
  return items.filter((item) => Boolean(item.deleted_at));
}

export async function permanentDeleteCharacters(ctx: AppContext, ids: string[]): Promise<void> {
  for (const entityId of ids) {
    await ctx.characters.delete(entityId);
  }
}

export async function batchDeleteCharacters(ctx: AppContext, ids: string[]): Promise<void> {
  const ts = nowIso();
  for (const entityId of ids) {
    await ctx.characters.update(entityId, { deleted_at: ts } as Partial<Character>);
  }
}

export async function batchUpdateCharacters(ctx: AppContext, ids: string[], patch: CharacterInput): Promise<void> {
  const partial: Partial<Character> = {
    ...patch,
    role: patch.role ? (patch.role as Character["role"]) : undefined,
    gender: patch.gender ? (patch.gender as Character["gender"]) : undefined,
    updated_at: nowIso(),
  };
  for (const entityId of ids) {
    await ctx.characters.update(entityId, partial);
  }
}
