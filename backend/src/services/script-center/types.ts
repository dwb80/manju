/**
 * 剧本中心子模块共享类型定义
 *
 * 包含所有 CRUD 输入类型、解析后的剧集/场景/对白结构。
 */

export type ScriptDocumentInput = {
  id?: string;
  project_id?: string;
  // ===== 方案 A 合并：元数据 =====
  title?: string;
  author?: string;
  status?: string;
  genre?: string;
  words?: number;
  chapters?: number;
  // ===== 内容 =====
  editor_json?: string;
  version?: number;
  // ===== 剧本导入：完整 AI 原始数据 =====
  ai_raw_data?: string;
};

export type ScriptEpisodeInput = {
  project_id?: string;
  document_id?: string;
  episode_no?: number;
  title?: string;
  synopsis?: string;
  status?: string;
};

export type ScriptSceneInput = {
  project_id?: string;
  episode_id?: string;
  scene_no?: number;
  location_name?: string;
  time_of_day?: string;
  description?: string;
  notes?: string;
};

export type ScriptDialogueInput = {
  project_id?: string;
  scene_id?: string;
  character_id?: string;
  dialogue?: string;
  emotion?: string;
  order?: number;
};

export type ScriptSceneCharacterInput = {
  project_id?: string;
  scene_id?: string;
  character_asset_id?: string;
  role_type?: string;
  is_speaking?: boolean;
};

export type ScriptSceneLocationInput = {
  project_id?: string;
  scene_id?: string;
  location_asset_id?: string;
};

export type ScriptTemplateInput = {
  name?: string;
  category?: string;
  description?: string;
  world_setting?: string;
  character_templates?: Array<{ name: string; role: string; description: string }>;
  plot_structure?: string;
  usage_count?: number;
  rating?: number;
  author?: string;
  is_public?: boolean;
};

export type ScriptTagInput = {
  project_id?: string;
  script_id?: string;
  name?: string;
  category?: string;
  color?: string;
  created_by?: string;
};

export type ScriptQualityAssessmentInput = {
  project_id?: string;
  script_id?: string;
  story_structure?: number;
  character_development?: number;
  dialogue_quality?: number;
  pacing?: number;
  consistency?: number;
  originality?: number;
  total_score?: number;
  source?: string;
  suggestions?: string[];
  assessed_by?: string;
};

export type ScriptApprovalInput = {
  project_id?: string;
  script_id?: string;
  status?: string;
  current_step?: number;
  total_steps?: number;
  applicants?: string[];
  reviewers?: string[];
  comments?: Array<{
    step: number;
    reviewer: string;
    action: "approve" | "reject" | "comment";
    comment: string;
    timestamp: string;
  }>;
  created_by?: string;
};

export type ScriptCommentInput = {
  script_id?: string;
  episode_id?: string;
  user_name?: string;
  content?: string;
  selected_text?: string;
  position_from?: number;
  position_to?: number;
  parent_id?: string;
  resolved?: boolean;
};

/** 解析后的剧集结构（含场景和对白） */
export interface ParsedEpisode {
  episode_no: number;
  title: string;
  synopsis: string;
  status: string;
  scenes: ParsedScene[];
}

export interface ParsedScene {
  scene_no: number;
  location_name: string;
  time_of_day: "day" | "night" | "dawn" | "dusk";
  description: string;
  notes: string;
  dialogues: ParsedDialogue[];
}

export interface ParsedDialogue {
  character: string;
  text: string;
  emotion: string;
  order: number;
}
