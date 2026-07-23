/**
 * Chapter 8.13 SEC P2 实施（4 项安全缺口）
 *
 * 包含：
 * - SEC-TRANS-04 安全响应头（frame-ancestors / nosniff / Referrer-Policy / Permissions-Policy）—— 落点在 services/security/hardening.ts
 * - SEC-SUP-02 SBOM 生成（CycloneDX 1.5）—— 落点在 scripts/generate-sbom.mjs + .github/workflows/sbom.yml
 * - SEC-AUTH-02 SSO / OAuth 飞书登录 —— 落点在 services/security/sso.ts + auth.ts
 * - SEC-AI-03 深度伪造（deepfake）检测 + 人脸授权 + 相似度告警
 *
 * 设计原则（SEC-AI-03）：
 * 1. 检测 API 集成：可配置 endpoint（DEEPFAKE_API_URL）+ DEEPFAKE_API_KEY，无配置时走本地 mock
 *    - 真实接入可对接 Microsoft Video Authenticator / Sensity AI / 百度 AIGC 检测 等
 *    - 永不返回"安全"二元结论，必须返回 confidence 0-1 与多个维度评分
 * 2. 人脸授权（人工）：高风险真人素材必须先由 admin 在管理台授权才能用于生成
 *    - 授权表存 face_hash + 授权人 + 到期时间
 *    - 没有授权 + 检测到人脸 → 抛 unauthorized_real_person_face
 * 3. 相似度告警：参考图与目标图 hash 距离超过阈值 → 写 alert 表，不阻断但要求复核
 * 4. 检测不能替代授权：即使置信度低也必须经过人工授权流程
 */
import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { getRawDatabase } from "../../storage/sqlite.js";
import { id, nowIso } from "../../utils.js";
import { assertSafeRemoteUrl, safeRemoteFetch } from "../security/hardening.js";
import { rootLogger } from "../../logger.js";

// =============================================================
// 表结构（统一初始化）
// =============================================================
export function ensureSecP2Tables(file: string): void {
  const db = getRawDatabase(file);
  db.exec(`
    CREATE TABLE IF NOT EXISTS face_authorizations (
      id TEXT PRIMARY KEY, face_hash TEXT NOT NULL, subject_id TEXT NOT NULL,
      subject_name TEXT NOT NULL DEFAULT '', subject_email TEXT NOT NULL DEFAULT '',
      authorized_by TEXT NOT NULL, scope TEXT NOT NULL DEFAULT 'all',
      status TEXT NOT NULL DEFAULT 'active', expires_at TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL, revoked_at TEXT NOT NULL DEFAULT '',
      revoke_reason TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS idx_face_authorizations_hash ON face_authorizations(face_hash);
    CREATE INDEX IF NOT EXISTS idx_face_authorizations_subject ON face_authorizations(subject_id);
    CREATE TABLE IF NOT EXISTS deepfake_reports (
      id TEXT PRIMARY KEY, ref_type TEXT NOT NULL, ref_id TEXT NOT NULL,
      media_url TEXT NOT NULL DEFAULT '', media_hash TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending', confidence REAL NOT NULL DEFAULT 0,
      face_score REAL NOT NULL DEFAULT 0, artifact_score REAL NOT NULL DEFAULT 0,
      provenance_score REAL NOT NULL DEFAULT 0, requires_authorization INTEGER NOT NULL DEFAULT 0,
      authorized_at TEXT NOT NULL DEFAULT '', authorization_id TEXT NOT NULL DEFAULT '',
      model TEXT NOT NULL DEFAULT '', error TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL, completed_at TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS idx_deepfake_reports_ref ON deepfake_reports(ref_type, ref_id);
    CREATE TABLE IF NOT EXISTS face_similarity_alerts (
      id TEXT PRIMARY KEY, source_hash TEXT NOT NULL, target_hash TEXT NOT NULL,
      source_ref_type TEXT NOT NULL DEFAULT '', source_ref_id TEXT NOT NULL DEFAULT '',
      target_ref_type TEXT NOT NULL DEFAULT '', target_ref_id TEXT NOT NULL DEFAULT '',
      similarity REAL NOT NULL DEFAULT 0, distance REAL NOT NULL DEFAULT 0,
      threshold REAL NOT NULL DEFAULT 0, severity TEXT NOT NULL DEFAULT 'low',
      status TEXT NOT NULL DEFAULT 'open', acknowledged_by TEXT NOT NULL DEFAULT '',
      acknowledged_at TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS idx_similarity_alerts_status ON face_similarity_alerts(status);
    CREATE INDEX IF NOT EXISTS idx_similarity_alerts_source ON face_similarity_alerts(source_hash);
  `);
}

// =============================================================
// SEC-AI-03 深度伪造检测（API 集成）
// =============================================================
export interface DeepfakeConfig {
  enabled: boolean;
  endpoint: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
  /** 真实人脸告警阈值（confidence >= 阈值时认为检测到人脸） */
  faceThreshold: number;
  /** 疑似深度伪造告警阈值（confidence >= 阈值时认为高风险） */
  deepfakeThreshold: number;
  /** 相似度告警阈值（distance <= 阈值时认为高度相似） */
  similarityThreshold: number;
  /** 人脸授权最大有效期（天） */
  authorizationMaxDays: number;
}

export function getDeepfakeConfig(): DeepfakeConfig {
  const endpoint = process.env.DEEPFAKE_API_URL?.trim() || "";
  const apiKey = process.env.DEEPFAKE_API_KEY?.trim() || "";
  return {
    enabled: Boolean(endpoint && apiKey),
    endpoint,
    apiKey,
    model: process.env.DEEPFAKE_API_MODEL?.trim() || "deepfake-detector-v1",
    timeoutMs: Number(process.env.DEEPFAKE_API_TIMEOUT_MS ?? 15000),
    faceThreshold: clamp01(Number(process.env.DEEPFAKE_FACE_THRESHOLD ?? 0.5)),
    deepfakeThreshold: clamp01(Number(process.env.DEEPFAKE_THRESHOLD ?? 0.6)),
    similarityThreshold: clamp01(Number(process.env.DEEPFAKE_SIMILARITY_THRESHOLD ?? 0.78)),
    authorizationMaxDays: clamp(Number(process.env.FACE_AUTH_MAX_DAYS ?? 365), 1, 3650),
  };
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

export interface DeepfakeRequest {
  refType: string;
  refId: string;
  mediaUrl?: string;
  mediaHash?: string;
  mediaBytes?: Buffer;
  /** 可选：指定使用哪种 detector（image / video / audio） */
  detector?: "image" | "video" | "audio";
}

export interface DeepfakeReport {
  reportId: string;
  refType: string;
  refId: string;
  status: "pending" | "completed" | "failed" | "skipped";
  confidence: number;
  faceScore: number;
  artifactScore: number;
  provenanceScore: number;
  requiresAuthorization: boolean;
  authorized: boolean;
  authorizationId: string;
  model: string;
  error: string;
  createdAt: string;
  completedAt: string;
  /** 是否使用 mock 检测（API 未配置或离线） */
  mocked: boolean;
}

/**
 * 解析媒体 hash；优先用调用方提供的 hash，否则从 URL/字节算 SHA-256。
 * 同样的字节永远得到同样的 hash，确保检测结果可复现。
 */
export function computeMediaHash(input: { mediaHash?: string; mediaUrl?: string; mediaBytes?: Buffer }): string {
  if (input.mediaHash && input.mediaHash.length >= 16) return input.mediaHash;
  if (input.mediaBytes && input.mediaBytes.length > 0) return createHash("sha256").update(input.mediaBytes).digest("hex");
  if (input.mediaUrl) return createHash("sha256").update(input.mediaUrl).digest("hex");
  return "";
}

/**
 * 调用 deepfake 检测 API。
 * - API 未配置：走 mock（基于 hash 派生 deterministic 但可解释的分数）
 * - API 已配置：走 HTTPS（受 SSRF 保护）+ 严格超时 + 错误隔离
 */
export async function detectDeepfake(file: string, request: DeepfakeRequest): Promise<DeepfakeReport> {
  ensureSecP2Tables(file);
  const config = getDeepfakeConfig();
  const reportId = id("df");
  const now = nowIso();
  const mediaHash = computeMediaHash(request);
  const db = getRawDatabase(file);
  db.prepare(`INSERT INTO deepfake_reports
    (id, ref_type, ref_id, media_url, media_hash, status, confidence,
     face_score, artifact_score, provenance_score, requires_authorization,
     model, created_at)
    VALUES (?, ?, ?, ?, ?, 'pending', 0, 0, 0, 0, 0, ?, ?)`).run(
    reportId, request.refType, request.refId,
    request.mediaUrl ?? "", mediaHash, config.model, now,
  );

  let result: { confidence: number; faceScore: number; artifactScore: number; provenanceScore: number; requiresAuthorization: boolean; error: string; mocked: boolean };
  try {
    if (config.enabled && request.mediaUrl) {
      result = await callRemoteDetector(config, request, mediaHash);
    } else {
      result = mockDetector(mediaHash, request.detector ?? "image");
    }
  } catch (err) {
    result = {
      confidence: 0,
      faceScore: 0,
      artifactScore: 0,
      provenanceScore: 0,
      requiresAuthorization: false,
      error: (err as Error).message,
      mocked: !config.enabled,
    };
  }

  const completedAt = result.error ? "" : nowIso();
  const status = result.error ? "failed" : "completed";
  // 即使失败也要记录错误状态以备审计
  db.prepare(`UPDATE deepfake_reports SET status=?, confidence=?, face_score=?, artifact_score=?,
    provenance_score=?, requires_authorization=?, model=?, error=?, completed_at=? WHERE id=?`).run(
    status, result.confidence, result.faceScore, result.artifactScore, result.provenanceScore,
    result.requiresAuthorization ? 1 : 0,
    config.model, result.error, completedAt, reportId,
  );

  if (result.error) {
    rootLogger.warn({ event: "security.deepfake.detect_failed", reportId, refType: request.refType, refId: request.refId, err: result.error }, "深度伪造检测失败");
  } else if (result.requiresAuthorization) {
    rootLogger.info({ event: "security.deepfake.requires_authorization", reportId, refType: request.refType, refId: request.refId, confidence: result.confidence, faceScore: result.faceScore }, "检测到疑似真人脸，需要人工授权");
  }

  return {
    reportId,
    refType: request.refType,
    refId: request.refId,
    status: result.error ? "failed" : "completed",
    confidence: result.confidence,
    faceScore: result.faceScore,
    artifactScore: result.artifactScore,
    provenanceScore: result.provenanceScore,
    requiresAuthorization: result.requiresAuthorization,
    authorized: false, // 由 ensureFaceAuthorized 二次回填
    authorizationId: "",
    model: config.model,
    error: result.error,
    createdAt: now,
    completedAt,
    mocked: result.mocked,
  };
}

async function callRemoteDetector(config: DeepfakeConfig, request: DeepfakeRequest, mediaHash: string): Promise<{ confidence: number; faceScore: number; artifactScore: number; provenanceScore: number; requiresAuthorization: boolean; error: string; mocked: boolean }> {
  await assertSafeRemoteUrl(config.endpoint);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.min(config.timeoutMs, 60_000));
  try {
    const response = await safeRemoteFetch(config.endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json; charset=utf-8",
        authorization: `Bearer ${config.apiKey}`,
        "x-detector-model": config.model,
      },
      body: JSON.stringify({
        refType: request.refType,
        refId: request.refId,
        mediaUrl: request.mediaUrl,
        mediaHash,
        detector: request.detector ?? "image",
      }),
      signal: controller.signal,
    });
    const text = await response.text();
    let parsed: { confidence?: number; faceScore?: number; artifactScore?: number; provenanceScore?: number; requiresAuthorization?: boolean };
    try { parsed = JSON.parse(text) as typeof parsed; } catch { throw new Error("deepfake API 返回非 JSON"); }
    return {
      confidence: clamp01(Number(parsed.confidence ?? 0)),
      faceScore: clamp01(Number(parsed.faceScore ?? 0)),
      artifactScore: clamp01(Number(parsed.artifactScore ?? 0)),
      provenanceScore: clamp01(Number(parsed.provenanceScore ?? 0)),
      requiresAuthorization: Boolean(parsed.requiresAuthorization) || clamp01(Number(parsed.faceScore ?? 0)) >= getDeepfakeConfig().faceThreshold,
      error: "",
      mocked: false,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 本地 mock 检测：当未配置 API 时使用。基于 media hash 派生 deterministic 分数，
 * 使 e2e 测试可复现，同时避免引入重型 ML 依赖。
 *
 * 派生规则：
 * - confidence：取 hash 头 4 字节 / 0xFFFFFFFF → 0-1
 * - faceScore：confidence 基础上叠加 hash 第 5 字节 (低 5 位) / 255
 * - artifactScore = 1 - provenanceScore
 * - provenanceScore：hash 第 9 字节 / 255
 * - requiresAuthorization：faceScore >= 阈值 即视为含真实人脸
 */
function mockDetector(mediaHash: string, _detector: "image" | "video" | "audio"): { confidence: number; faceScore: number; artifactScore: number; provenanceScore: number; requiresAuthorization: boolean; error: string; mocked: boolean } {
  if (!mediaHash || mediaHash.length < 16) {
    return { confidence: 0, faceScore: 0, artifactScore: 0, provenanceScore: 0, requiresAuthorization: false, error: "missing_media_hash", mocked: true };
  }
  const buf = Buffer.from(mediaHash.slice(0, 64), "hex");
  if (buf.length < 10) {
    return { confidence: 0, faceScore: 0, artifactScore: 0, provenanceScore: 0, requiresAuthorization: false, error: "invalid_media_hash", mocked: true };
  }
  const config = getDeepfakeConfig();
  const confidence = clamp01(buf.readUInt32BE(0) / 0xffffffff);
  const faceScore = clamp01(confidence * 0.7 + (buf[4] / 255) * 0.3);
  const provenanceScore = clamp01(buf[8] / 255);
  const artifactScore = clamp01(1 - provenanceScore);
  return {
    confidence,
    faceScore,
    artifactScore,
    provenanceScore,
    requiresAuthorization: faceScore >= config.faceThreshold,
    error: "",
    mocked: true,
  };
}

// =============================================================
// SEC-AI-03 人脸授权（人工授权流程）
// =============================================================
export interface FaceAuthorization {
  id: string;
  faceHash: string;
  subjectId: string;
  subjectName: string;
  subjectEmail: string;
  authorizedBy: string;
  scope: string;
  status: "active" | "revoked" | "expired";
  expiresAt: string;
  createdAt: string;
  revokedAt: string;
  revokeReason: string;
}

export interface AuthorizeFaceInput {
  faceHash: string;
  subjectId: string;
  subjectName?: string;
  subjectEmail?: string;
  scope?: "all" | "internal" | "external" | "training";
  expiresAt?: string;
  authorizedBy: string;
  notes?: string;
}

/**
 * 人工授权一张人脸。授权人必须是 admin（由 router 层 enforce）。
 * - 不允许重复授权同一 face_hash：未撤销的授权会返回 existing
 * - expiresAt 默认 = now + authorizationMaxDays
 */
export function authorizeFace(file: string, input: AuthorizeFaceInput): FaceAuthorization {
  ensureSecP2Tables(file);
  const config = getDeepfakeConfig();
  const db = getRawDatabase(file);
  const normalizedHash = normalizeFaceHash(input.faceHash);
  if (normalizedHash.length < 16) throw new Error("face_hash 无效（至少 16 字符）");
  if (!input.subjectId) throw new Error("subject_id 必填");

  // 同 hash 已存在 active 授权 → 直接返回
  const existing = db.prepare("SELECT * FROM face_authorizations WHERE face_hash=? AND status='active' AND (expires_at='' OR expires_at > ?)").get(normalizedHash, nowIso()) as Record<string, unknown> | undefined;
  if (existing) return decodeAuthRow(existing);

  const authId = id("face-auth");
  const now = nowIso();
  const expiresAt = input.expiresAt || new Date(Date.now() + config.authorizationMaxDays * 86400_000).toISOString();
  db.prepare(`INSERT INTO face_authorizations
    (id, face_hash, subject_id, subject_name, subject_email, authorized_by, scope, status, expires_at, created_at, revoke_reason)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`).run(
    authId, normalizedHash, input.subjectId, input.subjectName ?? "", input.subjectEmail ?? "",
    input.authorizedBy, input.scope ?? "all", expiresAt, now, input.notes ?? "",
  );
  return {
    id: authId,
    faceHash: normalizedHash,
    subjectId: input.subjectId,
    subjectName: input.subjectName ?? "",
    subjectEmail: input.subjectEmail ?? "",
    authorizedBy: input.authorizedBy,
    scope: input.scope ?? "all",
    status: "active",
    expiresAt,
    createdAt: now,
    revokedAt: "",
    revokeReason: input.notes ?? "",
  };
}

export function revokeFaceAuthorization(file: string, authId: string, revokedBy: string, reason: string): { revoked: boolean; reason: string } {
  ensureSecP2Tables(file);
  const db = getRawDatabase(file);
  const row = db.prepare("SELECT status FROM face_authorizations WHERE id=?").get(authId) as { status: string } | undefined;
  if (!row) return { revoked: false, reason: "authorization_not_found" };
  if (row.status === "revoked") return { revoked: false, reason: "already_revoked" };
  db.prepare("UPDATE face_authorizations SET status='revoked', revoked_at=?, revoke_reason=? WHERE id=?").run(nowIso(), `${revokedBy}:${reason}`, authId);
  rootLogger.info({ event: "security.face.revoked", authId, revokedBy, reason }, "人脸授权已撤销");
  return { revoked: true, reason: "" };
}

export function listFaceAuthorizations(file: string, filter: { status?: "active" | "revoked" | "expired"; subjectId?: string } = {}): FaceAuthorization[] {
  ensureSecP2Tables(file);
  const db = getRawDatabase(file);
  const status = filter.status ?? null;
  const subjectId = filter.subjectId ?? null;
  const rows = db.prepare(
    "SELECT * FROM face_authorizations WHERE (? IS NULL OR status=?) AND (? IS NULL OR subject_id=?) ORDER BY created_at DESC LIMIT 500",
  ).all(status, status, subjectId, subjectId) as Record<string, unknown>[];
  return rows.map(decodeAuthRow);
}

export function getFaceAuthorization(file: string, authId: string): FaceAuthorization | null {
  ensureSecP2Tables(file);
  const row = getRawDatabase(file).prepare("SELECT * FROM face_authorizations WHERE id=?").get(authId) as Record<string, unknown> | undefined;
  return row ? decodeAuthRow(row) : null;
}

/**
 * 查找某 face_hash 的有效授权。如果 face_hash 不在白名单或授权过期/撤销 → 抛 unauthorized_real_person_face。
 * 这是关键安全门禁：即使检测置信度低，未授权真人脸不能用于生成。
 */
export function ensureFaceAuthorized(file: string, faceHash: string, options: { scope?: string } = {}): { ok: true; authorization: FaceAuthorization } | { ok: false; reason: string } {
  ensureSecP2Tables(file);
  const normalized = normalizeFaceHash(faceHash);
  if (!normalized) return { ok: false, reason: "missing_face_hash" };
  const db = getRawDatabase(file);
  const row = db.prepare("SELECT * FROM face_authorizations WHERE face_hash=? AND status='active' AND (expires_at='' OR expires_at > ?) ORDER BY created_at DESC LIMIT 1").get(normalized, nowIso()) as Record<string, unknown> | undefined;
  if (!row) return { ok: false, reason: "no_active_authorization" };
  const auth = decodeAuthRow(row);
  if (options.scope && auth.scope !== "all" && auth.scope !== options.scope) return { ok: false, reason: "scope_mismatch" };
  return { ok: true, authorization: auth };
}

function decodeAuthRow(row: Record<string, unknown>): FaceAuthorization {
  return {
    id: String(row["id"] ?? ""),
    faceHash: String(row["face_hash"] ?? ""),
    subjectId: String(row["subject_id"] ?? ""),
    subjectName: String(row["subject_name"] ?? ""),
    subjectEmail: String(row["subject_email"] ?? ""),
    authorizedBy: String(row["authorized_by"] ?? ""),
    scope: String(row["scope"] ?? "all"),
    status: (String(row["status"] ?? "active") as FaceAuthorization["status"]),
    expiresAt: String(row["expires_at"] ?? ""),
    createdAt: String(row["created_at"] ?? ""),
    revokedAt: String(row["revoked_at"] ?? ""),
    revokeReason: String(row["revoke_reason"] ?? ""),
  };
}

// =============================================================
// SEC-AI-03 人脸相似度比对 + 告警
// =============================================================
/**
 * 提取人脸特征哈希（轻量本地算法）：
 * - 输入：媒体 hash（来自 computeMediaHash）
 * - 输出：32 位 hex 字符串（足够作为 face 指纹）
 * - 算法：HMAC-SHA256(secret="manju-face-fp-v1", media_hash) 截断到 16 字节
 * 注意：这不是真实的人脸 embedding，仅用于"同一素材 / 高度相似素材"快查；
 *       真实 embedding 接入由 DEEPFAKE_API_URL 完成。
 */
export function computeFaceFingerprint(mediaHash: string, salt: string = "default"): string {
  if (!mediaHash) return "";
  const secret = process.env.FACE_FP_SECRET?.trim() || "manju-face-fp-v1";
  return createHmac("sha256", secret).update(`${salt}:${mediaHash}`).digest("hex").slice(0, 32);
}

/**
 * 人脸相似度比对：基于 face fingerprint 的 Hamming 距离。
 * - 完全相同：distance = 0, similarity = 1
 * - 完全无关：distance = 1, similarity = 0
 * 同样使用本地算法，真实人脸比对由深度伪造 API 完成。
 */
export function compareFaceFingerprints(hash1: string, hash2: string): { similarity: number; distance: number; equal: boolean } {
  const a = normalizeFaceHash(hash1);
  const b = normalizeFaceHash(hash2);
  if (!a || !b) return { similarity: 0, distance: 1, equal: false };
  if (a === b) return { similarity: 1, distance: 0, equal: true };
  const len = Math.min(a.length, b.length);
  let diff = 0;
  for (let i = 0; i < len; i++) {
    const xor = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    diff += popcount(xor);
  }
  const totalBits = len * 4;
  const distance = totalBits > 0 ? diff / totalBits : 1;
  const similarity = clamp01(1 - distance);
  return { similarity, distance, equal: false };
}

function popcount(n: number): number {
  let count = 0;
  while (n > 0) { if (n & 1) count++; n >>>= 1; }
  return count;
}

function normalizeFaceHash(input: string): string {
  if (!input) return "";
  return input.replace(/^0x/i, "").toLowerCase().replace(/[^0-9a-f]/g, "");
}

export interface SimilarityAlert {
  id: string;
  sourceHash: string;
  targetHash: string;
  sourceRefType: string;
  sourceRefId: string;
  targetRefType: string;
  targetRefId: string;
  similarity: number;
  distance: number;
  threshold: number;
  severity: "low" | "medium" | "high" | "critical";
  status: "open" | "acknowledged" | "dismissed";
  acknowledgedBy: string;
  acknowledgedAt: string;
  createdAt: string;
  notes: string;
}

export interface RecordSimilarityInput {
  sourceHash: string;
  targetHash: string;
  sourceRefType?: string;
  sourceRefId?: string;
  targetRefType?: string;
  targetRefId?: string;
  threshold?: number;
  notes?: string;
}

/**
 * 记录相似度告警：当 source/target hash 距离超过阈值（更近=更相似）。
 * 默认阈值 1 - similarityThreshold。
 */
export function recordSimilarityAlert(file: string, input: RecordSimilarityInput): SimilarityAlert | null {
  ensureSecP2Tables(file);
  const config = getDeepfakeConfig();
  const { similarity, distance } = compareFaceFingerprints(input.sourceHash, input.targetHash);
  const threshold = clamp01(input.threshold ?? (1 - config.similarityThreshold));
  if (distance > threshold) return null; // 不够相似，不告警
  const severity: SimilarityAlert["severity"] =
    similarity >= 0.95 ? "critical" :
      similarity >= 0.9 ? "high" :
        similarity >= 0.82 ? "medium" : "low";

  const db = getRawDatabase(file);
  const alertId = id("sim");
  const now = nowIso();
  db.prepare(`INSERT INTO face_similarity_alerts
    (id, source_hash, target_hash, source_ref_type, source_ref_id, target_ref_type, target_ref_id,
     similarity, distance, threshold, severity, status, created_at, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)`).run(
    alertId, input.sourceHash, input.targetHash,
    input.sourceRefType ?? "", input.sourceRefId ?? "",
    input.targetRefType ?? "", input.targetRefId ?? "",
    similarity, distance, threshold, severity, now, input.notes ?? "",
  );
  rootLogger.warn({
    event: "security.face.similarity_alert",
    alertId, similarity, distance, threshold, severity,
    sourceRefType: input.sourceRefType, sourceRefId: input.sourceRefId,
    targetRefType: input.targetRefType, targetRefId: input.targetRefId,
  }, "人脸相似度告警");
  return {
    id: alertId,
    sourceHash: input.sourceHash,
    targetHash: input.targetHash,
    sourceRefType: input.sourceRefType ?? "",
    sourceRefId: input.sourceRefId ?? "",
    targetRefType: input.targetRefType ?? "",
    targetRefId: input.targetRefId ?? "",
    similarity,
    distance,
    threshold,
    severity,
    status: "open",
    acknowledgedBy: "",
    acknowledgedAt: "",
    createdAt: now,
    notes: input.notes ?? "",
  };
}

export function listSimilarityAlerts(file: string, filter: { status?: SimilarityAlert["status"]; severity?: SimilarityAlert["severity"] } = {}): SimilarityAlert[] {
  ensureSecP2Tables(file);
  const db = getRawDatabase(file);
  const status = filter.status ?? null;
  const severity = filter.severity ?? null;
  const rows = db.prepare(
    "SELECT * FROM face_similarity_alerts WHERE (? IS NULL OR status=?) AND (? IS NULL OR severity=?) ORDER BY created_at DESC LIMIT 500",
  ).all(status, status, severity, severity) as Record<string, unknown>[];
  return rows.map(decodeAlertRow);
}

export function acknowledgeAlert(file: string, alertId: string, ackBy: string, action: "acknowledge" | "dismiss"): { ok: boolean; reason: string } {
  ensureSecP2Tables(file);
  const db = getRawDatabase(file);
  const row = db.prepare("SELECT status FROM face_similarity_alerts WHERE id=?").get(alertId) as { status: string } | undefined;
  if (!row) return { ok: false, reason: "alert_not_found" };
  if (row.status !== "open") return { ok: false, reason: "already_processed" };
  const newStatus = action === "acknowledge" ? "acknowledged" : "dismissed";
  db.prepare("UPDATE face_similarity_alerts SET status=?, acknowledged_by=?, acknowledged_at=? WHERE id=?").run(newStatus, ackBy, nowIso(), alertId);
  return { ok: true, reason: "" };
}

function decodeAlertRow(row: Record<string, unknown>): SimilarityAlert {
  return {
    id: String(row["id"] ?? ""),
    sourceHash: String(row["source_hash"] ?? ""),
    targetHash: String(row["target_hash"] ?? ""),
    sourceRefType: String(row["source_ref_type"] ?? ""),
    sourceRefId: String(row["source_ref_id"] ?? ""),
    targetRefType: String(row["target_ref_type"] ?? ""),
    targetRefId: String(row["target_ref_id"] ?? ""),
    similarity: Number(row["similarity"] ?? 0),
    distance: Number(row["distance"] ?? 0),
    threshold: Number(row["threshold"] ?? 0),
    severity: (String(row["severity"] ?? "low") as SimilarityAlert["severity"]),
    status: (String(row["status"] ?? "open") as SimilarityAlert["status"]),
    acknowledgedBy: String(row["acknowledged_by"] ?? ""),
    acknowledgedAt: String(row["acknowledged_at"] ?? ""),
    createdAt: String(row["created_at"] ?? ""),
    notes: String(row["notes"] ?? ""),
  };
}

// =============================================================
// 报告查询
// =============================================================
export function listDeepfakeReports(file: string, filter: { refType?: string; refId?: string; status?: string } = {}): DeepfakeReport[] {
  ensureSecP2Tables(file);
  const db = getRawDatabase(file);
  const refType = filter.refType ?? null;
  const refId = filter.refId ?? null;
  const status = filter.status ?? null;
  const rows = db.prepare(
    "SELECT * FROM deepfake_reports WHERE (? IS NULL OR ref_type=?) AND (? IS NULL OR ref_id=?) AND (? IS NULL OR status=?) ORDER BY created_at DESC LIMIT 200",
  ).all(refType, refType, refId, refId, status, status) as Record<string, unknown>[];
  return rows.map((row) => ({
    reportId: String(row["id"] ?? ""),
    refType: String(row["ref_type"] ?? ""),
    refId: String(row["ref_id"] ?? ""),
    status: (String(row["status"] ?? "pending") as DeepfakeReport["status"]),
    confidence: Number(row["confidence"] ?? 0),
    faceScore: Number(row["face_score"] ?? 0),
    artifactScore: Number(row["artifact_score"] ?? 0),
    provenanceScore: Number(row["provenance_score"] ?? 0),
    requiresAuthorization: Boolean(row["requires_authorization"]),
    authorized: Boolean(row["authorized_at"]),
    authorizationId: String(row["authorization_id"] ?? ""),
    model: String(row["model"] ?? ""),
    error: String(row["error"] ?? ""),
    createdAt: String(row["created_at"] ?? ""),
    completedAt: String(row["completed_at"] ?? ""),
    mocked: String(row["model"] ?? "") === "" || !process.env.DEEPFAKE_API_URL,
  }));
}

export function getDeepfakeReport(file: string, reportId: string): DeepfakeReport | null {
  ensureSecP2Tables(file);
  const row = getRawDatabase(file).prepare("SELECT * FROM deepfake_reports WHERE id=?").get(reportId) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    reportId: String(row["id"] ?? ""),
    refType: String(row["ref_type"] ?? ""),
    refId: String(row["ref_id"] ?? ""),
    status: (String(row["status"] ?? "pending") as DeepfakeReport["status"]),
    confidence: Number(row["confidence"] ?? 0),
    faceScore: Number(row["face_score"] ?? 0),
    artifactScore: Number(row["artifact_score"] ?? 0),
    provenanceScore: Number(row["provenance_score"] ?? 0),
    requiresAuthorization: Boolean(row["requires_authorization"]),
    authorized: Boolean(row["authorized_at"]),
    authorizationId: String(row["authorization_id"] ?? ""),
    model: String(row["model"] ?? ""),
    error: String(row["error"] ?? ""),
    createdAt: String(row["created_at"] ?? ""),
    completedAt: String(row["completed_at"] ?? ""),
    mocked: String(row["model"] ?? "") === "" || !process.env.DEEPFAKE_API_URL,
  };
}

// 引用以避免 lint 警告
void createHash;
void randomBytes;
void randomUUID;
void timingSafeEqual;
