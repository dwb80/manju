import type { AppContext } from "../app.js";
import type { Character } from "../../types/character.js";
import type { Scene } from "../../types/scene.js";
import type { Prop } from "../../types/prop.js";
import { id, nowIso } from "../../utils.js";
import { recordVersion } from "./asset-version.js";
import { recordAppLog } from "../audit-log.js";

export async function copyCharactersToProjects(
  ctx: AppContext,
  sourceId: string,
  targetProjectIds: string[],
): Promise<{ copied: number; skipped: number; items: Character[] }> {
  const source = await ctx.characters.findById(sourceId);
  if (!source) throw new Error("源角色不存在");
  const now = nowIso();
  const result: Character[] = [];
  let copied = 0;
  let skipped = 0;
  for (const projectId of targetProjectIds) {
    if (!projectId) continue;
    const existing = await ctx.characters.findMany({ project_id: projectId, name: source.name });
    if (existing.length > 0) {
      result.push(existing[0]);
      skipped += 1;
      continue;
    }
    const copy: Character = {
      id: id("char"),
      project_id: projectId,
      name: source.name,
      role: source.role,
      gender: source.gender,
      age: source.age,
      traits: Array.isArray(source.traits) ? [...source.traits] : [],
      description: source.description,
      image: source.image,
      tags: Array.isArray(source.tags) ? [...source.tags] : [],
      usage_count: 0,
      created_at: now,
      updated_at: now,
    };
    await ctx.characters.insert(copy);
    result.push(copy);
    copied += 1;
    await recordVersion(ctx, {
      entityType: "character",
      entityId: copy.id,
      entity: copy,
      changeType: "create",
      changeNote: `cross-project copy from ${sourceId} to ${projectId}`,
    });
  }
  void recordAppLog(ctx, {
    entityType: "character",
    entityId: sourceId,
    action: "asset.copied",
    event: "asset.copied",
    payload: { assetType: "character", sourceId, targetProjectIds, copied, skipped },
    projectId: source.project_id,
  });
  return { copied, skipped, items: result };
}

export async function copyScenesToProjects(
  ctx: AppContext,
  sourceId: string,
  targetProjectIds: string[],
): Promise<{ copied: number; skipped: number; items: Scene[] }> {
  const source = await ctx.scenes.findById(sourceId);
  if (!source) throw new Error("源场景不存在");
  const now = nowIso();
  const result: Scene[] = [];
  let copied = 0;
  let skipped = 0;
  for (const projectId of targetProjectIds) {
    if (!projectId) continue;
    const existing = await ctx.scenes.findMany({ project_id: projectId, name: source.name });
    if (existing.length > 0) {
      result.push(existing[0]);
      skipped += 1;
      continue;
    }
    const copy: Scene = {
      id: id("scene"),
      project_id: projectId,
      name: source.name,
      type: source.type,
      description: source.description,
      image: source.image,
      tags: Array.isArray(source.tags) ? [...source.tags] : [],
      lighting: source.lighting,
      time_of_day: source.time_of_day,
      weather: source.weather,
      usage_count: 0,
      created_at: now,
      updated_at: now,
    };
    await ctx.scenes.insert(copy);
    result.push(copy);
    copied += 1;
    await recordVersion(ctx, {
      entityType: "scene",
      entityId: copy.id,
      entity: copy,
      changeType: "create",
      changeNote: `cross-project copy from ${sourceId} to ${projectId}`,
    });
  }
  return { copied, skipped, items: result };
}

export async function copyPropsToProjects(
  ctx: AppContext,
  sourceId: string,
  targetProjectIds: string[],
): Promise<{ copied: number; skipped: number; items: Prop[] }> {
  const source = await ctx.props.findById(sourceId);
  if (!source) throw new Error("源道具不存在");
  const now = nowIso();
  const result: Prop[] = [];
  let copied = 0;
  let skipped = 0;
  for (const projectId of targetProjectIds) {
    if (!projectId) continue;
    const existing = await ctx.props.findMany({ project_id: projectId, name: source.name });
    if (existing.length > 0) {
      result.push(existing[0]);
      skipped += 1;
      continue;
    }
    const copy: Prop = {
      id: id("prop"),
      project_id: projectId,
      name: source.name,
      category: source.category,
      description: source.description,
      appearance: source.appearance,
      material: source.material,
      size: source.size,
      color: source.color,
      image: source.image,
      tags: Array.isArray(source.tags) ? [...source.tags] : [],
      usage_count: 0,
      created_at: now,
      updated_at: now,
    };
    await ctx.props.insert(copy);
    result.push(copy);
    copied += 1;
    await recordVersion(ctx, {
      entityType: "prop",
      entityId: copy.id,
      entity: copy,
      changeType: "create",
      changeNote: `cross-project copy from ${sourceId} to ${projectId}`,
    });
  }
  void recordAppLog(ctx, {
    entityType: "prop",
    entityId: sourceId,
    action: "asset.copied",
    event: "asset.copied",
    payload: { assetType: "prop", sourceId, targetProjectIds, copied, skipped },
    projectId: source.project_id,
  });
  return { copied, skipped, items: result };
}
