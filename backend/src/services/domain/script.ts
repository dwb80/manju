import type { AppContext } from "../app.js";
import type { ProjectAsset, ProjectEpisode, ProjectScript } from "../../types.js";
import { DEFAULT_MODEL, clampNumber, id, nowIso, requireString } from "../../utils.js";
import { createProjectStoryboard, normalizeStringList, type ProjectStoryboardInput } from "./storyboard.js";

type ProjectEpisodeInput = {
  episode?: number;
  title?: string;
  status?: string;
  summary?: string;
  due_date?: string;
  notes?: string;
};

type ProjectScriptInput = {
  episode?: number;
  title?: string;
  content?: string;
  status?: string;
  notes?: string;
};

type ScriptBreakdownInput = {
  script?: string;
  script_id?: string;
  episode?: number;
};

/** 从模型输出中提取 JSON 数组，兼容被 Markdown 代码块包裹的情况。 */
function parseJsonArray(text: string): unknown[] {
  const trimmed = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const start = trimmed.indexOf("[");
  const end = trimmed.lastIndexOf("]");
  if (start < 0 || end <= start) return [];
  try {
    const parsed = JSON.parse(trimmed.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** 当 AI 没有返回合法结构时，按剧本文本段落生成可编辑的分镜草案。 */
function fallbackScriptShots(script: string): ProjectStoryboardInput[] {
  const parts = script
    .split(/\n{2,}|(?=第[一二三四五六七八九十\d]+[场幕])|(?=场景[:：])/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 24);
  return (parts.length ? parts : [script.trim()]).map((part, index) => ({
    scene: String(index + 1),
    shot: "1",
    title: part.split(/\r?\n/)[0]?.slice(0, 24) || `分镜 ${index + 1}`,
    description: part.slice(0, 300),
    dialogue: "",
    characters: [],
    location: "",
    shot_size: index === 0 ? "全景" : "中景",
    camera_move: index === 0 ? "建立镜头" : "平稳推进",
    duration: 5,
    prompt: `${part.slice(0, 180)}，电影感构图，画面清晰，人物动作稳定，光影自然`,
    status: "scripted",
  }));
}

/** 列出项目剧本，按集数和创建时间排序。 */
export async function listProjectScripts(ctx: AppContext, projectId: string): Promise<ProjectScript[]> {
  if (!await ctx.projects.findById(projectId)) throw new Error("project not found");
  const scripts = await ctx.projectScripts.findMany({ project_id: projectId } as Partial<ProjectScript>, { sort: "asc" });
  return scripts.sort((left: ProjectScript, right: ProjectScript) => left.episode - right.episode || left.created_at.localeCompare(right.created_at));
}

/** 在项目下保存一份剧本文档。 */
export async function createProjectScript(ctx: AppContext, projectId: string, input: ProjectScriptInput): Promise<ProjectScript> {
  if (!await ctx.projects.findById(projectId)) throw new Error("project not found");
  const now = nowIso();
  const script: ProjectScript = {
    id: id("pscr"),
    project_id: projectId,
    episode: clampNumber(input.episode, 1, 1, 999),
    title: input.title?.trim() || "新剧本",
    content: input.content?.trim() || "",
    status: input.status === "ready" || input.status === "storyboarded" || input.status === "archived" ? input.status : "draft",
    notes: input.notes?.trim() || "",
    created_at: now,
    updated_at: now,
  };
  await ctx.projectScripts.insert(script);
  return script;
}

/** 更新剧本文档的标题、正文、状态或备注。 */
export async function updateProjectScript(ctx: AppContext, projectId: string, scriptId: string, patch: ProjectScriptInput): Promise<ProjectScript> {
  const existing = await ctx.projectScripts.findById(scriptId);
  if (!existing || existing.project_id !== projectId) throw new Error("project script not found");
  const next: Partial<ProjectScript> = { updated_at: nowIso() };
  if (typeof patch.episode === "number") next.episode = clampNumber(patch.episode, existing.episode, 1, 999);
  if (typeof patch.title === "string") next.title = patch.title.trim() || existing.title;
  if (typeof patch.content === "string") next.content = patch.content.trim();
  if (typeof patch.status === "string") next.status = patch.status === "ready" || patch.status === "storyboarded" || patch.status === "archived" ? patch.status : "draft";
  if (typeof patch.notes === "string") next.notes = patch.notes.trim();
  await ctx.projectScripts.update(scriptId, next);
  return (await ctx.projectScripts.findById(scriptId)) as ProjectScript;
}

/** 删除项目剧本文档。 */
export async function deleteProjectScript(ctx: AppContext, projectId: string, scriptId: string): Promise<void> {
  const existing = await ctx.projectScripts.findById(scriptId);
  if (!existing || existing.project_id !== projectId) throw new Error("project script not found");
  await ctx.projectScripts.delete(scriptId);
}

/** 列出项目剧集，按集数排序。 */
export async function listProjectEpisodes(ctx: AppContext, projectId: string): Promise<ProjectEpisode[]> {
  if (!(await ctx.projects.findById(projectId))) throw new Error("project not found");
  const episodes = await ctx.projectEpisodes.findMany({ project_id: projectId } as Partial<ProjectEpisode>, { sort: "asc" });
  return episodes.sort((left, right) => left.episode - right.episode || left.created_at.localeCompare(right.created_at));
}

/** 新增一个剧集规划条目。 */
export async function createProjectEpisode(ctx: AppContext, projectId: string, input: ProjectEpisodeInput): Promise<ProjectEpisode> {
  if (!(await ctx.projects.findById(projectId))) throw new Error("project not found");
  const now = nowIso();
  const episodeNumber = clampNumber(input.episode, 1, 1, 999);
  const episode: ProjectEpisode = {
    id: id("pe"),
    project_id: projectId,
    episode: episodeNumber,
    title: input.title?.trim() || `第${episodeNumber}集`,
    status: input.status?.trim() || "策划中",
    summary: input.summary?.trim() || "",
    due_date: input.due_date?.trim() || "",
    notes: input.notes?.trim() || "",
    created_at: now,
    updated_at: now,
  };
  await ctx.projectEpisodes.insert(episode);
  return episode;
}

/** 更新剧集标题、状态、简介、截止日期和备注。 */
export async function updateProjectEpisode(ctx: AppContext, projectId: string, episodeId: string, patch: ProjectEpisodeInput): Promise<ProjectEpisode> {
  const existing = await ctx.projectEpisodes.findById(episodeId);
  if (!existing || existing.project_id !== projectId) throw new Error("project episode not found");
  const next: Partial<ProjectEpisode> = { updated_at: nowIso() };
  if (typeof patch.episode === "number") next.episode = clampNumber(patch.episode, existing.episode, 1, 999);
  if (typeof patch.title === "string") next.title = patch.title.trim() || existing.title;
  if (typeof patch.status === "string") next.status = patch.status.trim() || existing.status;
  if (typeof patch.summary === "string") next.summary = patch.summary.trim();
  if (typeof patch.due_date === "string") next.due_date = patch.due_date.trim();
  if (typeof patch.notes === "string") next.notes = patch.notes.trim();
  await ctx.projectEpisodes.update(episodeId, next);
  return (await ctx.projectEpisodes.findById(episodeId)) as ProjectEpisode;
}

/** 删除剧集规划条目，不删除该集已经创建的剧本、分镜或剪辑。 */
export async function deleteProjectEpisode(ctx: AppContext, projectId: string, episodeId: string): Promise<void> {
  const existing = await ctx.projectEpisodes.findById(episodeId);
  if (!existing || existing.project_id !== projectId) throw new Error("project episode not found");
  await ctx.projectEpisodes.delete(episodeId);
}

/** 把剧本文本拆成分镜，并尽量按角色/场景名称自动绑定项目资产。 */
export async function breakdownProjectScript(ctx: AppContext, projectId: string, input: ScriptBreakdownInput): Promise<import("../../types.js").ProjectStoryboard[]> {
  if (!await ctx.projects.findById(projectId)) throw new Error("project not found");
  const savedScript = input.script_id ? await ctx.projectScripts.findById(input.script_id) : null;
  if (savedScript && savedScript.project_id !== projectId) throw new Error("project script not found");
  const script = (savedScript?.content ?? requireString(input.script, "script")).trim();
  const episode = clampNumber(input.episode, savedScript?.episode ?? 1, 1, 999);
  const instruction = [
    "你是AI漫剧导演助理。请把用户剧本拆成分镜 JSON 数组。",
    "只输出 JSON，不要 Markdown，不要解释。",
    "每个数组元素字段：scene, shot, title, description, dialogue, characters, location, shot_size, camera_move, duration, prompt。",
    "要求：每条分镜适合生成一张底图和一个5秒图生视频；prompt 要包含主体、场景、景别、镜头、光照和稳定性要求。",
    "",
    "剧本：",
    script,
  ].join("\n");

  let text = "";
  try {
    for await (const chunk of ctx.ai.chat({ conversationId: "", message: instruction, model: DEFAULT_MODEL })) {
      text += chunk.content;
    }
  } catch {
    text = "";
  }

  const parsed = parseJsonArray(text);
  const drafts = parsed.length > 0 ? parsed as ProjectStoryboardInput[] : fallbackScriptShots(script);
  const assets = await ctx.projectAssets.findMany({ project_id: projectId } as Partial<ProjectAsset>);
  const characterAssets = assets.filter((asset: ProjectAsset) => asset.kind === "character");
  const sceneAssets = assets.filter((asset: ProjectAsset) => asset.kind === "scene");
  const created: import("../../types.js").ProjectStoryboard[] = [];

  for (const [index, draft] of drafts.slice(0, 80).entries()) {
    const characters = normalizeStringList(draft.characters);
    const matchedCharacterIds = characterAssets
      .filter((asset: ProjectAsset) => characters.some((name) => asset.name.includes(name) || name.includes(asset.name)) || script.includes(asset.name))
      .map((asset: ProjectAsset) => asset.id);
    const location = draft.location?.trim() || "";
    const matchedScene = sceneAssets.find((asset: ProjectAsset) => (location && (asset.name.includes(location) || location.includes(asset.name))) || draft.description?.includes(asset.name));
    created.push(await createProjectStoryboard(ctx, projectId, {
      ...draft,
      episode,
      scene: draft.scene?.trim() || String(index + 1),
      shot: draft.shot?.trim() || "1",
      characters,
      character_asset_ids: matchedCharacterIds,
      location,
      scene_asset_id: matchedScene?.id ?? "",
      status: "scripted",
    }));
  }

  if (savedScript) {
    await ctx.projectScripts.update(savedScript.id, { status: "storyboarded", updated_at: nowIso() } as Partial<ProjectScript>);
  }
  return created;
}

/** 导出项目剧本文档，按集数合并为纯文本。 */
export async function exportProjectScriptsText(ctx: AppContext, projectId: string): Promise<string> {
  const scripts = await listProjectScripts(ctx, projectId);
  return scripts.map((script) => [
    `# 第${script.episode}集 ${script.title}`,
    "",
    script.content,
    script.notes ? `\n备注：${script.notes}` : "",
  ].filter(Boolean).join("\n")).join("\n\n---\n\n");
}
