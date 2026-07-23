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
  generateVideoFromShot,
  listShots,
  createShot,
  updateShot,
  deleteShot,
  autoSplitShots,
  batchDeleteStoryboards,
  batchUpdateStoryboards,
  listAudios,
  createAudio,
  updateAudio,
  deleteAudio,
  restoreAudio as restoreAudioById,
  listDeletedAudios,
  permanentDeleteAudio,
  copyAudioToProject,
  generateTTS,
  batchGenerateTTS,
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
import {
  listPropImageHistory,
  appendPropImageHistory,
  markPropImageApplied,
  markPropImageUnapplied,
  deletePropImageHistory,
  clearPropImageHistory,
} from "../services/prop-image-history.js";
import {
  listSceneImageHistory,
  appendSceneImageHistory,
  markSceneImageApplied,
  markSceneImageUnapplied,
  deleteSceneImageHistory,
  clearSceneImageHistory,
} from "../services/scene-image-history.js";
import {
  listCharacterImages,
  createCharacterImage,
  updateCharacterImage,
  deleteCharacterImage,
  cascadeDeleteCharacterImages,
  listSceneImages,
  createSceneImage,
  updateSceneImage,
  deleteSceneImage,
  cascadeDeleteSceneImages,
  listPropImages,
  createPropImage,
  updatePropImage,
  deletePropImage,
  cascadeDeletePropImages,
} from "../services/factory/asset-image-service.js";
import { requireString } from "../utils.js";

/** 角色子路径保留字，避免与具体 ID 冲突 */
const RESERVED_CHARACTER_SUBPATHS = new Set<string>([
  "deleted",
  "permanent",
  "copy",
  "batch",
  "usage",
  "restore",
  "images",
]);

export interface FactoryRouteHelpers {
  method: string;
  parts: string[];
  readJson: (req: IncomingMessage) => Promise<Record<string, unknown>>;
  sendJson: <T>(res: ServerResponse, data: T, status?: number) => void;
  sendError: (res: ServerResponse, error: unknown, status?: number) => void;
  canAccessProject: (projectId: string) => Promise<boolean>;
}

async function requireProjectAccess(
  res: ServerResponse,
  h: FactoryRouteHelpers,
  ...projectIds: Array<string | undefined>
): Promise<boolean> {
  const uniqueIds = [...new Set(projectIds.filter((value): value is string => Boolean(value)))];
  if (uniqueIds.length === 0 || !(await Promise.all(uniqueIds.map((projectId) => h.canAccessProject(projectId)))).every(Boolean)) {
    h.sendError(res, new Error("无权访问该项目"), 403);
    return false;
  }
  return true;
}

async function filterAccessibleProjects<T extends { project_id: string }>(
  items: T[],
  h: FactoryRouteHelpers,
): Promise<T[]> {
  const access = new Map<string, boolean>();
  for (const projectId of new Set(items.map((item) => item.project_id))) {
    access.set(projectId, await h.canAccessProject(projectId));
  }
  return items.filter((item) => access.get(item.project_id) === true);
}

/**
 * queryParam - 获取查询参数值
 * @param {IncomingMessage} req - HTTP 请求对象
 * @param {string} name - 参数名称
 * @returns {string | undefined} 参数值
 */
function queryParam(req: IncomingMessage, name: string): string | undefined {
  const url = new URL(req.url ?? "/", "http://localhost");
  return url.searchParams.get(name) ?? undefined;
}

/**
 * matchFactoryRoute - 匹配并处理 factory 路由
 * @param {AppContext} ctx - 应用上下文
 * @param {IncomingMessage} req - HTTP 请求对象
 * @param {ServerResponse} res - HTTP 响应对象
 * @param {FactoryRouteHelpers} h - 路由辅助工具对象
 * @returns {Promise<boolean>} true 表示已处理，false 表示不归我管
 * @description 处理角色/场景/道具/分镜/音频/视频/剪辑等工厂类资产的 CRUD 操作
 */
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
      sendJson(res, await filterAccessibleProjects(await listCharacters(ctx, queryParam(req, "projectId")), h));
      return true;
    }
    if (method === "POST" && parts.join("/") === "api/characters") {
      const body = await readJson(req);
      if (!(await requireProjectAccess(res, h, body.project_id as string | undefined))) return true;
      sendJson(res, await createCharacter(ctx, body as any));
      return true;
    }
    if (method === "PUT" && seg2) {
      const existing = await ctx.characters.findById(seg2);
      if (!existing) throw new Error("角色不存在");
      sendJson(res, await updateCharacter(ctx, seg2, { ...(await readJson(req)), project_id: existing.project_id } as any));
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
      const records = await Promise.all(ids.map((assetId) => ctx.characters.findById(assetId)));
      if (records.some((record) => !record)) { sendError(res, new Error("角色不存在"), 404); return true; }
      if (!(await requireProjectAccess(res, h, ...records.map((record) => record?.project_id)))) return true;
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
      sendJson(res, await filterAccessibleProjects(await listDeletedCharacters(ctx, queryParam(req, "projectId")), h));
      return true;
    }
    if (method === "POST" && seg2 === "permanent") {
      const body = await readJson(req);
      const ids = Array.isArray(body.ids) ? (body.ids as string[]) : [];
      const records = await Promise.all(ids.map((assetId) => ctx.characters.findById(assetId)));
      if (records.some((record) => !record)) { sendError(res, new Error("角色不存在"), 404); return true; }
      if (!(await requireProjectAccess(res, h, ...records.map((record) => record?.project_id)))) return true;
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
      const source = await ctx.characters.findById(sourceId);
      if (!source) throw new Error("角色不存在");
      if (!(await requireProjectAccess(res, h, source.project_id, ...targetProjectIds))) return true;
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
    // ===== 角色图片（一对多）=====
    // GET /api/characters/:id/images - 列出角色的所有图
    // POST /api/characters/:id/images - 给角色新增一张图
    if (method === "GET" && seg3 === "images") {
      const characterId = requireString(seg2, "id");
      sendJson(res, await listCharacterImages(ctx, characterId));
      return true;
    }
    if (method === "POST" && seg3 === "images") {
      const body = (await readJson(req)) as Record<string, unknown>;
      const characterId = requireString(seg2, "id");
      const character = await ctx.characters.findById(characterId);
      if (!character) throw new Error("角色不存在");
      const url = requireString(body.url, "url");
      const record = await createCharacterImage(ctx, {
        character_id: characterId,
        project_id: character.project_id,
        script_id: typeof body.script_id === "string" ? body.script_id : undefined,
        url,
        prompt: typeof body.prompt === "string" ? body.prompt : undefined,
        view_type: typeof body.view_type === "string" ? body.view_type : undefined,
        is_primary: body.is_primary === 1 ? 1 : 0,
      });
      sendJson(res, record);
      return true;
    }
    return false;
  }

  // ===== 场景 =====
  if (seg0 === "api" && seg1 === "scenes") {
    if (method === "GET" && parts.join("/") === "api/scenes") {
      sendJson(res, await filterAccessibleProjects(await listScenes(ctx, queryParam(req, "projectId")), h));
      return true;
    }
    if (method === "POST" && parts.join("/") === "api/scenes") {
      const body = await readJson(req);
      if (!(await requireProjectAccess(res, h, body.project_id as string | undefined))) return true;
      sendJson(res, await createScene(ctx, body as any));
      return true;
    }
    if (method === "PUT" && seg2) {
      const existing = await ctx.scenes.findById(seg2);
      if (!existing) throw new Error("场景不存在");
      sendJson(res, await updateScene(ctx, seg2, { ...(await readJson(req)), project_id: existing.project_id } as any));
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
      const records = await Promise.all(ids.map((assetId) => ctx.scenes.findById(assetId)));
      if (records.some((record) => !record)) { sendError(res, new Error("场景不存在"), 404); return true; }
      if (!(await requireProjectAccess(res, h, ...records.map((record) => record?.project_id)))) return true;
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
      sendJson(res, await filterAccessibleProjects(await listDeletedScenes(ctx, queryParam(req, "projectId")), h));
      return true;
    }
    if (method === "POST" && seg2 === "permanent") {
      const body = await readJson(req);
      const ids = Array.isArray(body.ids) ? (body.ids as string[]) : [];
      const records = await Promise.all(ids.map((assetId) => ctx.scenes.findById(assetId)));
      if (records.some((record) => !record)) { sendError(res, new Error("场景不存在"), 404); return true; }
      if (!(await requireProjectAccess(res, h, ...records.map((record) => record?.project_id)))) return true;
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
      const source = await ctx.scenes.findById(sourceId);
      if (!source) throw new Error("场景不存在");
      if (!(await requireProjectAccess(res, h, source.project_id, ...targetProjectIds))) return true;
      sendJson(res, await copyScenesToProjects(ctx, sourceId, targetProjectIds));
      return true;
    }
    // ===== 场景图片（一对多）=====
    if (method === "GET" && seg3 === "images") {
      const sceneId = requireString(seg2, "id");
      sendJson(res, await listSceneImages(ctx, sceneId));
      return true;
    }
    if (method === "POST" && seg3 === "images") {
      const body = (await readJson(req)) as Record<string, unknown>;
      const sceneId = requireString(seg2, "id");
      const scene = await ctx.scenes.findById(sceneId);
      if (!scene) throw new Error("场景不存在");
      const url = requireString(body.url, "url");
      const record = await createSceneImage(ctx, {
        scene_id: sceneId,
        project_id: scene.project_id,
        script_id: typeof body.script_id === "string" ? body.script_id : undefined,
        url,
        prompt: typeof body.prompt === "string" ? body.prompt : undefined,
        view_type: typeof body.view_type === "string" ? body.view_type : undefined,
        is_primary: body.is_primary === 1 ? 1 : 0,
      });
      sendJson(res, record);
      return true;
    }
    return false;
  }

  // ===== 道具 =====
  if (seg0 === "api" && seg1 === "props") {
    if (method === "GET" && parts.join("/") === "api/props") {
      sendJson(res, await filterAccessibleProjects(await listProps(ctx, queryParam(req, "projectId")), h));
      return true;
    }
    if (method === "POST" && parts.join("/") === "api/props") {
      const body = await readJson(req);
      if (!(await requireProjectAccess(res, h, body.project_id as string | undefined))) return true;
      sendJson(res, await createProp(ctx, body as any));
      return true;
    }
    if (method === "PUT" && seg2) {
      const existing = await ctx.props.findById(seg2);
      if (!existing) throw new Error("道具不存在");
      sendJson(res, await updateProp(ctx, seg2, { ...(await readJson(req)), project_id: existing.project_id } as any));
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
      const records = await Promise.all(ids.map((assetId) => ctx.props.findById(assetId)));
      if (records.some((record) => !record)) { sendError(res, new Error("道具不存在"), 404); return true; }
      if (!(await requireProjectAccess(res, h, ...records.map((record) => record?.project_id)))) return true;
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
      sendJson(res, await filterAccessibleProjects(await listDeletedProps(ctx, queryParam(req, "projectId")), h));
      return true;
    }
    if (method === "POST" && seg2 === "permanent") {
      const body = await readJson(req);
      const ids = Array.isArray(body.ids) ? (body.ids as string[]) : [];
      const records = await Promise.all(ids.map((assetId) => ctx.props.findById(assetId)));
      if (records.some((record) => !record)) { sendError(res, new Error("道具不存在"), 404); return true; }
      if (!(await requireProjectAccess(res, h, ...records.map((record) => record?.project_id)))) return true;
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
      const source = await ctx.props.findById(sourceId);
      if (!source) throw new Error("道具不存在");
      if (!(await requireProjectAccess(res, h, source.project_id, ...targetProjectIds))) return true;
      sendJson(res, await copyPropsToProjects(ctx, sourceId, targetProjectIds));
      return true;
    }
    // ===== 道具图片（一对多）=====
    if (method === "GET" && seg3 === "images") {
      const propId = requireString(seg2, "id");
      sendJson(res, await listPropImages(ctx, propId));
      return true;
    }
    if (method === "POST" && seg3 === "images") {
      const body = (await readJson(req)) as Record<string, unknown>;
      const propId = requireString(seg2, "id");
      const prop = await ctx.props.findById(propId);
      if (!prop) throw new Error("道具不存在");
      const url = requireString(body.url, "url");
      const record = await createPropImage(ctx, {
        prop_id: propId,
        project_id: prop.project_id,
        script_id: typeof body.script_id === "string" ? body.script_id : undefined,
        url,
        prompt: typeof body.prompt === "string" ? body.prompt : undefined,
        view_type: typeof body.view_type === "string" ? body.view_type : undefined,
        is_primary: body.is_primary === 1 ? 1 : 0,
      });
      sendJson(res, record);
      return true;
    }
    return false;
  }

  // ===== 分镜 =====
  if (seg0 === "api" && seg1 === "storyboards") {
    if (method === "GET" && parts.join("/") === "api/storyboards") {
      sendJson(res, await filterAccessibleProjects(await listStoryboards(ctx, queryParam(req, "projectId")), h));
      return true;
    }
    if (method === "POST" && parts.join("/") === "api/storyboards") {
      const body = await readJson(req);
      if (!(await requireProjectAccess(res, h, body.project_id as string | undefined))) return true;
      sendJson(res, await createStoryboard(ctx, body as any));
      return true;
    }
    if (method === "PUT" && seg2) {
      const existing = await ctx.storyboards.findById(seg2);
      if (!existing) throw new Error("分镜不存在");
      sendJson(res, await updateStoryboard(ctx, seg2, { ...(await readJson(req)), project_id: existing.project_id } as any));
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
      sendJson(res, await filterAccessibleProjects(await listDeletedStoryboards(ctx, queryParam(req, "projectId")), h));
      return true;
    }
    if (method === "POST" && seg2 === "permanent") {
      const body = await readJson(req);
      const ids = Array.isArray(body.ids) ? (body.ids as string[]) : [];
      const records = await Promise.all(ids.map((assetId) => ctx.storyboards.findById(assetId)));
      if (records.some((record) => !record)) { sendError(res, new Error("分镜不存在"), 404); return true; }
      if (!(await requireProjectAccess(res, h, ...records.map((record) => record?.project_id)))) return true;
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
      if (!(await requireProjectAccess(res, h, targetProjectId))) return true;
      sendJson(res, await copyStoryboardToProject(ctx, seg2, targetProjectId));
      return true;
    }
    if (method === "POST" && parts.join("/") === "api/storyboards/batch") {
      const body = await readJson(req);
      const ids = Array.isArray(body.ids) ? (body.ids as string[]) : [];
      const records = await Promise.all(ids.map((assetId) => ctx.storyboards.findById(assetId)));
      if (records.some((record) => !record)) { sendError(res, new Error("分镜不存在"), 404); return true; }
      if (!(await requireProjectAccess(res, h, ...records.map((record) => record?.project_id)))) return true;
      if (body.action === "delete") {
        await batchDeleteStoryboards(ctx, ids);
        sendJson(res, { deleted: ids.length });
        return true;
      }
      if (body.action === "update") {
        await batchUpdateStoryboards(ctx, ids, (body.patch ?? {}) as any);
        sendJson(res, { updated: ids.length });
        return true;
      }
      throw new Error("unknown batch action");
    }
    // ===== 镜头（shots）子路由 =====
    // GET    /api/storyboards/:id/shots          列出分镜下的镜头
    // POST   /api/storyboards/:id/shots          在该分镜下创建镜头
    // POST   /api/storyboards/:id/split-shots    AI 自动拆分镜头
    if (seg2 && seg3 === "shots") {
      if (method === "GET") {
        sendJson(res, await listShots(ctx, seg2));
        return true;
      }
      if (method === "POST") {
        const body = await readJson(req);
        sendJson(res, await createShot(ctx, { ...body, storyboard_id: seg2 } as any));
        return true;
      }
    }
    if (method === "POST" && seg2 && seg3 === "split-shots") {
      sendJson(res, await autoSplitShots(ctx, seg2));
      return true;
    }
    // POST /api/storyboards/:id/shots/:shotId/generate-video  镜头级别图生视频
    if (method === "POST" && seg2 && seg3 && parts[4] === "generate-video") {
      const body = await readJson(req);
      sendJson(res, await generateVideoFromShot(ctx, seg3, body ?? {}));
      return true;
    }
    return false;
  }

  // ===== 音频 =====
  if (seg0 === "api" && seg1 === "audios") {
    if (method === "GET" && parts.join("/") === "api/audios") {
      sendJson(res, await filterAccessibleProjects(await listAudios(ctx, queryParam(req, "projectId")), h));
      return true;
    }
    if (method === "POST" && parts.join("/") === "api/audios") {
      const body = await readJson(req);
      if (!(await requireProjectAccess(res, h, body.project_id as string | undefined))) return true;
      sendJson(res, await createAudio(ctx, body as any));
      return true;
    }
    if (method === "PUT" && seg2) {
      const existing = await ctx.audios.findById(seg2);
      if (!existing) throw new Error("音频不存在");
      sendJson(res, await updateAudio(ctx, seg2, { ...(await readJson(req)), project_id: existing.project_id } as any));
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
      sendJson(res, await filterAccessibleProjects(await listDeletedAudios(ctx, queryParam(req, "projectId")), h));
      return true;
    }
    if (method === "POST" && seg2 === "permanent") {
      const body = await readJson(req);
      const ids = Array.isArray(body.ids) ? (body.ids as string[]) : [];
      const records = await Promise.all(ids.map((assetId) => ctx.audios.findById(assetId)));
      if (records.some((record) => !record)) { sendError(res, new Error("音频不存在"), 404); return true; }
      if (!(await requireProjectAccess(res, h, ...records.map((record) => record?.project_id)))) return true;
      for (const id of ids) await permanentDeleteAudio(ctx, id);
      sendJson(res, { deleted: ids.length });
      return true;
    }
    if (method === "POST" && seg2 && seg3 === "copy") {
      const body = await readJson(req);
      const targetProjectId = requireString(body.targetProjectId, "targetProjectId");
      if (!(await requireProjectAccess(res, h, targetProjectId))) return true;
      sendJson(res, await copyAudioToProject(ctx, seg2, targetProjectId));
      return true;
    }
    if (method === "POST" && seg2 && seg3 === "tts") {
      const body = await readJson(req);
      sendJson(res, await generateTTS(ctx, { ...(body as any), audio_id: seg2 }));
      return true;
    }
    if (method === "POST" && parts.join("/") === "api/tts/generate") {
      const body = await readJson(req);
      if (!(await requireProjectAccess(res, h, body.project_id as string | undefined))) return true;
      sendJson(res, await generateTTS(ctx, body as any));
      return true;
    }
    if (method === "POST" && parts.join("/") === "api/tts/batch") {
      const body = await readJson(req);
      const items = Array.isArray(body.items) ? (body.items as any[]) : [];
      if (!(await requireProjectAccess(res, h, body.project_id as string | undefined))) return true;
      sendJson(res, await batchGenerateTTS(ctx, items));
      return true;
    }
    return false;
  }

  // ===== 模块视频任务 =====
  if (seg0 === "api" && seg1 === "module-videos") {
    if (method === "GET" && parts.join("/") === "api/module-videos") {
      sendJson(res, await filterAccessibleProjects(await listModuleVideoTasks(ctx, queryParam(req, "projectId")), h));
      return true;
    }
    if (method === "POST" && parts.join("/") === "api/module-videos") {
      const body = await readJson(req);
      if (!(await requireProjectAccess(res, h, body.project_id as string | undefined))) return true;
      sendJson(res, await createModuleVideoTask(ctx, body as any));
      return true;
    }
    if (method === "PUT" && seg2) {
      const existing = await ctx.moduleVideos.findById(seg2);
      if (!existing) throw new Error("视频任务不存在");
      sendJson(res, await updateModuleVideoTask(ctx, seg2, { ...(await readJson(req)), project_id: existing.project_id } as any));
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
      sendJson(res, await filterAccessibleProjects(await listDeletedVideos(ctx, queryParam(req, "projectId")), h));
      return true;
    }
    if (method === "POST" && seg2 === "permanent") {
      const body = await readJson(req);
      const ids = Array.isArray(body.ids) ? (body.ids as string[]) : [];
      const records = await Promise.all(ids.map((assetId) => ctx.moduleVideos.findById(assetId)));
      if (records.some((record) => !record)) { sendError(res, new Error("视频任务不存在"), 404); return true; }
      if (!(await requireProjectAccess(res, h, ...records.map((record) => record?.project_id)))) return true;
      for (const id of ids) await permanentDeleteVideo(ctx, id);
      sendJson(res, { deleted: ids.length });
      return true;
    }
    if (method === "POST" && seg2 && seg3 === "copy") {
      const body = await readJson(req);
      const targetProjectId = requireString(body.targetProjectId, "targetProjectId");
      if (!(await requireProjectAccess(res, h, targetProjectId))) return true;
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
      const character = await ctx.characters.findById(characterId);
      if (!character) throw new Error("角色不存在");
      if (!(await requireProjectAccess(res, h, character.project_id))) return true;
      sendJson(res, await listImageHistory(ctx, characterId));
      return true;
    }
    if (method === "POST" && parts.join("/") === "api/character-image-history") {
      const body = (await readJson(req)) as Record<string, unknown>;
      const characterId = requireString(body.character_id, "character_id");
      const character = await ctx.characters.findById(characterId);
      if (!character) throw new Error("角色不存在");
      if (!(await requireProjectAccess(res, h, character.project_id))) return true;
      const url = requireString(body.url, "url");
      const record = await appendImageHistory(ctx, {
        character_id: characterId,
        project_id: character.project_id,
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
      const character = await ctx.characters.findById(characterId);
      if (!character) throw new Error("角色不存在");
      if (!(await requireProjectAccess(res, h, character.project_id))) return true;
      const count = await clearImageHistory(ctx, characterId);
      sendJson(res, { deleted: count });
      return true;
    }
    return false;
  }

  // ===== 单张图片的 PATCH/DELETE 端点（顶层路径，避免被资产 GET 路由吃掉）=====
  // PATCH /api/character-images/:id - 更新（view_type / prompt / is_primary / url）
  // DELETE /api/character-images/:id - 删图
  if (seg0 === "api" && seg1 === "character-images" && seg2) {
    if (method === "PATCH") {
      const body = (await readJson(req)) as Record<string, unknown>;
      const patch: Record<string, unknown> = {};
      if (typeof body.prompt === "string") patch.prompt = body.prompt;
      if (typeof body.view_type === "string") patch.view_type = body.view_type;
      if (body.is_primary === 0 || body.is_primary === 1) patch.is_primary = body.is_primary;
      if (typeof body.url === "string") patch.url = body.url;
      const updated = await updateCharacterImage(ctx, seg2, patch as any);
      if (!updated) {
        sendError(res, new Error("图片不存在"), 404);
        return true;
      }
      sendJson(res, updated);
      return true;
    }
    if (method === "DELETE") {
      const ok = await deleteCharacterImage(ctx, seg2);
      sendJson(res, { deleted: ok });
      return true;
    }
    return false;
  }
  // PATCH/DELETE /api/scene-images/:id
  if (seg0 === "api" && seg1 === "scene-images" && seg2) {
    if (method === "PATCH") {
      const body = (await readJson(req)) as Record<string, unknown>;
      const patch: Record<string, unknown> = {};
      if (typeof body.prompt === "string") patch.prompt = body.prompt;
      if (typeof body.view_type === "string") patch.view_type = body.view_type;
      if (body.is_primary === 0 || body.is_primary === 1) patch.is_primary = body.is_primary;
      if (typeof body.url === "string") patch.url = body.url;
      const updated = await updateSceneImage(ctx, seg2, patch as any);
      if (!updated) {
        sendError(res, new Error("图片不存在"), 404);
        return true;
      }
      sendJson(res, updated);
      return true;
    }
    if (method === "DELETE") {
      const ok = await deleteSceneImage(ctx, seg2);
      sendJson(res, { deleted: ok });
      return true;
    }
    return false;
  }
  // PATCH/DELETE /api/prop-images/:id
  if (seg0 === "api" && seg1 === "prop-images" && seg2) {
    if (method === "PATCH") {
      const body = (await readJson(req)) as Record<string, unknown>;
      const patch: Record<string, unknown> = {};
      if (typeof body.prompt === "string") patch.prompt = body.prompt;
      if (typeof body.view_type === "string") patch.view_type = body.view_type;
      if (body.is_primary === 0 || body.is_primary === 1) patch.is_primary = body.is_primary;
      if (typeof body.url === "string") patch.url = body.url;
      const updated = await updatePropImage(ctx, seg2, patch as any);
      if (!updated) {
        sendError(res, new Error("图片不存在"), 404);
        return true;
      }
      sendJson(res, updated);
      return true;
    }
    if (method === "DELETE") {
      const ok = await deletePropImage(ctx, seg2);
      sendJson(res, { deleted: ok });
      return true;
    }
    return false;
  }

  // ===== 道具图片生成历史 =====
  // 路由：
  //   GET    /api/prop-image-history?propId=xxx                列出该道具所有历史
  //   POST   /api/prop-image-history                          追加一条（AI 生成图后调用）
  //   PATCH  /api/prop-image-history/:id/apply                标记已应用
  //   PATCH  /api/prop-image-history/:id/unapply              取消应用标记
  //   DELETE /api/prop-image-history/:id                      删除单条
  //   POST   /api/prop-image-history/clear                    清空某道具所有
  if (seg0 === "api" && seg1 === "prop-image-history") {
    if (method === "GET" && parts.join("/") === "api/prop-image-history") {
      const propId = requireString(queryParam(req, "propId"), "propId");
      const prop = await ctx.props.findById(propId);
      if (!prop) throw new Error("道具不存在");
      if (!(await requireProjectAccess(res, h, prop.project_id))) return true;
      sendJson(res, await listPropImageHistory(ctx, propId));
      return true;
    }
    if (method === "POST" && parts.join("/") === "api/prop-image-history") {
      const body = (await readJson(req)) as Record<string, unknown>;
      const propId = requireString(body.prop_id, "prop_id");
      const prop = await ctx.props.findById(propId);
      if (!prop) throw new Error("道具不存在");
      if (!(await requireProjectAccess(res, h, prop.project_id))) return true;
      const url = requireString(body.url, "url");
      const record = await appendPropImageHistory(ctx, {
        prop_id: propId,
        project_id: prop.project_id,
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
      const record = await markPropImageApplied(ctx, seg2);
      if (!record) {
        sendError(res, new Error("记录不存在"), 404);
        return true;
      }
      sendJson(res, record);
      return true;
    }
    if (method === "PATCH" && seg2 && seg3 === "unapply") {
      await markPropImageUnapplied(ctx, seg2);
      sendJson(res, { ok: true });
      return true;
    }
    if (method === "DELETE" && seg2) {
      const ok = await deletePropImageHistory(ctx, seg2);
      sendJson(res, { deleted: ok });
      return true;
    }
    if (method === "POST" && parts.join("/") === "api/prop-image-history/clear") {
      const body = (await readJson(req)) as Record<string, unknown>;
      const propId = requireString(body.prop_id, "prop_id");
      const prop = await ctx.props.findById(propId);
      if (!prop) throw new Error("道具不存在");
      if (!(await requireProjectAccess(res, h, prop.project_id))) return true;
      const count = await clearPropImageHistory(ctx, propId);
      sendJson(res, { deleted: count });
      return true;
    }
    return false;
  }

  // ===== 场景图片生成历史 =====
  // 路由：
  //   GET    /api/scene-image-history?sceneId=xxx              列出该场景所有历史
  //   POST   /api/scene-image-history                         追加一条（AI 生成图后调用）
  //   PATCH  /api/scene-image-history/:id/apply               标记已应用
  //   PATCH  /api/scene-image-history/:id/unapply             取消应用标记
  //   DELETE /api/scene-image-history/:id                     删除单条
  //   POST   /api/scene-image-history/clear                   清空某场景所有
  if (seg0 === "api" && seg1 === "scene-image-history") {
    if (method === "GET" && parts.join("/") === "api/scene-image-history") {
      const sceneId = requireString(queryParam(req, "sceneId"), "sceneId");
      const scene = await ctx.scenes.findById(sceneId);
      if (!scene) throw new Error("场景不存在");
      if (!(await requireProjectAccess(res, h, scene.project_id))) return true;
      sendJson(res, await listSceneImageHistory(ctx, sceneId));
      return true;
    }
    if (method === "POST" && parts.join("/") === "api/scene-image-history") {
      const body = (await readJson(req)) as Record<string, unknown>;
      const sceneId = requireString(body.scene_id, "scene_id");
      const scene = await ctx.scenes.findById(sceneId);
      if (!scene) throw new Error("场景不存在");
      if (!(await requireProjectAccess(res, h, scene.project_id))) return true;
      const url = requireString(body.url, "url");
      const record = await appendSceneImageHistory(ctx, {
        scene_id: sceneId,
        project_id: scene.project_id,
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
      const record = await markSceneImageApplied(ctx, seg2);
      if (!record) {
        sendError(res, new Error("记录不存在"), 404);
        return true;
      }
      sendJson(res, record);
      return true;
    }
    if (method === "PATCH" && seg2 && seg3 === "unapply") {
      await markSceneImageUnapplied(ctx, seg2);
      sendJson(res, { ok: true });
      return true;
    }
    if (method === "DELETE" && seg2) {
      const ok = await deleteSceneImageHistory(ctx, seg2);
      sendJson(res, { deleted: ok });
      return true;
    }
    if (method === "POST" && parts.join("/") === "api/scene-image-history/clear") {
      const body = (await readJson(req)) as Record<string, unknown>;
      const sceneId = requireString(body.scene_id, "scene_id");
      const scene = await ctx.scenes.findById(sceneId);
      if (!scene) throw new Error("场景不存在");
      if (!(await requireProjectAccess(res, h, scene.project_id))) return true;
      const count = await clearSceneImageHistory(ctx, sceneId);
      sendJson(res, { deleted: count });
      return true;
    }
    return false;
  }

  return false;
}
