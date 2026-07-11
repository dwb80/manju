/**
 * 该文件汇总 types.ts 等位置缺失的占位类型，目的是让 legacy 模块在 `strict` 模式下通过编译。
 * 字段保留最简形式，仅保证不报错，不影响运行时。
 */

export type AITaskMonitor = {
  id: string;
  type: 'image' | 'video' | 'voiceover' | 'audio' | 'script';
  title: string;
  model: string;
  status: 'running' | 'waiting' | 'paused' | 'success' | 'failed' | string;
  progress: number;
  remainingTime?: string;
  created_at: string;
  project_id: string;
};

export type CostBreakdown = {
  gpt?: number;
  claude?: number;
  images?: number;
  videos?: number;
  total?: number;
  date?: string;
  image_cost?: number;
  video_cost?: number;
  audio_cost?: number;
  chat_cost?: number;
  total_cost?: number;
};

export type DashboardData = {
  kpi: DashboardKPI;
  pipeline: ProductionPipeline;
  myProjects: ProjectProgress[];
  aiTasks: AITaskMonitor[];
  reviewCenter: ReviewCenterData;
  resources: ResourceMonitorData;
  costs: CostBreakdown;
  recentGenerations: RecentGeneration[];
  teamActivities: TeamActivity[];
  health: ProductionHealth;
  total_projects?: number;
  total_conversations?: number;
  total_images?: number;
  total_videos?: number;
  total_scripts?: number;
  today_images?: number;
  today_videos?: number;
  today_conversations?: number;
  active_projects?: number;
  recent_assets?: any[];
};

export type DashboardKPI = {
  activeProjects: number;
  todayImages: number;
  todayVideos: number;
  runningAITasks: number;
  pendingReviews: number;
  gpuUtilization: number;
  todayCost: number;
  successRate: number;
  label?: string;
  value?: number;
  delta?: number;
  trend?: 'up' | 'down' | 'flat';
};

export type ProductionHealth = {
  status?: 'healthy' | 'warning' | 'critical';
  issues?: string[];
  score?: number;
  last_check?: string;
  overallScore?: number;
  imageConsistency?: number;
  characterConsistency?: number;
  failRate?: number;
  avgDuration?: number;
};

export type ProductionPipeline = {
  stages: Array<{ name: string; status: string; progress: number; count?: number }>;
  stage?: string;
  count?: number;
};

export type ProjectProgress = {
  id: string;
  name: string;
  coverImage?: string;
  currentEpisode: number;
  currentScene: string;
  currentShot: string;
  currentStage: string;
  totalProgress: number;
  aiStatus: 'idle' | 'generating' | 'reviewing' | 'failed' | string;
  project_id?: string;
  total?: number;
  completed?: number;
  in_progress?: number;
  pending?: number;
  blocked?: number;
};

export type RecentGeneration = {
  id: string;
  title: string;
  type: 'character' | 'video' | 'voiceover' | string;
  status: 'success' | 'failed' | string;
  createdAt: string;
  created_at?: string;
  thumbnail_url?: string;
};

export type ResourceMonitorData = {
  gpuUsage: number;
  cpuUsage: number;
  queueLength: number;
  workerCount: number;
  cpu?: number;
  memory?: number;
  gpu?: number;
  disk?: number;
  active_tasks?: number;
  queue_length?: number;
};

export type ReviewCenterData = {
  images: number;
  videos: number;
  scripts: number;
  storyboards: number;
  pending?: number;
  approved?: number;
  rejected?: number;
  recent_reviews?: any[];
};

export type TeamActivity = {
  id: string;
  user: string;
  action: string;
  target: string;
  createdAt: string;
  user_id?: string;
  user_name?: string;
  actions?: number;
  last_active?: string;
};

export type ImageTaskStatus = 'pending' | 'processing' | 'success' | 'failed';
