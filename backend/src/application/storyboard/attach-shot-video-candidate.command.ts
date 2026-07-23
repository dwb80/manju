/**
 * @file attach-shot-video-candidate.command.ts
 * @description 视频生成回调命令：generating -> ready。
 *
 * Provider 视频生成回调由本命令进入聚合。聚合对 (providerRequestId,
 * generationRequestId) 做幂等校验，重复回调不会推进状态；当前
 * generationRequestId 与回调不一致时（人工返工后已重新发起）拒绝覆盖。
 *
 * 完成后产 ShotVideoCandidateAttached 事件。
 */

import { randomUUID } from "node:crypto";
import type { Command } from "../shared/command.js";
import {
  assertCommandNotProcessed,
  enqueuePulledEvents,
  loadShotOrThrow,
  type ShotHandlerDeps,
} from "./shot-command-handler.js";

export interface AttachShotVideoCandidateCommand extends Command {
  type: "AttachShotVideoCandidate";
  shotId: string;
  /** 由 Provider/Queue 生成的回调 id。 */
  candidateId?: string;
  providerRequestId: string;
  videoUrl: string;
  /** 关联到发起此次生成的 generationRequestId。 */
  generationRequestId: string;
  attachedBy: string;
}

export async function handleAttachShotVideoCandidate(
  deps: ShotHandlerDeps,
  command: AttachShotVideoCandidateCommand,
): Promise<void> {
  return deps.uow.run(async (ctx) => {
    await assertCommandNotProcessed(deps, command.commandId, "attachGeneratedVideo");
    const aggregate = await loadShotOrThrow(deps, command.shotId);
    const expectedVersion = aggregate.version;
    aggregate.attachGeneratedVideo({
      candidateId: command.candidateId ?? `shot_candidate-${randomUUID()}`,
      providerRequestId: command.providerRequestId,
      videoUrl: command.videoUrl,
      generationRequestId: command.generationRequestId,
      attachedBy: command.attachedBy,
    });
    await deps.repo.save(aggregate, expectedVersion);
    await deps.repo.recordCommand(command.commandId, aggregate.id);
    enqueuePulledEvents(ctx, aggregate);
  });
}
