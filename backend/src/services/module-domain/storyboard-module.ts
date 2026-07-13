import type { AppContext } from "../app.js";
import type { Storyboard } from "../../types/storyboard.js";
import { id, nowIso } from "../../utils.js";

export type StoryboardInput = {
  project_id?: string;
  scene_id?: string;
  episode?: number;
  shot_number?: number;
  title?: string;
  description?: string;
  duration?: number;
  camera_angle?: string;
  movement?: string;
  dialogue?: string;
  notes?: string;
  image_url?: string;
  video_task_id?: string;
  video_url?: string;
  status?: string;
  tags?: string[];
  order?: number;
};

export async function listStoryboards(ctx: AppContext, projectId?: string): Promise<Storyboard[]> {
  const filter: Partial<Storyboard> = projectId ? { project_id: projectId } : {};
  const items = await ctx.storyboards.findMany(filter, { sort: "desc" });
  return items.filter((item) => !item.deleted_at);
}

export async function createStoryboard(ctx: AppContext, input: StoryboardInput): Promise<Storyboard> {
  const storyboard: Storyboard = {
    id: id("sb"),
    project_id: input.project_id ?? "",
    scene_id: input.scene_id ?? "",
    episode: input.episode ?? 1,
    shot_number: input.shot_number ?? 1,
    title: input.title ?? input.description ?? "",
    description: input.description ?? "",
    duration: input.duration ?? 0,
    camera_angle: input.camera_angle,
    movement: input.movement,
    dialogue: input.dialogue,
    notes: input.notes,
    image_url: input.image_url ?? "",
    video_task_id: input.video_task_id ?? "",
    video_url: input.video_url ?? "",
    status: (input.status as Storyboard["status"]) ?? "draft",
    tags: input.tags ?? [],
    order: input.order ?? 0,
    usage_count: 0,
    version: 1,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  await ctx.storyboards.insert(storyboard);
  return storyboard;
}

export async function updateStoryboard(ctx: AppContext, storyboardId: string, input: StoryboardInput): Promise<Storyboard> {
  const existing = await ctx.storyboards.findById(storyboardId);
  if (!existing) throw new Error("分镜不存在");
  const patch: Partial<Storyboard> = {
    ...input,
    status: input.status ? (input.status as Storyboard["status"]) : undefined,
    updated_at: nowIso(),
  };
  await ctx.storyboards.update(storyboardId, patch);
  return { ...existing, ...patch } as Storyboard;
}

export async function deleteStoryboard(ctx: AppContext, storyboardId: string): Promise<void> {
  await ctx.storyboards.delete(storyboardId);
}
