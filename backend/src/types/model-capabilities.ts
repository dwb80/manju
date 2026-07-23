/**
 * @file model-capabilities.ts
 * @description V2 W11 MODEL-F01/F02/F04 模型能力声明 + 参数约束
 *
 * 设计目标:
 *  - **单一事实源**:把每个模型的"能做什么 / 参数范围"集中声明,而不是散落在各 client
 *  - **可枚举**:`getAllModels() / getModelByName()` 给前端下拉、动态校验、契约测试用
 *  - **类型安全**:TS 联合类型约束(enum-like 字符串)
 *  - **不依赖 DB**:遵循 V2 schema freeze 原则,模型目录是**前端展示 + 后端校验**层面的概念
 *
 * 与 V1 差异:
 *  - V1 只能"试调错"才能知道模型不支持某能力(运行时抛错)
 *  - V2 W11 加这层后,可以在 UI 隐藏不支持的能力、在 dispatch 前校验参数、给契约测试提供 ground truth
 *
 * 集成点:
 *  - services/horizontal/model-constraints-service.ts:运行时校验/查询
 *  - ai/*.ts:各 client 在 dispatch 前走 isCapabilitySupported 短路
 *  - http/router.ts:暴露 GET /api/models/capabilities / GET /api/models/:name/validate
 */

export type ModelProvider = "agnes" | "zhipu" | "cerebras" | "sensenova" | "edge" | "fake";

export type ModelCapability =
  | "chat"           // 文本对话(流式)
  | "image"          // 文生图 / 图生图
  | "video"          // 文生视频 / 图生视频
  | "tts"            // 文字转语音
  | "asr"            // 语音转文字
  | "embedding"      // 文本向量化
  | "thinking"       // 思考链(只部分 chat 模型支持)
  | "function_call"  // 工具调用(预留)
  ;

export interface ParamRange {
  min?: number;
  max?: number;
  /** 离散可选值(枚举) */
  enum?: (string | number)[];
  /** 步长(数值时) */
  step?: number;
  /** 默认值 */
  default?: number | string;
}

export interface ImageParamConstraints {
  ratio?: ParamRange;
  width?: ParamRange;
  height?: ParamRange;
  steps?: ParamRange;
  seed?: ParamRange;
}

export interface VideoParamConstraints {
  ratio?: ParamRange;
  width?: ParamRange;
  height?: ParamRange;
  duration?: ParamRange;
  num_inference_steps?: ParamRange;
  fps?: ParamRange;
}

export interface ChatParamConstraints {
  temperature?: ParamRange;
  top_p?: ParamRange;
  max_tokens?: ParamRange;
  /** 是否支持流式(几乎所有 chat 都支持) */
  stream?: boolean;
  /** 是否支持 thinking.type=enabled */
  thinking?: boolean;
}

export interface TtsParamConstraints {
  voice?: ParamRange;
  speed?: ParamRange;
  pitch?: ParamRange;
  format?: ParamRange;
}

export interface ModelCapabilities {
  /** 模型唯一 key(provider 路由 + 用户选择用) */
  name: string;
  /** 人类可读名(中文) */
  label: string;
  /** Provider 类别 */
  provider: ModelProvider;
  /** 能力列表 */
  capabilities: ModelCapability[];
  /** 描述 */
  description: string;
  /** 上下文窗口(tokens) */
  contextWindow?: number;
  /** 计费单价(¥/1k tokens 或 ¥/次;空 = 不可计) */
  pricing?: { input?: number; output?: number; perImage?: number; perVideoSecond?: number };
  /** 参数约束(按能力分块) */
  image?: ImageParamConstraints;
  video?: VideoParamConstraints;
  chat?: ChatParamConstraints;
  tts?: TtsParamConstraints;
  /** 是否默认在前端 UI 展示(默认 true) */
  visible?: boolean;
  /** 弃用标记 */
  deprecated?: boolean;
}

// =====================================================================
// 目录(单一事实源)
// =====================================================================
export const MODEL_CATALOG: ModelCapabilities[] = [
  {
    name: "agnes-chat-v3.5",
    label: "Agnes Chat v3.5",
    provider: "agnes",
    capabilities: ["chat"],
    description: "agnes 多模态 chat 模型,通用对话与剧本生成",
    contextWindow: 128000,
    pricing: { input: 0.001, output: 0.002 },
    chat: {
      temperature: { min: 0, max: 2, default: 0.7, step: 0.05 },
      top_p: { min: 0, max: 1, default: 0.9, step: 0.05 },
      max_tokens: { min: 1, max: 8192, default: 2048 },
      stream: true,
      thinking: false,
    },
    visible: true,
  },
  {
    name: "agnes-image-2.1-flash",
    label: "Agnes Image 2.1 Flash",
    provider: "agnes",
    capabilities: ["image"],
    description: "agnes 快速文生图,适合草稿/分镜",
    pricing: { perImage: 0.05 },
    image: {
      ratio: { enum: ["16:9", "9:16", "1:1"] },
      width: { enum: [512, 768, 1024, 1280, 1536] },
      height: { enum: [512, 768, 1024, 1280, 1536] },
      steps: { min: 10, max: 50, default: 25, step: 1 },
      seed: { min: 0, max: 2_147_483_647 },
    },
    visible: true,
  },
  {
    name: "agnes-video-v2.0",
    label: "Agnes Video v2.0",
    provider: "agnes",
    capabilities: ["video"],
    description: "agnes 文生视频/图生视频,主流规格全覆盖",
    pricing: { perVideoSecond: 0.5 },
    video: {
      ratio: { enum: ["16:9", "9:16", "1:1"] },
      width: { enum: [720, 1080, 1920, 3840] },
      height: { enum: [720, 1080, 1920, 2160] },
      duration: { enum: [3, 5, 10, 18] },
      num_inference_steps: { min: 10, max: 50, default: 30 },
      fps: { enum: [24, 30, 60] },
    },
    visible: true,
  },
  {
    name: "glm-4.7-flash",
    label: "智谱 GLM-4.7 Flash",
    provider: "zhipu",
    capabilities: ["chat", "thinking"],
    description: "智谱 GLM-4.7 快速文本模型,支持思考模式",
    contextWindow: 128000,
    pricing: { input: 0.0001, output: 0.0001 },
    chat: {
      temperature: { min: 0, max: 1, default: 0.6, step: 0.05 },
      top_p: { min: 0, max: 1, default: 0.9, step: 0.05 },
      max_tokens: { min: 1, max: 16384, default: 4096 },
      stream: true,
      thinking: true,
    },
    visible: true,
  },
  {
    name: "glm-4.6",
    label: "智谱 GLM-4.6",
    provider: "zhipu",
    capabilities: ["chat", "thinking"],
    description: "智谱 GLM-4.6 标准文本模型",
    contextWindow: 200000,
    pricing: { input: 0.0006, output: 0.0006 },
    chat: {
      temperature: { min: 0, max: 1, default: 0.6 },
      max_tokens: { min: 1, max: 16384, default: 4096 },
      stream: true,
      thinking: true,
    },
    visible: true,
  },
  {
    name: "cerebras-llama-3.3-70b",
    label: "Cerebras Llama 3.3 70B",
    provider: "cerebras",
    capabilities: ["chat"],
    description: "Cerebras 高速推理 Llama 3.3 70B",
    contextWindow: 128000,
    pricing: { input: 0.0001, output: 0.0001 },
    chat: {
      temperature: { min: 0, max: 2, default: 0.7 },
      top_p: { min: 0, max: 1, default: 0.9 },
      max_tokens: { min: 1, max: 8192, default: 2048 },
      stream: true,
      thinking: false,
    },
    visible: true,
  },
  {
    name: "sensenova-nano-8b",
    label: "商汤 SenseNova Nano 8B",
    provider: "sensenova",
    capabilities: ["chat"],
    description: "商汤轻量级文本模型",
    contextWindow: 32000,
    pricing: { input: 0.0002, output: 0.0002 },
    chat: {
      temperature: { min: 0, max: 1, default: 0.6 },
      max_tokens: { min: 1, max: 4096, default: 1024 },
      stream: true,
      thinking: false,
    },
    visible: true,
  },
  {
    name: "edge-tts-zh",
    label: "Edge TTS (中文)",
    provider: "edge",
    capabilities: ["tts"],
    description: "微软 Edge 浏览器 TTS,中文女声",
    pricing: { output: 0.00001 },
    tts: {
      voice: { enum: ["zh-CN-XiaoxiaoNeural", "zh-CN-YunxiNeural", "zh-CN-YunjianNeural"] },
      speed: { min: 0.5, max: 2, default: 1, step: 0.1 },
      pitch: { min: -12, max: 12, default: 0, step: 1 },
      format: { enum: ["mp3", "wav"] },
    },
    visible: true,
  },
  {
    name: "fake-ai-client",
    label: "Fake AI (开发用)",
    provider: "fake",
    capabilities: ["chat", "image", "video", "tts", "asr", "embedding", "thinking"],
    description: "假 AI,所有能力都『支持』,纯返回占位数据;只用于本地/演示",
    visible: false, // 不在生产 UI 展示
  },
];

// =====================================================================
// 索引 + 工具函数
// =====================================================================
const MODEL_BY_NAME: Map<string, ModelCapabilities> = new Map(
  MODEL_CATALOG.map((m) => [m.name, m]),
);

export function getAllModels(opts?: { provider?: ModelProvider; capability?: ModelCapability; visibleOnly?: boolean }): ModelCapabilities[] {
  return MODEL_CATALOG.filter((m) => {
    if (opts?.provider && m.provider !== opts.provider) return false;
    if (opts?.capability && !m.capabilities.includes(opts.capability)) return false;
    if (opts?.visibleOnly && m.visible === false) return false;
    if (m.deprecated) return false;
    return true;
  });
}

export function getModelByName(name: string): ModelCapabilities | null {
  return MODEL_BY_NAME.get(name) ?? null;
}

export function isCapabilitySupported(modelName: string, capability: ModelCapability): boolean {
  const m = getModelByName(modelName);
  if (!m) return false;
  return m.capabilities.includes(capability);
}

export function getModelsForCapability(capability: ModelCapability): ModelCapabilities[] {
  return MODEL_CATALOG.filter((m) => m.capabilities.includes(capability) && m.visible !== false && !m.deprecated);
}

// =====================================================================
// 参数约束校验(F03 动态校验)
// =====================================================================
export type ValidationIssue = {
  field: string;
  message: string;
  expected: string;
  got: unknown;
};

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  /** 修正建议(自动 clamp/enum 归一) */
  normalized?: Record<string, unknown>;
}

function validateField(fieldName: string, value: unknown, range: ParamRange | undefined, issues: ValidationIssue[]): unknown {
  if (value === undefined || value === null) {
    return range?.default; // 缺省:不动或填默认
  }
  if (!range) return value;
  if (range.enum && range.enum.length > 0) {
    if (!range.enum.includes(value as any)) {
      issues.push({
        field: fieldName,
        message: `value not in enum`,
        expected: range.enum.join(" | "),
        got: value,
      });
      return range.default ?? range.enum[0];
    }
    return value;
  }
  if (typeof value === "number") {
    let n = value;
    if (typeof range.min === "number" && n < range.min) {
      issues.push({ field: fieldName, message: "below min", expected: `>=${range.min}`, got: value });
      n = range.min;
    }
    if (typeof range.max === "number" && n > range.max) {
      issues.push({ field: fieldName, message: "above max", expected: `<=${range.max}`, got: value });
      n = range.max;
    }
    if (typeof range.step === "number" && range.step > 0) {
      const stepped = Math.round(n / range.step) * range.step;
      if (stepped !== n) n = stepped;
    }
    return n;
  }
  return value;
}

/** 校验 image 参数(走 MODEL.image 约束);返回 valid + 修正后的 params */
export function validateImageParams(modelName: string, params: Record<string, unknown>): ValidationResult {
  const m = getModelByName(modelName);
  const issues: ValidationIssue[] = [];
  if (!m) {
    issues.push({ field: "model", message: "model not found", expected: "known model name", got: modelName });
    return { valid: false, issues };
  }
  if (!m.capabilities.includes("image")) {
    issues.push({ field: "capability", message: "model does not support image", expected: "image-capable model", got: m.capabilities });
    return { valid: false, issues };
  }
  const constraints = m.image ?? {};
  const normalized: Record<string, unknown> = {};
  normalized.ratio = validateField("ratio", params.ratio, constraints.ratio, issues);
  normalized.width = validateField("width", params.width, constraints.width, issues);
  normalized.height = validateField("height", params.height, constraints.height, issues);
  if (params.steps !== undefined) normalized.steps = validateField("steps", params.steps, constraints.steps, issues);
  if (params.seed !== undefined) normalized.seed = validateField("seed", params.seed, constraints.seed, issues);
  return { valid: issues.length === 0, issues, normalized };
}

/** 校验 video 参数(走 MODEL.video 约束) */
export function validateVideoParams(modelName: string, params: Record<string, unknown>): ValidationResult {
  const m = getModelByName(modelName);
  const issues: ValidationIssue[] = [];
  if (!m) {
    issues.push({ field: "model", message: "model not found", expected: "known model name", got: modelName });
    return { valid: false, issues };
  }
  if (!m.capabilities.includes("video")) {
    issues.push({ field: "capability", message: "model does not support video", expected: "video-capable model", got: m.capabilities });
    return { valid: false, issues };
  }
  const constraints = m.video ?? {};
  const normalized: Record<string, unknown> = {};
  normalized.ratio = validateField("ratio", params.ratio, constraints.ratio, issues);
  normalized.width = validateField("width", params.width, constraints.width, issues);
  normalized.height = validateField("height", params.height, constraints.height, issues);
  normalized.duration = validateField("duration", params.duration, constraints.duration, issues);
  if (params.num_inference_steps !== undefined) normalized.num_inference_steps = validateField("num_inference_steps", params.num_inference_steps, constraints.num_inference_steps, issues);
  if (params.fps !== undefined) normalized.fps = validateField("fps", params.fps, constraints.fps, issues);
  return { valid: issues.length === 0, issues, normalized };
}

/** 校验 chat 参数 */
export function validateChatParams(modelName: string, params: Record<string, unknown>): ValidationResult {
  const m = getModelByName(modelName);
  const issues: ValidationIssue[] = [];
  if (!m) {
    issues.push({ field: "model", message: "model not found", expected: "known model name", got: modelName });
    return { valid: false, issues };
  }
  if (!m.capabilities.includes("chat")) {
    issues.push({ field: "capability", message: "model does not support chat", expected: "chat-capable model", got: m.capabilities });
    return { valid: false, issues };
  }
  const constraints = m.chat ?? {};
  const normalized: Record<string, unknown> = {};
  if (params.temperature !== undefined) normalized.temperature = validateField("temperature", params.temperature, constraints.temperature, issues);
  if (params.top_p !== undefined) normalized.top_p = validateField("top_p", params.top_p, constraints.top_p, issues);
  if (params.max_tokens !== undefined) normalized.max_tokens = validateField("max_tokens", params.max_tokens, constraints.max_tokens, issues);
  if (params.thinking !== undefined && !constraints.thinking) {
    issues.push({ field: "thinking", message: "model does not support thinking", expected: "thinking-capable model", got: params.thinking });
  }
  return { valid: issues.length === 0, issues, normalized };
}

// =====================================================================
// 参数标准映射(F04)—— 把旧字段名/字符串 ratio 映射到标准 params
// =====================================================================
/**
 * 把"ratio 字符串" + "duration 数字" 这类 V1 写法转成 MODEL.constraints 期望的标准 params。
 * 旧 API: { ratio: "9:16", duration: 5, num_inference_steps: 30 }
 * 标准:   { ratio: "9:16", width: 1080, height: 1920, duration: 5, num_inference_steps: 30, fps: 30 }
 */
export function standardizeVideoParams(modelName: string, input: { ratio?: string; duration?: number; num_inference_steps?: number; width?: number; height?: number; fps?: number; }): Record<string, unknown> {
  const ratio = input.ratio ?? "16:9";
  let width = input.width;
  let height = input.height;
  if (!width || !height) {
    switch (ratio) {
      case "9:16": width = 1080; height = 1920; break;
      case "1:1": width = 1080; height = 1080; break;
      case "16:9":
      default: width = 1920; height = 1080; break;
    }
  }
  return {
    ratio,
    width,
    height,
    duration: input.duration ?? 5,
    num_inference_steps: input.num_inference_steps ?? 30,
    fps: input.fps ?? 30,
  };
}
