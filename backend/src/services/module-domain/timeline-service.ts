/**
 * @file timeline-service.ts
 * @description V2 W12 P0 REQ-EDIT-F01/F02/F03/F08/F10 + W13 P1 REQ-EDIT-F04/F05/F07/F09：时间线服务。
 *
 * 设计要点：
 *  - timelines 表：时间线元数据（name/ratio/status/active_version）
 *  - timeline_shots 表：节点关联（shot_id ↔ timeline_id + order/in_point/out_point/subtitle_id/audio_id + volume/transition_type/transition_duration_ms）
 *  - timeline_versions 表：每次保存的不可变快照
 *  - 顺序调整：交换 order 字段（同时更新两行）
 *  - 版本保存：snapshot_data = 完整 JSON（节点列表 + 元数据）
 *  - 音量/转场校验：validateTimelineVolume / validateTimelineTransitionType / validateTimelineTransitionDuration
 */
import type { AppContext } from "../app.js";
import type {
  Timeline,
  TimelineShot,
  TimelineVersion,
  TimelineStatus,
  TimelineTransitionType,
} from "../../types/horizontal.js";
import {
  validateTimelineVolume,
  validateTimelineTransitionType,
  validateTimelineTransitionDuration,
} from "../../types/horizontal.js";
import { id, nowIso } from "../../utils.js";

export interface CreateTimelineInput {
  project_id: string;
  name: string;
  description?: string;
  ratio?: string;
  status?: TimelineStatus;
  created_by?: string;
}

export interface AddShotToTimelineInput {
  project_id: string;
  timeline_id: string;
  shot_id: string;
  in_point?: number;
  out_point?: number;
  subtitle_id?: string;
  audio_id?: string;
  volume?: number;
  transition_type?: TimelineTransitionType;
  transition_duration_ms?: number;
}

/** 默认音量（无音频绑定时不影响其他节点）。 */
const DEFAULT_VOLUME = 1.0;
/** 默认转场类型（无视觉切换 = 硬切）。 */
const DEFAULT_TRANSITION_TYPE: TimelineTransitionType = "cut";
/** 默认转场时长（毫秒）。 */
const DEFAULT_TRANSITION_DURATION_MS = 0;

/** 统一把数据库行补齐默认值（兼容旧数据列缺失）。 */
function normalizeShotRow(n: TimelineShot): TimelineShot {
  return {
    ...n,
    volume: typeof n.volume === "number" && Number.isFinite(n.volume) ? n.volume : DEFAULT_VOLUME,
    transition_type: (n.transition_type as TimelineTransitionType) || DEFAULT_TRANSITION_TYPE,
    transition_duration_ms:
      typeof n.transition_duration_ms === "number" && Number.isFinite(n.transition_duration_ms)
        ? n.transition_duration_ms
        : DEFAULT_TRANSITION_DURATION_MS,
  };
}

/** 创建时间线。 */
export async function createTimeline(
  ctx: AppContext,
  input: CreateTimelineInput,
): Promise<Timeline> {
  if (!input.project_id) throw new Error("project_id 必填");
  if (!input.name || !input.name.trim()) throw new Error("name 必填");
  const now = nowIso();
  const t: Timeline = {
    id: id("tl"),
    project_id: input.project_id,
    name: input.name.trim(),
    description: input.description ?? "",
    ratio: input.ratio ?? "16:9",
    final_video_id: "",
    status: input.status ?? "draft",
    active_version: 0,
    version_count: 0,
    created_by: input.created_by ?? "",
    created_at: now,
    updated_at: now,
  };
  await ctx.timelines.insert(t as any);
  return t;
}

/** 列出项目下所有时间线（排除已删除）。 */
export async function listTimelines(ctx: AppContext, projectId: string): Promise<Timeline[]> {
  try {
    if (!ctx.timelines) return [];
    const all = (await ctx.timelines.findMany({ project_id: projectId })) as Timeline[];
    return all.filter((t) => !t.deleted_at).sort((a, b) =>
      String(b.created_at).localeCompare(String(a.created_at)),
    );
  } catch {
    return [];
  }
}

/** 按 id 获取时间线。 */
export async function getTimeline(ctx: AppContext, timelineId: string): Promise<Timeline | null> {
  try {
    if (!ctx.timelines) return null;
    return (await ctx.timelines.findById(timelineId)) as Timeline | null;
  } catch {
    return null;
  }
}

/** 更新时间线元数据（name/description/ratio/status）。 */
export async function updateTimeline(
  ctx: AppContext,
  timelineId: string,
  patch: Partial<Pick<Timeline, "name" | "description" | "ratio" | "status" | "final_video_id">>,
): Promise<Timeline> {
  if (!ctx.timelines) throw new Error("timelines_repo_missing");
  const cur = (await ctx.timelines.findById(timelineId)) as Timeline | null;
  if (!cur) throw new Error("timeline_not_found");
  const merged: Partial<Timeline> = {
    ...patch,
    updated_at: nowIso(),
  };
  await ctx.timelines.update(timelineId, merged as any);
  return { ...cur, ...merged } as Timeline;
}

/** 软删除时间线。 */
export async function deleteTimeline(ctx: AppContext, timelineId: string): Promise<void> {
  if (!ctx.timelines) throw new Error("timelines_repo_missing");
  await ctx.timelines.update(timelineId, { deleted_at: nowIso() } as any);
}

/* ============================================================== */
/* 时间线节点 (timeline_shots)                                     */
/* ============================================================== */

/**
 * 添加镜头到时间线。order 默认追加到末尾。
 * - 若 shot_id 已在该 timeline 中存在 → 抛 conflict
 * - volume / transition_type / transition_duration_ms 可选,默认 1.0 / cut / 0
 */
export async function addShotToTimeline(
  ctx: AppContext,
  input: AddShotToTimelineInput,
): Promise<TimelineShot> {
  if (!ctx.timelineShots) throw new Error("timeline_shots_repo_missing");
  if (!input.timeline_id || !input.shot_id) throw new Error("timeline_id + shot_id 必填");
  // 检查 conflict
  const all = (await ctx.timelineShots.findMany({
    timeline_id: input.timeline_id,
    shot_id: input.shot_id,
  })) as TimelineShot[];
  if (all.length > 0) throw new Error("shot_already_in_timeline");
  // 计算 order：当前最大 + 1
  const nodes = await listTimelineShots(ctx, input.timeline_id);
  const maxOrder = nodes.reduce((acc, n) => Math.max(acc, n.order), -1);
  const now = nowIso();
  const volumeResult = validateTimelineVolume(input.volume ?? DEFAULT_VOLUME);
  const transitionResult = validateTimelineTransitionType(input.transition_type ?? DEFAULT_TRANSITION_TYPE);
  const durationResult = validateTimelineTransitionDuration(
    input.transition_duration_ms ?? DEFAULT_TRANSITION_DURATION_MS,
  );
  const node: TimelineShot = {
    id: id("tls"),
    project_id: input.project_id,
    timeline_id: input.timeline_id,
    shot_id: input.shot_id,
    order: maxOrder + 1,
    in_point: input.in_point ?? 0,
    out_point: input.out_point ?? 0,
    subtitle_id: input.subtitle_id ?? "",
    audio_id: input.audio_id ?? "",
    volume: volumeResult.value,
    transition_type: transitionResult.value,
    transition_duration_ms: durationResult.value,
    created_at: now,
    updated_at: now,
  };
  await ctx.timelineShots.insert(node as any);
  return node;
}

/** 列出时间线所有节点（按 order 升序）。已自动补齐 volume/transition_* 默认值。 */
export async function listTimelineShots(
  ctx: AppContext,
  timelineId: string,
): Promise<TimelineShot[]> {
  try {
    if (!ctx.timelineShots) return [];
    const all = (await ctx.timelineShots.findMany({ timeline_id: timelineId })) as TimelineShot[];
    return all.filter(Boolean).map(normalizeShotRow).sort((a, b) => a.order - b.order);
  } catch {
    return [];
  }
}

/** 从时间线移除镜头。 */
export async function removeShotFromTimeline(
  ctx: AppContext,
  timelineId: string,
  shotId: string,
): Promise<void> {
  if (!ctx.timelineShots) throw new Error("timeline_shots_repo_missing");
  const all = (await ctx.timelineShots.findMany({
    timeline_id: timelineId,
    shot_id: shotId,
  })) as TimelineShot[];
  for (const n of all) {
    await ctx.timelineShots.delete(n.id);
  }
  // 重排 order
  await reorderTimelineShots(ctx, timelineId);
}

/**
 * 重排时间线节点 order（0, 1, 2...）。
 * 内部用：删除节点后调用以保持紧凑。
 */
async function reorderTimelineShots(ctx: AppContext, timelineId: string): Promise<void> {
  const nodes = await listTimelineShots(ctx, timelineId);
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (n && n.order !== i) {
      await ctx.timelineShots.update(n.id, { order: i, updated_at: nowIso() } as any);
    }
  }
}

/**
 * 调整镜头顺序。把 shotId 移动到 newOrder 位置。
 * - 原子操作：先取所有节点按 order 排序，删除 shotId，插入到 newOrder 位置
 */
export async function reorderShotInTimeline(
  ctx: AppContext,
  timelineId: string,
  shotId: string,
  newOrder: number,
): Promise<TimelineShot[]> {
  if (!ctx.timelineShots) throw new Error("timeline_shots_repo_missing");
  const nodes = await listTimelineShots(ctx, timelineId);
  const idx = nodes.findIndex((n) => n.shot_id === shotId);
  if (idx < 0) throw new Error("shot_not_in_timeline");
  const [moved] = nodes.splice(idx, 1);
  if (!moved) throw new Error("shot_not_in_timeline");
  const insertAt = Math.max(0, Math.min(newOrder, nodes.length));
  nodes.splice(insertAt, 0, moved);
  // 重写 order
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (n && n.order !== i) {
      await ctx.timelineShots.update(n.id, { order: i, updated_at: nowIso() } as any);
    }
  }
  return listTimelineShots(ctx, timelineId);
}

/**
 * 更新节点元数据。
 * - W12 P0: in_point / out_point / subtitle_id / audio_id
 * - W13 P1: volume / transition_type / transition_duration_ms
 *
 * 任一字段错误返回时通过 reason 字段告知调用方，但仍然写入合法值（clamp 后的）。
 * 调用方如需强校验可读 result.reasons 判断。
 */
export async function updateTimelineShot(
  ctx: AppContext,
  nodeId: string,
  patch: Partial<
    Pick<
      TimelineShot,
      | "in_point"
      | "out_point"
      | "subtitle_id"
      | "audio_id"
      | "volume"
      | "transition_type"
      | "transition_duration_ms"
    >
  >,
): Promise<{ node: TimelineShot; reasons: string[]; warnings: string[] }> {
  if (!ctx.timelineShots) throw new Error("timeline_shots_repo_missing");
  const cur = (await ctx.timelineShots.findById(nodeId)) as TimelineShot | null;
  if (!cur) throw new Error("timeline_shot_not_found");
  const reasons: string[] = [];
  const warnings: string[] = [];
  const merged: Partial<TimelineShot> = { ...patch, updated_at: nowIso() };

  // 逐字段校验：失败时 clamp 后写回 + 记录 warning
  if (patch.volume !== undefined) {
    const r = validateTimelineVolume(patch.volume);
    if (!r.ok) {
      warnings.push(`volume: ${r.reason}`);
      reasons.push(r.reason ?? "volume_invalid");
    }
    merged.volume = r.value;
  }
  if (patch.transition_type !== undefined) {
    const r = validateTimelineTransitionType(patch.transition_type);
    if (!r.ok) {
      warnings.push(`transition_type: ${r.reason}`);
      reasons.push(r.reason ?? "transition_type_invalid");
    }
    merged.transition_type = r.value;
  }
  if (patch.transition_duration_ms !== undefined) {
    const r = validateTimelineTransitionDuration(patch.transition_duration_ms);
    if (!r.ok) {
      warnings.push(`transition_duration_ms: ${r.reason}`);
      reasons.push(r.reason ?? "transition_duration_ms_invalid");
    }
    merged.transition_duration_ms = r.value;
  }
  if (patch.in_point !== undefined) {
    if (!Number.isFinite(patch.in_point) || patch.in_point < 0) {
      warnings.push("in_point: negative_or_nan");
      reasons.push("in_point_negative_or_nan");
      merged.in_point = 0;
    }
  }
  if (patch.out_point !== undefined) {
    if (!Number.isFinite(patch.out_point) || patch.out_point < 0) {
      warnings.push("out_point: negative_or_nan");
      reasons.push("out_point_negative_or_nan");
      merged.out_point = 0;
    }
  }

  await ctx.timelineShots.update(nodeId, merged as any);
  const after = (await ctx.timelineShots.findById(nodeId)) as TimelineShot;
  return { node: normalizeShotRow({ ...cur, ...after }), reasons, warnings };
}

/* ============================================================== */
/* 时间线版本 (timeline_versions)                                  */
/* ============================================================== */

/**
 * 保存时间线版本快照。
 * - 自动递增 version 号（基于 timeline.version_count）
 * - snapshot_data 是 { nodes: [...], meta: {...} } 的 JSON 字符串
 */
export async function saveTimelineVersion(
  ctx: AppContext,
  params: {
    timeline_id: string;
    change_note?: string;
    created_by?: string;
  },
): Promise<TimelineVersion> {
  if (!ctx.timelines) throw new Error("timelines_repo_missing");
  if (!ctx.timelineShots) throw new Error("timeline_shots_repo_missing");
  if (!ctx.timelineVersions) throw new Error("timeline_versions_repo_missing");
  const timeline = (await ctx.timelines.findById(params.timeline_id)) as Timeline | null;
  if (!timeline) throw new Error("timeline_not_found");
  const nodes = await listTimelineShots(ctx, params.timeline_id);
  const version = (timeline.version_count ?? 0) + 1;
  const now = nowIso();
  const snapshot = {
    nodes: nodes.map((n) => ({ ...n })),
    meta: {
      name: timeline.name,
      ratio: timeline.ratio,
      final_video_id: timeline.final_video_id,
      saved_at: now,
    },
  };
  const v: TimelineVersion = {
    id: id("tlv"),
    project_id: timeline.project_id,
    timeline_id: params.timeline_id,
    version,
    snapshot_data: JSON.stringify(snapshot),
    change_note: params.change_note ?? "",
    created_by: params.created_by ?? "",
    created_at: now,
  };
  await ctx.timelineVersions.insert(v as any);
  // 更新 timeline 的 active_version + version_count
  await ctx.timelines.update(params.timeline_id, {
    active_version: version,
    version_count: version,
    updated_at: now,
  } as any);
  return v;
}

/** 列出时间线所有版本（按 version 升序）。 */
export async function listTimelineVersions(
  ctx: AppContext,
  timelineId: string,
): Promise<TimelineVersion[]> {
  try {
    if (!ctx.timelineVersions) return [];
    const all = (await ctx.timelineVersions.findMany({ timeline_id: timelineId })) as TimelineVersion[];
    return all.filter(Boolean).sort((a, b) => a.version - b.version);
  } catch {
    return [];
  }
}

/** 获取时间线指定版本。 */
export async function getTimelineVersion(
  ctx: AppContext,
  timelineId: string,
  version: number,
): Promise<TimelineVersion | null> {
  try {
    if (!ctx.timelineVersions) return null;
    const all = (await ctx.timelineVersions.findMany({ timeline_id: timelineId })) as TimelineVersion[];
    return all.find((v) => v.version === version) ?? null;
  } catch {
    return null;
  }
}

/**
 * 恢复到指定版本：删除当前所有节点，按 snapshot_data.nodes 重建。
 * 恢复过程会自动保存一个新版本（version_count + 1），保留恢复前快照作为新版本。
 */
export async function restoreTimelineVersion(
  ctx: AppContext,
  timelineId: string,
  version: number,
  actorId: string,
): Promise<TimelineVersion> {
  if (!ctx.timelineShots) throw new Error("timeline_shots_repo_missing");
  if (!ctx.timelineVersions) throw new Error("timeline_versions_repo_missing");
  const target = await getTimelineVersion(ctx, timelineId, version);
  if (!target) throw new Error("version_not_found");
  let snapshot: { nodes: TimelineShot[]; meta?: Record<string, unknown> };
  try {
    snapshot = JSON.parse(target.snapshot_data);
  } catch {
    throw new Error("version_data_corrupt");
  }
  // 1) 备份当前状态
  await saveTimelineVersion(ctx, {
    timeline_id: timelineId,
    change_note: `restore_v${version}_backup`,
    created_by: actorId,
  });
  // 2) 清空当前节点
  const current = await listTimelineShots(ctx, timelineId);
  for (const n of current) {
    await ctx.timelineShots.delete(n.id);
  }
  // 3) 按快照重建
  const now = nowIso();
  for (const node of snapshot.nodes) {
    const fresh: TimelineShot = normalizeShotRow({
      ...node,
      id: id("tls"),
      created_at: now,
      updated_at: now,
    });
    await ctx.timelineShots.insert(fresh as any);
  }
  // 4) 返回新版本（即步骤 1 备份写入的那条）
  const all = await listTimelineVersions(ctx, timelineId);
  return all[all.length - 1] as TimelineVersion;
}
