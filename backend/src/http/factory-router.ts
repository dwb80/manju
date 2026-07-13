/**
 * 工厂路由（评审 P1-H9 修复）
 *
 * 把 characters/scenes/props/storyboards/audios/module-videos/clips 这一类
 * CRUD + 软删/回收站/跨项目复制的路由从 router.ts 拆出。
 *
 * 约定：matchFactoryRoute(ctx, req, res, h) 返回 true 表示已处理，false 表示不归我管。
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AppContext } from "../services/app.js";
import {
  listCharacters,
  createCharacter,
  updateCharacter,
  deleteCharacter,
  restoreCharacter,
  listDeletedCharacters,
  permanentDeleteCharacters,
  batchDeleteCharacters,
  batchUpdateCharacters,
  getCharacter,
  getCharacterUsage,
  copyCharactersToProjects,
  listScenes,
  createScene,
  updateScene,
  deleteScene,
  restoreScene,
  listDeletedScenes,
  permanentDeleteScenes,
  batchDeleteScenes,
  batchUpdateScenes,
  getSceneUsage,
  copyScenesToProjects,
  listProps,
  createProp,
  updateProp,
  deleteProp,
  restoreProp,
  listDeletedProps,
  permanentDeleteProps,
  batchDeleteProps,
  batchUpdateProps,
  getPropUsage,
  copyPropsToProjects,
  listStoryboards,
  createStoryboard,
  updateStoryboard,
  deleteStoryboard,
  restoreStoryboard as restoreStoryboardById,
  listDeletedStoryboards,
  permanentDeleteStoryboard,
  copyStoryboardToProject,
  generateVideoFromStoryboard,
  listAudios,
  createAudio,
  updateAudio,
  deleteAudio,
  restoreAudio as restoreAudioById,
  listDeletedAudios,
  permanentDeleteAudio,
  copyAudioToProject,
  generateTTS,
  listModuleVideoTasks,
  createModuleVideoTask,
  updateModuleVideoTask,
  deleteModuleVideoTask,
  restoreVideo as restoreVideoById,
  listDeletedVideos,
  permanentDeleteVideo,
  copyVideoToProject,
  syncVideoTaskStatus,
  retryVideoTask,
  regenerateVideo,
} from "../services/module-domain.js";
import { listProjectClips } from "../services/domain/storyboard.js";
import {
  listImageHistory,
  appendImageHistory,
  markImageApplied,
  deleteImageHistory,
  clearImageHistory,
} from "../services/character-image-history.js";
import { requireString } from "../utils.js";

/** 角色子路径保留字，避免与具体 ID 冲突 */
const RESERVED_CHARACTER_SUBPATHS = new Set<string>([
  "deleted",
  "permanent",
  "copy",
  "batch",
  "usage",
  "restore",
]);

export interface FactoryRouteHelpers {
  method: string;
  parts: string[];
  readJson: (req: IncomingMessage) => Promise<Record<string, unknown>>;
  sendJson: <T>(res: ServerResponse, data: T, status?: number) => void;
  sendError: (res: ServerResponse, error: unknown, status?: number) => void;
}

function queryParam(req: IncomingMessage, name: string): string | undefined {
  const url = new URL(req.url ?? "/", "http://localhost");
  return url.searchParams.get(name) ?? undefined;
}

/** 匹配并处理 factory 路由；返回 true 表示已处理，false 表示不归我管 */
export async function matchFactoryRoute(
  ctx: AppContext,
  req: IncomingMessage,
  res: ServerResponse,
  h: FactoryRouteHelpers,
): Promise<boolean> {
  const { method, parts, readJson, sendJson, sendError } = h;
  const seg0 = parts[0];
  const seg1 = parts[1];
  const seg2 = parts[2];
  const seg3 = parts[3];

  // ===== 角色 =====
  if (seg0 === "api" && seg1 === "characters") {
    if (method === "GET" && parts.join("/") === "api/characters") {
      sendJson(res, await listCharacters(ctx, queryParam(req, "projectId")));
      return true;
    }
    if (method === "POST" && parts.join("/") === "api/characters") {
      sendJson(res, await createCharacter(ctx, (await readJson(req)) as any));
      return true;
    }
    if (method === "PUT" && seg2) {
      sendJson(res, await updateCharacter(ctx, seg2, (await readJson(req)) as any));
      return true;
    }
    if (method === "DELETE" && seg2) {
      await deleteCharacter(ctx, seg2);
      sendJson(res, { deleted: true });
      return true;
    }
    if (method === "POST" && seg2 && seg3 === "restore") {
      await restoreCharacter(ctx, seg2);
      sendJson(res, { restored: true });
      return true;
    }
    if (method === "GET" && seg2 && seg3 === "usage") {
      sendJson(res, await getCharacterUsage(ctx, seg2));
      return true;
    }
    if (method === "POST" && parts.join("/") === "api/characters/batch") {
      const body = await readJson(req);
      const ids = Array.isArray(body.ids) ? (body.ids as string[]) : [];
      if (body.action === "delete") {
        await batchDeleteCharacters(ctx, ids);
        sendJson(res, { deleted: ids.length });
        return true;
      }
      if (body.action === "update") {
        await batchUpdateCharacters(ctx, ids, (body.patch ?? {}) as any);
        sendJson(res, { updated: ids.length });
        return true;
      }
      throw new Error("unknown batch action");
    }
    if (method === "GET" && seg2 === "deleted") {
      sendJson(res, await listDeletedCharacters(ctx, queryParam(req, "projectId")));
      return true;
    }
    if (method === "POST" && seg2 === "permanent") {
      const body = await readJson(req);
      const ids = Array.isArray(body.ids) ? (body.ids as string[]) : [];
      await permanentDeleteCharacters(ctx, ids);
      sendJson(res, { deleted: ids.length });
      return true;
    }
    if (method === "POST" && parts.join("/") === "api/characters/copy") {
      const body = await readJson(req);
      const sourceId = requireString(body.sourceId, "sourceId");
      const targetProjectIds = Array.isArray(body.targetProjectIds)
        ? (body.targetProjectIds as string[]).filter(Boolean)
        : [];
      if (targetProjectIds.length === 0) throw new Error("targetProjectIds 不能为空");
      sendJson(res, await copyCharactersToProjects(ctx, sourceId, targetProjectIds));
      return true;
    }
    if (method === "GET" && seg2 && !RESERVED_CHARACTER_SUBPATHS.has(seg2)) {
      const ch = await getCharacter(ctx, seg2);
      if (!ch) {
        sendError(res, new Error("角色不存在"), 404);
        return true;
      }
      sendJson(res, ch);
      return true;
    }
    return false;
  }

  // ===== 场景 =====
  if (seg0 === "api" && seg1 === "scenes") {
    if (method === "GET" && parts.join("/") === "api/scenes") {
      sendJson(res, await listScenes(ctx, queryParam(req, "projectId")));
      return true;
    }
    if (method === "POST" && parts.join("/") === "api/scenes") {
      sendJson(res, await createScene(ctx, (await readJson(req)) as any));
      return true;
    }
    if (method === "PUT" && seg2) {
      sendJson(res, await updateScene(ctx, seg2, (await readJson(req)) as any));
      return true;
    }
    if (method === "DELETE" && seg2) {
      await deleteScene(ctx, seg2);
      sendJson(res, { deleted: true });
      return true;
    }
    if (method === "POST" && seg2 && seg3 === "restore") {
      await restoreScene(ctx, seg2);
      sendJson(res, { restored: true });
      return true;
    }
    if (method === "GET" && seg2 && seg3 === "usage") {
      sendJson(res, await getSceneUsage(ctx, seg2));
      return true;
    }
    if (method === "POST" && parts.join("/") === "api/scenes/batch") {
      const body = await readJson(req);
      const ids = Array.isArray(body.ids) ? (body.ids as string[]) : [];
      if (body.action === "delete") {
        await batchDeleteScenes(ctx, ids);
        sendJson(res, { deleted: ids.length });
        return true;
      }
      if (body.action === "update") {
        await batchUpdateScenes(ctx, ids, (body.patch ?? {}) as any);
        sendJson(res, { updated: ids.length });
        return true;
      }
      throw new Error("unknown batch action");
    }
    if (method === "GET" && seg2 === "deleted") {
      sendJson(res, await listDeletedScenes(ctx, queryParam(req, "projectId")));
      return true;
    }
    if (method === "POST" && seg2 === "permanent") {
      const body = await readJson(req);
      const ids = Array.isArray(body.ids) ? (body.ids as string[]) : [];
      await permanentDeleteScenes(ctx, ids);
      sendJson(res, { deleted: ids.length });
      return true;
    }
    if (method === "POST" && parts.join("/") === "api/scenes/copy") {
      const body = await readJson(req);
      const sourceId = requireString(body.sourceId, "sourceId");
      const targetProjectIds = Array.isArray(body.targetProjectIds)
        ? (body.targetProjectIds as string[]).filter(Boolean)
        : [];
      if (targetProjectIds.length === 0) throw new Error("targetProjectIds 不能为空");
      sendJson(res, await copyScenesToProjects(ctx, sourceId, targetProjectIds));
      return true;
    }
    return false;
  }

  // ===== 道具 =====
  if (seg0 === "api" && seg1 === "props") {
    if (method === "GET" && parts.join("/") === "api/props") {
      sendJson(res, await listProps(ctx, queryParam(req, "projectId")));
      return true;
    }
    if (method === "POST" && parts.join("/") === "api/props") {
      sendJson(res, await createProp(ctx, (await readJson(req)) as any));
      return true;
    }
    if (method === "PUT" && seg2) {
      sendJson(res, await updateProp(ctx, seg2, (await readJson(req)) as any));
      return true;
    }
    if (method === "DELETE" && seg2) {
      await deleteProp(ctx, seg2);
      sendJson(res, { deleted: true });
      return true;
    }
    if (method === "POST" && seg2 && seg3 === "restore") {
      await restoreProp(ctx, seg2);
      sendJson(res, { restored: true });
      return true;
    }
    if (method === "GET" && seg2 && seg3 === "usage") {
      sendJson(res, await getPropUsage(ctx, seg2));
      return true;
    }
    if (method === "POST" && parts.join("/") === "api/props/batch") {
      const body = await readJson(req);
      const ids = Array.isArray(body.ids) ? (body.ids as string[]) : [];
      if (body.action === "delete") {
        await batchDeleteProps(ctx, ids);
        sendJson(res, { deleted: ids.length });
        return true;
      }
      if (body.action === "update") {
        await batchUpdateProps(ctx, ids, (body.patch ?? {}) as any);
        sendJson(res, { updated: ids.length });
        return true;
      }
      throw new Error("unknown batch action");
    }
    if (method === "GET" && seg2 === "deleted") {
      sendJson(res, await listDeletedProps(ctx, queryParam(req, "projectId")));
      return true;
    }
    if (method === "POST" && seg2 === "permanent") {
      const body = await readJson(req);
      const ids = Array.isArray(body.ids) ? (body.ids as string[]) : [];
      await permanentDeleteProps(ctx, ids);
      sendJson(res, { deleted: ids.length });
      return true;
    }
    if (method === "POST" && parts.join("/") === "api/props/copy") {
      const body = await readJson(req);
      const sourceId = requireString(body.sourceId, "sourceId");
      const targetProjectIds = Array.isArray(body.targetProjectIds)
        ? (body.targetProjectIds as string[]).filter(Boolean)
        : [];
      if (targetProjectIds.length === 0) throw new Error("targetProjectIds 不能为空");
      sendJson(res, await copyPropsToProjects(ctx, sourceId, targetProjectIds));
      return true;
    }
    return false;
  }

  // ===== 分镜 =====
  if (seg0 === "api" && seg1 === "storyboards") {
    if (method === "GET" && parts.join("/") === "api/storyboards") {
      sendJson(res, await listStoryboards(ctx, queryParam(req, "projectId")));
      return true;
    }
    if (method === "POST" && parts.join("/") === "api/storyboards") {
      sendJson(res, await createStoryboard(ctx, (await readJson(req)) as any));
      return true;
    }
    if (method === "PUT" && seg2) {
      sendJson(res, await updateStoryboard(ctx, seg2, (await readJson(req)) as any));
      return true;
    }
    if (method === "DELETE" && seg2) {
      await deleteStoryboard(ctx, seg2);
      sendJson(res, { deleted: true });
      return true;
    }
    if (method === "POST" && seg2 && seg3 === "restore") {
      await restoreStoryboardById(ctx, seg2);
      sendJson(res, { restored: true });
      return true;
    }
    if (method === "GET" && seg2 === "deleted") {
      sendJson(res, await listDeletedStoryboards(ctx, queryParam(req, "projectId")));
      return true;
    }
    if (method === "POST" && seg2 === "permanent") {
      const body = await readJson(req);
      const ids = Array.isArray(body.ids) ? (body.ids as string[]) : [];
      for (const id of ids) await permanentDeleteStoryboard(ctx, id);
      sendJson(res, { deleted: ids.length });
      return true;
    }
    if (method === "POST" && seg2 && seg3 === "generate-video") {
      const body = await readJson(req);
      sendJson(res, await generateVideoFromStoryboard(ctx, seg2, body ?? {}));
      return true;
    }
    if (method === "POST" && seg2 && seg3 === "copy") {
      const body = await readJson(req);
      const targetProjectId = requireString(body.targetProjectId, "targetProjectId");
      sendJson(res, await copyStoryboardToProject(ctx, seg2, targetProjectId));
      return true;
    }
    return false;
  }

  // ===== 音频 =====
  if (seg0 === "api" && seg1 === "audios") {
    if (method === "GET" && parts.join("/") === "api/audios") {
      sendJson(res, await listAudios(ctx, queryParam(req, "projectId")));
      return true;
    }
    if (method === "POST" && parts.join("/") === "api/audios") {
      sendJson(res, await createAudio(ctx, (await readJson(req)) as any));
      return true;
    }
    if (method === "PUT" && seg2) {
      sendJson(res, await updateAudio(ctx, seg2, (await readJson(req)) as any));
      return true;
    }
    if (method === "DELETE" && seg2) {
      await deleteAudio(ctx, seg2);
      sendJson(res, { deleted: true });
      return true;
    }
    if (method === "POST" && seg2 && seg3 === "restore") {
      await restoreAudioById(ctx, seg2);
      sendJson(res, { restored: true });
      return true;
    }
    if (method === "GET" && seg2 === "deleted") {
      sendJson(res, await listDeletedAudios(ctx, queryParam(req, "projectId")));
      return true;
    }
    if (method === "POST" && seg2 === "permanent") {
      const body = await readJson(req);
      const ids = Array.isArray(body.ids) ? (body.ids as string[]) : [];
      for (const id of ids) await permanentDeleteAudio(ctx, id);
      sendJson(res, { deleted: ids.length });
      return true;
    }
    if (method === "POST" && seg2 && seg3 === "copy") {
      const body = await readJson(req);
      const targetProjectId = requireString(body.targetProjectId, "targetProjectId");
      sendJson(res, await copyAudioToProject(ctx, seg2, targetProjectId));
      return true;
    }
    if (method === "POST" && seg2 && seg3 === "tts") {
      const body = await readJson(req);
      sendJson(res, await generateTTS(ctx, { ...(body as any), audio_id: seg2 }));
      return true;
    }
    if (method === "POST" && parts.join("/") === "api/tts/generate") {
      sendJson(res, await generateTTS(ctx, (await readJson(req)) as any));
      return true;
    }
    return false;
  }

  // ===== 模块视频任务 =====
  if (seg0 === "api" && seg1 === "module-videos") {
    if (method === "GET" && parts.join("/") === "api/module-videos") {
      sendJson(res, await listModuleVideoTasks(ctx, queryParam(req, "projectId")));
      return true;
    }
    if (method === "POST" && parts.join("/") === "api/module-videos") {
      sendJson(res, await createModuleVideoTask(ctx, (await readJson(req)) as any));
      return true;
    }
    if (method === "PUT" && seg2) {
      sendJson(res, await updateModuleVideoTask(ctx, seg2, (await readJson(req)) as any));
      return true;
    }
    if (method === "DELETE" && seg2) {
      await deleteModuleVideoTask(ctx, seg2);
      sendJson(res, { deleted: true });
      return true;
    }
    if (method === "POST" && seg2 && seg3 === "restore") {
      await restoreVideoById(ctx, seg2);
      sendJson(res, { restored: true });
      return true;
    }
    if (method === "GET" && seg2 === "deleted") {
      sendJson(res, await listDeletedVideos(ctx, queryParam(req, "projectId")));
      return true;
    }
    if (method === "POST" && seg2 === "permanent") {
      const body = await readJson(req);
      const ids = Array.isArray(body.ids) ? (body.ids as string[]) : [];
      for (const id of ids) await permanentDeleteVideo(ctx, id);
      sendJson(res, { deleted: ids.length });
      return true;
    }
    if (method === "POST" && seg2 && seg3 === "copy") {
      const body = await readJson(req);
      const targetProjectId = requireString(body.targetProjectId, "targetProjectId");
      sendJson(res, await copyVideoToProject(ctx, seg2, targetProjectId));
      return true;
    }
    if (method === "POST" && seg2 && seg3 === "retry") {
      sendJson(res, await retryVideoTask(ctx, seg2));
      return true;
    }
    if (method === "POST" && seg2 && seg3 === "regenerate") {
      sendJson(res, await regenerateVideo(ctx, seg2));
      return true;
    }
    if (method === "POST" && seg2 && seg3 === "sync-status") {
      const body = await readJson(req);
      sendJson(res, await syncVideoTaskStatus(ctx, seg2, body as any));
      return true;
    }
    return false;
  }

  // ===== 剪辑 =====
  if (seg0 === "api" && seg1 === "clips") {
    if (method === "GET" && parts.join("/") === "api/clips") {
      const projectId = queryParam(req, "projectId");
      if (!projectId) throw new Error("projectId 必填");
      sendJson(res, await listProjectClips(ctx, projectId));
      return true;
    }
    return false;
  }

  // ===== 角色图片生成历史 =====
  // 与 character/factory 解耦：单表存所有 AI 生成的图，is_applied 区分「历史图片」和「已选资产历史」。
  // 路由：
  //   GET    /api/character-image-history?characterId=xxx         列出该角色所有历史
  //   POST   /api/character-image-history                        追加一条（AI 生成图后调用）
  //   PATCH  /api/character-image-history/:id/apply               标记已应用
  //   PATCH  /api/character-image-history/:id/unapply             取消应用标记
  //   DELETE /api/character-image-history/:id                    删除单条
  //   POST   /api/character-image-history/clear                  清空某角色所有
  if (seg0 === "api" && seg1 === "character-image-history") {
    if (method === "GET" && parts.join("/") === "api/character-image-history") {
      const characterId = requireString(queryParam(req, "characterId"), "characterId");
      sendJson(res, await listImageHistory(ctx, characterId));
      return true;
    }
    if (method === "POST" && parts.join("/") === "api/character-image-history") {
      const body = (await readJson(req)) as Record<string, unknown>;
      const characterId = requireString(body.character_id, "character_id");
      const url = requireString(body.url, "url");
      const record = await appendImageHistory(ctx, {
        character_id: characterId,
        project_id: typeof body.project_id === "string" ? body.project_id : "",
        url,
        ratio: typeof body.ratio === "string" ? body.ratio : "1:1",
        model: typeof body.model === "string" ? body.model : "",
        size: typeof body.size === "string" ? body.size : "",
        prompt: typeof body.prompt === "string" ? body.prompt : "",
        negative_prompt: typeof body.negative_prompt === "string" ? body.negative_prompt : "",
        response_format: typeof body.response_format === "string" ? body.response_format : "url",
        n: typeof body.n === "number" ? body.n : 1,
      });
      sendJson(res, record);
      return true;
    }
    if (method === "PATCH" && seg2 && seg3 === "apply") {
      const record = await markImageApplied(ctx, seg2);
      if (!record) {
        sendError(res, new Error("记录不存在"), 404);
        return true;
      }
      sendJson(res, record);
      return true;
    }
    if (method === "DELETE" && seg2) {
      const ok = await deleteImageHistory(ctx, seg2);
      sendJson(res, { deleted: ok });
      return true;
    }
    if (method === "POST" && parts.join("/") === "api/character-image-history/clear") {
      const body = (await readJson(req)) as Record<string, unknown>;
      const characterId = requireString(body.character_id, "character_id");
      const count = await clearImageHistory(ctx, characterId);
      sendJson(res, { deleted: count });
      return true;
    }
    return false;
  }

  return false;
}
