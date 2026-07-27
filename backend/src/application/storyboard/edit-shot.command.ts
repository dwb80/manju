/**
 * @file edit-shot.command.ts
 * @description 编辑镜头元数据命令：不改变 status / version 输入 / 审核结果。
 *
 * 受保护字段（status / version / reviewId / approvedAt / rejectedAt /
 * reviewerId / submittedAt / submittedBy / lastGenerationRequestId）由
 * Command Handler 入口统一守门（`assertNoProtectedFields` in shot-command-handler），
 * 避免调用方通过 DTO 绕过聚合。本文件命令仍显式调一次，确保语义自描述。
 */

import type { Command } from "../shared/command.js";
import {
  ShotAggregate,
  type ShotEditableMetadata,
} from "../../domain/storyboard/shot.aggregate.js";
import {
  assertCommandNotProcessed,
  assertNoProtectedFields,
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

// re-export：历史调用方仍可从 edit-shot 模块引用
// @deprecated 请直接从 `./shot-command-handler.js` 引用 `assertNoProtectedFields`；
// 本兼容 re-export 将在下个主版本移除。详见 v2.1-ddd-pipeline-uow-migration.md 后续清理条目。
// eslint-disable-next-line @typescript-eslint/no-deprecated
export { assertNoProtectedFields };

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
