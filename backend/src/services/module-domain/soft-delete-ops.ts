/**
 * @file soft-delete-ops.ts
 * @description 软删除、恢复、永久删除及跨项目复制操作的封装，统一代理 module-domain-shared 通用函数
 */

import type { AppContext } from "../app.js";
import { softDelete, restoreDeleted, listDeletedInRepo, permanentDelete, copyToProject } from "../module-domain-shared.js";

export const softDeleteStoryboard = (ctx: AppContext, entityId: string) => softDelete(ctx, ctx.storyboards, entityId);
export const restoreStoryboard = (ctx: AppContext, entityId: string) => restoreDeleted(ctx, ctx.storyboards, entityId);
export const listDeletedStoryboards = (ctx: AppContext, projectId?: string) => listDeletedInRepo(ctx.storyboards, projectId);
export const permanentDeleteStoryboard = (ctx: AppContext, entityId: string) => permanentDelete(ctx, ctx.storyboards, entityId);
export const copyStoryboardToProject = (ctx: AppContext, entityId: string, projectId: string) =>
  copyToProject(ctx, ctx.storyboards, entityId, projectId);

export const softDeleteAudio = (ctx: AppContext, entityId: string) => softDelete(ctx, ctx.audios, entityId);
export const restoreAudio = (ctx: AppContext, entityId: string) => restoreDeleted(ctx, ctx.audios, entityId);
export const listDeletedAudios = (ctx: AppContext, projectId?: string) => listDeletedInRepo(ctx.audios, projectId);
export const permanentDeleteAudio = (ctx: AppContext, entityId: string) => permanentDelete(ctx, ctx.audios, entityId);
export const copyAudioToProject = (ctx: AppContext, entityId: string, projectId: string) =>
  copyToProject(ctx, ctx.audios, entityId, projectId);

export const softDeleteVideo = (ctx: AppContext, entityId: string) => softDelete(ctx, ctx.moduleVideoTasks, entityId);
export const restoreVideo = (ctx: AppContext, entityId: string) => restoreDeleted(ctx, ctx.moduleVideoTasks, entityId);
export const listDeletedVideos = (ctx: AppContext, projectId?: string) => listDeletedInRepo(ctx.moduleVideoTasks, projectId);
export const permanentDeleteVideo = (ctx: AppContext, entityId: string) => permanentDelete(ctx, ctx.moduleVideoTasks, entityId);
export const copyVideoToProject = (ctx: AppContext, entityId: string, projectId: string) =>
  copyToProject(ctx, ctx.moduleVideoTasks, entityId, projectId);

export const softDeleteClip = (ctx: AppContext, entityId: string) => softDelete(ctx, ctx.projectClips, entityId);
export const restoreClip = (ctx: AppContext, entityId: string) => restoreDeleted(ctx, ctx.projectClips, entityId);
export const listDeletedClips = (ctx: AppContext, projectId?: string) => listDeletedInRepo(ctx.projectClips, projectId);
export const permanentDeleteClip = (ctx: AppContext, entityId: string) => permanentDelete(ctx, ctx.projectClips, entityId);
export const copyClipToProject = (ctx: AppContext, entityId: string, projectId: string) =>
  copyToProject(ctx, ctx.projectClips, entityId, projectId);
