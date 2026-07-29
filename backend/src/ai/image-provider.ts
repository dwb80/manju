/**
 * @file image-provider.ts
 * @description S1.1 图片 Provider 适配器抽象 + 路由层
 *
 * ## 目标
 * 解决 `ai-client-factory.ts:314-319` 把 image 写死为 Agnes 的反抽象问题，
 * 为后续接 Jimeng / Flux / SDXL / DALL-E / Midjourney 铺路。
 *
 * ## 与现有 model-capabilities.ts 的关系
 * - `model-capabilities.ts`：声明层（"agnes-image-2.1-flash 支持 image / image2Image"）
 * - `image-provider.ts`（本文件）：执行层（"agnes-image-2.1-flash 调哪个 SDK、payload 怎么组装"）
 * - 两者一一对应：`MODEL_CATALOG` 里 capabilities 含 "image" 的模型，必须在本文件注册 Provider
 *
 * ## 文档基线
 * - 冻结于 `docs/requirements/modules/05-ai-image-config.md §6.2 / §6.3 / §6.4`（V1.1）
 * - 工厂侧使用约束：`docs/requirements/modules/04-factories-assets-and-image-views.md §13`
 *
 * ## 使用方式
 * ```ts
 * import { ImageProviderRouter } from "@/ai/image-provider.js";
 *
 * const router = new ImageProviderRouter();
 * router.register(new AgnesImageProvider(agnesClient));
 *
 * const resp = await router.generateImage({
 *   model: "agnes-image-2.1-flash",
 *   prompt: "古风少年剑客",
 *   ratio: "9:16",
 *   size: "768x1152",
 *   n: 1,
 *   responseFormat: "url",
 * }, signal);
 * ```
 */

import type { SupportedRatio } from "./image-config.js";
import { rootLogger } from "../logger.js";

// =====================================================================
// 能力标签（与 model-capabilities.ts 的 ParamRange 互补，但层级不同）
// =====================================================================

/**
 * Provider 能力声明。
 *
 * 字段说明（与 `05-ai-image-config.md §6.2` 冻结）：
 * - text2Image：文生图
 * - image2Image：图生图（接收 referenceImages）
 * - negativePrompt：支持负面提示词
 * - seed：支持 seed 复现
 * - batchSupported：支持一次请求 n>1；不支持的 Provider 由 router 内部并发循环
 * - supportedRatios：支持的比例列表（"9:16" / "16:9" / ...）
 * - asyncTask：是否异步（需 queryTask）；同步 Provider 留空
 * - maxN：单次最大候选数（同步 Provider 通常 4，异步 Provider 通常 1）
 */
export interface ImageProviderCapabilities {
  text2Image: boolean;
  image2Image: boolean;
  negativePrompt: boolean;
  seed: boolean;
  batchSupported: boolean;
  supportedRatios: readonly SupportedRatio[];
  asyncTask: boolean;
  maxN: number;
}

// =====================================================================
// Provider 标准请求 / 响应
// =====================================================================

/**
 * 图片 Provider 标准请求（与厂商无关）。
 * 业务代码只与本类型交互，禁止把厂商特定字段（如 agnesExtraSteps）写进这里。
 */
export interface ImageProviderRequest {
  /** 必须来自 provider.supportedModels 之一 */
  model: string;
  prompt: string;
  negative_prompt?: string;
  /** 图生图参考图（多张）；文生图不传 */
  referenceImages?: string[];
  /** 比例（已在 image-config.ts 校验） */
  ratio: SupportedRatio;
  /** 尺寸（与 ratio 联动） */
  size: string;
  /** 候选数（1-maxN） */
  n: number;
  seed?: number;
  /** url（默认）或 b64_json */
  responseFormat: "url" | "b64_json";
  /** Provider 私有扩展（透传给具体实现；禁止业务代码依赖） */
  providerExtras?: Record<string, unknown>;
}

/** 图片 Provider 标准响应（统一封装） */
export interface ImageProviderResponse {
  imageUrls: string[];
  /** 异步 Provider 必填；同步 Provider 留空 */
  taskId?: string;
  /** 透传的 Provider 元信息（用于日志 / 排查） */
  providerMeta?: {
    providerId: string;
    model: string;
    requestId?: string;
    latencyMs?: number;
  };
}

/** 异步任务状态 */
export type ImageTaskStatus =
  | { status: "pending" | "processing" }
  | { status: "success"; imageUrls: string[] }
  | { status: "failed"; error: string };

// =====================================================================
// 统一错误
// =====================================================================

/**
 * Provider 错误（含 providerId / retryable 标志）
 * - 上层可据此做"等待后重试 / 降级到其他 Provider"等差异化处理
 * - AgnesRateLimitError 等具体错误在 Provider 实现里被包成 ModelProviderError(retryable=true)
 */
export class ModelProviderError extends Error {
  readonly providerId: string;
  readonly code: string;
  readonly retryable: boolean;
  readonly httpStatus?: number;
  readonly cause?: unknown;

  constructor(opts: {
    providerId: string;
    code: string;
    message: string;
    retryable: boolean;
    httpStatus?: number;
    cause?: unknown;
  }) {
    super(opts.message);
    this.name = "ModelProviderError";
    this.providerId = opts.providerId;
    this.code = opts.code;
    this.retryable = opts.retryable;
    this.httpStatus = opts.httpStatus;
    this.cause = opts.cause;
  }
}

/** 模型未注册错误 */
export class ModelNotFoundError extends ModelProviderError {
  constructor(kind: string, model: string) {
    super({
      providerId: "router",
      code: "model_not_found",
      message: `No image provider registered for model "${model}" (kind=${kind})`,
      retryable: false,
    });
    this.name = "ModelNotFoundError";
  }
}

// =====================================================================
// 适配器接口
// =====================================================================

/**
 * 图片 Provider 适配器接口。
 * 任何图片生成后端（Agnes / 即梦 / Flux / SDXL / DALL-E 等）必须实现本接口。
 * 业务代码（AI 对话框 / image-history / AssetImage）只与本接口交互。
 */
export interface ImageProviderAdapter {
  /** Provider 唯一 ID（"agnes" / "jimeng" / "flux" ...） */
  readonly providerId: string;
  /** 支持的模型 ID 列表（用于 model 下拉与路由分派） */
  readonly supportedModels: readonly string[];
  /** 能力标签（用于 UI 智能模式推荐 + 路由策略） */
  readonly capabilities: ImageProviderCapabilities;

  /**
   * 生成图片。
   * 同步 Provider：直接返回结果。
   * 异步 Provider：返回 taskId，调用方后续用 queryTask() 查询。
   */
  generateImage(
    request: ImageProviderRequest,
    signal?: AbortSignal,
  ): Promise<ImageProviderResponse>;

  /**
   * 查询异步任务（部分 Provider 是异步；同步 Provider 可不实现）。
   */
  queryTask?(taskId: string, signal?: AbortSignal): Promise<ImageTaskStatus>;
}

// =====================================================================
// 路由层
// =====================================================================

/**
 * 图片 Provider 路由器。
 * 类似 RoutedAIClient.pickClient，但专为图片设计。
 *
 * 路由规则：按 request.model 精确匹配某个已注册 Adapter。
 * 聚合：所有 Adapter 的 capabilities 合并（取并集），用于 UI 推荐。
 */
export class ImageProviderRouter {
  /** model ID → Adapter（按 model 精确匹配） */
  private readonly adapters: Map<string, ImageProviderAdapter> = new Map();
  /** providerId → Adapter（按 provider 查找，用于 queryTask 路由） */
  private readonly adaptersByProviderId: Map<string, ImageProviderAdapter> = new Map();
  private aggregatedCapabilities: ImageProviderCapabilities | null = null;

  /** 注册一个 Provider（如 new AgnesImageProvider(agnesClient)）。
   *  重复注册的语义（S4.0.3 收口）：
   *  - 重复 model：先注册者被**新 provider 覆盖**（warn："已替换"），允许运营侧热替换
   *    例如临时把某 model 从 agnes 切到 jimeng 做 A/B。
   *  - 重复 providerId：`adaptersByProviderId` 也**同步覆盖**到新 adapter（保持与 model 表一致），
   *    避免 queryTask() 路由到旧实例导致"图片能生成但任务查不到"。warn 统一为"已替换"。
   *  - 之前 `adaptersByProviderId` 是"保留先注册者"——这会导致"model 表已替换但 queryTask 走旧实例"
   *    的不一致窗口，是 S4.0.3 review 识别的语义瑕疵。 */
  register(adapter: ImageProviderAdapter): void {
    for (const model of adapter.supportedModels) {
      if (this.adapters.has(model)) {
        const existing = this.adapters.get(model)!;
        rootLogger.warn(
          {
            event: "image.router.duplicate_model",
            model,
            existingProvider: existing.providerId,
            newProvider: adapter.providerId,
          },
          `模型 "${model}" 已被 "${existing.providerId}" 注册，已被 "${adapter.providerId}" 替换`,
        );
      }
      this.adapters.set(model, adapter);
    }
    // providerId 重复注册：adaptersByProviderId 同步覆盖到新 adapter，
    // 与 model 表保持一致（"按 provider 路由"和"按 model 路由"看到的 provider 必须是同一个实例）
    if (this.adaptersByProviderId.has(adapter.providerId)) {
      const existing = this.adaptersByProviderId.get(adapter.providerId)!;
      rootLogger.warn(
        {
          event: "image.router.duplicate_provider",
          providerId: adapter.providerId,
          existingModelCount: existing.supportedModels.length,
          newModelCount: adapter.supportedModels.length,
        },
        `Provider "${adapter.providerId}" 已存在，已被新实例替换（model 表与 providerId 入口保持同步）`,
      );
    }
    this.adaptersByProviderId.set(adapter.providerId, adapter);
    this.aggregatedCapabilities = null; // 失效聚合缓存
    if (rootLogger.isLevelEnabled("debug")) {
      rootLogger.debug(
        {
          event: "image.router.register",
          providerId: adapter.providerId,
          models: [...adapter.supportedModels],
          totalModels: this.adapters.size,
        },
        `注册图片 Provider "${adapter.providerId}"，共 ${adapter.supportedModels.length} 个 model`,
      );
    }
  }

  /** 获取所有已注册的 Provider */
  getRegisteredAdapters(): readonly ImageProviderAdapter[] {
    const unique = new Set<ImageProviderAdapter>();
    for (const a of this.adapters.values()) unique.add(a);
    return [...unique];
  }

  /** 获取所有支持的 model ID */
  getSupportedModels(): readonly string[] {
    return [...this.adapters.keys()];
  }

  /**
   * 聚合能力（用于 UI 智能模式推荐）。
   *
   * 字段聚合语义（V1.3 收紧）：
   *
   * | 字段             | 聚合方式 | 理由 |
   * |------------------|----------|------|
   * | text2Image       | OR       | 任一 Provider 支持即向用户展示"文生图"入口（路由时按 model 二次校验） |
   * | image2Image      | OR       | 同上 |
   * | negativePrompt   | OR       | 同上（路由时二次校验） |
   * | seed             | OR       | 同上 |
   * | **batchSupported** | **AND**  | **保守语义：必须所有已注册 Provider 都支持批量，UI 才展示"一次出 N 张"开关**。否则路由到 n=1 的异步 Provider 时用户拿不到 N 张，会投诉"图少了"。S1 阶段只有 Agnes（支持），效果等同 OR；S2 接入异步 Provider（如 Midjourney）后这条规则的差异就显现出来了。 |
   * | asyncTask        | OR       | 任一 Provider 异步就允许"查询任务"按钮（路由时再判断 provider.queryTask 是否实现） |
   * | supportedRatios  | UNION    | 全部支持的比例并集，UI 下拉全量展示 |
   * | maxN             | MAX      | 选最大 N，UI 默认推荐值上限。**注意**：具体请求时仍由 router 校验 `n <= adapter.capabilities.maxN`，超出抛 `n_out_of_range`。 |
   */
  getAggregatedCapabilities(): ImageProviderCapabilities {
    if (this.aggregatedCapabilities) return this.aggregatedCapabilities;
    let text2Image = false;
    let image2Image = false;
    let negativePrompt = false;
    let seed = false;
    // batchSupported 必须从 true 起步，所有 Provider 都为 true 时才保持 true（AND）
    let batchSupported = true;
    let asyncTask = false;
    const ratios = new Set<SupportedRatio>();
    let maxN = 1;
    let hasAny = false;

    for (const adapter of this.adapters.values()) {
      hasAny = true;
      const c = adapter.capabilities;
      text2Image = text2Image || c.text2Image;
      image2Image = image2Image || c.image2Image;
      negativePrompt = negativePrompt || c.negativePrompt;
      seed = seed || c.seed;
      batchSupported = batchSupported && c.batchSupported;
      asyncTask = asyncTask || c.asyncTask;
      for (const r of c.supportedRatios) ratios.add(r);
      if (c.maxN > maxN) maxN = c.maxN;
    }

    // 无 Provider 时 batchSupported 默认 false（避免空 router 误报"支持批量"）
    if (!hasAny) batchSupported = false;

    this.aggregatedCapabilities = {
      text2Image,
      image2Image,
      negativePrompt,
      seed,
      batchSupported,
      supportedRatios: [...ratios].sort() as readonly SupportedRatio[],
      asyncTask,
      maxN,
    };
    return this.aggregatedCapabilities;
  }

  /**
   * 生成图片（路由入口）。
   * 按 request.model 精确匹配 Provider；未匹配抛 ModelNotFoundError。
   */
  async generateImage(
    request: ImageProviderRequest,
    signal?: AbortSignal,
  ): Promise<ImageProviderResponse> {
    const adapter = this.adapters.get(request.model);
    if (!adapter) {
      throw new ModelNotFoundError("image", request.model);
    }
    // 能力校验（前置拦截）
    const cap = adapter.capabilities;
    if (request.referenceImages && request.referenceImages.length > 0 && !cap.image2Image) {
      throw new ModelProviderError({
        providerId: adapter.providerId,
        code: "capability_not_supported",
        message: `Provider "${adapter.providerId}" (model "${request.model}") 不支持图生图，但请求携带了 ${request.referenceImages.length} 张参考图`,
        retryable: false,
      });
    }
    if (request.negative_prompt && !cap.negativePrompt) {
      throw new ModelProviderError({
        providerId: adapter.providerId,
        code: "capability_not_supported",
        message: `Provider "${adapter.providerId}" (model "${request.model}") 不支持负面提示词`,
        retryable: false,
      });
    }
    if (request.seed !== undefined && !cap.seed) {
      throw new ModelProviderError({
        providerId: adapter.providerId,
        code: "capability_not_supported",
        message: `Provider "${adapter.providerId}" (model "${request.model}") 不支持 seed`,
        retryable: false,
      });
    }
    if (!cap.supportedRatios.includes(request.ratio)) {
      throw new ModelProviderError({
        providerId: adapter.providerId,
        code: "ratio_not_supported",
        message: `Provider "${adapter.providerId}" (model "${request.model}") 不支持比例 "${request.ratio}"；支持：${cap.supportedRatios.join(", ")}`,
        retryable: false,
      });
    }
    if (request.n < 1 || request.n > cap.maxN) {
      throw new ModelProviderError({
        providerId: adapter.providerId,
        code: "n_out_of_range",
        message: `Provider "${adapter.providerId}" (model "${request.model}") 的 n 必须在 1~${cap.maxN}，收到 ${request.n}`,
        retryable: false,
      });
    }

    const startedAt = Date.now();
    try {
      const resp = await adapter.generateImage(request, signal);
      const latencyMs = Date.now() - startedAt;
      if (rootLogger.isLevelEnabled("debug")) {
        rootLogger.debug(
          {
            event: "image.router.invoke",
            providerId: adapter.providerId,
            model: request.model,
            imageCount: resp.imageUrls.length,
            latencyMs,
            async: Boolean(resp.taskId),
          },
          `图片生成完成：Provider=${adapter.providerId} Model=${request.model} 耗时=${latencyMs}ms`,
        );
      }
      return {
        ...resp,
        providerMeta: {
          providerId: adapter.providerId,
          model: request.model,
          latencyMs,
          ...(resp.providerMeta?.requestId ? { requestId: resp.providerMeta.requestId } : {}),
        },
      };
    } catch (err) {
      const latencyMs = Date.now() - startedAt;
      // 已是 ModelProviderError 直接透传
      if (err instanceof ModelProviderError) throw err;
      // 未知错误包装为 ModelProviderError(retryable=false)，由上层决定重试策略
      throw new ModelProviderError({
        providerId: adapter.providerId,
        code: "invoke_failed",
        message: err instanceof Error ? err.message : String(err),
        retryable: false,
        cause: err,
        httpStatus: undefined,
      });
    }
  }

  /**
   * 查询异步任务。
   * 按 providerId 显式路由（O(1)，由 register 时维护的 adaptersByProviderId 索引）。
   */
  async queryTask(
    taskId: string,
    providerId: string,
    signal?: AbortSignal,
  ): Promise<ImageTaskStatus> {
    const adapter = this.adaptersByProviderId.get(providerId);
    if (!adapter) {
      throw new ModelProviderError({
        providerId,
        code: "provider_not_found",
        message: `未找到 Provider "${providerId}"`,
        retryable: false,
      });
    }
    if (!adapter.queryTask) {
      throw new ModelProviderError({
        providerId,
        code: "query_not_supported",
        message: `Provider "${providerId}" 不支持异步任务查询`,
        retryable: false,
      });
    }
    return adapter.queryTask(taskId, signal);
  }
}

// =====================================================================
// 全局单例（与 §6 文档基线 §7.4 一致）
// =====================================================================

let globalRouter: ImageProviderRouter | null = null;

/** 获取全局图片路由单例（懒加载；registerBuiltin 调用前为空） */
export function getGlobalImageRouter(): ImageProviderRouter {
  if (!globalRouter) {
    globalRouter = new ImageProviderRouter();
  }
  return globalRouter;
}

/** 重置全局单例（仅用于测试） */
export function resetGlobalImageRouterForTests(): void {
  globalRouter = null;
}
