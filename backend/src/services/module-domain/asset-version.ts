import type { AppContext } from "../app.js";
import type { AssetEntityType, AssetVersion, AssetVersionChangeType } from "../../types.js";
import { id, nowIso } from "../../utils.js";
import { rootLogger } from "../../logger.js";

/** 版本 ID 前缀，方便排查。 */
const VERSION_ID_PREFIX = "av";

/** 把任意实体对象深拷贝为可写入数据库的纯 JSON 字符串（写入 `json` 类型字段）。 */
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
    rootLogger.warn({ event: "asset.version.failed", entityType, entityId, err }, "recordVersion failed");
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
  data.updated_at = ts;
  switch (entityType) {
    case "character":
      await ctx.characters.update(entityId, data as any);
      return await ctx.characters.findById(entityId);
    case "scene":
      await ctx.scenes.update(entityId, data as any);
      return await ctx.scenes.findById(entityId);
    case "prop":
      await ctx.props.update(entityId, data as any);
      return await ctx.props.findById(entityId);
    default:
      throw new Error(`unsupported entity type: ${entityType}`);
  }
}

/**
 * 回滚某条版本到对应实体，并新增一条 restore 类型的版本记录。
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
  const forbidden: string[] = ["id", "created_at"];
  for (const key of forbidden) delete snapshot[key];
  const entityId = version.entity_id;
  await writeBackVersion(ctx, version.entity_type, entityId, snapshot);
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
