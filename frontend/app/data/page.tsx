"use client";

/**
 * 数据中心独立页面
 *
 * 功能：
 * - 监控AI成本、生产效率和团队绩效
 * - 支持时间范围筛选(今天/本周/本月/全部)
 * - 显示关键指标概览和详细数据
 * - 提供AI成本详情和生产效率详情入口
 *
 * 页面布局：
 * - 顶部：StandalonePageHeader + StatsOverview 关键指标
 * - 主体：DataCenter 组件
 * - 底部：数据来源 + 最后更新时间
 *
 * 数据来源：
 * - 通过真实API接口获取数据
 *
 * @module data/page
 */

import { useState, useEffect } from "react";
import { Database, DollarSign, Zap, TrendingUp, BarChart3, Factory, ShieldCheck } from "lucide-react";
import { DataCenter } from "@/components/data/data-center";
import { ProjectOverviewSection } from "@/components/data/project-overview-section";
import type { AICostData } from "@/components/data/ai-cost-stats";
import type { ProductionEfficiencyData } from "@/components/data/production-efficiency";
import {
  StandalonePageHeader,
  StatsOverview,
  Alert,
} from "@/components/layout";
import { createLogger } from "@/lib/logger";
import { useProjectStore } from "@/lib/stores/project-store";

// 模块级 logger
const log = createLogger('data-page')

/**
 * API响应格式
 */
interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

/**
 * 数据概览指标响应格式
 */
interface DataMetricsResponse {
  monthlyAICost: number;
  monthlyTaskCount: number;
  avgResponseTime: number;
  productionEfficiencyIndex: number;
  timeRange: "today" | "week" | "month" | "all";
}

/**
 * AI成本统计响应格式
 */
interface AICostResponse {
  totalCost: number;
  imageCost: number;
  videoCost: number;
  chatCost: number;
  costTrend: Array<{
    date: string;
    imageCost: number;
    videoCost: number;
    chatCost: number;
    totalCost: number;
  }>;
  budget: number;
  consumedBudget: number;
  consumptionRate: number;
  optimizationSuggestions: string[];
  timeRange: "today" | "week" | "month" | "all";
}

/**
 * 生产效率响应格式
 */
interface ProductionEfficiencyResponse {
  avgCompletionTime: number;
  successRate: number;
  taskThroughput: number;
  stageEfficiency: {
    script: { avgTime: number; successRate: number; taskCount: number };
    storyboard: { avgTime: number; successRate: number; taskCount: number };
    image: { avgTime: number; successRate: number; taskCount: number };
    video: { avgTime: number; successRate: number; taskCount: number };
    review: { avgTime: number; successRate: number; taskCount: number };
  };
  bottleneckAnalysis: {
    stage: string;
    avgTime: number;
    issue: string;
    suggestion: string;
  };
  optimizationSuggestions: string[];
  timeRange: "today" | "week" | "month" | "all";
}

/**
 * 数据中心页面组件
 */
export default function DataCenterPage() {
  // 加载状态
  const [loading, setLoading] = useState(false);
  // 最后更新时间（避免hydration错误）
  const [lastUpdate, setLastUpdate] = useState<string>("");
  // 时间范围状态
  const [timeRange, setTimeRange] = useState<"today" | "week" | "month" | "all">("month");
  // 加载错误
  const [loadError, setLoadError] = useState<string>("");

  // 概览指标数据
  const [metrics, setMetrics] = useState({
    monthlyAICost: 0,
    monthlyTasks: 0,
    avgResponseTime: 0,
    efficiencyIndex: 0,
    costTrend: [] as number[],
    efficiencyTrend: [] as number[],
  });

  // AI成本详细数据
  const [aiCostData, setAICostData] = useState<AICostData>({
    totalCost: 0,
    imageCost: 0,
    videoCost: 0,
    chatCost: 0,
    budget: 0,
    trend: [],
    suggestions: [],
  });

  // 生产效率详细数据
  const [productionData, setProductionData] = useState<ProductionEfficiencyData>({
    avgCompletionTime: 0,
    successRate: 0,
    throughput: 0,
    trend: [],
    stages: [],
    bottlenecks: [],
    suggestions: [],
  });

  /**
   * 加载数据中心数据
   * 通过真实API获取数据
   */
  async function loadData(range: "today" | "week" | "month" | "all") {
    setLoading(true);
    setLoadError("")
    log.debug('load data', { range })

    try {
      const [metricsResponse, aiCostResponse, productionResponse] = await Promise.all([
        fetch(`/api/data/metrics?timeRange=${range}`),
        fetch(`/api/data/ai-cost?timeRange=${range}`),
        fetch(`/api/data/production-efficiency?timeRange=${range}`),
      ]);

      const metricsResult: ApiResponse<DataMetricsResponse> = await metricsResponse.json();
      const aiCostResult: ApiResponse<AICostResponse> = await aiCostResponse.json();
      const productionResult: ApiResponse<ProductionEfficiencyResponse> = await productionResponse.json();

      // 处理概览指标
      if (metricsResult.code === 0 && metricsResult.data) {
        const m = metricsResult.data;
        setMetrics({
          monthlyAICost: m.monthlyAICost,
          monthlyTasks: m.monthlyTaskCount,
          avgResponseTime: m.avgResponseTime,
          efficiencyIndex: m.productionEfficiencyIndex,
          costTrend: [],
          efficiencyTrend: [],
        });
      } else {
        log.warn('metrics load failed', { message: metricsResult.message })
      }

      // 处理AI成本
      if (aiCostResult.code === 0 && aiCostResult.data) {
        const a = aiCostResult.data;
        setAICostData({
          totalCost: a.totalCost,
          imageCost: a.imageCost,
          videoCost: a.videoCost,
          chatCost: a.chatCost,
          budget: a.budget,
          trend: a.costTrend.map(item => ({
            date: item.date,
            totalCost: item.totalCost,
            imageCost: item.imageCost,
            videoCost: item.videoCost,
            chatCost: item.chatCost,
          })),
          suggestions: a.optimizationSuggestions,
        });
      } else {
        log.warn('ai cost load failed', { message: aiCostResult.message })
      }

      // 处理生产效率
      if (productionResult.code === 0 && productionResult.data) {
        const p = productionResult.data;
        setProductionData({
          avgCompletionTime: p.avgCompletionTime,
          successRate: p.successRate,
          throughput: p.taskThroughput,
          trend: [],
          stages: (["script", "storyboard", "image", "video", "review"] as const).map((key) => {
            const stageData = p.stageEfficiency[key]
            return {
              stage: key,
              stageName: STAGE_NAME_MAP[key],
              efficiency: Math.round(stageData.successRate * 100),
              avgTime: stageData.avgTime,
              successRate: stageData.successRate * 100,
              taskCount: stageData.taskCount,
            }
          }),
          bottlenecks: [p.bottleneckAnalysis.issue],
          suggestions: p.optimizationSuggestions,
        });
      } else {
        log.warn('production load failed', { message: productionResult.message })
      }

      // 任一接口失败则提示
      if (metricsResult.code !== 0 || aiCostResult.code !== 0 || productionResult.code !== 0) {
        setLoadError("部分数据加载失败，显示的可能是历史缓存")
      }
    } catch (err) {
      log.error('API call failed', { error: (err as Error).message })
      setLoadError(`API 调用失败：${(err as Error).message}`)
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData(timeRange);
    setLastUpdate(new Date().toLocaleString("zh-CN"));
  }, [timeRange]);

  function handleTimeRangeChange(range: "today" | "week" | "month" | "all") {
    setTimeRange(range);
  }

  function handleViewAICostDetails() {
    log.debug('view AI cost details')
  }

  function handleViewEfficiencyDetails() {
    log.debug('view efficiency details')
  }

  function handleViewTeamPerformance() {
    log.debug('view team performance')
  }

  function handleRefresh() {
    loadData(timeRange);
  }

  // 时间范围中文显示
  const timeRangeLabel = {
    today: "今日数据",
    week: "本周数据",
    month: "本月数据",
    all: "全部数据",
  }[timeRange]

  return (
    <main className="min-h-screen bg-[#181818] text-[#ececec]">
      {/* === 统一页面头 === */}
      <StandalonePageHeader
        title="数据中心"
        description="监控AI成本、生产效率和团队绩效，助力数据驱动决策。支持多维度数据分析和可视化展示。"
        breadcrumbs={["首页", "数据中心"]}
        extraRight={
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              <span>{timeRangeLabel}</span>
            </div>
            <button
              onClick={handleRefresh}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-[#888] transition-colors hover:bg-white/10 hover:text-white"
              aria-label="刷新数据"
              disabled={loading}
            >
              {loading ? "加载中..." : "刷新"}
            </button>
          </div>
        }
      />

      <div className="px-6 py-4 space-y-4">
        {/* === 错误提示（统一 Alert） === */}
        {loadError && <Alert tone="error">{loadError}</Alert>}

        {/* === 统一统计卡组：关键指标 === */}
        <StatsOverview
          columns={4}
          cards={[
            {
              tone: "blue",
              icon: <DollarSign className="h-4 w-4" />,
              title: "AI 成本",
              value: `¥${metrics.monthlyAICost.toLocaleString()}`,
              sub: timeRangeLabel,
            },
            {
              tone: "purple",
              icon: <Zap className="h-4 w-4" />,
              title: "月度任务数",
              value: metrics.monthlyTasks.toLocaleString(),
              sub: "已完成任务",
            },
            {
              tone: "amber",
              icon: <TrendingUp className="h-4 w-4" />,
              title: "平均响应",
              value: `${metrics.avgResponseTime}s`,
              sub: "全平台均值",
            },
            {
              tone: "emerald",
              icon: <TrendingUp className="h-4 w-4" />,
              title: "生产效率",
              value: `${metrics.efficiencyIndex}`,
              sub: "综合指数",
            },
          ]}
        />
      </div>

      {/* 页面主体 */}
      <section className="px-6 py-6">
        <DataCenter
          metrics={metrics}
          aiCostData={aiCostData}
          productionData={productionData}
          onViewAICostDetails={handleViewAICostDetails}
          onViewEfficiencyDetails={handleViewEfficiencyDetails}
          onViewTeamPerformance={handleViewTeamPerformance}
          onTimeRangeChange={handleTimeRangeChange}
        />
      </section>

      {/* spec 4.3 项目维度数据中心（成本/产能/质量 3 子 Tab） */}
      <section className="px-6 py-2">
        <ProjectOverviewSection />
      </section>

      <footer className="border-t border-white/10 px-6 py-4 text-xs text-[#666]">
        <div className="flex items-center justify-between">
          <div>数据来源：真实API接口</div>
          <div suppressHydrationWarning>
            最后更新：{lastUpdate || "加载中..."}
          </div>
        </div>
      </footer>
    </main>
  );
}

// 阶段名映射
const STAGE_NAME_MAP: Record<string, string> = {
  script: "剧本创作",
  storyboard: "分镜设计",
  image: "图片生成",
  video: "视频生成",
  review: "审核环节",
}