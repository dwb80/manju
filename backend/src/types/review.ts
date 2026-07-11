/** 审核结果 */
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
}

export type ProjectReviewStatus = "open" | "resolved" | "rejected";

/** 审核记录，关联到分镜、图片、视频、资产或剪辑片段。 */
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
