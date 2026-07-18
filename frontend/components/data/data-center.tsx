/**
 * @file data-center.tsx
 * @description 数据中心组件，显示AI成本统计和生产效率分析
 */

"use client";

import { useState } from "react";
import {
  DollarSign,
  TrendingUp,
  Zap,
  Clock,
  ChevronRight,
  BarChart3,
  Users,
  Calendar,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AICostStats, type AICostData } from "./ai-cost-stats";
import { ProductionEfficiency, type ProductionEfficiencyData } from "./production-efficiency";

/**
 * 时间范围类型
 */
type TimeRange = "today" | "week" | "month" | "all";

/**
 * 数据中心概览指标类型
 */
type DataCenterMetrics = {
  /** 本月AI成本(美元) */
  monthlyAICost: number;
  /** 本月生成任务数 */
  monthlyTasks: number;
  /** 平均响应时间(秒) */
  avgResponseTime: number;
  /** 生产效率指数(0-100) */
  efficiencyIndex: number;
  /** AI成本趋势(过去7天) */
  costTrend: number[];
  /** 生产效率趋势(过去7天) */
  efficiencyTrend: number[];
};

/**
 * 数据中心组件属性
 */
type DataCenterProps = {
  /** 概览指标数据 */
  metrics: DataCenterMetrics;
  /** AI成本详细数据 */
  aiCostData: AICostData;
  /** 生产效率详细数据 */
  productionData: ProductionEfficiencyData;
  /** 查看AI成本详情回调 */
  onViewAICostDetails?: () => void;
  /** 查看生产效率详情回调 */
  onViewEfficiencyDetails?: () => void;
  /** 查看团队绩效回调 */
  onViewTeamPerformance?: () => void;
  /** 时间范围变化回调 */
  onTimeRangeChange?: (range: TimeRange) => void;
};

/**
 * 数据中心主组件
 *
 * 功能：
 * - 顶部显示数据中心标题和简介
 * - 显示关键指标概览(本月AI成本、本月生成任务数、平均响应时间、生产效率指数)
 * - 显示AI成本趋势图表(简单柱状图)
 * - 显示生产效率趋势图表(简单折线图)
 * - 快捷入口(AI成本详情、生产效率详情、团队绩效)
 * - 支持时间范围筛选(今天/本周/本月/全部)
 */
export function DataCenter({
  metrics,
  aiCostData,
  productionData,
  onViewAICostDetails,
  onViewEfficiencyDetails,
  onViewTeamPerformance,
  onTimeRangeChange,
}: DataCenterProps) {
  // 当前选中的时间范围
  const [timeRange, setTimeRange] = useState<TimeRange>("month");

  // 当前选中的详情视图
  const [activeDetail, setActiveDetail] = useState<"overview" | "cost" | "efficiency">("overview");

  /**
   * 处理时间范围变化
   */
  const handleTimeRangeChange = (range: TimeRange) => {
    setTimeRange(range);
    onTimeRangeChange?.(range);
  };

  /**
   * 渲染指标卡片
   */
  const renderMetricCard = (
    title: string,
    value: string | number,
    unit: string,
    icon: typeof DollarSign,
    color: string,
    bgColor: string,
    trend?: number
  ) => {
    const Icon = icon;
    return (
      <div data-testid="metric-card" className="rounded-xl border border-white/10 bg-[#1a1a1a] p-4 transition-all hover:border-white/20">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("rounded-lg p-2", bgColor)}>
              <Icon className={cn("h-5 w-5", color)} />
            </div>
            <div>
              <div className="text-xs text-[#888]">{title}</div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl font-bold text-white">{value}</span>
                <span className="text-xs text-[#666]">{unit}</span>
              </div>
            </div>
          </div>
          {trend !== undefined && (
            <div className="flex items-center gap-1">
              {trend > 0 ? (
                <TrendingUp className="h-3 w-3 text-emerald-400" />
              ) : (
                <TrendingUp className="h-3 w-3 rotate-180 text-red-400" />
              )}
              <span className={cn("text-xs", trend > 0 ? "text-emerald-400" : "text-red-400")}>
                {Math.abs(trend).toFixed(1)}%
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  /**
   * 渲染简单柱状图
   */
  const renderBarChart = (data: number[], title: string, color: string) => {
    const maxValue = Math.max(...data, 1);
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-white">{title}</h3>
        <div className="flex h-[120px] items-end gap-1.5">
          {data.map((value, index) => {
            const heightPercent = (value / maxValue) * 100;
            return (
              <div key={index} className="flex flex-1 flex-col items-center gap-1">
                <div className="relative w-full">
                  <div
                    className={cn(
                      "w-full rounded-t transition-all hover:opacity-80",
                      color
                    )}
                    style={{ height: `${Math.max(heightPercent, 5)}%` }}
                    title={`${value.toFixed(1)}`}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-between text-xs text-[#666]">
          <span>7天前</span>
          <span>今天</span>
        </div>
      </div>
    );
  };

  /**
   * 渲染简单折线图
   */
  const renderLineChart = (data: number[], title: string, color: string) => {
    const maxValue = Math.max(...data, 100);
    const minValue = Math.min(...data, 0);
    const range = maxValue - minValue || 1;

    return (
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-white">{title}</h3>
        <div className="relative h-[120px]">
          {/* 网格线 */}
          <div className="absolute left-0 top-0 flex h-full w-full flex-col justify-between">
            {[0, 50, 100].map((percent) => (
              <div key={percent} className="h-px w-full bg-white/5" />
            ))}
          </div>

          {/* SVG 折线 */}
          <svg className="h-full w-full" preserveAspectRatio="none" viewBox={`0 0 ${data.length} 100`}>
            {/* 折线 */}
            <polyline
              fill="none"
              stroke={color}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={data
                .map((value, index) => {
                  const x = index;
                  const y = 100 - ((value - minValue) / range) * 100;
                  return `${x},${y}`;
                })
                .join(" ")}
            />

            {/* 数据点 */}
            {data.map((value, index) => {
              const y = 100 - ((value - minValue) / range) * 100;
              return (
                <circle
                  key={index}
                  cx={index}
                  cy={y}
                  r="2"
                  fill={color}
                  className="transition-all hover:r-3"
                />
              );
            })}
          </svg>
        </div>
        <div className="flex justify-between text-xs text-[#666]">
          <span>7天前</span>
          <span>今天</span>
        </div>
      </div>
    );
  };

  /**
   * 渲染快捷入口按钮
   */
  const renderQuickAccess = (
    title: string,
    description: string,
    icon: typeof BarChart3,
    onClick?: () => void
  ) => {
    const Icon = icon;
    return (
      <button
        onClick={onClick}
        className="group flex items-center justify-between rounded-lg border border-white/10 bg-[#1a1a1a] p-4 text-left transition-all hover:border-white/20 hover:bg-[#202020]"
      >
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-blue-500/10 p-2 transition-all group-hover:bg-blue-500/20">
            <Icon className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <div className="text-sm font-medium text-white">{title}</div>
            <div className="text-xs text-[#888]">{description}</div>
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-[#666] transition-all group-hover:text-white" />
      </button>
    );
  };

  /**
   * 渲染概览视图
   */
  const renderOverview = () => {
    return (
      <div className="space-y-6">
        {/* 关键指标概览 */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {renderMetricCard(
            "本月AI成本",
            `$${metrics.monthlyAICost.toFixed(2)}`,
            "美元",
            DollarSign,
            "text-emerald-400",
            "bg-emerald-500/10",
            12.5
          )}
          {renderMetricCard(
            "本月生成任务",
            metrics.monthlyTasks,
            "个",
            Activity,
            "text-blue-400",
            "bg-blue-500/10",
            8.3
          )}
          {renderMetricCard(
            "平均响应时间",
            metrics.avgResponseTime.toFixed(1),
            "秒",
            Clock,
            "text-purple-400",
            "bg-purple-500/10",
            -5.2
          )}
          {renderMetricCard(
            "生产效率指数",
            metrics.efficiencyIndex,
            "分",
            Zap,
            "text-yellow-400",
            "bg-yellow-500/10",
            3.7
          )}
        </div>

        {/* 图表区域 */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* AI成本趋势 */}
          <div className="rounded-xl border border-white/10 bg-[#1a1a1a] p-6">
            {renderBarChart(
              metrics.costTrend,
              "AI成本趋势(过去7天)",
              "bg-gradient-to-t from-emerald-500/80 to-emerald-400/80"
            )}
          </div>

          {/* 生产效率趋势 */}
          <div className="rounded-xl border border-white/10 bg-[#1a1a1a] p-6">
            {renderLineChart(
              metrics.efficiencyTrend,
              "生产效率趋势(过去7天)",
              "#3b82f6"
            )}
          </div>
        </div>

        {/* 快捷入口 */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-white">快捷入口</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            {renderQuickAccess(
              "AI成本详情",
              "查看详细的AI成本统计和分析",
              BarChart3,
              () => setActiveDetail("cost")
            )}
            {renderQuickAccess(
              "生产效率详情",
              "查看生产效率分析和优化建议",
              TrendingUp,
              () => setActiveDetail("efficiency")
            )}
            {renderQuickAccess(
              "团队绩效",
              "查看团队成员绩效数据(即将推出)",
              Users,
              onViewTeamPerformance
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* 顶部标题区域 */}
      <div className="rounded-xl border border-white/10 bg-[#1a1a1a] p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* 标题和简介 */}
          <div>
            <h2 className="text-xl font-bold text-white">数据统计与分析</h2>
            <p className="mt-1 text-sm text-[#888]">
              监控AI成本、生产效率和团队绩效，助力数据驱动决策
            </p>
          </div>

          {/* 时间范围筛选 */}
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#202020] p-1">
            {(["today", "week", "month", "all"] as const).map((range) => (
              <button
                key={range}
                onClick={() => handleTimeRangeChange(range)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-all",
                  timeRange === range
                    ? "bg-white/10 text-white"
                    : "text-[#888] hover:text-white hover:bg-white/5"
                )}
              >
                {range === "today" && "今天"}
                {range === "week" && "本周"}
                {range === "month" && "本月"}
                {range === "all" && "全部"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 详情视图导航 */}
      {activeDetail !== "overview" && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveDetail("overview")}
            className="flex items-center gap-1 text-sm text-[#888] transition-colors hover:text-white"
          >
            <ChevronRight className="h-4 w-4 rotate-180" />
            <span>返回概览</span>
          </button>
        </div>
      )}

      {/* 主内容区域 */}
      <div className="rounded-xl border border-white/10 bg-[#181818] p-6">
        {activeDetail === "overview" && renderOverview()}

        {activeDetail === "cost" && (
          <AICostStats data={aiCostData} onViewDetails={onViewAICostDetails} />
        )}

        {activeDetail === "efficiency" && (
          <ProductionEfficiency data={productionData} onViewDetails={onViewEfficiencyDetails} />
        )}
      </div>
    </div>
  );
}