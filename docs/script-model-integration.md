# 剧本中心与模型中心集成方案

> **文档版本**: V1.0  
> **创建时间**: 2026-07-10  
> **文档状态**: 待审核

---

## 一、集成概述

### 1.1 集成目标

剧本中心需要使用模型中心的AI模型来支持以下功能：
- AI剧本创作（聊天模型）
- AI剧本优化（聊天模型）
- AI生成场景描述（聊天模型）
- AI生成对白（聊天模型）
- AI拆分镜头（聊天模型）
- AI连续性检查（聊天模型）

### 1.2 架构设计

**现有架构**:
```
剧本中心 → AgnesClient → Agnes API
```

**目标架构**:
```
剧本中心 → 模型中心服务 → AI能力层 → AgnesClient → Agnes API
```

---

## 二、集成架构设计

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        剧本中心                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ AI创作   │  │ AI优化   │  │ 生成分镜 │  │ 连续性检查│        │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘        │
│       │             │             │             │               │
│       └─────────────┴─────────────┴─────────────┘               │
│                           │                                      │
│                           ▼                                      │
│               ┌───────────────────────┐                         │
│               │   剧本AI服务层         │                         │
│               │  (ScriptAIService)    │                         │
│               └───────────┬───────────┘                         │
└───────────────────────────┼─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                        模型中心                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                 模型中心服务                              │   │
│  │            (ModelCenterService)                          │   │
│  │                                                          │   │
│  │  • 智能模型推荐                                          │   │
│  │  • 模型调用接口                                          │   │
│  │  • 参数验证                                              │   │
│  │  • 权限验证                                              │   │
│  │  • 调用记录                                              │   │
│  └──────────────────────┬───────────────────────────────────┘   │
│                         │                                       │
│                         ▼                                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                 AI能力层                                  │   │
│  │              (AI Capability Layer)                       │   │
│  │                                                          │   │
│  │  • 聊天能力（ChatCapability）                            │   │
│  │  • 图片能力（ImageCapability）                           │   │
│  │  • 视频能力（VideoCapability）                           │   │
│  └──────────────────────┬───────────────────────────────────┘   │
│                         │                                       │
│                         ▼                                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                 AgnesClient                               │   │
│  │                                                          │   │
│  │  • RealAgnesClient（真实API）                            │   │
│  │  • MockAgnesClient（模拟）                               │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 三、接口设计

### 3.1 剧本AI服务层（ScriptAIService）

剧本AI服务层封装剧本相关的AI功能，对模型中心进行业务级别的调用。

```typescript
// backend/src/services/script-ai.ts

import type { AppContext } from "./app.js";

/**
 * 剧本AI服务接口
 */
export interface ScriptAIService {
  /** AI剧本创作 */
  createScript(params: CreateScriptParams): Promise<CreateScriptResult>;
  
  /** AI剧本优化 */
  optimizeScript(params: OptimizeScriptParams): Promise<OptimizeScriptResult>;
  
  /** AI生成场景描述 */
  generateScene(params: GenerateSceneParams): Promise<GenerateSceneResult>;
  
  /** AI生成对白 */
  generateDialogue(params: GenerateDialogueParams): Promise<GenerateDialogueResult>;
  
  /** AI拆分镜头 */
  breakdownScript(params: BreakdownScriptParams): Promise<BreakdownScriptResult>;
  
  /** AI连续性检查 */
  checkContinuity(params: CheckContinuityParams): Promise<CheckContinuityResult>;
}

/**
 * AI剧本创作参数
 */
export interface CreateScriptParams {
  projectId: string;
  userId: string;
  prompt: string;              // 用户提示词
  style?: string;              // 风格（如"古装"、"科幻"）
  genre?: string;              // 类型（如"爱情"、"悬疑"）
  length?: "short" | "medium" | "long";  // 长度
  modelId?: string;            // 指定模型（可选）
}

/**
 * AI剧本创作结果
 */
export interface CreateScriptResult {
  scriptId: string;            // 生成的剧本ID
  content: string;             // 剧本内容
  modelId: string;             // 使用的模型ID
  modelName: string;           // 模型名称
  tokens: {
    input: number;             // 输入token数
    output: number;            // 输出token数
  };
  cost: number;                // 成本（美元）
  duration: number;            // 耗时（毫秒）
}

/**
 * AI剧本优化参数
 */
export interface OptimizeScriptParams {
  projectId: string;
  userId: string;
  scriptId: string;            // 剧本ID
  content: string;             // 原始内容
  optimizationType: "expand" | "compress" | "improve" | "rewrite";  // 优化类型
  focus?: string;              // 关注点（如"对白"、"节奏"）
  modelId?: string;            // 指定模型
}

/**
 * AI剧本优化结果
 */
export interface OptimizeScriptResult {
  optimizedContent: string;    // 优化后的内容
  modelId: string;
  modelName: string;
  tokens: { input: number; output: number };
  cost: number;
  duration: number;
}

/**
 * AI生成场景描述参数
 */
export interface GenerateSceneParams {
  projectId: string;
  userId: string;
  episodeId: string;           // 剧集ID
  sceneNo: number;             // 场景编号
  context?: string;            // 上下文（前序场景）
  modelId?: string;
}

/**
 * AI生成场景描述结果
 */
export interface GenerateSceneResult {
  sceneId: string;             // 场景ID
  location: string;            // 地点
  time: string;                // 时间
  description: string;         // 场景描述
  characters: string[];        // 出场角色
  modelId: string;
  modelName: string;
  tokens: { input: number; output: number };
  cost: number;
  duration: number;
}

/**
 * AI生成对白参数
 */
export interface GenerateDialogueParams {
  projectId: string;
  userId: string;
  sceneId: string;             // 场景ID
  characters: string[];        // 对话角色
  emotion?: string;            // 情绪（如"冷漠"、"激动"）
  context?: string;            // 上下文
  modelId?: string;
}

/**
 * AI生成对白结果
 */
export interface GenerateDialogueResult {
  dialogueId: string;          // 对白ID
  content: string;             // 对白内容
  modelId: string;
  modelName: string;
  tokens: { input: number; output: number };
  cost: number;
  duration: number;
}

/**
 * AI拆分镜头参数
 */
export interface BreakdownScriptParams {
  projectId: string;
  userId: string;
  scriptId: string;            // 剧本ID
  content: string;             // 剧本内容
  modelId?: string;
}

/**
 * AI拆分镜头结果
 */
export interface BreakdownScriptResult {
  storyboards: Array<{
    shot: number;              // 镜头号
    description: string;       // 镜头描述
    shotSize: string;          // 景别
    cameraMove: string;        // 镜头运动
    duration: number;          // 时长（秒）
    dialogue?: string;         // 对白
    characters: string[];      // 角色
  }>;
  modelId: string;
  modelName: string;
  tokens: { input: number; output: number };
  cost: number;
  duration: number;
}

/**
 * AI连续性检查参数
 */
export interface CheckContinuityParams {
  projectId: string;
  userId: string;
  scriptId: string;            // 剧本ID
  content: string;             // 剧本内容
  checkType: "character" | "timeline" | "location" | "all";  // 检查类型
  modelId?: string;
}

/**
 * AI连续性检查结果
 */
export interface CheckContinuityResult {
  issues: Array<{
    type: string;              // 问题类型
    severity: "low" | "medium" | "high";  // 严重程度
    location: string;          // 位置
    description: string;       // 描述
    suggestion?: string;       // 建议修复
  }>;
  modelId: string;
  modelName: string;
  tokens: { input: number; output: number };
  cost: number;
  duration: number;
}
```

---

### 3.2 模型中心服务层（ModelCenterService）

模型中心服务层提供统一的模型调用接口，支持智能推荐和业务调用。

```typescript
// backend/src/services/model-center.ts

import type { AppContext } from "./app.js";

/**
 * 模型中心服务接口
 */
export interface ModelCenterService {
  /** 智能推荐模型 */
  recommendModel(params: RecommendModelParams): Promise<ModelConfig>;
  
  /** 调用聊天模型 */
  callChatModel(params: ChatModelCallParams): Promise<ChatModelCallResult>;
  
  /** 调用图片模型 */
  callImageModel(params: ImageModelCallParams): Promise<ImageModelCallResult>;
  
  /** 调用视频模型 */
  callVideoModel(params: VideoModelCallParams): Promise<VideoModelCallResult>;
}

/**
 * 智能推荐模型参数
 */
export interface RecommendModelParams {
  userId: string;
  taskType: "script_creation" | "script_optimization" | "scene_generation" | 
            "dialogue_generation" | "breakdown" | "continuity_check";
  requirements?: {
    quality?: "fast" | "standard" | "high";
    cost?: "low" | "standard" | "unlimited";
    time?: "realtime" | "standard" | "unlimited";
  };
}

/**
 * 聊天模型调用参数
 */
export interface ChatModelCallParams {
  userId: string;
  projectId?: string;
  modelId?: string;            // 指定模型（可选）
  taskType: string;            // 任务类型
  taskName: string;            // 任务名称
  prompt: string;              // 提示词
  systemPrompt?: string;       // 系统提示词
  history?: Array<{            // 对话历史
    role: "user" | "assistant" | "system";
    content: string;
  }>;
  parameters?: {
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
  };
  attachments?: Array<{        // 附件（图片URL）
    url: string;
  }>;
}

/**
 * 聊天模型调用结果
 */
export interface ChatModelCallResult {
  taskId: string;              // 任务ID
  modelId: string;             // 使用的模型ID
  modelName: string;           // 模型名称
  content: string;             // 生成内容
  reasoning?: string;          // Thinking内容（如有）
  tokens: {
    input: number;
    output: number;
  };
  cost: number;                // 成本（美元）
  duration: number;            // 耗时（毫秒）
  status: "success" | "failed";
  error?: string;
}

/**
 * 图片模型调用参数
 */
export interface ImageModelCallParams {
  userId: string;
  projectId?: string;
  modelId?: string;
  taskType: string;
  taskName: string;
  prompt: string;
  parameters?: {
    size?: string;
    n?: number;
    response_format?: "url" | "b64_json";
  };
  images?: string[];           // 图生图输入
}

/**
 * 图片模型调用结果
 */
export interface ImageModelCallResult {
  taskId: string;
  modelId: string;
  modelName: string;
  imageUrls: string[];         // 生成的图片URL
  cost: number;
  duration: number;
  status: "success" | "failed";
  error?: string;
}

/**
 * 视频模型调用参数
 */
export interface VideoModelCallParams {
  userId: string;
  projectId?: string;
  modelId?: string;
  taskType: string;
  taskName: string;
  prompt: string;
  parameters?: {
    width?: number;
    height?: number;
    num_frames?: number;
    frame_rate?: number;
  };
  image?: string;              // 图生视频输入
  images?: string[];           // 关键帧模式
  mode?: "ti2vid" | "keyframes";
}

/**
 * 视频模型调用结果
 */
export interface VideoModelCallResult {
  taskId: string;
  modelId: string;
  modelName: string;
  videoId: string;             // 视频ID
  status: "pending" | "processing" | "success" | "failed";
  progress?: number;
  videoUrl?: string;           // 视频URL（完成后）
  seconds?: string;            // 视频时长
  size?: string;               // 视频尺寸
  cost?: number;
  duration?: number;
  error?: string;
}
```

---

## 四、集成实现方案

### 4.1 模型中心服务实现

```typescript
// backend/src/services/model-center-impl.ts

import type { AppContext } from "./app.js";
import type { 
  ModelCenterService, 
  RecommendModelParams,
  ChatModelCallParams,
  ChatModelCallResult,
  ImageModelCallParams,
  ImageModelCallResult,
  VideoModelCallParams,
  VideoModelCallResult
} from "./model-center.js";
import type { ModelConfig } from "../types.js";
import { id, nowIso } from "../utils.js";

/**
 * 模型中心服务实现
 */
export class ModelCenterServiceImpl implements ModelCenterService {
  constructor(private ctx: AppContext) {}

  /**
   * 智能推荐模型
   */
  async recommendModel(params: RecommendModelParams): Promise<ModelConfig> {
    // 1. 获取用户设置
    const settings = await this.ctx.settings.get();
    
    // 2. 获取可用模型列表
    const models = await this.listAvailableModels("chat", params.userId);
    
    // 3. 如果用户指定了默认模型，优先使用
    const userDefaultModel = settings.defaultChatModel;
    if (userDefaultModel) {
      const model = models.find(m => m.id === userDefaultModel);
      if (model && model.isAvailable) return model;
    }
    
    // 4. 根据任务类型和需求推荐模型
    const recommendedModel = this.selectBestModel(models, params);
    
    return recommendedModel;
  }

  /**
   * 调用聊天模型
   */
  async callChatModel(params: ChatModelCallParams): Promise<ChatModelCallResult> {
    const startTime = Date.now();
    const taskId = id("task");
    
    try {
      // 1. 推荐或选择模型
      const model = params.modelId 
        ? await this.getModel(params.modelId)
        : await this.recommendModel({
            userId: params.userId,
            taskType: params.taskType as any,
          });
      
      // 2. 验证权限
      await this.checkPermission(params.userId, model.id);
      
      // 3. 验证配额
      await this.checkQuota(params.userId);
      
      // 4. 验证预算
      await this.checkBudget(params.userId, model);
      
      // 5. 构建聊天参数
      const chatParams = this.buildChatParams(model, params);
      
      // 6. 调用AI模型
      let content = "";
      let reasoning = "";
      
      for await (const chunk of this.ctx.ai.chat(chatParams)) {
        if (chunk.content) content += chunk.content;
        if (chunk.reasoning) reasoning += chunk.reasoning;
        if (chunk.done) break;
      }
      
      // 7. 计算成本
      const inputTokens = this.estimateInputTokens(params.prompt, params.history, params.systemPrompt);
      const outputTokens = this.estimateOutputTokens(content + reasoning);
      const cost = this.calculateCost(model, inputTokens, outputTokens);
      const duration = Date.now() - startTime;
      
      // 8. 保存调用记录
      await this.saveCallRecord({
        taskId,
        userId: params.userId,
        projectId: params.projectId,
        modelId: model.id,
        modelName: model.name,
        taskType: params.taskType,
        taskName: params.taskName,
        prompt: params.prompt,
        parameters: params.parameters,
        result: { content, reasoning },
        status: "success",
        tokens: { input: inputTokens, output: outputTokens },
        cost,
        duration,
      });
      
      // 9. 更新配额和预算
      await this.updateQuotaAndBudget(params.userId, cost);
      
      // 10. 更新模型统计
      await this.updateModelStats(model.id, duration, true);
      
      return {
        taskId,
        modelId: model.id,
        modelName: model.name,
        content,
        reasoning: reasoning || undefined,
        tokens: { input: inputTokens, output: outputTokens },
        cost,
        duration,
        status: "success",
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // 保存失败记录
      await this.saveCallRecord({
        taskId,
        userId: params.userId,
        projectId: params.projectId,
        modelId: params.modelId || "unknown",
        modelName: "unknown",
        taskType: params.taskType,
        taskName: params.taskName,
        prompt: params.prompt,
        parameters: params.parameters,
        result: null,
        status: "failed",
        error: (error as Error).message,
        tokens: { input: 0, output: 0 },
        cost: 0,
        duration,
      });
      
      return {
        taskId,
        modelId: params.modelId || "unknown",
        modelName: "unknown",
        content: "",
        tokens: { input: 0, output: 0 },
        cost: 0,
        duration,
        status: "failed",
        error: (error as Error).message,
      };
    }
  }

  /**
   * 调用图片模型
   */
  async callImageModel(params: ImageModelCallParams): Promise<ImageModelCallResult> {
    // 类似聊天模型的实现
    // ...
  }

  /**
   * 调用视频模型
   */
  async callVideoModel(params: VideoModelCallParams): Promise<VideoModelCallResult> {
    // 视频模型需要异步处理
    // ...
  }

  /**
   * 选择最佳模型
   */
  private selectBestModel(models: ModelConfig[], params: RecommendModelParams): ModelConfig {
    // 根据任务类型和需求选择最佳模型
    const { taskType, requirements } = params;
    
    // 1. 按质量要求筛选
    let filtered = models;
    if (requirements?.quality === "fast") {
      filtered = filtered.filter(m => m.performance.avgResponseTime < 1000);
    } else if (requirements?.quality === "high") {
      filtered = filtered.filter(m => m.parameters.maxContext >= 8192);
    }
    
    // 2. 按成本筛选
    if (requirements?.cost === "low") {
      filtered = filtered.filter(m => 
        m.pricing?.current?.chat?.input === "$0 / 1M tokens"
      );
    }
    
    // 3. 按时间筛选
    if (requirements?.time === "realtime") {
      filtered = filtered.filter(m => m.performance.avgResponseTime < 500);
    }
    
    // 4. 如果没有筛选结果，返回第一个可用模型
    if (filtered.length === 0) {
      return models.find(m => m.isAvailable) || models[0];
    }
    
    // 5. 返回第一个筛选后的模型
    return filtered[0];
  }

  /**
   * 其他辅助方法...
   */
  private async listAvailableModels(type: string, userId: string): Promise<ModelConfig[]> {
    // 实现略
  }

  private async getModel(modelId: string): Promise<ModelConfig> {
    // 实现略
  }

  private async checkPermission(userId: string, modelId: string): Promise<void> {
    // 实现略
  }

  private async checkQuota(userId: string): Promise<void> {
    // 实现略
  }

  private async checkBudget(userId: string, model: ModelConfig): Promise<void> {
    // 实现略
  }

  private buildChatParams(model: ModelConfig, params: ChatModelCallParams): any {
    // 实现略
  }

  private estimateInputTokens(prompt: string, history?: any[], systemPrompt?: string): number {
    // 实现略
  }

  private estimateOutputTokens(content: string): number {
    // 实现略
  }

  private calculateCost(model: ModelConfig, inputTokens: number, outputTokens: number): number {
    // 实现略
  }

  private async saveCallRecord(record: any): Promise<void> {
    // 实现略
  }

  private async updateQuotaAndBudget(userId: string, cost: number): Promise<void> {
    // 实现略
  }

  private async updateModelStats(modelId: string, duration: number, success: boolean): Promise<void> {
    // 实现略
  }
}
```

---

### 4.2 剧本AI服务实现

```typescript
// backend/src/services/script-ai-impl.ts

import type { AppContext } from "./app.js";
import type { 
  ScriptAIService,
  CreateScriptParams,
  CreateScriptResult,
  OptimizeScriptParams,
  OptimizeScriptResult,
  GenerateSceneParams,
  GenerateSceneResult,
  GenerateDialogueParams,
  GenerateDialogueResult,
  BreakdownScriptParams,
  BreakdownScriptResult,
  CheckContinuityParams,
  CheckContinuityResult
} from "./script-ai.js";
import type { ModelCenterService } from "./model-center.js";
import { id, nowIso } from "../utils.js";

/**
 * 剧本AI服务实现
 */
export class ScriptAIServiceImpl implements ScriptAIService {
  constructor(
    private ctx: AppContext,
    private modelCenter: ModelCenterService
  ) {}

  /**
   * AI剧本创作
   */
  async createScript(params: CreateScriptParams): Promise<CreateScriptResult> {
    // 1. 构建系统提示词
    const systemPrompt = this.buildCreateScriptSystemPrompt(params);
    
    // 2. 构建用户提示词
    const userPrompt = this.buildCreateScriptUserPrompt(params);
    
    // 3. 调用模型中心
    const result = await this.modelCenter.callChatModel({
      userId: params.userId,
      projectId: params.projectId,
      modelId: params.modelId,
      taskType: "script_creation",
      taskName: "AI剧本创作",
      prompt: userPrompt,
      systemPrompt,
      parameters: {
        temperature: 0.8,
        max_tokens: 4000,
      },
    });
    
    // 4. 保存剧本
    const script = await this.saveScript(params.projectId, result.content);
    
    return {
      scriptId: script.id,
      content: result.content,
      modelId: result.modelId,
      modelName: result.modelName,
      tokens: result.tokens,
      cost: result.cost,
      duration: result.duration,
    };
  }

  /**
   * AI剧本优化
   */
  async optimizeScript(params: OptimizeScriptParams): Promise<OptimizeScriptResult> {
    // 1. 构建系统提示词
    const systemPrompt = this.buildOptimizeScriptSystemPrompt(params);
    
    // 2. 构建用户提示词
    const userPrompt = this.buildOptimizeScriptUserPrompt(params);
    
    // 3. 调用模型中心
    const result = await this.modelCenter.callChatModel({
      userId: params.userId,
      projectId: params.projectId,
      modelId: params.modelId,
      taskType: "script_optimization",
      taskName: `AI剧本优化-${params.optimizationType}`,
      prompt: userPrompt,
      systemPrompt,
      parameters: {
        temperature: 0.7,
        max_tokens: 4000,
      },
    });
    
    return {
      optimizedContent: result.content,
      modelId: result.modelId,
      modelName: result.modelName,
      tokens: result.tokens,
      cost: result.cost,
      duration: result.duration,
    };
  }

  /**
   * AI生成场景描述
   */
  async generateScene(params: GenerateSceneParams): Promise<GenerateSceneResult> {
    // 1. 构建系统提示词
    const systemPrompt = this.buildGenerateSceneSystemPrompt(params);
    
    // 2. 构建用户提示词
    const userPrompt = this.buildGenerateSceneUserPrompt(params);
    
    // 3. 调用模型中心
    const result = await this.modelCenter.callChatModel({
      userId: params.userId,
      projectId: params.projectId,
      modelId: params.modelId,
      taskType: "scene_generation",
      taskName: `生成场景-${params.sceneNo}`,
      prompt: userPrompt,
      systemPrompt,
      parameters: {
        temperature: 0.7,
        max_tokens: 1000,
      },
    });
    
    // 4. 解析场景内容
    const scene = this.parseSceneContent(result.content);
    
    // 5. 保存场景
    const savedScene = await this.saveScene(params.projectId, params.episodeId, scene);
    
    return {
      sceneId: savedScene.id,
      location: scene.location,
      time: scene.time,
      description: scene.description,
      characters: scene.characters,
      modelId: result.modelId,
      modelName: result.modelName,
      tokens: result.tokens,
      cost: result.cost,
      duration: result.duration,
    };
  }

  /**
   * AI生成对白
   */
  async generateDialogue(params: GenerateDialogueParams): Promise<GenerateDialogueResult> {
    // 实现类似 generateScene
    // ...
  }

  /**
   * AI拆分镜头
   */
  async breakdownScript(params: BreakdownScriptParams): Promise<BreakdownScriptResult> {
    // 1. 构建系统提示词
    const systemPrompt = this.buildBreakdownScriptSystemPrompt();
    
    // 2. 构建用户提示词
    const userPrompt = this.buildBreakdownScriptUserPrompt(params);
    
    // 3. 调用模型中心
    const result = await this.modelCenter.callChatModel({
      userId: params.userId,
      projectId: params.projectId,
      modelId: params.modelId,
      taskType: "breakdown",
      taskName: "AI拆分镜头",
      prompt: userPrompt,
      systemPrompt,
      parameters: {
        temperature: 0.6,
        max_tokens: 8000,
      },
    });
    
    // 4. 解析分镜内容
    const storyboards = this.parseBreakdownContent(result.content);
    
    // 5. 保存分镜
    await this.saveStoryboards(params.projectId, params.scriptId, storyboards);
    
    return {
      storyboards,
      modelId: result.modelId,
      modelName: result.modelName,
      tokens: result.tokens,
      cost: result.cost,
      duration: result.duration,
    };
  }

  /**
   * AI连续性检查
   */
  async checkContinuity(params: CheckContinuityParams): Promise<CheckContinuityResult> {
    // 1. 构建系统提示词
    const systemPrompt = this.buildCheckContinuitySystemPrompt(params);
    
    // 2. 构建用户提示词
    const userPrompt = this.buildCheckContinuityUserPrompt(params);
    
    // 3. 调用模型中心
    const result = await this.modelCenter.callChatModel({
      userId: params.userId,
      projectId: params.projectId,
      modelId: params.modelId,
      taskType: "continuity_check",
      taskName: `AI连续性检查-${params.checkType}`,
      prompt: userPrompt,
      systemPrompt,
      parameters: {
        temperature: 0.3,
        max_tokens: 2000,
      },
    });
    
    // 4. 解析检查结果
    const issues = this.parseContinuityIssues(result.content);
    
    return {
      issues,
      modelId: result.modelId,
      modelName: result.modelName,
      tokens: result.tokens,
      cost: result.cost,
      duration: result.duration,
    };
  }

  /**
   * 构建提示词的辅助方法...
   */
  private buildCreateScriptSystemPrompt(params: CreateScriptParams): string {
    return `你是一位专业的剧本创作AI助手，精通${params.style || "古装"}题材的${params.genre || "爱情"}剧本创作。

你的任务是根据用户的提示创作剧本，要求：
1. 剧本结构清晰，包含场景描述、角色动作、对白等
2. 符合${params.style || "古装"}题材的风格特点
3. 人物性格鲜明，对白生动自然
4. 剧情紧凑，节奏合理

请直接输出剧本内容，不要添加任何解释说明。`;
  }

  private buildCreateScriptUserPrompt(params: CreateScriptParams): string {
    return `请创作一个${params.length === "short" ? "短篇" : params.length === "long" ? "长篇" : "中篇"}剧本：

${params.prompt}

要求：
- 风格：${params.style || "古装"}
- 类型：${params.genre || "爱情"}
- 长度：${params.length === "short" ? "3-5个场景" : params.length === "long" ? "10个以上场景" : "5-10个场景"}`;
  }

  // 其他辅助方法略...
}
```

---

## 五、前端集成方案

### 5.1 前端服务调用

```typescript
// frontend/services/script-ai.service.ts

import { api } from "./api-client";

/**
 * 剧本AI服务接口
 */
export interface ScriptAIService {
  /** AI剧本创作 */
  createScript(params: CreateScriptParams): Promise<CreateScriptResult>;
  
  /** AI剧本优化 */
  optimizeScript(params: OptimizeScriptParams): Promise<OptimizeScriptResult>;
  
  /** AI生成场景 */
  generateScene(params: GenerateSceneParams): Promise<GenerateSceneResult>;
  
  /** AI生成对白 */
  generateDialogue(params: GenerateDialogueParams): Promise<GenerateDialogueResult>;
  
  /** AI拆分镜头 */
  breakdownScript(params: BreakdownScriptParams): Promise<BreakdownScriptResult>;
  
  /** AI连续性检查 */
  checkContinuity(params: CheckContinuityParams): Promise<CheckContinuityResult>;
}

/**
 * AI剧本创作
 */
export async function createScriptByAI(
  projectId: string,
  params: CreateScriptParams
): Promise<CreateScriptResult> {
  return api<CreateScriptResult>(`/api/projects/${projectId}/scripts/ai/create`, {
    method: "POST",
    body: JSON.stringify(params),
  });
}

/**
 * AI剧本优化
 */
export async function optimizeScriptByAI(
  projectId: string,
  params: OptimizeScriptParams
): Promise<OptimizeScriptResult> {
  return api<OptimizeScriptResult>(`/api/projects/${projectId}/scripts/ai/optimize`, {
    method: "POST",
    body: JSON.stringify(params),
  });
}

/**
 * AI生成场景
 */
export async function generateSceneByAI(
  projectId: string,
  params: GenerateSceneParams
): Promise<GenerateSceneResult> {
  return api<GenerateSceneResult>(`/api/projects/${projectId}/scripts/ai/scene`, {
    method: "POST",
    body: JSON.stringify(params),
  });
}

/**
 * AI拆分镜头
 */
export async function breakdownScriptByAI(
  projectId: string,
  params: BreakdownScriptParams
): Promise<BreakdownScriptResult> {
  return api<BreakdownScriptResult>(`/api/projects/${projectId}/scripts/ai/breakdown`, {
    method: "POST",
    body: JSON.stringify(params),
  });
}
```

---

### 5.2 前端组件使用示例

```typescript
// frontend/components/script/script-ai-panel.tsx

import { useState } from "react";
import { createScriptByAI, optimizeScriptByAI } from "@/services/script-ai.service";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function ScriptAIPanel({ projectId }: { projectId: string }) {
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreateScript = async () => {
    setLoading(true);
    try {
      const result = await createScriptByAI(projectId, {
        userId: "current-user",  // 从上下文获取
        prompt,
        style: "古装",
        genre: "爱情",
        length: "medium",
      });
      
      setResult(result.content);
      
      // 显示模型信息
      console.log(`使用模型: ${result.modelName}`);
      console.log(`Token消耗: ${result.tokens.input} + ${result.tokens.output}`);
      console.log(`成本: $${result.cost.toFixed(4)}`);
      
    } catch (error) {
      console.error("AI创作失败:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3>AI剧本创作</h3>
      
      <Textarea
        placeholder="输入剧本创作提示词..."
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={4}
      />
      
      <Button onClick={handleCreateScript} disabled={loading}>
        {loading ? "创作中..." : "开始创作"}
      </Button>
      
      {result && (
        <div className="mt-4">
          <h4>创作结果：</h4>
          <pre className="whitespace-pre-wrap">{result}</pre>
        </div>
      )}
    </div>
  );
}
```

---

## 六、集成流程图

```
用户操作 → 剧本中心前端 → 剧本AI服务API → 剧本AI服务层
                                              ↓
                                        模型中心服务
                                              ↓
                                        智能推荐模型
                                              ↓
                                        权限/配额验证
                                              ↓
                                        调用AI模型
                                              ↓
                                        AgnesClient
                                              ↓
                                        Agnes API
                                              ↓
                                        返回结果
                                              ↓
                                        保存调用记录
                                              ↓
                                        返回给剧本中心
```

---

## 七、实施步骤

### 7.1 第一阶段：基础设施

1. **扩展类型定义**
   - 在 `backend/src/types.ts` 中添加模型中心相关类型
   - 添加剧本AI服务相关类型

2. **创建数据库表**
   - 创建 `model_configs` 表
   - 创建 `model_call_records` 表
   - 创建 `user_quotas` 表
   - 创建 `user_budgets` 表

3. **实现模型中心服务**
   - 实现 `ModelCenterServiceImpl`
   - 实现智能推荐逻辑
   - 实现权限验证
   - 实现配额和预算控制

---

### 7.2 第二阶段：剧本AI服务

1. **实现剧本AI服务**
   - 实现 `ScriptAIServiceImpl`
   - 实现各种AI功能（创作、优化、生成分镜等）

2. **实现提示词构建**
   - 实现各种场景的系统提示词
   - 实现用户提示词构建

3. **实现结果解析**
   - 实现场景内容解析
   - 实现分镜内容解析
   - 实现连续性问题解析

---

### 7.3 第三阶段：前端集成

1. **创建前端服务**
   - 创建 `script-ai.service.ts`
   - 实现各种AI功能API调用

2. **创建前端组件**
   - 创建 `ScriptAIPanel` 组件
   - 集成模型选择功能
   - 集成参数配置功能

---

## 八、总结

通过模型中心与剧本中心的集成，实现了：

✅ **统一模型管理** - 所有AI模型调用都通过模型中心，便于管理和监控  
✅ **智能模型推荐** - 根据任务类型和需求自动推荐最佳模型  
✅ **权限和配额控制** - 严格控制用户访问权限和调用配额  
✅ **成本透明化** - 每次调用都记录成本，便于成本控制  
✅ **调用记录完整** - 完整的调用记录便于分析和优化  

---

**文档位置**: `d:\trae\manju\docs\script-model-integration.md`