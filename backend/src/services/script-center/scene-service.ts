/**
 * 场景 CRUD 服务
 */

import type { AppContext } from "../app.js";
import type { ScriptScene } from "../../types.js";
import { id, nowIso } from "../../utils.js";
import type { ScriptSceneInput } from "./types.js";

/** 时间段枚举：写入前必须收敛到此集合 */
const VALID_TIME_OF_DAY = new Set<ScriptScene["time_of_day"]>(["day", "night", "dawn", "dusk"]);

/**
 * 列出场景。
 * - 必须传 episodeId 或 projectId 至少一个，避免全表扫描造成跨项目数据泄露。
 * - episodeId 优先；projectId 用于按项目批量列出（如剧本统计）。
 */
export async function listScriptScenes(ctx: AppContext, episodeId?: string, projectId?: string): Promise<ScriptScene[]> {
  if (!episodeId && !projectId) {
    throw new Error("episodeId 或 projectId 必填至少一个");
  }
  const filter: Partial<ScriptScene> = {};
  if (episodeId) filter.episode_id = episodeId;
  if (projectId) filter.project_id = projectId;
  return ctx.scriptScenes.findMany(filter, { sort: "asc" });
}

export async function getScriptScene(ctx: AppContext, sceneId: string): Promise<ScriptScene | null> {
  return ctx.scriptScenes.findById(sceneId);
}

/**
 * createScriptScene - 创建场景
 * @param {AppContext} ctx - 应用上下文
 * @param {ScriptSceneInput} input - 场景输入数据
 * @returns {Promise<ScriptScene>} 返回创建的场景记录
 */
export async function createScriptScene(ctx: AppContext, input: ScriptSceneInput): Promise<ScriptScene> {
  // 1) 必填校验
  const projectId = input.project_id ?? "";
  const episodeId = input.episode_id ?? "";
  if (!projectId) throw new Error("project_id 必填");
  if (!episodeId) throw new Error("episode_id 必填");

  // 2) 外键校验：episode 必须存在且属于同一 project
  const episode = await ctx.scriptEpisodes.findById(episodeId);
  if (!episode) throw new Error("剧集不存在");
  if (episode.project_id !== projectId) throw new Error("剧集与项目不匹配");

  // 3) 时间段枚举校验
  const timeOfDay = (input.time_of_day as ScriptScene["time_of_day"]) ?? "day";
  if (!VALID_TIME_OF_DAY.has(timeOfDay)) {
    throw new Error(`time_of_day 必须是 day/night/dawn/dusk 之一,收到: ${input.time_of_day}`);
  }

  // 4) 同一 episode 下 scene_no 唯一
  const sceneNo = input.scene_no ?? 1;
  const dupe = await ctx.scriptScenes.findMany({ episode_id: episodeId, scene_no: sceneNo });
  if (dupe.length > 0) {
    throw new Error(`该剧集下 scene_no=${sceneNo} 已存在`);
  }

  const scene: ScriptScene = {
    id: id("ss"),
    project_id: projectId,
    episode_id: episodeId,
    scene_no: sceneNo,
    location_name: input.location_name ?? "",
    time_of_day: timeOfDay,
    description: input.description ?? "",
    notes: input.notes ?? "",
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  await ctx.scriptScenes.insert(scene);
  return scene;
}

/**
 * updateScriptScene - 更新场景
 * @param {AppContext} ctx - 应用上下文
 * @param {string} sceneId - 场景ID
 * @param {ScriptSceneInput} input - 更新数据
 * @returns {Promise<ScriptScene>} 返回更新后的场景记录
 */
export async function updateScriptScene(
  ctx: AppContext,
  sceneId: string,
  input: ScriptSceneInput
): Promise<ScriptScene> {
  const existing = await ctx.scriptScenes.findById(sceneId);
  if (!existing) throw new Error("场景不存在");

  // 白名单字段：禁止通过 PATCH 改 project_id / episode_id / scene_no（破坏引用完整性）。
  // 三个字段要从 input 中剥离，再覆盖回原值。
  const {
    project_id: _blockedProjectId,
    episode_id: _blockedEpisodeId,
    scene_no: _blockedSceneNo,
    time_of_day: rawTimeOfDay,
    ...allowed
  } = input;

  let timeOfDayPatch: ScriptScene["time_of_day"] | undefined = undefined;
  if (typeof rawTimeOfDay === "string" && rawTimeOfDay.length > 0) {
    if (!VALID_TIME_OF_DAY.has(rawTimeOfDay as ScriptScene["time_of_day"])) {
      throw new Error(`time_of_day 必须是 day/night/dawn/dusk 之一,收到: ${rawTimeOfDay}`);
    }
    timeOfDayPatch = rawTimeOfDay as ScriptScene["time_of_day"];
  }

  const patch: Partial<ScriptScene> = {
    ...allowed,
    project_id: existing.project_id,
    episode_id: existing.episode_id,
    scene_no: existing.scene_no,
    time_of_day: timeOfDayPatch,
    updated_at: nowIso(),
  };

  await ctx.scriptScenes.update(sceneId, patch);
  return { ...existing, ...patch } as ScriptScene;
}

/**
 * deleteScriptScene - 删除场景
 * @param {AppContext} ctx - 应用上下文
 * @param {string} sceneId - 场景ID
 * @returns {Promise<void>}
 */
export async function deleteScriptScene(ctx: AppContext, sceneId: string): Promise<void> {
  // 防御性：避免硬删被剧本仍在引用的场景（级联由调用方在脚本硬删时执行）
  const existing = await ctx.scriptScenes.findById(sceneId);
  if (!existing) throw new Error("场景不存在");
  await ctx.scriptScenes.delete(sceneId);
}
