/**
 * Chapter 8.13 SEC P1 HTTP 端点
 *
 * 路由前缀：/api/sec/*
 * - /api/sec/mfa/setup (POST)
 * - /api/sec/mfa/enable (POST)
 * - /api/sec/mfa/verify (POST)
 * - /api/sec/mfa/disable (POST)
 * - /api/sec/mfa/status (GET)
 * - /api/sec/data/export (POST) / /api/sec/data/exports (GET) / /api/sec/data/exports/:id (GET)
 * - /api/sec/data/delete (POST) / /api/sec/data/delete/:id/cancel (POST) / /api/sec/data/delete/sweep (POST, admin)
 * - /api/sec/backup/run (POST, admin) / /api/sec/backup/list (GET, admin)
 * - /api/sec/pii/redact (POST) / /api/sec/pii/detect (POST)
 * - /api/sec/prompt-guard (POST) / /api/sec/prompt-guard/logs (GET, admin)
 * - /api/sec/aigc/watermark (POST) / /api/sec/aigc/watermark (GET)
 * - /api/sec/sanitize/html (POST) / /api/sec/sanitize/url (POST)
 * - /api/sec/csp/nonce (GET)
 */
import { existsSync, createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import nodePath from "node:path";
import { sendJson, sendError, readJsonBody } from "./http-utils.js";
import {
  setupMfa, enableMfa, verifyMfa, disableMfa, getMfaStatus,
  requestDataExport, listDataExports, getDataExport, requestDataDelete, cancelDataDelete, executeDueDeletes,
  createDailyBackup, listBackups,
  redactPii, detectPii,
  guardPrompt, listPromptInjectionLogs,
  recordAigcWatermark, getAigcWatermark, listAigcWatermarks,
  escapeHtml, sanitizeUrl,
  generateCspNonce, buildCspHeader,
} from "../services/module-domain/sec-p1-service.js";

interface Principal { userId: string; isAdmin: boolean; }

function requireAdmin(principal: Principal, res: ServerResponse): boolean {
  if (!principal.isAdmin) { sendError(res, 403, "admin_required", "需要管理员权限"); return false; }
  return true;
}

function dataFile(): string {
  return process.env["DATA_FILE"] ?? "data/app.db";
}

function backupDirFromConfig(): string {
  return process.env["BACKUP_DIR"] ?? "data/backup";
}

function dbFileFromConfig(): string {
  return process.env["DB_FILE"] ?? "data/app.db";
}

export async function handleSecP1Router(
  req: IncomingMessage,
  res: ServerResponse,
  principal: Principal,
  url: URL,
): Promise<boolean> {
  const file = dataFile();
  const path = url.pathname;
  const method = req.method ?? "GET";

  // MFA endpoints
  if (path === "/api/sec/mfa/status" && method === "GET") { sendJson(res, 200, getMfaStatus(file, principal.userId)); return true; }
  if (path === "/api/sec/mfa/setup" && method === "POST") { sendJson(res, 200, setupMfa(file, principal.userId)); return true; }
  if (path === "/api/sec/mfa/enable" && method === "POST") { const body = await readJsonBody(req); const code = String(body["code"] ?? ""); if (!code) { sendError(res, 400, "code_required", "code 必填"); return true; } sendJson(res, 200, enableMfa(file, principal.userId, code)); return true; }
  if (path === "/api/sec/mfa/verify" && method === "POST") { const body = await readJsonBody(req); const code = String(body["code"] ?? ""); if (!code) { sendError(res, 400, "code_required", "code 必填"); return true; } sendJson(res, 200, verifyMfa(file, principal.userId, code)); return true; }
  if (path === "/api/sec/mfa/disable" && method === "POST") { sendJson(res, 200, disableMfa(file, principal.userId)); return true; }

  // GDPR endpoints
  if (path === "/api/sec/data/exports" && method === "GET") { sendJson(res, 200, { items: listDataExports(file, principal.userId) }); return true; }
  if (path === "/api/sec/data/export" && method === "POST") { sendJson(res, 202, requestDataExport(file, principal.userId, nodePath.join(backupDirFromConfig(), "data-export"))); return true; }
  if (path.startsWith("/api/sec/data/exports/") && method === "GET") {
    // 优先匹配 /api/sec/data/exports/:id/download 鉴权下载
    if (path.endsWith("/download")) {
      const segments = path.split("/");
      const requestId = segments[segments.length - 2] ?? "";
      const row = getDataExport(file, principal.userId, requestId) as { status?: string; file_path?: string; user_id?: string } | null;
      if (!row) { sendError(res, 404, "export_not_found", "导出记录不存在"); return true; }
      if (row.user_id !== principal.userId) { sendError(res, 403, "forbidden", "无权访问该导出"); return true; }
      if (row.status !== "ready") { sendError(res, 409, "export_not_ready", `status=${row.status}，请等待导出完成`); return true; }
      if (!row.file_path || !existsSync(row.file_path)) { sendError(res, 410, "export_file_gone", "导出文件已过期或被清理"); return true; }
      const statInfo = await stat(row.file_path);
      const fileName = `data-export-${requestId}.json`;
      res.statusCode = 200;
      res.setHeader("content-type", "application/json; charset=utf-8");
      res.setHeader("content-length", String(statInfo.size));
      res.setHeader("content-disposition", `attachment; filename="${encodeURIComponent(fileName)}"`);
      res.setHeader("x-gdpr-export-id", requestId);
      createReadStream(row.file_path).pipe(res);
      return true;
    }
    const segments = path.split("/");
    const requestId = segments[segments.length - 1] ?? "";
    const row = getDataExport(file, principal.userId, requestId);
    if (!row) { sendError(res, 404, "export_not_found", "导出记录不存在"); return true; }
    sendJson(res, 200, row);
    return true;
  }
  if (path === "/api/sec/data/delete" && method === "POST") { const body = await readJsonBody(req).catch(() => ({} as Record<string, unknown>)); const rawGrace = (body as Record<string, unknown>)["graceDays"]; const graceDays = Number(rawGrace); const finalGrace = Number.isFinite(graceDays) && graceDays > 0 ? graceDays : 30; sendJson(res, 202, requestDataDelete(file, principal.userId, finalGrace)); return true; }
  if (path.startsWith("/api/sec/data/delete/") && path.endsWith("/cancel") && method === "POST") { const segments = path.split("/"); const requestId = segments[5] ?? ""; sendJson(res, 200, cancelDataDelete(file, principal.userId, requestId)); return true; }
  if (path === "/api/sec/data/delete/sweep" && method === "POST") { if (!requireAdmin(principal, res)) return true; sendJson(res, 200, executeDueDeletes(file)); return true; }

  // Backup endpoints (admin)
  if (path === "/api/sec/backup/run" && method === "POST") { if (!requireAdmin(principal, res)) return true; try { const result = await createDailyBackup(file, dbFileFromConfig(), backupDirFromConfig()); sendJson(res, 200, result); } catch (err) { sendError(res, 500, "backup_failed", (err as Error).message); } return true; }
  if (path === "/api/sec/backup/list" && method === "GET") { if (!requireAdmin(principal, res)) return true; sendJson(res, 200, { items: listBackups(file) }); return true; }

  // PII endpoints
  if (path === "/api/sec/pii/redact" && method === "POST") { const body = await readJsonBody(req); const text = String(body["text"] ?? ""); if (!text) { sendError(res, 400, "text_required", "text 必填"); return true; } sendJson(res, 200, redactPii(text)); return true; }
  if (path === "/api/sec/pii/detect" && method === "POST") { const body = await readJsonBody(req); const text = String(body["text"] ?? ""); if (!text) { sendError(res, 400, "text_required", "text 必填"); return true; } sendJson(res, 200, { hits: detectPii(text) }); return true; }

  // Prompt guard endpoints
  if (path === "/api/sec/prompt-guard" && method === "POST") { const body = await readJsonBody(req); const prompt = String(body["prompt"] ?? ""); if (!prompt) { sendError(res, 400, "prompt_required", "prompt 必填"); return true; } sendJson(res, 200, guardPrompt(file, principal.userId, prompt)); return true; }
  if (path === "/api/sec/prompt-guard/logs" && method === "GET") { if (!requireAdmin(principal, res)) return true; sendJson(res, 200, { items: listPromptInjectionLogs(file) }); return true; }

  // AIGC watermark endpoints
  if (path === "/api/sec/aigc/watermark" && method === "POST") { const body = await readJsonBody(req); const refType = String(body["refType"] ?? ""); const refId = String(body["refId"] ?? ""); if (!refType || !refId) { sendError(res, 400, "ref_required", "refType/refId 必填"); return true; } const creator = String(body["creator"] ?? principal.userId); const model = String(body["model"] ?? ""); sendJson(res, 201, recordAigcWatermark(file, refType, refId, creator, model)); return true; }
  if (path === "/api/sec/aigc/watermark" && method === "GET") { const refType = url.searchParams.get("refType") ?? ""; const refId = url.searchParams.get("refId") ?? ""; if (!refType || !refId) { sendError(res, 400, "ref_required", "refType/refId 必填"); return true; } const row = getAigcWatermark(file, refType, refId); sendJson(res, 200, row ?? { not_found: true }); return true; }

  // Sanitize endpoints
  if (path === "/api/sec/sanitize/html" && method === "POST") { const body = await readJsonBody(req); const text = String(body["text"] ?? ""); sendJson(res, 200, { escaped: escapeHtml(text) }); return true; }
  if (path === "/api/sec/sanitize/url" && method === "POST") { const body = await readJsonBody(req); const target = String(body["url"] ?? ""); sendJson(res, 200, sanitizeUrl(target)); return true; }

  // CSP nonce endpoint
  if (path === "/api/sec/csp/nonce" && method === "GET") {
    const nonce = generateCspNonce();
    sendJson(res, 200, { nonce, header: buildCspHeader(nonce) });
    return true;
  }

  return false;
}
