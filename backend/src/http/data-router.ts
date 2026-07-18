/**
 * @file data-router.ts
 * @description 数据中心路由模块
 *
 * 提供数据统计和分析相关的 API 端点：
 * - 数据概览指标（AI 成本、任务数、响应时间、生产效率）
 * - AI 成本统计（分类成本、趋势、预算、优化建议）
 * - 生产效率分析（各阶段效率、瓶颈分析）
 *
 * 支持的时间范围：today / week / month / all
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AppContext } from "../services/app.js";
import type { ImageTask, VideoTask, Message, ProjectScript, ProjectStoryboard, ProjectReview } from "../types.js";
import { rootLogger } from "../logger.js";
import { getRawDatabase } from "../storage/sqlite.js";

/**
 * 时间范围类型定义
 */
export type TimeRange = "today" | "week" | "month" | "all";

/**
 * 数据概览指标响应格式
 */
export interface DataMetricsResponse {
  /** 月度AI成本(单位:元) */
  monthlyAICost: number;
  /** 月度任务数 */
  monthlyTaskCount: number;
  /** 平均响应时间(单位:秒) */
  avgResponseTime: number;
  /** 生产效率指数(0-100) */
  productionEfficiencyIndex: number;
  /** 时间范围 */
  timeRange: TimeRange;
}

/**
 * AI成本统计响应格式
 */
export interface AICostResponse {
  /** 总成本(单位:元) */
  totalCost: number;
  /** 图片生成成本(单位:元) */
  imageCost: number;
  /** 视频生成成本(单位:元) */
  videoCost: number;
  /** 聊天成本(单位:元) */
  chatCost: number;
  /** 成本趋势数据(过去7天或14天) */
  costTrend: Array<{
    date: string;
    imageCost: number;
    videoCost: number;
    chatCost: number;
    totalCost: number;
  }>;
  /** 成本预算(单位:元) */
  budget: number;
  /** 已消耗预算(单位:元) */
  consumedBudget: number;
  /** 消耗进度百分比 */
  consumptionRate: number;
  /** 成本优化建议 */
  optimizationSuggestions: string[];
  /** 时间范围 */
  timeRange: TimeRange;
}

/**
 * 生产效率响应格式
 */
export interface ProductionEfficiencyResponse {
  /** 平均完成时间(单位:小时) */
  avgCompletionTime: number;
  /** 成功率百分比 */
  successRate: number;
  /** 任务吞吐量(单位:个/天) */
  taskThroughput: number;
  /** 各阶段效率对比 */
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
  /** 瓶颈分析 */
  bottleneckAnalysis: {
    stage: string;
    avgTime: number;
    issue: string;
    suggestion: string;
  };
  /** 优化建议 */
  optimizationSuggestions: string[];
  /** 时间范围 */
  timeRange: TimeRange;
}

/**
 * getTimeRangeStart - 计算时间范围的起始时间
 * @param {TimeRange} timeRange - 时间范围类型
 * @returns {Date} 起始时间
 */
function getTimeRangeStart(timeRange: TimeRange): Date {
  const now = new Date();
  switch (timeRange) {
    case "today":
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case "week":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "month":
      return new Date(now.getFullYear(), now.getMonth(), 1);
    case "all":
      return new Date(2020, 0, 1); // 返回一个很早的时间
    default:
      return new Date(now.getFullYear(), now.getMonth(), 1);
  }
}

/**
 * calculateImageCost - 计算图片生成成本
 * @param {ImageTask} task - 图片任务对象
 * @returns {number} 成本（单位：元）
 * @description 基于模型和分辨率估算成本，基础成本 0.05 元/张
 */
function calculateImageCost(task: ImageTask): number {
  // 基础成本: 0.05元/张
  const baseCost = 0.05;

  // 根据分辨率调整成本
  const size = task.params.size || "1024x768";
  let sizeMultiplier = 1;
  if (size === "1024x1024" || size === "768x1152") {
    sizeMultiplier = 1.2;
  } else if (size === "1152x768") {
    sizeMultiplier = 1.1;
  }

  // 根据生成数量计算
  const count = task.image_urls?.length || 0;

  // 如果任务失败,成本为0
  if (task.status !== "success") {
    return 0;
  }

  return baseCost * sizeMultiplier * count;
}

/**
 * calculateVideoCost - 计算视频生成成本
 * @param {VideoTask} task - 视频任务对象
 * @returns {number} 成本（单位：元）
 * @description 基于模型、时长和分辨率估算成本，基础成本 0.5 元/秒
 */
function calculateVideoCost(task: VideoTask): number {
  // 基础成本: 0.5元/秒
  const baseCostPerSecond = 0.5;

  // 根据时长计算
  const seconds = parseFloat(task.seconds || "0");

  // 根据模型调整成本
  const model = task.params.model || "agnes-video-v2.0";
  let modelMultiplier = 1;
  if (model.includes("v3") || model.includes("pro")) {
    modelMultiplier = 1.5;
  }

  // 根据分辨率调整成本
  const ratio = task.params.ratio || "16:9";
  let ratioMultiplier = 1;
  if (ratio === "9:16" || ratio === "1:1") {
    ratioMultiplier = 1.1;
  }

  // 如果任务失败,成本为0
  if (task.status !== "success") {
    return 0;
  }

  return baseCostPerSecond * seconds * modelMultiplier * ratioMultiplier;
}

/**
 * calculateChatCost - 计算聊天成本
 * @param {Message} message - 消息对象
 * @returns {number} 成本（单位：元）
 * @description 基于 token 消耗估算成本，基础成本 0.001 元/千 token
 */
function calculateChatCost(message: Message): number {
  // 基础成本: 0.001元/千token
  const costPerThousandTokens = 0.001;

  const tokens = message.tokens || 0;
  return (tokens / 1000) * costPerThousandTokens;
}

/**
 * getDataMetrics - 获取数据概览指标
 * @param {AppContext} ctx - 应用上下文
 * @param {TimeRange} timeRange - 时间范围
 * @returns {Promise<DataMetricsResponse>} 数据概览指标响应
 */
async function getDataMetrics(ctx: AppContext, timeRange: TimeRange): Promise<DataMetricsResponse> {
  const startTime = getTimeRangeStart(timeRange);
  const startTimeStr = startTime.toISOString();

  // 获取图片任务
  const imageTasks = await ctx.images.findMany({}, { sort: "desc" });
  const filteredImageTasks = imageTasks.filter(task => task.created_at >= startTimeStr);

  // 获取视频任务
  const videoTasks = await ctx.videos.findMany({}, { sort: "desc" });
  const filteredVideoTasks = videoTasks.filter(task => task.created_at >= startTimeStr);

  // 获取消息(用于聊天成本统计)
  const messages = await ctx.messages.findMany({}, { sort: "desc" });
  const filteredMessages = messages.filter(msg => msg.created_at >= startTimeStr);

  // 计算AI成本
  const imageCost = filteredImageTasks.reduce((sum, task) => sum + calculateImageCost(task), 0);
  const videoCost = filteredVideoTasks.reduce((sum, task) => sum + calculateVideoCost(task), 0);
  const chatCost = filteredMessages.reduce((sum, msg) => sum + calculateChatCost(msg), 0);
  const monthlyAICost = imageCost + videoCost + chatCost;

  // 计算任务数
  const monthlyTaskCount = filteredImageTasks.length + filteredVideoTasks.length;

  // 计算平均响应时间(基于成功任务)
  const successImageTasks = filteredImageTasks.filter(task => task.status === "success");
  const successVideoTasks = filteredVideoTasks.filter(task => task.status === "success");

  // 响应时间估算:图片平均30秒,视频平均180秒
  const avgImageTime = successImageTasks.length > 0 ? 30 : 0;
  const avgVideoTime = successVideoTasks.length > 0 ? 180 : 0;
  const totalTasks = successImageTasks.length + successVideoTasks.length;
  const avgResponseTime = totalTasks > 0
    ? (avgImageTime * successImageTasks.length + avgVideoTime * successVideoTasks.length) / totalTasks
    : 0;

  // 计算生产效率指数
  // 效率 = 成功率 * 速度系数 * 成本系数
  const successRate = totalTasks > 0 ? totalTasks / monthlyTaskCount : 0;
  const speedFactor = avgResponseTime > 0 ? Math.max(0.1, 100 / avgResponseTime) : 1;
  const costFactor = monthlyAICost > 0 ? Math.max(0.1, 50 / monthlyAICost) : 1;
  const productionEfficiencyIndex = Math.min(100, successRate * speedFactor * costFactor * 100);

  return {
    monthlyAICost,
    monthlyTaskCount,
    avgResponseTime,
    productionEfficiencyIndex: Math.round(productionEfficiencyIndex),
    timeRange,
  };
}

/**
 * getAICost - 获取 AI 成本统计数据
 * @param {AppContext} ctx - 应用上下文
 * @param {TimeRange} timeRange - 时间范围
 * @returns {Promise<AICostResponse>} AI 成本统计响应
 */
async function getAICost(ctx: AppContext, timeRange: TimeRange): Promise<AICostResponse> {
  const startTime = getTimeRangeStart(timeRange);
  const startTimeStr = startTime.toISOString();

  // 获取所有任务和消息
  const imageTasks = await ctx.images.findMany({}, { sort: "desc" });
  const videoTasks = await ctx.videos.findMany({}, { sort: "desc" });
  const messages = await ctx.messages.findMany({}, { sort: "desc" });

  // 按时间范围筛选
  const filteredImageTasks = imageTasks.filter(task => task.created_at >= startTimeStr);
  const filteredVideoTasks = videoTasks.filter(task => task.created_at >= startTimeStr);
  const filteredMessages = messages.filter(msg => msg.created_at >= startTimeStr);

  // 计算总成本
  const imageCost = filteredImageTasks.reduce((sum, task) => sum + calculateImageCost(task), 0);
  const videoCost = filteredVideoTasks.reduce((sum, task) => sum + calculateVideoCost(task), 0);
  const chatCost = filteredMessages.reduce((sum, msg) => sum + calculateChatCost(msg), 0);
  const totalCost = imageCost + videoCost + chatCost;

  // 计算成本趋势(过去7天或14天)
  const trendDays = timeRange === "today" ? 7 : 14;
  const costTrend = [];
  const now = new Date();

  for (let i = trendDays - 1; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().slice(0, 10);
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString();
    const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).toISOString();

    // 筛选当天的数据
    const dayImageTasks = imageTasks.filter(task =>
      task.created_at >= dayStart && task.created_at < dayEnd
    );
    const dayVideoTasks = videoTasks.filter(task =>
      task.created_at >= dayStart && task.created_at < dayEnd
    );
    const dayMessages = messages.filter(msg =>
      msg.created_at >= dayStart && msg.created_at < dayEnd
    );

    // 计算当天成本
    const dayImageCost = dayImageTasks.reduce((sum, task) => sum + calculateImageCost(task), 0);
    const dayVideoCost = dayVideoTasks.reduce((sum, task) => sum + calculateVideoCost(task), 0);
    const dayChatCost = dayMessages.reduce((sum, msg) => sum + calculateChatCost(msg), 0);
    const dayTotalCost = dayImageCost + dayVideoCost + dayChatCost;

    costTrend.push({
      date: dateStr,
      imageCost: dayImageCost,
      videoCost: dayVideoCost,
      chatCost: dayChatCost,
      totalCost: dayTotalCost,
    });
  }

  // 成本预算(假设为1000元)
  const budget = 1000;
  const consumedBudget = totalCost;
  const consumptionRate = (consumedBudget / budget) * 100;

  // 成本优化建议
  const optimizationSuggestions: string[] = [];

  if (imageCost > videoCost && imageCost > chatCost) {
    optimizationSuggestions.push("图片生成成本占比最高,建议优化图片生成数量和质量要求");
  }
  if (videoCost > imageCost && videoCost > chatCost) {
    optimizationSuggestions.push("视频生成成本占比最高,建议减少视频时长或降低分辨率要求");
  }
  if (chatCost > 50) {
    optimizationSuggestions.push("聊天成本较高,建议优化提示词长度或减少对话轮次");
  }
  if (consumptionRate > 80) {
    optimizationSuggestions.push("预算消耗已超过80%,建议控制后续生成频率");
  }
  if (optimizationSuggestions.length === 0) {
    optimizationSuggestions.push("当前成本控制良好,继续保持");
  }

  return {
    totalCost,
    imageCost,
    videoCost,
    chatCost,
    costTrend,
    budget,
    consumedBudget,
    consumptionRate,
    optimizationSuggestions,
    timeRange,
  };
}

/**
 * getProductionEfficiency - 获取生产效率数据
 * @param {AppContext} ctx - 应用上下文
 * @param {TimeRange} timeRange - 时间范围
 * @returns {Promise<ProductionEfficiencyResponse>} 生产效率响应
 */
async function getProductionEfficiency(ctx: AppContext, timeRange: TimeRange): Promise<ProductionEfficiencyResponse> {
  const startTime = getTimeRangeStart(timeRange);
  const startTimeStr = startTime.toISOString();

  // 获取剧本数据
  const scripts = await ctx.projectScripts.findMany({}, { sort: "desc" });
  const filteredScripts = scripts.filter((script: ProjectScript) => script.created_at >= startTimeStr);

  // 获取分镜数据
  const storyboards = await ctx.projectStoryboards.findMany({}, { sort: "desc" });
  const filteredStoryboards = storyboards.filter(storyboard => storyboard.created_at >= startTimeStr);

  // 获取图片任务
  const imageTasks = await ctx.images.findMany({}, { sort: "desc" });
  const filteredImageTasks = imageTasks.filter(task => task.created_at >= startTimeStr);

  // 获取视频任务
  const videoTasks = await ctx.videos.findMany({}, { sort: "desc" });
  const filteredVideoTasks = videoTasks.filter(task => task.created_at >= startTimeStr);

  // 获取审核数据
  const reviews = await ctx.projectReviews.findMany({}, { sort: "desc" });
  const filteredReviews = reviews.filter((review: ProjectReview) => review.created_at >= startTimeStr);

  // 计算各阶段效率
  const stageEfficiency = {
    script: {
      avgTime: calculateStageAvgTime(filteredScripts, "script"),
      successRate: calculateStageSuccessRate(filteredScripts, "script"),
      taskCount: filteredScripts.length,
    },
    storyboard: {
      avgTime: calculateStageAvgTime(filteredStoryboards, "storyboard"),
      successRate: calculateStageSuccessRate(filteredStoryboards, "storyboard"),
      taskCount: filteredStoryboards.length,
    },
    image: {
      avgTime: calculateStageAvgTime(filteredImageTasks, "image"),
      successRate: calculateStageSuccessRate(filteredImageTasks, "image"),
      taskCount: filteredImageTasks.length,
    },
    video: {
      avgTime: calculateStageAvgTime(filteredVideoTasks, "video"),
      successRate: calculateStageSuccessRate(filteredVideoTasks, "video"),
      taskCount: filteredVideoTasks.length,
    },
    review: {
      avgTime: calculateStageAvgTime(filteredReviews, "review"),
      successRate: calculateStageSuccessRate(filteredReviews, "review"),
      taskCount: filteredReviews.length,
    },
  };

  // 计算总体平均完成时间
  const totalAvgTime = (
    stageEfficiency.script.avgTime +
    stageEfficiency.storyboard.avgTime +
    stageEfficiency.image.avgTime +
    stageEfficiency.video.avgTime +
    stageEfficiency.review.avgTime
  ) / 5;

  // 计算总体成功率
  const totalTasks = (
    stageEfficiency.script.taskCount +
    stageEfficiency.storyboard.taskCount +
    stageEfficiency.image.taskCount +
    stageEfficiency.video.taskCount +
    stageEfficiency.review.taskCount
  );
  const successTasks = (
    stageEfficiency.script.taskCount * stageEfficiency.script.successRate +
    stageEfficiency.storyboard.taskCount * stageEfficiency.storyboard.successRate +
    stageEfficiency.image.taskCount * stageEfficiency.image.successRate +
    stageEfficiency.video.taskCount * stageEfficiency.video.successRate +
    stageEfficiency.review.taskCount * stageEfficiency.review.successRate
  );
  const successRate = totalTasks > 0 ? (successTasks / totalTasks) : 0;

  // 计算任务吞吐量(按天计算)
  const daysCount = timeRange === "today" ? 1 : timeRange === "week" ? 7 : timeRange === "month" ? 30 : 365;
  const taskThroughput = totalTasks / daysCount;

  // 瓶颈分析
  const bottleneckAnalysis = identifyBottleneck(stageEfficiency);

  // 优化建议
  const optimizationSuggestions: string[] = [];

  if (bottleneckAnalysis.stage === "video" && bottleneckAnalysis.avgTime > 5) {
    optimizationSuggestions.push("视频生成阶段耗时较长,建议降低视频时长要求或优化提示词质量");
  }
  if (stageEfficiency.image.successRate < 0.8) {
    optimizationSuggestions.push("图片生成成功率偏低,建议优化提示词或调整生成参数");
  }
  if (stageEfficiency.review.taskCount > stageEfficiency.image.taskCount * 0.3) {
    optimizationSuggestions.push("审核任务数量较多,建议提高初次生成质量以减少审核返工");
  }
  if (optimizationSuggestions.length === 0) {
    optimizationSuggestions.push("当前生产效率良好,继续保持");
  }

  return {
    avgCompletionTime: totalAvgTime,
    successRate: Math.round(successRate * 100),
    taskThroughput: Math.round(taskThroughput * 10) / 10,
    stageEfficiency,
    bottleneckAnalysis,
    optimizationSuggestions,
    timeRange,
  };
}

/**
 * calculateStageAvgTime - 计算各阶段平均完成时间
 * @param {any[]} items - 阶段任务列表
 * @param {string} stage - 阶段名称
 * @returns {number} 平均完成时间（单位：小时）
 */
function calculateStageAvgTime(items: any[], stage: string): number {
  if (items.length === 0) return 0;

  // 根据阶段估算平均时间
  const stageBaseTimes: Record<string, number> = {
    script: 2, // 剧本平均2小时
    storyboard: 1, // 分镜平均1小时
    image: 0.5, // 图片平均0.5小时
    video: 3, // 视频平均3小时
    review: 0.5, // 审核平均0.5小时
  };

  return stageBaseTimes[stage] || 1;
}

/**
 * calculateStageSuccessRate - 计算各阶段成功率
 * @param {any[]} items - 阶段任务列表
 * @param {string} stage - 阶段名称
 * @returns {number} 成功率（0-1）
 */
function calculateStageSuccessRate(items: any[], stage: string): number {
  if (items.length === 0) return 1;

  // 根据不同类型计算成功率
  switch (stage) {
    case "script":
      // 剧本成功率基于status字段
      const readyScripts = items.filter(item => item.status === "ready" || item.status === "storyboarded");
      return readyScripts.length / items.length;
    case "storyboard":
      // 分镜成功率基于status字段
      const doneStoryboards = items.filter(item =>
        item.status === "image" || item.status === "video" || item.status === "review" || item.status === "done"
      );
      return doneStoryboards.length / items.length;
    case "image":
      // 图片成功率基于status字段
      const successImages = items.filter(item => item.status === "success");
      return successImages.length / items.length;
    case "video":
      // 视频成功率基于status字段
      const successVideos = items.filter(item => item.status === "success");
      return successVideos.length / items.length;
    case "review":
      // 审核成功率基于status字段
      const resolvedReviews = items.filter(item => item.status === "resolved");
      return resolvedReviews.length / items.length;
    default:
      return 1;
  }
}

/**
 * identifyBottleneck - 识别瓶颈阶段
 * @param {any} stageEfficiency - 各阶段效率数据
 * @returns {Object} 瓶颈分析结果（阶段、耗时、问题、建议）
 */
function identifyBottleneck(stageEfficiency: any): {
  stage: string;
  avgTime: number;
  issue: string;
  suggestion: string;
} {
  const stages: ("script" | "storyboard" | "image" | "video" | "review")[] = ["script", "storyboard", "image", "video", "review"];
  let bottleneck: "script" | "storyboard" | "image" | "video" | "review" = stages[0];
  let maxAvgTime = stageEfficiency[stages[0]].avgTime;

  for (const stage of stages) {
    if (stageEfficiency[stage].avgTime > maxAvgTime) {
      maxAvgTime = stageEfficiency[stage].avgTime;
      bottleneck = stage;
    }
  }

  const issues: Record<string, string> = {
    script: "剧本创作耗时较长,可能需要更多创意输入",
    storyboard: "分镜设计耗时较长,可能需要优化剧本拆分流程",
    image: "图片生成耗时较长,可能需要优化提示词质量",
    video: "视频生成耗时较长,可能需要降低时长要求",
    review: "审核耗时较长,可能需要提高初次生成质量",
  };

  const suggestions: Record<string, string> = {
    script: "建议使用AI辅助创作,提高剧本生成效率",
    storyboard: "建议优化自动拆分算法,减少人工调整时间",
    image: "建议优化提示词模板库,提高图片生成成功率",
    video: "建议降低视频时长要求,或使用更快的生成模型",
    review: "建议提高初次生成质量,减少审核返工次数",
  };

  return {
    stage: bottleneck,
    avgTime: maxAvgTime,
    issue: issues[bottleneck] || "未知瓶颈",
    suggestion: suggestions[bottleneck] || "需要进一步分析",
  };
}

/**
 * parseTimeRange - 解析查询参数中的时间范围
 * @param {IncomingMessage} req - HTTP 请求对象
 * @returns {TimeRange} 时间范围类型
 */
function parseTimeRange(req: IncomingMessage): TimeRange {
  const url = new URL(req.url ?? "/", "http://localhost");
  const timeRangeParam = url.searchParams.get("timeRange") as TimeRange;

  if (timeRangeParam && ["today", "week", "month", "all"].includes(timeRangeParam)) {
    return timeRangeParam;
  }

  return "month"; // 默认返回月度数据
}

/**
 * sendJsonResponse - 发送 JSON 响应
 * @param {ServerResponse} res - HTTP 响应对象
 * @param {T} data - 响应数据
 * @param {number} status - HTTP 状态码，默认 200
 * @returns {void}
 */
function sendJsonResponse<T>(res: ServerResponse, data: T, status = 200): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ code: 0, message: "ok", data }));
}

/**
 * getProjectOverview - 单项目数据中心 3 视图合并数据。
 *  - 优先查 view_project_costs / view_project_quality / view_project_capacity（启动时建好）
 *  - view 不存在时降级返回空对象，调用方按字段是否齐全渲染
 */
async function getProjectOverview(_ctx: AppContext, projectId: string): Promise<{
  projectId: string;
  costs: Record<string, unknown> | null;
  quality: Record<string, unknown> | null;
  capacity: Record<string, unknown> | null;
  generatedAt: string;
}> {
  const databaseFile = process.env.AGNES_DB_FILE ?? "data/sqlite.db";
  let costs: Record<string, unknown> | null = null;
  let quality: Record<string, unknown> | null = null;
  let capacity: Record<string, unknown> | null = null;
  try {
    const db = getRawDatabase(databaseFile);
    costs = (db.prepare("SELECT * FROM view_project_costs WHERE project_id = ?").get(projectId) as Record<string, unknown> | undefined) ?? null;
    quality = (db.prepare("SELECT * FROM view_project_quality WHERE project_id = ?").get(projectId) as Record<string, unknown> | undefined) ?? null;
    capacity = (db.prepare("SELECT * FROM view_project_capacity WHERE project_id = ?").get(projectId) as Record<string, unknown> | undefined) ?? null;
  } catch (err) {
    rootLogger.warn({ event: "data.project_overview_failed", projectId, err: String(err) }, "项目 overview 查询失败，可能视图未建");
  }
  return { projectId, costs, quality, capacity, generatedAt: new Date().toISOString() };
}

/**
 * sendErrorResponse - 发送错误响应
 * @param {ServerResponse} res - HTTP 响应对象
 * @param {unknown} error - 错误对象
 * @param {number} status - HTTP 状态码，默认 400
 * @returns {void}
 */
function sendErrorResponse(res: ServerResponse, error: unknown, status = 400): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({
    code: status === 404 ? 1004 : 1001,
    message: (error as Error).message ?? "error",
    data: null
  }));
}

/**
 * handleDataRouter - 处理数据中心相关的 HTTP 请求
 * @param {AppContext} ctx - 应用上下文
 * @param {IncomingMessage} req - HTTP 请求对象
 * @param {ServerResponse} res - HTTP 响应对象
 * @returns {Promise<void>}
 */
export async function handleDataRouter(
  ctx: AppContext,
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const method = req.method ?? "GET";
  const url = new URL(req.url ?? "/", "http://localhost");
  const pathname = url.pathname;

  try {
    // GET /api/data/metrics - 获取数据概览指标
    if (method === "GET" && pathname === "/api/data/metrics") {
      const timeRange = parseTimeRange(req);
      const result = await getDataMetrics(ctx, timeRange);
      sendJsonResponse(res, result);
      return;
    }

    // GET /api/data/ai-cost - 获取AI成本统计数据
    if (method === "GET" && pathname === "/api/data/ai-cost") {
      const timeRange = parseTimeRange(req);
      const result = await getAICost(ctx, timeRange);
      sendJsonResponse(res, result);
      return;
    }

    // GET /api/data/production-efficiency - 获取生产效率数据
    if (method === "GET" && pathname === "/api/data/production-efficiency") {
      const timeRange = parseTimeRange(req);
      const result = await getProductionEfficiency(ctx, timeRange);
      sendJsonResponse(res, result);
      return;
    }

    // GET /api/data/project-overview?projectId= - 项目维度数据中心（spec 4.3）
    if (method === "GET" && pathname === "/api/data/project-overview") {
      const projectId = url.searchParams.get("projectId");
      if (!projectId) {
        sendErrorResponse(res, new Error("projectId required"), 400);
        return;
      }
      const result = await getProjectOverview(ctx, projectId);
      sendJsonResponse(res, result);
      return;
    }

    // 未匹配的路由
    sendErrorResponse(res, new Error("未找到数据中心路由"), 404);
  } catch (error) {
    rootLogger.error({ event: "router.error", route: "data", err: error }, `数据中心路由错误`);
    sendErrorResponse(res, error);
  }
}
