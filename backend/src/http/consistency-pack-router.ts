import type { IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import type { AppContext } from "../services/app.js";
import { getRawDatabase, quoteIdentifier } from "../storage/sqlite.js";
import { DEFAULT_IMAGE_MODEL } from "../ai/image-config.js";
import { findReusableCharacterImage } from "../services/character-image-history.js";
import { findReusableSceneImage } from "../services/scene-image-history.js";
import { findReusablePropImage } from "../services/prop-image-history.js";
import { imageTypeToCriteria } from "../services/consistency-pack-history-bridge.js";
import { nowIso } from "../utils.js";

type EntityType = "character" | "scene" | "prop";
type JsonBody = Record<string, unknown>;

const TYPES: Record<EntityType, string[]> = {
  character: ["full_front", "full_side", "full_back", "half_body", "neutral", "happy", "sad", "angry", "surprised", "thinking", "eye_level", "low_angle", "high_angle"],
  scene: ["full_front", "full_side", "full_back", "half_body", "eye_level", "low_angle", "high_angle"],
  prop: ["full_front", "full_side", "full_back", "half_body", "eye_level", "low_angle", "high_angle"],
};

function ensureTables(ctx: AppContext): void {
  getRawDatabase(ctx.databaseFile).exec(`
    CREATE TABLE IF NOT EXISTS consistency_packs (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, entity_id TEXT NOT NULL,
      entity_type TEXT NOT NULL, status TEXT NOT NULL, version INTEGER NOT NULL,
      error_message TEXT NOT NULL, last_progress_at TEXT NOT NULL,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      UNIQUE(entity_type, entity_id)
    );
    CREATE TABLE IF NOT EXISTS consistency_pack_images (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, pack_id TEXT NOT NULL,
      image_type TEXT NOT NULL, prompt TEXT NOT NULL, negative_prompt TEXT NOT NULL,
      model_id TEXT NOT NULL, status TEXT NOT NULL, url TEXT NOT NULL,
      error_message TEXT NOT NULL, attempt INTEGER NOT NULL,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      UNIQUE(pack_id, image_type)
    );
    CREATE INDEX IF NOT EXISTS consistency_pack_entity_idx
      ON consistency_packs(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS consistency_pack_images_pack_idx
      ON consistency_pack_images(pack_id);
  `);
}

async function findEntity(ctx: AppContext, type: EntityType, entityId: string) {
  if (type === "character") return ctx.characters.findById(entityId);
  if (type === "scene") return ctx.scenes.findById(entityId);
  return ctx.props.findById(entityId);
}

function entityTypeFromPath(segment: string): EntityType | null {
  if (segment === "characters") return "character";
  if (segment === "scenes") return "scene";
  if (segment === "props") return "prop";
  return null;
}

export interface ConsistencyPackRouteHelpers {
  parts: string[];
  method: string;
  readJson(req: IncomingMessage): Promise<JsonBody>;
  sendJson(res: ServerResponse, payload: unknown, status?: number): void;
  sendError(res: ServerResponse, error: Error, status?: number): void;
  canAccessProject(projectId: string): Promise<boolean>;
}

export async function matchConsistencyPackRoute(
  ctx: AppContext,
  req: IncomingMessage,
  res: ServerResponse,
  h: ConsistencyPackRouteHelpers,
): Promise<boolean> {
  const { parts, method } = h;
  const entityType = entityTypeFromPath(parts[1] ?? "");
  const entityId = parts[2];

  if (entityType && entityId && parts[3] === "consistency-pack" && (parts.length === 4 || parts[4] === "generate")) {
    const entity = await findEntity(ctx, entityType, entityId);
    if (!entity) { h.sendError(res, new Error(`${entityType}_not_found`), 404); return true; }
    if (!(await h.canAccessProject(entity.project_id))) { h.sendError(res, new Error("forbidden"), 403); return true; }
    ensureTables(ctx);
    const db = getRawDatabase(ctx.databaseFile);

    if (method === "GET" && parts.length === 4) {
      const pack = db.prepare("SELECT * FROM consistency_packs WHERE entity_type=? AND entity_id=?").get(entityType, entityId) ?? null;
      const images = pack
        ? db.prepare("SELECT * FROM consistency_pack_images WHERE pack_id=? ORDER BY created_at,image_type").all(String(pack.id))
        : [];
      h.sendJson(res, { pack, images, typeCounts: { character: TYPES.character.length, scene: TYPES.scene.length, prop: TYPES.prop.length } });
      return true;
    }

    if (method === "POST" && parts[4] === "generate") {
      const body = await h.readJson(req);
      const now = new Date().toISOString();
      const existing = db.prepare("SELECT * FROM consistency_packs WHERE entity_type=? AND entity_id=?").get(entityType, entityId) as { id: string; version: number } | undefined;
      const packId = existing?.id ?? `cp-${randomUUID()}`;
      const version = Number(existing?.version ?? 0) + 1;
      if (existing) {
        db.prepare("UPDATE consistency_packs SET status='draft',version=?,error_message='',last_progress_at=?,updated_at=? WHERE id=?").run(version, now, now, packId);
        db.prepare("DELETE FROM consistency_pack_images WHERE pack_id=?").run(packId);
      } else {
        db.prepare("INSERT INTO consistency_packs VALUES (?,?,?,?,?,?,?,?,?,?)")
          .run(packId, entity.project_id, entityId, entityType, "draft", version, "", now, now, now);
      }
      const model = typeof body.model === "string" && body.model.trim() ? body.model.trim() : DEFAULT_IMAGE_MODEL;
      // ============================================================
      // S4.2 A→B 复用：generate 阶段优先从 *_image_history 找已设资产的图
      //   - 命中：把 url + meta 拷到 consistency_pack_images，status=ready（不再调 AI）
      //   - 未命中：保留 pending，让后台跑 AI 生图
      //   - 用 imageTypeToCriteria 把 image_type 翻译成 (shot_type, angle, view_type)
      // ============================================================
      const insert = db.prepare("INSERT INTO consistency_pack_images VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)");
      let reusedCount = 0;
      const reusedTypes: string[] = [];
      for (const imageType of TYPES[entityType]) {
        const criteria = imageTypeToCriteria(entityType, imageType);
        let reused: { url: string; model: string; prompt: string; negative_prompt?: string } | null = null;
        if (criteria) {
          const lookup = entityType === "character"
            ? await findReusableCharacterImage(ctx, entityId, criteria)
            : entityType === "scene"
              ? await findReusableSceneImage(ctx, entityId, criteria)
              : await findReusablePropImage(ctx, entityId, criteria);
          if (lookup) {
            reused = { url: lookup.url, model: lookup.model, prompt: lookup.prompt, negative_prompt: lookup.negative_prompt };
            reusedCount += 1;
            reusedTypes.push(imageType);
          }
        }
        insert.run(
          `cpimg-${randomUUID()}`,
          entity.project_id,
          packId,
          imageType,
          reused ? reused.prompt : `${entity.name ?? entityId} ${imageType}`,
          reused?.negative_prompt ?? "",
          reused ? reused.model : model,
          reused ? "ready" : "pending",
          reused?.url ?? "",
          "",
          1,
          now,
          now,
        );
      }
      h.sendJson(res, {
        packId,
        total: TYPES[entityType].length,
        types: TYPES[entityType],
        reused: reusedCount,
        reusedTypes,
        generated: TYPES[entityType].length - reusedCount,
      }, 202);
      return true;
    }
    return false;
  }

  // ============================================================
  // S4.2 B→A 状态机：approved 时把一致性包图导入 *_image_history
  //   POST /api/consistency-pack/:packId/transition  body: { status: 'pending_review'|'approved'|'rejected'|'locked' }
  //   approved 副作用（事务内）：
  //     1) 对每张 status=ready 的图按 image_type 生成 history 记录（is_applied=1）
  //     2) 第一张 ready 图自动设为该实体主图（is_primary=1）
  // ============================================================
  if (method === "POST" && parts[1] === "consistency-pack" && parts[2] && parts[3] === "transition" && parts.length === 4) {
    ensureTables(ctx);
    const db = getRawDatabase(ctx.databaseFile);
    const pack = db.prepare("SELECT * FROM consistency_packs WHERE id=?").get(parts[2]) as
      | { id: string; project_id: string; entity_id: string; entity_type: EntityType; status: string; version: number }
      | undefined;
    if (!pack) { h.sendError(res, new Error("consistency_pack_not_found"), 404); return true; }
    if (!(await h.canAccessProject(pack.project_id))) { h.sendError(res, new Error("forbidden"), 403); return true; }
    const body = await h.readJson(req);
    const next = typeof body.status === "string" ? body.status.trim() : "";
    const allowed: Record<string, string[]> = {
      draft: ["pending_review"],
      pending_review: ["approved", "rejected", "draft"],
      approved: ["locked", "pending_review"],
      rejected: ["pending_review", "draft"],
      locked: [],
    };
    const from = pack.status;
    const options = allowed[from] ?? [];
    if (!options.includes(next)) {
      h.sendError(res, new Error(`invalid_transition:${from}->${next}`), 400);
      return true;
    }
    const now = nowIso();
    // approved 副作用：把 ready 图导入 history + 设主图
    let importedCount = 0;
    if (next === "approved") {
      const images = db.prepare("SELECT * FROM consistency_pack_images WHERE pack_id=? AND status='ready' ORDER BY created_at,image_type").all(pack.id) as Array<{
        id: string; image_type: string; url: string; prompt: string; negative_prompt: string; model_id: string;
      }>;
      const idCol: "character_id" | "scene_id" | "prop_id" =
        pack.entity_type === "character" ? "character_id"
        : pack.entity_type === "scene" ? "scene_id"
        : "prop_id";
      const idPrefix = pack.entity_type === "character" ? "imhist"
        : pack.entity_type === "scene" ? "simhist"
        : "pimhist";
      // image_type → (shot_type, angle, view_type)
      const mapped = images.map((img) => ({ img, criteria: imageTypeToCriteria(pack.entity_type, img.image_type) }));

      // 注：这里使用 raw SQL 而不是 historyRepo.insert，因为 SqliteRepository.insertBatch 内部已开 BEGIN/COMMIT，
      // 再在外层包一个 BEGIN 会触发 "cannot start a transaction within a transaction"。
      // raw SQL 让我们在外层显式开一个大事务，覆盖 history + entity.image + consistency_packs.status 3 张表的原子写入。
      const historyTable = pack.entity_type === "character" ? "character_image_history"
        : pack.entity_type === "scene" ? "scene_image_history"
        : "prop_image_history";
      const historyInsert = db.prepare(
        `INSERT INTO ${quoteIdentifier(historyTable)} (id,${quoteIdentifier(idCol)},project_id,url,ratio,model,size,prompt,negative_prompt,response_format,n,shot_type,angle,view_type,is_applied,applied_at,created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      );
      const entityTable = pack.entity_type === "character" ? "characters"
        : pack.entity_type === "scene" ? "scenes"
        : "props";
      const entityUpdate = db.prepare(`UPDATE ${quoteIdentifier(entityTable)} SET image=?, updated_at=? WHERE id=?`);

      db.exec("BEGIN");
      try {
        let firstUrl: string | null = null;
        for (const { img, criteria: c } of mapped) {
          if (!img.url) continue;
          const historyId = `${idPrefix}-${randomUUID()}`;
          historyInsert.run(
            historyId,
            pack.entity_id,
            pack.project_id,
            img.url,
            "1:1",
            img.model_id || DEFAULT_IMAGE_MODEL,
            "1024x1024",
            img.prompt,
            img.negative_prompt ?? "",
            "url",
            1,
            c?.shot_type ?? null,
            c?.angle ?? null,
            c?.view_type ?? null,
            1,
            now,
            now,
          );
          importedCount += 1;
          if (!firstUrl) firstUrl = img.url;
        }
        // 主图策略：第一张 ready 图自动设为实体主图
        if (firstUrl) {
          entityUpdate.run(firstUrl, now, pack.entity_id);
        }
        db.prepare("UPDATE consistency_packs SET status=?,last_progress_at=?,updated_at=? WHERE id=?")
          .run(next, now, now, pack.id);
        db.exec("COMMIT");
      } catch (err) {
        db.exec("ROLLBACK");
        throw err;
      }
    } else {
      // 其他状态：仅改 status
      db.prepare("UPDATE consistency_packs SET status=?,last_progress_at=?,updated_at=? WHERE id=?")
        .run(next, now, now, pack.id);
    }
    h.sendJson(res, { packId: pack.id, from, to: next, imported: importedCount });
    return true;
  }

  if (method === "POST" && parts[1] === "consistency-pack" && parts[2] === "images" && parts[3] && parts[4] === "regenerate") {
    ensureTables(ctx);
    const db = getRawDatabase(ctx.databaseFile);
    const image = db.prepare("SELECT i.*,p.entity_id,p.entity_type FROM consistency_pack_images i JOIN consistency_packs p ON p.id=i.pack_id WHERE i.id=?").get(parts[3]) as { id: string; project_id: string; attempt: number } | undefined;
    if (!image) { h.sendError(res, new Error("consistency_pack_image_not_found"), 404); return true; }
    if (!(await h.canAccessProject(image.project_id))) { h.sendError(res, new Error("forbidden"), 403); return true; }
    const body = await h.readJson(req);
    const now = new Date().toISOString();
    const model = typeof body.model === "string" && body.model.trim() ? body.model.trim() : undefined;
    db.prepare("UPDATE consistency_pack_images SET status='pending',url='',error_message='',attempt=?,model_id=COALESCE(?,model_id),updated_at=? WHERE id=?")
      .run(Number(image.attempt) + 1, model ?? null, now, image.id);
    h.sendJson(res, { imageId: image.id, status: "pending" }, 202);
    return true;
  }

  return false;
}
