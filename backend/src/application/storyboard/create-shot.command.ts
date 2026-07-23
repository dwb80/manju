/**
 * @file create-shot.command.ts
 * @description 创建镜头命令：从"不存在"创建新的 ShotAggregate（draft 状态）。
 *
 * 输入只接受受允许的元数据；status/version/审核结果等受保护字段不可由调用方传入。
 * storyboardId 必填（V2 父子结构：镜头必须属于一个分镜），但故事板存在性由
 * Command Handler 在加载分镜时验证；本命令不直接检查分镜（保持聚合轻量）。
 */

import type { Command } from "../shared/command.js";
import { ShotAggregate } from "../../domain/storyboard/shot.aggregate.js";
import {
  assertCommandNotProcessed,
  enqueuePulledEvents,
  type ShotHandlerDeps,
} from "./shot-command-handler.js";

export interface CreateShotCommand extends Command {
  type: "CreateShot";
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
}

export async function handleCreateShot(
  deps: ShotHandlerDeps,
  command: CreateShotCommand,
): Promise<ShotAggregate> {
  return deps.uow.run(async (ctx) => {
    await assertCommandNotProcessed(deps, command.commandId, "editMetadata");
    const aggregate = ShotAggregate.create({
      id: undefined,
      projectId: command.projectId,
      storyboardId: command.storyboardId,
      sceneId: command.sceneId,
      episode: command.episode,
      shotNumber: command.shotNumber,
      title: command.title,
      description: command.description,
      duration: command.duration,
      shotSize: command.shotSize,
      cameraAngle: command.cameraAngle,
      cameraMovement: command.cameraMovement,
      dialogue: command.dialogue,
      notes: command.notes,
      imageUrl: command.imageUrl,
      order: command.order,
      characterAssetIds: command.characterAssetIds,
      propAssetIds: command.propAssetIds,
      pipelineRunId: command.pipelineRunId,
      pipelineNodeId: command.pipelineNodeId,
    });
    await deps.repo.save(aggregate, 0);
    await deps.repo.recordCommand(command.commandId, aggregate.id);
    enqueuePulledEvents(ctx, aggregate);
    return aggregate;
  });
}
