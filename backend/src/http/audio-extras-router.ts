/**
 * @file audio-extras-router.ts
 * @description V2 W11 AUDIO-F04/F06/F11/F13/F14 HTTP API
 *
 * 端点:
 *  - GET    /api/audio/params/default                          默认 TTS 参数
 *  - POST   /api/audio/params/validate                        校验 TTS 参数
 *  - GET    /api/audio/candidates                             列表(过滤)
 *  - POST   /api/audio/candidates                             创建
 *  - GET    /api/audio/candidates/:id                         单个
 *  - PATCH  /api/audio/candidates/:id                         更新
 *  - POST   /api/audio/candidates/:id/status                  切状态
 *  - POST   /api/audio/candidates/:id/activate                 激活(同 shot 唯一)
 *  - POST   /api/audio/candidates/choose                       选候选并激活
 *  - POST   /api/audio/subtitles/bulk-time-edit               字幕时间批量编辑
 *  - GET    /api/audio/lip-sync                               口型任务列表
 *  - POST   /api/audio/lip-sync                               创建口型任务
 *  - GET    /api/audio/lip-sync/:id                           单个任务
 *  - POST   /api/audio/lip-sync/:id/start                     启动
 *  - POST   /api/audio/lip-sync/:id/progress                  进度
 *  - POST   /api/audio/lip-sync/:id/complete                  完成
 *  - POST   /api/audio/lip-sync/:id/fail                      失败
 *  - POST   /api/audio/lip-sync/:id/cancel                    取消
 *  - POST   /api/audio/lip-sync/bind                          绑定到 audio
 *  - GET    /api/audio/lip-sync/by-audio/:audioId             按 audio 查询
 *  - GET    /api/audio/health                                  服务健康
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { getAudioExtrasService, type AudioExtrasService } from "../services/horizontal/audio-extras-service.js";
import type { AppContext } from "../services/app.js";
import type { AudioCandidateSource, AudioCandidateStatus, LipSyncStatus, TTSParamSchema } from "../types/audio-params.js";

interface AccessCtx {
  userId: string;
  isAdmin: boolean;
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(payload));
}

function sendError(res: ServerResponse, status: number, message: string): void {
  sendJson(res, status, { code: status, message, data: null });
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text.trim()) return {};
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("JSON 请求体必须是对象");
    }
    return parsed as Record<string, unknown>;
  } catch (e) {
    throw new Error(`invalid_json: ${(e as Error).message}`);
  }
}

const VALID_SOURCES: AudioCandidateSource[] = ["tts", "upload", "library", "human"];
const VALID_STATUSES: AudioCandidateStatus[] = ["draft", "approved", "rejected", "archived"];
const VALID_LIP_STATUSES: LipSyncStatus[] = ["pending", "running", "success", "failed", "cancelled"];

export async function handleAudioExtrasRouter(
  ctx: AppContext,
  req: IncomingMessage,
  res: ServerResponse,
  _access: AccessCtx,
): Promise<void> {
  const url = req.url ?? "/";
  const qIdx = url.indexOf("?");
  const path = (qIdx >= 0 ? url.slice(0, qIdx) : url).split("/").filter(Boolean);
  const method = (req.method ?? "GET").toUpperCase();
  if (path[0] !== "api" || path[1] !== "audio") {
    sendError(res, 404, "not_found");
    return;
  }
  const svc: AudioExtrasService = getAudioExtrasService();
  const qs = qIdx >= 0 ? url.slice(qIdx + 1) : "";
  const params = new URLSearchParams(qs);

  // 健康
  if (path.length === 3 && path[2] === "health" && method === "GET") {
    return sendJson(res, 200, await svc.healthCheck());
  }

  // 默认参数
  if (path.length === 3 && path[2] === "params" && method === "GET") {
    return sendJson(res, 200, { params: svc.getDefaultParams() });
  }
  if (path.length === 4 && path[2] === "params" && path[3] === "default" && method === "GET") {
    return sendJson(res, 200, { params: svc.getDefaultParams() });
  }

  // 参数校验
  if (path.length === 4 && path[2] === "params" && path[3] === "validate" && method === "POST") {
    let body: Record<string, unknown> = {};
    try { body = await readJsonBody(req); } catch (e) { return sendError(res, 400, (e as Error).message); }
    const v = svc.validateParams(body as Partial<TTSParamSchema>);
    return sendJson(res, 200, { result: v });
  }

  // 候选列表
  if (path.length === 3 && path[2] === "candidates" && method === "GET") {
    const filter: { projectId?: string; shotId?: string; characterId?: string; source?: AudioCandidateSource; status?: AudioCandidateStatus; activeOnly?: boolean } = {};
    if (params.get("projectId")) filter.projectId = String(params.get("projectId"));
    if (params.get("shotId")) filter.shotId = String(params.get("shotId"));
    if (params.get("characterId")) filter.characterId = String(params.get("characterId"));
    const src = params.get("source");
    if (src && (VALID_SOURCES as string[]).includes(src)) filter.source = src as AudioCandidateSource;
    const st = params.get("status");
    if (st && (VALID_STATUSES as string[]).includes(st)) filter.status = st as AudioCandidateStatus;
    if (params.get("activeOnly") === "true") filter.activeOnly = true;
    const list = await svc.listCandidates(filter);
    return sendJson(res, 200, { candidates: list, total: list.length });
  }

  // 候选创建
  if (path.length === 3 && path[2] === "candidates" && method === "POST") {
    let body: Record<string, unknown> = {};
    try { body = await readJsonBody(req); } catch (e) { return sendError(res, 400, (e as Error).message); }
    const src = String(body.source ?? "");
    if (!(VALID_SOURCES as string[]).includes(src)) {
      return sendError(res, 400, `unsupported_source: ${src}`);
    }
    try {
      const c = await svc.createCandidate({
        project_id: String(body.project_id ?? ""),
        audio_id: String(body.audio_id ?? ""),
        shot_id: String(body.shot_id ?? ""),
        character_id: String(body.character_id ?? ""),
        text: String(body.text ?? ""),
        source: src as AudioCandidateSource,
        model: String(body.model ?? ""),
        params: (body.params ?? {}) as Partial<TTSParamSchema>,
      });
      return sendJson(res, 201, { candidate: c });
    } catch (e) {
      return sendError(res, 400, (e as Error).message);
    }
  }

  // 选候选
  if (path.length === 4 && path[2] === "candidates" && path[3] === "choose" && method === "POST") {
    let body: Record<string, unknown> = {};
    try { body = await readJsonBody(req); } catch (e) { return sendError(res, 400, (e as Error).message); }
    try {
      const c = await svc.chooseCandidateForShot(
        String(body.shotId ?? ""),
        String(body.candidateId ?? ""),
        String(body.reviewedBy ?? _access.userId)
      );
      return sendJson(res, 200, { candidate: c });
    } catch (e) {
      return sendError(res, 400, (e as Error).message);
    }
  }

  // 字幕时间批量编辑
  if (path.length === 4 && path[2] === "subtitles" && path[3] === "bulk-time-edit" && method === "POST") {
    let body: Record<string, unknown> = {};
    try { body = await readJsonBody(req); } catch (e) { return sendError(res, 400, (e as Error).message); }
    try {
      const r = await svc.bulkShiftSubtitleTimes(ctx, String(body.projectId ?? ""), {
        shiftSeconds: typeof body.shiftSeconds === "number" ? body.shiftSeconds : undefined,
        scaleRatio: typeof body.scaleRatio === "number" ? body.scaleRatio : undefined,
        setStart: typeof body.setStart === "number" ? body.setStart : undefined,
        snapToTenths: body.snapToTenths === true,
        shotId: typeof body.shotId === "string" ? body.shotId : undefined,
      });
      return sendJson(res, 200, r);
    } catch (e) {
      return sendError(res, 400, (e as Error).message);
    }
  }

  // 单个候选
  if (path.length === 4 && path[2] === "candidates" && method === "GET") {
    const id = decodeURIComponent(path[3]);
    const c = await svc.getCandidate(id);
    if (!c) return sendError(res, 404, `audio_candidate_not_found: ${id}`);
    return sendJson(res, 200, { candidate: c });
  }

  // 候选更新
  if (path.length === 4 && path[2] === "candidates" && method === "PATCH") {
    const id = decodeURIComponent(path[3]);
    let body: Record<string, unknown> = {};
    try { body = await readJsonBody(req); } catch (e) { return sendError(res, 400, (e as Error).message); }
    const patch: Record<string, unknown> = {};
    if (typeof body.text === "string") patch.text = body.text;
    if (typeof body.score === "number") patch.score = body.score;
    if (typeof body.review_note === "string") patch.review_note = body.review_note;
    if (body.params && typeof body.params === "object") patch.params = body.params;
    try {
      const c = await svc.updateCandidate(id, patch as never);
      return sendJson(res, 200, { candidate: c });
    } catch (e) {
      return sendError(res, 400, (e as Error).message);
    }
  }

  // 候选状态切
  if (path.length === 5 && path[2] === "candidates" && path[4] === "status" && method === "POST") {
    const id = decodeURIComponent(path[3]);
    let body: Record<string, unknown> = {};
    try { body = await readJsonBody(req); } catch (e) { return sendError(res, 400, (e as Error).message); }
    const st = String(body.status ?? "");
    if (!(VALID_STATUSES as string[]).includes(st)) {
      return sendError(res, 400, `unsupported_status: ${st}`);
    }
    try {
      const c = await svc.setCandidateStatus(id, st as AudioCandidateStatus, body.note ? String(body.note) : undefined);
      return sendJson(res, 200, { candidate: c });
    } catch (e) {
      return sendError(res, 400, (e as Error).message);
    }
  }

  // 候选激活
  if (path.length === 5 && path[2] === "candidates" && path[4] === "activate" && method === "POST") {
    const id = decodeURIComponent(path[3]);
    try {
      const r = await svc.activateCandidate(id);
      return sendJson(res, 200, r);
    } catch (e) {
      return sendError(res, 400, (e as Error).message);
    }
  }

  // 口型任务列表
  if (path.length === 3 && path[2] === "lip-sync" && method === "GET") {
    const filter: { projectId?: string; shotId?: string; status?: LipSyncStatus } = {};
    if (params.get("projectId")) filter.projectId = String(params.get("projectId"));
    if (params.get("shotId")) filter.shotId = String(params.get("shotId"));
    const st = params.get("status");
    if (st && (VALID_LIP_STATUSES as string[]).includes(st)) filter.status = st as LipSyncStatus;
    const list = await svc.listLipSyncJobs(filter);
    return sendJson(res, 200, { jobs: list, total: list.length });
  }

  // 口型任务创建
  if (path.length === 3 && path[2] === "lip-sync" && method === "POST") {
    let body: Record<string, unknown> = {};
    try { body = await readJsonBody(req); } catch (e) { return sendError(res, 400, (e as Error).message); }
    try {
      const j = await svc.createLipSyncJob({
        project_id: String(body.project_id ?? ""),
        shot_id: String(body.shot_id ?? ""),
        source_video_id: String(body.source_video_id ?? ""),
        source_audio_id: String(body.source_audio_id ?? ""),
        model: String(body.model ?? "default"),
        pipeline_node_id: String(body.pipeline_node_id ?? ""),
        triggered_by: String(body.triggered_by ?? _access.userId),
      });
      return sendJson(res, 201, { job: j });
    } catch (e) {
      return sendError(res, 400, (e as Error).message);
    }
  }

  // 绑定到 audio
  if (path.length === 4 && path[2] === "lip-sync" && path[3] === "bind" && method === "POST") {
    let body: Record<string, unknown> = {};
    try { body = await readJsonBody(req); } catch (e) { return sendError(res, 400, (e as Error).message); }
    try {
      const r = await svc.bindLipSyncToAudio(
        ctx,
        String(body.audioId ?? ""),
        String(body.jobId ?? "")
      );
      return sendJson(res, 200, r);
    } catch (e) {
      return sendError(res, 400, (e as Error).message);
    }
  }

  // 按 audio 查询
  if (path.length === 5 && path[2] === "lip-sync" && path[3] === "by-audio" && method === "GET") {
    const audioId = decodeURIComponent(path[4]);
    const r = await svc.getLipSyncByAudioId(ctx, audioId);
    return sendJson(res, 200, r);
  }

  // 单个口型任务
  if (path.length === 4 && path[2] === "lip-sync" && method === "GET") {
    const id = decodeURIComponent(path[3]);
    const j = await svc.getLipSync(id);
    if (!j) return sendError(res, 404, `lip_sync_job_not_found: ${id}`);
    return sendJson(res, 200, { job: j });
  }

  // 状态机过渡
  if (path.length === 5 && path[2] === "lip-sync" && ["start", "cancel"].includes(path[4]) && method === "POST") {
    const id = decodeURIComponent(path[3]);
    try {
      let j: Awaited<ReturnType<typeof svc.getLipSync>>;
      if (path[4] === "start") j = await svc.startLipSync(id);
      else j = await svc.cancelLipSync(id);
      return sendJson(res, 200, { job: j });
    } catch (e) {
      return sendError(res, 400, (e as Error).message);
    }
  }

  if (path.length === 5 && path[2] === "lip-sync" && path[4] === "progress" && method === "POST") {
    const id = decodeURIComponent(path[3]);
    let body: Record<string, unknown> = {};
    try { body = await readJsonBody(req); } catch (e) { return sendError(res, 400, (e as Error).message); }
    const p = Number(body.progress ?? 0);
    try {
      const j = await svc.progressLipSync(id, p);
      return sendJson(res, 200, { job: j });
    } catch (e) {
      return sendError(res, 400, (e as Error).message);
    }
  }

  if (path.length === 5 && path[2] === "lip-sync" && path[4] === "complete" && method === "POST") {
    const id = decodeURIComponent(path[3]);
    let body: Record<string, unknown> = {};
    try { body = await readJsonBody(req); } catch (e) { return sendError(res, 400, (e as Error).message); }
    try {
      const j = await svc.completeLipSync(id, String(body.resultVideoId ?? ""));
      return sendJson(res, 200, { job: j });
    } catch (e) {
      return sendError(res, 400, (e as Error).message);
    }
  }

  if (path.length === 5 && path[2] === "lip-sync" && path[4] === "fail" && method === "POST") {
    const id = decodeURIComponent(path[3]);
    let body: Record<string, unknown> = {};
    try { body = await readJsonBody(req); } catch (e) { return sendError(res, 400, (e as Error).message); }
    try {
      const j = await svc.failLipSync(id, String(body.errorMessage ?? "unknown"));
      return sendJson(res, 200, { job: j });
    } catch (e) {
      return sendError(res, 400, (e as Error).message);
    }
  }

  sendError(res, 404, "not_found");
}
