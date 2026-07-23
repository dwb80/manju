import type { AppContext } from "../app.js";
import type { Storyboard, Shot, ShotStatus, ShotSize, CameraAngle, CameraMovement } from "../../types/storyboard.js";
import { id, nowIso, safeAICall, DEFAULT_MODEL } from "../../utils.js";
import { rootLogger } from "../../logger.js";
import { AI_TIMEOUTS } from "../../utils.js";
import {
  runCreateShot,
  runEditShot,
  runSoftDeleteShot,
  runRestoreShot,
  runAttachVideoCandidate,
  loadShotAggregate,
  type CreateShotRunnerInput,
  type EditShotRunnerInput,
  type AttachVideoCandidateRunnerInput,
  type SoftDeleteShotRunnerInput,
  type RestoreShotRunnerInput,
} from "./shot-command-runner.js";
import { SHOT_TRANSITIONS } from "../../domain/storyboard/shot-state-machine.js";

const log = rootLogger.child({ module: "storyboard" });

/**
 * 旧调用方使用的只读迁移校验门面。真正状态变更仍必须走 Shot 聚合命令。
 */
export function assertShotStatusTransition(from: ShotStatus, to: ShotStatus): void {
  const allowed = SHOT_TRANSITIONS.some(
    ([transitionFrom, , transitionTo]) => transitionFrom === from && transitionTo === to,
  );
  if (!allowed) {
    throw new Error(`SHOT_INVALID_STATUS_TRANSITION:${from}->${to}`);
  }
}

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
 *
 * 注：级联软删除镜头会通过 runSoftDeleteShot 走 Shot 聚合，校验已审核镜头。
 * 如果某个镜头已是 in_review/approved，聚合会抛 shot_protected_from_delete。
 */
export async function deleteStoryboard(
  ctx: AppContext,
  storyboardId: string
): Promise<void> {
  const storyboard = await ctx.storyboards.findById(storyboardId);
  if (!storyboard) throw new Error("分镜不存在");

  // 先检查是否有 approved 状态的镜头（与原语义一致）
  const shots = await ctx.shots.findMany({ storyboard_id: storyboardId } as any);
  const hasApproved = shots.some((s) => s.status === "approved" && !s.deleted_at);
  if (hasApproved) {
    throw new Error("分镜下有已审核镜头，请先处理");
  }

  // 级联软删除镜头：走 Shot 聚合命令
  for (const shot of shots) {
    if (!shot.deleted_at) {
      try {
        await runSoftDeleteShot(ctx, {
          shotId: shot.id,
          actorId: "system:deleteStoryboard",
        } satisfies SoftDeleteShotRunnerInput);
      } catch (err) {
        // 已审核镜头（in_review/approved）禁止普通删除 —— 聚合抛出 DomainError。
        // 仍允许删除 storyboard 本身（语义兼容）；记录错误但不阻断 storyboard 删除。
        log.warn(
          { event: "shot.cascade_soft_delete_blocked", shotId: shot.id, err: String(err) },
          `级联软删除镜头被聚合拦截：${shot.id}`,
        );
      }
    }
  }
  // 软删除分镜（Storyboard 仍是直接 patch —— Storyboard 不在本次 Shot 任务范围）
  await ctx.storyboards.update(storyboardId, { deleted_at: nowIso() } as any);
  log.info({ event: "storyboard.deleted", id: storyboardId, shotCount: shots.length }, `分镜级联删除：${storyboardId}`);
}

/**
 * restoreStoryboard - 恢复软删除的分镜及其镜头
 *
 * 注：镜头恢复通过 runRestoreShot 走 Shot 聚合。
 */
export async function restoreStoryboard(
  ctx: AppContext,
  storyboardId: string
): Promise<void> {
  await ctx.storyboards.update(storyboardId, { deleted_at: "" } as any);
  const shots = await ctx.shots.findMany({ storyboard_id: storyboardId } as any);
  for (const shot of shots) {
    if (shot.deleted_at) {
      try {
        await runRestoreShot(ctx, {
          shotId: shot.id,
          actorId: "system:restoreStoryboard",
        } satisfies RestoreShotRunnerInput);
      } catch (err) {
        log.warn(
          { event: "shot.cascade_restore_failed", shotId: shot.id, err: String(err) },
          `级联恢复镜头失败：${shot.id}`,
        );
      }
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
  /** 编辑/创建时的操作者 ID，传入命令作为 actorId 字段。 */
  actor_id?: string;
};

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
 *
 * 走 CreateShot 命令，由 Shot 聚合负责状态初始化（draft）与快照写入。
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

  // 归一化枚举 / 时长字段
  const shotSize = validateShotSize(input.shot_size);
  const cameraAngle = validateCameraAngle(input.camera_angle);
  const cameraMovement = validateCameraMovement(input.camera_movement);
  const duration = validateDuration(input.duration);

  const runnerInput: CreateShotRunnerInput = {
    projectId: input.project_id ?? storyboard.project_id,
    storyboardId: input.storyboard_id,
    sceneId: input.scene_id ?? storyboard.scene_id,
    episode: input.episode ?? storyboard.episode,
    shotNumber: input.shot_number ?? "shot_001",
    title: input.title ?? input.description ?? "",
    description: input.description ?? "",
    duration,
    shotSize,
    cameraAngle,
    cameraMovement,
    dialogue: input.dialogue,
    notes: input.notes,
    imageUrl: input.image_url,
    order: input.order,
    characterAssetIds: input.character_asset_ids,
    propAssetIds: input.prop_asset_ids,
    actorId: input.actor_id ?? "system",
  };

  const shot = await runCreateShot(ctx, runnerInput);
  log.info({ event: "shot.created", id: shot.id, storyboardId: shot.storyboard_id }, `镜头创建成功：${shot.id}`);
  return shot;
}

/**
 * updateShot - 编辑镜头元数据
 *
 * 注意：受保护字段（status / version / 审核结果等）不能通过此接口修改，
 * 必须使用对应的命令（attachGeneratedVideoToShot / submit / approve / reject
 * / archive / softDelete 等）。保留 expected_version 字段做乐观锁前置检查，
 * 真正的乐观锁由聚合 Repository 在 save 时再次确认。
 */
export async function updateShot(
  ctx: AppContext,
  shotId: string,
  input: ShotInput
): Promise<Shot> {
  // 1. 预读：用于 expected_version 校验
  const existingAggregate = await loadShotAggregate(ctx, shotId);
  if (!existingAggregate) throw new Error("镜头不存在");

  // 2. 乐观锁：调用方传入的 expected_version 必须匹配当前聚合版本
  if (
    input.expected_version !== undefined
    && input.expected_version !== existingAggregate.version
  ) {
    throw new Error(
      `SHOT_VERSION_CONFLICT: expected=${input.expected_version}, actual=${existingAggregate.version}`,
    );
  }

  // 3. 拒绝 status / video_url / video_task_id 等受保护字段通过此接口传入
  if (input.status !== undefined) {
    throw new Error(
      "SHOT_INVALID_STATUS_TRANSITION: status 不能通过 updateShot 修改，请使用 startGeneration / attachGeneratedVideo / submitForReview 等命令",
    );
  }
  if (input.video_url !== undefined) {
    throw new Error(
      "SHOT_PROTECTED_FIELD: video_url 不能通过 updateShot 修改，请使用 attachGeneratedVideoToShot",
    );
  }
  if (input.video_task_id !== undefined) {
    throw new Error(
      "SHOT_PROTECTED_FIELD: video_task_id 不能通过 updateShot 修改，请使用 startGeneration / attachGeneratedVideoToShot",
    );
  }

  // 4. 构建合法 patch：仅允许元数据字段
  const patch: EditShotRunnerInput["patch"] = {
    ...(input.scene_id !== undefined ? { scene_id: input.scene_id } : {}),
    ...(input.episode !== undefined ? { episode: input.episode } : {}),
    ...(input.shot_number !== undefined ? { shot_number: input.shot_number } : {}),
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.dialogue !== undefined ? { dialogue: input.dialogue } : {}),
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
    ...(input.image_url !== undefined ? { image_url: input.image_url } : {}),
    ...(input.order !== undefined ? { order: input.order } : {}),
    ...(input.character_asset_ids !== undefined ? { character_asset_ids: input.character_asset_ids } : {}),
    ...(input.prop_asset_ids !== undefined ? { prop_asset_ids: input.prop_asset_ids } : {}),
  };
  // 校验枚举字段（如果传了的话）
  if (input.shot_size !== undefined) {
    const v = validateShotSize(input.shot_size);
    if (v) patch.shot_size = v as any;
  }
  if (input.camera_angle !== undefined) {
    const v = validateCameraAngle(input.camera_angle);
    if (v) patch.camera_angle = v as any;
  }
  if (input.camera_movement !== undefined) {
    const v = validateCameraMovement(input.camera_movement);
    if (v) patch.camera_movement = v as any;
  }
  if (input.duration !== undefined) {
    patch.duration = validateDuration(input.duration);
  }

  const runnerInput: EditShotRunnerInput = {
    shotId,
    actorId: input.actor_id ?? "system",
    patch,
  };
  return runEditShot(ctx, runnerInput);
}

/**
 * attachGeneratedVideoToShot - 由镜头模块接收视频模块的完成结果。
 *
 * 走 AttachShotVideoCandidate 命令（generating -> ready），由聚合负责
 * 状态推进、版本递增、快照写入和领域事件入队。
 *
 * 重要：
 *  - 视频模块不得直接写 shots 仓储；只调用此入口。
 *  - 生成成功只将镜头推进到 ready，不等同于审核通过。
 *  - 重复 providerRequestId 回调被聚合识别为幂等，不重复写候选。
 *
 * 参数说明：
 *  - generationRequestId：发起此次生成的请求 id，聚合用它做幂等校验。
 *    旧调用方可能未传入；本函数会回退到 `taskId`（视频任务 id），
 *    并在交付报告中标注该路径。
 *  - attachedBy：写入候选时的操作者（默认 "system"）。
 */
export async function attachGeneratedVideoToShot(
  ctx: AppContext,
  input: { shotId: string; taskId: string; videoUrl: string; generationRequestId?: string; attachedBy?: string },
): Promise<Shot> {
  const existing = await loadShotAggregate(ctx, input.shotId);
  if (!existing) throw new Error("镜头不存在");
  // 防御性：非 generating 状态直接拒绝（与原语义一致）。
  if (existing.status !== "generating") {
    throw new Error(
      `SHOT_INVALID_STATUS_TRANSITION: ${existing.status} -> ready (attachGeneratedVideo 要求 generating 状态)`,
    );
  }
  const generationRequestId = input.generationRequestId || input.taskId;
  const providerRequestId = `${input.taskId}:${generationRequestId}`;
  const runnerInput: AttachVideoCandidateRunnerInput = {
    shotId: input.shotId,
    providerRequestId,
    videoUrl: input.videoUrl,
    generationRequestId,
    attachedBy: input.attachedBy ?? "system",
  };
  await runAttachVideoCandidate(ctx, runnerInput);
  const reloaded = await loadShotAggregate(ctx, input.shotId);
  if (!reloaded) throw new Error("镜头不存在");
  return {
    id: reloaded.id,
    project_id: reloaded.projectId,
    storyboard_id: reloaded.storyboardId,
    scene_id: reloaded.sceneId,
    episode: reloaded.episode,
    shot_number: reloaded.shotNumber,
    title: reloaded.title,
    description: reloaded.description,
    duration: reloaded.duration,
    shot_size: (reloaded.shotSize || undefined) as Shot["shot_size"],
    camera_angle: (reloaded.cameraAngle || undefined) as Shot["camera_angle"],
    camera_movement: (reloaded.cameraMovement || undefined) as Shot["camera_movement"],
    dialogue: reloaded.dialogue,
    notes: reloaded.notes,
    image_url: reloaded.imageUrl,
    video_task_id: reloaded.videoTaskId,
    video_url: reloaded.videoUrl,
    status: reloaded.status as ShotStatus,
    order: reloaded.order,
    character_asset_ids: [...reloaded.characterAssetIds],
    prop_asset_ids: [...reloaded.propAssetIds],
    version: reloaded.version,
    created_at: reloaded.createdAt,
    updated_at: reloaded.updatedAt,
    deleted_at: reloaded.deletedAt || undefined,
  } as Shot;
}

export async function deleteShot(
  ctx: AppContext,
  shotId: string
): Promise<void> {
  const existing = await loadShotAggregate(ctx, shotId);
  if (!existing) throw new Error("镜头不存在");
  if (existing.status === "approved") {
    throw new Error("已审核的镜头不能删除");
  }
  await runSoftDeleteShot(ctx, {
    shotId,
    actorId: "system",
  } satisfies SoftDeleteShotRunnerInput);
  log.info({ event: "shot.deleted", id: shotId }, `镜头删除：${shotId}`);
}

// ==================== 分镜批量操作 ====================

/**
 * batchDeleteStoryboards - 批量软删除分镜（级联删除其下镜头）
 */
export async function batchDeleteStoryboards(ctx: AppContext, ids: string[]): Promise<void> {
  const ts = nowIso();
  for (const storyboardId of ids) {
    // 级联软删除镜头：走 Shot 聚合命令
    const shots = await ctx.shots.findMany({ storyboard_id: storyboardId } as any);
    for (const shot of shots) {
      if (!shot.deleted_at) {
        try {
          await runSoftDeleteShot(ctx, {
            shotId: shot.id,
            actorId: "system:batchDeleteStoryboards",
          } satisfies SoftDeleteShotRunnerInput);
        } catch (err) {
          log.warn(
            { event: "shot.cascade_soft_delete_blocked", shotId: shot.id, err: String(err) },
            `批量级联软删除镜头被聚合拦截：${shot.id}`,
          );
        }
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

/**
 * createShotSnapshot - 创建外部快照记录。
 *
 * 注意：
 *  - 业务快照（版本、状态变更、change_note 关联）由 Shot 聚合在每次
 *    状态变更时自动写入 shot_snapshots；本函数用于"用户主动打点"。
 *  - 旧实现直接 `ctx.shots.update(shotId, { version })` 自增版本号；
 *    该写入绕过聚合——已在权限外 Shot 写入口报告。
 *  - 本函数仅负责新增 shot_snapshots 行，不修改 shots.version。
 *    version 由后续业务命令递增。
 */
export async function createShotSnapshot(
  ctx: AppContext,
  shotId: string,
  changeNote?: string
): Promise<void> {
  const shot = await loadShotAggregate(ctx, shotId);
  if (!shot) throw new Error("镜头不存在");

  await ctx.shotSnapshots.insert({
    id: id("ss"),
    project_id: shot.projectId,
    shot_id: shotId,
    version: shot.version,
    data: JSON.stringify(shot.toPersistenceRow()),
    change_note: changeNote ?? "",
    created_by: "system",
    created_at: nowIso(),
  } as any);

  log.info(
    { event: "shot.snapshot", shotId, version: shot.version },
    `镜头外部快照：${shotId} v${shot.version}`,
  );
}

export async function listShotSnapshots(
  ctx: AppContext,
  shotId: string
): Promise<any[]> {
  return ctx.shotSnapshots.findMany({ shot_id: shotId } as any, { sort: "desc" });
}
