/**
 * @file script.ts
 * @description 剧本相关类型定义，包括剧本文档、剧集、场景、对白、AI生成请求等
 */

/**
 * 内容状态枚举（兼容独立 Script 与项目 ProjectScript 两套状态值）
 * @property draft - 草稿
 * @property active - 活跃
 * @property review - 审核中
 * @property completed - 已完成
 * @property archived - 已归档
 * @property ready - 就绪
 * @property storyboarded - 已分镜
 */
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
  /** 软删时间戳（ISO 8601）。存在即视为已软删；硬删（purge）必须 ≥ 30 天。 */
  deleted_at?: string;
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
  deleted_at?: string;
}

// ==================== 剧本中心类型定义 ====================

/** 剧本文档（Editor JSON） */
export interface ScriptDocument {
  id: string;
  project_id: string;
  // ===== 方案 A 合并（Path A → Path B）：元数据并入 document =====
  /** 剧本标题（来自原 scripts.title）。 */
  title: string;
  /** 作者（来自原 scripts.author）。 */
  author: string;
  /** 剧本状态：draft | active | review | completed | archived。 */
  status: 'draft' | 'active' | 'review' | 'completed' | 'archived' | string;
  /** 剧本类型/题材：ancient | modern | scifi | fantasy | suspense | comedy | romance | 其他。 */
  genre: string;
  /** 字数（从 editor_json 自动计算，可手填覆盖）。 */
  words: number;
  /** 章节/剧集数（从 script_episodes 自动计算，可手填覆盖）。 */
  chapters: number;
  // ===== 原有内容字段 =====
  editor_json: string;  // Tiptap编辑器JSON
  version: number;
  created_at: string;
  updated_at: string;
  /** 标签（来自原 scripts.tags）。 */
  tags?: string[];
  /** 软删除时间戳；为空字符串或 undefined 时表示正常。 */
  deleted_at?: string;
  /**
   * 完整 AI 原始数据（JSON 字符串）。
   * 仅剧本导入流程会写入：保留后端 AI 剧本分析接口的完整原始返回，
   * 不丢失任何字段（包括未在前端预览展示的）。
   * 不写入任何工厂。
   */
  ai_raw_data?: string;
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
  updated_at: string;
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

/** 剧本分析提取的角色（与 script_documents 一对多）
 *
 * 字段设计与 Character 表保持一致，确保从剧本分析流转到角色工厂时
 * 所有 AI 分析扩展字段不丢失。
 */
export interface ScriptAnalyzedCharacter {
  id: string;
  document_id: string;
  project_id: string;
  name: string;
  role: string;
  gender: string;
  age: string;
  description: string;
  appearance: string;
  personality: string;
  traits: string[];
  /** 工厂标签，与 factory Character.tags 对齐 */
  tags?: string[];
  /** 流转到角色工厂后的资产 ID */
  factory_character_id?: string;
  /** 状态：extracted=已提取, confirmed=已确认, transferred=已流转 */
  status: "extracted" | "confirmed" | "transferred";
  created_at: string;
  updated_at: string;

  // === AI 剧本分析扩展字段（与 Character 表对齐） ===
  /** 角色身份，如 剑客、公主、侦探 */
  identity?: string;
  /** 面部特征 */
  face?: string;
  /** 发型、发色、长度 */
  hair?: string;
  /** 身材体型 */
  body?: string;
  /** 气质，如 优雅、粗犷、冷峻 */
  temperament?: string;
  /** 服装名称 */
  costume_name?: string;
  /** 服装详细描述 */
  costume_description?: string;
  /** 服装主色调 */
  costume_color?: string;
  /** 服装材质 */
  costume_material?: string;
  /** 服装风格 */
  costume_style?: string;
  /** 配饰列表，如 玉佩、耳环、腰带 */
  accessories?: string[];
  /** 情绪状态 JSON 数组字符串 */
  emotion_states?: string;
  /** 动作资产 JSON 数组字符串 */
  action_assets?: string;
  /** 人物关系 JSON 数组字符串 */
  relationships?: string;
  /** 首次出现场次，如 EP01-Scene01 */
  first_appearance?: string;
  /** 对白数量 */
  dialogue_count?: number;
  /** AI 生图标准化提示词 */
  generation_prompt?: string;
  /** 推断可信度：confirmed / inferred */
  confidence?: string;
}

/** 剧本分析提取的场景（与 script_documents 一对多）
 *
 * 字段设计与 Scene 表保持一致（type 替代 scene_type），
 * 确保从剧本分析流转到场景工厂时所有 AI 分析扩展字段不丢失。
 */
export interface ScriptAnalyzedScene {
  id: string;
  document_id: string;
  project_id: string;
  name: string;
  /** 场景类型：indoor / outdoor / virtual —— 与 factory Scene.type 字段名一致 */
  type?: string;
  /** 兼容旧字段：保留以读取历史数据；新写入请用 type */
  scene_type?: string;
  description: string;
  lighting: string;
  time_of_day: string;
  weather: string;
  /** 工厂标签（与 factory Scene.tags 对齐） */
  tags?: string[];
  /** 流转到场景工厂后的资产 ID */
  factory_scene_id?: string;
  status: "extracted" | "confirmed" | "transferred";
  created_at: string;
  updated_at: string;

  // === AI 剧本分析扩展字段（与 Scene 表对齐） ===
  /** 场景分类，如 古代建筑/现代都市/自然景观 */
  category?: string;
  /** 室内/室外/混合 */
  indoor_outdoor?: string;
  /** 具体地点描述 */
  location?: string;
  /** 建筑结构 */
  architecture?: string;
  /** 地形特征 */
  terrain?: string;
  /** 植物元素 */
  plants?: string;
  /** 场景中固定物件 */
  objects?: string;
  /** 时间段 */
  period?: string;
  /** 整体色调 */
  tone?: string;
  /** 视觉风格 */
  visual_style?: string;
  /** 情感氛围 */
  atmosphere_emotion?: string;
  /** 适合镜头 JSON 数组字符串 */
  suitable_shots?: string;
  /** 可复用元素 JSON 数组字符串 */
  reusable_elements?: string;
  /** AI 生图标准化提示词 */
  generation_prompt?: string;
  /** 首次出现场次，如 EP01-Scene01 */
  first_appearance?: string;
  /** 推断可信度：confirmed / inferred */
  confidence?: string;
}

/** 剧本分析提取的道具（与 script_documents 一对多）
 *
 * 字段设计与 Prop 表保持一致（补 appearance / size），
 * 确保从剧本分析流转到道具工厂时所有 AI 分析扩展字段不丢失。
 */
export interface ScriptAnalyzedProp {
  id: string;
  document_id: string;
  project_id: string;
  name: string;
  category: string;
  description: string;
  /** 外观造型描述（与 Prop.appearance 对齐） */
  appearance?: string;
  material: string;
  /** 尺寸（与 Prop.size 对齐） */
  size?: string;
  color: string;
  /** 工厂标签（与 factory Prop.tags 对齐） */
  tags?: string[];
  /** 流转到道具工厂后的资产 ID */
  factory_prop_id?: string;
  status: "extracted" | "confirmed" | "transferred";
  created_at: string;
  updated_at: string;

  // === AI 剧本分析扩展字段（与 Prop 表对齐） ===
  /** 道具重要性级别：核心道具/普通道具/背景道具 */
  importance_level?: string;
  /** 归属角色名 */
  owner?: string;
  /** 形状/形态 */
  shape?: string;
  /** 表面质感 */
  texture?: string;
  /** 剧情作用 */
  story_function?: string;
  /** 视觉特征 JSON 数组字符串 */
  visual_features?: string;
  /** 镜头用法 JSON 数组字符串 */
  camera_usage?: string;
  /** AI 生图标准化提示词 */
  generation_prompt?: string;
  /** 首次出现场次，如 EP01-Scene01 */
  first_appearance?: string;
  /** 推断可信度：confirmed / inferred */
  confidence?: string;
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
