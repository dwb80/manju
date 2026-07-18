/**
 * @file review.ts
 * @description 审核相关类型定义，包括审核实体、审核结果、项目审核等
 */

/**
 * 审核结果类型
 * @property approved - 已通过
 * @property rejected - 已拒绝
 * @property pending - 待审核
 */
export type ReviewResult = 'approved' | 'rejected' | 'pending';

/** 审核实体（独立模块） */
export interface Review {
  id: string;
  project_id: string;
  content_type: 'image' | 'video' | 'audio' | 'script';
  content_id: string;
  content_title: string;
  result: ReviewResult;
  score?: number;
  comment?: string;
  reviewer_id: string;
  reviewer_name: string;
  created_at: string;
  updated_at: string;
  // 兼容 ProjectReview 字段（SQLite 存储共用同一张表 reviews）。
  target_type?: "storyboard" | "image" | "video" | "asset" | "clip";
  target_id?: string;
  reviewer?: string;
  status?: ProjectReviewStatus;
}

export type ProjectReviewStatus = "open" | "resolved" | "rejected";

/**
 * 项目审核记录实体，关联到分镜、图片、视频、资产或剪辑片段
 */
export interface ProjectReview {
  id: string;
  project_id: string;
  target_type: "storyboard" | "image" | "video" | "asset" | "clip";
  target_id: string;
  reviewer: string;
  status: ProjectReviewStatus;
  comment: string;
  created_at: string;
  updated_at: string;
}
