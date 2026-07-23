/** Chapter 8 P1 gaps: review collaboration, cost adjustments and template lifecycle. */
import { getRawDatabase } from "../../storage/sqlite.js";
import { id, nowIso } from "../../utils.js";
import { ensureP2FeatureTables, getP2Template } from "./p2-features-service.js";
import { SqliteReviewRepository } from "../../infrastructure/persistence/sqlite-review.repository.js";
import { createTransactionService } from "../horizontal/transaction-service.js";
import { createTransactionServiceUnitOfWork } from "../../infrastructure/unit-of-work/transaction-service-unit-of-work.js";
import { handleAssignReviewer } from "../../application/review/assign-reviewer.command.js";

function dbFor(file: string) { return getRawDatabase(file); }
function runChanges(result: unknown): number { return Number((result as { changes?: number })?.changes ?? 0); }

export function ensureP1FeatureTables(file: string): void {
  ensureP2FeatureTables(file);
  const db = dbFor(file);
  db.exec(`
    CREATE TABLE IF NOT EXISTS review_assignments (
      id TEXT PRIMARY KEY, review_id TEXT NOT NULL, reviewer_id TEXT NOT NULL,
      level INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL DEFAULT 'pending',
      assigned_at TEXT NOT NULL, completed_at TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_review_assignments_review ON review_assignments(review_id, assigned_at);
    CREATE TABLE IF NOT EXISTS review_annotations (
      id TEXT PRIMARY KEY, review_id TEXT NOT NULL, kind TEXT NOT NULL,
      x REAL NOT NULL DEFAULT 0, y REAL NOT NULL DEFAULT 0, width REAL NOT NULL DEFAULT 0, height REAL NOT NULL DEFAULT 0,
      time_seconds REAL NOT NULL DEFAULT 0, comment TEXT NOT NULL DEFAULT '', created_by TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_review_annotations_review ON review_annotations(review_id, created_at);
    CREATE TABLE IF NOT EXISTS review_scorecards (
      id TEXT PRIMARY KEY, review_id TEXT NOT NULL, dimensions TEXT NOT NULL,
      total_score REAL NOT NULL, created_by TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_review_scorecards_review ON review_scorecards(review_id);
    CREATE TABLE IF NOT EXISTS template_versions (
      id TEXT PRIMARY KEY, template_id TEXT NOT NULL, version INTEGER NOT NULL,
      name TEXT NOT NULL, content TEXT NOT NULL, variables TEXT NOT NULL, tags TEXT NOT NULL,
      action TEXT NOT NULL, created_by TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL,
      UNIQUE(template_id, version)
    );
  `);
  for (const sql of [
    "ALTER TABLE reusable_templates ADD COLUMN variables TEXT NOT NULL DEFAULT '[]'",
    "ALTER TABLE reusable_templates ADD COLUMN version INTEGER NOT NULL DEFAULT 1",
    "ALTER TABLE reusable_templates ADD COLUMN status TEXT NOT NULL DEFAULT 'draft'",
    "ALTER TABLE reusable_templates ADD COLUMN published_at TEXT NOT NULL DEFAULT ''",
  ]) { try { db.exec(sql); } catch { /* column already exists */ } }
}

function reviewRow(file: string, reviewId: string): Record<string, unknown> {
  const row = dbFor(file).prepare("SELECT * FROM review_items WHERE id = ?").get(reviewId);
  if (!row) throw new Error("review_not_found");
  return row;
}

export async function assignReview(file: string, reviewId: string, reviewerId: string, actorId: string) {
  ensureP1FeatureTables(file); reviewRow(file, reviewId);
  if (!reviewerId) throw new Error("reviewerId 必填");
  const db = dbFor(file); const now = nowIso();
  const transactions = createTransactionService({ databaseFile: file });
  await handleAssignReviewer({
    repo: new SqliteReviewRepository(file),
    uow: createTransactionServiceUnitOfWork(transactions),
  }, {
    commandId: `assign-review:${reviewId}:${reviewerId}:${actorId}`,
    type: "AssignReviewReviewer",
    issuedAt: now,
    reviewId,
    reviewerId,
  });
  db.prepare("UPDATE review_assignments SET status='transferred', completed_at=? WHERE review_id=? AND status IN ('pending','in_progress')").run(now, reviewId);
  const row = { id: id("rassign"), review_id: reviewId, reviewer_id: reviewerId, level: 1, status: "pending", assigned_at: now, completed_at: "", created_at: now };
  db.prepare("INSERT INTO review_assignments (id,review_id,reviewer_id,level,status,assigned_at,completed_at,created_at) VALUES (?,?,?,?,?,?,?,?)").run(...Object.values(row));
  return row;
}

export function listReviewAssignments(file: string, reviewId: string) {
  ensureP1FeatureTables(file); reviewRow(file, reviewId);
  return dbFor(file).prepare("SELECT * FROM review_assignments WHERE review_id=? ORDER BY assigned_at DESC").all(reviewId);
}

export function addReviewAnnotation(file: string, reviewId: string, input: Record<string, unknown>, actorId: string) {
  ensureP1FeatureTables(file); reviewRow(file, reviewId);
  const kind = String(input.kind ?? "");
  if (kind !== "image_region" && kind !== "video_timestamp") throw new Error("kind 必须为 image_region 或 video_timestamp");
  const number = (key: string) => Math.max(0, Number(input[key] ?? 0));
  const row = { id: id("rnote"), review_id: reviewId, kind, x: number("x"), y: number("y"), width: number("width"), height: number("height"), time_seconds: number("timeSeconds"), comment: String(input.comment ?? ""), created_by: actorId, created_at: nowIso() };
  if (kind === "image_region" && (row.width <= 0 || row.height <= 0)) throw new Error("图片标注 width/height 必须大于 0");
  dbFor(file).prepare("INSERT INTO review_annotations (id,review_id,kind,x,y,width,height,time_seconds,comment,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)").run(...Object.values(row));
  return row;
}

export function listReviewAnnotations(file: string, reviewId: string) {
  ensureP1FeatureTables(file); reviewRow(file, reviewId);
  return dbFor(file).prepare("SELECT * FROM review_annotations WHERE review_id=? ORDER BY created_at").all(reviewId);
}

export function saveReviewScorecard(file: string, reviewId: string, dimensions: unknown, actorId: string) {
  ensureP1FeatureTables(file); reviewRow(file, reviewId);
  if (!dimensions || typeof dimensions !== "object" || Array.isArray(dimensions)) throw new Error("dimensions 必须为对象");
  const normalized: Record<string, number> = {};
  for (const [key, raw] of Object.entries(dimensions as Record<string, unknown>)) {
    const value = Number(raw); if (!Number.isFinite(value)) throw new Error(`评分 ${key} 非数字`);
    normalized[key] = Math.min(100, Math.max(0, value));
  }
  if (Object.keys(normalized).length === 0) throw new Error("至少提供一个评分维度");
  const total = Math.round(Object.values(normalized).reduce((sum, value) => sum + value, 0) / Object.keys(normalized).length * 100) / 100;
  const db = dbFor(file); const now = nowIso(); const existing = db.prepare("SELECT id FROM review_scorecards WHERE review_id=?").get(reviewId);
  if (existing) db.prepare("UPDATE review_scorecards SET dimensions=?,total_score=?,created_by=?,updated_at=? WHERE review_id=?").run(JSON.stringify(normalized), total, actorId, now, reviewId);
  else db.prepare("INSERT INTO review_scorecards (id,review_id,dimensions,total_score,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run(id("rscore"), reviewId, JSON.stringify(normalized), total, actorId, now, now);
  return { reviewId, dimensions: normalized, totalScore: total, updatedAt: now };
}

function parseSnapshot(row: Record<string, unknown>) {
  let data: Record<string, unknown> = {}; try { data = JSON.parse(String(row.snapshot_data ?? "{}")); } catch { data = {}; }
  return { id: String(row.id), action: String(row.action), createdAt: String(row.created_at), data };
}

export function compareReviewVersions(file: string, reviewId: string, leftId?: string, rightId?: string) {
  ensureP1FeatureTables(file); reviewRow(file, reviewId);
  const rows = dbFor(file).prepare("SELECT * FROM review_snapshots WHERE review_id=? ORDER BY created_at").all(reviewId);
  if (rows.length < 2) throw new Error("至少需要两个审核快照");
  const left = parseSnapshot(leftId ? rows.find((r) => r.id === leftId) ?? rows[0] : rows[0]);
  const right = parseSnapshot(rightId ? rows.find((r) => r.id === rightId) ?? rows.at(-1)! : rows.at(-1)!);
  const keys = [...new Set([...Object.keys(left.data), ...Object.keys(right.data)])];
  const changes = keys.filter((key) => JSON.stringify(left.data[key]) !== JSON.stringify(right.data[key])).map((key) => ({ field: key, before: left.data[key] ?? null, after: right.data[key] ?? null }));
  return { reviewId, left, right, changes, changedCount: changes.length };
}

export function recordProviderActualCost(file: string, input: { projectId: string; monthKey: string; actualAmount: number; idempotencyKey: string; refType?: string; refId?: string; provider?: string }) {
  ensureP1FeatureTables(file); if (!input.projectId || !input.idempotencyKey) throw new Error("projectId/idempotencyKey 必填");
  const db = dbFor(file); const existing = db.prepare("SELECT * FROM cost_records WHERE idempotency_key=?").get(input.idempotencyKey);
  if (existing) return { record: existing, duplicated: true };
  const amount = Number(input.actualAmount); if (!Number.isFinite(amount) || amount < 0) throw new Error("actualAmount 必须为非负数");
  const row = { id: id("cost"), project_id: input.projectId, month_key: input.monthKey, amount, source: "manual", ref_type: input.refType ?? "provider_callback", ref_id: input.refId ?? "", idempotency_key: input.idempotencyKey, note: `provider_actual:${input.provider ?? "unknown"}`, created_at: nowIso() };
  db.prepare("INSERT INTO cost_records (id,project_id,month_key,amount,source,ref_type,ref_id,idempotency_key,note,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)").run(...Object.values(row));
  return { record: row, duplicated: false };
}

export function recordCostRefund(file: string, input: { projectId: string; monthKey: string; amount: number; originalRecordId: string; reason?: string; idempotencyKey: string }) {
  const amount = Number(input.amount); if (!Number.isFinite(amount) || amount <= 0) throw new Error("退款 amount 必须大于 0");
  return recordProviderActualCost(file, { projectId: input.projectId, monthKey: input.monthKey, actualAmount: 0, idempotencyKey: input.idempotencyKey, refType: "refund", refId: input.originalRecordId, provider: "refund" }).duplicated
    ? { duplicated: true, record: dbFor(file).prepare("SELECT * FROM cost_records WHERE idempotency_key=?").get(input.idempotencyKey) }
    : (() => {
        const db = dbFor(file); db.prepare("UPDATE cost_records SET amount=?, note=? WHERE idempotency_key=?").run(-amount, `refund:${input.reason ?? ""}`, input.idempotencyKey);
        return { duplicated: false, record: db.prepare("SELECT * FROM cost_records WHERE idempotency_key=?").get(input.idempotencyKey) };
      })();
}

export function qualifiedVideoCost(file: string, projectId: string, finalVideoId: string) {
  ensureP1FeatureTables(file); const db = dbFor(file);
  const video = db.prepare("SELECT * FROM final_video_versions WHERE id=? AND project_id=?").get(finalVideoId, projectId);
  if (!video) throw new Error("final_video_not_found");
  let tags: string[] = []; try { tags = JSON.parse(String(video.tags ?? "[]")); } catch { tags = []; }
  if (String(video.status) !== "ready" || (Number(video.quality_score ?? 0) < 80 && !tags.includes("approved"))) throw new Error("成片尚未合格");
  const total = Number(db.prepare("SELECT COALESCE(SUM(amount),0) AS total FROM cost_records WHERE project_id=?").get(projectId)?.total ?? 0);
  const duration = Number(video.duration ?? 0); if (duration <= 0) throw new Error("成片时长无效");
  return { projectId, finalVideoId, durationSeconds: duration, totalCost: total, costPerMinute: Math.round(total / (duration / 60) * 10000) / 10000, currency: "CNY" };
}

export interface TemplateVariable { name: string; required?: boolean; default?: string; description?: string }
export interface TemplateLifecycle extends Record<string, unknown> {
  id: string; project_id: string; kind: string; name: string; content: string;
  tags: string[]; variables: TemplateVariable[]; version: number; status: string;
  usage_count: number; pass_count: number; pass_rate: number;
}
function normalizeVariables(value: unknown): TemplateVariable[] {
  if (!Array.isArray(value)) return [];
  const names = new Set<string>(); const result: TemplateVariable[] = [];
  for (const item of value) { if (!item || typeof item !== "object") continue; const name = String((item as Record<string, unknown>).name ?? "").trim(); if (!name || names.has(name) || !/^[A-Za-z_][\w.-]*$/.test(name)) continue; names.add(name); result.push({ name, required: (item as Record<string, unknown>).required === true, default: String((item as Record<string, unknown>).default ?? ""), description: String((item as Record<string, unknown>).description ?? "") }); }
  return result.slice(0, 50);
}
function parseJson<T>(raw: unknown, fallback: T): T { try { return JSON.parse(String(raw)) as T; } catch { return fallback; } }

export function initializeTemplateVersion(file: string, templateId: string, variables: unknown, actorId: string) {
  ensureP1FeatureTables(file); const db = dbFor(file); const tpl = getP2Template(file, templateId); if (!tpl) throw new Error("template_not_found");
  const normalized = normalizeVariables(variables); db.prepare("UPDATE reusable_templates SET variables=?,version=1,status='draft',updated_at=? WHERE id=?").run(JSON.stringify(normalized), nowIso(), templateId);
  if (!db.prepare("SELECT id FROM template_versions WHERE template_id=? AND version=1").get(templateId)) db.prepare("INSERT INTO template_versions (id,template_id,version,name,content,variables,tags,action,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)").run(id("tplv"), templateId, 1, tpl.name, tpl.content, JSON.stringify(normalized), JSON.stringify(tpl.tags), "create", actorId, nowIso());
  return getTemplateLifecycle(file, templateId);
}

export function getTemplateLifecycle(file: string, templateId: string): TemplateLifecycle {
  ensureP1FeatureTables(file); const row = dbFor(file).prepare("SELECT * FROM reusable_templates WHERE id=?").get(templateId); if (!row) throw new Error("template_not_found");
  return { ...row, tags: parseJson<string[]>(row.tags, []), variables: parseJson<TemplateVariable[]>(row.variables, []), pass_rate: Number(row.usage_count ?? 0) ? Math.round(Number(row.pass_count ?? 0) / Number(row.usage_count) * 10000) / 100 : 0 } as unknown as TemplateLifecycle;
}

export function validateTemplateVariables(file: string, templateId: string, values: unknown) {
  const tpl = getTemplateLifecycle(file, templateId); const supplied = values && typeof values === "object" && !Array.isArray(values) ? values as Record<string, unknown> : {};
  const normalized: Record<string, string> = {}; const errors: Array<{ variable: string; message: string }> = [];
  for (const variable of tpl.variables as TemplateVariable[]) { const raw = supplied[variable.name] ?? variable.default; const value = raw == null ? "" : String(raw); if (variable.required && !value) errors.push({ variable: variable.name, message: "必填变量缺失" }); normalized[variable.name] = value; }
  return { valid: errors.length === 0, errors, normalized };
}

export function previewTemplate(file: string, templateId: string, values: unknown) {
  const tpl = getTemplateLifecycle(file, templateId); const validation = validateTemplateVariables(file, templateId, values);
  const rendered = String(tpl.content).replace(/\{\{\s*([A-Za-z_][\w.-]*)\s*\}\}/g, (_match, key: string) => validation.normalized[key] ?? `{{${key}}}`);
  return { templateId, valid: validation.valid, errors: validation.errors, rendered, version: Number(tpl.version) };
}

function snapshotTemplate(file: string, templateId: string, action: string, actorId: string) {
  const db = dbFor(file); const tpl = getTemplateLifecycle(file, templateId);
  db.prepare("INSERT INTO template_versions (id,template_id,version,name,content,variables,tags,action,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
    .run(id("tplv"), templateId, Number(tpl.version), String(tpl.name), String(tpl.content), JSON.stringify(tpl.variables), JSON.stringify(tpl.tags), action, actorId, nowIso());
}

export function updateTemplateLifecycle(file: string, templateId: string, patch: Record<string, unknown>, expectedVersion: number, actorId: string) {
  const current = getTemplateLifecycle(file, templateId); if (Number(current.version) !== expectedVersion) throw new Error(`version_conflict: expected=${expectedVersion}, actual=${current.version}`);
  const nextVersion = expectedVersion + 1; const variables = patch.variables === undefined ? current.variables : normalizeVariables(patch.variables); const db = dbFor(file);
  const result = db.prepare("UPDATE reusable_templates SET name=?,content=?,variables=?,version=?,status='draft',updated_at=? WHERE id=? AND version=?")
    .run(String(patch.name ?? current.name), String(patch.content ?? current.content), JSON.stringify(variables), nextVersion, nowIso(), templateId, expectedVersion);
  if (runChanges(result) === 0) throw new Error("version_conflict"); snapshotTemplate(file, templateId, "update", actorId); return getTemplateLifecycle(file, templateId);
}

export function publishTemplate(file: string, templateId: string, expectedVersion: number, actorId: string) {
  const tpl = getTemplateLifecycle(file, templateId); if (Number(tpl.version) !== expectedVersion) throw new Error("version_conflict");
  const next = expectedVersion + 1; const now = nowIso(); dbFor(file).prepare("UPDATE reusable_templates SET version=?,status='published',published_at=?,updated_at=? WHERE id=? AND version=?").run(next, now, now, templateId, expectedVersion); snapshotTemplate(file, templateId, "publish", actorId); return getTemplateLifecycle(file, templateId);
}

export function listTemplateVersions(file: string, templateId: string) { ensureP1FeatureTables(file); getTemplateLifecycle(file, templateId); return dbFor(file).prepare("SELECT * FROM template_versions WHERE template_id=? ORDER BY version DESC").all(templateId).map((row) => ({ ...row, variables: parseJson(row.variables, []), tags: parseJson(row.tags, []) })); }

export function rollbackTemplate(file: string, templateId: string, targetVersion: number, expectedVersion: number, actorId: string) {
  const current = getTemplateLifecycle(file, templateId); if (Number(current.version) !== expectedVersion) throw new Error("version_conflict");
  const target = dbFor(file).prepare("SELECT * FROM template_versions WHERE template_id=? AND version=?").get(templateId, targetVersion); if (!target) throw new Error("template_version_not_found");
  const next = expectedVersion + 1; dbFor(file).prepare("UPDATE reusable_templates SET name=?,content=?,variables=?,tags=?,version=?,status='draft',updated_at=? WHERE id=? AND version=?").run(target.name, target.content, target.variables, target.tags, next, nowIso(), templateId, expectedVersion); snapshotTemplate(file, templateId, "rollback", actorId); return getTemplateLifecycle(file, templateId);
}
