/**
 * @file ai-cost-stats.tsx
 * @description AI成本统计组件，显示AI调用的成本和用量统计
 */

"use client";

import { useState } from "react";
import {
  DollarSign,
  Image,
  Video,
  MessageSquare,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tip } from "@/components/ui/tip";

/**
 * AI成本数据点类型
 */
export type AICostDataPoint = {
  /** 日期 */
  date: string;
  /** 总成本(美元) */
  totalCost: number;
  /** 图片生成成本 */
  imageCost: number;
  /** 视频生成成本 */
  videoCost: number;
  /** 聊天成本 */
  chatCost: number;
};

/**
 * AI成本统计数据类型
 */
export type AICostData = {
  /** 总成本(美元) */
  totalCost: number;
  /** 图片生成成本 */
  imageCost: number;
  /** 视频生成成本 */
  videoCost: number;
  /** 聊天成本 */
  chatCost: number;
  /** 预算上限(美元) */
  budget: number;
  /** 过去7天趋势数据 */
  trend: AICostDataPoint[];
  /** 优化建议列表 */
  suggestions: string[];
};

/**
 * AI成本统计组件属性
 */
type AICostStatsProps = {
  /** AI成本数据 */
  data: AICostData;
  /** 查看详情回调 */
  onViewDetails?: () => void;
};

/**
 * AI成本统计组件
 *
 * 功能：
 * - 显示AI成本详细统计(总成本、图片成本、视频成本、聊天成本)
 * - 显示成本趋势图表(过去7天)
 * - 显示成本分布(饼图或柱状图)
 * - 显示成本预算和消耗进度
 * - 显示成本优化建议
 */
export function AICostStats({ data, onViewDetails }: AICostStatsProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "distribution" | "trend">("overview");

  // 计算预算消耗百分比
  const budgetUsagePercent = Math.min((data.totalCost / data.budget) * 100, 100);

  // 计算成本分布百分比
  const totalCosts = data.imageCost + data.videoCost + data.chatCost;
  const imagePercent = totalCosts > 0 ? (data.imageCost / totalCosts) * 100 : 0;
  const videoPercent = totalCosts > 0 ? (data.videoCost / totalCosts) * 100 : 0;
  const chatPercent = totalCosts > 0 ? (data.chatCost / totalCosts) * 100 : 0;

  // 计算趋势变化
  const lastWeekCost = data.trend[0]?.totalCost || 0;
  const todayCost = data.trend[data.trend.length - 1]?.totalCost || 0;
  const costChange = lastWeekCost > 0 ? ((todayCost - lastWeekCost) / lastWeekCost) * 100 : 0;

  /**
   * 渲染成本卡片
   */
  const renderCostCard = (
    title: string,
    cost: number,
    icon: typeof DollarSign,
    color: string,
    bgColor: string
  ) => {
    const Icon = icon;
    return (
      <div className="rounded-lg border border-white/10 bg-[#1a1a1a] p-4 transition-all hover:border-white/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("rounded-lg p-2", bgColor)}>
              <Icon className={cn("h-5 w-5", color)} />
            </div>
            <div>
              <div className="text-xs text-[#888]">{title}</div>
              <div className="text-xl font-bold text-white">${cost.toFixed(2)}</div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  /**
   * 渲染趋势图表
   */
  const renderTrendChart = () => {
    const maxCost = Math.max(...data.trend.map((d) => d.totalCost), 1);
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-white">成本趋势(过去7天)</h3>
          <div className="flex items-center gap-1 text-xs">
            {costChange > 0 ? (
              <TrendingUp className="h-3 w-3 text-red-400" />
            ) : (
              <TrendingDown className="h-3 w-3 text-green-400" />
            )}
            <span className={costChange > 0 ? "text-red-400" : "text-green-400"}>
              {Math.abs(costChange).toFixed(1)}%
            </span>
          </div>
        </div>
        <div className="flex h-[200px] items-end gap-2">
          {data.trend.map((point, index) => {
            const heightPercent = (point.totalCost / maxCost) * 100;
            return (
              <div key={index} className="flex flex-1 flex-col items-center gap-2">
                <div className="relative w-full">
                  <Tip label={`$${point.totalCost.toFixed(2)}`} side="top">
                    <div
                      className="w-full rounded-t-md bg-gradient-to-t from-blue-500/80 to-blue-400/80 transition-all hover:from-blue-500 hover:to-blue-400"
                      style={{ height: `${Math.max(heightPercent, 5)}%` }}
                    />
                  </Tip>
                </div>
                <div className="text-xs text-[#666]">{point.date}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /**
   * 渲染成本分布图
   */
  const renderDistributionChart = () => {
    return (
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-white">成本分布</h3>

        {/* 分布条 */}
        <div className="h-8 overflow-hidden rounded-lg bg-[#202020]">
          <div className="flex h-full">
            {imagePercent > 0 && (
              <Tip label={`图片: ${imagePercent.toFixed(1)}%`} side="top">
                <div
                  className="flex items-center justify-center bg-purple-500/80 transition-all hover:bg-purple-500"
                  style={{ width: `${imagePercent}%` }}
                >
                  {imagePercent > 10 && (
                    <span className="text-xs font-medium text-white">{imagePercent.toFixed(0)}%</span>
                  )}
                </div>
              </Tip>
            )}
            {videoPercent > 0 && (
              <Tip label={`视频: ${videoPercent.toFixed(1)}%`} side="top">
                <div
                  className="flex items-center justify-center bg-cyan-500/80 transition-all hover:bg-cyan-500"
                  style={{ width: `${videoPercent}%` }}
                >
                  {videoPercent > 10 && (
                    <span className="text-xs font-medium text-white">{videoPercent.toFixed(0)}%</span>
                  )}
                </div>
              </Tip>
            )}
            {chatPercent > 0 && (
              <Tip label={`聊天: ${chatPercent.toFixed(1)}%`} side="top">
                <div
                  className="flex items-center justify-center bg-blue-500/80 transition-all hover:bg-blue-500"
                  style={{ width: `${chatPercent}%` }}
                >
                  {chatPercent > 10 && (
                    <span className="text-xs font-medium text-white">{chatPercent.toFixed(0)}%</span>
                  )}
                </div>
              </Tip>
            )}
          </div>
        </div>

        {/* 图例 */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-[#1a1a1a] p-3">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded bg-purple-500" />
              <span className="text-xs text-[#888]">图片生成</span>
            </div>
            <div className="mt-1 text-lg font-bold text-white">${data.imageCost.toFixed(2)}</div>
          </div>
          <div className="rounded-lg bg-[#1a1a1a] p-3">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded bg-cyan-500" />
              <span className="text-xs text-[#888]">视频生成</span>
            </div>
            <div className="mt-1 text-lg font-bold text-white">${data.videoCost.toFixed(2)}</div>
          </div>
          <div className="rounded-lg bg-[#1a1a1a] p-3">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded bg-blue-500" />
              <span className="text-xs text-[#888]">聊天</span>
            </div>
            <div className="mt-1 text-lg font-bold text-white">${data.chatCost.toFixed(2)}</div>
          </div>
        </div>
      </div>
    );
  };

  /**
   * 渲染预算进度
   */
  const renderBudgetProgress = () => {
    const isOverBudget = data.totalCost > data.budget;
    const progressColor = isOverBudget
      ? "from-red-500 to-red-400"
      : budgetUsagePercent > 80
        ? "from-yellow-500 to-yellow-400"
        : "from-emerald-500 to-emerald-400";

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-white">预算消耗</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#888]">
              ${data.totalCost.toFixed(2)} / ${data.budget.toFixed(2)}
            </span>
            {isOverBudget && <AlertCircle className="h-4 w-4 text-red-400" />}
          </div>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-[#202020]">
          <div
            className={cn(
              "h-full rounded-full bg-gradient-to-r transition-all",
              progressColor
            )}
            style={{ width: `${Math.min(budgetUsagePercent, 100)}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-[#666]">
            {isOverBudget
              ? "已超出预算"
              : `剩余 $${(data.budget - data.totalCost).toFixed(2)}`}
          </span>
          <span className={isOverBudget ? "text-red-400" : "text-[#888]"}>
            {budgetUsagePercent.toFixed(1)}%
          </span>
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
        <h3 className="text-sm font-medium text-white">优化建议</h3>
        <div className="space-y-2">
          {data.suggestions.map((suggestion, index) => (
            <div
              key={index}
              className="flex items-start gap-3 rounded-lg border border-white/5 bg-[#1a1a1a] p-3 transition-all hover:border-white/10"
            >
              <Info className="h-4 w-4 flex-shrink-0 text-blue-400" />
              <p className="text-xs text-[#aaa]">{suggestion}</p>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* 顶部标签切换 */}
      <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#202020] p-1">
        {(["overview", "distribution", "trend"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex-1 rounded-md px-4 py-2 text-sm font-medium transition-all",
              activeTab === tab
                ? "bg-white/10 text-white"
                : "text-[#888] hover:text-white hover:bg-white/5"
            )}
          >
            {tab === "overview" && "概览"}
            {tab === "distribution" && "分布"}
            {tab === "trend" && "趋势"}
          </button>
        ))}
      </div>

      {/* 概览视图 */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* 成本统计卡片 */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {renderCostCard("总成本", data.totalCost, DollarSign, "text-emerald-400", "bg-emerald-500/10")}
            {renderCostCard("图片生成", data.imageCost, Image, "text-purple-400", "bg-purple-500/10")}
            {renderCostCard("视频生成", data.videoCost, Video, "text-cyan-400", "bg-cyan-500/10")}
            {renderCostCard("聊天", data.chatCost, MessageSquare, "text-blue-400", "bg-blue-500/10")}
          </div>

          {/* 预算进度 */}
          {renderBudgetProgress()}

          {/* 优化建议 */}
          {renderSuggestions()}

          {/* 查看详情按钮 */}
          {onViewDetails && (
            <button
              onClick={onViewDetails}
              className="w-full rounded-lg border border-white/10 bg-[#202020] px-4 py-3 text-sm font-medium text-white transition-all hover:border-white/20 hover:bg-[#1a1a1a]"
            >
              查看详细成本报告 →
            </button>
          )}
        </div>
      )}

      {/* 分布视图 */}
      {activeTab === "distribution" && (
        <div className="space-y-6">
          {renderDistributionChart()}
          {renderBudgetProgress()}
        </div>
      )}

      {/* 趋势视图 */}
      {activeTab === "trend" && (
        <div className="space-y-6">
          {renderTrendChart()}
          {renderSuggestions()}
        </div>
      )}
    </div>
  );
}