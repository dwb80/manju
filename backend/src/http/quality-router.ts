/**
 * @file quality-router.ts
 * @description V2 W6 REQ-PIPE-004-05 质检中心 API 路由
 *
 * 提供 8 个端点：
 *  - GET    /api/quality/auto-config?projectId=xxx       读取项目自动质检配置（无记录时返回默认）
 *  - PUT    /api/quality/auto-config                     upsert 自动质检配置（editor+）
 *  - DELETE /api/quality/auto-config?projectId=xxx       删除配置
 *  - GET    /api/quality/reports?projectId=&runId=&nodeId=&targetType=&targetId=&limit=&offset=
 *  - GET    /api/quality/reports/:reportId               读取单条报告
 *  - PATCH  /api/quality/reports/:reportId               V2 W12+ QA-F22 人工复核反馈（reviewer_note/reviewed_by/reviewed_at/可覆盖 passed）
 *  - POST   /api/quality/detect                          手动触发质检（editor+）
 *  - GET    /api/quality/summary?projectId=xxx           报告汇总（V2 W12+ QA-F19 加权质量等级 A/B/C/D + byCheckType + reviewStats）
 *
 * 设计要点：
 *  - 复用主路由的 canAccessProject 做项目级权限校验。
 *  - auto-config 默认值：enabled=false / target_types=[] / threshold=70 / on_failure="log"。
 *    GET 无记录时直接返回该默认（带 is_default:true 标记），让前端 SSR 立即渲染配置区。
 *  - upsert by project_id：用 findOne + insert/update；用事务保证并发安全。
 *  - 手动 detect 走 ctx.qualityDetectionService.detect(位置参数)，
 *    返回 reportId + overallScore + status。
 *  - reports 列表支持 projectId / runId / nodeId / targetType / targetId 过滤 + limit/offset 分页。
 *  - summary V2 W12+ 走 computeQualitySummary：按 check_type 加权（CHECK_TYPE_WEIGHTS）汇总成 A/B/C/D 等级，
 *    同时输出 byCheckType 分组（每 check_type 独立 avg/grade/passRate）和 reviewStats（已/未人工复核）。
 *  - PATCH /reports/:id 仅允许更新复核相关字段（reviewer_note/reviewed_by/reviewed_at/passed），
 *    业务上视为"人工裁决覆盖"，写入 details.human_override 子结构以便审计追溯。
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { AppContext } from "../services/app.js";
import { rootLogger } from "../logger.js";
import { nowIso } from "../utils.js";
import {
  removeQualityAutoConfig,
  reviewQualityReport,
  saveQualityAutoConfig,
} from "../services/module-domain/quality-command-service.js";
import type {
  QualityAutoConfig,
  QualityCheckType,
  QualityOnFailure,
  QualityReport,
  QualityTargetType,
} from "../types/pipeline.js";

const log = rootLogger.child({ module: "quality-router" });

/** 默认配置（无记录时 GET 返回此 + is_default:true）。 */
export const DEFAULT_AUTO_CONFIG: Omit<QualityAutoConfig, "project_id" | "created_at" | "updated_at"> = {
  id: "",
  enabled: false,
  target_types: [],
  threshold: 70,
  on_failure: "log",
};

/** 路由访问上下文（主路由注入）。 */
export interface QualityAccess {
  userId: string;
  isAdmin: boolean;
  canAccessProject(projectId: string): Promise<boolean>;
}

/** 解析 URL 路径段。 */
function partsOf(url: string): string[] {
  const u = new URL(url, "http://localhost");
  return u.pathname.split("/").filter(Boolean);
}

/** 读取 URL 查询参数。 */
function queryOf(url: string): URLSearchParams {
  return new URL(url, "http://localhost").searchParams;
}

/** 读取 JSON 请求体（错误返回 400）。 */
async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf-8");
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(new Error("invalid_json"));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(payload));
}

function sendError(res: ServerResponse, status: number, message: string): void {
  sendJson(res, status, { code: status, message, data: null });
}

/** 校验并规范化 target_types。 */
function normalizeTargetTypes(input: unknown): QualityTargetType[] {
  if (!Array.isArray(input)) return [];
  const allowed: QualityTargetType[] = ["image", "video", "audio", "composition"];
  return input.filter((t): t is QualityTargetType => allowed.includes(t as QualityTargetType));
}

function normalizeOnFailure(input: unknown): QualityOnFailure {
  if (input === "review" || input === "block" || input === "log") return input;
  return "log";
}

function normalizeThreshold(input: unknown): number {
  const n = Number(input);
  if (!Number.isFinite(n)) return 70;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * QualityTargetType → QualityCheckType 默认映射。
 *  - image        → resolution（尺寸 / DPI 校验）
 *  - video        → duration（时长校验）
 *  - audio        → audio_level（音量 / 静音检测）
 *  - composition  → aspect_ratio（合成比例校验）
 */
function defaultCheckTypeFor(targetType: QualityTargetType): QualityCheckType {
  switch (targetType) {
    case "image": return "resolution";
    case "video": return "duration";
    case "audio": return "audio_level";
    case "composition": return "aspect_ratio";
    default: return "resolution";
  }
}

/**
 * V2 W12+ QA-F19：质量等级计算（A/B/C/D）
 *  - A: ≥90    优秀
 *  - B: 75-89  良好
 *  - C: 60-74  合格
 *  - D: <60    不合格
 */
export type QualityGrade = "A" | "B" | "C" | "D";

export function scoreToGrade(score: number): QualityGrade {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  return "D";
}

/**
 * V2 W12+ QA-F19：按 check_type 加权汇总
 *  - check_type → weight 表（视觉/技术类权重大；通用 metadata 类权重小）
 *  - 用 avgScore = Σ(score × weight) / Σ(weight)
 *  - 用 grade 反推
 *  - byCheckType 同时输出每种 check_type 的均值和等级
 */
const CHECK_TYPE_WEIGHTS: Record<QualityCheckType, number> = {
  // 技术硬指标（高权重）
  media_readable: 1.5,
  resolution: 1.2,
  aspect_ratio: 1.0,
  fps: 1.3,
  duration: 1.0,
  black_frame: 1.4,
  frozen_frame: 1.4,
  blur: 1.3,
  exposure: 1.1,
  flicker: 1.2,
  audio_level: 1.2,
  // 视觉/AI 类（中高权重）
  face_count: 1.0,
  role_similarity: 1.5, // 短剧核心
  human_body: 1.0,
  subtitle_safe: 0.8,
  // 文本合规类（高权重）
  sensitive_content: 1.5,
};

export interface CheckTypeSummary {
  count: number;
  avgScore: number;
  grade: QualityGrade;
  passRate: number;
}

export interface QualitySummary {
  total: number;
  passed: number;
  failed: number;
  warning: number;
  avgScore: number;
  /** V2 W12+ QA-F19：加权汇总质量等级 */
  weightedAvgScore: number;
  grade: QualityGrade;
  byTargetType: Record<string, number>;
  /** V2 W12+ QA-F19：按 check_type 分组统计 */
  byCheckType: Record<string, CheckTypeSummary>;
  /** V2 W12+ QA-F19：人工复核统计 */
  reviewStats: {
    total: number;
    reviewed: number;
    pending: number;
    reviewedRate: number;
  };
}

export function computeQualitySummary(reports: QualityReport[]): QualitySummary {
  let total = 0;
  let passed = 0;
  let failed = 0;
  let warning = 0;
  let scoreSum = 0;
  const byTargetType: Record<string, number> = {};
  const byCheckTypeAccum: Record<string, { count: number; scoreSum: number; passCount: number }> = {};
  const byCheckType: Record<string, CheckTypeSummary> = {};
  let weightedSum = 0;
  let weightSum = 0;
  let reviewedCount = 0;

  for (const r of reports) {
    total += 1;
    if (r.passed) passed += 1;
    else failed += 1;
    const status = (r.details as { status?: string } | null)?.status;
    if (status === "warning") warning += 1;
    scoreSum += r.score ?? 0;
    const ttype = (r.details as { targetType?: string } | null)?.targetType ?? "unknown";
    byTargetType[ttype] = (byTargetType[ttype] ?? 0) + 1;

    // 按 check_type 累加
    const ct = r.check_type as string;
    if (!byCheckTypeAccum[ct]) {
      byCheckTypeAccum[ct] = { count: 0, scoreSum: 0, passCount: 0 };
    }
    const acc = byCheckTypeAccum[ct];
    acc.count += 1;
    acc.scoreSum += r.score ?? 0;
    if (r.passed) acc.passCount += 1;

    // 加权汇总
    const w = CHECK_TYPE_WEIGHTS[r.check_type] ?? 1.0;
    weightedSum += (r.score ?? 0) * w;
    weightSum += w;

    // 人工复核统计
    if (r.reviewed_by && r.reviewed_at) {
      reviewedCount += 1;
    }
  }

  // 计算 byCheckType 结果
  for (const [ct, acc] of Object.entries(byCheckTypeAccum)) {
    const avg = acc.count > 0 ? acc.scoreSum / acc.count : 0;
    byCheckType[ct] = {
      count: acc.count,
      avgScore: Math.round(avg * 10) / 10,
      grade: scoreToGrade(Math.round(avg)),
      passRate: acc.count > 0 ? Math.round((acc.passCount / acc.count) * 1000) / 10 : 0,
    };
  }

  const weightedAvgScore = weightSum > 0 ? weightedSum / weightSum : 0;
  return {
    total,
    passed,
    failed,
    warning,
    avgScore: total > 0 ? Math.round((scoreSum / total) * 10) / 10 : 0,
    weightedAvgScore: Math.round(weightedAvgScore * 10) / 10,
    grade: scoreToGrade(Math.round(weightedAvgScore)),
    byTargetType,
    byCheckType,
    reviewStats: {
      total,
      reviewed: reviewedCount,
      pending: total - reviewedCount,
      reviewedRate: total > 0 ? Math.round((reviewedCount / total) * 1000) / 10 : 0,
    },
  };
}

/**
 * 入口（主路由在 pathname.startsWith("/api/quality") 时调用）。
 */
export async function handleQualityRouter(
  ctx: AppContext,
  req: IncomingMessage,
  res: ServerResponse,
  access: QualityAccess,
): Promise<void> {
  const parts = partsOf(req.url ?? "/");
  const method = (req.method ?? "GET").toUpperCase();

  // /api/quality/auto-config  →  parts = ["api","quality","auto-config"]  (length 3)
  if (parts[2] === "auto-config" && parts.length === 3) {
    if (method === "GET") return await getAutoConfig(ctx, req, res, access);
    if (method === "PUT") return await putAutoConfig(ctx, req, res, access);
    sendError(res, 405, "method_not_allowed");
    return;
  }

  // /api/quality/reports/:reportId  →  parts = ["api","quality","reports",":id"]  (length 4)
  if (parts[2] === "reports" && parts.length === 4) {
    if (method === "GET") return await getReportById(ctx, req, res, access, parts[3]);
    if (method === "PATCH") return await patchReport(ctx, req, res, access, parts[3]);
    sendError(res, 405, "method_not_allowed");
    return;
  }

  // /api/quality/reports  →  parts = ["api","quality","reports"]  (length 3)
  if (parts[2] === "reports" && parts.length === 3) {
    if (method === "GET") return await listReports(ctx, req, res, access);
    sendError(res, 405, "method_not_allowed");
    return;
  }

  // /api/quality/detect  →  parts = ["api","quality","detect"]  (length 3)
  if (parts[2] === "detect" && parts.length === 3) {
    if (method === "POST") return await postDetect(ctx, req, res, access);
    sendError(res, 405, "method_not_allowed");
    return;
  }

  // /api/quality/summary  →  parts = ["api","quality","summary"]  (length 3)
  if (parts[2] === "summary" && parts.length === 3) {
    if (method === "GET") return await getSummary(ctx, req, res, access);
    sendError(res, 405, "method_not_allowed");
    return;
  }

  sendError(res, 404, "not_found");
}

/* ----------------- handlers ----------------- */

async function getAutoConfig(
  ctx: AppContext,
  _req: IncomingMessage,
  res: ServerResponse,
  access: QualityAccess,
): Promise<void> {
  const q = queryOf(_req.url ?? "/");
  const projectId = q.get("projectId");
  if (!projectId) return sendError(res, 400, "projectId is required");
  if (!(await access.canAccessProject(projectId))) {
    return sendError(res, 403, "forbidden");
  }
  const existing = await ctx.qualityAutoConfigs.findOne({ project_id: projectId });
  if (existing) {
    return sendJson(res, 200, {
      projectId,
      config: existing,
      is_default: false,
    });
  }
  // 无记录：返回默认（让前端 SSR 立即渲染）
  const now = nowIso();
  return sendJson(res, 200, {
    projectId,
    config: {
      ...DEFAULT_AUTO_CONFIG,
      project_id: projectId,
      created_at: now,
      updated_at: now,
    } satisfies QualityAutoConfig,
    is_default: true,
  });
}

async function putAutoConfig(
  ctx: AppContext,
  req: IncomingMessage,
  res: ServerResponse,
  access: QualityAccess,
): Promise<void> {
  let body: Record<string, unknown>;
  try {
    body = await readJsonBody(req);
  } catch (e) {
    return sendError(res, 400, `invalid_json: ${(e as Error).message}`);
  }
  const projectId = String(body.project_id ?? "").trim();
  if (!projectId) return sendError(res, 400, "project_id is required");
  if (!(await access.canAccessProject(projectId))) {
    return sendError(res, 403, "forbidden");
  }
  if (!access.isAdmin && !isEditorLike(access)) {
    return sendError(res, 403, "editor_role_required");
  }
  const now = nowIso();
  const enabled = body.enabled === true;
  const target_types = normalizeTargetTypes(body.target_types);
  const threshold = normalizeThreshold(body.threshold);
  const on_failure = normalizeOnFailure(body.on_failure);

  const config = await saveQualityAutoConfig(ctx, {
    projectId,
    enabled,
    targetTypes: target_types,
    threshold,
    onFailure: on_failure,
  });
  log.info({ event: "quality.auto_config.saved", projectId, userId: access.userId }, `auto config saved for ${projectId}`);
  return sendJson(res, 200, { projectId, config, is_default: false });
}

async function listReports(
  ctx: AppContext,
  _req: IncomingMessage,
  res: ServerResponse,
  access: QualityAccess,
): Promise<void> {
  const q = queryOf(_req.url ?? "/");
  const projectId = q.get("projectId");
  if (!projectId) return sendError(res, 400, "projectId is required");
  if (!(await access.canAccessProject(projectId))) {
    return sendError(res, 403, "forbidden");
  }
  const limit = Math.max(1, Math.min(200, Number(q.get("limit") ?? 50)));
  const offset = Math.max(0, Number(q.get("offset") ?? 0));
  // 单字段过滤：只查 projectId，其他字段客户端再 filter；保证 limit/offset 准确
  const all = (await ctx.qualityReports.findMany({ project_id: projectId })) as QualityReport[];
  const runId = q.get("runId");
  const nodeId = q.get("nodeId");
  const targetType = q.get("targetType");
  const targetId = q.get("targetId");
  const filtered = all.filter((r) => {
    if (runId && r.run_id !== runId) return false;
    if (nodeId && r.node_id !== nodeId) return false;
    if (targetType) {
      const tt = (r.details as { targetType?: string } | null)?.targetType;
      if (tt !== targetType) return false;
    }
    if (targetId) {
      const tid = (r.details as { targetId?: string } | null)?.targetId;
      if (tid !== targetId) return false;
    }
    return true;
  });
  // 按 created_at 倒序
  filtered.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
  const total = filtered.length;
  const reports = filtered.slice(offset, offset + limit);
  return sendJson(res, 200, { total, offset, limit, reports });
}

async function getReportById(
  ctx: AppContext,
  _req: IncomingMessage,
  res: ServerResponse,
  access: QualityAccess,
  reportId: string,
): Promise<void> {
  if (!reportId) return sendError(res, 400, "reportId is required");
  const r = (await ctx.qualityReports.findById(reportId)) as QualityReport | null;
  if (!r) return sendError(res, 404, "report not found");
  if (!(await access.canAccessProject(r.project_id))) {
    return sendError(res, 403, "forbidden");
  }
  return sendJson(res, 200, r);
}

/**
 * V2 W12+ QA-F22 人工复核反馈
 *  - 字段：reviewer_note (string), reviewed_by (string), reviewed_at (string), passed (boolean 可选, 覆盖质检结果)
 *  - 权限：项目成员即可（editor+）；admin 必填
 *  - 一旦写 reviewed_by/reviewed_at 不再可变（业务上视为不可篡改，但允许重新赋值更新备注）
 *  - 不会触发自动重试或回写
 */
async function patchReport(
  ctx: AppContext,
  req: IncomingMessage,
  res: ServerResponse,
  access: QualityAccess,
  reportId: string,
): Promise<void> {
  if (!reportId) return sendError(res, 400, "reportId is required");
  let body: Record<string, unknown>;
  try {
    body = await readJsonBody(req);
  } catch (e) {
    return sendError(res, 400, `invalid_json: ${(e as Error).message}`);
  }
  const existing = (await ctx.qualityReports.findById(reportId)) as QualityReport | null;
  if (!existing) return sendError(res, 404, "report not found");
  if (!(await access.canAccessProject(existing.project_id))) {
    return sendError(res, 403, "forbidden");
  }
  // 编辑权限：项目成员 + admin 之一
  if (!access.isAdmin && !access.userId) {
    return sendError(res, 403, "login_required");
  }
  const patch: Record<string, unknown> = {};
  if (typeof body.reviewer_note === "string") {
    patch.reviewer_note = body.reviewer_note.slice(0, 2000);
  }
  if (typeof body.reviewed_by === "string" && body.reviewed_by.length > 0) {
    patch.reviewed_by = body.reviewed_by.slice(0, 200);
  }
  if (typeof body.reviewed_at === "string" && body.reviewed_at.length > 0) {
    patch.reviewed_at = body.reviewed_at;
  }
  // 自动补：若传了 reviewed_by 但没传 reviewed_at，则自动写当前 ISO
  if (patch.reviewed_by && !patch.reviewed_at) {
    patch.reviewed_at = nowIso();
  }
  // 可选：人工覆盖 passed 结果（仅在显式 boolean 时）
  if (typeof body.passed === "boolean") {
    patch.passed = body.passed;
    patch.details = {
      ...(existing.details ?? {}),
      human_override: {
        passed: body.passed,
        reviewer: patch.reviewed_by ?? access.userId,
        reviewed_at: patch.reviewed_at ?? nowIso(),
        original_passed: existing.passed,
      },
    };
  }
  if (Object.keys(patch).length === 0) {
    return sendError(res, 400, "no_patchable_fields");
  }
  const updated = await reviewQualityReport(ctx, reportId, patch as Partial<QualityReport>);
  log.info(
    {
      event: "qa.f22.review_submitted",
      reportId,
      projectId: existing.project_id,
      reviewer: patch.reviewed_by ?? access.userId,
      passedOverride: typeof body.passed === "boolean" ? body.passed : null,
    },
    `人工复核反馈：${reportId} reviewer=${patch.reviewed_by ?? access.userId}`,
  );
  return sendJson(res, 200, { report: updated });
}

async function postDetect(
  ctx: AppContext,
  req: IncomingMessage,
  res: ServerResponse,
  access: QualityAccess,
): Promise<void> {
  let body: Record<string, unknown>;
  try {
    body = await readJsonBody(req);
  } catch (e) {
    return sendError(res, 400, `invalid_json: ${(e as Error).message}`);
  }
  const projectId = String(body.projectId ?? "").trim();
  const targetId = String(body.targetId ?? "").trim();
  const targetType = String(body.targetType ?? "image") as QualityTargetType;
  if (!projectId) return sendError(res, 400, "projectId is required");
  if (!targetId) return sendError(res, 400, "targetId is required");
  if (!["image", "video", "audio", "composition"].includes(targetType)) {
    return sendError(res, 400, "invalid targetType");
  }
  if (!(await access.canAccessProject(projectId))) {
    return sendError(res, 403, "forbidden");
  }
  if (!access.isAdmin && !isEditorLike(access)) {
    return sendError(res, 403, "editor_role_required");
  }
  const runId = body.runId ? String(body.runId) : undefined;
  const nodeId = body.nodeId ? String(body.nodeId) : undefined;
  // 质检服务是必需依赖。服务不可用时失败关闭，禁止生成随机分数伪造成功报告。
  const svc = (ctx as { qualityDetectionService?: { detect: (targetId: string, targetType: QualityTargetType, projectId: string, runId?: string, nodeId?: string) => Promise<{ reportId: string; overallScore: number; status: string }> } }).qualityDetectionService;
  if (!svc || typeof svc.detect !== "function") {
    log.error(
      { event: "quality.detect.service_unavailable", projectId, targetId, targetType },
      "质检服务未初始化，拒绝生成报告",
    );
    return sendError(res, 503, "quality_service_unavailable");
  }
  const out = await svc.detect(targetId, targetType, projectId, runId, nodeId);
  return sendJson(res, 200, { report: out });
}

async function getSummary(
  ctx: AppContext,
  _req: IncomingMessage,
  res: ServerResponse,
  access: QualityAccess,
): Promise<void> {
  const q = queryOf(_req.url ?? "/");
  const projectId = q.get("projectId");
  if (!projectId) return sendError(res, 400, "projectId is required");
  if (!(await access.canAccessProject(projectId))) {
    return sendError(res, 403, "forbidden");
  }
  const all = (await ctx.qualityReports.findMany({ project_id: projectId })) as QualityReport[];
  const summary = computeQualitySummary(all);
  return sendJson(res, 200, {
    projectId,
    summary,
  });
}

/* ----------------- 内部判定 ----------------- */

/**
 * 判定当前用户对项目是否有 editor+ 权限（简化版：仅靠 isAdmin；
 * 如未来需要更细粒度，可从 project-members 查 role）。
 */
function isEditorLike(_access: QualityAccess): boolean {
  // 当前 V2 简化为：isAdmin 即可；否则视为 viewer。
  // 真实权限：调用 access.canAccessProject 已经校验了成员资格。
  // 这里放一个 hook 位，未来可以在 ctx 里加 role 字段。
  return false;
}

/* ----------------- 删除端点（DELETE /api/quality/auto-config）----------------- */

export async function deleteQualityAutoConfig(
  ctx: AppContext,
  _req: IncomingMessage,
  res: ServerResponse,
  access: QualityAccess,
): Promise<void> {
  const q = queryOf(_req.url ?? "/");
  const projectId = q.get("projectId");
  if (!projectId) return sendError(res, 400, "projectId is required");
  if (!(await access.canAccessProject(projectId))) {
    return sendError(res, 403, "forbidden");
  }
  if (!access.isAdmin) {
    return sendError(res, 403, "admin_role_required");
  }
  const removed = await removeQualityAutoConfig(ctx, projectId);
  log.info({ event: "quality.auto_config.deleted", projectId, userId: access.userId }, `auto config deleted for ${projectId}`);
  return sendJson(res, 200, { projectId, removed: removed ? 1 : 0 });
}
