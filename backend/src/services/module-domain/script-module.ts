import type { AppContext } from "../app.js";
import type { Script } from "../../types/script.js";
import { id, nowIso } from "../../utils.js";
import { recordAppLog } from "../audit-log.js";

export type ScriptInput = {
  project_id?: string;
  title?: string;
  description?: string;
  status?: string;
  words?: number;
  chapters?: number;
  author?: string;
  tags?: string[];
  version?: number;
};

export async function listScripts(ctx: AppContext, projectId?: string): Promise<Script[]> {
  const filter: Partial<Script> = projectId ? { project_id: projectId } : {};
  const all = await ctx.scripts.findMany(filter, { sort: "desc" });
  return all.filter((s) => !s.deleted_at);
}

export async function listDeletedScripts(ctx: AppContext, projectId?: string): Promise<Script[]> {
  const filter: Partial<Script> = projectId ? { project_id: projectId } : {};
  const all = await ctx.scripts.findMany(filter, { sort: "desc" });
  return all.filter((s) => !!s.deleted_at);
}

export async function createScript(ctx: AppContext, input: ScriptInput): Promise<Script> {
  const script: Script = {
    id: id("script"),
    project_id: input.project_id ?? "",
    title: input.title ?? "",
    description: input.description ?? "",
    status: (input.status as Script["status"]) ?? "draft",
    words: input.words ?? 0,
    chapters: input.chapters ?? 0,
    author: input.author ?? "",
    tags: input.tags ?? [],
    version: input.version ?? 1,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  await ctx.scripts.insert(script);
  return script;
}

export async function updateScript(ctx: AppContext, scriptId: string, input: ScriptInput): Promise<Script> {
  const existing = await ctx.scripts.findById(scriptId);
  if (!existing) throw new Error("剧本不存在");
  const patch: Partial<Script> = {
    ...input,
    status: input.status ? (input.status as Script["status"]) : undefined,
    updated_at: nowIso(),
  };
  await ctx.scripts.update(scriptId, patch);
  return { ...existing, ...patch } as Script;
}

export async function deleteScript(ctx: AppContext, scriptId: string): Promise<{ deleted_at: string }> {
  const existing = await ctx.scripts.findById(scriptId);
  if (!existing) throw new Error("剧本不存在");
  if (existing.deleted_at) {
    return { deleted_at: existing.deleted_at };
  }
  const deletedAt = nowIso();
  await ctx.scripts.update(scriptId, {
    deleted_at: deletedAt,
    updated_at: deletedAt,
  } as Partial<Script>);
  void recordAppLog(ctx, {
    entityType: "script",
    entityId: scriptId,
    action: "script.soft_deleted",
    event: "script.soft_deleted",
    payload: { title: existing.title, project_id: existing.project_id },
    projectId: existing.project_id,
  });
  return { deleted_at: deletedAt };
}

export async function restoreScript(ctx: AppContext, scriptId: string): Promise<void> {
  const existing = await ctx.scripts.findById(scriptId);
  if (!existing) throw new Error("剧本不存在或已被彻底删除");
  if (!existing.deleted_at) throw new Error("剧本未处于软删状态");
  const restoredAt = nowIso();
  await ctx.scripts.update(scriptId, {
    deleted_at: "",
    updated_at: restoredAt,
  } as Partial<Script>);
  void recordAppLog(ctx, {
    entityType: "script",
    entityId: scriptId,
    action: "script.restored",
    event: "script.restored",
    payload: { title: existing.title, project_id: existing.project_id },
    projectId: existing.project_id,
  });
}

const SCRIPT_PURGE_GRACE_DAYS = (() => {
  const raw = process.env.SCRIPT_PURGE_GRACE_DAYS;
  const n = raw ? Number(raw) : 30;
  return Number.isFinite(n) && n > 0 ? n : 30;
})();

export async function purgeScript(ctx: AppContext, scriptId: string): Promise<{
  script_id: string;
  deleted_at: string;
  purged_at: string;
  grace_days: number;
  cascade: Record<string, number>;
}> {
  const existing = await ctx.scripts.findById(scriptId);
  if (!existing) throw new Error("剧本不存在");
  if (!existing.deleted_at) {
    throw new Error("剧本未处于软删状态,无法彻底删除");
  }
  const deletedAtMs = Date.parse(existing.deleted_at);
  if (!Number.isFinite(deletedAtMs)) {
    throw new Error("软删时间戳格式异常,无法校验保留期");
  }
  const ageDays = (Date.now() - deletedAtMs) / 86_400_000;
  if (ageDays < SCRIPT_PURGE_GRACE_DAYS) {
    const remain = Math.ceil(SCRIPT_PURGE_GRACE_DAYS - ageDays);
    throw new Error(`剧本软删不足 ${SCRIPT_PURGE_GRACE_DAYS} 天,还需等待 ${remain} 天`);
  }

  const comments = await ctx.scriptComments.findMany({ script_id: scriptId } as any);
  const approvals = await ctx.scriptApprovals.findMany({ script_id: scriptId } as any);
  const assessments = await ctx.scriptQualityAssessments.findMany({ script_id: scriptId } as any);
  const backups = await ctx.scriptBackups.findMany({ document_id: scriptId } as any);
  const episodes = await ctx.scriptEpisodes.findMany({ document_id: scriptId } as any);
  const scenes = await ctx.scriptScenes.findMany({
    episode_id: episodes.map((e) => e.id),
  } as any);
  const sceneIds = scenes.map((s) => s.id);
  const dialogues = sceneIds.length
    ? await ctx.scriptDialogues.findMany({ scene_id: sceneIds } as any)
    : [];
  const sceneCharacters = sceneIds.length
    ? await ctx.scriptSceneCharacters.findMany({ scene_id: sceneIds } as any)
    : [];
  const sceneLocations = sceneIds.length
    ? await ctx.scriptSceneLocations.findMany({ scene_id: sceneIds } as any)
    : [];

  for (const r of dialogues) await ctx.scriptDialogues.delete(r.id);
  for (const r of sceneCharacters) await ctx.scriptSceneCharacters.delete(r.id);
  for (const r of sceneLocations) await ctx.scriptSceneLocations.delete(r.id);
  for (const s of scenes) await ctx.scriptScenes.delete(s.id);
  for (const e of episodes) await ctx.scriptEpisodes.delete(e.id);
  for (const r of backups) await ctx.scriptBackups.delete(r.id);
  for (const r of comments) await ctx.scriptComments.delete(r.id);
  for (const r of approvals) await ctx.scriptApprovals.delete(r.id);
  for (const r of assessments) await ctx.scriptQualityAssessments.delete(r.id);
  try {
    await ctx.scriptDocuments.delete(scriptId);
  } catch {}
  await ctx.scripts.delete(scriptId);

  const cascade = {
    script_comments: comments.length,
    script_approvals: approvals.length,
    script_quality_assessments: assessments.length,
    script_backups: backups.length,
    script_episodes: episodes.length,
    script_scenes: scenes.length,
    script_dialogues: dialogues.length,
    script_scene_characters: sceneCharacters.length,
    script_scene_locations: sceneLocations.length,
  };
  const purgedAt = nowIso();
  void recordAppLog(ctx, {
    entityType: "script",
    entityId: scriptId,
    action: "script.purged",
    event: "script.purged",
    payload: {
      title: existing.title,
      project_id: existing.project_id,
      deleted_at: existing.deleted_at,
      purged_at: purgedAt,
      grace_days: SCRIPT_PURGE_GRACE_DAYS,
      cascade,
    },
    projectId: existing.project_id,
  });
  return {
    script_id: scriptId,
    deleted_at: existing.deleted_at,
    purged_at: purgedAt,
    grace_days: SCRIPT_PURGE_GRACE_DAYS,
    cascade,
  };
}
