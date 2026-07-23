import type { IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import type { AppContext } from "../services/app.js";
import { getRawDatabase } from "../storage/sqlite.js";

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
      const model = typeof body.model === "string" && body.model.trim() ? body.model.trim() : "agnes-image-2.1-flash";
      const insert = db.prepare("INSERT INTO consistency_pack_images VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)");
      for (const imageType of TYPES[entityType]) {
        insert.run(`cpimg-${randomUUID()}`, entity.project_id, packId, imageType, `${entity.name ?? entityId} ${imageType}`, "", model, "pending", "", "", 1, now, now);
      }
      h.sendJson(res, { packId, total: TYPES[entityType].length, types: TYPES[entityType] }, 202);
      return true;
    }
    return false;
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
