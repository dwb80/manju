import { existsSync, statSync } from "node:fs";
import { join, normalize } from "node:path";
import type { AppContext } from "../app.js";
import type { FinalVideoStatus, FinalVideoVersion } from "../../types/av.js";
import { id, nowIso } from "../../utils.js";

const FINAL_VIDEO_TRANSITIONS: Readonly<Record<FinalVideoStatus, readonly FinalVideoStatus[]>> = {
  pending: ["rendering", "ready", "failed"],
  rendering: ["ready", "failed"],
  ready: ["archived"],
  archived: [],
  failed: ["rendering"],
};

export interface RegisterFinalVideoInput {
  projectId: string;
  runId: string;
  renderJobId?: string;
  compositionId?: string;
  name?: string;
  description?: string;
  duration?: number;
  width?: number;
  height?: number;
  fps?: number;
  videoUrl: string;
  thumbnailUrl?: string;
  tags?: string[];
}

export interface FinalVideoReleaseEvidence {
  qualityReportId: string;
  reviewId: string;
  sourceNodeId: string;
  qualityScore: number;
  fileSize: number;
}

export function resolveFinalVideoDiskPath(root: string, videoUrl: string): string | null {
  if (!videoUrl || videoUrl.startsWith("http://") || videoUrl.startsWith("https://")) return null;
  if (videoUrl.includes("..")) return null;
  const cleanPath = normalize(videoUrl).replace(/\\/g, "/");
  if (!cleanPath.startsWith("/media/")) return null;
  return join(root, cleanPath);
}

function assertFiniteRange(name: string, value: number, min: number, max: number): void {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`FINAL_VIDEO_INVALID_${name.toUpperCase()}`);
  }
}

export async function registerFinalVideo(
  ctx: AppContext,
  input: RegisterFinalVideoInput,
): Promise<FinalVideoVersion> {
  if (!input.projectId) throw new Error("FINAL_VIDEO_PROJECT_REQUIRED");
  if (!input.runId) throw new Error("FINAL_VIDEO_RUN_REQUIRED");
  const run = await ctx.pipelineRuns.findById(input.runId);
  if (!run || run.project_id !== input.projectId) throw new Error("FINAL_VIDEO_SOURCE_RUN_INVALID");
  const abs = resolveFinalVideoDiskPath(ctx.root, input.videoUrl);
  if (!abs || !existsSync(abs)) throw new Error("FINAL_VIDEO_FILE_NOT_FOUND");

  const duration = Number(input.duration ?? 0);
  const width = Number(input.width ?? 1920);
  const height = Number(input.height ?? 1080);
  const fps = Number(input.fps ?? 30);
  assertFiniteRange("duration", duration, 0, 86_400);
  assertFiniteRange("width", width, 1, 16_384);
  assertFiniteRange("height", height, 1, 16_384);
  assertFiniteRange("fps", fps, 1, 240);

  const now = nowIso();
  const record: FinalVideoVersion = {
    id: id("fvv"),
    project_id: input.projectId,
    run_id: input.runId,
    render_job_id: input.renderJobId ?? "",
    composition_id: input.compositionId ?? "",
    version: 1,
    name: (input.name ?? "未命名成片").slice(0, 200),
    description: (input.description ?? "").slice(0, 2000),
    duration,
    width,
    height,
    fps,
    size: statSync(abs).size,
    video_url: input.videoUrl,
    thumbnail_url: input.thumbnailUrl ?? "",
    status: "pending",
    quality_score: 0,
    download_count: 0,
    last_downloaded_at: "",
    error: "",
    tags: (input.tags ?? []).filter((tag): tag is string => typeof tag === "string").slice(0, 20),
    created_at: now,
    updated_at: now,
  };
  await ctx.finalVideoVersions.insert(record);
  return record;
}

export async function getFinalVideoReleaseEvidence(
  ctx: AppContext,
  video: FinalVideoVersion,
): Promise<FinalVideoReleaseEvidence> {
  const run = await ctx.pipelineRuns.findById(video.run_id);
  if (!run || run.project_id !== video.project_id) throw new Error("FINAL_VIDEO_SOURCE_RUN_INVALID");
  const nodes = await ctx.pipelineNodes.findMany({ run_id: video.run_id });
  const sourceNodes = nodes.filter(
    (node) => ["render", "composition", "compose"].includes(String(node.type)) && node.status === "completed",
  );
  if (sourceNodes.length === 0) throw new Error("FINAL_VIDEO_RENDER_NOT_COMPLETED");

  const reports = await ctx.qualityReports.findMany({ run_id: video.run_id });
  const quality = reports
    .filter((report) => report.passed && sourceNodes.some((node) => node.id === report.node_id))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  if (!quality) throw new Error("FINAL_VIDEO_QUALITY_NOT_PASSED");

  const reviews = await ctx.reviewItems.findMany({ project_id: video.project_id });
  const review = reviews.find(
    (item) => item.status === "approved"
      && (
        (item.target_type === "pipeline_run" && item.target_id === video.run_id)
        || (item.target_type === "pipeline_node" && sourceNodes.some((node) => node.id === item.target_id))
      ),
  );
  if (!review) throw new Error("FINAL_VIDEO_REVIEW_NOT_APPROVED");

  const abs = resolveFinalVideoDiskPath(ctx.root, video.video_url);
  if (!abs || !existsSync(abs)) throw new Error("FINAL_VIDEO_FILE_NOT_FOUND");
  return {
    qualityReportId: quality.id,
    reviewId: review.id,
    sourceNodeId: quality.node_id,
    qualityScore: quality.score,
    fileSize: statSync(abs).size,
  };
}

export async function transitionFinalVideo(
  ctx: AppContext,
  videoId: string,
  targetStatus: FinalVideoStatus,
  error = "",
): Promise<FinalVideoVersion> {
  const existing = await ctx.finalVideoVersions.findById(videoId);
  if (!existing) throw new Error("FINAL_VIDEO_NOT_FOUND");
  if (existing.status !== targetStatus && !FINAL_VIDEO_TRANSITIONS[existing.status].includes(targetStatus)) {
    throw new Error(`FINAL_VIDEO_INVALID_TRANSITION: ${existing.status} -> ${targetStatus}`);
  }
  const patch: Partial<FinalVideoVersion> = { status: targetStatus, updated_at: nowIso() };
  if (targetStatus === "ready") {
    const evidence = await getFinalVideoReleaseEvidence(ctx, existing);
    patch.quality_score = evidence.qualityScore;
    patch.size = evidence.fileSize;
    patch.error = "";
  } else if (targetStatus === "failed") {
    if (!error.trim()) throw new Error("FINAL_VIDEO_FAILURE_REASON_REQUIRED");
    patch.error = error.slice(0, 2000);
  }
  await ctx.finalVideoVersions.update(videoId, patch);
  return { ...existing, ...patch };
}

export async function updateFinalVideoTags(
  ctx: AppContext,
  videoId: string,
  tags: string[],
): Promise<FinalVideoVersion> {
  const existing = await ctx.finalVideoVersions.findById(videoId);
  if (!existing) throw new Error("FINAL_VIDEO_NOT_FOUND");
  const patch = {
    tags: tags.filter((tag): tag is string => typeof tag === "string").slice(0, 20),
    updated_at: nowIso(),
  };
  await ctx.finalVideoVersions.update(videoId, patch);
  return { ...existing, ...patch };
}

export async function recordFinalVideoDownload(
  ctx: AppContext,
  video: FinalVideoVersion,
): Promise<void> {
  await getFinalVideoReleaseEvidence(ctx, video);
  const now = nowIso();
  await ctx.finalVideoVersions.update(video.id, {
    download_count: (video.download_count ?? 0) + 1,
    last_downloaded_at: now,
    updated_at: now,
  });
}
