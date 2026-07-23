/**
 * @file shot-command-runner.ts
 * @description Shot 聚合 Command Handler 装配层（模块域内部）。
 *
 * 任务 A 独占。本文件为 `services/module-domain/storyboard-module.ts` 与
 * `services/module-domain/video-generation.ts` 提供一个轻量入口：把 AppContext
 * 转换成 `ShotHandlerDeps`（ShotRepository + UnitOfWork），并对常用命令做
 * 命令 ID 生成与异常归一封装。
 *
 * 设计约束：
 *  - 不修改 `app.ts`（公共装配）。本文件只读取 `ctx.databaseFile` 与
 *    `ctx.transactionService` 这两个已对外暴露的字段。
 *  - 不修改 Review / Pipeline 模块。
 *  - 所有 Shot 状态写入必须经过 `shot.aggregate.ts` 的行为方法，再经命令
 *    Handler 进入 `SqliteShotRepository`。本文件不直接 `shots.update`。
 *  - 兼容旧接口（`createShot` / `updateShot` / `deleteShot` /
 *    `attachGeneratedVideoToShot`）时，旧接口在内部 dispatch 到对应命令，
 *    状态修改全部走聚合。
 */

import type { AppContext } from "../app.js";
import { SqliteShotRepository } from "../../infrastructure/persistence/sqlite-shot.repository.js";
import { createTransactionServiceUnitOfWork } from "../../infrastructure/unit-of-work/transaction-service-unit-of-work.js";
import type { ShotHandlerDeps } from "../../application/storyboard/shot-command-handler.js";
import {
  handleCreateShot,
  type CreateShotCommand,
} from "../../application/storyboard/create-shot.command.js";
import {
  handleEditShot,
  type EditShotCommand,
} from "../../application/storyboard/edit-shot.command.js";
import {
  handleStartShotGeneration,
  type StartShotGenerationCommand,
} from "../../application/storyboard/start-shot-generation.command.js";
import {
  handleAttachShotVideoCandidate,
  type AttachShotVideoCandidateCommand,
} from "../../application/storyboard/attach-shot-video-candidate.command.js";
import {
  handleSubmitShotReview,
  type SubmitShotReviewCommand,
} from "../../application/storyboard/submit-shot-review.command.js";
import {
  handleApplyShotReviewResult,
  type ApplyShotReviewResultCommand,
} from "../../application/storyboard/apply-shot-review-result.command.js";
import {
  handleArchiveShot,
  handleSoftDeleteShot,
  handleRestoreShot,
  type ArchiveShotCommand,
  type SoftDeleteShotCommand,
  type RestoreShotCommand,
} from "../../application/storyboard/archive-shot.command.js";
import type { ShotAggregate, ShotEditableMetadata } from "../../domain/storyboard/shot.aggregate.js";
import type { Shot, ShotStatus } from "../../types/storyboard.js";

/**
 * 每个 AppContext 维护一个轻量 ShotHandlerDeps 缓存。
 * 缓存 key 是 `databaseFile` 路径，保证多实例共存（测试）时互不污染。
 */
const DEPS_CACHE = new Map<string, ShotHandlerDeps>();

function buildDeps(ctx: AppContext): ShotHandlerDeps {
  const key = ctx.databaseFile;
  const cached = DEPS_CACHE.get(key);
  if (cached) return cached;
  const repo = new SqliteShotRepository(ctx.databaseFile);
  const uow = createTransactionServiceUnitOfWork(ctx.transactionService);
  const deps: ShotHandlerDeps = { repo, uow };
  DEPS_CACHE.set(key, deps);
  return deps;
}

/** 测试或热重载时清理缓存。 */
export function clearShotCommandRunnerCache(): void {
  DEPS_CACHE.clear();
}

/** 生成幂等命令 ID：`<command>:<shotId>:<actorId>:<random>`。 */
function newCommandId(command: string, shotId: string, actorId: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${command}:${shotId}:${actorId}:${Date.now()}:${rand}`;
}

/** 统一的 issuedAt 时间戳（ISO）。 */
function nowIssuedAt(): string {
  return new Date().toISOString();
}

// ===== 公共：把聚合降级为 read model（Storyboard-module 旧接口仍以 Shot 类型返回） =====

function toShotModel(agg: ShotAggregate): Shot {
  return {
    id: agg.id,
    project_id: agg.projectId,
    storyboard_id: agg.storyboardId,
    scene_id: agg.sceneId,
    episode: agg.episode,
    shot_number: agg.shotNumber,
    title: agg.title,
    description: agg.description,
    duration: agg.duration,
    shot_size: (agg.shotSize || undefined) as Shot["shot_size"],
    camera_angle: (agg.cameraAngle || undefined) as Shot["camera_angle"],
    camera_movement: (agg.cameraMovement || undefined) as Shot["camera_movement"],
    dialogue: agg.dialogue,
    notes: agg.notes,
    image_url: agg.imageUrl,
    video_task_id: agg.videoTaskId,
    video_url: agg.videoUrl,
    status: agg.status as ShotStatus,
    order: agg.order,
    character_asset_ids: [...agg.characterAssetIds],
    prop_asset_ids: [...agg.propAssetIds],
    version: agg.version,
    created_at: agg.createdAt,
    updated_at: agg.updatedAt,
    deleted_at: agg.deletedAt || undefined,
  } as Shot;
}

// ===== Command Runner 入口 =====

export interface CreateShotRunnerInput {
  projectId: string;
  storyboardId: string;
  sceneId?: string;
  episode?: number;
  shotNumber?: string;
  title?: string;
  description?: string;
  duration?: number;
  shotSize?: string;
  cameraAngle?: string;
  cameraMovement?: string;
  dialogue?: string;
  notes?: string;
  imageUrl?: string;
  order?: number;
  characterAssetIds?: string[];
  propAssetIds?: string[];
  actorId?: string;
}

export async function runCreateShot(
  ctx: AppContext,
  input: CreateShotRunnerInput,
): Promise<Shot> {
  const deps = buildDeps(ctx);
  const command: CreateShotCommand = {
    type: "CreateShot",
    commandId: newCommandId("create-shot", input.storyboardId, input.actorId ?? "system"),
    issuedAt: nowIssuedAt(),
    projectId: input.projectId,
    storyboardId: input.storyboardId,
    sceneId: input.sceneId,
    episode: input.episode,
    shotNumber: input.shotNumber,
    title: input.title,
    description: input.description,
    duration: input.duration,
    shotSize: input.shotSize,
    cameraAngle: input.cameraAngle,
    cameraMovement: input.cameraMovement,
    dialogue: input.dialogue,
    notes: input.notes,
    imageUrl: input.imageUrl,
    order: input.order,
    characterAssetIds: input.characterAssetIds,
    propAssetIds: input.propAssetIds,
  };
  const aggregate = await handleCreateShot(deps, command);
  return toShotModel(aggregate);
}

export interface EditShotRunnerInput {
  shotId: string;
  actorId: string;
  patch: ShotEditableMetadata;
}

export async function runEditShot(
  ctx: AppContext,
  input: EditShotRunnerInput,
): Promise<Shot> {
  const deps = buildDeps(ctx);
  const command: EditShotCommand = {
    type: "EditShot",
    commandId: newCommandId("edit-shot", input.shotId, input.actorId),
    issuedAt: nowIssuedAt(),
    shotId: input.shotId,
    actorId: input.actorId,
    patch: input.patch,
  };
  const aggregate = await handleEditShot(deps, command);
  return toShotModel(aggregate);
}

export interface StartGenerationRunnerInput {
  shotId: string;
  actorId: string;
  generationRequestId: string;
  videoTaskId?: string;
}

export async function runStartGeneration(
  ctx: AppContext,
  input: StartGenerationRunnerInput,
): Promise<void> {
  const deps = buildDeps(ctx);
  const command: StartShotGenerationCommand = {
    type: "StartShotGeneration",
    commandId: newCommandId(
      "start-shot-generation",
      input.shotId,
      input.actorId,
    ),
    issuedAt: nowIssuedAt(),
    shotId: input.shotId,
    actorId: input.actorId,
    generationRequestId: input.generationRequestId,
    videoTaskId: input.videoTaskId,
  };
  await handleStartShotGeneration(deps, command);
}

export interface AttachVideoCandidateRunnerInput {
  shotId: string;
  providerRequestId: string;
  videoUrl: string;
  generationRequestId: string;
  attachedBy: string;
  candidateId?: string;
}

export async function runAttachVideoCandidate(
  ctx: AppContext,
  input: AttachVideoCandidateRunnerInput,
): Promise<void> {
  const deps = buildDeps(ctx);
  const command: AttachShotVideoCandidateCommand = {
    type: "AttachShotVideoCandidate",
    commandId: newCommandId(
      "attach-shot-video-candidate",
      input.shotId,
      input.attachedBy,
    ),
    issuedAt: nowIssuedAt(),
    shotId: input.shotId,
    candidateId: input.candidateId,
    providerRequestId: input.providerRequestId,
    videoUrl: input.videoUrl,
    generationRequestId: input.generationRequestId,
    attachedBy: input.attachedBy,
  };
  await handleAttachShotVideoCandidate(deps, command);
}

export interface SubmitReviewRunnerInput {
  shotId: string;
  submittedBy: string;
  pipelineRunId?: string;
  pipelineNodeId?: string;
}

export async function runSubmitReview(
  ctx: AppContext,
  input: SubmitReviewRunnerInput,
): Promise<void> {
  const deps = buildDeps(ctx);
  const command: SubmitShotReviewCommand = {
    type: "SubmitShotReview",
    commandId: newCommandId("submit-shot-review", input.shotId, input.submittedBy),
    issuedAt: nowIssuedAt(),
    shotId: input.shotId,
    submittedBy: input.submittedBy,
    pipelineRunId: input.pipelineRunId,
    pipelineNodeId: input.pipelineNodeId,
  };
  await handleSubmitShotReview(deps, command);
}

export interface ApplyReviewResultRunnerInput {
  shotId: string;
  reviewId: string;
  reviewedBy: string;
  decision: "approved" | "rejected";
  reasonCode?: string;
  pipelineRunId?: string;
  pipelineNodeId?: string;
}

export async function runApplyReviewResult(
  ctx: AppContext,
  input: ApplyReviewResultRunnerInput,
): Promise<void> {
  const deps = buildDeps(ctx);
  const command: ApplyShotReviewResultCommand = {
    type: "ApplyShotReviewResult",
    commandId: newCommandId(
      input.decision === "approved" ? "approve-shot" : "reject-shot",
      input.shotId,
      input.reviewedBy,
    ),
    issuedAt: nowIssuedAt(),
    shotId: input.shotId,
    reviewId: input.reviewId,
    reviewedBy: input.reviewedBy,
    decision: input.decision,
    reasonCode: input.reasonCode,
    pipelineRunId: input.pipelineRunId,
    pipelineNodeId: input.pipelineNodeId,
  };
  await handleApplyShotReviewResult(deps, command);
}

export interface ArchiveShotRunnerInput {
  shotId: string;
  actorId: string;
}

export async function runArchiveShot(
  ctx: AppContext,
  input: ArchiveShotRunnerInput,
): Promise<void> {
  const deps = buildDeps(ctx);
  const command: ArchiveShotCommand = {
    type: "ArchiveShot",
    commandId: newCommandId("archive-shot", input.shotId, input.actorId),
    issuedAt: nowIssuedAt(),
    shotId: input.shotId,
    actorId: input.actorId,
  };
  await handleArchiveShot(deps, command);
}

export interface SoftDeleteShotRunnerInput {
  shotId: string;
  actorId: string;
}

export async function runSoftDeleteShot(
  ctx: AppContext,
  input: SoftDeleteShotRunnerInput,
): Promise<void> {
  const deps = buildDeps(ctx);
  const command: SoftDeleteShotCommand = {
    type: "SoftDeleteShot",
    commandId: newCommandId("soft-delete-shot", input.shotId, input.actorId),
    issuedAt: nowIssuedAt(),
    shotId: input.shotId,
    actorId: input.actorId,
  };
  await handleSoftDeleteShot(deps, command);
}

export interface RestoreShotRunnerInput {
  shotId: string;
  actorId: string;
  /** true=从 archived 还原到 draft；false/undefined=仅清空 deleted_at。 */
  fromArchive?: boolean;
}

export async function runRestoreShot(
  ctx: AppContext,
  input: RestoreShotRunnerInput,
): Promise<void> {
  const deps = buildDeps(ctx);
  const command: RestoreShotCommand = {
    type: "RestoreShot",
    commandId: newCommandId("restore-shot", input.shotId, input.actorId),
    issuedAt: nowIssuedAt(),
    shotId: input.shotId,
    actorId: input.actorId,
    fromArchive: input.fromArchive,
  };
  await handleRestoreShot(deps, command);
}

/** 内部使用：直接从 Repository 拿聚合（聚合只读访问）。 */
export async function loadShotAggregate(
  ctx: AppContext,
  shotId: string,
): Promise<ShotAggregate | null> {
  const deps = buildDeps(ctx);
  return deps.repo.get(shotId);
}
