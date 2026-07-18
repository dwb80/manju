/**
 * 模型中心服务实现
 *
 * 提供智能模型推荐、权限验证、配额控制、预算管理和调用记录等功能。
 */

import type { AppContext } from "./app.js";
import type {
  ModelConfig,
  ModelRecommendation,
  ModelRecommendationRequest,
  ModelCallLog,
  ModelQuota,
  ModelType,
  ModelApiConfig,
  ModelCapabilities,
  ModelPricing,
} from "../types.js";
import { id, nowIso } from "../utils.js";

// ==================== 模型配置 CRUD 服务 ====================

/** 模型创建/更新输入 */
export type ModelInput = {
  name?: string;
  type?: ModelType;
  description?: string;
  isDefault?: boolean;
  is_enabled?: boolean;
  version?: string;
  provider?: string;
  api_config?: ModelApiConfig;
  capabilities?: ModelCapabilities;
  parameters?: ModelConfig["parameters"];
  parameter_rules?: Record<string, { min?: number; max?: number; rule?: string; description?: string }>;
  pricing?: ModelPricing;
  performance?: ModelConfig["performance"];
  tags?: string[];
};

const SENSITIVE_HEADER = /^(authorization|proxy-authorization|x-api-key|api-key)$/i;

/** 返回给浏览器的模型配置。服务端密钥永远不进入响应体。 */
export function toPublicModelConfig(model: ModelConfig): ModelConfig & { secret_configured: boolean } {
  const sourceHeaders = model.api_config?.headers ?? {};
  const secretConfigured = Object.entries(sourceHeaders).some(
    ([key, value]) => SENSITIVE_HEADER.test(key) && Boolean(value?.trim()) && !/YOUR_API_KEY/i.test(value),
  );
  const publicHeaders = Object.fromEntries(
    Object.entries(sourceHeaders).filter(([key]) => !SENSITIVE_HEADER.test(key)),
  );
  return {
    ...model,
    api_config: { ...model.api_config, headers: publicHeaders },
    secret_configured: secretConfigured,
  };
}

/** 写入时保留已有密钥，并拒绝通过普通模型 CRUD 覆盖敏感请求头。 */
export function withoutClientSecrets(input: ModelInput, existing?: ModelConfig | null): ModelInput {
  if (!input.api_config) return input;
  const incomingHeaders = input.api_config.headers ?? {};
  const safeHeaders = Object.fromEntries(
    Object.entries(incomingHeaders).filter(([key]) => !SENSITIVE_HEADER.test(key)),
  );
  const existingSecrets = Object.fromEntries(
    Object.entries(existing?.api_config?.headers ?? {}).filter(([key]) => SENSITIVE_HEADER.test(key)),
  );
  return {
    ...input,
    api_config: {
      ...input.api_config,
      headers: { ...safeHeaders, ...existingSecrets },
    },
  };
}

/**
 * 获取所有模型配置列表
 * @param ctx 应用上下文
 * @param type 可选，按模型类型筛选
 */
export async function listModels(ctx: AppContext, type?: ModelType): Promise<ModelConfig[]> {
  const filter: Partial<ModelConfig> = type ? { type } : {};
  return ctx.modelConfigs.findMany(filter, { sort: "desc" });
}

/**
 * 根据 ID 获取单个模型配置
 */
export async function getModelById(ctx: AppContext, modelId: string): Promise<ModelConfig | null> {
  return ctx.modelConfigs.findById(modelId);
}

/**
 * 创建新模型配置
 */
export async function createModel(ctx: AppContext, input: ModelInput): Promise<ModelConfig> {
  // 校验模型ID唯一性（使用 name 作为显示，id 由系统生成或使用提供的 id）
  const modelType = (input.type ?? "chat") as ModelType;
  const model: ModelConfig = {
    id: id("model"),
    name: input.name ?? "",
    type: modelType,
    description: input.description ?? "",
    isDefault: input.isDefault ?? false,
    is_enabled: input.is_enabled ?? true,
    version: input.version ?? "1.0",
    provider: input.provider ?? "Agnes AI",
    api_config: input.api_config ?? { endpoint: "", method: "POST" },
    capabilities: input.capabilities ?? {},
    parameters: input.parameters ?? {},
    parameter_rules: input.parameter_rules ?? {},
    pricing: input.pricing ?? { standard: {}, current: {} },
    performance: input.performance ?? { avgResponseTime: 0, successRate: 0, concurrency: 0 },
    usageStats: { totalCalls: 0, weeklyCalls: 0, monthlyCalls: 0, lastUsedAt: "" },
    tags: input.tags ?? [],
    created_at: nowIso(),
    updated_at: nowIso(),
  };

  // 如果设为默认，取消同类型其他模型的默认标记
  if (model.isDefault) {
    await clearDefaultForType(ctx, modelType);
  }

  await ctx.modelConfigs.insert(model);
  return model;
}

/**
 * 更新模型配置
 */
export async function updateModel(ctx: AppContext, modelId: string, input: ModelInput): Promise<ModelConfig> {
  const existing = await ctx.modelConfigs.findById(modelId);
  if (!existing) throw new Error("模型不存在");

  const patch: Partial<ModelConfig> = {
    ...input,
    type: input.type ? (input.type as ModelType) : undefined,
    updated_at: nowIso(),
  };

  // 如果设为默认，取消同类型其他模型的默认标记
  if (input.isDefault && !existing.isDefault) {
    await clearDefaultForType(ctx, existing.type, modelId);
  }

  await ctx.modelConfigs.update(modelId, patch);
  return { ...existing, ...patch } as ModelConfig;
}

/**
 * 删除模型配置
 */
export async function deleteModel(ctx: AppContext, modelId: string): Promise<void> {
  const existing = await ctx.modelConfigs.findById(modelId);
  if (!existing) throw new Error("模型不存在");
  if (existing.isDefault) {
    throw new Error("不能删除默认模型，请先设置其他模型为默认");
  }
  await ctx.modelConfigs.delete(modelId);
}

/**
 * 设置默认模型
 */
export async function setDefaultModel(ctx: AppContext, modelId: string): Promise<ModelConfig> {
  const target = await ctx.modelConfigs.findById(modelId);
  if (!target) throw new Error("模型不存在");
  if (!target.is_enabled) throw new Error("模型未启用，无法设为默认");

  // 取消同类型其他模型的默认标记
  await clearDefaultForType(ctx, target.type, modelId);

  // 设置目标模型为默认
  await ctx.modelConfigs.update(modelId, { isDefault: true, updated_at: nowIso() });
  return { ...target, isDefault: true };
}

/**
 * 切换模型启用状态
 */
export async function toggleModelEnabled(ctx: AppContext, modelId: string, enabled: boolean): Promise<ModelConfig> {
  const existing = await ctx.modelConfigs.findById(modelId);
  if (!existing) throw new Error("模型不存在");
  if (!enabled && existing.isDefault) {
    throw new Error("不能禁用默认模型，请先设置其他模型为默认");
  }
  await ctx.modelConfigs.update(modelId, { is_enabled: enabled, updated_at: nowIso() });
  return { ...existing, is_enabled: enabled };
}

/**
 * 清除指定类型下所有模型的默认标记
 */
async function clearDefaultForType(ctx: AppContext, type: ModelType, excludeId?: string): Promise<void> {
  const sameTypeModels = await ctx.modelConfigs.findMany({ type, isDefault: true });
  for (const model of sameTypeModels) {
    if (model.id !== excludeId) {
      await ctx.modelConfigs.update(model.id, { isDefault: false, updated_at: nowIso() });
    }
  }
}

// ==================== 种子数据初始化 ====================

/** 默认模型种子数据 */
const DEFAULT_MODELS_SEED: Array<Omit<ModelConfig, "created_at" | "updated_at">> = [
  {
    id: "agnes-2.0-flash",
    name: "Agnes 2.0 Flash",
    type: "chat",
    description: "Sapiens AI 开发的快速高效语言模型，适合智能体工作流、工具调用、编码、多轮对话、推理和图像理解等高频生产场景。Claw-Eval Pass^3 60.9%（通用榜第 9）。",
    isDefault: true,
    is_enabled: true,
    version: "2.0",
    provider: "Agnes AI",
    api_config: {
      endpoint: "https://apihub.agnes-ai.com/v1/chat/completions",
      method: "POST",
      headers: { "Authorization": "Bearer YOUR_API_KEY", "Content-Type": "application/json" },
    },
    capabilities: { visionSupport: true, thinkingMode: true, toolCalling: true, streaming: true },
    parameters: { maxContext: 524288, maxTokens: 65500, defaultTemperature: 0.7 },
    parameter_rules: {},
    pricing: {
      standard: { chat: { input: "$0.03 / 1M tokens", output: "$0.15 / 1M tokens" } },
      current: { chat: { input: "$0 / 1M tokens", output: "$0 / 1M tokens" } },
    },
    performance: { avgResponseTime: 500, successRate: 99.5, concurrency: 100 },
    usageStats: { totalCalls: 0, weeklyCalls: 0, monthlyCalls: 0, lastUsedAt: "" },
    tags: ["视觉理解", "图像理解", "Thinking模式", "工具调用", "流式响应", "智能体工作流", "编码任务"],
  },
  {
    id: "agnes-2.0-pro",
    name: "Agnes 2.0 Pro",
    type: "chat",
    description: "专业版聊天模型，支持更长的上下文和更复杂的推理",
    isDefault: false,
    is_enabled: true,
    version: "2.0",
    provider: "Agnes AI",
    api_config: {
      endpoint: "https://apihub.agnes-ai.com/v1/chat/completions",
      method: "POST",
      headers: { "Authorization": "Bearer YOUR_API_KEY", "Content-Type": "application/json" },
    },
    capabilities: { visionSupport: true, thinkingMode: true, toolCalling: true, streaming: true },
    parameters: { maxContext: 1000000, maxTokens: 65500, defaultTemperature: 0.7 },
    parameter_rules: {},
    pricing: {
      standard: { chat: { input: "$0.15 / 1M tokens", output: "$0.75 / 1M tokens" } },
      current: { chat: { input: "$0 / 1M tokens", output: "$0 / 1M tokens" } },
    },
    performance: { avgResponseTime: 1200, successRate: 99.2, concurrency: 50 },
    usageStats: { totalCalls: 0, weeklyCalls: 0, monthlyCalls: 0, lastUsedAt: "" },
    tags: ["长上下文", "复杂推理"],
  },
  {
    id: "agnes-2.0-thinking",
    name: "Agnes 2.0 Thinking",
    type: "chat",
    description: "深度思考模型，支持复杂推理和长链思考",
    isDefault: false,
    is_enabled: false,
    version: "2.0",
    provider: "Agnes AI",
    api_config: {
      endpoint: "https://apihub.agnes-ai.com/v1/chat/completions",
      method: "POST",
      headers: { "Authorization": "Bearer YOUR_API_KEY", "Content-Type": "application/json" },
    },
    capabilities: { visionSupport: true, thinkingMode: true, toolCalling: true, streaming: true },
    parameters: { maxContext: 2000000, maxTokens: 65500, defaultTemperature: 0.5 },
    parameter_rules: {},
    pricing: {
      standard: { chat: { input: "$0.30 / 1M tokens", output: "$1.50 / 1M tokens" } },
      current: { chat: { input: "$0 / 1M tokens", output: "$0 / 1M tokens" } },
    },
    performance: { avgResponseTime: 3000, successRate: 98.8, concurrency: 20 },
    usageStats: { totalCalls: 0, weeklyCalls: 0, monthlyCalls: 0, lastUsedAt: "" },
    tags: ["深度思考", "长链推理"],
  },
  {
    id: "agnes-image-2.1-flash",
    name: "Agnes Image 2.1 Flash",
    type: "image",
    description: "Sapiens AI 升级版图像生成模型，专注高信息密度图像、文生图与图生图工作流，支持构图保留与灵活的尺寸/输出格式控制。",
    isDefault: true,
    is_enabled: true,
    version: "2.1",
    provider: "Agnes AI",
    api_config: {
      endpoint: "https://apihub.agnes-ai.com/v1/images/generations",
      method: "POST",
      headers: { "Authorization": "Bearer YOUR_API_KEY", "Content-Type": "application/json" },
    },
    // 关键帧模式只对视频有效；图片模型无此概念，故去除
    capabilities: { img2img: true, highDensity: true },
    parameters: {
      supportedSizes: ["1024x768", "768x1024", "1024x1024", "1152x768", "1280x720", "720x1280"],
      defaultSteps: 25,
      responseFormats: ["url", "b64_json"],
    },
    parameter_rules: {},
    pricing: {
      standard: { image: "$0.003 / 张" },
      current: { image: "$0 / 张" },
    },
    performance: { avgResponseTime: 15000, successRate: 98, concurrency: 10 },
    usageStats: { totalCalls: 0, weeklyCalls: 0, monthlyCalls: 0, lastUsedAt: "" },
    tags: ["文生图", "图生图", "高信息密度", "构图保留", "URL/Base64输出"],
  },
  {
    id: "agnes-image-pro",
    name: "Agnes Image Pro",
    type: "image",
    description: "专业版图片生成模型，支持更精细的风格控制",
    isDefault: false,
    is_enabled: true,
    version: "2.1",
    provider: "Agnes AI",
    api_config: {
      endpoint: "https://apihub.agnes-ai.com/v1/images/generations",
      method: "POST",
      headers: { "Authorization": "Bearer YOUR_API_KEY", "Content-Type": "application/json" },
    },
    capabilities: { img2img: true, keyframeMode: true, highDensity: true },
    parameters: {
      supportedSizes: ["1024x768", "768x1024", "1024x1024", "1152x768", "2048x1536"],
      defaultSteps: 50,
      responseFormats: ["url", "b64_json"],
    },
    parameter_rules: {},
    pricing: {
      standard: { image: "$0.01 / 张" },
      current: { image: "$0 / 张" },
    },
    performance: { avgResponseTime: 30000, successRate: 97, concurrency: 5 },
    usageStats: { totalCalls: 0, weeklyCalls: 0, monthlyCalls: 0, lastUsedAt: "" },
    tags: ["电影感", "角色设计", "风格定制"],
  },
  {
    id: "agnes-video-v2.0",
    name: "Agnes Video V2.0",
    type: "video",
    description: "面向生产场景的视频生成模型，支持文生视频、图生视频和关键帧动画。视频生成采用异步任务 API：先创建任务，再通过 video_id 获取结果；num_frames ≤ 441 且遵循 8n+1 规则。",
    isDefault: true,
    is_enabled: true,
    version: "2.0",
    provider: "Agnes AI",
    api_config: {
      endpoint: "https://apihub.agnes-ai.com/v1/videos",
      method: "POST",
      headers: { "Authorization": "Bearer YOUR_API_KEY", "Content-Type": "application/json" },
      statusEndpoint: "https://apihub.agnes-ai.com/agnesapi?video_id={video_id}",
    },
    capabilities: { img2vid: true, keyframeMode: true, asyncGeneration: true, frameConstraint: true },
    parameters: {
      supportedRatios: ["16:9", "9:16", "1:1", "4:3", "3:4"],
      maxDuration: 18,
      maxFrames: 441,
      frameRateRange: { min: 1, max: 60, default: 24 },
    },
    parameter_rules: {
      num_frames: { min: 1, max: 441, rule: "8n+1", description: "num_frames 必须小于或等于 441，并且遵循 8n+1 规则" },
    },
    pricing: {
      standard: { video: "$0.005 / 秒" },
      current: { video: "$0 / 秒" },
    },
    performance: { avgResponseTime: 60000, successRate: 95, concurrency: 5 },
    usageStats: { totalCalls: 0, weeklyCalls: 0, monthlyCalls: 0, lastUsedAt: "" },
    tags: ["文生视频", "图生视频", "关键帧动画", "异步生成", "8n+1帧数约束", "电影级输出"],
  },
  {
    id: "cerebras-gemma-4-31b",
    name: "Cerebras Gemma 4 31B",
    type: "chat",
    description: "Cerebras 提供的 Gemma 4 31B 模型，通过 Bitz Net 代理访问。适合剧本分析、对话生成等中文 NLP 任务。",
    isDefault: false,
    is_enabled: true,
    version: "4.0",
    provider: "Cerebras",
    api_config: {
      endpoint: "https://api.cerebras.ai/v1/chat/completions",
      method: "POST",
      headers: { "Authorization": "Bearer YOUR_API_KEY", "Content-Type": "application/json" },
      proxyURL: "http://127.0.0.1:7897",
    },
    capabilities: { visionSupport: false, thinkingMode: false, toolCalling: false, streaming: true },
    parameters: { maxContext: 128000, maxTokens: 8192, defaultTemperature: 0.7 },
    parameter_rules: {},
    pricing: {
      standard: { chat: { input: "$0 / 1M tokens", output: "$0 / 1M tokens" } },
      current: { chat: { input: "$0 / 1M tokens", output: "$0 / 1M tokens" } },
    },
    performance: { avgResponseTime: 2000, successRate: 95, concurrency: 10 },
    usageStats: { totalCalls: 0, weeklyCalls: 0, monthlyCalls: 0, lastUsedAt: "" },
    tags: ["剧本分析", "中文优化", "代理访问", "Cerebras"],
  },
  {
    id: "sensenova-6.7-flash-lite",
    name: "商汤 SenseNova 6.7 Flash Lite",
    type: "chat",
    description: "实验性接入：当前 Token Plan 兼容端点仅返回推理字段，未通过最终答案质量门槛；完成端点升级前不建议生产使用。",
    isDefault: false,
    is_enabled: false,
    version: "6.7",
    provider: "商汤",
    api_config: {
      endpoint: "https://token.sensenova.cn/v1/chat/completions",
      method: "POST",
      headers: { "Authorization": "Bearer YOUR_API_KEY", "Content-Type": "application/json" },
    },
    capabilities: { visionSupport: false, thinkingMode: false, toolCalling: false, streaming: true },
    parameters: { maxContext: 32000, maxTokens: 4096, defaultTemperature: 0.7 },
    parameter_rules: {},
    pricing: {
      standard: { chat: { input: "$0 / 1M tokens", output: "$0 / 1M tokens" } },
      current: { chat: { input: "$0 / 1M tokens", output: "$0 / 1M tokens" } },
    },
    performance: { avgResponseTime: 1500, successRate: 95, concurrency: 10 },
    usageStats: { totalCalls: 0, weeklyCalls: 0, monthlyCalls: 0, lastUsedAt: "" },
    tags: ["商汤", "实验性", "未通过质量门槛"],
  },
  {
    id: "glm-5.2",
    name: "智谱 GLM-5.2（商汤免费额度）",
    type: "chat",
    description: "智谱 AI 旗舰模型 GLM-5.2，支持 1M 上下文，面向长任务时代的编程推理模型。通过商汤 Token Plan 平台免费调用（公测期）。",
    isDefault: false,
    is_enabled: true,
    version: "5.2",
    provider: "商汤",
    api_config: {
      endpoint: "https://token.sensenova.cn/v1/chat/completions",
      method: "POST",
      headers: { "Authorization": "Bearer YOUR_API_KEY", "Content-Type": "application/json" },
    },
    capabilities: { visionSupport: false, thinkingMode: true, toolCalling: false, streaming: true },
    parameters: { maxContext: 1000000, maxTokens: 128000, defaultTemperature: 0.7 },
    parameter_rules: {},
    pricing: {
      standard: { chat: { input: "$1.4 / 1M tokens", output: "$4.4 / 1M tokens" } },
      current: { chat: { input: "免费（商汤公测期）", output: "免费（商汤公测期）" } },
    },
    performance: { avgResponseTime: 3000, successRate: 92, concurrency: 5 },
    usageStats: { totalCalls: 0, weeklyCalls: 0, monthlyCalls: 0, lastUsedAt: "" },
    tags: ["智谱", "GLM-5.2", "编程推理", "1M上下文", "商汤免费额度"],
  },
];

/**
 */
export async function seedModelConfigs(ctx: AppContext): Promise<void> {
  const existing = await ctx.modelConfigs.findMany({});
  if (existing.length > 0) return;

  const now = nowIso();
  for (const seed of DEFAULT_MODELS_SEED) {
    const model: ModelConfig = { ...seed, created_at: now, updated_at: now };
    await ctx.modelConfigs.insert(model);
  }
}

// ==================== 模型推荐服务 ====================

/**
 * 根据任务类型和质量要求智能推荐最佳模型
 *
 * @param ctx 应用上下文
 * @param request 推荐请求参数
 * @returns 推荐结果列表，按评分排序
 */
export async function recommendModels(
  ctx: AppContext,
  request: ModelRecommendationRequest
): Promise<ModelRecommendation[]> {
  // 获取所有可用模型（这里简化实现，实际应该从模型列表中筛选）
  const allModels = await getAvailableModels(ctx);

  // 根据任务类型筛选模型
  const suitableModels = allModels.filter((model) => {
    // 根据任务类型匹配模型类型
    const taskTypeToModelType: Record<string, ModelType> = {
      script_generation: "chat",
      script_optimization: "chat",
      scene_generation: "chat",
      dialogue_generation: "chat",
      storyboard_split: "chat",
      image_generation: "image",
      video_generation: "video",
    };

    const requiredType = taskTypeToModelType[request.task_type];
    return model.type === requiredType;
  });

  // 计算推荐评分
  const recommendations: ModelRecommendation[] = suitableModels.map((model) => {
    let score = 0;

    // 根据质量要求评分
    if (request.quality_requirement === "premium") {
      score += model.performance.successRate ?? 0;
    } else if (request.quality_requirement === "high") {
      score += (model.performance.successRate ?? 0) * 0.8;
    } else {
      score += (model.performance.successRate ?? 0) * 0.6;
    }

    // 根据速度偏好评分
    if (request.speed_preference === "fast") {
      score -= (model.performance.avgResponseTime ?? 0) / 1000;
    }

    // 根据预算偏好评分（这里简化处理）
    if (request.budget_preference === "low") {
      score += model.usageStats.totalCalls > 1000 ? 10 : 0; // 高使用量的模型可能更便宜
    }

    // 估算成本和时间
    const estimatedCost = estimateModelCost(model, request.task_type);
    const estimatedTime = estimateModelTime(model, request.task_type);

    return {
      model,
      score,
      reason: generateRecommendationReason(model, request),
      estimated_cost: estimatedCost,
      estimated_time: estimatedTime,
    };
  });

  // 按评分排序
  return recommendations.sort((a, b) => b.score - a.score).slice(0, 5);
}

/**
 * 获取所有可用模型列表（从数据库读取已启用的模型）
 */
async function getAvailableModels(ctx: AppContext): Promise<ModelConfig[]> {
  // 从数据库读取已启用的模型
  return ctx.modelConfigs.findMany({ is_enabled: true });
}

/**
 * 估算模型调用成本
 */
function estimateModelCost(model: ModelConfig, taskType: string): number {
  // 简化成本估算逻辑
  const baseCosts: Record<string, number> = {
    chat: 0.01,
    image: 0.05,
    video: 0.1,
  };

  return baseCosts[model.type] ?? 0.01;
}

/**
 * 估算模型调用时间（毫秒）
 */
function estimateModelTime(model: ModelConfig, taskType: string): number {
  return model.performance.avgResponseTime ?? 1000;
}

/**
 * 生成推荐理由说明
 */
function generateRecommendationReason(
  model: ModelConfig,
  request: ModelRecommendationRequest
): string {
  const reasons: string[] = [];

  if (model.isDefault) {
    reasons.push("系统默认推荐模型");
  }

  if (model.performance.successRate && model.performance.successRate > 95) {
    reasons.push("高成功率");
  }

  if (model.performance.avgResponseTime && model.performance.avgResponseTime < 1000) {
    reasons.push("响应速度快");
  }

  if (request.quality_requirement === "premium" && model.id.includes("pro")) {
    reasons.push("适合高质量需求");
  }

  return reasons.length > 0 ? reasons.join("，") : "基础推荐";
}

// ==================== 权限验证服务 ====================

/**
 * 检查用户是否有权限使用指定模型
 *
 * @param ctx 应用上下文
 * @param userId 用户ID
 * @param modelId 模型ID
 * @returns 是否有权限使用
 */
export async function checkModelPermission(
  ctx: AppContext,
  userId: string,
  modelId: string
): Promise<boolean> {
  // 简化实现：默认所有用户都有权限
  // 实际应该根据用户角色和模型权限级别进行验证
  return true;
}

// ==================== 配额控制服务 ====================

/**
 * 检查用户配额是否充足
 *
 * @param ctx 应用上下文
 * @param userId 用户ID
 * @param modelId 模型ID
 * @returns 是否有充足配额
 */
export async function checkQuota(
  ctx: AppContext,
  userId: string,
  modelId: string
): Promise<{ available: boolean; reason?: string }> {
  // 查询用户配额
  const quota = await ctx.modelQuotas.findMany({ user_id: userId, model_id: modelId });

  if (quota.length === 0) {
    // 如果没有配额记录，创建默认配额
    const defaultQuota = await createDefaultQuota(ctx, userId, modelId);
    return { available: true };
  }

  const currentQuota = quota[0];

  // 检查每日配额
  if (currentQuota.daily_used >= currentQuota.daily_limit) {
    return { available: false, reason: "每日配额已用尽" };
  }

  // 检查每周配额
  if (currentQuota.weekly_used >= currentQuota.weekly_limit) {
    return { available: false, reason: "每周配额已用尽" };
  }

  // 检查每月配额
  if (currentQuota.monthly_used >= currentQuota.monthly_limit) {
    return { available: false, reason: "每月配额已用尽" };
  }

  // 检查预算配额
  if (currentQuota.budget_used >= currentQuota.budget_limit) {
    return { available: false, reason: "预算已用尽" };
  }

  return { available: true };
}

/**
 * 更新用户配额使用量
 *
 * @param ctx 应用上下文
 * @param userId 用户ID
 * @param modelId 模型ID
 * @param cost 本次调用成本
 */
export async function updateQuotaUsage(
  ctx: AppContext,
  userId: string,
  modelId: string,
  cost: number
): Promise<void> {
  const quota = await ctx.modelQuotas.findMany({ user_id: userId, model_id: modelId });

  if (quota.length === 0) {
    return;
  }

  const currentQuota = quota[0];
  const patch: Partial<ModelQuota> = {
    daily_used: currentQuota.daily_used + 1,
    weekly_used: currentQuota.weekly_used + 1,
    monthly_used: currentQuota.monthly_used + 1,
    budget_used: currentQuota.budget_used + cost,
    updated_at: nowIso(),
  };

  await ctx.modelQuotas.update(currentQuota.id, patch);
}

/**
 * 创建默认配额记录
 */
async function createDefaultQuota(
  ctx: AppContext,
  userId: string,
  modelId: string
): Promise<ModelQuota> {
  const quota: ModelQuota = {
    id: id("quota"),
    user_id: userId,
    model_id: modelId,
    daily_limit: 100,
    daily_used: 0,
    weekly_limit: 500,
    weekly_used: 0,
    monthly_limit: 2000,
    monthly_used: 0,
    budget_limit: 100,
    budget_used: 0,
    reset_at: nowIso(),
    created_at: nowIso(),
    updated_at: nowIso(),
  };

  await ctx.modelQuotas.insert(quota);
  return quota;
}

// ==================== 调用记录服务 ====================

/**
 * 记录模型调用日志
 *
 * @param ctx 应用上下文
 * @param log 调用日志数据
 */
export async function logModelCall(
  ctx: AppContext,
  log: Partial<ModelCallLog>
): Promise<ModelCallLog> {
  const callLog: ModelCallLog = {
    id: id("mcl"),
    user_id: log.user_id ?? "anonymous",
    model_id: log.model_id ?? "",
    model_type: log.model_type ?? "chat",
    task_type: log.task_type ?? "unknown",
    input_tokens: log.input_tokens ?? 0,
    output_tokens: log.output_tokens ?? 0,
    cost: log.cost ?? 0,
    duration: log.duration ?? 0,
    status: log.status ?? "success",
    error_message: log.error_message,
    created_at: nowIso(),
  };

  await ctx.modelCallLogs.insert(callLog);
  return callLog;
}

/**
 * 获取用户调用历史
 *
 * @param ctx 应用上下文
 * @param userId 用户ID
 * @param limit 返回数量限制
 * @returns 调用日志列表
 */
export async function getCallHistory(
  ctx: AppContext,
  userId: string,
  limit: number = 100
): Promise<ModelCallLog[]> {
  return ctx.modelCallLogs.findMany({ user_id: userId }, { sort: "desc", limit });
}

// ==================== 综合调用服务 ====================

/**
 * 执行模型调用（包含权限验证、配额检查和日志记录）
 *
 * @param ctx 应用上下文
 * @param userId 用户ID
 * @param modelId 模型ID
 * @param taskType 任务类型
 * @param callFn 实际调用函数
 * @returns 调用结果
 */
export async function executeModelCall<T>(
  ctx: AppContext,
  userId: string,
  modelId: string,
  taskType: string,
  callFn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();

  try {
    // 1. 权限验证
    const hasPermission = await checkModelPermission(ctx, userId, modelId);
    if (!hasPermission) {
      throw new Error("无权限使用该模型");
    }

    // 2. 配额检查
    const quotaCheck = await checkQuota(ctx, userId, modelId);
    if (!quotaCheck.available) {
      throw new Error(quotaCheck.reason ?? "配额不足");
    }

    // 3. 执行实际调用
    const result = await callFn();

    // 4. 记录成功日志
    const duration = Date.now() - startTime;
    const estimatedCost = estimateModelCostByTask(taskType);
    await logModelCall(ctx, {
      user_id: userId,
      model_id: modelId,
      model_type: getModelTypeByTask(taskType),
      task_type: taskType,
      cost: estimatedCost,
      duration: duration,
      status: "success",
    });

    // 5. 更新配额使用量
    await updateQuotaUsage(ctx, userId, modelId, estimatedCost);

    return result;
  } catch (error) {
    // 记录失败日志
    const duration = Date.now() - startTime;
    await logModelCall(ctx, {
      user_id: userId,
      model_id: modelId,
      model_type: getModelTypeByTask(taskType),
      task_type: taskType,
      cost: 0,
      duration: duration,
      status: "failed",
      error_message: (error as Error).message,
    });

    throw error;
  }
}

/**
 * 根据任务类型估算成本
 */
function estimateModelCostByTask(taskType: string): number {
  const costs: Record<string, number> = {
    script_generation: 0.02,
    script_optimization: 0.01,
    scene_generation: 0.02,
    dialogue_generation: 0.01,
    storyboard_split: 0.02,
    image_generation: 0.05,
    video_generation: 0.1,
  };

  return costs[taskType] ?? 0.01;
}

/**
 * 根据任务类型获取模型类型
 */
function getModelTypeByTask(taskType: string): ModelType {
  const taskToModel: Record<string, ModelType> = {
    script_generation: "chat",
    script_optimization: "chat",
    scene_generation: "chat",
    dialogue_generation: "chat",
    storyboard_split: "chat",
    image_generation: "image",
    video_generation: "video",
  };

  return taskToModel[taskType] ?? "chat";
}
