/**
 * @file subtitle-service.ts
 * @description V2 W12 P0 REQ-AUDIO-F08/F09/F10：字幕服务。
 *
 * 设计要点：
 *  - subtitle 表存单条字幕（一句一行）
 *  - 自动字幕生成：从 Audio.duration + Audio.text 算出 start_time / end_time
 *  - 字幕按 shot_id 维度查询
 *  - 字幕编辑：text / start_time / end_time 可独立更新
 *  - 字幕版本：每次 update text/time 字段自增 version
 */
import type { AppContext } from "../app.js";
import { DEFAULT_SUBTITLE_STYLE, type ShotSubtitle, type ShotSubtitleStatus, type ShotSubtitleStyle } from "../../types/horizontal.js";
import { id, nowIso } from "../../utils.js";

export interface CreateSubtitleInput {
  project_id: string;
  shot_id: string;
  text: string;
  start_time: number;
  end_time: number;
  character_id?: string;
  voice_id?: string;
  audio_id?: string;
  language?: string;
  status?: ShotSubtitleStatus;
  subtitle_style?: Partial<ShotSubtitleStyle>;
  created_by?: string;
}

export interface UpdateSubtitleInput {
  text?: string;
  start_time?: number;
  end_time?: number;
  character_id?: string;
  voice_id?: string;
  audio_id?: string;
  language?: string;
  status?: ShotSubtitleStatus;
  subtitle_style?: Partial<ShotSubtitleStyle>;
}

function normalizeSubtitleStyle(style?: Partial<ShotSubtitleStyle>, base = DEFAULT_SUBTITLE_STYLE): ShotSubtitleStyle {
  const position = style?.position && ["top", "center", "bottom"].includes(style.position) ? style.position : base.position;
  const alignment = style?.alignment && ["left", "center", "right"].includes(style.alignment) ? style.alignment : base.alignment;
  return {
    fontFamily: String(style?.fontFamily ?? base.fontFamily).slice(0, 100),
    fontSize: Math.min(120, Math.max(12, Number(style?.fontSize ?? base.fontSize))),
    color: String(style?.color ?? base.color),
    backgroundColor: String(style?.backgroundColor ?? base.backgroundColor),
    position,
    alignment,
    outlineColor: String(style?.outlineColor ?? base.outlineColor),
    outlineWidth: Math.min(10, Math.max(0, Number(style?.outlineWidth ?? base.outlineWidth))),
  };
}

/** 创建字幕。 */
export async function createSubtitle(
  ctx: AppContext,
  input: CreateSubtitleInput,
): Promise<ShotSubtitle> {
  if (!input.project_id) throw new Error("project_id 必填");
  if (!input.shot_id) throw new Error("shot_id 必填");
  if (!input.text || !input.text.trim()) throw new Error("text 必填");
  if (input.end_time <= input.start_time) throw new Error("end_time 必须大于 start_time");
  const now = nowIso();
  const sub: ShotSubtitle = {
    id: id("sub"),
    project_id: input.project_id,
    shot_id: input.shot_id,
    text: input.text.trim(),
    start_time: input.start_time,
    end_time: input.end_time,
    character_id: input.character_id ?? "",
    voice_id: input.voice_id ?? "",
    audio_id: input.audio_id ?? "",
    language: input.language ?? "zh-CN",
    subtitle_style: normalizeSubtitleStyle(input.subtitle_style),
    version: 1,
    status: input.status ?? "draft",
    created_by: input.created_by ?? "",
    created_at: now,
    updated_at: now,
  };
  await ctx.subtitles.insert(sub as any);
  return sub;
}

/** 按 shot_id 列出字幕（按 start_time 升序）。 */
export async function listSubtitlesByShot(
  ctx: AppContext,
  shotId: string,
): Promise<ShotSubtitle[]> {
  try {
    if (!ctx.subtitles) return [];
    const all = (await ctx.subtitles.findMany({ shot_id: shotId })) as ShotSubtitle[];
    return all
      .filter(Boolean)
      .sort((a, b) => a.start_time - b.start_time);
  } catch {
    return [];
  }
}

/** 按 project_id 列出所有字幕。 */
export async function listSubtitlesByProject(
  ctx: AppContext,
  projectId: string,
): Promise<ShotSubtitle[]> {
  try {
    if (!ctx.subtitles) return [];
    const all = (await ctx.subtitles.findMany({ project_id: projectId })) as ShotSubtitle[];
    return all
      .filter(Boolean)
      .sort((a, b) => a.start_time - b.start_time);
  } catch {
    return [];
  }
}

/** 按 id 获取字幕。 */
export async function getSubtitle(ctx: AppContext, subId: string): Promise<ShotSubtitle | null> {
  try {
    if (!ctx.subtitles) return null;
    return (await ctx.subtitles.findById(subId)) as ShotSubtitle | null;
  } catch {
    return null;
  }
}

/**
 * 更新字幕。任何字段变更都会自增 version。
 * - 只更新传入的字段（patch 语义）
 */
export async function updateSubtitle(
  ctx: AppContext,
  subId: string,
  input: UpdateSubtitleInput,
): Promise<ShotSubtitle> {
  if (!ctx.subtitles) throw new Error("subtitles_repo_missing");
  const cur = (await ctx.subtitles.findById(subId)) as ShotSubtitle | null;
  if (!cur) throw new Error("subtitle_not_found");
  if (input.start_time !== undefined && input.end_time !== undefined) {
    if (input.end_time <= input.start_time) throw new Error("end_time 必须大于 start_time");
  }
  const patch: Partial<ShotSubtitle> = {
    text: input.text ?? cur.text,
    start_time: input.start_time ?? cur.start_time,
    end_time: input.end_time ?? cur.end_time,
    character_id: input.character_id ?? cur.character_id,
    voice_id: input.voice_id ?? cur.voice_id,
    audio_id: input.audio_id ?? cur.audio_id,
    language: input.language ?? cur.language,
    subtitle_style: input.subtitle_style ? normalizeSubtitleStyle(input.subtitle_style, cur.subtitle_style ?? DEFAULT_SUBTITLE_STYLE) : (cur.subtitle_style ?? DEFAULT_SUBTITLE_STYLE),
    status: input.status ?? cur.status,
    version: (cur.version ?? 1) + 1,
    updated_at: nowIso(),
  };
  await ctx.subtitles.update(subId, patch as any);
  return { ...cur, ...patch } as ShotSubtitle;
}

/** 删除字幕。 */
export async function deleteSubtitle(ctx: AppContext, subId: string): Promise<void> {
  if (!ctx.subtitles) throw new Error("subtitles_repo_missing");
  await ctx.subtitles.delete(subId);
}

/* ============================================================== */
/* V2 W12 P0 REQ-AUDIO-F08：自动字幕生成                            */
/* ============================================================== */

/**
 * 从音频自动生成字幕。按音频 duration 平均切分文本为 N 段，
 * 每段 text 长度 ≈ N 字符，start_time = (i * duration) / N，end_time = ((i+1) * duration) / N。
 * - 已有字幕的 shot 默认跳过（force=true 时覆盖）
 * - 返回创建的字幕数量
 */
export async function autoGenerateSubtitlesFromAudio(
  ctx: AppContext,
  params: {
    project_id: string;
    shot_id: string;
    audio_id: string;
    text: string;
    duration: number;
    language?: string;
    character_id?: string;
    voice_id?: string;
    force?: boolean;
  },
): Promise<{ created: number; skipped: boolean; subtitles: ShotSubtitle[] }> {
  if (!ctx.subtitles) throw new Error("subtitles_repo_missing");
  if (!params.text || !params.text.trim()) throw new Error("text 必填");
  if (!(params.duration > 0)) throw new Error("duration 必须 > 0");
  // 检查是否已有字幕
  const existing = await listSubtitlesByShot(ctx, params.shot_id);
  if (existing.length > 0 && !params.force) {
    return { created: 0, skipped: true, subtitles: existing };
  }
  // 切分策略：按句号/问号/感叹号/换行 切分；切分后单段仍 > 60 字时按逗号切
  const sentences = splitTextToSentences(params.text);
  const totalLen = sentences.reduce((acc, s) => acc + s.length, 0) || 1;
  const dur = params.duration;
  const now = nowIso();
  const out: ShotSubtitle[] = [];
  let cursor = 0;
  for (const sentence of sentences) {
    const ratio = sentence.length / totalLen;
    const segDur = dur * ratio;
    const start = Number(cursor.toFixed(3));
    const end = Number((cursor + segDur).toFixed(3));
    const sub: ShotSubtitle = {
      id: id("sub"),
      project_id: params.project_id,
      shot_id: params.shot_id,
      text: sentence,
      start_time: start,
      end_time: end,
      character_id: params.character_id ?? "",
      voice_id: params.voice_id ?? "",
      audio_id: params.audio_id ?? "",
      language: params.language ?? "zh-CN",
      subtitle_style: { ...DEFAULT_SUBTITLE_STYLE },
      version: 1,
      status: "draft",
      created_by: "",
      created_at: now,
      updated_at: now,
    };
    await ctx.subtitles.insert(sub as any);
    out.push(sub);
    cursor = end;
  }
  return { created: out.length, skipped: false, subtitles: out };
}

/** 文本切分：优先按句末标点，其次按逗号。 */
function splitTextToSentences(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  // 先按强标点切
  const strongParts = trimmed.split(/[。！？!?\n]+/).map((s) => s.trim()).filter(Boolean);
  const result: string[] = [];
  for (const part of strongParts) {
    if (part.length <= 60) {
      result.push(part);
      continue;
    }
    // 超过 60 字按逗号/分号切
    const subParts = part.split(/[，,；;]/).map((s) => s.trim()).filter(Boolean);
    if (subParts.length > 1) {
      for (const sp of subParts) {
        if (sp.length <= 60) {
          result.push(sp);
        } else {
          // 仍 > 60 字，按 30 字硬切
          for (let i = 0; i < sp.length; i += 30) {
            result.push(sp.slice(i, i + 30));
          }
        }
      }
    } else {
      // 单段仍 > 60，按 30 字硬切
      for (let i = 0; i < part.length; i += 30) {
        result.push(part.slice(i, i + 30));
      }
    }
  }
  return result;
}
