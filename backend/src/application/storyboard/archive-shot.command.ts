/**
 * @file archive-shot.command.ts
 * @description 归档镜头命令：ready/approved/needs_fix/rejected -> archived。
 * 同时承载软删除/恢复（不改 status，仅 toggle deleted_at）。
 *
 * 不直接修改 Pipeline：归档本身不与 Pipeline 任务耦合。
 */

import type { Command } from "../shared/command.js";
import {
  assertCommandNotProcessed,
  enqueuePulledEvents,
  loadShotOrThrow,
  type ShotHandlerDeps,
} from "./shot-command-handler.js";

export interface ArchiveShotCommand extends Command {
  type: "ArchiveShot";
  shotId: string;
  actorId: string;
}

export interface SoftDeleteShotCommand extends Command {
  type: "SoftDeleteShot";
  shotId: string;
  actorId: string;
}

export interface RestoreShotCommand extends Command {
  type: "RestoreShot";
  shotId: string;
  actorId: string;
  /** true=从 archived 还原到 draft；false=仅清空 deleted_at。 */
  fromArchive?: boolean;
}

export async function handleArchiveShot(
  deps: ShotHandlerDeps,
  command: ArchiveShotCommand,
): Promise<void> {
  return deps.uow.run(async (ctx) => {
    await assertCommandNotProcessed(deps, command.commandId, "archive");
    const aggregate = await loadShotOrThrow(deps, command.shotId);
    const expectedVersion = aggregate.version;
    aggregate.archive(command.actorId);
    await deps.repo.save(aggregate, expectedVersion);
    await deps.repo.recordCommand(command.commandId, aggregate.id);
    enqueuePulledEvents(ctx, aggregate);
  });
}

export async function handleSoftDeleteShot(
  deps: ShotHandlerDeps,
  command: SoftDeleteShotCommand,
): Promise<void> {
  return deps.uow.run(async (ctx) => {
    await assertCommandNotProcessed(deps, command.commandId, "softDelete");
    const aggregate = await loadShotOrThrow(deps, command.shotId);
    const expectedVersion = aggregate.version;
    aggregate.softDelete(command.actorId);
    await deps.repo.save(aggregate, expectedVersion);
    await deps.repo.recordCommand(command.commandId, aggregate.id);
    enqueuePulledEvents(ctx, aggregate);
  });
}

export async function handleRestoreShot(
  deps: ShotHandlerDeps,
  command: RestoreShotCommand,
): Promise<void> {
  return deps.uow.run(async (ctx) => {
    await assertCommandNotProcessed(deps, command.commandId, "restore");
    const aggregate = await loadShotOrThrow(deps, command.shotId);
    const expectedVersion = aggregate.version;
    if (command.fromArchive) {
      aggregate.restore(command.actorId);
    } else {
      aggregate.restoreFromSoftDelete(command.actorId);
    }
    await deps.repo.save(aggregate, expectedVersion);
    await deps.repo.recordCommand(command.commandId, aggregate.id);
    enqueuePulledEvents(ctx, aggregate);
  });
}
