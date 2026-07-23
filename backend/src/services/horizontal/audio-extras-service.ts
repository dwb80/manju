/**
 * @file audio-extras-service.ts
 * @description V2 W11 AUDIO-F04/F06/F11/F13/F14 配音参数 + 候选 + 口型同步服务
 *
 * 设计要点:
 *  - audio_candidates / lip_sync_jobs 两张新表(走 SqliteRepository 自动建表)
 *  - audio 行口型结果绑定走 audios.update(id, { lip_sync_* })
 *  - 不引入新的 pipeline node type;lip_sync 作为独立服务,后续可在 pipeline 中通过
 *    pipeline-node 的 service=lip_sync 字段触发
 */

import { randomUUID } from "node:crypto";
import { SqliteRepository } from "../../storage/sqlite.js";
import {
  DEFAULT_TTS_PARAMS,
  canCandidateTransition,
  canLipSyncTransition,
  validateTTSParams,
  audioCandidateFields,
  lipSyncJobFields,
  type AudioCandidate,
  type AudioCandidateSource,
  type AudioCandidateStatus,
  type LipSyncJob,
  type LipSyncStatus,
  type SubtitleTimeBulkPatch,
  type TTSParamSchema,
} from "../../types/audio-params.js";
import type { AppContext } from "../app.js";
import { id, nowIso } from "../../utils.js";
import type { ShotSubtitle } from "../../types/horizontal.js";

export interface AudioExtrasService {
  // AUDIO-F04
  validateParams(input: Partial<TTSParamSchema> | undefined): ReturnType<typeof validateTTSParams>;
  getDefaultParams(): TTSParamSchema;
  // AUDIO-F06
  createCandidate(input: Omit<AudioCandidate, "id" | "created_at" | "updated_at" | "active" | "status" | "score" | "review_note" | "reviewed_by" | "params"> & { id?: string; params?: Partial<TTSParamSchema> }): Promise<AudioCandidate>;
  listCandidates(filter: { projectId?: string; shotId?: string; characterId?: string; source?: AudioCandidateSource; status?: AudioCandidateStatus; activeOnly?: boolean }): Promise<AudioCandidate[]>;
  getCandidate(id: string): Promise<AudioCandidate | null>;
  updateCandidate(id: string, patch: Partial<AudioCandidate>): Promise<AudioCandidate>;
  setCandidateStatus(id: string, status: AudioCandidateStatus, note?: string): Promise<AudioCandidate>;
  activateCandidate(id: string): Promise<{ activated: AudioCandidate; deactivated: string[] }>;
  chooseCandidateForShot(shotId: string, candidateId: string, reviewedBy: string): Promise<AudioCandidate>;
  // AUDIO-F11
  bulkShiftSubtitleTimes(ctx: AppContext, projectId: string, patch: SubtitleTimeBulkPatch): Promise<{ updated: number; subtitles: ShotSubtitle[] }>;
  // AUDIO-F13
  createLipSyncJob(input: Omit<LipSyncJob, "id" | "created_at" | "updated_at" | "status" | "progress" | "result_video_id" | "error_message" | "started_at" | "completed_at"> & { id?: string }): Promise<LipSyncJob>;
  startLipSync(id: string): Promise<LipSyncJob>;
  progressLipSync(id: string, progress: number): Promise<LipSyncJob>;
  completeLipSync(id: string, resultVideoId: string): Promise<LipSyncJob>;
  failLipSync(id: string, errorMessage: string): Promise<LipSyncJob>;
  cancelLipSync(id: string): Promise<LipSyncJob>;
  getLipSync(id: string): Promise<LipSyncJob | null>;
  listLipSyncJobs(filter: { projectId?: string; shotId?: string; status?: LipSyncStatus }): Promise<LipSyncJob[]>;
  // AUDIO-F14
  bindLipSyncToAudio(ctx: AppContext, audioId: string, jobId: string): Promise<{ ok: boolean; lipSyncStatus: LipSyncStatus }>;
  getLipSyncByAudioId(ctx: AppContext, audioId: string): Promise<{ audioId: string; lipSync: LipSyncJob | null }>;
  // 健康
  healthCheck(): Promise<{ ok: boolean; candidateCount: number; lipSyncCount: number }>;
}

export function createAudioExtrasService(databaseFile: string): AudioExtrasService {
  const candidateRepo = new SqliteRepository<AudioCandidate>(databaseFile, "audio_candidates", audioCandidateFields);
  const lipSyncRepo = new SqliteRepository<LipSyncJob>(databaseFile, "lip_sync_jobs", lipSyncJobFields);

  function genId(prefix: string): string {
    return `${prefix}-${randomUUID().slice(0, 8)}`;
  }

  function now(): string {
    return nowIso();
  }

  async function createCandidate(input: Omit<AudioCandidate, "id" | "created_at" | "updated_at" | "active" | "status" | "score" | "review_note" | "reviewed_by" | "params"> & { id?: string; params?: Partial<TTSParamSchema> }): Promise<AudioCandidate> {
    const v = validateTTSParams(input.params);
    const c: AudioCandidate = {
      id: input.id ?? genId("ac"),
      project_id: input.project_id,
      audio_id: input.audio_id,
      shot_id: input.shot_id,
      character_id: input.character_id,
      text: input.text,
      source: input.source,
      model: input.model,
      params: v.normalized,
      score: 0,
      status: "draft",
      active: false,
      reviewed_by: "",
      review_note: "",
      created_at: now(),
      updated_at: now(),
    };
    await candidateRepo.insert(c);
    return c;
  }

  async function listCandidates(filter: { projectId?: string; shotId?: string; characterId?: string; source?: AudioCandidateSource; status?: AudioCandidateStatus; activeOnly?: boolean }): Promise<AudioCandidate[]> {
    let list: AudioCandidate[] = [];
    try { list = await candidateRepo.findMany({}); } catch { return []; }
    if (filter.projectId) list = list.filter((c) => c.project_id === filter.projectId);
    if (filter.shotId) list = list.filter((c) => c.shot_id === filter.shotId);
    if (filter.characterId) list = list.filter((c) => c.character_id === filter.characterId);
    if (filter.source) list = list.filter((c) => c.source === filter.source);
    if (filter.status) list = list.filter((c) => c.status === filter.status);
    if (filter.activeOnly) list = list.filter((c) => c.active);
    list.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return list;
  }

  async function getCandidate(cid: string): Promise<AudioCandidate | null> {
    try { return await candidateRepo.findById(cid); } catch { return null; }
  }

  async function updateCandidate(cid: string, patch: Partial<AudioCandidate>): Promise<AudioCandidate> {
    const existing = await candidateRepo.findById(cid);
    if (!existing) throw new Error(`audio_candidate_not_found: ${cid}`);
    if (patch.params) {
      const v = validateTTSParams(patch.params);
      patch.params = v.normalized;
    }
    if (patch.status && !canCandidateTransition(existing.status, patch.status)) {
      throw new Error(`invalid_candidate_transition: ${existing.status} -> ${patch.status}`);
    }
    const merged = { ...existing, ...patch, id: cid, updated_at: now() };
    await candidateRepo.update(cid, patch);
    return merged;
  }

  async function setCandidateStatus(cid: string, status: AudioCandidateStatus, note?: string): Promise<AudioCandidate> {
    return await updateCandidate(cid, { status, review_note: note ?? "" });
  }

  async function activateCandidate(cid: string): Promise<{ activated: AudioCandidate; deactivated: string[] }> {
    const target = await candidateRepo.findById(cid);
    if (!target) throw new Error(`audio_candidate_not_found: ${cid}`);
    // 同 shot 已有 active 的需要先 deactivate
    const all = await listCandidates({ shotId: target.shot_id, activeOnly: true });
    const deactivated: string[] = [];
    for (const c of all) {
      if (c.id !== cid) {
        await candidateRepo.update(c.id, { active: false, updated_at: now() });
        deactivated.push(c.id);
      }
    }
    if (target.status !== "approved") {
      throw new Error(`candidate_not_approved: ${cid}, status=${target.status}`);
    }
    await candidateRepo.update(cid, { active: true, updated_at: now() });
    const refreshed = await candidateRepo.findById(cid);
    return { activated: refreshed!, deactivated };
  }

  async function chooseCandidateForShot(shotId: string, candidateId: string, reviewedBy: string): Promise<AudioCandidate> {
    const c = await candidateRepo.findById(candidateId);
    if (!c) throw new Error(`audio_candidate_not_found: ${candidateId}`);
    if (c.shot_id !== shotId) {
      throw new Error(`shot_mismatch: ${shotId} != ${c.shot_id}`);
    }
    // 自动 approve + activate
    const updated = await updateCandidate(candidateId, {
      status: "approved",
      reviewed_by: reviewedBy,
    });
    await activateCandidate(candidateId);
    return updated;
  }

  async function bulkShiftSubtitleTimes(ctx: AppContext, projectId: string, patch: SubtitleTimeBulkPatch): Promise<{ updated: number; subtitles: ShotSubtitle[] }> {
    if (!ctx.subtitles) throw new Error("subtitles_repo_missing");
    const all: ShotSubtitle[] = await ctx.subtitles.findMany({ project_id: projectId });
    const target = patch.shotId ? all.filter((s) => s.shot_id === patch.shotId) : all;
    const updated: ShotSubtitle[] = [];
    for (const sub of target) {
      const newStart = patch.setStart != null
        ? patch.setStart
        : sub.start_time + (patch.shiftSeconds ?? 0);
      let newEnd = sub.end_time + (patch.shiftSeconds ?? 0);
      if (patch.scaleRatio) {
        const length = sub.end_time - sub.start_time;
        newEnd = newStart + length * patch.scaleRatio;
      }
      const snap = patch.snapToTenths
        ? (n: number) => Math.round(n * 10) / 10
        : (n: number) => Number(n.toFixed(3));
      const finalStart = snap(newStart);
      const finalEnd = snap(Math.max(finalStart + 0.1, newEnd));
      const patchObj = { start_time: finalStart, end_time: finalEnd, version: sub.version + 1, updated_at: now() };
      await ctx.subtitles.update(sub.id, patchObj as Partial<ShotSubtitle>);
      updated.push({ ...sub, ...patchObj });
    }
    return { updated: updated.length, subtitles: updated };
  }

  async function createLipSyncJob(input: Omit<LipSyncJob, "id" | "created_at" | "updated_at" | "status" | "progress" | "result_video_id" | "error_message" | "started_at" | "completed_at"> & { id?: string }): Promise<LipSyncJob> {
    const job: LipSyncJob = {
      id: input.id ?? genId("lsj"),
      project_id: input.project_id,
      shot_id: input.shot_id,
      source_video_id: input.source_video_id,
      source_audio_id: input.source_audio_id,
      model: input.model,
      status: "pending",
      progress: 0,
      result_video_id: "",
      error_message: "",
      pipeline_node_id: input.pipeline_node_id,
      triggered_by: input.triggered_by,
      created_at: now(),
      updated_at: now(),
      started_at: "",
      completed_at: "",
    };
    await lipSyncRepo.insert(job);
    return job;
  }

  async function transitionLipSync(jid: string, to: LipSyncStatus, extra: Partial<LipSyncJob> = {}): Promise<LipSyncJob> {
    const existing = await lipSyncRepo.findById(jid);
    if (!existing) throw new Error(`lip_sync_job_not_found: ${jid}`);
    if (!canLipSyncTransition(existing.status, to)) {
      throw new Error(`invalid_lip_sync_transition: ${existing.status} -> ${to}`);
    }
    const patch: Partial<LipSyncJob> = { ...extra, status: to, updated_at: now() };
    if (to === "running" && !existing.started_at) patch.started_at = now();
    if (to === "success" || to === "failed" || to === "cancelled") patch.completed_at = now();
    await lipSyncRepo.update(jid, patch);
    return { ...existing, ...patch };
  }

  async function startLipSync(jid: string): Promise<LipSyncJob> {
    return await transitionLipSync(jid, "running", { progress: 1 });
  }

  async function progressLipSync(jid: string, progress: number): Promise<LipSyncJob> {
    const p = Math.max(0, Math.min(100, progress));
    const existing = await lipSyncRepo.findById(jid);
    if (!existing) throw new Error(`lip_sync_job_not_found: ${jid}`);
    await lipSyncRepo.update(jid, { progress: p, updated_at: now() });
    return { ...existing, progress: p, updated_at: now() };
  }

  async function completeLipSync(jid: string, resultVideoId: string): Promise<LipSyncJob> {
    return await transitionLipSync(jid, "success", { progress: 100, result_video_id: resultVideoId });
  }

  async function failLipSync(jid: string, errorMessage: string): Promise<LipSyncJob> {
    return await transitionLipSync(jid, "failed", { error_message: errorMessage });
  }

  async function cancelLipSync(jid: string): Promise<LipSyncJob> {
    return await transitionLipSync(jid, "cancelled");
  }

  async function getLipSync(jid: string): Promise<LipSyncJob | null> {
    try { return await lipSyncRepo.findById(jid); } catch { return null; }
  }

  async function listLipSyncJobs(filter: { projectId?: string; shotId?: string; status?: LipSyncStatus }): Promise<LipSyncJob[]> {
    let list: LipSyncJob[] = [];
    try { list = await lipSyncRepo.findMany({}); } catch { return []; }
    if (filter.projectId) list = list.filter((j) => j.project_id === filter.projectId);
    if (filter.shotId) list = list.filter((j) => j.shot_id === filter.shotId);
    if (filter.status) list = list.filter((j) => j.status === filter.status);
    list.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return list;
  }

  async function bindLipSyncToAudio(ctx: AppContext, audioId: string, jid: string): Promise<{ ok: boolean; lipSyncStatus: LipSyncStatus }> {
    const job = await lipSyncRepo.findById(jid);
    if (!job) throw new Error(`lip_sync_job_not_found: ${jid}`);
    if (ctx.audios) {
      try {
        await ctx.audios.update(audioId, {
          lip_sync_job_id: jid,
          lip_sync_status: job.status,
          lip_sync_video_id: job.result_video_id,
          lip_sync_error: job.error_message,
          lip_sync_completed_at: job.completed_at,
        } as unknown as Record<string, unknown>);
      } catch { /* noop */ }
    }
    return { ok: true, lipSyncStatus: job.status };
  }

  async function getLipSyncByAudioId(ctx: AppContext, audioId: string): Promise<{ audioId: string; lipSync: LipSyncJob | null }> {
    let lipSync: LipSyncJob | null = null;
    if (ctx.audios) {
      try {
        const audio = await ctx.audios.findById(audioId);
        if (audio && (audio as { lip_sync_job_id?: string }).lip_sync_job_id) {
          lipSync = await getLipSync((audio as { lip_sync_job_id: string }).lip_sync_job_id);
        }
      } catch { /* noop */ }
    }
    return { audioId, lipSync };
  }

  async function healthCheck(): Promise<{ ok: boolean; candidateCount: number; lipSyncCount: number }> {
    const candidates = await listCandidates({});
    const jobs = await listLipSyncJobs({});
    return { ok: true, candidateCount: candidates.length, lipSyncCount: jobs.length };
  }

  return {
    validateParams: validateTTSParams,
    getDefaultParams: () => DEFAULT_TTS_PARAMS,
    createCandidate,
    listCandidates,
    getCandidate,
    updateCandidate,
    setCandidateStatus,
    activateCandidate,
    chooseCandidateForShot,
    bulkShiftSubtitleTimes,
    createLipSyncJob,
    startLipSync,
    progressLipSync,
    completeLipSync,
    failLipSync,
    cancelLipSync,
    getLipSync,
    listLipSyncJobs,
    bindLipSyncToAudio,
    getLipSyncByAudioId,
    healthCheck,
  };
}

let _singleton: AudioExtrasService | null = null;
export function getAudioExtrasService(databaseFile?: string): AudioExtrasService {
  if (!_singleton) {
    if (!databaseFile) throw new Error("audio_extras_service_database_file_required");
    _singleton = createAudioExtrasService(databaseFile);
  }
  return _singleton;
}

export function _resetAudioExtrasService(): void {
  _singleton = null;
}
