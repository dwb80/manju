/**
 * @file edit-shot.command.ts
 * @description 编辑镜头元数据命令：不改变 status / version 输入 / 审核结果。
 *
 * 受保护字段（status / version / reviewId / approvedAt / rejectedAt /
 * reviewerId / submittedAt / submittedBy / lastGenerationRequestId）由
 * Command Handler 入口强制剥离，避免调用方通过 DTO 绕过聚合。
 */

import type { Command } from "../shared/command.js";
import {
  ShotAggregate,
  type ShotEditableMetadata,
} from "../../domain/storyboard/shot.aggregate.js";
import {
  SHOT_PROTECTED_FIELDS,
} from "../../domain/storyboard/shot-state-machine.js";
import {
  DOMAIN_ERROR_CODES,
  DomainError,
} from "../../domain/shared/domain-error.js";
import {
  assertCommandNotProcessed,
  enqueuePulledEvents,
  loadShotOrThrow,
  type ShotHandlerDeps,
} from "./shot-command-handler.js";

export interface EditShotCommand extends Command {
  type: "EditShot";
  shotId: string;
  actorId: string;
  /** 受允许的元数据 patch。status/version/审核结果等不可由此处传入。 */
  patch: ShotEditableMetadata;
}

/** 入口守一道：拒绝受保护字段进入命令。 */
export function assertNoProtectedFields(patch: Record<string, unknown>): void {
  for (const key of SHOT_PROTECTED_FIELDS) {
    if (key in patch && patch[key] !== undefined) {
      throw new DomainError(
        DOMAIN_ERROR_CODES.aggregateInvariantViolated,
        `edit-shot 拒绝受保护字段：${key}`,
        { field: key, aggregateType: "Shot" },
      );
    }
  }
}

export async function handleEditShot(
  deps: ShotHandlerDeps,
  command: EditShotCommand,
): Promise<ShotAggregate> {
  assertNoProtectedFields(command.patch as Record<string, unknown>);
  return deps.uow.run(async (ctx) => {
    await assertCommandNotProcessed(deps, command.commandId, "editMetadata");
    const aggregate = await loadShotOrThrow(deps, command.shotId);
    const expectedVersion = aggregate.version;
    aggregate.editMetadata(command.actorId, command.patch);
    await deps.repo.save(aggregate, expectedVersion);
    await deps.repo.recordCommand(command.commandId, aggregate.id);
    enqueuePulledEvents(ctx, aggregate);
    return aggregate;
  });
}
