/** V2 chapter 8 P2 feature service: template analytics, bill reconciliation and reuse metrics. */
import { getRawDatabase } from "../../storage/sqlite.js";
import { id, nowIso } from "../../utils.js";

export type TemplateKind = "prompt" | "workflow";

export interface P2Template {
  id: string;
  project_id: string;
  kind: TemplateKind;
  name: string;
  content: string;
  tags: string[];
  source_template_id: string;
  usage_count: number;
  pass_count: number;
  fail_count: number;
  pass_rate: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ReconciliationInput {
  projectId: string;
  provider: string;
  monthKey: string;
  billedAmount: number;
  currency?: string;
  externalRef?: string;
  tolerance?: number;
}

function dbFor(databaseFile: string) {
  return getRawDatabase(databaseFile);
}

export function ensureP2FeatureTables(databaseFile: string): void {
  const db = dbFor(databaseFile);
  db.exec(`
    CREATE TABLE IF NOT EXISTS reusable_templates (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      name TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      tags TEXT NOT NULL DEFAULT '[]',
      source_template_id TEXT NOT NULL DEFAULT '',
      usage_count INTEGER NOT NULL DEFAULT 0,
      pass_count INTEGER NOT NULL DEFAULT 0,
      fail_count INTEGER NOT NULL DEFAULT 0,
      created_by TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_reusable_templates_project_kind
      ON reusable_templates(project_id, kind);
    CREATE TABLE IF NOT EXISTS template_usage_events (
      id TEXT PRIMARY KEY,
      template_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      passed INTEGER NOT NULL,
      duration_ms INTEGER NOT NULL DEFAULT 0,
      created_by TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_template_usage_template
      ON template_usage_events(template_id, created_at);
    CREATE TABLE IF NOT EXISTS provider_bill_reconciliations (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      month_key TEXT NOT NULL,
      billed_amount REAL NOT NULL,
      internal_amount REAL NOT NULL,
      variance REAL NOT NULL,
      variance_rate REAL NOT NULL,
      tolerance REAL NOT NULL,
      status TEXT NOT NULL,
      currency TEXT NOT NULL DEFAULT 'CNY',
      external_ref TEXT NOT NULL DEFAULT '',
      created_by TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_reconciliations_project_month
      ON provider_bill_reconciliations(project_id, month_key);
    CREATE TABLE IF NOT EXISTS manual_work_logs (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      work_type TEXT NOT NULL,
      ref_type TEXT NOT NULL DEFAULT '',
      ref_id TEXT NOT NULL DEFAULT '',
      duration_seconds INTEGER NOT NULL,
      operator_id TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      started_at TEXT NOT NULL,
      ended_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_manual_work_project_time
      ON manual_work_logs(project_id, started_at);
  `);
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item).trim()).filter(Boolean))].slice(0, 20);
}

function mapTemplate(row: Record<string, unknown>): P2Template {
  let tags: string[] = [];
  try { tags = normalizeTags(JSON.parse(String(row.tags ?? "[]"))); } catch { tags = []; }
  const uses = Number(row.usage_count ?? 0);
  const passed = Number(row.pass_count ?? 0);
  return {
    ...(row as unknown as Omit<P2Template, "tags" | "pass_rate">),
    tags,
    usage_count: uses,
    pass_count: passed,
    fail_count: Number(row.fail_count ?? 0),
    pass_rate: uses > 0 ? Math.round((passed / uses) * 10000) / 100 : 0,
  };
}

export function createP2Template(databaseFile: string, input: {
  projectId: string; kind: TemplateKind; name: string; content?: string; tags?: unknown; createdBy?: string;
}): P2Template {
  ensureP2FeatureTables(databaseFile);
  if (!input.projectId || !input.name.trim()) throw new Error("projectId 和 name 必填");
  if (input.kind !== "prompt" && input.kind !== "workflow") throw new Error("kind 必须为 prompt 或 workflow");
  const now = nowIso();
  const templateId = id("tpl");
  dbFor(databaseFile).prepare(`INSERT INTO reusable_templates
    (id, project_id, kind, name, content, tags, source_template_id, usage_count, pass_count, fail_count, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, '', 0, 0, 0, ?, ?, ?)`)
    .run(templateId, input.projectId, input.kind, input.name.trim(), input.content ?? "", JSON.stringify(normalizeTags(input.tags)), input.createdBy ?? "", now, now);
  return getP2Template(databaseFile, templateId)!;
}

export function getP2Template(databaseFile: string, templateId: string): P2Template | null {
  ensureP2FeatureTables(databaseFile);
  const row = dbFor(databaseFile).prepare("SELECT * FROM reusable_templates WHERE id = ?").get(templateId);
  return row ? mapTemplate(row) : null;
}

export function listP2Templates(databaseFile: string, projectId: string, kind?: TemplateKind): P2Template[] {
  ensureP2FeatureTables(databaseFile);
  const rows = kind
    ? dbFor(databaseFile).prepare("SELECT * FROM reusable_templates WHERE project_id = ? AND kind = ? ORDER BY updated_at DESC").all(projectId, kind)
    : dbFor(databaseFile).prepare("SELECT * FROM reusable_templates WHERE project_id = ? ORDER BY updated_at DESC").all(projectId);
  return rows.map(mapTemplate);
}

export function updateTemplateTags(databaseFile: string, templateId: string, tags: unknown): P2Template {
  const current = getP2Template(databaseFile, templateId);
  if (!current) throw new Error("template_not_found");
  dbFor(databaseFile).prepare("UPDATE reusable_templates SET tags = ?, updated_at = ? WHERE id = ?")
    .run(JSON.stringify(normalizeTags(tags)), nowIso(), templateId);
  return getP2Template(databaseFile, templateId)!;
}

export function copyWorkflowTemplate(databaseFile: string, templateId: string, input: {
  projectId?: string; name?: string; createdBy?: string;
}): P2Template {
  const source = getP2Template(databaseFile, templateId);
  if (!source) throw new Error("template_not_found");
  if (source.kind !== "workflow") throw new Error("只有 workflow 模板可以复制");
  const copied = createP2Template(databaseFile, {
    projectId: input.projectId || source.project_id,
    kind: "workflow",
    name: input.name?.trim() || `${source.name} - 副本`,
    content: source.content,
    tags: source.tags,
    createdBy: input.createdBy,
  });
  dbFor(databaseFile).prepare("UPDATE reusable_templates SET source_template_id = ? WHERE id = ?").run(source.id, copied.id);
  return getP2Template(databaseFile, copied.id)!;
}

export function recordTemplateUsage(databaseFile: string, templateId: string, input: {
  passed: boolean; durationMs?: number; createdBy?: string;
}): P2Template {
  const template = getP2Template(databaseFile, templateId);
  if (!template) throw new Error("template_not_found");
  const db = dbFor(databaseFile);
  const now = nowIso();
  db.prepare(`INSERT INTO template_usage_events
    (id, template_id, project_id, passed, duration_ms, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(id("tuse"), templateId, template.project_id, input.passed ? 1 : 0, Math.max(0, Math.round(input.durationMs ?? 0)), input.createdBy ?? "", now);
  db.prepare(`UPDATE reusable_templates SET usage_count = usage_count + 1,
    pass_count = pass_count + ?, fail_count = fail_count + ?, updated_at = ? WHERE id = ?`)
    .run(input.passed ? 1 : 0, input.passed ? 0 : 1, now, templateId);
  return getP2Template(databaseFile, templateId)!;
}

export function reconcileProviderBill(databaseFile: string, input: ReconciliationInput, createdBy = "") {
  ensureP2FeatureTables(databaseFile);
  if (!/^\d{4}-\d{2}$/.test(input.monthKey)) throw new Error("monthKey 必须为 YYYY-MM");
  if (!input.projectId || !input.provider) throw new Error("projectId 和 provider 必填");
  if (!Number.isFinite(input.billedAmount) || input.billedAmount < 0) throw new Error("billedAmount 必须是非负数");
  const db = dbFor(databaseFile);
  const cost = db.prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM cost_records WHERE project_id = ? AND month_key = ?")
    .get(input.projectId, input.monthKey);
  const internalAmount = Number(cost?.total ?? 0);
  const variance = Math.round((input.billedAmount - internalAmount) * 10000) / 10000;
  const varianceRate = internalAmount > 0 ? Math.round((variance / internalAmount) * 10000) / 100 : (input.billedAmount === 0 ? 0 : 100);
  const tolerance = Math.max(0, input.tolerance ?? 0.01);
  const status = Math.abs(variance) <= tolerance ? "matched" : "mismatched";
  const row = {
    id: id("recon"), project_id: input.projectId, provider: input.provider, month_key: input.monthKey,
    billed_amount: input.billedAmount, internal_amount: internalAmount, variance, variance_rate: varianceRate,
    tolerance, status, currency: input.currency ?? "CNY", external_ref: input.externalRef ?? "",
    created_by: createdBy, created_at: nowIso(),
  };
  db.prepare(`INSERT INTO provider_bill_reconciliations
    (id, project_id, provider, month_key, billed_amount, internal_amount, variance, variance_rate, tolerance, status, currency, external_ref, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(...Object.values(row));
  return row;
}

export function listReconciliations(databaseFile: string, projectId: string, monthKey?: string) {
  ensureP2FeatureTables(databaseFile);
  return monthKey
    ? dbFor(databaseFile).prepare("SELECT * FROM provider_bill_reconciliations WHERE project_id = ? AND month_key = ? ORDER BY created_at DESC").all(projectId, monthKey)
    : dbFor(databaseFile).prepare("SELECT * FROM provider_bill_reconciliations WHERE project_id = ? ORDER BY created_at DESC").all(projectId);
}

export function logManualWork(databaseFile: string, input: {
  projectId: string; workType: string; durationSeconds: number; operatorId?: string; refType?: string; refId?: string;
  note?: string; startedAt?: string; endedAt?: string;
}) {
  ensureP2FeatureTables(databaseFile);
  if (!input.projectId || !input.workType) throw new Error("projectId 和 workType 必填");
  if (!Number.isFinite(input.durationSeconds) || input.durationSeconds <= 0) throw new Error("durationSeconds 必须大于 0");
  const endedAt = input.endedAt ?? nowIso();
  const startedAt = input.startedAt ?? new Date(new Date(endedAt).getTime() - input.durationSeconds * 1000).toISOString();
  const row = { id: id("work"), project_id: input.projectId, work_type: input.workType,
    ref_type: input.refType ?? "", ref_id: input.refId ?? "", duration_seconds: Math.round(input.durationSeconds),
    operator_id: input.operatorId ?? "", note: input.note ?? "", started_at: startedAt, ended_at: endedAt, created_at: nowIso() };
  dbFor(databaseFile).prepare(`INSERT INTO manual_work_logs
    (id, project_id, work_type, ref_type, ref_id, duration_seconds, operator_id, note, started_at, ended_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)["run"](...Object.values(row));
  return row;
}

export function getP2Metrics(databaseFile: string, projectId: string) {
  ensureP2FeatureTables(databaseFile);
  const db = dbFor(databaseFile);
  const manual = db.prepare(`SELECT COUNT(*) AS entries, COALESCE(SUM(duration_seconds), 0) AS total_seconds,
    COALESCE(AVG(duration_seconds), 0) AS avg_seconds FROM manual_work_logs WHERE project_id = ?`).get(projectId) ?? {};
  const asset = db.prepare(`SELECT COUNT(*) AS total_assets,
    COALESCE(SUM(CASE WHEN usage_count > 1 THEN 1 ELSE 0 END), 0) AS reused_assets,
    COALESCE(SUM(usage_count), 0) AS total_uses FROM (
      SELECT usage_count FROM characters WHERE project_id = ? AND COALESCE(deleted_at, '') = ''
      UNION ALL SELECT usage_count FROM scenes WHERE project_id = ? AND COALESCE(deleted_at, '') = ''
      UNION ALL SELECT usage_count FROM props WHERE project_id = ? AND COALESCE(deleted_at, '') = ''
    )`).get(projectId, projectId, projectId) ?? {};
  const templates = db.prepare(`SELECT COUNT(*) AS total_templates,
    COALESCE(SUM(CASE WHEN usage_count > 1 THEN 1 ELSE 0 END), 0) AS reused_templates,
    COALESCE(SUM(usage_count), 0) AS total_uses FROM reusable_templates WHERE project_id = ?`).get(projectId) ?? {};
  const assetTotal = Number(asset.total_assets ?? 0);
  const templateTotal = Number(templates.total_templates ?? 0);
  return {
    projectId,
    manualWork: { entries: Number(manual.entries ?? 0), totalSeconds: Number(manual.total_seconds ?? 0), averageSeconds: Math.round(Number(manual.avg_seconds ?? 0)) },
    assetReuse: { totalAssets: assetTotal, reusedAssets: Number(asset.reused_assets ?? 0), totalUses: Number(asset.total_uses ?? 0), reuseRate: assetTotal ? Math.round(Number(asset.reused_assets ?? 0) / assetTotal * 10000) / 100 : 0 },
    templateReuse: { totalTemplates: templateTotal, reusedTemplates: Number(templates.reused_templates ?? 0), totalUses: Number(templates.total_uses ?? 0), reuseRate: templateTotal ? Math.round(Number(templates.reused_templates ?? 0) / templateTotal * 10000) / 100 : 0 },
    generatedAt: nowIso(),
  };
}
