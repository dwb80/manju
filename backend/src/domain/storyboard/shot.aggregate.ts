/**
 * @file shot.aggregate.ts
 * @description Shot 聚合根。
 *
 * 职责（迭代计划 §5.4 / §5.5）：
 *  - 拥有镜头八状态机；状态、版本、生成候选、审核结果只能由本聚合修改。
 *  - 校验不变量：普通编辑不能改 status/version/审核结果；送审需有有效生成结果；
 *    已审核（in_review/approved）禁止普通删除；重复 Provider 回调不能覆盖人工返工后的状态。
 *  - 产出领域事件（ShotVideoCandidateAttached / ShotSubmittedForReview /
 *    ShotApproved / ShotRejected）。
 *  - 每次成功业务变更只递增一次聚合版本（供 Repository 乐观锁）。
 *  - 不依赖 AppContext / HTTP / SQLite / AI Provider；可在纯内存中测试。
 *
 * 跨聚合边界（与 Review 任务的契约）：
 *  - Shot 不直接创建 Review；送审仅发 ShotSubmittedForReview 事件。
 *  - Shot 不直接完成 Pipeline 节点；审核结果由 Review 任务产出的 ReviewApproved/
 *    ReviewRejected 事件经协调者驱动 ApplyShotReviewResultCommand 进入本聚合。
 */

import { randomUUID } from "node:crypto";
import type { AggregateRoot } from "../shared/aggregate-root.js";
import type { DomainEvent } from "../shared/domain-event.js";
import {
  assertShotTransition,
  isShotTerminal,
  type ShotCommand,
  type ShotStatus,
} from "./shot-state-machine.js";
import {
  invalidShotTransitionError,
  shotAlreadyProcessedError,
  shotCandidateMismatchError,
  shotInvariantViolatedError,
  shotIsTerminalError,
  shotMissingReviewResultError,
  shotMissingVideoResultError,
  shotNotFoundError,
  shotProtectedFromDeleteError,
  shotRejectionReasonRequiredError,
} from "./shot-errors.js";
import {
  shotApprovedEvent,
  shotRejectedEvent,
  shotSubmittedForReviewEvent,
  shotVideoCandidateAttachedEvent,
} from "./shot-events.js";

/** 镜头枚举/约束。 */
export const SHOT_SIZE_ENUM = [
  "extreme_close_up",
  "close_up",
  "medium_close_up",
  "medium_shot",
  "full_shot",
  "long_shot",
  "extreme_long_shot",
  "over_shoulder",
  "point_of_view",
  "two_shot",
  "three_shot",
  "group_shot",
] as const;
export type ShotSizeValue = (typeof SHOT_SIZE_ENUM)[number];

export const CAMERA_ANGLE_ENUM = [
  "eye_level",
  "low_angle",
  "high_angle",
  "dutch_angle",
  "overhead",
  "worm_eye_view",
  "bird_eye_view",
  "profile",
  "three_quarter",
  "rear_view",
] as const;
export type CameraAngleValue = (typeof CAMERA_ANGLE_ENUM)[number];

export const CAMERA_MOVEMENT_ENUM = [
  "static",
  "pan",
  "tilt",
  "dolly_in",
  "dolly_out",
  "truck",
  "crane",
  "handheld",
  "steadicam",
  "zoom_in",
  "zoom_out",
  "rack_focus",
] as const;
export type CameraMovementValue = (typeof CAMERA_MOVEMENT_ENUM)[number];

/** 时长范围（秒）。 */
export const SHOT_DURATION_MIN = 0.1;
export const SHOT_DURATION_MAX = 30.0;

/** 镜头生成视频候选（聚合内部持有）。 */
export interface ShotVideoCandidate {
  readonly id: string;
  readonly providerRequestId: string;
  readonly videoUrl: string;
  readonly attachedAt: string;
  readonly attachedBy: string;
  /** 关联到 generationRequestId（用于重复回调校验）。 */
  readonly generationRequestId: string;
}

/** 镜头审核结果（聚合内部持有）。 */
export interface ShotReviewResult {
  readonly reviewId: string;
  readonly status: "approved" | "rejected";
  readonly reviewedBy: string;
  readonly reasonCode: string;
  readonly at: string;
  readonly pipelineRunId?: string;
  readonly pipelineNodeId?: string;
}

/** 镜头编辑元数据输入。editMetadata 接受这些字段。 */
export interface ShotEditableMetadata {
  scene_id?: string;
  episode?: number;
  shot_number?: string;
  title?: string;
  description?: string;
  duration?: number;
  shot_size?: ShotSizeValue;
  camera_angle?: CameraAngleValue;
  camera_movement?: CameraMovementValue;
  dialogue?: string;
  notes?: string;
  image_url?: string;
  order?: number;
  character_asset_ids?: string[];
  prop_asset_ids?: string[];
}

/** 持久化需要的最小上下文（用于事件 payload，不参与状态判断）。 */
export interface ShotPipelineContext {
  pipelineRunId?: string;
  pipelineNodeId?: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function snapshotId(): string {
  return `shot_snapshot-${randomUUID()}`;
}

function nonEmpty(value: string, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw shotInvariantViolatedError(`${label}_required`, { field: label });
  }
  return value.trim();
}

function normalizeDuration(value: number | undefined): number {
  if (value === undefined) return 0;
  if (!Number.isFinite(value)) return 0;
  return Math.max(SHOT_DURATION_MIN, Math.min(SHOT_DURATION_MAX, Math.round(value * 10) / 10));
}

function normalizeShotSize(value: string | undefined): ShotSizeValue | "" {
  if (value === undefined || value === "") return "";
  return (SHOT_SIZE_ENUM as readonly string[]).includes(value)
    ? (value as ShotSizeValue)
    : "";
}

function normalizeCameraAngle(value: string | undefined): CameraAngleValue | "" {
  if (value === undefined || value === "") return "";
  return (CAMERA_ANGLE_ENUM as readonly string[]).includes(value)
    ? (value as CameraAngleValue)
    : "";
}

function normalizeCameraMovement(
  value: string | undefined,
): CameraMovementValue | "" {
  if (value === undefined || value === "") return "";
  return (CAMERA_MOVEMENT_ENUM as readonly string[]).includes(value)
    ? (value as CameraMovementValue)
    : "";
}

/**
 * Shot 聚合根。状态变更方法返回 `this` 以便测试断言；失败抛 DomainError。
 */
export class ShotAggregate implements AggregateRoot {
  readonly id: string;
  projectId: string;
  storyboardId: string;
  sceneId: string;
  episode: number;
  shotNumber: string;
  title: string;
  description: string;
  duration: number;
  shotSize: ShotSizeValue | "";
  cameraAngle: CameraAngleValue | "";
  cameraMovement: CameraMovementValue | "";
  dialogue: string;
  notes: string;
  imageUrl: string;
  videoTaskId: string;
  videoUrl: string;
  status: ShotStatus;
  order: number;
  characterAssetIds: string[];
  propAssetIds: string[];
  /** 最近一次生成请求 id（用于 Provider 回调幂等校验）。 */
  currentGenerationRequestId: string;
  /** 持久化的视频候选（按 attachedAt 升序）。 */
  videoCandidates: ShotVideoCandidate[];
  /** 审核结果（每次替换为最新一次）。 */
  reviewResult: ShotReviewResult | null;
  /** 送审人。 */
  submittedBy: string;
  /** 软删除时间戳。 */
  deletedAt: string;
  createdAt: string;
  updatedAt: string;
  version: number;

  /** 可选 Pipeline 上下文，仅用于事件 payload，不参与状态判断。 */
  pipelineRunId?: string;
  pipelineNodeId?: string;

  private readonly events: DomainEvent<unknown>[] = [];
  private readonly snapshots: ShotSnapshotDraft[] = [];

  /** 标记是否尚未持久化（Repository 决定 INSERT vs UPDATE）。 */
  isNew = false;
  /** 最近一次 action（Repository 写快照 action 字段）。 */
  lastAction: "create" | "edit" | "markReady" | "startGeneration"
    | "attach" | "submit" | "approve" | "reject" | "requestFix" | "archive"
    | "restore" | "softDelete" = "create";

  private constructor(props: {
    id: string;
    projectId: string;
    storyboardId: string;
    sceneId: string;
    episode: number;
    shotNumber: string;
    title: string;
    description: string;
    duration: number;
    shotSize: ShotSizeValue | "";
    cameraAngle: CameraAngleValue | "";
    cameraMovement: CameraMovementValue | "";
    dialogue: string;
    notes: string;
    imageUrl: string;
    videoTaskId: string;
    videoUrl: string;
    status: ShotStatus;
    order: number;
    characterAssetIds: string[];
    propAssetIds: string[];
    currentGenerationRequestId: string;
    videoCandidates: ShotVideoCandidate[];
    reviewResult: ShotReviewResult | null;
    submittedBy: string;
    deletedAt: string;
    createdAt: string;
    updatedAt: string;
    version: number;
    isNew: boolean;
    pipelineRunId?: string;
    pipelineNodeId?: string;
  }) {
    this.id = props.id;
    this.projectId = props.projectId;
    this.storyboardId = props.storyboardId;
    this.sceneId = props.sceneId;
    this.episode = props.episode;
    this.shotNumber = props.shotNumber;
    this.title = props.title;
    this.description = props.description;
    this.duration = props.duration;
    this.shotSize = props.shotSize;
    this.cameraAngle = props.cameraAngle;
    this.cameraMovement = props.cameraMovement;
    this.dialogue = props.dialogue;
    this.notes = props.notes;
    this.imageUrl = props.imageUrl;
    this.videoTaskId = props.videoTaskId;
    this.videoUrl = props.videoUrl;
    this.status = props.status;
    this.order = props.order;
    this.characterAssetIds = props.characterAssetIds;
    this.propAssetIds = props.propAssetIds;
    this.currentGenerationRequestId = props.currentGenerationRequestId;
    this.videoCandidates = props.videoCandidates;
    this.reviewResult = props.reviewResult;
    this.submittedBy = props.submittedBy;
    this.deletedAt = props.deletedAt;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.version = props.version;
    this.isNew = props.isNew;
    this.pipelineRunId = props.pipelineRunId;
    this.pipelineNodeId = props.pipelineNodeId;
  }

  /** create：新建一个 draft 状态的镜头。 */
  static create(input: {
    id?: string;
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
    pipelineRunId?: string;
    pipelineNodeId?: string;
  }): ShotAggregate {
    const now = nowIso();
    const agg = new ShotAggregate({
      id: input.id ?? `sh-${randomUUID()}`,
      projectId: nonEmpty(input.projectId, "projectId"),
      storyboardId: nonEmpty(input.storyboardId, "storyboardId"),
      sceneId: input.sceneId ?? "",
      episode: Number.isFinite(input.episode) ? Number(input.episode) : 1,
      shotNumber: (input.shotNumber ?? "shot_001").trim(),
      title: (input.title ?? input.description ?? "").trim(),
      description: input.description ?? "",
      duration: normalizeDuration(input.duration),
      shotSize: normalizeShotSize(input.shotSize),
      cameraAngle: normalizeCameraAngle(input.cameraAngle),
      cameraMovement: normalizeCameraMovement(input.cameraMovement),
      dialogue: input.dialogue ?? "",
      notes: input.notes ?? "",
      imageUrl: input.imageUrl ?? "",
      videoTaskId: "",
      videoUrl: "",
      status: "draft",
      order: Number.isFinite(input.order) ? Number(input.order) : 0,
      characterAssetIds: Array.isArray(input.characterAssetIds)
        ? input.characterAssetIds.map(String)
        : [],
      propAssetIds: Array.isArray(input.propAssetIds)
        ? input.propAssetIds.map(String)
        : [],
      currentGenerationRequestId: "",
      videoCandidates: [],
      reviewResult: null,
      submittedBy: "",
      deletedAt: "",
      createdAt: now,
      updatedAt: now,
      version: 1,
      isNew: true,
      pipelineRunId: input.pipelineRunId,
      pipelineNodeId: input.pipelineNodeId,
    });
    agg.lastAction = "create";
    agg.markSnapshot("create", "create-shot");
    return agg;
  }

  /** rehydrate：从持久化还原聚合（Mapper 调用）。不产生事件/快照。 */
  static rehydrate(input: {
    id: string;
    projectId: string;
    storyboardId: string;
    sceneId: string;
    episode: number;
    shotNumber: string;
    title: string;
    description: string;
    duration: number;
    shotSize: string;
    cameraAngle: string;
    cameraMovement: string;
    dialogue: string;
    notes: string;
    imageUrl: string;
    videoTaskId: string;
    videoUrl: string;
    status: ShotStatus;
    order: number;
    characterAssetIds: string[];
    propAssetIds: string[];
    currentGenerationRequestId: string;
    videoCandidates: ShotVideoCandidate[];
    reviewResult: ShotReviewResult | null;
    submittedBy: string;
    deletedAt: string;
    createdAt: string;
    updatedAt: string;
    version: number;
    pipelineRunId?: string;
    pipelineNodeId?: string;
  }): ShotAggregate {
    return new ShotAggregate({
      id: input.id,
      projectId: input.projectId,
      storyboardId: input.storyboardId,
      sceneId: input.sceneId,
      episode: input.episode,
      shotNumber: input.shotNumber,
      title: input.title,
      description: input.description,
      duration: input.duration,
      shotSize: normalizeShotSize(input.shotSize),
      cameraAngle: normalizeCameraAngle(input.cameraAngle),
      cameraMovement: normalizeCameraMovement(input.cameraMovement),
      dialogue: input.dialogue,
      notes: input.notes,
      imageUrl: input.imageUrl,
      videoTaskId: input.videoTaskId,
      videoUrl: input.videoUrl,
      status: input.status,
      order: input.order,
      characterAssetIds: input.characterAssetIds,
      propAssetIds: input.propAssetIds,
      currentGenerationRequestId: input.currentGenerationRequestId,
      videoCandidates: input.videoCandidates,
      reviewResult: input.reviewResult,
      submittedBy: input.submittedBy,
      deletedAt: input.deletedAt,
      createdAt: input.createdAt,
      updatedAt: input.updatedAt,
      version: input.version,
      isNew: false,
      pipelineRunId: input.pipelineRunId,
      pipelineNodeId: input.pipelineNodeId,
    });
  }

  /** 拉取并清空待发布的领域事件。 */
  pullDomainEvents(): DomainEvent<unknown>[] {
    const copy = this.events.slice();
    this.events.length = 0;
    return copy;
  }

  /** 拉取并清空待持久化的快照条目（Repository 在同事务写入）。 */
  pullPendingSnapshots(): ShotSnapshotDraft[] {
    const copy = this.snapshots.slice();
    this.snapshots.length = 0;
    return copy;
  }

  /** 当前是否携带未持久化事件（测试用）。 */
  hasPendingEvents(): boolean {
    return this.events.length > 0;
  }

  // ===== 行为 =====

  /** editMetadata：更新受允许的元数据，不改 status / version 输入 / 审核结果。 */
  editMetadata(actorId: string, patch: ShotEditableMetadata): this {
    nonEmpty(actorId, "actorId");
    if (isShotTerminal(this.status)) {
      throw shotIsTerminalError(this.status);
    }
    if (this.deletedAt) {
      throw shotInvariantViolatedError("cannot_edit_deleted_shot", {
        shotId: this.id,
        deletedAt: this.deletedAt,
      });
    }
    if (patch.scene_id !== undefined) this.sceneId = patch.scene_id;
    if (patch.episode !== undefined && Number.isFinite(patch.episode)) {
      this.episode = Number(patch.episode);
    }
    if (patch.shot_number !== undefined) this.shotNumber = patch.shot_number.trim();
    if (patch.title !== undefined) this.title = patch.title;
    if (patch.description !== undefined) this.description = patch.description;
    if (patch.duration !== undefined) this.duration = normalizeDuration(patch.duration);
    if (patch.shot_size !== undefined) this.shotSize = normalizeShotSize(patch.shot_size);
    if (patch.camera_angle !== undefined) this.cameraAngle = normalizeCameraAngle(patch.camera_angle);
    if (patch.camera_movement !== undefined) this.cameraMovement = normalizeCameraMovement(patch.camera_movement);
    if (patch.dialogue !== undefined) this.dialogue = patch.dialogue;
    if (patch.notes !== undefined) this.notes = patch.notes;
    if (patch.image_url !== undefined) this.imageUrl = patch.image_url;
    if (patch.order !== undefined && Number.isFinite(patch.order)) {
      this.order = Number(patch.order);
    }
    if (Array.isArray(patch.character_asset_ids)) {
      this.characterAssetIds = patch.character_asset_ids.map(String);
    }
    if (Array.isArray(patch.prop_asset_ids)) {
      this.propAssetIds = patch.prop_asset_ids.map(String);
    }
    this.bumpVersion();
    this.lastAction = "edit";
    this.updatedAt = nowIso();
    this.markSnapshot("edit", `edit-metadata:${actorId}`);
    return this;
  }

  /** markReady：draft -> ready。 */
  markReady(actorId: string): this {
    nonEmpty(actorId, "actorId");
    return this.applyTransition("markReady", "markReady", actorId, () => {
      // 进入 ready 时不需要额外字段；duration 等已由 create/edit 保证。
    });
  }

  /** startGeneration：draft/ready/needs_fix/rejected -> generating。 */
  startGeneration(input: {
    actorId: string;
    generationRequestId: string;
    videoTaskId?: string;
  }): this {
    nonEmpty(input.actorId, "actorId");
    nonEmpty(input.generationRequestId, "generationRequestId");
    if (this.deletedAt) {
      throw shotInvariantViolatedError("cannot_generate_deleted_shot", {
        shotId: this.id,
      });
    }
    if (this.status === "in_review" || this.status === "approved") {
      throw invalidShotTransitionError(this.status, "startGeneration");
    }
    return this.applyTransition(
      "startGeneration",
      "startGeneration",
      input.actorId,
      () => {
        this.currentGenerationRequestId = input.generationRequestId;
        if (input.videoTaskId) this.videoTaskId = input.videoTaskId;
      },
    );
  }

  /**
   * attachGeneratedVideo：generating -> ready。
   *
   * 幂等：同一 providerRequestId 的回调已被处理（currentGenerationRequestId 不匹配或
   * 已存在相同 generationRequestId 的候选），不改变状态、不递增版本，直接返回。
   * 重复生成回调不能覆盖人工返工后的新状态。
   */
  attachGeneratedVideo(input: {
    candidateId: string;
    providerRequestId: string;
    videoUrl: string;
    generationRequestId: string;
    attachedBy: string;
  }): this {
    nonEmpty(input.candidateId, "candidateId");
    nonEmpty(input.providerRequestId, "providerRequestId");
    nonEmpty(input.videoUrl, "videoUrl");
    nonEmpty(input.generationRequestId, "generationRequestId");
    nonEmpty(input.attachedBy, "attachedBy");

    // 幂等：当前 generationRequestId 与回调不一致（人工返工后已重新发起）→ 拒绝覆盖。
    if (this.currentGenerationRequestId &&
        this.currentGenerationRequestId !== input.generationRequestId) {
      throw shotCandidateMismatchError(
        this.id,
        this.currentGenerationRequestId,
        input.generationRequestId,
      );
    }
    // 重复回调：已存在相同 providerRequestId 的候选 → 静默成功。
    if (this.videoCandidates.some((c) => c.providerRequestId === input.providerRequestId)) {
      this.lastAction = "attach";
      this.updatedAt = nowIso();
      return this;
    }
    if (this.status !== "generating") {
      throw invalidShotTransitionError(this.status, "attachGeneratedVideo");
    }
    const result = assertShotTransition(this.status, "attachGeneratedVideo");
    if (!result.ok) {
      throw invalidShotTransitionError(this.status, "attachGeneratedVideo");
    }
    const candidate: ShotVideoCandidate = {
      id: input.candidateId,
      providerRequestId: input.providerRequestId,
      videoUrl: input.videoUrl,
      attachedAt: nowIso(),
      attachedBy: input.attachedBy,
      generationRequestId: input.generationRequestId,
    };
    this.videoCandidates = [...this.videoCandidates, candidate];
    // 保留最近 5 个候选（按 attachedAt 升序保留尾部）。
    if (this.videoCandidates.length > 5) {
      this.videoCandidates = this.videoCandidates.slice(-5);
    }
    this.videoUrl = input.videoUrl;
    this.bumpVersion();
    this.lastAction = "attach";
    this.updatedAt = nowIso();
    this.status = result.to;
    this.markSnapshot("attach", `attach:${input.candidateId}`);
    this.events.push(
      shotVideoCandidateAttachedEvent({
        shotId: this.id,
        projectId: this.projectId,
        shotVersion: this.version,
        candidateId: input.candidateId,
        providerRequestId: input.providerRequestId,
      }),
    );
    return this;
  }

  /** submitForReview：ready/needs_fix -> in_review。需有有效生成结果。 */
  submitForReview(input: {
    submittedBy: string;
    pipelineRunId?: string;
    pipelineNodeId?: string;
  }): this {
    nonEmpty(input.submittedBy, "submittedBy");
    if (this.deletedAt) {
      throw shotInvariantViolatedError("cannot_submit_deleted_shot", {
        shotId: this.id,
      });
    }
    if (!this.videoUrl && this.videoCandidates.length === 0) {
      throw shotMissingVideoResultError(this.id);
    }
    this.pipelineRunId = input.pipelineRunId ?? this.pipelineRunId;
    this.pipelineNodeId = input.pipelineNodeId ?? this.pipelineNodeId;
    return this.applyTransition("submitForReview", "submit", input.submittedBy, () => {
      this.submittedBy = input.submittedBy;
    });
  }

  /** approve：in_review -> approved。Review 任务驱动，需 reviewId + reviewedBy。 */
  approve(input: {
    reviewId: string;
    reviewedBy: string;
    pipelineRunId?: string;
    pipelineNodeId?: string;
  }): this {
    nonEmpty(input.reviewId, "reviewId");
    nonEmpty(input.reviewedBy, "reviewedBy");
    if (this.reviewResult && this.reviewResult.reviewId === input.reviewId &&
        this.reviewResult.status === "approved") {
      // 同 reviewId 重复回调：幂等。
      this.lastAction = "approve";
      this.updatedAt = nowIso();
      return this;
    }
    this.pipelineRunId = input.pipelineRunId ?? this.pipelineRunId;
    this.pipelineNodeId = input.pipelineNodeId ?? this.pipelineNodeId;
    this.applyTransition("approve", "approve", input.reviewedBy, () => {
      this.reviewResult = {
        reviewId: input.reviewId,
        status: "approved",
        reviewedBy: input.reviewedBy,
        reasonCode: "",
        at: nowIso(),
        pipelineRunId: this.pipelineRunId,
        pipelineNodeId: this.pipelineNodeId,
      };
    });
    this.events.push(
      shotApprovedEvent({
        shotId: this.id,
        projectId: this.projectId,
        reviewId: input.reviewId,
        shotVersion: this.version,
        reviewedBy: input.reviewedBy,
        pipelineRunId: this.pipelineRunId,
        pipelineNodeId: this.pipelineNodeId,
      }),
    );
    return this;
  }

  /** reject：in_review -> rejected。Review 任务驱动，需 reviewId + reason。 */
  reject(input: {
    reviewId: string;
    reviewedBy: string;
    reasonCode: string;
    pipelineRunId?: string;
    pipelineNodeId?: string;
  }): this {
    nonEmpty(input.reviewId, "reviewId");
    nonEmpty(input.reviewedBy, "reviewedBy");
    if (typeof input.reasonCode !== "string" || input.reasonCode.trim().length === 0) {
      throw shotRejectionReasonRequiredError();
    }
    if (this.reviewResult && this.reviewResult.reviewId === input.reviewId &&
        this.reviewResult.status === "rejected" &&
        this.reviewResult.reasonCode === input.reasonCode) {
      // 同 reviewId 重复回调：幂等。
      this.lastAction = "reject";
      this.updatedAt = nowIso();
      return this;
    }
    this.pipelineRunId = input.pipelineRunId ?? this.pipelineRunId;
    this.pipelineNodeId = input.pipelineNodeId ?? this.pipelineNodeId;
    this.applyTransition("reject", "reject", input.reviewedBy, () => {
      this.reviewResult = {
        reviewId: input.reviewId,
        status: "rejected",
        reviewedBy: input.reviewedBy,
        reasonCode: input.reasonCode,
        at: nowIso(),
        pipelineRunId: this.pipelineRunId,
        pipelineNodeId: this.pipelineNodeId,
      };
    });
    this.events.push(
      shotRejectedEvent({
        shotId: this.id,
        projectId: this.projectId,
        reviewId: input.reviewId,
        shotVersion: this.version,
        reviewedBy: input.reviewedBy,
        reason: input.reasonCode,
        pipelineRunId: this.pipelineRunId,
        pipelineNodeId: this.pipelineNodeId,
      }),
    );
    return this;
  }

  /** requestFix：in_review/approved/rejected -> needs_fix。 */
  requestFix(actorId: string, reason?: string): this {
    nonEmpty(actorId, "actorId");
    return this.applyTransition("requestFix", "requestFix", actorId, () => {
      // 进入 needs_fix 时保留 reviewResult 供前端展示最近一次原因。
      if (reason) this.notes = appendNote(this.notes, `requestFix: ${reason}`);
    });
  }

  /** archive：ready/approved/needs_fix/rejected -> archived。 */
  archive(actorId: string): this {
    nonEmpty(actorId, "actorId");
    if (this.status === "in_review" || this.status === "generating") {
      throw invalidShotTransitionError(this.status, "archive");
    }
    return this.applyTransition("archive", "archive", actorId, () => {
      /* 终态化 */
    });
  }

  /** restore：archived -> draft。 */
  restore(actorId: string): this {
    nonEmpty(actorId, "actorId");
    return this.applyTransition("restore", "restore", actorId, () => {
      /* 回到 draft */
    });
  }

  /**
   * softDelete：标记 deleted_at；不改 status。
   * 已审核（in_review / approved）的镜头禁止普通删除。
   */
  softDelete(actorId: string): this {
    nonEmpty(actorId, "actorId");
    if (this.status === "in_review" || this.status === "approved") {
      throw shotProtectedFromDeleteError(this.id, this.status);
    }
    if (this.deletedAt) return this; // 幂等
    this.deletedAt = nowIso();
    this.bumpVersion();
    this.lastAction = "softDelete";
    this.updatedAt = nowIso();
    this.markSnapshot("softDelete", `softDelete:${actorId}`);
    return this;
  }

  /**
   * restoreFromSoftDelete：清空 deleted_at；不改 status。允许从非 in_review/approved 任意状态。
   */
  restoreFromSoftDelete(actorId: string): this {
    nonEmpty(actorId, "actorId");
    if (!this.deletedAt) return this; // 幂等
    this.deletedAt = "";
    this.bumpVersion();
    this.lastAction = "restore";
    this.updatedAt = nowIso();
    this.markSnapshot("restore", `restoreFromSoftDelete:${actorId}`);
    return this;
  }

  // ===== 内部 =====

  /** 状态迁移统一入口。 */
  private applyTransition(
    command: ShotCommand,
    action: typeof this.lastAction,
    actorId: string,
    applySideEffects: () => void,
  ): this {
    if (isShotTerminal(this.status) && command !== "restore") {
      throw shotIsTerminalError(this.status);
    }
    const result = assertShotTransition(this.status, command);
    if (!result.ok) {
      throw invalidShotTransitionError(this.status, command);
    }
    const from = this.status;
    applySideEffects();
    this.status = result.to;
    this.bumpVersion();
    this.lastAction = action;
    this.updatedAt = nowIso();
    this.markSnapshot(action, `${command}:${actorId}`);
    if (command === "submitForReview") {
      // 事件层专门发，送审由 aggregate 自行 enqueue（无外部 reviewer）。
      this.events.push(
        shotSubmittedForReviewEvent({
          shotId: this.id,
          projectId: this.projectId,
          shotVersion: this.version,
          submittedBy: actorId,
          pipelineRunId: this.pipelineRunId,
          pipelineNodeId: this.pipelineNodeId,
        }),
      );
    }
    return this;
  }

  private bumpVersion(): void {
    this.version += 1;
  }

  private markSnapshot(
    action: typeof this.lastAction,
    changeNote: string,
  ): void {
    this.snapshots.push({
      id: snapshotId(),
      shotId: this.id,
      projectId: this.projectId,
      version: this.version,
      data: JSON.stringify(this.toPersistenceRow()),
      changeNote: `${action}|${changeNote}`,
      createdBy: "system",
      createdAt: nowIso(),
    });
  }

  /** 导出权威字段（与 Mapper 对齐）。 */
  toPersistenceRow(): ShotPersistenceRow {
    return {
      id: this.id,
      project_id: this.projectId,
      storyboard_id: this.storyboardId,
      scene_id: this.sceneId,
      episode: this.episode,
      shot_number: this.shotNumber,
      title: this.title,
      description: this.description,
      duration: this.duration,
      shot_size: this.shotSize,
      camera_angle: this.cameraAngle,
      camera_movement: this.cameraMovement,
      dialogue: this.dialogue,
      notes: this.notes,
      image_url: this.imageUrl,
      video_task_id: this.videoTaskId,
      video_url: this.videoUrl,
      status: this.status,
      order: this.order,
      character_asset_ids: JSON.stringify(this.characterAssetIds),
      prop_asset_ids: JSON.stringify(this.propAssetIds),
      version: this.version,
      created_at: this.createdAt,
      updated_at: this.updatedAt,
      deleted_at: this.deletedAt,
      current_generation_request_id: this.currentGenerationRequestId,
      video_candidates: JSON.stringify(this.videoCandidates),
      review_result: this.reviewResult ? JSON.stringify(this.reviewResult) : "",
      submitted_by: this.submittedBy,
      pipeline_run_id: this.pipelineRunId ?? "",
      pipeline_node_id: this.pipelineNodeId ?? "",
    };
  }
}

/** 内部快照草稿。 */
export interface ShotSnapshotDraft {
  id: string;
  shotId: string;
  projectId: string;
  version: number;
  data: string;
  changeNote: string;
  createdBy: string;
  createdAt: string;
}

/** 持久化行（snake_case）。Mapper 与 Repository 共用。 */
export interface ShotPersistenceRow {
  id: string;
  project_id: string;
  storyboard_id: string;
  scene_id: string;
  episode: number;
  shot_number: string;
  title: string;
  description: string;
  duration: number;
  shot_size: string;
  camera_angle: string;
  camera_movement: string;
  dialogue: string;
  notes: string;
  image_url: string;
  video_task_id: string;
  video_url: string;
  status: ShotStatus;
  order: number;
  character_asset_ids: string;
  prop_asset_ids: string;
  version: number;
  created_at: string;
  updated_at: string;
  deleted_at: string;
  current_generation_request_id: string;
  video_candidates: string;
  review_result: string;
  submitted_by: string;
  pipeline_run_id: string;
  pipeline_node_id: string;
}

function appendNote(existing: string, addition: string): string {
  if (!existing) return addition;
  return `${existing}\n${addition}`;
}

/** 聚合不存在时抛出的标准错误（供 Application 层使用）。 */
export function throwShotNotFound(shotId: string): never {
  throw shotNotFoundError(shotId);
}

/** 幂等重复命令错误（供 Application 层使用）。 */
export function throwShotAlreadyProcessed(
  shotId: string,
  command: ShotCommand,
): never {
  throw shotAlreadyProcessedError(shotId, command);
}
