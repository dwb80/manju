import type { AppContext } from "../app.js";
import type { Storyboard, Shot, ShotStatus, ShotSize, CameraAngle, CameraMovement } from "../../types/storyboard.js";
import { id, nowIso, safeAICall, DEFAULT_MODEL } from "../../utils.js";
import { rootLogger } from "../../logger.js";
import { AI_TIMEOUTS } from "../../utils.js";

const log = rootLogger.child({ module: "storyboard" });

// ==================== Storyboard Input / Service ====================

export type StoryboardInput = {
  project_id?: string;
  episode_id?: string;
  scene_id?: string;
  episode?: number;
  storyboard_number?: string;
  title?: string;
  description?: string;
  dialogue?: string;
  notes?: string;
  status?: string;
  order?: number;
  character_asset_ids?: string[];
  prop_asset_ids?: string[];
};

/**
 * listStoryboards - 列出项目中的分镜（排除已删除）
 */
export async function listStoryboards(
  ctx: AppContext,
  projectId?: string
): Promise<Storyboard[]> {
  const filter: Partial<Storyboard> = projectId ? { project_id: projectId } : {};
  const items = await ctx.storyboards.findMany(filter, { sort: "desc" });
  return items.filter((item) => !item.deleted_at);
}

/**
 * createStoryboard - 创建新分镜
 */
export async function createStoryboard(
  ctx: AppContext,
  input: StoryboardInput
): Promise<Storyboard> {
  const storyboard: Storyboard = {
    id: id("sb"),
    project_id: input.project_id ?? "",
    episode_id: input.episode_id ?? "",
    scene_id: input.scene_id ?? "",
    episode: input.episode ?? 1,
    storyboard_number: input.storyboard_number ?? "SB-001",
    title: input.title ?? input.description ?? "",
    description: input.description ?? "",
    dialogue: input.dialogue,
    notes: input.notes,
    status: (input.status as Storyboard["status"]) ?? "draft",
    order: input.order ?? 0,
    character_asset_ids: input.character_asset_ids ?? [],
    prop_asset_ids: input.prop_asset_ids ?? [],
    version: 1,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  await ctx.storyboards.insert(storyboard);
  log.info({ event: "storyboard.created", id: storyboard.id }, `分镜创建成功：${storyboard.id}`);
  return storyboard;
}

export async function updateStoryboard(
  ctx: AppContext,
  storyboardId: string,
  input: StoryboardInput
): Promise<Storyboard> {
  const existing = await ctx.storyboards.findById(storyboardId);
  if (!existing) throw new Error("分镜不存在");
  const patch: Partial<Storyboard> = {
    ...input,
    status: input.status ? (input.status as Storyboard["status"]) : undefined,
    updated_at: nowIso(),
  };
  await ctx.storyboards.update(storyboardId, patch);
  return { ...existing, ...patch } as Storyboard;
}

/**
 * deleteStoryboard - 软删除分镜，级联软删除其下所有镜头
 */
export async function deleteStoryboard(
  ctx: AppContext,
  storyboardId: string
): Promise<void> {
  const storyboard = await ctx.storyboards.findById(storyboardId);
  if (!storyboard) throw new Error("分镜不存在");

  // 检查是否有 approved 状态的镜头
  const shots = await ctx.shots.findMany({ storyboard_id: storyboardId } as any);
  const hasApproved = shots.some((s) => s.status === "approved" && !s.deleted_at);
  if (hasApproved) {
    throw new Error("分镜下有已审核镜头，请先处理");
  }

  const now = nowIso();
  // 级联软删除镜头
  for (const shot of shots) {
    if (!shot.deleted_at) {
      await ctx.shots.update(shot.id, { deleted_at: now } as any);
    }
  }
  // 软删除分镜
  await ctx.storyboards.update(storyboardId, { deleted_at: now } as any);
  log.info({ event: "storyboard.deleted", id: storyboardId, shotCount: shots.length }, `分镜级联删除：${storyboardId}`);
}

/**
 * restoreStoryboard - 恢复软删除的分镜及其镜头
 */
export async function restoreStoryboard(
  ctx: AppContext,
  storyboardId: string
): Promise<void> {
  await ctx.storyboards.update(storyboardId, { deleted_at: "" } as any);
  const shots = await ctx.shots.findMany({ storyboard_id: storyboardId } as any);
  for (const shot of shots) {
    if (shot.deleted_at) {
      await ctx.shots.update(shot.id, { deleted_at: "" } as any);
    }
  }
  log.info({ event: "storyboard.restored", id: storyboardId }, `分镜恢复：${storyboardId}`);
}

// ==================== Shot 枚举校验 ====================

const VALID_SHOT_SIZES: readonly string[] = [
  "extreme_close_up", "close_up", "medium_close_up", "medium_shot",
  "full_shot", "long_shot", "extreme_long_shot", "over_shoulder",
  "point_of_view", "two_shot", "three_shot", "group_shot",
];

const VALID_CAMERA_ANGLES: readonly string[] = [
  "eye_level", "low_angle", "high_angle", "dutch_angle",
  "overhead", "worm_eye_view", "bird_eye_view", "profile", "three_quarter", "rear_view",
];

const VALID_CAMERA_MOVEMENTS: readonly string[] = [
  "static", "pan", "tilt", "dolly_in", "dolly_out", "truck",
  "crane", "handheld", "steadicam", "zoom_in", "zoom_out", "rack_focus",
];

/**
 * 校验并归一化 shot_size
 * @returns 合法的 ShotSize 或 undefined
 */
function validateShotSize(value: unknown): ShotSize | undefined {
  if (typeof value !== "string") return undefined;
  return VALID_SHOT_SIZES.includes(value) ? (value as ShotSize) : undefined;
}

/**
 * 校验并归一化 camera_angle
 * @returns 合法的 CameraAngle 或 undefined
 */
function validateCameraAngle(value: unknown): CameraAngle | undefined {
  if (typeof value !== "string") return undefined;
  return VALID_CAMERA_ANGLES.includes(value) ? (value as CameraAngle) : undefined;
}

/**
 * 校验并归一化 camera_movement
 * @returns 合法的 CameraMovement 或 undefined
 */
function validateCameraMovement(value: unknown): CameraMovement | undefined {
  if (typeof value !== "string") return undefined;
  return VALID_CAMERA_MOVEMENTS.includes(value) ? (value as CameraMovement) : undefined;
}

/**
 * 校验镜头时长（0.1-30.0 秒）
 */
function validateDuration(value: unknown): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0.1, Math.min(30.0, Math.round(num * 10) / 10));
}

// ==================== Shot Input / Service ====================

export type ShotInput = {
  project_id?: string;
  storyboard_id?: string;
  scene_id?: string;
  episode?: number;
  shot_number?: string;
  title?: string;
  description?: string;
  duration?: number;
  shot_size?: ShotSize;
  camera_angle?: CameraAngle;
  camera_movement?: CameraMovement;
  dialogue?: string;
  notes?: string;
  image_url?: string;
  video_task_id?: string;
  video_url?: string;
  status?: ShotStatus;
  order?: number;
  character_asset_ids?: string[];
  prop_asset_ids?: string[];
  /** 乐观锁版本；提供时必须与当前版本一致。 */
  expected_version?: number;
};

/** 镜头状态机。任何状态变更都必须通过此映射校验。 */
const SHOT_STATUS_TRANSITIONS: Readonly<Record<ShotStatus, readonly ShotStatus[]>> = {
  draft: ["generating", "ready", "archived"],
  generating: ["ready", "needs_fix", "rejected"],
  ready: ["generating", "in_review", "needs_fix", "archived"],
  in_review: ["approved", "needs_fix", "rejected"],
  approved: ["needs_fix", "archived"],
  needs_fix: ["generating", "ready", "in_review", "rejected", "archived"],
  rejected: ["generating", "needs_fix", "archived"],
  archived: ["draft"],
};

export function assertShotStatusTransition(from: ShotStatus, to: ShotStatus): void {
  if (from === to) return;
  if (!SHOT_STATUS_TRANSITIONS[from].includes(to)) {
    throw new Error(`SHOT_INVALID_STATUS_TRANSITION: ${from} -> ${to}`);
  }
}

/**
 * listShots - 列出分镜下的镜头（排除已删除）
 */
export async function listShots(
  ctx: AppContext,
  storyboardId?: string
): Promise<Shot[]> {
  const filter: Partial<Shot> = storyboardId ? { storyboard_id: storyboardId } : {};
  const items = await ctx.shots.findMany(filter, { sort: "desc" });
  return items.filter((item) => !item.deleted_at);
}

/**
 * createShot - 创建新镜头（必须属于一个分镜）
 */
export async function createShot(
  ctx: AppContext,
  input: ShotInput
): Promise<Shot> {
  if (!input.storyboard_id) {
    throw new Error("SHOT_MISSING_STORYBOARD: 镜头必须属于一个分镜");
  }
  const storyboard = await ctx.storyboards.findById(input.storyboard_id);
  if (!storyboard) {
    throw new Error("SHOT_MISSING_STORYBOARD: 分镜不存在");
  }

  const shot: Shot = {
    id: id("sh"),
    project_id: input.project_id ?? storyboard.project_id,
    storyboard_id: input.storyboard_id,
    scene_id: input.scene_id ?? storyboard.scene_id,
    episode: input.episode ?? storyboard.episode,
    shot_number: input.shot_number ?? "shot_001",
    title: input.title ?? input.description ?? "",
    description: input.description ?? "",
    duration: validateDuration(input.duration),
    shot_size: validateShotSize(input.shot_size),
    camera_angle: validateCameraAngle(input.camera_angle),
    camera_movement: validateCameraMovement(input.camera_movement),
    dialogue: input.dialogue,
    notes: input.notes,
    image_url: input.image_url ?? "",
    video_task_id: input.video_task_id ?? "",
    video_url: input.video_url ?? "",
    status: input.status ?? "draft",
    order: input.order ?? 0,
    character_asset_ids: input.character_asset_ids ?? [],
    prop_asset_ids: input.prop_asset_ids ?? [],
    version: 1,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  await ctx.shots.insert(shot);
  log.info({ event: "shot.created", id: shot.id, storyboardId: shot.storyboard_id }, `镜头创建成功：${shot.id}`);
  return shot;
}

export async function updateShot(
  ctx: AppContext,
  shotId: string,
  input: ShotInput
): Promise<Shot> {
  const existing = await ctx.shots.findById(shotId);
  if (!existing) throw new Error("镜头不存在");
  if (
    input.expected_version !== undefined
    && input.expected_version !== (existing.version ?? 1)
  ) {
    throw new Error(
      `SHOT_VERSION_CONFLICT: expected=${input.expected_version}, actual=${existing.version ?? 1}`,
    );
  }
  if (input.status !== undefined) {
    assertShotStatusTransition(existing.status, input.status);
  }

  // 仅接受镜头自身可编辑字段；project_id/storyboard_id 等归属字段禁止通过通用更新迁移。
  const patch: Partial<Shot> = {
    ...(input.scene_id !== undefined ? { scene_id: input.scene_id } : {}),
    ...(input.episode !== undefined ? { episode: input.episode } : {}),
    ...(input.shot_number !== undefined ? { shot_number: input.shot_number } : {}),
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.dialogue !== undefined ? { dialogue: input.dialogue } : {}),
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
    ...(input.image_url !== undefined ? { image_url: input.image_url } : {}),
    ...(input.video_task_id !== undefined ? { video_task_id: input.video_task_id } : {}),
    ...(input.video_url !== undefined ? { video_url: input.video_url } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.order !== undefined ? { order: input.order } : {}),
    ...(input.character_asset_ids !== undefined ? { character_asset_ids: input.character_asset_ids } : {}),
    ...(input.prop_asset_ids !== undefined ? { prop_asset_ids: input.prop_asset_ids } : {}),
    version: (existing.version ?? 1) + 1,
    updated_at: nowIso(),
  };

  // 校验枚举字段（如果传了的话）
  if (input.shot_size !== undefined) {
    patch.shot_size = validateShotSize(input.shot_size);
  }
  if (input.camera_angle !== undefined) {
    patch.camera_angle = validateCameraAngle(input.camera_angle);
  }
  if (input.camera_movement !== undefined) {
    patch.camera_movement = validateCameraMovement(input.camera_movement);
  }
  if (input.duration !== undefined) {
    patch.duration = validateDuration(input.duration);
  }

  await ctx.shots.update(shotId, patch);
  return { ...existing, ...patch } as Shot;
}

/**
 * attachGeneratedVideoToShot - 由镜头模块接收视频模块的完成结果。
 * 视频模块不得直接写 shots 仓储；生成成功只将镜头推进到 ready，不等同于审核通过。
 */
export async function attachGeneratedVideoToShot(
  ctx: AppContext,
  input: { shotId: string; taskId: string; videoUrl: string },
): Promise<Shot> {
  const shot = await ctx.shots.findById(input.shotId);
  if (!shot) throw new Error("镜头不存在");
  assertShotStatusTransition(shot.status, "ready");
  return updateShot(ctx, input.shotId, {
    video_url: input.videoUrl,
    video_task_id: input.taskId,
    status: "ready",
    expected_version: shot.version ?? 1,
  });
}

export async function deleteShot(
  ctx: AppContext,
  shotId: string
): Promise<void> {
  const shot = await ctx.shots.findById(shotId);
  if (!shot) throw new Error("镜头不存在");
  if (shot.status === "approved") {
    throw new Error("已审核的镜头不能删除");
  }
  await ctx.shots.update(shotId, { deleted_at: nowIso() } as any);
  log.info({ event: "shot.deleted", id: shotId }, `镜头删除：${shotId}`);
}

// ==================== 分镜批量操作 ====================

/**
 * batchDeleteStoryboards - 批量软删除分镜（级联删除其下镜头）
 */
export async function batchDeleteStoryboards(ctx: AppContext, ids: string[]): Promise<void> {
  const ts = nowIso();
  for (const storyboardId of ids) {
    // 级联软删除镜头
    const shots = await ctx.shots.findMany({ storyboard_id: storyboardId } as any);
    for (const shot of shots) {
      if (!shot.deleted_at) {
        await ctx.shots.update(shot.id, { deleted_at: ts } as any);
      }
    }
    await ctx.storyboards.update(storyboardId, { deleted_at: ts } as any);
  }
  log.info({ event: "storyboard.batch_deleted", count: ids.length }, `批量删除分镜：${ids.length} 个`);
}

/**
 * batchUpdateStoryboards - 批量更新分镜
 */
export async function batchUpdateStoryboards(
  ctx: AppContext,
  ids: string[],
  patch: StoryboardInput
): Promise<void> {
  const partial: Partial<Storyboard> = {
    ...patch,
    status: patch.status ? (patch.status as Storyboard["status"]) : undefined,
    updated_at: nowIso(),
  };
  for (const id of ids) {
    await ctx.storyboards.update(id, partial);
  }
  log.info({ event: "storyboard.batch_updated", count: ids.length }, `批量更新分镜：${ids.length} 个`);
}

// ==================== 分镜 → 镜头 AI 智能拆分 ====================

/**
 * AI 拆分结果类型
 */
interface AIShotDraft {
  shot_number?: string;
  title?: string;
  description: string;
  duration?: number;
  shot_size?: ShotSize;
  camera_angle?: CameraAngle;
  camera_movement?: CameraMovement;
  dialogue?: string;
}

/**
 * 构建 AI 拆分镜头的 Prompt
 */
function buildShotSplitPrompt(storyboard: Storyboard): string {
  const validShotSizes: ShotSize[] = [
    "extreme_close_up", "close_up", "medium_close_up", "medium_shot",
    "full_shot", "long_shot", "extreme_long_shot", "over_shoulder",
    "point_of_view", "two_shot", "three_shot", "group_shot",
  ];
  const validCameraAngles: CameraAngle[] = [
    "eye_level", "low_angle", "high_angle", "dutch_angle",
    "overhead", "worm_eye_view", "bird_eye_view", "profile", "three_quarter", "rear_view",
  ];
  const validCameraMovements: CameraMovement[] = [
    "static", "pan", "tilt", "dolly_in", "dolly_out", "truck",
    "crane", "handheld", "steadicam", "zoom_in", "zoom_out", "rack_focus",
  ];

  return [
    "你是专业的动画分镜导演助理。请根据以下分镜内容，将其拆分为多个具体的镜头。",
    "",
    "拆分原则：",
    "1. 每个镜头代表一个独立的视觉画面，包含明确的景别、角度和运动",
    "2. 根据对白和动作的自然断点进行拆分",
    "3. 每个镜头时长建议在 2-8 秒之间",
    "4. 镜头之间要有逻辑连贯性",
    "",
    "输出格式：只输出 JSON 数组，不要 Markdown，不要解释。",
    "每个数组元素字段：",
    "- title: 镜头标题（简短描述画面内容）",
    "- description: 镜头详细描述（用于 AI 生图的视觉描述，包含主体、场景、光照等）",
    "- duration: 时长（秒，数字，2-8）",
    ` - shot_size: 景别（可选，必须是以下之一：${validShotSizes.join(", ")}）`,
    ` - camera_angle: 镜头角度（可选，必须是以下之一：${validCameraAngles.join(", ")}）`,
    ` - camera_movement: 镜头运动（可选，必须是以下之一：${validCameraMovements.join(", ")}）`,
    "- dialogue: 该镜头包含的对白（可选，从原文提取）",
    "",
    "分镜信息：",
    `标题：${storyboard.title || "未命名"}`,
    `描述：${storyboard.description || ""}`,
    `对白：${storyboard.dialogue || ""}`,
    `备注：${storyboard.notes || ""}`,
  ].join("\n");
}

/**
 * 从 AI 输出中提取 JSON 数组
 */
function extractJsonArray(text: string): any[] {
  if (!text) return [];
  const trimmed = text.trim();

  // 1) 尝试整段直接 parse
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try { return JSON.parse(trimmed); } catch { }
  }

  // 2) 提取第一个 [ 到最后一个 ]
  const first = trimmed.indexOf("[");
  const last = trimmed.lastIndexOf("]");
  if (first >= 0 && last > first) {
    try { return JSON.parse(trimmed.slice(first, last + 1)); } catch { }
  }

  // 3) 容忍 ```json ... ``` 包裹
  const m = trimmed.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  if (m) {
    try { return JSON.parse(m[1]); } catch { }
  }

  return [];
}

/**
 * 验证并归一化 AI 输出的镜头草稿
 */
function normalizeShotDraft(raw: any, index: number): AIShotDraft {
  const validShotSizes: ShotSize[] = [
    "extreme_close_up", "close_up", "medium_close_up", "medium_shot",
    "full_shot", "long_shot", "extreme_long_shot", "over_shoulder",
    "point_of_view", "two_shot", "three_shot", "group_shot",
  ];
  const validCameraAngles: CameraAngle[] = [
    "eye_level", "low_angle", "high_angle", "dutch_angle",
    "overhead", "worm_eye_view", "bird_eye_view", "profile", "three_quarter", "rear_view",
  ];
  const validCameraMovements: CameraMovement[] = [
    "static", "pan", "tilt", "dolly_in", "dolly_out", "truck",
    "crane", "handheld", "steadicam", "zoom_in", "zoom_out", "rack_focus",
  ];

  return {
    shot_number: `shot_${String(index + 1).padStart(3, "0")}`,
    title: String(raw?.title || `镜头 ${index + 1}`).trim(),
    description: String(raw?.description || raw?.prompt || "").trim(),
    duration: Math.max(2, Math.min(8, Number(raw?.duration) || 3)),
    shot_size: validShotSizes.includes(raw?.shot_size) ? raw.shot_size : undefined,
    camera_angle: validCameraAngles.includes(raw?.camera_angle) ? raw.camera_angle : undefined,
    camera_movement: validCameraMovements.includes(raw?.camera_movement) ? raw.camera_movement : undefined,
    dialogue: raw?.dialogue ? String(raw.dialogue).trim() : undefined,
  };
}

/**
 * autoSplitShots - AI 智能拆分镜头（FEAT-SHOT-013）
 * V2：接入 Agnes AI，根据分镜内容智能拆分镜头
 */
export async function autoSplitShots(
  ctx: AppContext,
  storyboardId: string
): Promise<Shot[]> {
  const storyboard = await ctx.storyboards.findById(storyboardId);
  if (!storyboard) throw new Error("分镜不存在");
  if (!storyboard.dialogue && !storyboard.description) {
    throw new Error("分镜内容为空，无法拆分");
  }

  // 先尝试 AI 智能拆分
  let drafts: AIShotDraft[] = [];
  let usedAI = false;

  try {
    const prompt = buildShotSplitPrompt(storyboard);
    const aiText = await safeAICall("autoSplitShots.ai", async () => {
      const ctrl = new AbortController();
      const timeoutId = setTimeout(() => ctrl.abort(), AI_TIMEOUTS.chat);
      try {
        let buf = "";
        for await (const chunk of ctx.ai.chat({
          conversationId: `shot-split-${storyboardId}`,
          message: prompt,
          model: DEFAULT_MODEL,
          temperature: 0.3,
          max_tokens: 2000,
        }, ctrl.signal)) {
          buf += chunk.content;
        }
        return buf;
      } finally {
        clearTimeout(timeoutId);
      }
    });

    const parsed = extractJsonArray(aiText);
    if (parsed.length > 0) {
      drafts = parsed.map((item, idx) => normalizeShotDraft(item, idx));
      usedAI = true;
      log.info({ event: "shot.ai_split", storyboardId, count: drafts.length }, `AI 拆分镜头：${storyboardId} → ${drafts.length} 个`);
    }
  } catch (err) {
    log.warn({ event: "shot.ai_split_failed", storyboardId, err }, `AI 拆分失败，回退到启发式规则：${err instanceof Error ? err.message : String(err)}`);
  }

  // AI 失败或返回空：回退到启发式规则
  if (drafts.length === 0) {
    const paragraphs = [
      ...(storyboard.dialogue ? storyboard.dialogue.split("\n") : []),
      ...(storyboard.description ? storyboard.description.split("\n") : []),
    ].filter((p) => p.trim().length > 0);

    drafts = paragraphs.map((p, i) => ({
      shot_number: `shot_${String(i + 1).padStart(3, "0")}`,
      title: `镜头 ${i + 1}`,
      description: p.trim(),
      duration: 3,
    }));
    log.info({ event: "shot.fallback_split", storyboardId, count: drafts.length }, `启发式拆分镜头：${storyboardId} → ${drafts.length} 个`);
  }

  if (drafts.length === 0) {
    throw new Error("分镜内容为空，无法拆分");
  }

  // 创建镜头记录
  const shots: Shot[] = [];
  for (let i = 0; i < drafts.length; i++) {
    const draft = drafts[i];
    const shot = await createShot(ctx, {
      project_id: storyboard.project_id,
      storyboard_id: storyboardId,
      scene_id: storyboard.scene_id,
      episode: storyboard.episode,
      shot_number: draft.shot_number,
      title: draft.title,
      description: draft.description,
      duration: draft.duration,
      shot_size: draft.shot_size,
      camera_angle: draft.camera_angle,
      camera_movement: draft.camera_movement,
      dialogue: draft.dialogue,
      status: "draft",
      order: i,
    });
    shots.push(shot);
  }

  log.info({ event: "shot.auto_split_done", storyboardId, count: shots.length, usedAI }, `自动拆分完成：${storyboardId} → ${shots.length} 个镜头（AI=${usedAI}）`);
  return shots;
}

// ==================== 镜头快照 ====================

export async function createShotSnapshot(
  ctx: AppContext,
  shotId: string,
  changeNote?: string
): Promise<void> {
  const shot = await ctx.shots.findById(shotId);
  if (!shot) throw new Error("镜头不存在");

  const version = (shot.version ?? 1) + 1;
  await ctx.shotSnapshots.insert({
    id: id("ss"),
    project_id: shot.project_id,
    shot_id: shotId,
    version,
    data: JSON.stringify(shot),
    change_note: changeNote ?? "",
    created_by: "system",
    created_at: nowIso(),
  } as any);

  await ctx.shots.update(shotId, { version } as any);
  log.info({ event: "shot.snapshot", shotId, version }, `镜头快照：${shotId} v${version}`);
}

export async function listShotSnapshots(
  ctx: AppContext,
  shotId: string
): Promise<any[]> {
  return ctx.shotSnapshots.findMany({ shot_id: shotId } as any, { sort: "desc" });
}
