/** 独立模块 CRUD 服务
 *
 * 提供剧本、角色、场景、分镜、音频、资产、审核、视频任务等独立模块的增删查改功能。
 */

import type { AppContext } from "./app.js";
import type { AssetEntityType, AssetVersion, AssetVersionChangeType } from "../types.js";
import type { Script, ScriptDialogue, ScriptScene, ScriptSceneCharacter, ScriptSceneLocation } from "../types/script.js";
import type { Character } from "../types/character.js";
import type { Prop } from "../types/prop.js";
import type { PropCategory } from "../types/prop.js";
import type { Scene } from "../types/scene.js";
import type { Storyboard } from "../types/storyboard.js";
import type { Audio } from "../types/audio.js";
import type { ModuleVideoTask } from "../types/video.js";
import type { ProjectClip } from "../types/project.js";
import type { ProjectStoryboard } from "../types/storyboard.js";
import type { Asset } from "../types/asset.js";
import type { Review } from "../types/review.js";
import { id, nowIso } from "../utils.js";
import { CsvRepository } from "../storage/csv.js";
import { listCharacterTemplates, listSceneTemplates, listPropTemplates } from "./asset-templates.js";

// ==================== 资产版本管理（任务12：统一版本管理） ====================

/** 版本 ID 前缀，方便排查。 */
const VERSION_ID_PREFIX = "av";

/** 把任意实体对象深拷贝为可写入 CSV 的纯 JSON 字符串。 */
function serializeEntity(entity: unknown): string {
  return JSON.stringify(entity ?? null, (_key, value) => (value === undefined ? null : value));
}

/** 查询某实体当前最新的版本号；不存在则返回 0。 */
async function getLatestVersionNumber(
  ctx: AppContext,
  entityType: AssetEntityType,
  entityId: string,
): Promise<number> {
  const versions = await ctx.assetVersions.findMany(
    { entity_type: entityType, entity_id: entityId } as Partial<AssetVersion>,
    { sort: "desc", limit: 1 },
  );
  return versions[0]?.version ?? 0;
}

/**
 * 记录一次资产版本快照。
 *
 * 设计原则：
 * - 异步、容错：调用方应 await 但即使失败也不应阻塞主流程，因此异常仅打印。
 * - 软删除的资产不再记录新版本（依据 deleted_at 判断）。
 * - version 自增，从 1 开始。
 */
export async function recordVersion(
  ctx: AppContext,
  params: {
    entityType: AssetEntityType;
    entityId: string;
    entity: unknown;
    changeType: AssetVersionChangeType;
    changeNote?: string;
    createdBy?: string;
  },
): Promise<AssetVersion | null> {
  const { entityType, entityId, entity, changeType, changeNote, createdBy } = params;
  // 软删除的资产不再记录新版本
  if (entity && typeof entity === "object" && "deleted_at" in entity) {
    const deletedAt = (entity as { deleted_at?: string }).deleted_at;
    if (deletedAt) return null;
  }
  try {
    const latest = await getLatestVersionNumber(ctx, entityType, entityId);
    const nextVersion = latest + 1;
    const version: AssetVersion = {
      id: id(VERSION_ID_PREFIX),
      entity_type: entityType,
      entity_id: entityId,
      version: nextVersion,
      data: serializeEntity(entity),
      change_note: changeNote,
      change_type: changeType,
      created_at: nowIso(),
      created_by: createdBy,
    };
    await ctx.assetVersions.insert(version);
    return version;
  } catch (err) {
    // 版本记录失败不影响主流程，仅打印
    console.error("recordVersion failed:", (err as Error).message);
    return null;
  }
}

/** 列出某资产的全部历史版本，按 version 倒序。 */
export async function listVersions(
  ctx: AppContext,
  entityType: AssetEntityType,
  entityId: string,
): Promise<AssetVersion[]> {
  return ctx.assetVersions.findMany(
    { entity_type: entityType, entity_id: entityId } as Partial<AssetVersion>,
    { sort: "desc" },
  );
}

/** 根据版本 ID 获取单条版本记录。 */
export async function getVersion(ctx: AppContext, versionId: string): Promise<AssetVersion | null> {
  return ctx.assetVersions.findById(versionId);
}

/** 内部：根据 entityType 把版本快照写回到对应实体表。 */
async function writeBackVersion(
  ctx: AppContext,
  entityType: AssetEntityType,
  entityId: string,
  data: Record<string, unknown>,
): Promise<unknown> {
  const ts = nowIso();
  // 强制覆盖时间戳，避免出现"恢复后 updated_at 旧于 created_at"的问题
  data.updated_at = ts;
  switch (entityType) {
    case "character":
      await ctx.characters.update(entityId, data as Partial<Character>);
      return await ctx.characters.findById(entityId);
    case "scene":
      await ctx.scenes.update(entityId, data as Partial<Scene>);
      return await ctx.scenes.findById(entityId);
    case "prop":
      await ctx.props.update(entityId, data as Partial<Prop>);
      return await ctx.props.findById(entityId);
    default:
      throw new Error(`unsupported entity type: ${entityType}`);
  }
}

/**
 * 回滚某条版本到对应实体，并新增一条 restore 类型的版本记录。
 * 不会删除中间版本，保留完整历史。
 */
export async function restoreVersion(ctx: AppContext, versionId: string): Promise<AssetVersion> {
  const version = await ctx.assetVersions.findById(versionId);
  if (!version) throw new Error("版本不存在");
  let snapshot: Record<string, unknown>;
  try {
    const parsed = JSON.parse(version.data);
    if (!parsed || typeof parsed !== "object") throw new Error("invalid snapshot");
    snapshot = parsed as Record<string, unknown>;
  } catch {
    throw new Error("版本快照数据已损坏");
  }
  // 不允许通过版本回滚改写 id / created_at 等关键字段
  const forbidden: string[] = ["id", "created_at"];
  for (const key of forbidden) delete snapshot[key];
  const entityId = version.entity_id;
  await writeBackVersion(ctx, version.entity_type, entityId, snapshot);
  // 用回滚后的最新数据再写一条 restore 版本
  const updated = await (async () => {
    switch (version.entity_type) {
      case "character":
        return await ctx.characters.findById(entityId);
      case "scene":
        return await ctx.scenes.findById(entityId);
      case "prop":
        return await ctx.props.findById(entityId);
      default:
        return null;
    }
  })();
  const restored = await recordVersion(ctx, {
    entityType: version.entity_type,
    entityId,
    entity: updated ?? snapshot,
    changeType: "restore",
    changeNote: `回滚到 v${version.version}`,
  });
  return restored ?? version;
}

// ==================== 剧本模块 ====================

type ScriptInput = {
  project_id?: string;
  title?: string;
  description?: string;
  status?: string;
  words?: number;
  chapters?: number;
  author?: string;
  tags?: string[];
  version?: number;
};

export async function listScripts(ctx: AppContext, projectId?: string): Promise<Script[]> {
  const filter: Partial<Script> = projectId ? { project_id: projectId } : {};
  return ctx.scripts.findMany(filter, { sort: "desc" });
}

export async function createScript(ctx: AppContext, input: ScriptInput): Promise<Script> {
  const script: Script = {
    id: id("script"),
    project_id: input.project_id ?? "",
    title: input.title ?? "",
    description: input.description ?? "",
    status: (input.status as Script["status"]) ?? "draft",
    words: input.words ?? 0,
    chapters: input.chapters ?? 0,
    author: input.author ?? "",
    tags: input.tags ?? [],
    version: input.version ?? 1,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  await ctx.scripts.insert(script);
  return script;
}

export async function updateScript(ctx: AppContext, scriptId: string, input: ScriptInput): Promise<Script> {
  const existing = await ctx.scripts.findById(scriptId);
  if (!existing) throw new Error("剧本不存在");
  const patch: Partial<Script> = {
    ...input,
    status: input.status ? (input.status as Script["status"]) : undefined,
    updated_at: nowIso(),
  };
  await ctx.scripts.update(scriptId, patch);
  return { ...existing, ...patch } as Script;
}

export async function deleteScript(ctx: AppContext, scriptId: string): Promise<void> {
  await ctx.scripts.delete(scriptId);
}

// ==================== 角色模块 ====================

type CharacterInput = {
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

export async function listCharacters(ctx: AppContext, projectId?: string): Promise<Character[]> {
  const filter: Partial<Character> = projectId ? { project_id: projectId } : {};
  const items = await ctx.characters.findMany(filter, { sort: "desc" });
  return items.filter((item) => !item.deleted_at);
}

export async function createCharacter(ctx: AppContext, input: CharacterInput): Promise<Character> {
  // 查重：同一项目下不允许同名角色（避免剧本分析重复流转）
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
  // 任务12：统一版本管理 - 创建后立即记录第一个版本
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
  // 软删除的资产不再记录新版本
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
  // 任务12：统一版本管理 - 每次更新记录一个新版本
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
  await ctx.characters.update(characterId, { deleted_at: nowIso() } as Partial<Character>);
}

/** 恢复被软删除的角色（清空 deleted_at）。 */
export async function restoreCharacter(ctx: AppContext, characterId: string): Promise<void> {
  await ctx.characters.update(characterId, { deleted_at: "" } as Partial<Character>);
}

/** 列出已软删除的角色（仅 deleted_at 非空）。 */
export async function listDeletedCharacters(ctx: AppContext, projectId?: string): Promise<Character[]> {
  const filter: Partial<Character> = projectId ? { project_id: projectId } : {};
  const items = await ctx.characters.findMany(filter, { sort: "desc" });
  return items.filter((item) => Boolean(item.deleted_at));
}

/** 永久删除角色（真删，无法恢复）。 */
export async function permanentDeleteCharacters(ctx: AppContext, ids: string[]): Promise<void> {
  for (const id of ids) {
    await ctx.characters.delete(id);
  }
}

/** 批量软删除角色：依次打 deleted_at 时间戳。 */
export async function batchDeleteCharacters(ctx: AppContext, ids: string[]): Promise<void> {
  const ts = nowIso();
  for (const id of ids) {
    await ctx.characters.update(id, { deleted_at: ts } as Partial<Character>);
  }
}

/** 批量更新角色：把相同 patch 应用到多个角色上。 */
export async function batchUpdateCharacters(ctx: AppContext, ids: string[], patch: CharacterInput): Promise<void> {
  const partial: Partial<Character> = {
    ...patch,
    role: patch.role ? (patch.role as Character["role"]) : undefined,
    gender: patch.gender ? (patch.gender as Character["gender"]) : undefined,
    updated_at: nowIso(),
  };
  for (const id of ids) {
    await ctx.characters.update(id, partial);
  }
}

// ==================== 跨项目资产复制 ====================

/** 跨项目复制角色：把源角色复制到多个目标项目，按名称去重。 */
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
      // 同名资产按"去重"逻辑：返回已有，跳过新建
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
  }
  return { copied, skipped, items: result };
}

/** 跨项目复制场景：把源场景复制到多个目标项目，按名称去重。 */
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
  }
  return { copied, skipped, items: result };
}

/** 跨项目复制道具：把源道具复制到多个目标项目，按名称去重。 */
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
  }
  return { copied, skipped, items: result };
}

// ==================== 场景模块 ====================

type SceneInput = {
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

export async function listScenes(ctx: AppContext, projectId?: string): Promise<Scene[]> {
  const filter: Partial<Scene> = projectId ? { project_id: projectId } : {};
  const items = await ctx.scenes.findMany(filter, { sort: "desc" });
  return items.filter((item) => !item.deleted_at);
}

export async function createScene(ctx: AppContext, input: SceneInput): Promise<Scene> {
  // 查重：同一项目下不允许同名场景（避免剧本分析重复流转）
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
  // 任务12：统一版本管理 - 创建后立即记录第一个版本
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
  // 软删除的资产不再记录新版本
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
  // 任务12：统一版本管理 - 每次更新记录一个新版本
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
  await ctx.scenes.update(sceneId, { deleted_at: nowIso() } as Partial<Scene>);
}

/** 恢复被软删除的场景（清空 deleted_at）。 */
export async function restoreScene(ctx: AppContext, sceneId: string): Promise<void> {
  await ctx.scenes.update(sceneId, { deleted_at: "" } as Partial<Scene>);
}

/** 列出已软删除的场景。 */
export async function listDeletedScenes(ctx: AppContext, projectId?: string): Promise<Scene[]> {
  const filter: Partial<Scene> = projectId ? { project_id: projectId } : {};
  const items = await ctx.scenes.findMany(filter, { sort: "desc" });
  return items.filter((item) => Boolean(item.deleted_at));
}

/** 永久删除场景（真删，无法恢复）。 */
export async function permanentDeleteScenes(ctx: AppContext, ids: string[]): Promise<void> {
  for (const id of ids) {
    await ctx.scenes.delete(id);
  }
}

/** 批量软删除场景。 */
export async function batchDeleteScenes(ctx: AppContext, ids: string[]): Promise<void> {
  const ts = nowIso();
  for (const id of ids) {
    await ctx.scenes.update(id, { deleted_at: ts } as Partial<Scene>);
  }
}

/** 批量更新场景。 */
export async function batchUpdateScenes(ctx: AppContext, ids: string[], patch: SceneInput): Promise<void> {
  const partial: Partial<Scene> = {
    ...patch,
    type: patch.type ? (patch.type as Scene["type"]) : undefined,
    updated_at: nowIso(),
  };
  for (const id of ids) {
    await ctx.scenes.update(id, partial);
  }
}

// ==================== 道具模块 CRUD ====================

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

export async function listProps(ctx: AppContext, projectId?: string): Promise<Prop[]> {
  const filter: Partial<Prop> = projectId ? { project_id: projectId } : {};
  const items = await ctx.props.findMany(filter, { sort: "desc" });
  return items.filter((item) => !item.deleted_at);
}

export async function createProp(ctx: AppContext, input: PropInput): Promise<Prop> {
  // 查重：同一项目下不允许同名道具（避免剧本分析重复流转）
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
  // 任务12：统一版本管理 - 创建后立即记录第一个版本
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
  // 软删除的资产不再记录新版本
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
  // 任务12：统一版本管理 - 每次更新记录一个新版本
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

/** 恢复被软删除的道具（清空 deleted_at）。 */
export async function restoreProp(ctx: AppContext, propId: string): Promise<void> {
  const existing = await ctx.props.findById(propId);
  if (!existing) throw new Error("道具不存在");
  await ctx.props.update(propId, { deleted_at: "" } as Partial<Prop>);
}

/** 列出已软删除的道具。 */
export async function listDeletedProps(ctx: AppContext, projectId?: string): Promise<Prop[]> {
  const filter: Partial<Prop> = projectId ? { project_id: projectId } : {};
  const items = await ctx.props.findMany(filter, { sort: "desc" });
  return items.filter((item) => Boolean(item.deleted_at));
}

/** 永久删除道具（真删，无法恢复）。 */
export async function permanentDeleteProps(ctx: AppContext, ids: string[]): Promise<void> {
  for (const id of ids) {
    await ctx.props.delete(id);
  }
}

// ==================== 资产引用关系查询 ====================

/** 引用清单中条目的统一结构：哪个剧本/分镜/对白引用了资产。 */
export type UsageReferenceItem = {
  /** 引用来源类型：script / storyboard / dialogue / scene_character / scene_location */
  type: "script" | "storyboard" | "dialogue" | "scene_character" | "scene_location" | "script_center";
  /** 引用方 ID。 */
  id: string;
  /** 引用方展示标题（剧本名/分镜标题/对白片段等）。 */
  title: string;
  /** 关联项目 ID（如果有）。 */
  project_id?: string;
  /** 关联剧集/分镜/场景等附加信息。 */
  context?: string;
  /** 所属集数（已知时填入，用于前端汇总"出场 N 集"）。 */
  episode?: number;
};

/** 资产引用统计返回结构。 */
export type AssetUsage = {
  /** 资产 ID。 */
  id: string;
  /** 被引用总次数（去重后的引用方数量）。 */
  total: number;
  /** 引用方按类型分组。 */
  storyboards: UsageReferenceItem[];
  scripts: UsageReferenceItem[];
  dialogues: UsageReferenceItem[];
  sceneCharacters: UsageReferenceItem[];
  sceneLocations: UsageReferenceItem[];
  /** 给前端徽标使用的快捷引用次数（含所有类型）。 */
  usage_count: number;
};

/** 根据 ID 列表把 SQLite 行的 JSON 字符串反序列化为字符串数组。 */
function decodeIdList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value !== "string" || value.length === 0) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

/** 在剧本/分镜文本中查找名称出现次数（用于 name 引用回溯）。 */
function countNameOccurrences(text: string | undefined, name: string): number {
  if (!text || !name) return 0;
  let count = 0;
  let index = 0;
  while (true) {
    const found = text.indexOf(name, index);
    if (found < 0) break;
    count += 1;
    index = found + name.length;
  }
  return count;
}

/** 汇总引用清单并回填 usage_count 缓存字段。 */
async function finalizeUsage(
  ctx: AppContext,
  repo: { update: (id: string, patch: Record<string, unknown>) => Promise<void> },
  entityId: string,
  parts: Omit<AssetUsage, "id" | "total" | "usage_count">,
): Promise<AssetUsage> {
  const storyboards = parts.storyboards;
  const scripts = parts.scripts;
  const dialogues = parts.dialogues;
  const sceneCharacters = parts.sceneCharacters;
  const sceneLocations = parts.sceneLocations;
  const total = storyboards.length + scripts.length + dialogues.length + sceneCharacters.length + sceneLocations.length;
  // 同步回填 usage_count，方便后续列表查询使用缓存字段。
  try {
    await repo.update(entityId, { usage_count: total, updated_at: new Date().toISOString() } as Record<string, unknown>);
  } catch {
    // 兼容未迁移或权限异常情况下的容错，不影响引用查询主流程。
  }
  return {
    id: entityId,
    total,
    storyboards,
    scripts,
    dialogues,
    sceneCharacters,
    sceneLocations,
    usage_count: total,
  };
}

/** 查询某个角色被剧本/分镜/对白/场景-角色引用表引用的清单。 */
export async function getCharacterUsage(ctx: AppContext, characterId: string): Promise<AssetUsage> {
  const character = await ctx.characters.findById(characterId);
  if (!character) throw new Error("角色不存在");

  // 1. 剧本中心 - 场景-角色引用（通过 character_asset_id 直接关联）
  const allSceneCharRefs = await ctx.scriptSceneCharacters.findMany({});
  const directSceneCharRefs = allSceneCharRefs.filter((ref) => ref.character_asset_id === characterId);
  const sceneIds = Array.from(new Set(directSceneCharRefs.map((ref) => ref.scene_id)));
  const allScriptScenes = sceneIds.length > 0
    ? (await ctx.scriptScenes.findMany({})).filter((sc) => sceneIds.includes(sc.id))
    : [];
  const sceneCharacters: UsageReferenceItem[] = directSceneCharRefs.map((ref) => {
    const scene = allScriptScenes.find((sc) => sc.id === ref.scene_id);
    return {
      type: "scene_character",
      id: ref.id,
      title: scene ? `场景 ${scene.scene_no} · ${scene.location_name}` : `场景引用 ${ref.id}`,
      project_id: ref.project_id,
      context: scene?.description || "",
    };
  });

  // 2. 剧本中心 - 对白引用（通过 character_id 直接关联）
  const allDialogues = await ctx.scriptDialogues.findMany({ character_id: characterId } as Partial<ScriptDialogue>);
  const allDialogueSceneIds = Array.from(new Set(allDialogues.map((d) => d.scene_id)));
  const dialogueScenes = allDialogueSceneIds.length > 0
    ? (await ctx.scriptScenes.findMany({})).filter((sc) => allDialogueSceneIds.includes(sc.id))
    : [];
  const dialogues: UsageReferenceItem[] = allDialogues.map((d) => {
    const scene = dialogueScenes.find((sc) => sc.id === d.scene_id);
    return {
      type: "dialogue",
      id: d.id,
      title: scene ? `对白 · ${scene.location_name}` : "对白",
      project_id: d.project_id,
      context: d.dialogue,
    };
  });

  // 3. 独立模块 - 分镜（通过对白文本模糊匹配角色名作为兜底引用）
  const allStoryboards = await ctx.storyboards.findMany({ project_id: character.project_id } as Partial<Storyboard>);
  const matchedStoryboards = allStoryboards.filter((sb) => countNameOccurrences(sb.dialogue, character.name) > 0);
  const storyboards: UsageReferenceItem[] = matchedStoryboards.map((sb) => ({
    type: "storyboard",
    id: sb.id,
    title: sb.description?.slice(0, 30) || `分镜 #${sb.shot_number}`,
    project_id: sb.project_id,
    context: sb.dialogue,
    episode: sb.episode,
  }));

  // 4. 项目工作台 - 分镜（通过 character_asset_ids 数组直接匹配）
  const allProjectStoryboards = await ctx.projectStoryboards.findMany({ project_id: character.project_id } as Partial<ProjectStoryboard>);
  const projectStoryboardRefs = allProjectStoryboards.filter((sb) => decodeIdList(sb.character_asset_ids).includes(characterId));
  for (const sb of projectStoryboardRefs) {
    storyboards.push({
      type: "storyboard",
      id: sb.id,
      title: sb.title || `分镜 ${sb.episode}-${sb.scene}-${sb.shot}`,
      project_id: sb.project_id,
      context: sb.description,
      episode: sb.episode,
    });
  }

  // 5. 剧本（独立模块） - 文本中提及角色名视为引用
  const allScripts = await ctx.scripts.findMany({ project_id: character.project_id } as Partial<Script>);
  const matchedScripts = allScripts.filter((script) => {
    return countNameOccurrences(script.title, character.name) > 0
      || countNameOccurrences(script.description, character.name) > 0;
  });
  const scripts: UsageReferenceItem[] = matchedScripts.map((script) => ({
    type: "script",
    id: script.id,
    title: script.title,
    project_id: script.project_id,
    context: script.description,
  }));

  return await finalizeUsage(ctx, ctx.characters as unknown as { update: (id: string, patch: Record<string, unknown>) => Promise<void> }, characterId, {
    storyboards,
    scripts,
    dialogues,
    sceneCharacters,
    sceneLocations: [],
  });
}

/** 查询某个场景被分镜/项目分镜/场景-地点引用表引用的清单。 */
export async function getSceneUsage(ctx: AppContext, sceneId: string): Promise<AssetUsage> {
  const scene = await ctx.scenes.findById(sceneId);
  if (!scene) throw new Error("场景不存在");

  // 1. 独立模块 - 分镜（通过 scene_id 直接关联）
  const allStoryboards = await ctx.storyboards.findMany({ scene_id: sceneId } as Partial<Storyboard>);
  const storyboards: UsageReferenceItem[] = allStoryboards.map((sb) => ({
    type: "storyboard",
    id: sb.id,
    title: sb.description?.slice(0, 30) || `分镜 #${sb.shot_number}`,
    project_id: sb.project_id,
    context: sb.dialogue,
    episode: sb.episode,
  }));

  // 2. 项目工作台 - 分镜（通过 scene_asset_id 直接关联）
  const allProjectStoryboards = await ctx.projectStoryboards.findMany({ project_id: scene.project_id } as Partial<ProjectStoryboard>);
  const projectStoryboardRefs = allProjectStoryboards.filter((sb) => sb.scene_asset_id === sceneId);
  for (const sb of projectStoryboardRefs) {
    storyboards.push({
      type: "storyboard",
      id: sb.id,
      title: sb.title || `分镜 ${sb.episode}-${sb.scene}-${sb.shot}`,
      project_id: sb.project_id,
      context: sb.description,
      episode: sb.episode,
    });
  }

  // 3. 剧本中心 - 场景-地点引用（通过 location_asset_id 直接关联）
  const allSceneLocRefs = await ctx.scriptSceneLocations.findMany({});
  const directSceneLocRefs = allSceneLocRefs.filter((ref) => ref.location_asset_id === sceneId);
  const locSceneIds = Array.from(new Set(directSceneLocRefs.map((ref) => ref.scene_id)));
  const locScenes = locSceneIds.length > 0
    ? (await ctx.scriptScenes.findMany({})).filter((sc) => locSceneIds.includes(sc.id))
    : [];
  const sceneLocations: UsageReferenceItem[] = directSceneLocRefs.map((ref) => {
    const sc = locScenes.find((item) => item.id === ref.scene_id);
    return {
      type: "scene_location",
      id: ref.id,
      title: sc ? `场景 ${sc.scene_no} · ${sc.location_name}` : `场景地点引用 ${ref.id}`,
      project_id: ref.project_id,
      context: sc?.description || "",
    };
  });

  // 4. 剧本（独立模块） - 文本中提及场景名视为引用
  const allScripts = await ctx.scripts.findMany({ project_id: scene.project_id } as Partial<Script>);
  const matchedScripts = allScripts.filter((script) => {
    return countNameOccurrences(script.title, scene.name) > 0
      || countNameOccurrences(script.description, scene.name) > 0;
  });
  const scripts: UsageReferenceItem[] = matchedScripts.map((script) => ({
    type: "script",
    id: script.id,
    title: script.title,
    project_id: script.project_id,
    context: script.description,
  }));

  return await finalizeUsage(ctx, ctx.scenes as unknown as { update: (id: string, patch: Record<string, unknown>) => Promise<void> }, sceneId, {
    storyboards,
    scripts,
    dialogues: [],
    sceneCharacters: [],
    sceneLocations,
  });
}

/** 查询某个道具被剧本文本引用的清单（道具无强外键关联，按名称回溯）。 */
export async function getPropUsage(ctx: AppContext, propId: string): Promise<AssetUsage> {
  const prop = await ctx.props.findById(propId);
  if (!prop) throw new Error("道具不存在");

  // 1. 剧本（独立模块） - 文本中提及道具名视为引用
  const allScripts = await ctx.scripts.findMany({ project_id: prop.project_id } as Partial<Script>);
  const matchedScripts = allScripts.filter((script) => {
    return countNameOccurrences(script.title, prop.name) > 0
      || countNameOccurrences(script.description, prop.name) > 0;
  });
  const scripts: UsageReferenceItem[] = matchedScripts.map((script) => ({
    type: "script",
    id: script.id,
    title: script.title,
    project_id: script.project_id,
    context: script.description,
  }));

  // 2. 独立模块 - 分镜（按名称模糊匹配 description/dialogue）
  const allStoryboards = await ctx.storyboards.findMany({ project_id: prop.project_id } as Partial<Storyboard>);
  const matchedStoryboards = allStoryboards.filter((sb) => {
    return countNameOccurrences(sb.description, prop.name) > 0
      || countNameOccurrences(sb.dialogue, prop.name) > 0;
  });
  const storyboards: UsageReferenceItem[] = matchedStoryboards.map((sb) => ({
    type: "storyboard",
    id: sb.id,
    title: sb.description?.slice(0, 30) || `分镜 #${sb.shot_number}`,
    project_id: sb.project_id,
    context: sb.dialogue,
    episode: sb.episode,
  }));

  return await finalizeUsage(ctx, ctx.props as unknown as { update: (id: string, patch: Record<string, unknown>) => Promise<void> }, propId, {
    storyboards,
    scripts,
    dialogues: [],
    sceneCharacters: [],
    sceneLocations: [],
  });
}

/** 批量软删除道具。 */
export async function batchDeleteProps(ctx: AppContext, ids: string[]): Promise<void> {
  const ts = nowIso();
  for (const id of ids) {
    await ctx.props.update(id, { deleted_at: ts } as Partial<Prop>);
  }
}

/** 批量更新道具。 */
export async function batchUpdateProps(ctx: AppContext, ids: string[], patch: PropInput): Promise<void> {
  const partial: Partial<Prop> = {
    ...patch,
    category: patch.category ? (patch.category as Prop["category"]) : undefined,
    updated_at: nowIso(),
  };
  for (const id of ids) {
    await ctx.props.update(id, partial);
  }
}

// ==================== 分镜模块 ====================

type StoryboardInput = {
  project_id?: string;
  scene_id?: string;
  episode?: number;
  shot_number?: number;
  title?: string;
  description?: string;
  duration?: number;
  camera_angle?: string;
  movement?: string;
  dialogue?: string;
  notes?: string;
  image_url?: string;
  video_task_id?: string;
  video_url?: string;
  status?: string;
  tags?: string[];
  order?: number;
};

export async function listStoryboards(ctx: AppContext, projectId?: string): Promise<Storyboard[]> {
  const filter: Partial<Storyboard> = projectId ? { project_id: projectId } : {};
  const items = await ctx.storyboards.findMany(filter, { sort: "desc" });
  return items.filter((item) => !item.deleted_at);
}

export async function createStoryboard(ctx: AppContext, input: StoryboardInput): Promise<Storyboard> {
  const storyboard: Storyboard = {
    id: id("sb"),
    project_id: input.project_id ?? "",
    scene_id: input.scene_id ?? "",
    episode: input.episode ?? 1,
    shot_number: input.shot_number ?? 1,
    title: input.title ?? input.description ?? "",
    description: input.description ?? "",
    duration: input.duration ?? 0,
    camera_angle: input.camera_angle,
    movement: input.movement,
    dialogue: input.dialogue,
    notes: input.notes,
    image_url: input.image_url ?? "",
    video_task_id: input.video_task_id ?? "",
    video_url: input.video_url ?? "",
    status: (input.status as Storyboard["status"]) ?? "draft",
    tags: input.tags ?? [],
    order: input.order ?? 0,
    usage_count: 0,
    version: 1,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  await ctx.storyboards.insert(storyboard);
  return storyboard;
}

export async function updateStoryboard(ctx: AppContext, storyboardId: string, input: StoryboardInput): Promise<Storyboard> {
  const existing = await ctx.storyboards.findById(storyboardId);
  if (!existing) throw new Error("分镜不存在");
  const patch: Partial<Storyboard> = {
    ...input,
    status: input.status ? (input.status as Storyboard["status"]) : undefined,
    updated_at: nowIso(),
  };
  await ctx.storyboards.update(storyboardId, patch);
  return { ...existing, ...patch } as Storyboard;
}

export async function deleteStoryboard(ctx: AppContext, storyboardId: string): Promise<void> {
  await ctx.storyboards.delete(storyboardId);
}

// ==================== 音频模块 ====================

type AudioInput = {
  project_id?: string;
  name?: string;
  type?: string;
  description?: string;
  duration?: number;
  file_url?: string;
  speaker?: string;
  character_id?: string;
  storyboard_id?: string;
  episode?: number;
  tags?: string[];
  format?: string;
  size?: number;
};

export async function listAudios(ctx: AppContext, projectId?: string): Promise<Audio[]> {
  const filter: Partial<Audio> = projectId ? { project_id: projectId } : {};
  const items = await ctx.audios.findMany(filter, { sort: "desc" });
  return items.filter((item) => !item.deleted_at);
}

export async function createAudio(ctx: AppContext, input: AudioInput): Promise<Audio> {
  const audio: Audio = {
    id: id("audio"),
    project_id: input.project_id ?? "",
    name: input.name ?? "",
    type: (input.type as Audio["type"]) ?? "voiceover",
    description: input.description ?? "",
    duration: input.duration ?? 0,
    file_url: input.file_url ?? "",
    speaker: input.speaker ?? "",
    character_id: input.character_id ?? "",
    storyboard_id: input.storyboard_id ?? "",
    episode: input.episode ?? 1,
    tags: input.tags ?? [],
    format: input.format ?? "",
    size: input.size ?? 0,
    usage_count: 0,
    version: 1,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  await ctx.audios.insert(audio);
  return audio;
}

export async function updateAudio(ctx: AppContext, audioId: string, input: AudioInput): Promise<Audio> {
  const existing = await ctx.audios.findById(audioId);
  if (!existing) throw new Error("音频不存在");
  const patch: Partial<Audio> = {
    ...input,
    type: input.type ? (input.type as Audio["type"]) : undefined,
    updated_at: nowIso(),
  };
  await ctx.audios.update(audioId, patch);
  return { ...existing, ...patch } as Audio;
}

export async function deleteAudio(ctx: AppContext, audioId: string): Promise<void> {
  await ctx.audios.delete(audioId);
}

// ==================== 资产模块 ====================

type AssetInput = {
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

// ==================== 审核模块 ====================

type ReviewInput = {
  project_id?: string;
  content_type?: string;
  content_id?: string;
  content_title?: string;
  result?: string;
  score?: number;
  comment?: string;
  reviewer_id?: string;
  reviewer_name?: string;
};

export async function listReviews(ctx: AppContext, projectId?: string): Promise<Review[]> {
  const filter: Partial<Review> = projectId ? { project_id: projectId } : {};
  return ctx.reviews.findMany(filter, { sort: "desc" });
}

export async function createReview(ctx: AppContext, input: ReviewInput): Promise<Review> {
  const review: Review = {
    id: id("review"),
    project_id: input.project_id ?? "",
    content_type: (input.content_type as Review["content_type"]) ?? "image",
    content_id: input.content_id ?? "",
    content_title: input.content_title ?? "",
    result: (input.result as Review["result"]) ?? "pending",
    score: input.score,
    comment: input.comment,
    reviewer_id: input.reviewer_id ?? "",
    reviewer_name: input.reviewer_name ?? "",
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  await ctx.reviews.insert(review);
  return review;
}

export async function updateReview(ctx: AppContext, reviewId: string, input: ReviewInput): Promise<Review> {
  const existing = await ctx.reviews.findById(reviewId);
  if (!existing) throw new Error("审核不存在");
  const patch: Partial<Review> = {
    ...input,
    content_type: input.content_type ? (input.content_type as Review["content_type"]) : undefined,
    result: input.result ? (input.result as Review["result"]) : undefined,
    updated_at: nowIso(),
  };
  await ctx.reviews.update(reviewId, patch);
  return { ...existing, ...patch } as Review;
}

export async function deleteReview(ctx: AppContext, reviewId: string): Promise<void> {
  await ctx.reviews.delete(reviewId);
}

// ==================== 视频任务模块 ====================

type ModuleVideoTaskInput = {
  project_id?: string;
  storyboard_id?: string;
  title?: string;
  prompt?: string;
  image_url?: string;
  params?: any;
  ai_task_id?: string;
  status?: string;
  progress?: number;
  duration?: number;
  resolution?: string;
  fps?: number;
  format?: string;
  file_url?: string;
  episode?: number;
  tags?: string[];
  error?: string;
};

export async function listModuleVideoTasks(ctx: AppContext, projectId?: string): Promise<ModuleVideoTask[]> {
  const filter: Partial<ModuleVideoTask> = projectId ? { project_id: projectId } : {};
  const items = await ctx.moduleVideoTasks.findMany(filter, { sort: "desc" });
  return items.filter((item) => !item.deleted_at);
}

export async function createModuleVideoTask(ctx: AppContext, input: ModuleVideoTaskInput): Promise<ModuleVideoTask> {
  const task: ModuleVideoTask = {
    id: id("vt"),
    project_id: input.project_id ?? "",
    storyboard_id: input.storyboard_id ?? "",
    title: input.title ?? "",
    prompt: input.prompt ?? "",
    image_url: input.image_url ?? "",
    params: input.params ?? {},
    ai_task_id: input.ai_task_id ?? "",
    status: (input.status as ModuleVideoTask["status"]) ?? "queued",
    progress: input.progress ?? 0,
    duration: input.duration ?? 0,
    resolution: input.resolution ?? "",
    fps: input.fps ?? 0,
    format: input.format ?? "",
    file_url: input.file_url ?? "",
    episode: input.episode ?? 1,
    tags: input.tags ?? [],
    error: input.error ?? "",
    usage_count: 0,
    version: 1,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  await ctx.moduleVideoTasks.insert(task);
  return task;
}

export async function updateModuleVideoTask(ctx: AppContext, taskId: string, input: ModuleVideoTaskInput): Promise<ModuleVideoTask> {
  const existing = await ctx.moduleVideoTasks.findById(taskId);
  if (!existing) throw new Error("视频任务不存在");
  const patch: Partial<ModuleVideoTask> = {
    ...input,
    status: input.status ? (input.status as ModuleVideoTask["status"]) : undefined,
    updated_at: nowIso(),
  };
  await ctx.moduleVideoTasks.update(taskId, patch);
  return { ...existing, ...patch } as ModuleVideoTask;
}

export async function deleteModuleVideoTask(ctx: AppContext, taskId: string): Promise<void> {
  await ctx.moduleVideoTasks.delete(taskId);
}

// ==================== 软删除 / 回收站 / 跨项目复制（工业化平台 P0-2 / P0-5） ====================

/**
 * 通用软删除：将记录标记为 deleted_at，物理不删除，5 秒撤销期内可恢复。
 * 用于分镜 / 音频 / 视频 / 剪辑 4 个独立模块。
 */
async function softDelete(ctx: AppContext, repo: CsvRepository<any>, id: string): Promise<{ id: string }> {
  const existing = await repo.findById(id);
  if (!existing) throw new Error("记录不存在");
  const deletedAt = nowIso();
  await repo.update(id, { deleted_at: deletedAt, updated_at: deletedAt } as any);
  return { id, deleted_at: deletedAt } as any;
}

/** 恢复软删除：清空 deleted_at。 */
async function restoreDeleted(ctx: AppContext, repo: CsvRepository<any>, id: string): Promise<void> {
  const existing = await repo.findById(id);
  if (!existing) throw new Error("记录不存在或已被永久删除");
  const restoredAt = nowIso();
  await repo.update(id, { deleted_at: "", updated_at: restoredAt } as any);
}

/** 列出回收站中的软删除记录。 */
async function listDeletedInRepo(repo: CsvRepository<any>, projectId?: string): Promise<any[]> {
  const filter: any = projectId ? { project_id: projectId } : {};
  const all = await repo.findMany(filter);
  return all.filter((it: any) => !!it.deleted_at);
}

/** 永久删除。 */
async function permanentDelete(ctx: AppContext, repo: CsvRepository<any>, id: string): Promise<void> {
  await repo.delete(id);
}

/** 跨项目复制。 */
async function copyToProject<T extends { id: string; project_id: string; created_at: string; name?: string; title?: string }>(
  ctx: AppContext,
  repo: CsvRepository<T>,
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

// 分镜
export const softDeleteStoryboard = (ctx: AppContext, id: string) => softDelete(ctx, ctx.storyboards, id);
export const restoreStoryboard = (ctx: AppContext, id: string) => restoreDeleted(ctx, ctx.storyboards, id);
export const listDeletedStoryboards = (ctx: AppContext, projectId?: string) => listDeletedInRepo(ctx.storyboards, projectId);
export const permanentDeleteStoryboard = (ctx: AppContext, id: string) => permanentDelete(ctx, ctx.storyboards, id);
export const copyStoryboardToProject = (ctx: AppContext, id: string, projectId: string) =>
  copyToProject(ctx, ctx.storyboards, id, projectId);

// 音频
export const softDeleteAudio = (ctx: AppContext, id: string) => softDelete(ctx, ctx.audios, id);
export const restoreAudio = (ctx: AppContext, id: string) => restoreDeleted(ctx, ctx.audios, id);
export const listDeletedAudios = (ctx: AppContext, projectId?: string) => listDeletedInRepo(ctx.audios, projectId);
export const permanentDeleteAudio = (ctx: AppContext, id: string) => permanentDelete(ctx, ctx.audios, id);
export const copyAudioToProject = (ctx: AppContext, id: string, projectId: string) =>
  copyToProject(ctx, ctx.audios, id, projectId);

// 视频任务
export const softDeleteVideo = (ctx: AppContext, id: string) => softDelete(ctx, ctx.moduleVideoTasks, id);
export const restoreVideo = (ctx: AppContext, id: string) => restoreDeleted(ctx, ctx.moduleVideoTasks, id);
export const listDeletedVideos = (ctx: AppContext, projectId?: string) => listDeletedInRepo(ctx.moduleVideoTasks, projectId);
export const permanentDeleteVideo = (ctx: AppContext, id: string) => permanentDelete(ctx, ctx.moduleVideoTasks, id);
export const copyVideoToProject = (ctx: AppContext, id: string, projectId: string) =>
  copyToProject(ctx, ctx.moduleVideoTasks, id, projectId);

// 剪辑
export const softDeleteClip = (ctx: AppContext, id: string) => softDelete(ctx, ctx.projectClips, id);
export const restoreClip = (ctx: AppContext, id: string) => restoreDeleted(ctx, ctx.projectClips, id);
export const listDeletedClips = (ctx: AppContext, projectId?: string) => listDeletedInRepo(ctx.projectClips, projectId);
export const permanentDeleteClip = (ctx: AppContext, id: string) => permanentDelete(ctx, ctx.projectClips, id);
export const copyClipToProject = (ctx: AppContext, id: string, projectId: string) =>
  copyToProject(ctx, ctx.projectClips, id, projectId);

// ==================== 视频任务：重试 / 重新生成 / 状态轮询（工业化 P0-1 / P1-1） ====================

/** 把外部 AI 任务的状态写回本地任务记录（轮询调用）。 */
export async function syncVideoTaskStatus(
  ctx: AppContext,
  taskId: string,
  remoteStatus: { status: string; progress?: number; file_url?: string; error?: string }
): Promise<ModuleVideoTask> {
  const existing = await ctx.moduleVideoTasks.findById(taskId);
  if (!existing) throw new Error("视频任务不存在");
  const patch: Partial<ModuleVideoTask> = {
    status: remoteStatus.status as ModuleVideoTask["status"],
    progress: remoteStatus.progress ?? existing.progress,
    file_url: remoteStatus.file_url ?? existing.file_url,
    error: remoteStatus.error ?? "",
    updated_at: nowIso(),
  };
  await ctx.moduleVideoTasks.update(taskId, patch);
  return { ...existing, ...patch } as ModuleVideoTask;
}

/** 把失败任务重新置为 queued（重试），复用同一 AI task id（如果 Agnes 任务还可查）。 */
export async function retryVideoTask(ctx: AppContext, taskId: string): Promise<ModuleVideoTask> {
  const existing = await ctx.moduleVideoTasks.findById(taskId);
  if (!existing) throw new Error("视频任务不存在");
  if (existing.status === "completed") throw new Error("已完成的任务不能重试");
  const patch: Partial<ModuleVideoTask> = {
    status: "queued",
    progress: 0,
    error: "",
    updated_at: nowIso(),
  };
  await ctx.moduleVideoTasks.update(taskId, patch);
  return { ...existing, ...patch } as ModuleVideoTask;
}

/** 重新生成：基于当前 prompt/image 重新调用 AI（生成新的 ai_task_id）。 */
export async function regenerateVideo(ctx: AppContext, taskId: string): Promise<ModuleVideoTask> {
  const existing = await ctx.moduleVideoTasks.findById(taskId);
  if (!existing) throw new Error("视频任务不存在");
  const patch: Partial<ModuleVideoTask> = {
    status: "queued",
    progress: 0,
    file_url: "",
    error: "",
    updated_at: nowIso(),
  };
  await ctx.moduleVideoTasks.update(taskId, patch);
  return { ...existing, ...patch } as ModuleVideoTask;
}

// ==================== 一键：从分镜生成视频（工业化 P0-1） ====================

/**
 * 工业流水线：分镜 → 视频。
 * 1. 调用 agnes-client.generateVideo 提交 AI 任务。
 * 2. 在 module_video_tasks 中创建一条对应记录，回填 storyboard.video_task_id。
 * 3. 返回新任务 id（前端用于轮询状态）。
 */
export async function generateVideoFromStoryboard(
  ctx: AppContext,
  storyboardId: string,
  options: { ratio?: string; duration?: number; num_inference_steps?: number } = {}
): Promise<{ videoTask: ModuleVideoTask; remoteTaskId: string }> {
  const storyboard = await ctx.storyboards.findById(storyboardId);
  if (!storyboard) throw new Error("分镜不存在");
  if (!storyboard.description) throw new Error("分镜描述为空，无法生成视频");
  const params: any = {
    prompt: storyboard.description,
    image: storyboard.image_url || undefined,
    ratio: (options.ratio as any) ?? "16:9",
    duration: (options.duration as any) ?? 5,
    num_inference_steps: options.num_inference_steps ?? 30,
    mode: storyboard.image_url ? "ti2vid" : undefined,
  };
  const result = await ctx.ai.generateVideo(params);
  const aiTaskId = ((result as any).taskId || (result as any).id) ?? "";
  const task = await createModuleVideoTask(ctx, {
    project_id: storyboard.project_id,
    storyboard_id: storyboard.id,
    title: storyboard.title || `分镜 ${storyboard.shot_number} 视频`,
    prompt: storyboard.description,
    image_url: storyboard.image_url ?? "",
    params,
    ai_task_id: aiTaskId,
    status: "processing",
    progress: 0,
    duration: options.duration ?? 5,
    resolution: options.ratio ?? "16:9",
    format: "mp4",
    episode: storyboard.episode,
  });
  await ctx.storyboards.update(storyboard.id, {
    video_task_id: task.id,
    status: "production",
    updated_at: nowIso(),
  } as any);
  return { videoTask: task, remoteTaskId: aiTaskId };
}

// ==================== TTS：AI 配音（工业化 P1-2） ====================

/**
 * 工业流水线：剧本对白 → AI 配音。
 * Agnes 暂时不直接支持 TTS，本实现做"占位"处理：
 * 1. 根据台词、说话人、情绪生成 prompt；
 * 2. 调用 agnes generateVideo 占位（不推荐），改为本地：仅创建一个占位 audio 记录并标记 file_url 为空，让前端可以感知状态。
 * 3. 后续可替换为真正的 TTS API（ElevenLabs/字节/阿里 TTS）。
 */
export async function generateTTS(
  ctx: AppContext,
  input: {
    project_id: string;
    text: string;
    speaker: string;
    character_id?: string;
    storyboard_id?: string;
    emotion?: string;
    voice?: string;
  }
): Promise<Audio> {
  const result = await ctx.ai.generateTTS({
    text: input.text,
    voice: input.voice ?? "default",
    emotion: input.emotion ?? "neutral",
  });
  return createAudio(ctx, {
    project_id: input.project_id,
    name: `${input.speaker || "配音"}-${(input.text || "").slice(0, 12)}`,
    type: "voiceover",
    description: input.text,
    duration: 0,
    file_url: result.file_url ?? "",
    speaker: input.speaker,
    character_id: input.character_id,
    storyboard_id: input.storyboard_id,
    format: "mp3",
    size: 0,
  });
}

// ==================== 出现次数聚合（工业化 P2-2） ====================

/** 角色出现次数：在分镜侧（dialogue 含角色名）+ 音频侧（speaker/character_id）合并计数。 */
export async function getCharacterAppearances(ctx: AppContext, characterId: string): Promise<{ storyboards: number; audios: number; total: number }> {
  const character = await ctx.characters.findById(characterId);
  if (!character) return { storyboards: 0, audios: 0, total: 0 };
  const allStoryboards = await ctx.storyboards.findMany();
  const allAudios = await ctx.audios.findMany();
  const sb = allStoryboards.filter((s) => (s.dialogue || "").includes(character.name)).length;
  const au = allAudios.filter((a) => a.character_id === characterId).length;
  return { storyboards: sb, audios: au, total: sb + au };
}

export async function getSceneAppearances(ctx: AppContext, sceneId: string): Promise<{ storyboards: number; total: number }> {
  const all = await ctx.storyboards.findMany({ scene_id: sceneId } as any);
  return { storyboards: all.length, total: all.length };
}

export async function getPropAppearances(ctx: AppContext, propId: string): Promise<{ total: number }> {
  const prop = await ctx.props.findById(propId);
  if (!prop) return { total: 0 };
  const all = await ctx.storyboards.findMany();
  const matched = all.filter((s) => (s.notes || "").includes(prop.name) || (s.description || "").includes(prop.name)).length;
  return { total: matched };
}

// ==================== 资产模板/预设库 ====================
//
// 模板数据放在 asset-templates.ts，这里只导出"对外接口"。
// 不依赖 project_id，是全局可用的"快速填表"预设。

/** 返回全部角色模板（10 个常用预设）。 */
export async function listCharacterTemplatePresets(): Promise<Character[]> {
  return listCharacterTemplates();
}

/** 返回全部场景模板（8 个常用预设）。 */
export async function listSceneTemplatePresets(): Promise<Scene[]> {
  return listSceneTemplates();
}

/** 返回全部道具模板（10 个常用预设）。 */
export async function listPropTemplatePresets(): Promise<Prop[]> {
  return listPropTemplates();
}