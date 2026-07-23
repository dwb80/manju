/**
 * @file shot.mapper.ts
 * @description Shot 聚合 ↔ SQLite 行双向映射。
 *
 * 权威字段（snake_case 与 shots / shot_snapshots 表对齐）：
 *   - 状态/版本：status / version
 *   - 业务元数据：id / project_id / storyboard_id / scene_id / episode /
 *     shot_number / title / description / duration / shot_size / camera_angle /
 *     camera_movement / dialogue / notes / image_url / video_task_id / video_url /
 *     order / character_asset_ids / prop_asset_ids / created_at / updated_at /
 *     deleted_at
 *   - 聚合权威扩展：current_generation_request_id / video_candidates (json) /
 *     review_result (json) / submitted_by
 *
 * 不读不写由 SLA / 派工 / 监控独占的字段。
 */

import {
  ShotAggregate,
  type ShotReviewResult,
  type ShotVideoCandidate,
} from "../../domain/storyboard/shot.aggregate.js";
import type { ShotStatus } from "../../domain/storyboard/shot-state-machine.js";

export type SqliteRow = Readonly<Record<string, unknown>>;

function text(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

function integer(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : fallback;
}

function numberFloat(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function jsonArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string" || value.length === 0) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function stringArray(value: unknown): string[] {
  return jsonArray(value).map((item) => String(item));
}

function jsonObject<T = Record<string, unknown>>(value: unknown): T | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as T;
  }
  if (typeof value !== "string" || value.length === 0) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as T)
      : null;
  } catch {
    return null;
  }
}

/** 把 SQLite 行还原成 ShotAggregate（rehydrate，不产生事件/快照）。 */
export class ShotMapper {
  static toDomain(row: SqliteRow): ShotAggregate {
    const candidates: ShotVideoCandidate[] = jsonArray(row.video_candidates)
      .filter((c) => c && typeof c === "object")
      .map((c) => {
        const o = c as Record<string, unknown>;
        return {
          id: String(o.id ?? ""),
          providerRequestId: String(o.providerRequestId ?? ""),
          videoUrl: String(o.videoUrl ?? ""),
          attachedAt: String(o.attachedAt ?? ""),
          attachedBy: String(o.attachedBy ?? ""),
          generationRequestId: String(o.generationRequestId ?? ""),
        } as ShotVideoCandidate;
      });
    const review = jsonObject<ShotReviewResult>(row.review_result) ?? null;
    return ShotAggregate.rehydrate({
      id: text(row.id),
      projectId: text(row.project_id),
      storyboardId: text(row.storyboard_id),
      sceneId: text(row.scene_id),
      episode: integer(row.episode, 1),
      shotNumber: text(row.shot_number),
      title: text(row.title),
      description: text(row.description),
      duration: numberFloat(row.duration, 0),
      shotSize: text(row.shot_size),
      cameraAngle: text(row.camera_angle),
      cameraMovement: text(row.camera_movement),
      dialogue: text(row.dialogue),
      notes: text(row.notes),
      imageUrl: text(row.image_url),
      videoTaskId: text(row.video_task_id),
      videoUrl: text(row.video_url),
      status: text(row.status) as ShotStatus,
      order: integer(row.order, 0),
      characterAssetIds: stringArray(row.character_asset_ids),
      propAssetIds: stringArray(row.prop_asset_ids),
      currentGenerationRequestId: text(row.current_generation_request_id),
      videoCandidates: candidates,
      reviewResult: review,
      submittedBy: text(row.submitted_by),
      deletedAt: text(row.deleted_at),
      createdAt: text(row.created_at),
      updatedAt: text(row.updated_at),
      version: integer(row.version, 1),
      pipelineRunId: text(row.pipeline_run_id) || undefined,
      pipelineNodeId: text(row.pipeline_node_id) || undefined,
    });
  }
}
