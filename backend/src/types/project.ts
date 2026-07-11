/** AI 漫剧项目的主档案，负责串起剧本、分镜、资产、剪辑和交付物。 */
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

/** 项目任务在制作流程中的状态列。 */
export type ProjectTaskStatus = "todo" | "script" | "storyboard" | "image" | "video" | "review" | "done";

/** 工作台任务，用来跟踪某个制作动作的负责人、状态和截止日期。 */
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

/** 项目团队成员，包括导演、编剧、出图、剪辑、审核等角色。 */
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

/** 剧集计划，用来管理每一集的进度、概要和交付时间。 */
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

/** 项目问题单，记录制作过程中需要修复或确认的事项。 */
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

/** 项目里程碑，用于把制作周期拆成可检查的阶段节点。 */
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

export type ProjectClipStatus = "todo" | "editing" | "review" | "done";

/** 剪辑片段，表示最终剪辑清单中的一个可排序视频段。 */
export interface ProjectClip {
  id: string;
  project_id: string;
  storyboard_id: string;
  episode: number;
  scene: string;
  shot: string;
  /** 名称（用于卡片显示 / 搜索 / 5秒撤销）。 */
  name: string;
  title: string;
  /** 描述（剪辑师备注 / 备注）。 */
  description: string;
  source_video_url: string;
  /** 缩略图（用于内嵌播放器前的占位）。 */
  thumbnail_url: string;
  duration: number;
  in_point: string;
  out_point: string;
  order_index: number;
  status: ProjectClipStatus;
  tags: string[];
  notes: string;
  /** 资产被引用次数（缓存字段）。 */
  usage_count?: number;
  /** 当前版本号，每次 update 自增，初值为 1。 */
  version?: number;
  created_at: string;
  updated_at: string;
  /** 软删除时间戳。 */
  deleted_at?: string;
}

/** 发布计划状态 */
export type PublishPlanStatus = "draft" | "scheduled" | "publishing" | "published" | "failed" | "cancelled";

/** 发布平台类型 */
export type PublishPlatform = "youtube" | "bilibili" | "douyin" | "tiktok" | "kuaishou" | "xiaohongshu" | "weibo" | "wechat" | "custom";

/** 发布计划，用于管理成片的发布安排 */
export interface PublishPlan {
  /** 计划唯一标识 */
  id: string;
  /** 计划名称 */
  name: string;
  /** 计划状态 */
  status: PublishPlanStatus;
  /** 计划发布时间 */
  plannedDate: string;
  /** 实际发布时间 */
  publishedDate: string;
  /** 关联的成片ID列表 */
  videos: string[];
  /** 目标发布平台列表 */
  platforms: PublishPlatform[];
  /** 负责人 */
  assignee: string;
  /** 发布说明 */
  notes: string;
  /** 创建时间 */
  created_at: string;
  /** 更新时间 */
  updated_at: string;
}

/** 成片信息，从已完成的视频任务中提取 */
export interface PublishedVideo {
  /** 成片唯一标识（来自VideoTask.id） */
  id: string;
  /** 成片名称（来自prompt或自定义） */
  name: string;
  /** 所属项目ID */
  projectId: string;
  /** 视频时长（秒） */
  duration: number;
  /** 创建时间 */
  createdAt: string;
  /** 发布状态：未发布/已安排/已发布 */
  publishStatus: "unpublished" | "scheduled" | "published";
  /** 发布平台列表 */
  publishPlatforms: PublishPlatform[];
  /** 视频URL */
  videoUrl: string;
  /** 提示词 */
  prompt: string;
}

// ==================== 驾驶舱类型 ====================

/** 驾驶舱KPI数据 */
export interface DashboardKPI {
  /** 进行中项目数 */
  activeProjects: number;
  /** 今日生成图片数 */
  todayImages: number;
  /** 今日生成视频数 */
  todayVideos: number;
  /** 运行中AI任务数 */
  runningAITasks: number;
  /** 待审核任务数 */
  pendingReviews: number;
  /** GPU利用率 */
  gpuUtilization: number;
  /** 今日AI费用（元） */
  todayCost: number;
  /** AI任务成功率 */
  successRate: number;
}

/** 流水线阶段状态 */
export type PipelineStageStatus = 'completed' | 'running' | 'waiting' | 'failed';

/** 流水线阶段 */
export interface PipelineStage {
  name: string;
  status: PipelineStageStatus;
  progress: number;
  count?: number;
}

/** AI生产流水线数据 */
export interface ProductionPipeline {
  stages: PipelineStage[];
}

/** 项目进度信息 */
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

/** AI任务监控项 */
export interface AITaskMonitor {
  id: string;
  type: 'image' | 'video' | 'voiceover';
  title: string;
  model: string;
  status: 'running' | 'waiting' | 'paused';
  progress: number;
  remainingTime?: string;
}

/** 待审核中心数据 */
export interface ReviewCenterData {
  images: number;
  videos: number;
  scripts: number;
  storyboards: number;
}

/** AI资源监控数据 */
export interface ResourceMonitorData {
  gpuUsage: number;
  cpuUsage: number;
  queueLength: number;
  workerCount: number;
}

/** AI成本明细 */
export interface CostBreakdown {
  gpt: number;
  claude: number;
  images: number;
  videos: number;
  total: number;
}

/** 最近生成项 */
export interface RecentGeneration {
  id: string;
  title: string;
  type: 'character' | 'video' | 'voiceover';
  status: 'success' | 'failed';
  createdAt: string;
}

/** 团队动态项 */
export interface TeamActivity {
  id: string;
  user: string;
  action: string;
  target: string;
  createdAt: string;
}

/** 生产健康度数据 */
export interface ProductionHealth {
  overallScore: number;
  imageConsistency: number;
  characterConsistency: number;
  failRate: number;
  avgDuration: number;
}

/** 驾驶舱完整数据 */
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
