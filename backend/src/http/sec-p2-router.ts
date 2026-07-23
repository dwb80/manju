/**
 * Chapter 8.13 SEC P2 HTTP 端点
 *
 * 路由前缀：/api/sec/face/* + /api/sec/deepfake/*
 *
 * 端点列表：
 * - POST   /api/sec/deepfake/detect          （editor+）触发深度伪造检测
 * - GET    /api/sec/deepfake/reports          （editor+）列出报告
 * - GET    /api/sec/deepfake/reports/:id      （editor+）报告详情
 * - POST   /api/sec/face/authorize            （admin）人工授权人脸
 * - GET    /api/sec/face/authorizations       （editor+）列出授权
 * - DELETE /api/sec/face/authorizations/:id   （admin）撤销授权
 * - POST   /api/sec/face/compare              （editor+）比对两个 face 哈希的相似度
 * - POST   /api/sec/face/alert                （editor+）手动记录相似度告警
 * - GET    /api/sec/face/alerts               （editor+）列出告警
 * - POST   /api/sec/face/alerts/:id/ack       （editor+）确认告警
 * - POST   /api/sec/face/alerts/:id/dismiss   （editor+）忽略告警
 * - GET    /api/sec/face/check                （editor+）校验 face_hash 是否已授权
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { sendJson, sendError, readJsonBody } from "./http-utils.js";
import {
  authorizeFace, revokeFaceAuthorization, listFaceAuthorizations, getFaceAuthorization, ensureFaceAuthorized,
  detectDeepfake, listDeepfakeReports, getDeepfakeReport,
  compareFaceFingerprints, computeFaceFingerprint, computeMediaHash, getDeepfakeConfig,
  recordSimilarityAlert, listSimilarityAlerts, acknowledgeAlert, ensureSecP2Tables,
} from "../services/module-domain/sec-p2-service.js";

interface Principal { userId: string; isAdmin: boolean; role: string; }

function dataFile(): string {
  return process.env["DATA_FILE"] ?? "data/app.db";
}

function isAdmin(principal: Principal): boolean {
  return principal.isAdmin || principal.role === "admin";
}

function isEditor(principal: Principal): boolean {
  return isAdmin(principal) || principal.role === "editor";
}

function requireAdmin(principal: Principal, res: ServerResponse): boolean {
  if (!isAdmin(principal)) { sendError(res, 403, "admin_required", "需要管理员权限"); return false; }
  return true;
}

function requireEditor(principal: Principal, res: ServerResponse): boolean {
  if (!isEditor(principal)) { sendError(res, 403, "editor_required", "需要 editor 以上权限"); return false; }
  return true;
}

export async function handleSecP2Router(
  req: IncomingMessage,
  res: ServerResponse,
  principal: Principal,
  url: URL,
): Promise<boolean> {
  const file = dataFile();
  const path = url.pathname;
  const method = req.method ?? "GET";
  ensureSecP2Tables(file);

  // -------------------- Deepfake 检测 --------------------
  if (path === "/api/sec/deepfake/detect" && method === "POST") {
    if (!requireEditor(principal, res)) return true;
    const body = await readJsonBody(req);
    const refType = String(body["refType"] ?? "").trim();
    const refId = String(body["refId"] ?? "").trim();
    if (!refType || !refId) { sendError(res, 400, "ref_required", "refType/refId 必填"); return true; }
    const mediaUrl = typeof body["mediaUrl"] === "string" ? String(body["mediaUrl"]) : undefined;
    const mediaHash = typeof body["mediaHash"] === "string" ? String(body["mediaHash"]) : undefined;
    const detector = (["image", "video", "audio"] as const).includes(body["detector"] as never)
      ? (body["detector"] as "image" | "video" | "audio")
      : undefined;
    try {
      const report = await detectDeepfake(file, { refType, refId, mediaUrl, mediaHash, detector });
      // 若需要授权，尝试自动匹配
      if (report.requiresAuthorization && mediaHash) {
        const fingerprint = computeFaceFingerprint(mediaHash);
        const check = ensureFaceAuthorized(file, fingerprint);
        if (check.ok) {
          // 标记已授权
          report.authorized = true;
          report.authorizationId = check.authorization.id;
          // 持久化回表
          const db = (await import("../storage/sqlite.js")).getRawDatabase(file);
          db.prepare("UPDATE deepfake_reports SET authorized_at=?, authorization_id=? WHERE id=?")
            .run(new Date().toISOString(), check.authorization.id, report.reportId);
        }
      }
      sendJson(res, 200, { ...report, config: getDeepfakeConfig() });
    } catch (err) {
      sendError(res, 500, "deepfake_detect_failed", (err as Error).message);
    }
    return true;
  }

  if (path === "/api/sec/deepfake/reports" && method === "GET") {
    if (!requireEditor(principal, res)) return true;
    const refType = url.searchParams.get("refType") ?? undefined;
    const refId = url.searchParams.get("refId") ?? undefined;
    const status = url.searchParams.get("status") ?? undefined;
    sendJson(res, 200, { items: listDeepfakeReports(file, { refType, refId, status }) });
    return true;
  }

  if (path.startsWith("/api/sec/deepfake/reports/") && method === "GET") {
    if (!requireEditor(principal, res)) return true;
    const reportId = path.slice("/api/sec/deepfake/reports/".length);
    const report = getDeepfakeReport(file, reportId);
    if (!report) { sendError(res, 404, "report_not_found", "报告不存在"); return true; }
    sendJson(res, 200, report);
    return true;
  }

  // -------------------- 人脸授权 --------------------
  if (path === "/api/sec/face/authorize" && method === "POST") {
    if (!requireAdmin(principal, res)) return true;
    const body = await readJsonBody(req);
    const faceHash = String(body["faceHash"] ?? "").trim();
    const subjectId = String(body["subjectId"] ?? "").trim();
    if (!faceHash || !subjectId) { sendError(res, 400, "face_subject_required", "faceHash/subjectId 必填"); return true; }
    try {
      const auth = authorizeFace(file, {
        faceHash,
        subjectId,
        subjectName: String(body["subjectName"] ?? ""),
        subjectEmail: String(body["subjectEmail"] ?? ""),
        scope: body["scope"] === "internal" || body["scope"] === "external" || body["scope"] === "training" ? body["scope"] : "all",
        expiresAt: typeof body["expiresAt"] === "string" ? body["expiresAt"] : undefined,
        authorizedBy: principal.userId,
        notes: String(body["notes"] ?? ""),
      });
      sendJson(res, 201, auth);
    } catch (err) {
      sendError(res, 400, "authorize_failed", (err as Error).message);
    }
    return true;
  }

  if (path === "/api/sec/face/authorizations" && method === "GET") {
    if (!requireEditor(principal, res)) return true;
    const status = url.searchParams.get("status") as "active" | "revoked" | "expired" | null;
    const subjectId = url.searchParams.get("subjectId") ?? undefined;
    sendJson(res, 200, { items: listFaceAuthorizations(file, { status: status ?? undefined, subjectId }) });
    return true;
  }

  if (path.startsWith("/api/sec/face/authorizations/") && method === "DELETE") {
    if (!requireAdmin(principal, res)) return true;
    const authId = path.slice("/api/sec/face/authorizations/".length);
    const body = await readJsonBody(req).catch(() => ({} as Record<string, unknown>));
    const reason = String((body as Record<string, unknown>)["reason"] ?? "admin_revoke");
    const result = revokeFaceAuthorization(file, authId, principal.userId, reason);
    if (!result.revoked) { sendError(res, 400, result.reason, `撤销失败：${result.reason}`); return true; }
    sendJson(res, 200, { revoked: true });
    return true;
  }

  if (path === "/api/sec/face/authorizations/detail" && method === "GET") {
    if (!requireEditor(principal, res)) return true;
    const authId = url.searchParams.get("id") ?? "";
    if (!authId) { sendError(res, 400, "id_required", "id 必填"); return true; }
    const auth = getFaceAuthorization(file, authId);
    if (!auth) { sendError(res, 404, "authorization_not_found", "授权记录不存在"); return true; }
    sendJson(res, 200, auth);
    return true;
  }

  // -------------------- 人脸相似度比对 + 告警 --------------------
  if (path === "/api/sec/face/compare" && method === "POST") {
    if (!requireEditor(principal, res)) return true;
    const body = await readJsonBody(req);
    const sourceHash = String(body["sourceHash"] ?? "").trim();
    const targetHash = String(body["targetHash"] ?? "").trim();
    if (!sourceHash || !targetHash) { sendError(res, 400, "hash_required", "sourceHash/targetHash 必填"); return true; }
    const result = compareFaceFingerprints(sourceHash, targetHash);
    sendJson(res, 200, { ...result, sourceHash, targetHash, threshold: getDeepfakeConfig().similarityThreshold });
    return true;
  }

  if (path === "/api/sec/face/fingerprint" && method === "POST") {
    if (!requireEditor(principal, res)) return true;
    const body = await readJsonBody(req);
    const mediaHash = String(body["mediaHash"] ?? "").trim();
    const mediaUrl = typeof body["mediaUrl"] === "string" ? String(body["mediaUrl"]) : undefined;
    if (!mediaHash && !mediaUrl) { sendError(res, 400, "media_required", "mediaHash 或 mediaUrl 必填"); return true; }
    const salt = String(body["salt"] ?? "default");
    const computed = computeMediaHash({ mediaHash, mediaUrl });
    const fingerprint = computeFaceFingerprint(computed, salt);
    sendJson(res, 200, { mediaHash: computed, fingerprint });
    return true;
  }

  if (path === "/api/sec/face/alert" && method === "POST") {
    if (!requireEditor(principal, res)) return true;
    const body = await readJsonBody(req);
    const sourceHash = String(body["sourceHash"] ?? "").trim();
    const targetHash = String(body["targetHash"] ?? "").trim();
    if (!sourceHash || !targetHash) { sendError(res, 400, "hash_required", "sourceHash/targetHash 必填"); return true; }
    const alert = recordSimilarityAlert(file, {
      sourceHash, targetHash,
      sourceRefType: String(body["sourceRefType"] ?? ""),
      sourceRefId: String(body["sourceRefId"] ?? ""),
      targetRefType: String(body["targetRefType"] ?? ""),
      targetRefId: String(body["targetRefId"] ?? ""),
      threshold: Number(body["threshold"] ?? NaN),
      notes: String(body["notes"] ?? ""),
    });
    if (!alert) { sendJson(res, 200, { recorded: false, reason: "below_threshold" }); return true; }
    sendJson(res, 201, alert);
    return true;
  }

  if (path === "/api/sec/face/alerts" && method === "GET") {
    if (!requireEditor(principal, res)) return true;
    const status = url.searchParams.get("status") as "open" | "acknowledged" | "dismissed" | null;
    const severity = url.searchParams.get("severity") as "low" | "medium" | "high" | "critical" | null;
    sendJson(res, 200, { items: listSimilarityAlerts(file, { status: status ?? undefined, severity: severity ?? undefined }) });
    return true;
  }

  if (path.match(/^\/api\/sec\/face\/alerts\/[^/]+\/(ack|dismiss)$/) && method === "POST") {
    if (!requireEditor(principal, res)) return true;
    const segments = path.split("/");
    const alertId = segments[5] ?? "";
    const action = segments[6] === "dismiss" ? "dismiss" : "acknowledge";
    const result = acknowledgeAlert(file, alertId, principal.userId, action);
    if (!result.ok) { sendError(res, 400, result.reason, `处理失败：${result.reason}`); return true; }
    sendJson(res, 200, { ok: true, action });
    return true;
  }

  if (path === "/api/sec/face/check" && method === "POST") {
    if (!requireEditor(principal, res)) return true;
    const body = await readJsonBody(req);
    const faceHash = String(body["faceHash"] ?? "").trim();
    if (!faceHash) { sendError(res, 400, "face_hash_required", "faceHash 必填"); return true; }
    const scope = (["all", "internal", "external", "training"] as const).find((item) => item === body["scope"]) ?? undefined;
    const result = ensureFaceAuthorized(file, faceHash, { scope });
    sendJson(res, 200, { ok: result.ok, reason: result.ok ? "" : result.reason, authorization: result.ok ? result.authorization : null });
    return true;
  }

  // -------------------- 配置查询 --------------------
  if (path === "/api/sec/deepfake/config" && method === "GET") {
    if (!requireEditor(principal, res)) return true;
    sendJson(res, 200, getDeepfakeConfig());
    return true;
  }

  return false;
}
