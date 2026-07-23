/**
 * @file av.ts
 * @description 音画合成模块实体类型：BGM / SFX / 字幕 / 合成 / 渲染任务 / 音画模板。
 *              全部对应 V2 新增的 6 张表（mod-av）。
 *
 * ## 模块关系
 *  - Composition 是"时间线"，由 N 条 CompositionClip 组成（视频 / 音频 / 字幕 / BGM / SFX）。
 *  - RenderJob 是"渲染任务"，异步把 Composition 渲染成 mp4。
 *  - AVTemplate 是"模板"，预置常用时间线（片头 / 预告 / 完整短剧）。
 */
import type { FieldSpec } from "../storage/repository.js";

/* ==================== BGM 库 ==================== */
export type BGMMood = "happy" | "sad" | "exciting" | "peaceful" | "mysterious" | "romantic" | "dramatic" | "action";
export type BGMTempo = "slow" | "medium" | "fast";
export type BGMIntensity = "low" | "medium" | "high";

export interface BGM {
  id: string;
  name: string;
  file_url: string;
  duration: number;
  mood: BGMMood;
  genre: string;
  tempo: BGMTempo;
  intensity: BGMIntensity;
  tags: string[];
  is_preset: boolean;
  created_at: string;
  updated_at: string;
}

export const bgmLibraryFields: FieldSpec<BGM>[] = [
  { key: "id", type: "string" },
  { key: "name", type: "string" },
  { key: "file_url", type: "string" },
  { key: "duration", type: "number" },
  { key: "mood", type: "string" },
  { key: "genre", type: "string" },
  { key: "tempo", type: "string" },
  { key: "intensity", type: "string" },
  { key: "tags", type: "json" },
  { key: "is_preset", type: "boolean" },
  { key: "created_at", type: "string" },
  { key: "updated_at", type: "string" },
];

/* ==================== SFX 库 ==================== */
export type SFXCategory = "ui" | "action" | "environment" | "music" | "voice" | "ambience" | "transition" | "special";

export interface SFX {
  id: string;
  name: string;
  file_url: string;
  duration: number;
  category: SFXCategory;
  tags: string[];
  is_preset: boolean;
  created_at: string;
  updated_at: string;
}

export const sfxLibraryFields: FieldSpec<SFX>[] = [
  { key: "id", type: "string" },
  { key: "name", type: "string" },
  { key: "file_url", type: "string" },
  { key: "duration", type: "number" },
  { key: "category", type: "string" },
  { key: "tags", type: "json" },
  { key: "is_preset", type: "boolean" },
  { key: "created_at", type: "string" },
  { key: "updated_at", type: "string" },
];

/* ==================== 字幕 ==================== */
export interface SubtitleStyle {
  font: string;
  font_size: number;
  color: string;
  outline_color: string;
  outline_width: number;
  shadow_color: string;
  shadow_offset_x: number;
  shadow_offset_y: number;
  alignment: "left" | "center" | "right";
  /** 0 = 底部，1 = 顶部（百分比）。 */
  position: number;
  line_spacing: number;
}

export interface Subtitle {
  id: string;
  project_id: string;
  storyboard_id: string;
  episode: number;
  /** 起播时间（秒）。 */
  start_time: number;
  /** 结束时间（秒）。 */
  end_time: number;
  text: string;
  speaker: string;
  style: SubtitleStyle;
  sequence: number;
  created_at: string;
  updated_at: string;
}

export const subtitleFields: FieldSpec<Subtitle>[] = [
  { key: "id", type: "string" },
  { key: "project_id", type: "string" },
  { key: "storyboard_id", type: "string" },
  { key: "episode", type: "number" },
  { key: "start_time", type: "number" },
  { key: "end_time", type: "number" },
  { key: "text", type: "string" },
  { key: "speaker", type: "string" },
  { key: "style", type: "json" },
  { key: "sequence", type: "number" },
  { key: "created_at", type: "string" },
  { key: "updated_at", type: "string" },
];

/* ==================== 合成时间线 ==================== */
export type CompositionTrackType = "video" | "audio" | "bgm" | "sfx" | "subtitle";

export interface CompositionClip {
  id: string;
  composition_id: string;
  track_index: number;
  type: CompositionTrackType;
  source_url: string;
  source_id: string;
  /** 在 Composition 时间线上的起始时间（秒）。 */
  start_time: number;
  /** 持续时长（秒）。 */
  duration: number;
  /** 源文件入点（秒，用于裁剪）。 */
  in_point: number;
  /** 源文件出点（秒，用于裁剪）。 */
  out_point: number;
  /** 0-1，音量。 */
  volume: number;
  /** JSON 字符串：效果参数（淡入淡出 / 滤镜 / 转场等）。 */
  effect: string;
  sequence: number;
  created_at: string;
  updated_at: string;
}

export const compositionClipFields: FieldSpec<CompositionClip>[] = [
  { key: "id", type: "string" },
  { key: "composition_id", type: "string" },
  { key: "track_index", type: "number" },
  { key: "type", type: "string" },
  { key: "source_url", type: "string" },
  { key: "source_id", type: "string" },
  { key: "start_time", type: "number" },
  { key: "duration", type: "number" },
  { key: "in_point", type: "number" },
  { key: "out_point", type: "number" },
  { key: "volume", type: "number" },
  { key: "effect", type: "string" },
  { key: "sequence", type: "number" },
  { key: "created_at", type: "string" },
  { key: "updated_at", type: "string" },
];

export type CompositionStatus = "draft" | "rendering" | "completed" | "failed";

export interface Composition {
  id: string;
  project_id: string;
  name: string;
  description: string;
  duration: number;
  width: number;
  height: number;
  fps: number;
  status: CompositionStatus;
  template_id: string;
  track_count: number;
  /** 嵌套 clips（前端展示用，DB 拆表存储）。 */
  clips: CompositionClip[];
  created_at: string;
  updated_at: string;
}

export const compositionFields: FieldSpec<Composition>[] = [
  { key: "id", type: "string" },
  { key: "project_id", type: "string" },
  { key: "name", type: "string" },
  { key: "description", type: "string" },
  { key: "duration", type: "number" },
  { key: "width", type: "number" },
  { key: "height", type: "number" },
  { key: "fps", type: "number" },
  { key: "status", type: "string" },
  { key: "template_id", type: "string" },
  { key: "track_count", type: "number" },
  { key: "clips", type: "json" },
  { key: "created_at", type: "string" },
  { key: "updated_at", type: "string" },
];

/* ==================== 渲染任务 ==================== */
export type RenderJobStatus = "pending" | "running" | "completed" | "failed";

export interface RenderJob {
  id: string;
  project_id: string;
  composition_id: string;
  output_path: string;
  output_format: string;
  status: RenderJobStatus;
  /** 0-100。 */
  progress: number;
  error: string;
  started_at: string;
  completed_at: string;
  created_at: string;
  updated_at: string;
}

export const renderJobFields: FieldSpec<RenderJob>[] = [
  { key: "id", type: "string" },
  { key: "project_id", type: "string" },
  { key: "composition_id", type: "string" },
  { key: "output_path", type: "string" },
  { key: "output_format", type: "string" },
  { key: "status", type: "string" },
  { key: "progress", type: "number" },
  { key: "error", type: "string" },
  { key: "started_at", type: "string" },
  { key: "completed_at", type: "string" },
  { key: "created_at", type: "string" },
  { key: "updated_at", type: "string" },
];

/* ==================== 音画模板 ==================== */
export interface AVTemplate {
  id: string;
  name: string;
  description: string;
  thumbnail_url: string;
  category: string;
  duration: number;
  width: number;
  height: number;
  fps: number;
  track_count: number;
  is_preset: boolean;
  is_public: boolean;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export const avTemplateFields: FieldSpec<AVTemplate>[] = [
  { key: "id", type: "string" },
  { key: "name", type: "string" },
  { key: "description", type: "string" },
  { key: "thumbnail_url", type: "string" },
  { key: "category", type: "string" },
  { key: "duration", type: "number" },
  { key: "width", type: "number" },
  { key: "height", type: "number" },
  { key: "fps", type: "number" },
  { key: "track_count", type: "number" },
  { key: "is_preset", type: "boolean" },
  { key: "is_public", type: "boolean" },
  { key: "config", type: "json" },
  { key: "created_at", type: "string" },
  { key: "updated_at", type: "string" },
];

/* ==================== 成片版本（V2 W11 P0 REQ-RENDER-F08/F09）================== */
/**
 * 一次合成 / 渲染任务的最终成片版本。记录每版成片：
 *   - duration / width / height / fps / size（视频技术参数）
 *   - video_url / thumbnail_url（外链 / 内部 /media/ 路径）
 *   - status: pending(渲染未开始) | rendering(渲染中) | ready(可下载) | archived(已归档) | failed(渲染失败)
 *   - quality_score: 技术质检得分（0-100），由 RENDER-F07 写入
 *   - download_count: 累计下载次数（NF-F09 鉴权代理可同步递增）
 */
export type FinalVideoStatus = "pending" | "rendering" | "ready" | "archived" | "failed";

export interface FinalVideoVersion {
  id: string;
  project_id: string;
  /** 触发的 pipeline run id（来源） */
  run_id: string;
  /** 触发的 render job id（来源，可空：直接从前端合成） */
  render_job_id: string;
  /** 触发的 composition id（来源） */
  composition_id: string;
  /** 版本号，从 1 自增；同一 render 多次出片时递增 */
  version: number;
  name: string;
  description: string;
  duration: number;
  width: number;
  height: number;
  fps: number;
  /** 文件大小字节数 */
  size: number;
  /** 视频文件 URL（/media/xxx.mp4 或外链） */
  video_url: string;
  /** 缩略图 URL */
  thumbnail_url: string;
  status: FinalVideoStatus;
  /** RENDER-F07 技术质检得分（0-100，>=80 表示可发布） */
  quality_score: number;
  /** 累计下载次数（NF-F09 鉴权代理每次 +1） */
  download_count: number;
  /** 最后一次下载时间（NF-F09 鉴权代理更新） */
  last_downloaded_at: string;
  /** 失败原因（status=failed 时记录） */
  error: string;
  /** 标签（"draft" / "approved" / "published"） */
  tags: string[];
  created_at: string;
  updated_at: string;
}

export const finalVideoVersionFields: FieldSpec<FinalVideoVersion>[] = [
  { key: "id", type: "string" },
  { key: "project_id", type: "string" },
  { key: "run_id", type: "string" },
  { key: "render_job_id", type: "string" },
  { key: "composition_id", type: "string" },
  { key: "version", type: "number" },
  { key: "name", type: "string" },
  { key: "description", type: "string" },
  { key: "duration", type: "number" },
  { key: "width", type: "number" },
  { key: "height", type: "number" },
  { key: "fps", type: "number" },
  { key: "size", type: "number" },
  { key: "video_url", type: "string" },
  { key: "thumbnail_url", type: "string" },
  { key: "status", type: "string" },
  { key: "quality_score", type: "number" },
  { key: "download_count", type: "number" },
  { key: "last_downloaded_at", type: "string" },
  { key: "error", type: "string" },
  { key: "tags", type: "json" },
  { key: "created_at", type: "string" },
  { key: "updated_at", type: "string" },
];
