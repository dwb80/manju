/**
 * @file audio-params.ts
 * @description V2 W11 AUDIO-F04 / F06 / F11 / F13 / F14 配音参数 + 候选 + 口型同步
 *
 * 设计要点(SSO 单一事实源):
 *  - AUDIO-F04: 配音参数 schema(speed/emotion/pitch/format/style) + 校验
 *  - AUDIO-F06: 配音候选表(audio_candidates) + choose/set-active 流转
 *  - AUDIO-F11: 字幕时间批量编辑(track bulk patch,跨多字幕)
 *  - AUDIO-F13: 口型任务创建(lip_sync_jobs 表) + 状态机 pending→running→success/failed
 *  - AUDIO-F14: 口型结果绑定(audio.lip_sync_video_url / lip_sync_status 字段)
 */

import type { FieldSpec } from "../storage/repository.js";

/* ==================== AUDIO-F04 配音参数 schema ==================== */

export type TTSSpeed = "slow" | "normal" | "fast" | "x-fast" | number; // 0.5 ~ 2.0
export type TTSEmotion = "neutral" | "happy" | "sad" | "angry" | "fearful" | "disgusted" | "surprised";
export type TTSFormat = "mp3" | "wav" | "webm" | "pcm";
export type TTSPitch = "x-low" | "low" | "normal" | "high" | "x-high" | number; // -50 ~ +50

export interface TTSParamSchema {
  speed: TTSSpeed;
  emotion: TTSEmotion;
  pitch: TTSPitch;
  format: TTSFormat;
  style?: string;       // 朗读风格(主播/新闻/聊天 等)
  sampleRate?: number;  // 8000 / 16000 / 24000 / 48000
  volume?: number;      // 0 ~ 100
  /** SSML 额外属性(可选,部分 provider 支持) */
  ssml?: boolean;
}

export const DEFAULT_TTS_PARAMS: TTSParamSchema = {
  speed: 1.0,
  emotion: "neutral",
  pitch: 0,
  format: "mp3",
  sampleRate: 24000,
  volume: 100,
  ssml: false,
};

/** 校验 TTS 参数并返回 issues + normalized */
export function validateTTSParams(input: Partial<TTSParamSchema> | undefined): {
  valid: boolean;
  issues: { field: string; message: string }[];
  normalized: TTSParamSchema;
} {
  const issues: { field: string; message: string }[] = [];
  const n: TTSParamSchema = { ...DEFAULT_TTS_PARAMS, ...(input ?? {}) };
  if (typeof n.speed === "number" && (n.speed < 0.5 || n.speed > 2.0)) {
    issues.push({ field: "speed", message: "speed 必须在 0.5 ~ 2.0" });
    n.speed = Math.max(0.5, Math.min(2.0, n.speed));
  }
  if (!["neutral", "happy", "sad", "angry", "fearful", "disgusted", "surprised"].includes(n.emotion)) {
    issues.push({ field: "emotion", message: `不支持的 emotion: ${n.emotion}` });
    n.emotion = "neutral";
  }
  if (typeof n.pitch === "number" && (n.pitch < -50 || n.pitch > 50)) {
    issues.push({ field: "pitch", message: "pitch 必须在 -50 ~ +50" });
    n.pitch = Math.max(-50, Math.min(50, n.pitch));
  }
  if (!["mp3", "wav", "webm", "pcm"].includes(n.format)) {
    issues.push({ field: "format", message: `不支持的 format: ${n.format}` });
    n.format = "mp3";
  }
  if (n.sampleRate != null && ![8000, 16000, 24000, 48000].includes(n.sampleRate)) {
    issues.push({ field: "sampleRate", message: `sampleRate 必须 ∈ {8000,16000,24000,48000}` });
    n.sampleRate = 24000;
  }
  if (n.volume != null && (n.volume < 0 || n.volume > 100)) {
    issues.push({ field: "volume", message: "volume 必须在 0 ~ 100" });
    n.volume = Math.max(0, Math.min(100, n.volume));
  }
  return { valid: issues.length === 0, issues, normalized: n };
}

/* ==================== AUDIO-F06 配音候选 ==================== */

export type AudioCandidateSource = "tts" | "upload" | "library" | "human";
export type AudioCandidateStatus = "draft" | "approved" | "rejected" | "archived";

export interface AudioCandidate {
  id: string;
  project_id: string;
  /** 关联的 audio 行 id(每个候选都有自己的 audio_id 实际文件) */
  audio_id: string;
  /** 关联的 shot_id(可选) */
  shot_id: string;
  /** 关联的字符 character_id(可选) */
  character_id: string;
  /** 关联的 dialogue/subtitle 文本 */
  text: string;
  /** 生成方式 */
  source: AudioCandidateSource;
  /** 使用的模型/TTS 引擎 */
  model: string;
  /** 配音参数 schema(JSON) */
  params: TTSParamSchema;
  /** 候选打分(0-100,可由人工/算法填入) */
  score: number;
  /** 状态 */
  status: AudioCandidateStatus;
  /** 是否激活(同 shot 仅一个激活) */
  active: boolean;
  /** 评审人 */
  reviewed_by: string;
  /** 评审意见 */
  review_note: string;
  created_at: string;
  updated_at: string;
}

export const audioCandidateFields: FieldSpec<AudioCandidate>[] = [
  { key: "id", type: "string" },
  { key: "project_id", type: "string" },
  { key: "audio_id", type: "string" },
  { key: "shot_id", type: "string" },
  { key: "character_id", type: "string" },
  { key: "text", type: "string" },
  { key: "source", type: "string" },
  { key: "model", type: "string" },
  { key: "params", type: "json" },
  { key: "score", type: "number" },
  { key: "status", type: "string" },
  { key: "active", type: "boolean" },
  { key: "reviewed_by", type: "string" },
  { key: "review_note", type: "string" },
  { key: "created_at", type: "string" },
  { key: "updated_at", type: "string" },
];

/* ==================== AUDIO-F11 字幕时间批量编辑 ==================== */

export interface SubtitleTimeBulkPatch {
  /** 偏移整段字幕(秒),正数向后移,负数向前 */
  shiftSeconds?: number;
  /** 缩放时长(比例,0.8 表示压到 80%) */
  scaleRatio?: number;
  /** 设置开始时间(覆盖式) */
  setStart?: number;
  /** 对齐到最近 0.1s(便于编辑器防抖) */
  snapToTenths?: boolean;
  /** 应用范围(shot_id 内);不传 = 全 shot */
  shotId?: string;
}

/* ==================== AUDIO-F13 口型任务 ==================== */

export type LipSyncStatus = "pending" | "running" | "success" | "failed" | "cancelled";

export interface LipSyncJob {
  id: string;
  project_id: string;
  /** 关联的 shot_id(可空——可以以 audio 为维度) */
  shot_id: string;
  /** 输入视频(待口型对齐的源) */
  source_video_id: string;
  /** 输入音频(驱动口型的音轨) */
  source_audio_id: string;
  /** 候选模型(agnesium-2.1 / sadtalker / wav2lip 等) */
  model: string;
  /** 状态机 */
  status: LipSyncStatus;
  /** 进度 0-100 */
  progress: number;
  /** 输出视频 URL(成功后填) */
  result_video_id: string;
  /** 错误信息 */
  error_message: string;
  /** 关联的 pipeline_node_id(便于从 pipeline 任务查口型) */
  pipeline_node_id: string;
  /** 触发人 */
  triggered_by: string;
  created_at: string;
  updated_at: string;
  started_at: string;
  completed_at: string;
}

export const lipSyncJobFields: FieldSpec<LipSyncJob>[] = [
  { key: "id", type: "string" },
  { key: "project_id", type: "string" },
  { key: "shot_id", type: "string" },
  { key: "source_video_id", type: "string" },
  { key: "source_audio_id", type: "string" },
  { key: "model", type: "string" },
  { key: "status", type: "string" },
  { key: "progress", type: "number" },
  { key: "result_video_id", type: "string" },
  { key: "error_message", type: "string" },
  { key: "pipeline_node_id", type: "string" },
  { key: "triggered_by", type: "string" },
  { key: "created_at", type: "string" },
  { key: "updated_at", type: "string" },
  { key: "started_at", type: "string" },
  { key: "completed_at", type: "string" },
];

/* ==================== AUDIO-F14 Audio 上的口型结果字段 ==================== */

/** Audio 表的口型结果绑定(在原有 Audio 类型上扩展,这里只声明增量字段) */
export interface AudioLipSyncBinding {
  /** 该 audio 关联的口型任务 id */
  lip_sync_job_id: string;
  /** 状态 */
  lip_sync_status: LipSyncStatus;
  /** 输出口型视频 id */
  lip_sync_video_id: string;
  /** 错误信息 */
  lip_sync_error: string;
  /** 完成时间 */
  lip_sync_completed_at: string;
}

/* ==================== 工具:状态机校验 ==================== */

const LIP_SYNC_TRANSITIONS: Record<LipSyncStatus, LipSyncStatus[]> = {
  pending: ["running", "cancelled"],
  running: ["success", "failed", "cancelled"],
  success: [],
  failed: ["pending", "cancelled"],
  cancelled: [],
};

export function canLipSyncTransition(from: LipSyncStatus, to: LipSyncStatus): boolean {
  if (from === to) return true;
  return LIP_SYNC_TRANSITIONS[from].includes(to);
}

const CANDIDATE_TRANSITIONS: Record<AudioCandidateStatus, AudioCandidateStatus[]> = {
  draft: ["approved", "rejected", "archived"],
  approved: ["rejected", "archived"],
  rejected: ["draft", "approved", "archived"],
  archived: ["draft"],
};

export function canCandidateTransition(from: AudioCandidateStatus, to: AudioCandidateStatus): boolean {
  if (from === to) return true;
  return CANDIDATE_TRANSITIONS[from].includes(to);
}
