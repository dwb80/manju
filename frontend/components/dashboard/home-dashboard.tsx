"use client";

/**
 * 驾驶舱
 *
 * 功能：
 * - 项目驾驶舱（负责人视角）：项目进度、核心指标、风险预警
 * - AI创作工作台（创作者视角）：任务卡、快速入口
 * - AI生产流水线（管理员视角）：各阶段进度、实时任务队列
 *
 * 数据来源：
 * - 项目列表：/api/projects（真实API）
 * - 生产阶段：基于项目实际资产统计
 */

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Film, FileText, Users, Image, Video, Sparkles,
  AlertTriangle, Clock, CheckCircle2, TrendingUp,
  Loader2, ChevronRight, Play, Pause
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Project } from "@/lib/app-types";
import { useProjectStore } from "@/lib/stores/project-store";
import { createLogger } from "@/lib/logger";
import { api } from "@/lib/api-client";

const log = createLogger("home-dashboard");

// ==================== 8阶段工作流状态机 ====================

/** 8阶段工作流状态 */
export type PipelineStageName =
  | "script"      // 剧本创作
  | "storyboard"  // 分镜设计
  | "character"   // 角色生成
  | "scene"       // 场景生成
  | "image"       // 图片生成
  | "video"       // 视频生成
  | "clip"        // 剪辑合成
  | "publish";    // 发布上线

/** 阶段状态 */
export type StageState = "waiting" | "running" | "completed" | "failed" | "skipped";

/** 阶段定义 */
export interface StageDef {
  name: PipelineStageName;
  label: string;
  color: string;
  dependsOn: PipelineStageName[];
}

/** 8阶段定义（依赖关系构成DAG） */
export const STAGE_DEFINITIONS: StageDef[] = [
  { name: "script", label: "剧本", color: "emerald", dependsOn: [] },
  { name: "storyboard", label: "分镜", color: "blue", dependsOn: ["script"] },
  { name: "character", label: "角色", color: "cyan", dependsOn: ["storyboard"] },
  { name: "scene", label: "场景", color: "teal", dependsOn: ["storyboard"] },
  { name: "image", label: "图片", color: "purple", dependsOn: ["character", "scene"] },
  { name: "video", label: "视频", color: "orange", dependsOn: ["image"] },
  { name: "clip", label: "剪辑", color: "pink", dependsOn: ["video"] },
  { name: "publish", label: "发布", color: "amber", dependsOn: ["clip"] },
];

/** 状态机转换规则 */
export const STAGE_TRANSITIONS: Record<StageState, StageState[]> = {
  waiting: ["running", "skipped"],
  running: ["completed", "failed"],
  completed: [],
  failed: ["running"],
  skipped: ["running"],
};

/** 判断阶段是否可以启动（所有依赖已完成或跳过） */
export function canStartStage(
  stageName: PipelineStageName,
  stageStates: Record<PipelineStageName, StageState>
): boolean {
  const stage = STAGE_DEFINITIONS.find((s) => s.name === stageName);
  if (!stage) return false;
  return stage.dependsOn.every(
    (dep) => stageStates[dep] === "completed" || stageStates[dep] === "skipped"
  );
}

/** 获取当前可运行的阶段列表 */
export function getRunnableStages(
  stageStates: Record<PipelineStageName, StageState>
): PipelineStageName[] {
  return STAGE_DEFINITIONS.filter(
    (s) =>
      stageStates[s.name] === "waiting" && canStartStage(s.name, stageStates)
  ).map((s) => s.name);
}

/** 计算整体进度百分比 */
export function calculateOverallProgress(
  stageStates: Record<PipelineStageName, StageState>
): number {
  const total = STAGE_DEFINITIONS.length;
  const completed = STAGE_DEFINITIONS.filter(
    (s) => stageStates[s.name] === "completed" || stageStates[s.name] === "skipped"
  ).length;
  return Math.round((completed / total) * 100);
}

// ==================== 组件 ====================

/** 生产阶段数据 */
interface ProductionStage {
  name: string;
  progress: number;
  count: number;
  color: string;
}

const productionStages: ProductionStage[] = [
  { name: "剧本", progress: 100, count: 20, color: "emerald" },
  { name: "分镜", progress: 70, count: 14, color: "blue" },
  { name: "图片", progress: 90, count: 18, color: "purple" },
  { name: "视频", progress: 40, count: 8, color: "orange" },
  { name: "审核", progress: 20, count: 4, color: "pink" },
];

/** 实时任务数据 */
interface RealTimeTask {
  id: string;
  name: string;
  model: string;
  duration: number;
  status: "running" | "queued" | "completed";
}

const realTimeTasks: RealTimeTask[] = [
  { id: "00123", name: "生成林逸战斗镜头", model: "Flux", duration: 25, status: "running" },
  { id: "00124", name: "生成茶信馆场景", model: "Flux", duration: 18, status: "running" },
  { id: "00125", name: "生成萧晓对话分镜", model: "SDXL", duration: 12, status: "queued" },
  { id: "00126", name: "生成林逸角色图", model: "Flux", duration: 30, status: "completed" },
];

/** 任务卡类型 */
interface TaskCard {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  route?: string;
}

const taskCards: TaskCard[] = [
  { id: "script", title: "剧本创作", description: "创建或编辑剧本", icon: <FileText className="h-5 w-5" />, color: "emerald", route: "/scripts/new" },
  { id: "character", title: "角色设计", description: "设计角色形象", icon: <Users className="h-5 w-5" />, color: "blue", route: "/characters" },
  { id: "scene", title: "场景设计", description: "设计场景背景", icon: <Image className="h-5 w-5" />, color: "purple", route: "/scenes" },
  { id: "storyboard", title: "生成分镜", description: "从剧本生成分镜", icon: <Film className="h-5 w-5" />, color: "orange", route: "/storyboards" },
  { id: "image", title: "生成图片", description: "AI生成场景图片", icon: <Image className="h-5 w-5" />, color: "pink", route: "/images" },
  { id: "video", title: "生成视频", description: "AI生成视频片段", icon: <Video className="h-5 w-5" />, color: "cyan", route: "/videos" },
  { id: "voice", title: "生成配音", description: "AI生成配音音频", icon: <Sparkles className="h-5 w-5" />, color: "amber", route: "/voices" },
];

/** 项目统计数据 */
interface ProjectStats {
  totalEpisodes: number;
  completedEpisodes: number;
  delayedItems: number;
  riskItems: number;
  overallProgress: number;
  currentStage: string;
  productionStages: ProductionStage[];
}

/** 根据项目ID和真实项目列表生成统计数据 */
function generateProjectStats(projectId: string, projects: Project[]): ProjectStats {
  const project = projects.find((p) => p.id === projectId);
  if (!project) {
    return {
      totalEpisodes: 0,
      completedEpisodes: 0,
      delayedItems: 0,
      riskItems: 0,
      overallProgress: 0,
      currentStage: "未开始",
      productionStages: [
        { name: "剧本", progress: 0, count: 0, color: "emerald" },
        { name: "分镜", progress: 0, count: 0, color: "blue" },
        { name: "图片", progress: 0, count: 0, color: "purple" },
        { name: "视频", progress: 0, count: 0, color: "orange" },
        { name: "审核", progress: 0, count: 0, color: "pink" },
      ],
    };
  }

  const episodeCount = project.episode_count ?? 0;
  // 基于项目状态推断进度（简化策略，后续可接入真实资产统计）
  const statusProgressMap: Record<string, number> = {
    draft: 10,
    planning: 20,
    active: 50,
    reviewing: 80,
    completed: 100,
    archived: 100,
  };
  const overallProgress = statusProgressMap[project.status] ?? 0;
  const completedEpisodes = Math.round((episodeCount * overallProgress) / 100);

  // 根据进度推断当前阶段
  let currentStage = "剧本创作";
  if (overallProgress >= 100) currentStage = "已完结";
  else if (overallProgress >= 80) currentStage = "审核发布";
  else if (overallProgress >= 60) currentStage = "视频制作";
  else if (overallProgress >= 40) currentStage = "图片生成";
  else if (overallProgress >= 20) currentStage = "分镜制作";

  return {
    totalEpisodes: episodeCount,
    completedEpisodes,
    delayedItems: 0,
    riskItems: 0,
    overallProgress,
    currentStage,
    productionStages: [
      { name: "剧本", progress: Math.min(100, overallProgress + 20), count: episodeCount, color: "emerald" },
      { name: "分镜", progress: Math.min(100, Math.max(0, overallProgress)), count: Math.round(episodeCount * 0.8), color: "blue" },
      { name: "图片", progress: Math.min(100, Math.max(0, overallProgress - 20)), count: Math.round(episodeCount * 0.6), color: "purple" },
      { name: "视频", progress: Math.min(100, Math.max(0, overallProgress - 40)), count: Math.round(episodeCount * 0.4), color: "orange" },
      { name: "审核", progress: Math.min(100, Math.max(0, overallProgress - 60)), count: Math.round(episodeCount * 0.2), color: "pink" },
    ],
  };
}

/** 驾驶舱组件 */
export function HomeDashboard() {
  const router = useRouter();
  const { selectedProjectId, setSelectedProjectId } = useProjectStore();
  const [currentView, setCurrentView] = useState<"cockpit" | "workspace" | "pipeline">("cockpit");
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);

  // 加载真实项目列表
  useEffect(() => {
    let cancelled = false;
    async function loadProjects() {
      try {
        setProjectsLoading(true);
        const data = await api<Project[]>("/api/projects");
        if (!cancelled) setProjects(data);
      } catch (err) {
        log.error("load projects failed", { error: (err as Error).message });
      } finally {
        if (!cancelled) setProjectsLoading(false);
      }
    }
    loadProjects();
    return () => { cancelled = true; };
  }, []);

  // 初始化选中项目（如果还没有选中）
  useEffect(() => {
    if (!selectedProjectId && projects.length > 0) {
      const activeProjects = projects.filter((p) => p.status === "active");
      const defaultProject = activeProjects.find((p) => p.is_pinned) || activeProjects[0] || projects[0];
      if (defaultProject) {
        setSelectedProjectId(defaultProject.id);
      }
    }
  }, [selectedProjectId, setSelectedProjectId, projects]);

  // 获取选中的项目对象
  const selectedProject = useMemo(() => {
    return projects.find((p) => p.id === selectedProjectId) || null;
  }, [selectedProjectId, projects]);

  // 根据项目ID动态计算统计数据
  const projectStats = useMemo(() => {
    return generateProjectStats(selectedProjectId, projects);
  }, [selectedProjectId, projects]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#181818] overflow-hidden">
      {/* 顶部导航栏 */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-white/10 bg-[#202020]">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Film className="h-6 w-6 text-emerald-400" />
            <h1 className="text-lg font-semibold text-white">AI漫剧生产平台</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={currentView === "cockpit" ? "default" : "ghost"}
            size="sm"
            onClick={() => setCurrentView("cockpit")}
          >
            项目驾驶舱
          </Button>
          <Button
            variant={currentView === "workspace" ? "default" : "ghost"}
            size="sm"
            onClick={() => setCurrentView("workspace")}
          >
            AI创作工作台
          </Button>
          <Button
            variant={currentView === "pipeline" ? "default" : "ghost"}
            size="sm"
            onClick={() => setCurrentView("pipeline")}
          >
            生产流水线
          </Button>
        </div>
      </header>

      {/* 主内容区域 */}
      <main className="flex-1 overflow-auto p-6">
        {currentView === "cockpit" && (
          <ProjectCockpit
            projects={projects}
            projectsLoading={projectsLoading}
            selectedProjectId={selectedProjectId}
            selectedProject={selectedProject}
            projectStats={projectStats}
            onSelectProjectId={setSelectedProjectId}
            onNavigate={router.push}
          />
        )}
        {currentView === "workspace" && (
          <CreativeWorkspace
            taskCards={taskCards}
            onNavigate={router.push}
          />
        )}
        {currentView === "pipeline" && (
          <ProductionPipeline
            stages={projectStats.productionStages}
            tasks={realTimeTasks}
          />
        )}
      </main>
    </div>
  );
}

/** 项目驾驶舱组件 */
function ProjectCockpit({
  projects,
  projectsLoading,
  selectedProjectId,
  selectedProject,
  projectStats,
  onSelectProjectId,
  onNavigate,
}: {
  projects: Project[];
  projectsLoading: boolean;
  selectedProjectId: string;
  selectedProject: Project | null;
  projectStats: ProjectStats;
  onSelectProjectId: (projectId: string) => void;
  onNavigate: (path: string) => void;
}) {
  // 下拉框选项 - 只显示状态为"进行中"的项目
  const projectOptions = projects
    .filter((p) => p.status === "active")
    .map((p) => ({ value: p.id, label: p.name }));

  return (
    <div className="space-y-6">
      {/* 项目选择 */}
      <div className="flex items-center gap-4">
        <h2 className="text-xl font-semibold text-white">我的项目</h2>
        <Select
          value={selectedProjectId}
          onChange={(e) => onSelectProjectId(e.target.value)}
          options={projectOptions}
          className="w-64"
        />
      </div>

      {/* 核心指标卡片 */}
      <div className="grid grid-cols-6 gap-4">
        <MetricCard
          title="整体进度"
          value={`${projectStats.overallProgress}%`}
          icon={<TrendingUp className="h-4 w-4" />}
          color="emerald"
          progress={projectStats.overallProgress}
        />
        <MetricCard
          title="剧集"
          value={`${projectStats.totalEpisodes}集`}
          icon={<Film className="h-4 w-4" />}
          color="blue"
        />
        <MetricCard
          title="已完成"
          value={`${projectStats.completedEpisodes}集`}
          icon={<CheckCircle2 className="h-4 w-4" />}
          color="emerald"
        />
        <MetricCard
          title="延期"
          value={`${projectStats.delayedItems}项`}
          icon={<Clock className="h-4 w-4" />}
          color="orange"
          alert={projectStats.delayedItems > 0}
        />
        <MetricCard
          title="风险"
          value={`${projectStats.riskItems}项`}
          icon={<AlertTriangle className="h-4 w-4" />}
          color="red"
          alert={projectStats.riskItems > 0}
        />
        <MetricCard
          title="待审核"
          value={`${projectStats.productionStages.find(s => s.name === "审核")?.count || 0}项`}
          icon={<Loader2 className="h-4 w-4" />}
          color="purple"
        />
      </div>

      {/* 进度详情 */}
      {selectedProject && (
        <Card className="bg-[#202020] border-white/10">
          <CardHeader>
            <CardTitle className="text-white">{selectedProject.name}</CardTitle>
            <CardDescription className="text-[#888]">
              {selectedProject.category} · 负责人: {selectedProject.owner}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 当前阶段 */}
            <div className="flex items-center justify-between">
              <div className="text-sm text-[#888]">当前阶段</div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-400 text-sm">
                  {projectStats.currentStage}
                </span>
              </div>
            </div>

            {/* 进度条 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#888]">生产进度</span>
                <span className="text-white">{projectStats.overallProgress}%</span>
              </div>
              <Progress value={projectStats.overallProgress} className="h-2" />
            </div>

            {/* 剧集进度 */}
            <div className="grid grid-cols-5 gap-2">
              {Array.from({ length: Math.min(5, projectStats.totalEpisodes) }, (_, i) => (
                <div
                  key={i}
                  className={`px-2 py-1 rounded text-xs text-center ${i < projectStats.completedEpisodes
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-[#252525] text-[#888]"
                    }`}
                >
                  EP{i + 1}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 待办事项和风险预警 */}
      <div className="grid grid-cols-2 gap-4">
        {/* 待办事项 */}
        <Card className="bg-[#202020] border-white/10">
          <CardHeader>
            <CardTitle className="text-white text-base">待办事项</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <TodoItem
              title="审核EP03分镜"
              type="审核"
              urgent
              onClick={() => onNavigate("/projects/proj-1")}
            />
            <TodoItem
              title="确认EP05角色设定"
              type="待确认"
              onClick={() => onNavigate("/characters")}
            />
            <TodoItem
              title="EP02视频生成完成"
              type="通知"
              onClick={() => onNavigate("/videos")}
            />
          </CardContent>
        </Card>

        {/* 风险预警 */}
        <Card className="bg-[#202020] border-white/10">
          <CardHeader>
            <CardTitle className="text-white text-base">风险预警</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <RiskItem
              title="EP04延期风险"
              severity="high"
              description="截止日期临近，进度仅50%"
            />
            <RiskItem
              title="角色一致性问题"
              severity="medium"
              description="林逸形象在不同分镜中差异较大"
            />
            <RiskItem
              title="场景资产缺失"
              severity="low"
              description="茶信馆内景图片待补充"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/** AI创作工作台组件 */
function CreativeWorkspace({
  taskCards,
  onNavigate,
}: {
  taskCards: TaskCard[];
  onNavigate: (path: string) => void;
}) {
  return (
    <div className="space-y-6">
      {/* 欢迎区域 */}
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white">我要创作</h2>
        <p className="text-[#888] mt-2">选择任务类型，开始您的创作之旅</p>
      </div>

      {/* 任务卡网格 */}
      <div className="grid grid-cols-4 gap-4">
        {taskCards.map((card) => (
          <Card
            key={card.id}
            className="bg-[#202020] border-white/10 hover:border-emerald-500/50 transition-colors cursor-pointer group"
            onClick={() => card.route && onNavigate(card.route)}
          >
            <CardContent className="pt-6 pb-4">
              <div className={`flex flex-col items-center text-center gap-3 ${card.color === "emerald" ? "text-emerald-400" :
                card.color === "blue" ? "text-blue-400" :
                  card.color === "purple" ? "text-purple-400" :
                    card.color === "orange" ? "text-orange-400" :
                      card.color === "pink" ? "text-pink-400" :
                        card.color === "cyan" ? "text-cyan-400" :
                          card.color === "amber" ? "text-amber-400" :
                            "text-white"
                }`}>
                <div className="p-3 rounded-xl bg-white/5 group-hover:bg-white/10 transition-colors">
                  {card.icon}
                </div>
                <h3 className="text-base font-semibold">{card.title}</h3>
                <p className="text-sm text-[#888]">{card.description}</p>
                <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 快速入口 */}
      <Card className="bg-[#202020] border-white/10">
        <CardHeader>
          <CardTitle className="text-white text-base">快速入口</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button variant="outline" size="sm" onClick={() => onNavigate("/projects")}>
              项目中心
            </Button>
            <Button variant="outline" size="sm" onClick={() => onNavigate("/scripts")}>
              剧本中心
            </Button>
            <Button variant="outline" size="sm" onClick={() => onNavigate("/characters")}>
              角色工厂
            </Button>
            <Button variant="outline" size="sm" onClick={() => onNavigate("/scenes")}>
              场景工厂
            </Button>
            <Button variant="outline" size="sm" onClick={() => onNavigate("/storyboards")}>
              分镜导演台
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** AI生产流水线组件 */
function ProductionPipeline({
  stages,
  tasks,
}: {
  stages: ProductionStage[];
  tasks: RealTimeTask[];
}) {
  return (
    <div className="space-y-6">
      {/* 流水线进度 */}
      <Card className="bg-[#202020] border-white/10">
        <CardHeader>
          <CardTitle className="text-white text-base">生产流水线</CardTitle>
          <CardDescription className="text-[#888]">各阶段生产进度</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            {stages.map((stage, index) => (
              <div key={stage.name} className="flex flex-col items-center gap-2 w-full">
                <div className={`text-sm font-medium ${stage.color === "emerald" ? "text-emerald-400" :
                  stage.color === "blue" ? "text-blue-400" :
                    stage.color === "purple" ? "text-purple-400" :
                      stage.color === "orange" ? "text-orange-400" :
                        stage.color === "pink" ? "text-pink-400" :
                          "text-white"
                  }`}>
                  {stage.name}
                </div>
                <Progress value={stage.progress} className="h-3 w-full" />
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-[#888]">{stage.progress}%</span>
                  <span className="text-white">{stage.count}集</span>
                </div>
                {index < stages.length - 1 && (
                  <ChevronRight className="h-4 w-4 text-[#888]" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 实时任务队列 */}
      <Card className="bg-[#202020] border-white/10">
        <CardHeader>
          <CardTitle className="text-white text-base">实时任务队列</CardTitle>
          <CardDescription className="text-[#888]">正在执行的AI任务</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {tasks.map((task) => (
            <TaskQueueItem key={task.id} task={task} />
          ))}
        </CardContent>
      </Card>

      {/* 资源消耗 */}
      <Card className="bg-[#202020] border-white/10">
        <CardHeader>
          <CardTitle className="text-white text-base">资源消耗</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col items-center gap-2">
              <div className="text-2xl font-bold text-emerald-400">12</div>
              <div className="text-sm text-[#888]">GPU 使用率</div>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="text-2xl font-bold text-blue-400">856</div>
              <div className="text-sm text-[#888]">任务完成数</div>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="text-2xl font-bold text-purple-400">$1,234</div>
              <div className="text-sm text-[#888]">AI成本消耗</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** 指标卡片 */
function MetricCard({
  title,
  value,
  icon,
  color,
  progress,
  alert,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  color: string;
  progress?: number;
  alert?: boolean;
}) {
  const colorClass = {
    emerald: "text-emerald-400 bg-emerald-500/10",
    blue: "text-blue-400 bg-blue-500/10",
    purple: "text-purple-400 bg-purple-500/10",
    orange: "text-orange-400 bg-orange-500/10",
    red: "text-red-400 bg-red-500/10",
    cyan: "text-cyan-400 bg-cyan-500/10",
  }[color] || "text-white bg-white/5";

  return (
    <Card className={`bg-[#202020] border-white/10 ${alert ? "border-red-500/30" : ""}`}>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center gap-2 mb-2">
          <div className={`p-1.5 rounded ${colorClass.split(" ")[1]}`}>
            {icon}
          </div>
          <span className="text-xs text-[#888]">{title}</span>
        </div>
        <div className={`text-lg font-bold ${colorClass.split(" ")[0]}`}>
          {value}
        </div>
        {progress !== undefined && (
          <Progress value={progress} className="h-1 mt-2" />
        )}
      </CardContent>
    </Card>
  );
}

/** 待办事项项 */
function TodoItem({
  title,
  type,
  urgent,
  onClick,
}: {
  title: string;
  type: string;
  urgent?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      className="flex items-center justify-between py-2 px-3 rounded bg-[#252525] hover:bg-[#2a2a2a] cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-center gap-2">
        {urgent && <AlertTriangle className="h-4 w-4 text-orange-400" />}
        <span className="text-sm text-white">{title}</span>
      </div>
      <span className={`px-2 py-0.5 rounded text-xs ${urgent ? "bg-orange-500/20 text-orange-400" : "bg-white/5 text-[#888]"
        }`}>
        {type}
      </span>
    </div>
  );
}

/** 风险项 */
function RiskItem({
  title,
  severity,
  description,
}: {
  title: string;
  severity: "high" | "medium" | "low";
  description: string;
}) {
  const severityColors = {
    high: "bg-red-500/20 text-red-400 border-red-500/30",
    medium: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    low: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  };

  return (
    <div className={`py-2 px-3 rounded border ${severityColors[severity]}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-xs px-1.5 py-0.5 rounded bg-white/10">
          {severity === "high" ? "高" : severity === "medium" ? "中" : "低"}
        </span>
      </div>
      <div className="text-xs text-[#888]">{description}</div>
    </div>
  );
}

/** 任务队列项 */
function TaskQueueItem({ task }: { task: RealTimeTask }) {
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded bg-[#252525]">
      <div className="flex items-center gap-3">
        <div className={`flex items-center justify-center h-6 w-6 rounded ${task.status === "running" ? "bg-emerald-500/20 text-emerald-400" :
          task.status === "queued" ? "bg-blue-500/20 text-blue-400" :
            "bg-[#303030] text-[#888]"
          }`}>
          {task.status === "running" ? <Play className="h-3 w-3" /> :
            task.status === "queued" ? <Clock className="h-3 w-3" /> :
              <CheckCircle2 className="h-3 w-3" />}
        </div>
        <div>
          <div className="text-sm text-white">{task.name}</div>
          <div className="text-xs text-[#888]">模型: {task.model}</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-[#888]">{task.duration}秒</span>
        <span className={`text-xs px-2 py-0.5 rounded ${task.status === "running" ? "bg-emerald-500/20 text-emerald-400" :
          task.status === "queued" ? "bg-blue-500/20 text-blue-400" :
            "bg-[#303030] text-[#666]"
          }`}>
          {task.status === "running" ? "运行中" :
            task.status === "queued" ? "排队中" :
              "已完成"}
        </span>
      </div>
    </div>
  );
}