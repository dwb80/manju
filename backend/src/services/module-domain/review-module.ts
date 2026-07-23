/**
 * @file review-module.ts
 * @description 审核模块旧 CRUD 服务（V2.1 DDD 改造后已冻结）。
 *
 * ## 模型统一（迭代计划 §6.6）
 *  - `review_items` 为本迭代权威审核聚合存储，由 ReviewAggregate 独占状态写入。
 *  - 旧 `reviews` 表冻结为只读兼容层：本文件只保留读路径（listReviews），
 *    写路径（createReview / updateReview / deleteReview）改为抛出弃用错误，
 *    指引调用方改用 reviewService（基于 ReviewAggregate）。
 *  - 不允许两个审核模型继续分别维护同一业务事实。
 *
 * 调用方迁移指引：
 *  - 创建审核 → ctx.reviewService.submit(...)
 *  - 通过 / 驳回 / 取消 / 关闭 / 重新提交 → ctx.reviewService.{approve|reject|...}
 *  - 列表 / 统计 → ctx.reviewService.{listByStatus|stats}
 */

import type { AppContext } from "../app.js";
import type { Review } from "../../types/review.js";

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
 * listReviews - 列出项目中的审核记录（只读，兼容旧 reviews 表）。
 * @param {AppContext} ctx - 应用上下文
 * @param {string} projectId - 可选的项目 ID 过滤条件
 * @returns {Promise<Review[]>} 审核记录列表
 */
export async function listReviews(ctx: AppContext, projectId?: string): Promise<Review[]> {
  const filter: Partial<Review> = projectId ? { project_id: projectId } : {};
  return ctx.reviews.findMany(filter, { sort: "desc" });
}

/**
 * @deprecated 已冻结。审核写入由 ReviewAggregate 独占，请改用 ctx.reviewService.submit。
 * 旧 reviews 表不再接受直接写入，避免与 review_items 权威模型分叉。
 */
export async function createReview(_ctx: AppContext, _input: ReviewInput): Promise<Review> {
  throw new Error(
    "review_module_frozen: createReview 已弃用，请改用 ctx.reviewService.submit（基于 ReviewAggregate）",
  );
}

/**
 * @deprecated 已冻结。审核状态只能通过 ReviewAggregate 行为修改，
 * 请改用 ctx.reviewService.{approve|reject|startReview|close|cancel|resubmit}。
 */
export async function updateReview(
  _ctx: AppContext,
  reviewId: string,
  _input: ReviewInput,
): Promise<Review> {
  throw new Error(
    `review_module_frozen: updateReview(${reviewId}) 已弃用，审核状态由 ReviewAggregate 独占`,
  );
}

/**
 * @deprecated 已冻结。审核记录删除不在本迭代范围；如需终止审核请使用
 * ctx.reviewService.cancel（pending → cancelled）或 ctx.reviewService.close（终态化）。
 */
export async function deleteReview(_ctx: AppContext, reviewId: string): Promise<void> {
  throw new Error(
    `review_module_frozen: deleteReview(${reviewId}) 已弃用，请改用 cancel/close 终态化审核`,
  );
}
