/**
 * @file my-projects.tsx
 * @description 我的项目卡片组件，展示用户参与的项目列表和进度
 */
"use client";

import { memo } from "react";
import {
  FolderKanban,
  Cpu,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";
import type { ProjectProgress } from "@/lib/app-types";

/** 我的项目卡片组件Props */
export interface MyProjectsProps {
  /** 项目列表 */
  projects: ProjectProgress[];
  /** 点击项目回调 */
  onOpenProject?: (projectId: string) => void;
}

/** AI状态颜色 */
const getAIStatusColor = (status: ProjectProgress["aiStatus"]) => {
  switch (status) {
    case "generating":
      return "text-blue-400";
    case "reviewing":
      return "text-amber-400";
    case "failed":
      return "text-red-400";
    default:
      return "text-[#666]";
  }
};

/** AI状态图标 */
const getAIStatusIcon = (status: ProjectProgress["aiStatus"]) => {
  switch (status) {
    case "generating":
      return Cpu;
    case "reviewing":
      return Clock;
    case "failed":
      return AlertCircle;
    default:
      return CheckCircle2;
  }
};

/**
 * MyProjects - 我的项目卡片组件
 * @param {MyProjectsProps} props - 组件属性
 * @param {ProjectProgress[]} props.projects - 项目列表
 * @param {Function} props.onOpenProject - 打开项目回调
 * @returns {JSX.Element} 渲染的项目列表界面
 */
export const MyProjects = memo(function MyProjects({ projects, onOpenProject }: MyProjectsProps) {
  return (
    <div className="mb-6 rounded-xl border border-white/10 bg-[#1a1a1a]">
      {/* 头部 */}
      <div className="flex items-center justify-between border-b border-white/10 p-4">
        <h3 className="text-lg font-semibold text-white">我的项目</h3>
        <span className="text-sm text-[#888]">{projects.length} 个项目</span>
      </div>

      {/* 项目列表 */}
      <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => {
          const AIStatusIcon = getAIStatusIcon(project.aiStatus);
          return (
            <button
              key={project.id}
              onClick={() => onOpenProject?.(project.id)}
              className="group rounded-xl border border-white/10 bg-[#252525] p-4 text-left transition-all hover:border-emerald-500/50 hover:bg-emerald-500/5"
            >
              {/* 项目封面和名称 */}
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20">
                  <FolderKanban className="h-6 w-6 text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="truncate font-medium text-white">{project.name}</div>
                  <div className="text-xs text-[#888]">
                    第{project.currentEpisode}集 · Scene{project.currentScene} · Shot{project.currentShot}
                  </div>
                </div>
              </div>

              {/* 进度条 */}
              <div className="mb-3">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-[#888]">{project.currentStage}</span>
                  <span className="text-emerald-400">{project.totalProgress}%</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all"
                    style={{ width: `${project.totalProgress}%` }}
                  />
                </div>
              </div>

              {/* AI状态 */}
              <div className="flex items-center gap-2">
                <AIStatusIcon className={`h-4 w-4 ${getAIStatusColor(project.aiStatus)}`} />
                <span className={`text-xs ${getAIStatusColor(project.aiStatus)}`}>
                  {project.aiStatus === "generating" ? "AI生成中" :
                    project.aiStatus === "reviewing" ? "审核中" :
                      project.aiStatus === "failed" ? "AI失败" : "空闲"}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
});

export default MyProjects;