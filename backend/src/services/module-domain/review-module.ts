/**
 * @file review-module.ts
 * @description 审核模块的增删查改服务，提供内容审核记录的创建、查询、更新、删除等功能
 */

import type { AppContext } from "../app.js";
import type { Review } from "../../types/review.js";
import { id, nowIso } from "../../utils.js";

export type ReviewInput = {
  project_id?: string;
  content_type?: string;
  content_id?: string;
  content_title?: string;
  result?: string;
  score?: number;
  comment?: string;
  reviewer_id?: string;
  reviewer_name?: string;
};

/**
 * listReviews - 列出项目中的审核记录
 * @param {AppContext} ctx - 应用上下文
 * @param {string} projectId - 可选的项目 ID 过滤条件
 * @returns {Promise<Review[]>} 审核记录列表
 */
export async function listReviews(ctx: AppContext, projectId?: string): Promise<Review[]> {
  const filter: Partial<Review> = projectId ? { project_id: projectId } : {};
  return ctx.reviews.findMany(filter, { sort: "desc" });
}

/**
 * createReview - 创建新审核记录
 * @param {AppContext} ctx - 应用上下文
 * @param {ReviewInput} input - 审核输入数据
 * @returns {Promise<Review>} 创建的审核记录对象
 */
export async function createReview(ctx: AppContext, input: ReviewInput): Promise<Review> {
  const review: Review = {
    id: id("review"),
    project_id: input.project_id ?? "",
    content_type: (input.content_type as Review["content_type"]) ?? "image",
    content_id: input.content_id ?? "",
    content_title: input.content_title ?? "",
    result: (input.result as Review["result"]) ?? "pending",
    score: input.score,
    comment: input.comment,
    reviewer_id: input.reviewer_id ?? "",
    reviewer_name: input.reviewer_name ?? "",
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  await ctx.reviews.insert(review);
  return review;
}

export async function updateReview(ctx: AppContext, reviewId: string, input: ReviewInput): Promise<Review> {
  const existing = await ctx.reviews.findById(reviewId);
  if (!existing) throw new Error("审核不存在");
  const patch: Partial<Review> = {
    ...input,
    content_type: input.content_type ? (input.content_type as Review["content_type"]) : undefined,
    result: input.result ? (input.result as Review["result"]) : undefined,
    updated_at: nowIso(),
  };
  await ctx.reviews.update(reviewId, patch);
  return { ...existing, ...patch } as Review;
}

/**
 * deleteReview - 删除指定审核记录
 * @param {AppContext} ctx - 应用上下文
 * @param {string} reviewId - 审核记录 ID
 * @returns {Promise<void>}
 */
export async function deleteReview(ctx: AppContext, reviewId: string): Promise<void> {
  await ctx.reviews.delete(reviewId);
}
