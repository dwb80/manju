/**
 * @file review.ts
 * @description 审核服务模块 - 管理项目审核意见的创建、更新和删除，用于制作流程中的质量控制
 */

import type { AppContext } from "../app.js";
import type { ProjectReview, ProjectReviewStatus } from "../../types.js";
import { id, nowIso, requireString } from "../../utils.js";

const projectReviewStatuses: ProjectReviewStatus[] = ["open", "resolved", "rejected"];

type ProjectReviewInput = {
  target_type?: string;
  target_id?: string;
  reviewer?: string;
  status?: string;
  comment?: string;
};

/** 把审核状态规整到待处理、已解决或驳回。 */
function normalizeProjectReviewStatus(status: unknown): ProjectReviewStatus {
  return projectReviewStatuses.includes(status as ProjectReviewStatus) ? status as ProjectReviewStatus : "open";
}

/**
 * listProjectReviews - 列出项目审核意见
 * @param {AppContext} ctx - 应用上下文
 * @param {string} projectId - 项目ID
 * @param {Object} filters - 筛选条件
 * @returns {Promise<ProjectReview[]>} 审核意见列表
 * @description 可按目标类型和目标ID过滤
 */
export async function listProjectReviews(ctx: AppContext, projectId: string, filters: { target_type?: string | null; target_id?: string | null } = {}): Promise<ProjectReview[]> {
  if (!await ctx.projects.findById(projectId)) throw new Error("project not found");
  const filter: Partial<ProjectReview> = { project_id: projectId };
  if (filters.target_type) filter.target_type = filters.target_type as ProjectReview["target_type"];
  if (filters.target_id) filter.target_id = filters.target_id;
  return ctx.projectReviews.findMany(filter, { sort: "asc" });
}

/**
 * createProjectReview - 新增审核意见
 * @param {AppContext} ctx - 应用上下文
 * @param {string} projectId - 项目ID
 * @param {ProjectReviewInput} input - 审核意见输入参数
 * @returns {Promise<ProjectReview>} 创建的审核意见
 * @description 通常绑定到某条分镜
 */
export async function createProjectReview(ctx: AppContext, projectId: string, input: ProjectReviewInput): Promise<ProjectReview> {
  if (!await ctx.projects.findById(projectId)) throw new Error("project not found");
  const now = nowIso();
  const targetType = ["storyboard", "image", "video", "asset", "clip"].includes(input.target_type ?? "") ? input.target_type as ProjectReview["target_type"] : "storyboard";
  const targetId = requireString(input.target_id, "target_id");
  const review: ProjectReview = {
    id: id("prv"),
    project_id: projectId,
    target_type: targetType,
    target_id: targetId,
    reviewer: input.reviewer?.trim() || "审核人",
    status: normalizeProjectReviewStatus(input.status),
    comment: requireString(input.comment, "comment").trim(),
    created_at: now,
    updated_at: now,
  };
  await ctx.projectReviews.insert(review);
  return review;
}

/**
 * updateProjectReview - 更新审核意见
 * @param {AppContext} ctx - 应用上下文
 * @param {string} projectId - 项目ID
 * @param {string} reviewId - 审核意见ID
 * @param {ProjectReviewInput} patch - 更新字段
 * @returns {Promise<ProjectReview>} 更新后的审核意见
 * @description 更新审核意见状态、审核人或内容
 */
export async function updateProjectReview(ctx: AppContext, projectId: string, reviewId: string, patch: ProjectReviewInput): Promise<ProjectReview> {
  const existing = await ctx.projectReviews.findById(reviewId);
  if (!existing || existing.project_id !== projectId) throw new Error("project review not found");
  const next: Partial<ProjectReview> = { updated_at: nowIso() };
  if (typeof patch.reviewer === "string") next.reviewer = patch.reviewer.trim() || existing.reviewer;
  if (typeof patch.status === "string") next.status = normalizeProjectReviewStatus(patch.status);
  if (typeof patch.comment === "string") next.comment = patch.comment.trim();
  await ctx.projectReviews.update(reviewId, next);
  return (await ctx.projectReviews.findById(reviewId)) as ProjectReview;
}

/**
 * deleteProjectReview - 删除审核意见
 * @param {AppContext} ctx - 应用上下文
 * @param {string} projectId - 项目ID
 * @param {string} reviewId - 审核意见ID
 * @returns {Promise<void>}
 */
export async function deleteProjectReview(ctx: AppContext, projectId: string, reviewId: string): Promise<void> {
  const existing = await ctx.projectReviews.findById(reviewId);
  if (!existing || existing.project_id !== projectId) throw new Error("project review not found");
  await ctx.projectReviews.delete(reviewId);
}
