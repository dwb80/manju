/**
 * @file agnes-image-provider.ts
 * @description S1.2 Agnes 图片 Provider 适配器实现
 *
 * ## 角色
 * 实现 `image-provider.ts` 中 `ImageProviderAdapter` 接口，
 * 把 Agnes API 的 `generateImage` 包装成"厂商无关"的标准请求/响应。
 *
 * ## 设计原则
 * - **薄包装**：不重新实现图片生成逻辑，全部委托给 `RealAgnesClient.generateImage`。
 * - **参数翻译**：`ImageProviderRequest` → `ImageParams`（Agnes 入参类型），
 *   由本类完成；上层不感知 `ImageParams` 存在。
 * - **错误翻译**：Agnes `AgnesRateLimitError`（429）→ `ModelProviderError(retryable=true)`，
 *   其他错误 → `ModelProviderError(retryable=false)`。
 * - **能力上报**：与 `model-capabilities.ts` 中 `agnes-image-2.1-flash` 的参数约束保持一致。
 *
 * ## V1.x → V2.x 演进
 * - V1.x：工厂 UI 通过 `routedClient.generateImage(ImageParams)` 调用，本类**仅作为包装**。
 * - V2.x：V2 Router 接管所有 image 调用，工厂 UI 通过 `ImageProviderRouter` 路由。
 * - V3.x：接 Jimeng / Flux 等其他 Provider，本类扩展为 `AgnesAdapter` 实现多 Provider 路由。
 *
 * ## 文档基线
 * - 冻结于 `docs/ai-image-config.md §6.4`（V1.1）
 * - 工厂侧使用约束：`docs/factories-assets-and-image-views.md §13`
 */

import { RealAgnesClient, AgnesRateLimitError, isAgnesRateLimitError } from "./agnes-client.js";
import type { ImageParams } from "../types.js";
import {
  type ImageProviderAdapter,
  type ImageProviderRequest,
  type ImageProviderResponse,
  type ImageProviderCapabilities,
  ModelProviderError,
} from "./image-provider.js";
import { getGlobalImageRouter } from "./image-provider.js";
import { ALL_RATIOS } from "./image-config.js";
import { rootLogger } from "../logger.js";

// =====================================================================
// Agnes 能力声明
// =====================================================================

/**
 * Agnes 图片能力。
 * 与 `model-capabilities.ts` 中 `agnes-image-2.1-flash.image` 参数约束保持一致。
 *
 * 字段说明（与 `ai-image-config.md §6.2` 冻结）：
 * - text2Image: ✅ 文生图
 * - image2Image: ✅ 图生图（接收 referenceImages）
 * - negativePrompt: ✅ 支持负面提示词
 * - seed: ✅ 支持 seed 复现
 * - batchSupported: ✅ n>1 通过并发循环实现（RealAgnesClient.generateImage 已实现）
 * - supportedRatios: 5 个比例全部支持
 * - asyncTask: ❌ 同步（POST 后直接返回 URL，不需 queryTask）
 * - maxN: 4（与 RealAgnesClient.generateImage 中 `Math.min(4, params.n)` 一致）
 */
const AGNES_CAPABILITIES: ImageProviderCapabilities = {
  text2Image: true,
  image2Image: true,
  negativePrompt: true,
  seed: true,
  batchSupported: true,
  supportedRatios: ALL_RATIOS,
  asyncTask: false,
  maxN: 4,
};

/** Provider 唯一 ID（与 `model-capabilities.ts` 中 `ModelProvider = "agnes"` 对齐） */
const AGNES_PROVIDER_ID = "agnes";

/** Agnes 全部支持 model ID（与 MODEL_CATALOG 中 provider=agnes + capabilities 含 image 的项同步） */
const AGNES_SUPPORTED_MODELS: readonly string[] = ["agnes-image-2.1-flash"];

// =====================================================================
// AgnesImageProvider
// =====================================================================

/**
 * Agnes 图片 Provider 适配器。
 *
 * 用法：
 * ```ts
 * const router = getGlobalImageRouter();
 * router.register(new AgnesImageProvider());
 * ```
 *
 * 多个实例并存无副作用（RealAgnesClient 内部只读 env，无可变状态），
 * 但推荐单例（router.register 只调用一次）。
 */
export class AgnesImageProvider implements ImageProviderAdapter {
  readonly providerId: string = AGNES_PROVIDER_ID;
  readonly supportedModels: readonly string[] = AGNES_SUPPORTED_MODELS;
  readonly capabilities: ImageProviderCapabilities = AGNES_CAPABILITIES;

  private readonly client: RealAgnesClient;

  /**
   * @param envOrClient 可选：env（构造新 RealAgnesClient）或已构造好的 RealAgnesClient。
   *   - 不传 → 走 `process.env` 默认
   *   - 传 `NodeJS.ProcessEnv` → 内部 new RealAgnesClient(env)
   *   - 传 `RealAgnesClient` → 复用已有实例（推荐，避免重复构造）
   */
  constructor(envOrClient?: NodeJS.ProcessEnv | RealAgnesClient) {
    if (envOrClient instanceof RealAgnesClient) {
      this.client = envOrClient;
    } else {
      this.client = new RealAgnesClient(envOrClient);
    }
  }

  // -----------------------------------------------------------------
  // Adapter 接口实现
  // -----------------------------------------------------------------

  async generateImage(
    request: ImageProviderRequest,
    signal?: AbortSignal,
  ): Promise<ImageProviderResponse> {
    // 1) 参数翻译：ImageProviderRequest → ImageParams
    const agnesParams = this.toAgnesParams(request);

    // 2) 调用底层 client，捕获错误并翻译
    try {
      const result = await this.client.generateImage(agnesParams, signal);
      if (rootLogger.isLevelEnabled("debug")) {
        rootLogger.debug(
          {
            event: "image.provider.agnes.success",
            model: request.model,
            count: result.imageUrls.length,
            hasReference: Boolean(request.referenceImages?.length),
            ratio: request.ratio,
            size: request.size,
            requestId: result.requestId,
          },
          `Agnes 图片生成成功：model=${request.model} 数量=${result.imageUrls.length} requestId=${result.requestId ?? "(未返回)"}`,
        );
      }
      // S3.2：透传 SDK requestId（Agnes 响应头 X-Request-Id）到 providerMeta。
      // 缺失时为 undefined，调用方容错处理。
      return {
        imageUrls: result.imageUrls,
        providerMeta: {
          providerId: this.providerId,
          model: request.model,
          ...(result.requestId ? { requestId: result.requestId } : {}),
        },
      };
    } catch (err) {
      throw this.translateError(err);
    }
  }

  // -----------------------------------------------------------------
  // 内部工具
  // -----------------------------------------------------------------

  /**
   * ImageProviderRequest → ImageParams（Agnes 私有入参）。
   * 字段映射：
   * - model → model（直接透传）
   * - prompt → prompt
   * - negative_prompt → negative_prompt
   * - referenceImages → images（数组；Agnes 期望 string[]）
   * - ratio → ratio
   * - size → size
   * - n → n
   * - seed → seed
   * - responseFormat ("url" | "b64_json") → response_format
   * - providerExtras 中的 `steps` / `cfg` 透传为顶层字段（Agnes API 支持）
   */
  private toAgnesParams(request: ImageProviderRequest): ImageParams {
    const extras = (request.providerExtras ?? {}) as { steps?: number; cfg?: number };
    const params: ImageParams = {
      model: request.model as ImageParams["model"],
      prompt: request.prompt,
      ratio: request.ratio,
      size: request.size as ImageParams["size"],
      n: request.n,
      response_format: request.responseFormat,
    };
    if (request.negative_prompt) params.negative_prompt = request.negative_prompt;
    if (request.referenceImages && request.referenceImages.length > 0) {
      params.images = [...request.referenceImages];
    }
    if (typeof request.seed === "number") params.seed = request.seed;
    if (typeof extras.steps === "number") params.steps = extras.steps;
    if (typeof extras.cfg === "number") params.cfg = extras.cfg;
    return params;
  }

  /**
   * Agnes 错误 → ModelProviderError。
   * 限流（429）→ retryable=true；其他 → retryable=false。
   * 上层（Router / domain service）据此决定重试 / 降级策略。
   */
  private translateError(err: unknown): ModelProviderError {
    // AgnesRateLimitError（429 / 配额用尽）→ retryable=true
    if (isAgnesRateLimitError(err)) {
      const rateErr = err instanceof AgnesRateLimitError
        ? err
        : null;
      return new ModelProviderError({
        providerId: this.providerId,
        code: "rate_limited",
        message: err instanceof Error ? err.message : String(err),
        retryable: true,
        httpStatus: rateErr?.status ?? 429,
        cause: err,
      });
    }

    // 其他错误 → retryable=false
    return new ModelProviderError({
      providerId: this.providerId,
      code: "invoke_failed",
      message: err instanceof Error ? err.message : String(err),
      retryable: false,
      cause: err,
    });
  }
}

// =====================================================================
// 工厂：注册到全局 router
// =====================================================================

/**
 * 把 AgnesImageProvider 注册到全局 router（幂等）。
 * 重复调用安全（router.register 内部有重复检测 + 日志告警）。
 *
 * 用法：服务启动时（如 `services/bootstrap.ts` 或 `http/server.ts` 启动钩子）调用一次。
 */
export function registerAgnesImageProvider(
  envOrClient?: NodeJS.ProcessEnv | RealAgnesClient,
): AgnesImageProvider {
  const provider = new AgnesImageProvider(envOrClient);
  getGlobalImageRouter().register(provider);
  return provider;
}
