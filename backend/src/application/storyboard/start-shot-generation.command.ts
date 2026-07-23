/**
 * @file start-shot-generation.command.ts
 * @description 启动镜头生成命令：draft/ready/needs_fix/rejected -> generating。
 *
 * 由上游 generateVideoFromShot 调用。generationRequestId 必须由 Provider/Queue
 * 生成并传入；聚合将其存为 currentGenerationRequestId，供 attachGeneratedVideo
 * 做幂等校验。
 */

import type { Command } from "../shared/command.js";
import {
  assertCommandNotProcessed,
  enqueuePulledEvents,
  loadShotOrThrow,
  type ShotHandlerDeps,
} from "./shot-command-handler.js";

export interface StartShotGenerationCommand extends Command {
  type: "StartShotGeneration";
  shotId: string;
  actorId: string;
  generationRequestId: string;
  videoTaskId?: string;
}

export async function handleStartShotGeneration(
  deps: ShotHandlerDeps,
  command: StartShotGenerationCommand,
): Promise<void> {
  return deps.uow.run(async (ctx) => {
    await assertCommandNotProcessed(deps, command.commandId, "startGeneration");
    const aggregate = await loadShotOrThrow(deps, command.shotId);
    const expectedVersion = aggregate.version;
    aggregate.startGeneration({
      actorId: command.actorId,
      generationRequestId: command.generationRequestId,
      videoTaskId: command.videoTaskId,
    });
    await deps.repo.save(aggregate, expectedVersion);
    await deps.repo.recordCommand(command.commandId, aggregate.id);
    enqueuePulledEvents(ctx, aggregate);
  });
}
