export type Mode = "chat" | "image" | "video" | "favorites" | "project";
export type Status = "pending" | "processing" | "success" | "failed";

export interface Conversation {
  id: string;
  title: string;
  is_pinned: boolean;
  project_id: string;
}

export interface Project {
  id: string;
  name: string;
  category: string;
  status: string;
  description: string;
  episode_count: number;
  owner: string;
  due_date: string;
  is_default: boolean;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
  storage_path: string;
  storage_mode: string;
  archived_at: string;
}

export interface ProjectSummary {
  project: Project;
  conversations: number;
  members: number;
  episodes: number;
  issues: number;
  open_issues: number;
  milestones: number;
  open_milestones: number;
  tasks: number;
  completed_tasks: number;
  images: number;
  videos: number;
  storyboards?: number;
  completed_images: number;
  completed_videos: number;
  latest_activity_at: string;
}

export type ProjectTaskStatus = "todo" | "script" | "storyboard" | "image" | "video" | "review" | "done";

export interface ProjectTask {
  id: string;
  project_id: string;
  title: string;
  status: ProjectTaskStatus;
  owner: string;
  due_date: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectMember {
  id: string;
  project_id: string;
  name: string;
  role: string;
  contact: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectEpisode {
  id: string;
  project_id: string;
  episode: number;
  title: string;
  status: string;
  summary: string;
  due_date: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export type ProjectIssueStatus = "open" | "doing" | "resolved" | "closed";
export type ProjectIssueSeverity = "low" | "medium" | "high" | "critical";

export interface ProjectIssue {
  id: string;
  project_id: string;
  title: string;
  severity: ProjectIssueSeverity;
  status: ProjectIssueStatus;
  owner: string;
  target_type: string;
  target_id: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export type ProjectMilestoneStatus = "planned" | "doing" | "done" | "delayed";

export interface ProjectMilestone {
  id: string;
  project_id: string;
  title: string;
  status: ProjectMilestoneStatus;
  owner: string;
  due_date: string;
  description: string;
  created_at: string;
  updated_at: string;
}

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

export interface ProjectReview {
  id: string;
  project_id: string;
  target_type: "storyboard" | "image" | "video" | "asset" | "clip";
  target_id: string;
  reviewer: string;
  status: "open" | "resolved" | "rejected";
  comment: string;
  created_at: string;
  updated_at: string;
}

export type ProjectClipStatus = "todo" | "editing" | "review" | "done";

export interface ProjectClip {
  id: string;
  project_id: string;
  storyboard_id: string;
  episode: number;
  scene: string;
  shot: string;
  title: string;
  source_video_url: string;
  duration: number;
  in_point: string;
  out_point: string;
  order_index: number;
  status: ProjectClipStatus;
  notes: string;
  created_at: string;
  updated_at: string;
}

export type ProjectStoryboardStatus = "draft" | "scripted" | "image" | "video" | "review" | "done";

export interface ProjectStoryboard {
  id: string;
  project_id: string;
  episode: number;
  scene: string;
  shot: string;
  title: string;
  description: string;
  dialogue: string;
  characters: string[];
  character_asset_ids: string[];
  location: string;
  scene_asset_id: string;
  shot_size: string;
  camera_move: string;
  duration: number;
  prompt: string;
  image_task_id: string;
  image_url: string;
  video_task_id: string;
  video_url: string;
  status: ProjectStoryboardStatus;
  notes: string;
  created_at: string;
  updated_at: string;
}

export type ProjectAssetKind = "image" | "video" | "character" | "prop" | "scene" | "style" | "prompt" | "project" | "storyboard";

/** 分镜表单草稿类型，characters 为字符串（逗号分隔），用于输入 */
export type StoryboardDraft = {
  episode: number;
  scene: string;
  shot: string;
  title: string;
  description: string;
  dialogue: string;
  characters: string;
  character_asset_ids: string[];
  location: string;
  scene_asset_id: string;
  shot_size: string;
  camera_move: string;
  duration: number;
  status: ProjectStoryboardStatus;
  prompt: string;
};

/** 剧本表单草稿类型 */
export type ScriptFormDraft = {
  episode: number;
  title: string;
  status: ProjectScript["status"];
  content: string;
  notes: string;
};

export interface ProjectAsset {
  id: string;
  project_id: string;
  kind: ProjectAssetKind;
  name: string;
  prompt: string;
  image_url: string;
  video_url: string;
  folder: string;
  tags: string[];
  is_favorite: boolean;
  resolution: string;
  duration: string;
  role_images: string[];
  role_traits: string[];
  style_keywords: string[];
  notes: string;
  created_at: string;
  updated_at: string;
}

export type AssetDraft = {
  name: string;
  prompt: string;
  image_url: string;
  video_url: string;
  folder: string;
  tags: string;
  resolution: string;
  duration: string;
  role_traits: string;
  style_keywords: string;
  notes: string;
};

export type ProjectFormMode = "create-managed" | "create-existing" | "edit";

export type ProjectFormDraft = {
  name: string;
  category: string;
  status: string;
  description: string;
  episode_count: number;
  owner: string;
  due_date: string;
  storage_path: string;
};

export type WorkbenchTab = "overview" | "members" | "episodes" | "issues" | "milestones" | "scripts" | "storyboards" | "clips" | "reviews" | "tasks" | "assets" | "exports";

export type WorkbenchPage = {
  key: WorkbenchTab;
  label: string;
  description?: string;
  metric: string;
};

export type WorkbenchStatusOption = {
  key: string;
  label: string;
};

export interface MessageAttachment {
  name: string;
  size: number;
  url: string;
}

export interface ChatToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  created_at?: string;
  meta?: {
    attachments?: MessageAttachment[];
    /** AI 思考过程，Agnes thinking 模式返回。 */
    reasoning?: string;
    /** 工具调用结果。 */
    tool_calls?: ChatToolCall[];
    /** 使用的模型名称。 */
    model?: string;
    /** Token 消耗估算。 */
    tokens?: number;
  };
}

export interface ChatSettings {
  model: string;
  temperature: number;
  top_p: number;
  max_tokens?: number;
  enableThinking: boolean;
}

export interface ImageTask {
  id: string;
  conversation_id: string;
  prompt: string;
  image_urls: string[];
  status: Status;
  error: string;
  created_at: string;
}

export interface VideoTask {
  id: string;
  task_id: string;
  video_id: string;
  conversation_id: string;
  prompt: string;
  image_url: string;
  params: Record<string, unknown>;
  video_url: string;
  status: Status;
  progress: number;
  seconds: string;
  size: string;
  error: string;
  created_at: string;
}

export interface Favorite {
  id: string;
  type: "chat" | "image" | "video";
  ref_id: string;
  created_at: string;
}

export interface FavoriteView {
  favorite: Favorite;
  image?: ImageTask;
  video?: VideoTask;
}

export interface Attachment {
  id: string;
  name: string;
  size: number;
  url: string;
  previewUrl: string;
  status: "uploading" | "success" | "failed";
  error?: string;
}

export interface ImageRequest {
  id: string;
  conversationId: string;
  prompt: string;
  attachments: Attachment[];
  status: "generating" | "success" | "failed";
  task?: ImageTask;
  error?: string;
}

export interface PromptEnhancement {
  prompt: string;
  enhanced: string;
  mode: "image" | "video";
}

export type ImageRatio = "1:1" | "2:3" | "3:2" | "3:4" | "4:3" | "9:16" | "16:9";
export type ImageSize = "1024x768" | "768x1024" | "1024x1024" | "1152x768" | "768x1152" | "1152x1728" | "1728x1152";
export type ImageResponseFormat = "url" | "b64_json";
/** 图片生成模型（与后端 ImageModel 保持一致）。 */
export type ImageModel = "agnes-image-2.1-flash";

export type ImageSettings = {
  model: ImageModel;
  ratio: ImageRatio;
  size: ImageSize;
  n: number;
  seed: string;
  negative_prompt: string;
  response_format: ImageResponseFormat;
  style: string;
};

/** 图片比例选项（前端 UI 选择器用）。 */
export type AspectRatioOption = {
  value: ImageRatio;
  label: string;
  useCase: string;
  size: ImageSize;
};

/** 风格修饰 value（"" 表示不追加；其余追加到 prompt 末尾）。 */
export type StyleValue =
  | ""
  | "portrait_photo"
  | "cinematic"
  | "chinese_style"
  | "anime"
  | "3d_render"
  | "cyberpunk"
  | "cg_animation"
  | "ink_painting"
  | "oil_painting"
  | "classical"
  | "watercolor"
  | "cartoon";

/** 风格选择器项（前端 UI 用）。 */
export type StyleOption = {
  value: StyleValue;
  label: string;
  emoji: string;
  promptSuffix: string;
};

export type VideoRatio = "16:9" | "9:16" | "1:1" | "4:3" | "3:4";
export type VideoMode = "ti2vid" | "keyframes";

export type VideoSettings = {
  ratio: VideoRatio;
  mode: VideoMode;
  width: number;
  height: number;
  num_frames: number;
  frame_rate: number;
  num_inference_steps?: number;
  seed: string;
  negative_prompt: string;
};

export type ProjectHealth = {
  score: number;
  label: string;
  tone: string;
  items: string[];
};

export interface UploadedFile {
  url: string;
  name: string;
  size: number;
  type: string;
}

// ==================== 驾驶舱类型 ====================

export interface DashboardKPI {
  activeProjects: number;
  todayImages: number;
  todayVideos: number;
  runningAITasks: number;
  pendingReviews: number;
  gpuUtilization: number;
  todayCost: number;
  successRate: number;
}

export type PipelineStageStatus = 'completed' | 'running' | 'waiting' | 'failed';

export interface PipelineStage {
  name: string;
  status: PipelineStageStatus;
  progress: number;
  count?: number;
}

export interface ProductionPipeline {
  stages: PipelineStage[];
}

export interface ProjectProgress {
  id: string;
  name: string;
  coverImage?: string;
  currentEpisode: number;
  currentScene: string;
  currentShot: string;
  currentStage: string;
  totalProgress: number;
  aiStatus: 'idle' | 'generating' | 'reviewing' | 'failed';
}

export interface AITaskMonitor {
  id: string;
  type: 'image' | 'video' | 'voiceover';
  title: string;
  model: string;
  status: 'running' | 'waiting' | 'paused';
  progress: number;
  remainingTime?: string;
}

export interface ReviewCenterData {
  images: number;
  videos: number;
  scripts: number;
  storyboards: number;
}

export interface ResourceMonitorData {
  gpuUsage: number;
  cpuUsage: number;
  queueLength: number;
  workerCount: number;
  telemetryAvailable?: boolean;
}

export interface CostBreakdown {
  gpt: number;
  claude: number;
  images: number;
  videos: number;
  total: number;
}

export interface RecentGeneration {
  id: string;
  title: string;
  type: 'character' | 'video' | 'voiceover';
  status: 'success' | 'failed';
  createdAt: string;
}

export interface TeamActivity {
  id: string;
  user: string;
  action: string;
  target: string;
  createdAt: string;
}

export interface ProductionHealth {
  overallScore: number;
  imageConsistency: number;
  characterConsistency: number;
  failRate: number;
  avgDuration: number;
}

export interface DashboardData {
  kpi: DashboardKPI;
  myProjects: ProjectProgress[];
  pipeline: ProductionPipeline;
  aiTasks: AITaskMonitor[];
  reviewCenter: ReviewCenterData;
  resources: ResourceMonitorData;
  costs: CostBreakdown;
  recentGenerations: RecentGeneration[];
  teamActivities: TeamActivity[];
  health: ProductionHealth;
}
