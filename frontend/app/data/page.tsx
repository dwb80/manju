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
 * - 顶部：页面标题 + 返回首页按钮 + 面包屑导航
 * - 主体：DataCenter组件
 *
 * 数据来源：
 * - 通过真实API接口获取数据
 *
 * @module data/page
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, LayoutDashboard, Database } from "lucide-react";
import { DataCenter } from "@/components/data/data-center";
import type { AICostData } from "@/components/data/ai-cost-stats";
import type { ProductionEfficiencyData } from "@/components/data/production-efficiency";

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
    script: {
      avgTime: number;
      successRate: number;
      taskCount: number;
    };
    storyboard: {
      avgTime: number;
      successRate: number;
      taskCount: number;
    };
    image: {
      avgTime: number;
      successRate: number;
      taskCount: number;
    };
    video: {
      avgTime: number;
      successRate: number;
      taskCount: number;
    };
    review: {
      avgTime: number;
      successRate: number;
      taskCount: number;
    };
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
  // 路由导航
  const router = useRouter();

  // 加载状态
  const [loading, setLoading] = useState(false);

  // 最后更新时间（避免hydration错误）
  const [lastUpdate, setLastUpdate] = useState<string>("");

  // 时间范围状态
  const [timeRange, setTimeRange] = useState<"today" | "week" | "month" | "all">("month");

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

    try {
      // 并行调用3个API接口
      const [metricsResponse, aiCostResponse, productionResponse] = await Promise.all([
        fetch(`/api/data/metrics?timeRange=${range}`),
        fetch(`/api/data/ai-cost?timeRange=${range}`),
        fetch(`/api/data/production-efficiency?timeRange=${range}`),
      ]);

      // 解析响应
      const metricsResult: ApiResponse<DataMetricsResponse> = await metricsResponse.json();
      const aiCostResult: ApiResponse<AICostResponse> = await aiCostResponse.json();
      const productionResult: ApiResponse<ProductionEfficiencyResponse> = await productionResponse.json();

      // 处理概览指标数据
      if (metricsResult.code === 0 && metricsResult.data) {
        const metricsData = metricsResult.data;
        setMetrics({
          monthlyAICost: metricsData.monthlyAICost,
          monthlyTasks: metricsData.monthlyTaskCount,
          avgResponseTime: metricsData.avgResponseTime,
          efficiencyIndex: metricsData.productionEfficiencyIndex,
          costTrend: [], // API未返回趋势数据，暂时使用空数组
          efficiencyTrend: [], // API未返回趋势数据，暂时使用空数组
        });
      } else {
        console.error("获取概览指标失败:", metricsResult.message);
      }

      // 处理AI成本数据
      if (aiCostResult.code === 0 && aiCostResult.data) {
        const aiCostData = aiCostResult.data;
        setAICostData({
          totalCost: aiCostData.totalCost,
          imageCost: aiCostData.imageCost,
          videoCost: aiCostData.videoCost,
          chatCost: aiCostData.chatCost,
          budget: aiCostData.budget,
          trend: aiCostData.costTrend.map(item => ({
            date: item.date,
            totalCost: item.totalCost,
            imageCost: item.imageCost,
            videoCost: item.videoCost,
            chatCost: item.chatCost,
          })),
          suggestions: aiCostData.optimizationSuggestions,
        });
      } else {
        console.error("获取AI成本数据失败:", aiCostResult.message);
      }

      // 处理生产效率数据
      if (productionResult.code === 0 && productionResult.data) {
        const productionData = productionResult.data;
        setProductionData({
          avgCompletionTime: productionData.avgCompletionTime,
          successRate: productionData.successRate,
          throughput: productionData.taskThroughput,
          trend: [], // API未返回趋势数据，暂时使用空数组
          stages: [
            {
              stage: "script",
              stageName: "剧本创作",
              efficiency: Math.round(productionData.stageEfficiency.script.successRate * 100),
              avgTime: productionData.stageEfficiency.script.avgTime,
              successRate: productionData.stageEfficiency.script.successRate * 100,
              taskCount: productionData.stageEfficiency.script.taskCount,
            },
            {
              stage: "storyboard",
              stageName: "分镜设计",
              efficiency: Math.round(productionData.stageEfficiency.storyboard.successRate * 100),
              avgTime: productionData.stageEfficiency.storyboard.avgTime,
              successRate: productionData.stageEfficiency.storyboard.successRate * 100,
              taskCount: productionData.stageEfficiency.storyboard.taskCount,
            },
            {
              stage: "image",
              stageName: "图片生成",
              efficiency: Math.round(productionData.stageEfficiency.image.successRate * 100),
              avgTime: productionData.stageEfficiency.image.avgTime,
              successRate: productionData.stageEfficiency.image.successRate * 100,
              taskCount: productionData.stageEfficiency.image.taskCount,
            },
            {
              stage: "video",
              stageName: "视频生成",
              efficiency: Math.round(productionData.stageEfficiency.video.successRate * 100),
              avgTime: productionData.stageEfficiency.video.avgTime,
              successRate: productionData.stageEfficiency.video.successRate * 100,
              taskCount: productionData.stageEfficiency.video.taskCount,
            },
            {
              stage: "review",
              stageName: "审核环节",
              efficiency: Math.round(productionData.stageEfficiency.review.successRate * 100),
              avgTime: productionData.stageEfficiency.review.avgTime,
              successRate: productionData.stageEfficiency.review.successRate * 100,
              taskCount: productionData.stageEfficiency.review.taskCount,
            },
          ],
          bottlenecks: [productionData.bottleneckAnalysis.issue],
          suggestions: productionData.optimizationSuggestions,
        });
      } else {
        console.error("获取生产效率数据失败:", productionResult.message);
      }
    } catch (error) {
      console.error("API调用失败:", error);
    } finally {
      setLoading(false);
    }
  }

  /**
   * 页面加载时获取数据和设置时间
   */
  useEffect(() => {
    loadData(timeRange);
    setLastUpdate(new Date().toLocaleString("zh-CN"));
  }, [timeRange]);

  /**
   * 处理时间范围变化
   */
  function handleTimeRangeChange(range: "today" | "week" | "month" | "all") {
    setTimeRange(range);
  }

  /**
   * 查看AI成本详情
   */
  function handleViewAICostDetails() {
    // TODO: 跳转到AI成本详情页面或打开详情弹窗
    console.log("查看AI成本详情");
  }

  /**
   * 查看生产效率详情
   */
  function handleViewEfficiencyDetails() {
    // TODO: 跳转到生产效率详情页面或打开详情弹窗
    console.log("查看生产效率详情");
  }

  /**
   * 查看团队绩效
   */
  function handleViewTeamPerformance() {
    // TODO: 跳转到团队绩效页面或打开绩效弹窗
    console.log("查看团队绩效");
  }

  /**
   * 返回首页
   */
  function goBackToHome() {
    router.push("/");
  }

  /**
   * 刷新数据
   */
  function handleRefresh() {
    loadData(timeRange);
  }

  return (
    <main className="min-h-screen bg-[#181818] text-[#ececec]">
      {/* 页面头部 */}
      <header className="sticky top-0 z-10 border-b border-white/10 bg-[#181818]/95 px-6 py-4 backdrop-blur">
        <div className="flex items-center justify-between">
          {/* 左侧：返回按钮和标题 */}
          <div className="flex items-center gap-4">
            {/* 返回首页按钮 */}
            <button
              onClick={goBackToHome}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-[#888] transition-colors hover:bg-white/10 hover:text-white"
              aria-label="返回首页"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>返回首页</span>
            </button>

            {/* 分隔线 */}
            <div className="h-4 w-px bg-white/20" />

            {/* 面包屑导航 */}
            <nav className="flex items-center gap-2 text-sm text-[#888]">
              <button
                onClick={goBackToHome}
                className="flex items-center gap-1 hover:text-white"
              >
                <LayoutDashboard className="h-3 w-3" />
                <span>首页</span>
              </button>
              <span className="text-white/40">/</span>
              <span className="flex items-center gap-1 text-white font-medium">
                <Database className="h-3 w-3" />
                <span>数据中心</span>
              </span>
            </nav>
          </div>

          {/* 右侧：页面信息和刷新按钮 */}
          <div className="flex items-center gap-4">
            {/* 当前时间范围 */}
            <div className="text-xs text-[#888]">
              {timeRange === "today" && "今日数据"}
              {timeRange === "week" && "本周数据"}
              {timeRange === "month" && "本月数据"}
              {timeRange === "all" && "全部数据"}
            </div>

            {/* 刷新按钮 */}
            <button
              onClick={handleRefresh}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-[#888] transition-colors hover:bg-white/10 hover:text-white"
              aria-label="刷新数据"
              disabled={loading}
            >
              <span>{loading ? "加载中..." : "刷新"}</span>
            </button>
          </div>
        </div>

        {/* 页面标题和描述 */}
        <div className="mt-4">
          <h1 className="text-2xl font-bold text-white">
            数据中心
          </h1>
          <p className="mt-1 text-sm text-[#888]">
            监控AI成本、生产效率和团队绩效，助力数据驱动决策。支持多维度数据分析和可视化展示。
          </p>
        </div>
      </header>

      {/* 页面主体：数据中心组件 */}
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

      {/* 页面底部信息 */}
      <footer className="border-t border-white/10 px-6 py-4 text-xs text-[#666]">
        <div className="flex items-center justify-between">
          <div>
            数据来源：真实API接口
          </div>
          <div suppressHydrationWarning>
            最后更新：{lastUpdate || "加载中..."}
          </div>
        </div>
      </footer>
    </main>
  );
}