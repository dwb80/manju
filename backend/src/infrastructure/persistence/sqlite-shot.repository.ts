/**
 * @file sqlite-shot.repository.ts
 * @description ShotRepository 的 SQLite 实现。
 *
 * 关键规则（迭代计划 §3.3 / §5.5）：
 *  - save 使用 `WHERE id = ? AND version = ?` 乐观锁；影响行数 0 抛 aggregate_version_conflict。
 *  - save 不开启自己的 BEGIN/COMMIT：所有语句参与外层 UnitOfWork（TransactionService）
 *    的事务，确保状态/快照与 Outbox（由 UoW 在 commit 前写入）原子提交。
 *  - recordCommand 通过 shot_command_log(id PK) 去重；重复 commandId 抛 command_already_processed。
 *  - 幂等检查 isCommandProcessed 必须与 save 同事务调用（命令处理器保证顺序）。
 *  - 迁移：构造 Repository 时 ensureShotAggregateSchema(databaseFile) 自动补齐本任务线
 *    独占的列（current_generation_request_id / video_candidates / review_result / submitted_by
 *    / version）与 shot_command_log 表。
 *
 * Outbox：领域事件由命令处理器经 UnitOfWorkContext.enqueueDomainEvent 入队，TransactionService
 * 在 COMMIT 前写入 outbox_events。Repository 不直接写 outbox，避免与 UoW 双写重复。
 */

import type { ShotRepository } from "../../domain/storyboard/shot.repository.js";
import type { ShotAggregate } from "../../domain/storyboard/shot.aggregate.js";
import {
  DOMAIN_ERROR_CODES,
  DomainError,
} from "../../domain/shared/domain-error.js";
import { shotVersionConflictError } from "../../domain/storyboard/shot-errors.js";
import { getRawDatabase } from "../../storage/sqlite.js";
import { ensureShotAggregateSchema } from "./shot-migration.js";
import { ShotMapper, type SqliteRow } from "./shot.mapper.js";

type RunResult = { changes?: number | bigint };
type Statement = {
  get(...args: unknown[]): Record<string, unknown> | undefined;
  all(...args: unknown[]): Record<string, unknown>[];
  run(...args: unknown[]): RunResult;
};
type RawDatabase = {
  exec(sql: string): void;
  prepare(sql: string): Statement;
};

function changes(result: RunResult): number {
  return Number(result.changes ?? 0);
}

function nowIso(): string {
  return new Date().toISOString();
}

export class SqliteShotRepository implements ShotRepository {
  private readonly database: RawDatabase;

  constructor(databaseFile: string) {
    ensureShotAggregateSchema(databaseFile);
    this.database = getRawDatabase(databaseFile) as unknown as RawDatabase;
  }

  async get(id: string): Promise<ShotAggregate | null> {
    const row = this.database
      .prepare("SELECT * FROM shots WHERE id = ?")
      .get(id) as SqliteRow | undefined;
    if (!row) return null;
    return ShotMapper.toDomain(row);
  }

  async listByStoryboard(storyboardId: string): Promise<ShotAggregate[]> {
    const rows = this.database
      .prepare(
        `SELECT * FROM shots
         WHERE storyboard_id = ? AND deleted_at = ''
         ORDER BY "order" ASC, shot_number ASC, created_at ASC`,
      )
      .all(storyboardId) as SqliteRow[];
    return rows.map((row) => ShotMapper.toDomain(row));
  }

  async listByProject(
    projectId: string,
    options?: { limit?: number; status?: string },
  ): Promise<ShotAggregate[]> {
    const limit = Math.max(1, Math.min(1000, options?.limit ?? 100));
    const where: string[] = ["project_id = ?", "deleted_at = ''"];
    const args: unknown[] = [projectId];
    if (options?.status) {
      where.push("status = ?");
      args.push(options.status);
    }
    args.push(limit);
    const rows = this.database
      .prepare(
        `SELECT * FROM shots WHERE ${where.join(" AND ")}
         ORDER BY created_at DESC LIMIT ?`,
      )
      .all(...args) as SqliteRow[];
    return rows.map((row) => ShotMapper.toDomain(row));
  }

  async isCommandProcessed(commandId: string): Promise<boolean> {
    const row = this.database
      .prepare("SELECT id FROM shot_command_log WHERE id = ?")
      .get(commandId) as SqliteRow | undefined;
    return Boolean(row);
  }

  async recordCommand(
    commandId: string,
    shotId: string,
  ): Promise<void> {
    try {
      this.database
        .prepare(
          `INSERT INTO shot_command_log (id, shot_id, command_type, created_at)
           VALUES (?, ?, ?, ?)`,
        )
        .run(commandId, shotId, "", nowIso());
    } catch (err) {
      // PK 冲突 = commandId 已处理。
      const message = err instanceof Error ? err.message : String(err);
      if (/UNIQUE constraint|PRIMARY KEY|unique/i.test(message)) {
        throw new DomainError(
          DOMAIN_ERROR_CODES.commandAlreadyProcessed,
          `镜头命令已处理：${commandId}`,
          { aggregateType: "Shot", shotId, commandId },
        );
      }
      throw err;
    }
  }

  async save(
    aggregate: ShotAggregate,
    expectedVersion: number,
  ): Promise<void> {
    if (aggregate.isNew) {
      this.insertAggregate(aggregate);
    } else {
      this.updateAggregate(aggregate, expectedVersion);
    }
    // 拉取并写入聚合产出的快照条目（同事务）。
    const snapshots = aggregate.pullPendingSnapshots();
    if (snapshots.length > 0) {
      this.insertSnapshots(snapshots);
    }
    aggregate.isNew = false;
  }

  private insertAggregate(aggregate: ShotAggregate): void {
    const row = aggregate.toPersistenceRow();
    this.database
      .prepare(
        `INSERT INTO shots
         (id, project_id, storyboard_id, scene_id, episode, shot_number,
          title, description, duration, shot_size, camera_angle, camera_movement,
          dialogue, notes, image_url, video_task_id, video_url, status, "order",
          character_asset_ids, prop_asset_ids, version, created_at, updated_at,
          deleted_at, current_generation_request_id, video_candidates,
          review_result, submitted_by, pipeline_run_id, pipeline_node_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                 ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        row.id,
        row.project_id,
        row.storyboard_id,
        row.scene_id,
        row.episode,
        row.shot_number,
        row.title,
        row.description,
        row.duration,
        row.shot_size,
        row.camera_angle,
        row.camera_movement,
        row.dialogue,
        row.notes,
        row.image_url,
        row.video_task_id,
        row.video_url,
        row.status,
        row.order,
        row.character_asset_ids,
        row.prop_asset_ids,
        row.version,
        row.created_at,
        row.updated_at,
        row.deleted_at,
        row.current_generation_request_id,
        row.video_candidates,
        row.review_result,
        row.submitted_by,
        row.pipeline_run_id,
        row.pipeline_node_id,
      );
  }

  private updateAggregate(
    aggregate: ShotAggregate,
    expectedVersion: number,
  ): void {
    const row = aggregate.toPersistenceRow();
    const result = this.database
      .prepare(
        `UPDATE shots
         SET project_id = ?, storyboard_id = ?, scene_id = ?, episode = ?,
             shot_number = ?, title = ?, description = ?, duration = ?,
             shot_size = ?, camera_angle = ?, camera_movement = ?, dialogue = ?,
             notes = ?, image_url = ?, video_task_id = ?, video_url = ?,
             status = ?, "order" = ?, character_asset_ids = ?,
             prop_asset_ids = ?, version = ?, updated_at = ?, deleted_at = ?,
             current_generation_request_id = ?, video_candidates = ?,
             review_result = ?, submitted_by = ?, pipeline_run_id = ?,
             pipeline_node_id = ?
         WHERE id = ? AND version = ?`,
      )
      .run(
        row.project_id,
        row.storyboard_id,
        row.scene_id,
        row.episode,
        row.shot_number,
        row.title,
        row.description,
        row.duration,
        row.shot_size,
        row.camera_angle,
        row.camera_movement,
        row.dialogue,
        row.notes,
        row.image_url,
        row.video_task_id,
        row.video_url,
        row.status,
        row.order,
        row.character_asset_ids,
        row.prop_asset_ids,
        row.version,
        row.updated_at,
        row.deleted_at,
        row.current_generation_request_id,
        row.video_candidates,
        row.review_result,
        row.submitted_by,
        row.pipeline_run_id,
        row.pipeline_node_id,
        row.id,
        expectedVersion,
      );
    if (changes(result) !== 1) {
      throw shotVersionConflictError(row.id, expectedVersion);
    }
  }

  private insertSnapshots(snapshots: readonly import("../../domain/storyboard/shot.aggregate.js").ShotSnapshotDraft[]): void {
    const stmt = this.database.prepare(
      `INSERT INTO shot_snapshots
       (id, project_id, shot_id, version, data, change_note, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const snap of snapshots) {
      stmt.run(
        snap.id,
        snap.projectId,
        snap.shotId,
        snap.version,
        snap.data,
        snap.changeNote,
        snap.createdBy,
        snap.createdAt,
      );
    }
  }
}
