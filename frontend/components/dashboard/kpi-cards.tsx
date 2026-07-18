"use client";

import { memo } from "react";
import {
  FolderKanban,
  Image,
  Video,
  Cpu,
  ClipboardCheck,
  Gauge,
  DollarSign,
  CheckCircle2,
  LucideIcon,
} from "lucide-react";

/** KPI卡片数据类型 */
export interface KPICardData {
  /** 指标标识 */
  id: string;
  /** 指标名称 */
  label: string;
  /** 指标值 */
  value: string | number;
  /** 图标 */
  icon: LucideIcon;
  /** 颜色主题 */
  color: "emerald" | "blue" | "purple" | "orange" | "cyan" | "pink" | "amber";
  /** 变化趋势 */
  trend?: {
    value: string;
    direction: "up" | "down" | "stable";
  };
}

/** KPI卡片组件Props */
export interface KPICardsProps {
  /** KPI数据 */
  kpi: {
    activeProjects: number;
    todayImages: number;
    todayVideos: number;
    runningAITasks: number;
    pendingReviews: number;
    gpuUtilization: number;
    resourceTelemetryAvailable?: boolean;
    todayCost: number;
    successRate: number;
  };
}

/** 颜色配置 */
const colorConfig = {
  emerald: {
    text: "text-emerald-400",
    bg: "bg-emerald-500/20",
    border: "border-emerald-500/30",
  },
  blue: {
    text: "text-blue-400",
    bg: "bg-blue-500/20",
    border: "border-blue-500/30",
  },
  purple: {
    text: "text-purple-400",
    bg: "bg-purple-500/20",
    border: "border-purple-500/30",
  },
  orange: {
    text: "text-orange-400",
    bg: "bg-orange-500/20",
    border: "border-orange-500/30",
  },
  cyan: {
    text: "text-cyan-400",
    bg: "bg-cyan-500/20",
    border: "border-cyan-500/30",
  },
  pink: {
    text: "text-pink-400",
    bg: "bg-pink-500/20",
    border: "border-pink-500/30",
  },
  amber: {
    text: "text-amber-400",
    bg: "bg-amber-500/20",
    border: "border-amber-500/30",
  },
};

/** 单个KPI卡片组件 */
const KPICard = memo(function KPICard({
  label,
  value,
  icon: Icon,
  color,
  trend,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color: KPICardData["color"];
  trend?: KPICardData["trend"];
}) {
  const colors = colorConfig[color];

  return (
    <div className="flex flex-col rounded-xl border border-white/10 bg-[#252525] p-4 transition-all hover:border-white/20 hover:bg-[#2a2a2a]">
      {/* 图标和标签 */}
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm text-[#888]">{label}</span>
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${colors.bg}`}>
          <Icon className={`h-5 w-5 ${colors.text}`} />
        </div>
      </div>

      {/* 数值 */}
      <div className="flex items-baseline gap-2">
        <span className={`text-2xl font-bold ${colors.text}`}>
          {typeof value === "number" ? value.toLocaleString() : value}
        </span>
        {trend && (
          <span
            className={`text-xs ${trend.direction === "up"
              ? "text-emerald-400"
              : trend.direction === "down"
                ? "text-red-400"
                : "text-[#888]"
              }`}
          >
            {trend.direction === "up" ? "↑" : trend.direction === "down" ? "↓" : "→"}{" "}
            {trend.value}
          </span>
        )}
      </div>
    </div>
  );
});

/**
 * KPICards - KPI卡片组件
 * @param {KPICardsProps} props - 组件属性
 * @param {Object} props.kpi - KPI数据对象
 * @returns {JSX.Element} 渲染的KPI卡片网格界面
 */
export const KPICards = memo(function KPICards({ kpi }: KPICardsProps) {
  // 构建KPI卡片数据
  const kpiItems: KPICardData[] = [
    {
      id: "activeProjects",
      label: "进行中项目",
      value: kpi.activeProjects,
      icon: FolderKanban,
      color: "blue",
    },
    {
      id: "todayImages",
      label: "今日生成图片",
      value: kpi.todayImages,
      icon: Image,
      color: "cyan",
    },
    {
      id: "todayVideos",
      label: "今日生成视频",
      value: kpi.todayVideos,
      icon: Video,
      color: "purple",
    },
    {
      id: "runningAITasks",
      label: "运行中AI任务",
      value: kpi.runningAITasks,
      icon: Cpu,
      color: "orange",
    },
    {
      id: "pendingReviews",
      label: "待审核任务",
      value: kpi.pendingReviews,
      icon: ClipboardCheck,
      color: "amber",
    },
    {
      id: "gpuUtilization",
      label: "GPU遥测",
      value: kpi.resourceTelemetryAvailable ? `${kpi.gpuUtilization}%` : "未接入",
      icon: Gauge,
      color: "pink",
    },
    {
      id: "todayCost",
      label: "今日费用估算",
      value: `¥${kpi.todayCost.toFixed(2)}`,
      icon: DollarSign,
      color: "emerald",
    },
    {
      id: "successRate",
      label: "成功率",
      value: `${kpi.successRate}%`,
      icon: CheckCircle2,
      color: "emerald",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-6">
      {kpiItems.map((item) => (
        <KPICard
          key={item.id}
          label={item.label}
          value={item.value}
          icon={item.icon}
          color={item.color}
          trend={item.trend}
        />
      ))}
    </div>
  );
});

export default KPICards;
