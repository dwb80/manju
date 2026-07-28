/**
 * @file production-efficiency.tsx
 * @description 生产效率组件，显示项目生产效率和进度分析
 */

"use client";

import { useState } from "react";
import {
  Clock,
  CheckCircle,
  Activity,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  FileText,
  Image,
  Video,
  Eye,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 生产效率趋势数据点类型
 */
export type TrendDataPoint = {
  /** 日期 */
  date: string;
  /** 效率值(0-100) */
  efficiency: number;
  /** 完成任务数 */
  completedTasks: number;
  /** 平均完成时间(分钟) */
  avgTime: number;
};

/**
 * 生产阶段效率数据类型
 */
export type StageEfficiency = {
  /** 阶段名称 */
  stage: "script" | "storyboard" | "image" | "video" | "review";
  /** 阶段显示名称 */
  stageName: string;
  /** 效率值(0-100) */
  efficiency: number;
  /** 平均时间(分钟) */
  avgTime: number;
  /** 成功率(0-100) */
  successRate: number;
  /** 任务数 */
  taskCount: number;
};

/**
 * 生产效率统计数据类型
 */
export type ProductionEfficiencyData = {
  /** 平均完成时间(分钟) */
  avgCompletionTime: number;
  /** 成功率(0-100) */
  successRate: number;
  /** 任务吞吐量(任务/天) */
  throughput: number;
  /** 过去30天趋势数据 */
  trend: TrendDataPoint[];
  /** 各阶段效率数据 */
  stages: StageEfficiency[];
  /** 瓶颈分析 */
  bottlenecks: string[];
  /** 优化建议 */
  suggestions: string[];
};

/**
 * 生产效率分析组件属性
 */
type ProductionEfficiencyProps = {
  /** 生产效率数据 */
  data: ProductionEfficiencyData;
  /** 查看详情回调 */
  onViewDetails?: () => void;
};

/**
 * 生产效率分析组件
 *
 * 功能：
 * - 显示生产效率指标(平均完成时间、成功率、任务吞吐量)
 * - 显示效率趋势图表(过去30天)
 * - 显示各阶段效率对比(剧本/分镜/图片/视频/审核)
 * - 显示瓶颈分析
 * - 显示优化建议
 */
export function ProductionEfficiency({ data, onViewDetails }: ProductionEfficiencyProps) {
  const [activeView, setActiveView] = useState<"overview" | "stages" | "trend">("overview");

  // 计算趋势变化
  const lastWeekEfficiency = data.trend[data.trend.length - 7]?.efficiency || 0;
  const todayEfficiency = data.trend[data.trend.length - 1]?.efficiency || 0;
  const efficiencyChange =
    lastWeekEfficiency > 0 ? ((todayEfficiency - lastWeekEfficiency) / lastWeekEfficiency) * 100 : 0;

  // 阶段图标映射
  const stageIcons = {
    script: FileText,
    storyboard: Image,
    image: Image,
    video: Video,
    review: Eye,
  };

  // 阶段颜色映射
  const stageColors = {
    script: "text-info",
    storyboard: "text-chart-1",
    image: "text-chart-4",
    video: "text-chart-2",
    review: "text-primary",
  };

  /**
   * 渲染指标卡片
   */
  const renderMetricCard = (
    title: string,
    value: string | number,
    unit: string,
    icon: typeof Clock,
    color: string,
    bgColor: string,
    trend?: number
  ) => {
    const Icon = icon;
    return (
      <div className="rounded-lg border border-border bg-card p-4 transition-all hover:border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("rounded-lg p-2", bgColor)}>
              <Icon className={cn("h-5 w-5", color)} />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">{title}</div>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold text-foreground">{value}</span>
                <span className="text-xs text-muted-foreground">{unit}</span>
              </div>
            </div>
          </div>
          {trend !== undefined && (
            <div className="flex items-center gap-1">
              {trend > 0 ? (
                <TrendingUp className="h-3 w-3 text-primary" />
              ) : (
                <TrendingDown className="h-3 w-3 text-destructive" />
              )}
              <span className={cn("text-xs", trend > 0 ? "text-primary" : "text-destructive")}>
                {Math.abs(trend).toFixed(1)}%
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  /**
   * 渲染效率趋势图表
   */
  const renderTrendChart = () => {
    const maxEfficiency = 100;
    const recentTrend = data.trend.slice(-14); // 显示最近14天

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-foreground">效率趋势(最近14天)</h3>
          <div className="flex items-center gap-1 text-xs">
            {efficiencyChange > 0 ? (
              <TrendingUp className="h-3 w-3 text-primary" />
            ) : (
              <TrendingDown className="h-3 w-3 text-destructive" />
            )}
            <span className={efficiencyChange > 0 ? "text-primary" : "text-destructive"}>
              {Math.abs(efficiencyChange).toFixed(1)}%
            </span>
          </div>
        </div>

        {/* 折线图 */}
        <div className="relative h-[200px]">
          {/* Y轴刻度 */}
          <div className="absolute left-0 top-0 flex h-full flex-col justify-between text-xs text-muted-foreground">
            <span>100%</span>
            <span>50%</span>
            <span>0%</span>
          </div>

          {/* 图表区域 */}
          <div className="ml-10 flex h-full items-end">
            <svg className="w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
              {/* 网格线 */}
              {[0, 25, 50, 75, 100].map((y) => (
                <line
                  key={y}
                  x1="0"
                  y1={100 - y}
                  x2="100"
                  y2={100 - y}
                  stroke="hsl(var(--foreground) / 0.05)"
                  strokeWidth="0.5"
                />
              ))}

              {/* 折线 */}
              <polyline
                fill="none"
                stroke="url(#efficiencyGradient)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={recentTrend
                  .map((point, index) => {
                    const x = (index / (recentTrend.length - 1)) * 100;
                    const y = 100 - (point.efficiency / maxEfficiency) * 100;
                    return `${x},${y}`;
                  })
                  .join(" ")}
              />

              {/* 渐变定义 */}
              <defs>
                <linearGradient id="efficiencyGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="hsl(var(--info))" />
                  <stop offset="50%" stopColor="hsl(var(--chart-1))" />
                  <stop offset="100%" stopColor="hsl(var(--chart-2))" />
                </linearGradient>
              </defs>

              {/* 数据点 */}
              {recentTrend.map((point, index) => {
                const x = (index / (recentTrend.length - 1)) * 100;
                const y = 100 - (point.efficiency / maxEfficiency) * 100;
                return (
                  <circle
                    key={index}
                    cx={x}
                    cy={y}
                    r="1.5"
                    fill="hsl(var(--info))"
                    className="transition-all hover:r-2.5"
                  />
                );
              })}
            </svg>
          </div>
        </div>

        {/* X轴日期标签 */}
        <div className="ml-10 flex justify-between text-xs text-muted-foreground">
          <span>{recentTrend[0]?.date}</span>
          <span>{recentTrend[Math.floor(recentTrend.length / 2)]?.date}</span>
          <span>{recentTrend[recentTrend.length - 1]?.date}</span>
        </div>
      </div>
    );
  };

  /**
   * 渲染阶段效率对比
   */
  const renderStageComparison = () => {
    return (
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-foreground">各阶段效率对比</h3>
        <div className="space-y-3">
          {data.stages.map((stage) => {
            const Icon = stageIcons[stage.stage];
            const colorClass = stageColors[stage.stage];
            return (
              <div
                key={stage.stage}
                className="rounded-lg border border-border bg-card p-3 transition-all hover:border-border"
              >
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className={cn("h-4 w-4", colorClass)} />
                    <span className="text-sm font-medium text-foreground">{stage.stageName}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>效率: {stage.efficiency}%</span>
                    <span>成功率: {stage.successRate}%</span>
                    <span>任务数: {stage.taskCount}</span>
                  </div>
                </div>

                {/* 效率进度条 */}
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full bg-gradient-to-r",
                      stage.efficiency >= 80
                        ? "from-primary to-primary"
                        : stage.efficiency >= 60
                          ? "from-chart-5 to-chart-5"
                          : "from-destructive to-destructive"
                    )}
                    style={{ width: `${stage.efficiency}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /**
   * 渲染瓶颈分析
   */
  const renderBottlenecks = () => {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-chart-5" />
          <h3 className="text-sm font-medium text-foreground">瓶颈分析</h3>
        </div>
        <div className="space-y-2">
          {data.bottlenecks.map((bottleneck, index) => (
            <div
              key={index}
              className="flex items-start gap-3 rounded-lg border border-chart-5/20 bg-chart-5/5 p-3"
            >
              <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-chart-5/20">
                <span className="text-xs font-medium text-chart-5">{index + 1}</span>
              </div>
              <p className="text-xs text-muted-foreground">{bottleneck}</p>
            </div>
          ))}
        </div>
      </div>
    );
  };

  /**
   * 渲染优化建议
   */
  const renderSuggestions = () => {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-info" />
          <h3 className="text-sm font-medium text-foreground">优化建议</h3>
        </div>
        <div className="space-y-2">
          {data.suggestions.map((suggestion, index) => (
            <div
              key={index}
              className="flex items-start gap-3 rounded-lg border border-border/50 bg-card p-3 transition-all hover:border-border"
            >
              <CheckCircle className="h-4 w-4 flex-shrink-0 text-primary" />
              <p className="text-xs text-muted-foreground">{suggestion}</p>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* 顶部标签切换 */}
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted p-1">
        {(["overview", "stages", "trend"] as const).map((view) => (
          <button
            key={view}
            onClick={() => setActiveView(view)}
            className={cn(
              "flex-1 rounded-md px-4 py-2 text-sm font-medium transition-all",
              activeView === view
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            {view === "overview" && "概览"}
            {view === "stages" && "阶段分析"}
            {view === "trend" && "趋势"}
          </button>
        ))}
      </div>

      {/* 概览视图 */}
      {activeView === "overview" && (
        <div className="space-y-6">
          {/* 关键指标卡片 */}
          <div className="grid gap-4 sm:grid-cols-3">
            {renderMetricCard(
              "平均完成时间",
              data.avgCompletionTime,
              "分钟",
              Clock,
              "text-info",
              "bg-info/10"
            )}
            {renderMetricCard(
              "成功率",
              data.successRate,
              "%",
              CheckCircle,
              "text-primary",
              "bg-primary/10"
            )}
            {renderMetricCard(
              "任务吞吐量",
              data.throughput,
              "任务/天",
              Activity,
              "text-chart-1",
              "bg-chart-1/10"
            )}
          </div>

          {/* 瓶颈分析 */}
          {renderBottlenecks()}

          {/* 优化建议 */}
          {renderSuggestions()}

          {/* 查看详情按钮 */}
          {onViewDetails && (
            <button
              onClick={onViewDetails}
              className="w-full rounded-lg border border-border bg-muted px-4 py-3 text-sm font-medium text-foreground transition-all hover:border-border hover:bg-card"
            >
              查看详细效率报告 →
            </button>
          )}
        </div>
      )}

      {/* 阶段分析视图 */}
      {activeView === "stages" && (
        <div className="space-y-6">
          {renderStageComparison()}
          {renderBottlenecks()}
          {renderSuggestions()}
        </div>
      )}

      {/* 趋势视图 */}
      {activeView === "trend" && (
        <div className="space-y-6">
          {renderTrendChart()}
          {renderSuggestions()}
        </div>
      )}
    </div>
  );
}
