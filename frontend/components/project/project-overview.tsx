/**
 * @file project-overview.tsx
 * @description 项目概览组件，为首次访问用户提供清晰的项目入口和工作流指引
 */

"use client";

import { FileText, Film, FolderOpen, Image, Sparkles, Video } from "lucide-react";
import type { Project } from "@/lib/app-types";

type ProjectOverviewProps = {
  /** 项目列表 */
  projects: Project[];
  /** 打开项目回调 */
  onOpenProject: (projectId: string) => void;
  /** 创建会话回调 */
  onCreateConversation: () => void;
  /** 打开聊天模式回调 */
  onOpenChatMode: () => void;
};

/**
 * ProjectOverview - 项目概览组件
 * @param {ProjectOverviewProps} props - 组件属性
 * @returns {JSX.Element} 渲染的项目概览元素
 */
export function ProjectOverview({ projects, onOpenProject, onCreateConversation, onOpenChatMode }: ProjectOverviewProps) {
  // 获取置顶项目和最近项目（按更新时间排序）
  const pinnedProjects = projects.filter((p) => p.is_pinned).slice(0, 3);
  const recentProjects = [...projects]
    .filter((p) => !p.is_pinned && !p.archived_at)
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 5);

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-card p-8">
      <div className="mx-auto w-full max-w-5xl space-y-8">
        {/* 欢迎区域 */}
        <div className="text-center">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 text-primary">
            <Film className="h-8 w-8" />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-foreground">欢迎来到 Agnes AI Studio</h1>
          <p className="mt-2 text-sm text-muted-foreground">AI漫剧创作项目管理系统 · 从剧本到交付的全流程管理</p>
        </div>

        {/* 快捷操作面板 */}
        <div className="grid grid-cols-3 gap-4">
          <QuickActionCard
            icon={<Sparkles className="h-5 w-5" />}
            title="继续创作"
            description="继续上次的工作"
            onClick={onCreateConversation}
            color="emerald"
          />
          <QuickActionCard
            icon={<Image className="h-5 w-5" />}
            title="待审核分镜"
            description="查看需要审核的分镜"
            onClick={() => onOpenProject(recentProjects[0]?.id ?? "")}
            color="blue"
          />
          <QuickActionCard
            icon={<FileText className="h-5 w-5" />}
            title="AI助手"
            description="与AI助手对话"
            onClick={onOpenChatMode}
            color="purple"
          />
        </div>

        {/* 工作流程入口 */}
        <div className="rounded-2xl border border-border bg-muted p-6">
          <h2 className="mb-4 text-base font-semibold text-foreground">工作流程</h2>
          <div className="flex items-center justify-between gap-2">
            <WorkflowStage number={1} label="剧本" icon={<FileText className="h-4 w-4" />} />
            <WorkflowConnector />
            <WorkflowStage number={2} label="分镜" icon={<Image className="h-4 w-4" />} />
            <WorkflowConnector />
            <WorkflowStage number={3} label="资产" icon={<FolderOpen className="h-4 w-4" />} />
            <WorkflowConnector />
            <WorkflowStage number={4} label="剪辑" icon={<Video className="h-4 w-4" />} />
            <WorkflowConnector />
            <WorkflowStage number={5} label="交付" color="emerald" />
          </div>
        </div>

        {/* 最近项目卡片 */}
        <div className="rounded-2xl border border-border bg-muted p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">最近项目</h2>
            {projects.length > 0 && (
              <button className="text-xs text-muted-foreground transition-colors hover:text-foreground" onClick={onCreateConversation}>
                查看全部
              </button>
            )}
          </div>
          {projects.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
              <div className="mx-auto mb-3 h-12 w-12 rounded-xl bg-secondary flex items-center justify-center">
                <FolderOpen className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="text-sm text-muted-foreground">还没有项目</div>
              <button className="mt-3 text-sm text-primary transition-colors hover:text-primary" onClick={onCreateConversation}>
                创建第一个项目
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* 置顶项目 */}
              {pinnedProjects.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">置顶</div>
                  {pinnedProjects.map((project) => (
                    <ProjectCard key={project.id} project={project} onClick={() => onOpenProject(project.id)} />
                  ))}
                </div>
              )}
              {/* 最近项目 */}
              {recentProjects.length > 0 && (
                <div className="space-y-2">
                  {pinnedProjects.length > 0 && <div className="mt-4 text-xs font-medium text-muted-foreground">最近访问</div>}
                  {recentProjects.map((project) => (
                    <ProjectCard key={project.id} project={project} onClick={() => onOpenProject(project.id)} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** 快捷操作卡片。 */
function QuickActionCard({
  icon,
  title,
  description,
  onClick,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  color: "emerald" | "blue" | "purple";
}) {
  const colorClasses = {
    emerald: "bg-primary/10 text-primary hover:bg-primary/20",
    blue: "bg-info/10 text-info hover:bg-info/20",
    purple: "bg-chart-1/10 text-chart-1 hover:bg-chart-1/20",
  };

  return (
    <button
      className={`group rounded-xl border border-border bg-muted p-5 text-left transition-all duration-200 hover:scale-[1.02] hover:border-border ${colorClasses[color]}`}
      onClick={onClick}
    >
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-muted/50">{icon}</div>
      <div className="text-sm font-semibold text-foreground">{title}</div>
      <div className="mt-1 text-xs text-muted-foreground">{description}</div>
    </button>
  );
}

/** 工作流程阶段。 */
function WorkflowStage({ number, label, icon, color = "default" }: { number: number; label: string; icon?: React.ReactNode; color?: "default" | "emerald" }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-xl border ${color === "emerald" ? "border-primary/50 bg-primary/10 text-primary" : "border-border bg-secondary text-muted-foreground"
          }`}
      >
        {icon || <span className="text-sm font-semibold">{number}</span>}
      </div>
      <div className={`text-xs font-medium ${color === "emerald" ? "text-primary" : "text-muted-foreground"}`}>{label}</div>
    </div>
  );
}

/** 工作流程连接线。 */
function WorkflowConnector() {
  return <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />;
}

/** 项目卡片。 */
function ProjectCard({ project, onClick }: { project: Project; onClick: () => void }) {
  const statusColors: Record<string, string> = {
    策划中: "bg-chart-5/10 text-chart-5",
    剧本中: "bg-info/10 text-info",
    分镜中: "bg-chart-1/10 text-chart-1",
    出图中: "bg-chart-3/10 text-chart-3",
    视频中: "bg-chart-4/10 text-chart-4",
    剪辑中: "bg-chart-2/10 text-chart-2",
    已完成: "bg-primary/10 text-primary",
  };

  const statusColor = statusColors[project.status] || "bg-muted text-foreground";

  return (
    <button
      className="group w-full rounded-lg border border-border bg-secondary p-4 text-left transition-all duration-200 hover:border-border hover:bg-secondary"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="truncate text-sm font-semibold text-foreground">{project.name}</div>
            {project.is_pinned && <span className="shrink-0 text-[10px] text-chart-5">📌</span>}
          </div>
          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
            <span className={`rounded-md px-2 py-0.5 ${statusColor}`}>{project.status || "策划中"}</span>
            {project.category && <span>{project.category}</span>}
            {project.episode_count > 0 && <span>{project.episode_count} 集</span>}
          </div>
          {project.description && <div className="mt-2 line-clamp-1 text-xs text-muted-foreground">{project.description}</div>}
        </div>
        <div className="text-xs text-muted-foreground">{formatRelativeTime(project.updated_at)}</div>
      </div>
    </button>
  );
}

/** 格式化相对时间。 */
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 7) return `${days}天前`;
  if (days < 30) return `${Math.floor(days / 7)}周前`;
  return date.toLocaleDateString("zh-CN");
}
