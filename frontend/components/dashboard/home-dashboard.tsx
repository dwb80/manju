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

/** 实时任务数据 */
interface RealTimeTask {
  id: string;
  name: string;
  model: string;
  duration: number;
  status: "running" | "queued" | "completed";
}

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
  { id: "script", title: "剧本创作", description: "创建或编辑剧本", icon: <FileText className="h-5 w-5" />, color: "emerald", route: "/scripts" },
  { id: "character", title: "角色设计", description: "设计角色形象", icon: <Users className="h-5 w-5" />, color: "blue", route: "/characters" },
  { id: "scene", title: "场景设计", description: "设计场景背景", icon: <Image className="h-5 w-5" />, color: "purple", route: "/scenes" },
  { id: "storyboard", title: "生成分镜", description: "从剧本生成分镜", icon: <Film className="h-5 w-5" />, color: "orange", route: "/storyboards" },
  { id: "image", title: "生成图片", description: "AI生成场景图片", icon: <Image className="h-5 w-5" />, color: "pink", route: "/assistant?mode=image" },
  { id: "video", title: "生成视频", description: "AI生成视频片段", icon: <Video className="h-5 w-5" />, color: "cyan", route: "/video-production" },
  { id: "voice", title: "音频中心", description: "管理配音与音频素材", icon: <Sparkles className="h-5 w-5" />, color: "amber", route: "/audio" },
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

const EMPTY_PROJECT_STATS: ProjectStats = {
  totalEpisodes: 0, completedEpisodes: 0, delayedItems: 0, riskItems: 0,
  overallProgress: 0, currentStage: "未开始",
  productionStages: [
    { name: "剧本", progress: 0, count: 0, color: "emerald" },
    { name: "分镜", progress: 0, count: 0, color: "blue" },
    { name: "图片", progress: 0, count: 0, color: "purple" },
    { name: "视频", progress: 0, count: 0, color: "orange" },
    { name: "审核", progress: 0, count: 0, color: "pink" },
  ],
};

const percent = (done: number, total: number) => total > 0 ? Math.min(100, Math.round(done / total * 100)) : 0;

/** 驾驶舱组件 */
export function HomeDashboard() {
  const router = useRouter();
  const { selectedProjectId } = useProjectStore();
  const [currentView, setCurrentView] = useState<"cockpit" | "workspace" | "pipeline">("cockpit");
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectStats, setProjectStats] = useState<ProjectStats>(EMPTY_PROJECT_STATS);
  const [realTimeTasks, setRealTimeTasks] = useState<RealTimeTask[]>([]);

  // 加载真实项目列表。
  // - 挂载时拉一次；
  // - 切到 HomeDashboard 时也会拉（依赖 [selectedProjectId]，防止 store 里的 selectedProjectId
  //   已经被改了但 HomeDashboard 的 projects 还是旧的——典型场景：用户在 AI 生产中心切了项目
  //   再切回驾驶舱，projects 数组要保持最新）。
  useEffect(() => {
    let cancelled = false;
    async function loadProjects() {
      try {
        const data = await api<Project[]>("/api/projects");
        if (!cancelled) setProjects(data);
      } catch (err) {
        log.error("load projects failed", { error: (err as Error).message });
      }
    }
    loadProjects();
    return () => { cancelled = true; };
  }, [selectedProjectId]);

  // 选中项目由 GlobalTopBar 统一初始化（pin → active → 第一个），这里不再重复。
  // 重复写会导致：
  //   1) 多次 network call 拿 /api/projects
  //   2) 与 GlobalTopBar 的 useEffect 竞争写 selectedProjectId，行为不可预期
  // 故删去本组件里的默认项目初始化逻辑。

  // 获取选中的项目对象
  const selectedProject = useMemo(() => {
    return projects.find((p) => p.id === selectedProjectId) || null;
  }, [selectedProjectId, projects]);

  // 从项目工作台资源和统一 AI 任务接口计算指标，不再按项目状态猜测数据。
  useEffect(() => {
    let cancelled = false;
    if (!selectedProjectId) {
      setProjectStats(EMPTY_PROJECT_STATS);
      setRealTimeTasks([]);
      return;
    }
    async function loadMetrics() {
      try {
        const [episodes, issues, milestones, scripts, storyboards, reviews, taskResult] = await Promise.all([
          api<Array<{ status: string }>>(`/api/projects/${selectedProjectId}/episodes`),
          api<Array<{ status: string; severity: string }>>(`/api/projects/${selectedProjectId}/issues`),
          api<Array<{ status: string }>>(`/api/projects/${selectedProjectId}/milestones`),
          api<Array<{ id: string }>>(`/api/projects/${selectedProjectId}/scripts`),
          api<Array<{ image_url?: string; video_url?: string }>>(`/api/projects/${selectedProjectId}/storyboards`),
          api<Array<{ status: string }>>(`/api/projects/${selectedProjectId}/reviews`),
          api<{ tasks: Array<{ id: string; prompt: string; model: string; duration: number | null; status: string }> }>(`/api/ai/tasks?projectId=${encodeURIComponent(selectedProjectId)}&pageSize=20`),
        ]);
        if (cancelled) return;
        const completedEpisodes = episodes.filter((item) => ["done", "completed", "已完成"].includes(item.status)).length;
        const images = storyboards.filter((item) => Boolean(item.image_url)).length;
        const videos = storyboards.filter((item) => Boolean(item.video_url)).length;
        const reviewed = reviews.filter((item) => ["resolved", "rejected"].includes(item.status)).length;
        const stages: ProductionStage[] = [
          { name: "剧本", progress: percent(scripts.length, episodes.length), count: scripts.length, color: "emerald" },
          { name: "分镜", progress: percent(storyboards.length, Math.max(scripts.length, 1)), count: storyboards.length, color: "blue" },
          { name: "图片", progress: percent(images, storyboards.length), count: images, color: "purple" },
          { name: "视频", progress: percent(videos, storyboards.length), count: videos, color: "orange" },
          { name: "审核", progress: percent(reviewed, storyboards.length), count: reviewed, color: "pink" },
        ];
        const firstIncomplete = stages.find((stage) => stage.progress < 100);
        setProjectStats({
          totalEpisodes: episodes.length,
          completedEpisodes,
          delayedItems: milestones.filter((item) => item.status === "delayed").length,
          riskItems: issues.filter((item) => !["resolved", "closed"].includes(item.status) && ["high", "critical"].includes(item.severity)).length,
          overallProgress: Math.round(stages.reduce((sum, stage) => sum + stage.progress, 0) / stages.length),
          currentStage: firstIncomplete?.name ?? (stages.some((stage) => stage.count > 0) ? "已完结" : "未开始"),
          productionStages: stages,
        });
        setRealTimeTasks(taskResult.tasks.map((task) => ({
          id: task.id,
          name: task.prompt || `${task.model} 任务`,
          model: task.model,
          duration: task.duration ?? 0,
          status: task.status === "processing" ? "running" : task.status === "pending" ? "queued" : "completed",
        })));
      } catch (err) {
        if (!cancelled) {
          setProjectStats(EMPTY_PROJECT_STATS);
          setRealTimeTasks([]);
          log.error("load dashboard metrics failed", { error: (err as Error).message });
        }
      }
    }
    loadMetrics();
    return () => { cancelled = true; };
  }, [selectedProjectId]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#181818] overflow-hidden">
      {/* 视图切换条：原本在顶栏右侧的"项目驾驶舱 / AI创作工作台 / 生产流水线"。
          抽出作为二级切换条，三视图都能切，避开顶栏拥挤。 */}
      <div className="flex items-center justify-end gap-2 border-b border-white/10 bg-[#1a1a1a] px-6 py-3">
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

      {/* 主内容区域 */}
      <main className="flex-1 overflow-auto p-6">
        {currentView === "cockpit" && (
          <ProjectCockpit
            selectedProject={selectedProject}
            projectStats={projectStats}
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
  selectedProject,
  projectStats,
  onNavigate,
}: {
  selectedProject: Project | null;
  projectStats: ProjectStats;
  onNavigate: (path: string) => void;
}) {
  return (
    <div className="space-y-6">
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
          <CardContent className="space-y-3">
            <p className="text-sm text-[#888]">驾驶舱不生成模拟待办，请前往待办中心查看已保存任务。</p>
            <Button variant="outline" size="sm" onClick={() => onNavigate("/todos")}>查看我的待办</Button>
          </CardContent>
        </Card>

        {/* 风险预警 */}
        <Card className="bg-[#202020] border-white/10">
          <CardHeader>
            <CardTitle className="text-white text-base">风险预警</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {projectStats.riskItems > 0 && <RiskItem title="存在未关闭的高风险问题" severity="high" description={`共 ${projectStats.riskItems} 项，请在项目中心处理`} />}
            {projectStats.delayedItems > 0 && <RiskItem title="存在延期里程碑" severity="medium" description={`共 ${projectStats.delayedItems} 项，请检查交付日期`} />}
            {projectStats.riskItems === 0 && projectStats.delayedItems === 0 && <p className="text-sm text-[#888]">当前真实项目数据中未发现高风险或延期项。</p>}
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
