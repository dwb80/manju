/**
 * @file model.ts
 * @description AI模型配置相关类型定义，包括模型配置、能力、参数约束、价格、配额等
 */

/**
 * 模型类型
 * @property chat - 聊天模型
 * @property image - 图片生成模型
 * @property video - 视频生成模型
 */
export type ModelType = "chat" | "image" | "video";

/** 模型API配置 */
export interface ModelApiConfig {
  /** API endpoint URL（必填） */
  endpoint: string;
  /** HTTP方法（POST/GET，默认POST） */
  method: "POST" | "GET";
  /** 自定义请求头（JSON对象） */
  headers?: Record<string, string>;
  /** 状态查询endpoint（视频模型异步生成） */
  statusEndpoint?: string;
  /** 代理服务器URL（如 http://127.0.0.1:7897） */
  proxyURL?: string;
}

/** 模型能力标签 */
export interface ModelCapabilities {
  // 聊天模型能力
  /** 视觉理解支持（聊天模型） */
  visionSupport?: boolean;
  /** Thinking模式支持（聊天模型） */
  thinkingMode?: boolean;
  /** 工具调用支持（聊天模型） */
  toolCalling?: boolean;
  /** 流式响应支持（聊天模型） */
  streaming?: boolean;
  // 图片模型能力
  /** 图生图支持（图片模型） */
  img2img?: boolean;
  /** 关键帧模式支持（图片/视频模型） */
  keyframeMode?: boolean;
  /** 高信息密度优化（图片模型） */
  highDensity?: boolean;
  // 视频模型能力
  /** 图生视频支持（视频模型） */
  img2vid?: boolean;
  /** 异步生成支持（视频模型） */
  asyncGeneration?: boolean;
  /** 帧数约束支持（视频模型） */
  frameConstraint?: boolean;
}

/** 模型参数约束规则 */
export interface ModelParameterRule {
  /** 最小值 */
  min?: number;
  /** 最大值 */
  max?: number;
  /** 约束规则名称（如 8n+1） */
  rule?: string;
  /** 规则描述 */
  description?: string;
}

/** 模型价格信息 */
export interface ModelPricing {
  /** 标准价格 */
  standard: {
    chat?: { input: string; output: string };
    image?: string;
    video?: string;
  };
  /** 当前价格 */
  current: {
    chat?: { input: string; output: string };
    image?: string;
    video?: string;
  };
}

/** 模型配置，用于模型中心展示和管理可用模型 */
export interface ModelConfig {
  /** 模型唯一标识 */
  id: string;
  /** 模型名称 */
  name: string;
  /** 模型类型：聊天/图片/视频 */
  type: ModelType;
  /** 模型描述 */
  description: string;
  /** 是否为该类型下的默认模型 */
  isDefault: boolean;
  /** 是否启用（模型池管理） */
  is_enabled: boolean;
  /** 模型版本 */
  version: string;
  /** 模型提供商 */
  provider: string;
  /** API配置 */
  api_config: ModelApiConfig;
  /** 能力标签 */
  capabilities: ModelCapabilities;
  /** 模型参数配置 */
  parameters: {
    /** 支持的最大上下文长度（聊天模型） */
    maxContext?: number;
    /** 最大输出token数（聊天模型） */
    maxTokens?: number;
    /** 默认采样温度 */
    defaultTemperature?: number;
    /** 支持的图片尺寸列表（图片模型） */
    supportedSizes?: string[];
    /** 默认推理步数（图片模型） */
    defaultSteps?: number;
    /** 支持的返回格式（图片模型） */
    responseFormats?: string[];
    /** 支持的视频比例列表（视频模型） */
    supportedRatios?: string[];
    /** 支持的最大视频时长（视频模型） */
    maxDuration?: number;
    /** 最大帧数（视频模型） */
    maxFrames?: number;
    /** 帧率范围（视频模型） */
    frameRateRange?: { min: number; max: number; default: number };
  };
  /** 参数约束规则（如视频模型帧数8n+1规则） */
  parameter_rules: Record<string, ModelParameterRule>;
  /** 价格信息 */
  pricing: ModelPricing;
  /** 模型性能指标 */
  performance: {
    /** 平均响应时间（毫秒） */
    avgResponseTime?: number;
    /** 成功率 */
    successRate?: number;
    /** 并发能力 */
    concurrency?: number;
  };
  /** 模型使用统计 */
  usageStats: {
    /** 总调用次数 */
    totalCalls: number;
    /** 本周调用次数 */
    weeklyCalls: number;
    /** 本月调用次数 */
    monthlyCalls: number;
    /** 最后使用时间 */
    lastUsedAt: string;
  };
  /** 模型标签 */
  tags: string[];
  /** 创建时间 */
  created_at: string;
  /** 更新时间 */
  updated_at: string;
}

/** 模型提供商 */
export type ModelProvider = 'openai' | 'anthropic' | 'google' | 'azure' | 'custom';

/** 模型权限级别 */
export type ModelPermission = 'free' | 'basic' | 'pro' | 'enterprise';

/** 模型调用记录 */
export interface ModelCallLog {
  id: string;
  user_id: string;
  model_id: string;
  model_type: ModelType;
  task_type: string;
  input_tokens: number;
  output_tokens: number;
  cost: number;
  duration: number;
  status: 'success' | 'failed' | 'timeout';
  error_message?: string;
  created_at: string;
}

/** 模型配额 */
export interface ModelQuota {
  id: string;
  user_id: string;
  model_id: string;
  daily_limit: number;
  daily_used: number;
  weekly_limit: number;
  weekly_used: number;
  monthly_limit: number;
  monthly_used: number;
  budget_limit: number;
  budget_used: number;
  reset_at: string;
  created_at: string;
  updated_at: string;
}

/** 模型推荐请求 */
export interface ModelRecommendationRequest {
  task_type: 'script_generation' | 'script_optimization' | 'scene_generation' | 'dialogue_generation' | 'storyboard_split' | 'image_generation' | 'video_generation';
  quality_requirement: 'standard' | 'high' | 'premium';
  budget_preference?: 'low' | 'medium' | 'high';
  speed_preference?: 'fast' | 'normal' | 'slow';
  features?: string[];
}

/** 模型推荐结果 */
export interface ModelRecommendation {
  model: ModelConfig;
  score: number;
  reason: string;
  estimated_cost: number;
  estimated_time: number;
}
