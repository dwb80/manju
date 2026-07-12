/** 内容状态枚举（兼容独立 Script 与项目 ProjectScript 两套状态值）。 */
export type ContentStatus = 'draft' | 'active' | 'review' | 'completed' | 'archived' | 'ready' | 'storyboarded';

/** 剧本实体（独立模块） */
export interface Script {
  id: string;
  project_id: string;
  title: string;
  description: string;
  status: ContentStatus;
  words: number;
  chapters: number;
  author: string;
  tags: string[];
  version: number;
  created_at: string;
  updated_at: string;
  // 兼容 ProjectScript 字段（SQLite 存储共用同一张表 scripts）。
  episode?: number;
  content?: string;
  notes?: string;
}

/** 剧本文档，一般按集数保存，后续可拆成分镜。 */
export interface ProjectScript {
  id: string;
  project_id: string;
  episode: number;
  title: string;
  content: string;
  status: "draft" | "ready" | "storyboarded" | "archived";
  notes: string;
  created_at: string;
  updated_at: string;
}

// ==================== 剧本中心类型定义 ====================

/** 剧本文档（Editor JSON） */
export interface ScriptDocument {
  id: string;
  project_id: string;
  editor_json: string;  // Tiptap编辑器JSON
  version: number;
  created_at: string;
  updated_at: string;
}

/** 剧集 */
export interface ScriptEpisode {
  id: string;
  project_id: string;
  document_id: string;
  episode_no: number;
  title: string;
  synopsis: string;
  status: 'draft' | 'review' | 'approved' | 'production';
  created_at: string;
  updated_at: string;
}

/** 场景 */
export interface ScriptScene {
  id: string;
  project_id: string;
  episode_id: string;
  scene_no: number;
  location_name: string;
  time_of_day: 'day' | 'night' | 'dawn' | 'dusk';
  description: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

/** 对白 */
export interface ScriptDialogue {
  id: string;
  project_id: string;
  scene_id: string;
  character_id: string;  // 引用角色资产ID
  dialogue: string;
  emotion: string;
  order: number;
  created_at: string;
}

/** 场景-角色引用 */
export interface ScriptSceneCharacter {
  id: string;
  project_id: string;
  scene_id: string;
  character_asset_id: string;  // 引用角色资产ID
  role_type: 'main' | 'support' | 'guest';
  is_speaking: boolean;
  created_at: string;
}

/** 场景-地点引用 */
export interface ScriptSceneLocation {
  id: string;
  project_id: string;
  scene_id: string;
  location_asset_id: string;  // 引用场景资产ID
  created_at: string;
}

/** 剧本模板 */
export interface ScriptTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  world_setting: string;
  character_templates: Array<{
    name: string;
    role: string;
    description: string;
  }>;
  plot_structure: string;
  usage_count: number;
  rating: number;
  author: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

/** 剧本标签 */
export interface ScriptTag {
  id: string;
  project_id: string;
  script_id: string;
  name: string;
  category: 'type' | 'style' | 'status' | 'theme' | 'custom';
  color: string;
  created_by: string;
  created_at: string;
}

/** 剧本质量评估 */
export interface ScriptQualityAssessment {
  id: string;
  project_id: string;
  script_id: string;
  story_structure: number;
  character_development: number;
  dialogue_quality: number;
  pacing: number;
  consistency: number;
  originality: number;
  total_score: number;
  source: 'ai' | 'manual';
  suggestions: string[];
  assessed_by: string;
  assessed_at: string;
  created_at: string;
}

/** 剧本审批记录 */
export interface ScriptApproval {
  id: string;
  project_id: string;
  script_id: string;
  status: 'pending' | 'reviewing' | 'approved' | 'rejected';
  current_step: number;
  total_steps: number;
  applicants: string[];
  reviewers: string[];
  comments: Array<{
    step: number;
    reviewer: string;
    action: 'approve' | 'reject' | 'comment';
    comment: string;
    timestamp: string;
  }>;
  created_by: string;
  created_at: string;
  updated_at: string;
}

/** 剧本备份 */
export interface ScriptBackup {
  id: string;
  project_id: string;
  /** 关联的剧本文档 ID（用于按文档过滤版本历史） */
  document_id?: string;
  type: 'auto' | 'manual' | 'scheduled';
  size: number;
  content: {
    script_document: string;
    script_episodes?: any[];
    script_scenes?: any[];
    script_dialogues?: any[];
    version: number;
    /** 变更摘要（用于 /api/script-versions 列表展示） */
    changes?: string;
  };
  status: 'creating' | 'completed' | 'failed';
  created_by: string;
  created_at: string;
  expires_at: string;
}

/** 剧本评论（编辑器内行内批注与回复） */
export interface ScriptComment {
  id: string;
  script_id: string;        // 关联剧本文档 ID
  episode_id?: string;      // 可选，关联剧集
  user_name: string;        // 评论者
  content: string;          // 评论内容
  selected_text: string;    // 选中的文本
  position_from: number;    // 选区起点
  position_to: number;      // 选区终点
  parent_id?: string;       // 父评论 ID（用于回复）
  resolved: boolean;        // 是否已解决
  created_at: string;
  updated_at: string;
}

/** AI剧本生成请求 */
export interface AIScriptGenerationRequest {
  project_id?: string;
  prompt: string;
  style?: string;
  genre?: string;
  length?: number;
  characters?: string[];
  settings?: string[];
  reference_scripts?: string[];
}

/** AI剧本优化请求 */
export interface AIScriptOptimizationRequest {
  project_id?: string;
  script_id?: string;
  optimization_type?: 'grammar' | 'style' | 'dialogue' | 'structure' | 'pacing';
  target_sections?: string[];
  custom_instructions?: string;
  /** 纯文本模式：直接传入待优化文本，无需 script_id */
  content?: string;
}

/** AI场景生成请求 */
export interface AISceneGenerationRequest {
  project_id: string;
  episode_id: string;
  scene_description: string;
  characters?: string[];
  location?: string;
  mood?: string;
}

/** AI对白生成请求 */
export interface AIDialogueGenerationRequest {
  project_id: string;
  scene_id: string;
  character_id: string;
  context?: string;
  emotion?: string;
  style?: string;
}

/** AI分镜拆分请求 */
export interface AIStoryboardSplitRequest {
  project_id?: string;
  script_id?: string;
  split_strategy?: 'scene' | 'shot' | 'beat';
  detail_level?: 'basic' | 'standard' | 'detailed';
  /** 纯文本模式：直接传入待拆分文本，无需 script_id */
  content?: string;
}
