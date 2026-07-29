# AI 图片生成参数 — 单一真相源

> **所属上下文**：[AI 任务调度 §3.5](../../domain/contexts/05-ai-task-orchestration.md)

> **作用域**: 前端所有"AI 生图"调用（角色工厂 / 场景工厂 / 道具工厂 / 角色编辑页 / 后续分镜生图）
> **配套代码**:
> - 前端：`frontend/lib/image-config.ts`（待建）
> - 后端：`backend/src/ai/image-config.ts` / `backend/src/ai/image-provider.ts` / `backend/src/ai/agnes-image-provider.ts` / `backend/src/ai/ai-client-factory.ts`
> **权威源**: 本文档是后端 `/api/images/generate`、前端所有生图调用、`images.txt` 文档规范的**唯一真相源**。任一处不一致，先改本文档再改代码。

---

## 0. 为什么需要这个文档

历史问题：

- 前端 `ai-generate-dialog.tsx` 没传 `model`
- 前端写死 `size: "1024x1024"`（文档示例是 1024x768）
- 前端把 `response_format` 放在请求体顶层（文档要求放 `extra_body`）

本文档把 **AI 生图参数** 的所有真相集中到 `image-config.ts`，前端 3 个工厂 + 1 个编辑页全部引用同一份代码，根除"参数漂移"。

---

## 1. 接口来源

后端 `/api/images/generate` 转发到 Agnes Image 2.1 Flash（按 `images.txt`）。请求体规范（节选）：

```jsonc
{
  "model": "agnes-image-2.1-flash",   // 必填
  "prompt": "古风少年...",              // 必填
  "size": "1024x768",                  // 必填
  "image": ["/media/uploads/ref.png"], // 图生图必填
  "return_base64": false,              // 文生图 Base64 输出（替代 url）
  "extra_body": {
    "response_format": "url"           // 文档强制：必须放 extra_body 内
  }
}
```

---

## 2. `image-config.ts` 完整内容

```ts
/**
 * 单一真相源：AI 生图所有参数
 * 修改前必须先更新 docs/requirements/modules/05-ai-image-config.md
 */

// ============ 基础常量 ============

export const DEFAULT_IMAGE_MODEL = "agnes-image-2.1-flash";
export const DEFAULT_RESPONSE_FORMAT = "url" as const;
export const DEFAULT_N = 4;  // 默认候选图 4 张
export const MAX_N = 4;
export const MIN_N = 1;

// ============ 比例枚举 ============

export const SUPPORTED_RATIOS = [
  "9:16",   // 竖屏（角色）
  "16:9",   // 横屏（环境）
  "1:1",    // 方形（道具）
  "4:3",    // 横向 4:3
  "3:4",    // 竖向 3:4
  "2:3",    // 竖向 2:3
  "3:2",    // 横向 3:2
] as const;

export type SupportedRatio = typeof SUPPORTED_RATIOS[number];

// ============ 实体默认比例 / 尺寸 ============

/** 不同工厂实体的默认生图比例 */
export const ENTITY_DEFAULT_RATIO: Record<EntityTypeForImages, SupportedRatio> = {
  character: "9:16",
  scene:     "16:9",
  prop:      "1:1",
};

/** 不同比例对应的 size 字符串（与后端约定） */
export const RATIO_TO_SIZE: Record<SupportedRatio, string> = {
  "9:16":  "768x1152",
  "16:9":  "1280x720",
  "1:1":   "1024x1024",
  "4:3":   "1024x768",
  "3:4":   "768x1024",
  "2:3":   "768x1152",  // 与 9:16 复用后端模板
  "3:2":   "1280x832",
};

/** 不同工厂实体的默认 size（与 ratio 联动） */
export const ENTITY_DEFAULT_SIZE: Record<EntityTypeForImages, string> = {
  character: RATIO_TO_SIZE[ENTITY_DEFAULT_RATIO.character],  // 768x1152
  scene:     RATIO_TO_SIZE[ENTITY_DEFAULT_RATIO.scene],      // 1280x720
  prop:      RATIO_TO_SIZE[ENTITY_DEFAULT_RATIO.prop],       // 1024x1024
};

// ============ 风格枚举（仅文生图） ============

export const STYLE_OPTIONS = [
  { value: "",        label: "默认" },
  { value: "写实",     label: "写实" },
  { value: "动漫",     label: "动漫" },
  { value: "古风",     label: "古风" },
  { value: "科幻",     label: "科幻" },
  { value: "二次元",   label: "二次元" },
] as const;

export type StyleValue = typeof STYLE_OPTIONS[number]["value"];

// ============ 类型 ============

export type EntityTypeForImages = "character" | "scene" | "prop";

export type GenerateMode = "text2image" | "image2image";

/** 基础请求体（文生图 / 图生图共用） */
export interface BaseGenerateRequest {
  model: typeof DEFAULT_IMAGE_MODEL;
  prompt: string;
  size: string;
  ratio: SupportedRatio;
  n: number;
  extra_body: { response_format: typeof DEFAULT_RESPONSE_FORMAT };
}

/** 文生图请求体 */
export interface Text2ImageRequest extends BaseGenerateRequest {
  // image 字段不传
  // referenceImageUrl 不传
  style?: StyleValue;
  negative_prompt?: string;
  seed?: number;
}

/** 图生图请求体 */
export interface Image2ImageRequest extends BaseGenerateRequest {
  image: string[];  // 参考图 URL 数组
  strength: number; // 0~1, 默认 0.6
  negative_prompt?: string;
  seed?: number;
}

export type GenerateImageRequest = Text2ImageRequest | Image2ImageRequest;

// ============ 构造请求体的工厂函数（推荐使用） ============

export function buildText2ImageRequest(input: {
  entity: EntityTypeForImages;
  prompt: string;
  ratio?: SupportedRatio;
  n?: number;
  style?: StyleValue;
  negative_prompt?: string;
  seed?: number;
}): Text2ImageRequest {
  const ratio = input.ratio ?? ENTITY_DEFAULT_RATIO[input.entity];
  return {
    model: DEFAULT_IMAGE_MODEL,
    prompt: input.prompt,
    size: RATIO_TO_SIZE[ratio],
    ratio,
    n: input.n ?? DEFAULT_N,
    extra_body: { response_format: DEFAULT_RESPONSE_FORMAT },
    style: input.style,
    negative_prompt: input.negative_prompt,
    seed: input.seed,
  };
}

export function buildImage2ImageRequest(input: {
  entity: EntityTypeForImages;
  prompt: string;
  referenceImageUrl: string;
  strength?: number;
  ratio?: SupportedRatio;
  n?: number;
  negative_prompt?: string;
  seed?: number;
}): Image2ImageRequest {
  if (!input.referenceImageUrl) {
    throw new Error("[image-config] referenceImageUrl is required for image2image");
  }
  const ratio = input.ratio ?? ENTITY_DEFAULT_RATIO[input.entity];
  return {
    model: DEFAULT_IMAGE_MODEL,
    prompt: input.prompt,
    size: RATIO_TO_SIZE[ratio],
    ratio,
    n: input.n ?? DEFAULT_N,
    extra_body: { response_format: DEFAULT_RESPONSE_FORMAT },
    image: [input.referenceImageUrl],
    strength: input.strength ?? 0.6,
    negative_prompt: input.negative_prompt,
    seed: input.seed,
  };
}

// ============ 校验 ============

export function validateRatio(ratio: string): ratio is SupportedRatio {
  return (SUPPORTED_RATIOS as readonly string[]).includes(ratio);
}

export function validateN(n: number): boolean {
  return Number.isInteger(n) && n >= MIN_N && n <= MAX_N;
}
```

---

## 3. 调用规范

### 3.1 前端调用示例

```ts
// ✅ 正确：用工厂函数构造
import { buildText2ImageRequest, buildImage2ImageRequest } from "@/lib/image-config";

// 角色文生图
const req1 = buildText2ImageRequest({
  entity: "character",
  prompt: "古风少年剑客，黑发高马尾，身披白袍",
  style: "古风",
});
//  → { model: "agnes-image-2.1-flash", prompt, size: "768x1152", ratio: "9:16", n: 4, extra_body: { response_format: "url" }, style: "古风" }

const req2 = buildImage2ImageRequest({
  entity: "scene",
  prompt: "雨夜长街，霓虹灯",
  referenceImageUrl: "https://cdn.../reference.png",
  strength: 0.7,
});
//  → { ..., image: ["https://..."], strength: 0.7, size: "1280x720", ratio: "16:9" }

const task = await api<ImageTask>("/api/images/generate", {
  method: "POST",
  body: JSON.stringify(req1),
});
```

```ts
// ❌ 错误：手写请求体
const bad = {
  prompt: "...",
  n: 4,
  size: "1024x1024",  // 写死
  response_format: "url",  // 顶层（应在 extra_body）
  // 缺 model
};
```

### 3.2 禁止事项

- 禁止在调用方手写 `model` / `size` / `ratio` / `extra_body` 字面量
- 禁止在 `n` 上做魔法数字（用 `DEFAULT_N` / `MAX_N` / `MIN_N`）
- 禁止在文生图请求里传 `image` 字段
- 禁止在图生图请求里省略 `image` 字段
- 禁止把 `response_format` 放在 `extra_body` 之外

### 3.3 后端联动

后端 `/api/images/generate` 的转发逻辑（`backend/src/ai/ai-client-factory.ts`）**应**：

- 接收 `extra_body.response_format` 字段
- 不再从顶层 `response_format` 读取（避免双路径）
- 缺失 `extra_body.response_format` 时 fallback 为 `"url"` 并打 debug 日志

---

## 4. 默认值与展示规则

| 实体 | ratio 默认 | size 默认 | n 默认 | 适用场景 |
|---|---|---|---|---|
| character | 9:16 | 768x1152 | 4 | 角色竖屏，4 张候选便于选表情 / 动作 |
| scene | 16:9 | 1280x720 | 4 | 环境横屏 |
| prop | 1:1 | 1024x1024 | 4 | 道具方形，便于多角度对比 |

**单一角色编辑页**（`/characters/[id]/edit`）特殊：固定 9:16 + size 768x1152（与 `image-config.ts` 对齐，删除硬编码）。

---

## 6. 多模型适配器契约

> 本节定义"图片生成 Provider"的标准接口。任何接入新厂商（Flux / SDXL / 即梦 / DALL-E / Midjourney 等）必须实现本接口，不允许在调用方写厂商特定代码。

### 6.1 现状

| 能力 | Provider 数量 | 路由方式 |
|---|---|---|
| 对话会话 | **4**（Agnes / 智谱 / Cerebras / 商汤） | ✅ `RoutedAIClient.pickClient` 按 model 前缀分发 |
| **图片** | **1**（仅 Agnes） | ❌ `ai-client-factory.ts:314-319` 写死 `this.agnes.generateImage` |
| 视频 | 1（仅 Agnes） | ❌ 同上 |
| TTS | 1 实现（Edge），1 抛错（Agnes） | ✅ 类型化 provider |

**问题**：`backend/src/types/image.ts:11` 把 `ImageModel` 写死为 `"agnes-image-2.1-flash"` —— 这是**反抽象**。一旦接入即梦 / Flux / SDXL，`ImageParams.model` 就放不下。

### 6.2 图片 Provider 抽象接口（标准契约）

```ts
/**
 * 图片 Provider 适配器接口
 *
 * 任何图片生成后端（Agnes / 即梦 / Flux / SDXL / DALL-E 等）必须实现本接口，
 * 业务代码（AI 对话框、image-history、AssetImage）只与本接口交互，禁止写厂商特定代码。
 */
export interface ImageProviderAdapter {
  /** Provider 唯一 ID（用于日志 / 路由 / 计费） */
  readonly providerId: string;
  /** 支持的模型 ID 列表，用于 model 下拉与能力探测 */
  readonly supportedModels: readonly string[];
  /** Provider 能力标签（用于 UI 智能模式推荐） */
  readonly capabilities: ImageProviderCapabilities;

  /**
   * 生成图片
   * @param request 标准请求（ImageProviderRequest）
   * @param signal 中止信号
   * @returns 标准响应（图片 URL 列表 + Provider 元信息）
   */
  generateImage(
    request: ImageProviderRequest,
    signal?: AbortSignal,
  ): Promise<ImageProviderResponse>;

  /**
   * 查询异步任务（部分 Provider 是异步；同步 Provider 返回 success）
   * 可选实现：同步 Provider 可不实现，框架会立即返回 success。
   */
  queryTask?(taskId: string, signal?: AbortSignal): Promise<ImageTaskStatus>;
}

/** Provider 能力标签 */
export interface ImageProviderCapabilities {
  /** 是否支持图生图（image2image） */
  text2Image: boolean;
  image2Image: boolean;
  /** 是否支持负面 Prompt */
  negativePrompt: boolean;
  /** 是否支持 seed 复现 */
  seed: boolean;
  /** 是否支持批量（n>1）；不支持的 Provider 内部并发循环 */
  batchSupported: boolean;
  /** 支持的比例列表（"9:16" / "16:9" / "1:1" / ...） */
  supportedRatios: readonly string[];
  /** 是否支持异步（需 queryTask） */
  asyncTask: boolean;
  /** 最大并发候选数（同步 Provider 通常 4，异步 Provider 通常 1） */
  maxN: number;
}

/** Provider 标准请求（与厂商无关） */
export interface ImageProviderRequest {
  /** Provider 必须支持的模型 ID（来自 supportedModels） */
  model: string;
  prompt: string;
  negative_prompt?: string;
  /** 图生图参考图（多张） */
  referenceImages?: string[];
  /** 比例（已在 image-config.ts 校验为 SupportedRatio） */
  ratio: SupportedRatio;
  /** 尺寸（已在 image-config.ts 与 ratio 联动） */
  size: string;
  /** 候选数（1-4） */
  n: number;
  seed?: number;
  /** 是否返回 b64_json（默认 url） */
  responseFormat: "url" | "b64_json";
  /** Provider 私有扩展（透传给具体实现） */
  providerExtras?: Record<string, unknown>;
}

/** Provider 标准响应（统一封装） */
export interface ImageProviderResponse {
  /** 图片 URL 列表（失败时为空数组，由 Provider 抛错） */
  imageUrls: string[];
  /** 异步任务 ID（异步 Provider 必填；同步 Provider 留空） */
  taskId?: string;
  /**
   * 透传的 Provider 元信息（用于日志 / 排查）。整体为 optional：
   *  - `requestId`：**强烈建议填**（best-effort）—— 用于排障时与厂商对账。
   *    Agnes 走 `X-Request-Id` 响应头提取；接新 Provider 时
   *    由各自实现从自家响应头提取。缺失时**省略**（不要塞空串），调用方拿到
   *    `undefined` 时**不得报错**。
   *  - `latencyMs`：由 Router 在包装阶段填，Provider 实现可不填。
   *    填了也会被 Router 在包装层**覆盖**为本次 invoke 真实耗时（`Date.now()-startedAt`）。
   */
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
```

### 6.3 路由层

> 实际代码（`backend/src/ai/image-provider.ts`）。

```ts
/**
 * ImageProviderRouter — 图片 Provider 路由器
 *
 * 索引策略：
 * - `adapters`: model ID → Adapter（O(1) 路由）
 * - `adaptersByProviderId`: providerId → Adapter（O(1) 异步任务查询）
 * - `aggregatedCapabilities`: 缓存，register 时失效
 */
export class ImageProviderRouter {
  private readonly adapters: Map<string, ImageProviderAdapter> = new Map();
  private readonly adaptersByProviderId: Map<string, ImageProviderAdapter> = new Map();
  private aggregatedCapabilities: ImageProviderCapabilities | null = null;

  /** 注册一个 Provider（幂等；model 表重复会 warn，providerId 重复保留先注册者） */
  register(adapter: ImageProviderAdapter): void {
    for (const model of adapter.supportedModels) {
      // 重复 model：warn 并覆盖（保持原行为）
      if (this.adapters.has(model)) {
        const existing = this.adapters.get(model)!;
        rootLogger.warn(
          { event: "image.router.duplicate_model", model, existingProvider: existing.providerId, newProvider: adapter.providerId },
          `模型 "${model}" 已被 "${existing.providerId}" 注册，将被 "${adapter.providerId}" 覆盖`,
        );
      }
      this.adapters.set(model, adapter);
    }
    // 重复 providerId：保留先注册者（避免 queryTask 路由跳变）
    if (!this.adaptersByProviderId.has(adapter.providerId)) {
      this.adaptersByProviderId.set(adapter.providerId, adapter);
    }
    this.aggregatedCapabilities = null; // 失效聚合缓存
  }

  /** 获取所有支持的 model ID */
  getSupportedModels(): readonly string[] {
    return [...this.adapters.keys()];
  }

  /** 聚合能力（batchSupported 走 AND，详见 JSDoc） */
  getAggregatedCapabilities(): ImageProviderCapabilities { /* ... */ }

  /**
   * 生成图片（路由入口）
   * 校验：referenceImages / negative_prompt / seed / ratio / n
   * 失败统一抛 ModelProviderError / ModelNotFoundError
   */
  async generateImage(request: ImageProviderRequest, signal?: AbortSignal): Promise<ImageProviderResponse> {
    const adapter = this.adapters.get(request.model);
    if (!adapter) throw new ModelNotFoundError("image", request.model);
    // ... 能力校验 ...
    return adapter.generateImage(request, signal);
  }

  /** 查询异步任务（O(1)，按 providerId 路由） */
  async queryTask(taskId: string, providerId: string, signal?: AbortSignal): Promise<ImageTaskStatus> {
    const adapter = this.adaptersByProviderId.get(providerId);
    if (!adapter) throw new ModelProviderError({ providerId, code: "provider_not_found", message: ..., retryable: false });
    if (!adapter.queryTask) throw new ModelProviderError({ providerId, code: "query_not_supported", ... });
    return adapter.queryTask(taskId, signal);
  }
}
```

**路由层关键约束**：

- 路由分发仅按 `request.model` 精确匹配；不模糊匹配。
- `register` 是幂等的：相同 model 重复注册会 warn 并**覆盖**（"已替换"）；相同 providerId 重复注册也 warn 并**同步覆盖** `adaptersByProviderId`（保持与 model 表一致，避免 queryTask 路由跳变）。
- `aggregatedCapabilities` 的 `batchSupported` 走 **AND 聚合**——只有所有 Provider 都支持批量才返回 true，避免 UI 误推荐。
- 错误统一为 `ModelProviderError`（含 providerId / code / retryable / httpStatus / cause），方便上层做差异化处理。

**错误处理契约**：

| 来源 | 行为 | 重试建议 |
|---|---|---|
| Provider 抛 `ModelProviderError` | 透传（不改 code / retryable） | 按 `err.retryable` 决定 |
| Provider 抛 `AgnesRateLimitError`（Agnes SDK 内部 429） | `AgnesImageProvider.translateError` 包装为 `ModelProviderError(code=rate_limited, retryable=true, httpStatus=429)` | 等待 `retryAfterSec` 后重试 |
| Provider 抛任意其他 `Error` | Router 包装为 `ModelProviderError(code=invoke_failed, retryable=false)`，cause 原样透传 | 不重试，向用户报错 |
| `signal.aborted === true`（用户主动 cancel） | Provider 抛 `DOMException("Aborted", "AbortError")`，Router catch 分支按"未知错误"处理，包装为 `ModelProviderError(code=invoke_failed, retryable=false, cause=DOMException)` | 用户主动取消，无需重试 |
| **超时（withTimeout 触发自动 abort）** | `withTimeout` 到点调用 `controller.abort()` → Provider 抛 `AbortError` → 但**外层抛 `TimeoutError`**（`utils.ts:100-109`，`operation="generateImage"`，默认 180s 可由 `AGNES_TIMEOUT_GENERATE_IMAGE_MS` 覆盖）→ `safeAICall` 包装为 `ai.call.timeout` warn 日志，向上抛 `TimeoutError`（**不是** `ModelProviderError`，与表中其他行不同） | 不重试，向用户提示"生图超时" |
| `model` 未注册 | Router 抛 `ModelNotFoundError`（继承 `ModelProviderError`, `code=model_not_found`） | 修正 model 后重试 |
| 能力校验失败（image2image / negative / seed / ratio / n 越界） | Router 抛 `ModelProviderError(code=capability_not_supported` / `ratio_not_supported` / `n_out_of_range`, `retryable=false)`** | 修正请求后重试 |
| **`size` 非法值** | **当前实现是 best-effort，不前置强校验**：`router.generateImage` 入口**不**调 `isValidSize()`，非法值直达 Provider API 由厂商返回 400；后续若改成前置校验，错误码建议 `size_invalid` / `capability_not_supported` | 当前由 Provider 端报错；可能加前置校验 |

### 6.4 功能矩阵

| Provider | Provider ID | 支持模型 | 状态 | 备注 |
|---|---|---|---|---|
| Agnes | `agnes` | `agnes-image-2.1-flash` | ✅ 支持 | `backend/src/ai/agnes-client.ts:297`（`RealAgnesClient.generateImage`） |
| 即梦 | `jimeng` | `jimeng-3.0` / `jimeng-2.1` | ❌ 未支持 | 待评估 API 协议 |
| Flux | `flux` | `flux-pro` / `flux-schnell` | ❌ 未支持 | OpenAI 兼容接口 |
| SDXL | `sdxl` | `sdxl-1.0` | ❌ 未支持 | StableDiffusion API |
| DALL-E | `dalle` | `dall-e-3` / `dall-e-2` | ❌ 未支持 | OpenAI 兼容接口 |
| Midjourney | `midjourney` | `midjourney-v6` | ❌ 未支持 | 需 Discord Bot，异步 |

**现状契约义务**：

- 在 `AgnesImageProvider` 实现 `ImageProviderAdapter` 接口（**S0 必修**）
- 在 `RoutedAIClient` 增加图片路由（按 model 前缀分发到 `AgnesImageProvider` 或未来的 `JimengImageProvider`）
- 在 `image.ts:11` 把 `type ImageModel = "agnes-image-2.1-flash"` 改为 `type ImageModel = string`（**仅作为内部 model 字符串，路由层做解析**）

### 6.5 前端 / 调用方约束

- 前端 `image-config.ts` 的 `DEFAULT_IMAGE_MODEL` 仍可保留 `"agnes-image-2.1-flash"`，但**应**让用户在"专家模式"下能从下拉选其他 model（数据来自后端 `/api/models?type=image`）
- 业务代码不直接 import 任何 `*ImageProvider` 实现类
- 后端 `/api/images/generate` 的内部实现改为：
  1. 接收标准 `GenerateImageRequest`（与厂商无关）
  2. 走 `ImageProviderRouter.generateImage()`
  3. 返回标准 `ImageProviderResponse`
- 错误信息透传：限流 / 配额 / 网络错误统一包装为 `ImageProviderError`（含 `providerId` / `retryable` 标志）

### 6.6 与"文档先于代码"原则的关系

- 本节是 `ImageProviderAdapter` 的**对外契约**，先冻结
- 各 Provider 的实现细节（headers、payload schema）写各自实现文件的 JSDoc，**不暴露**给调用方
- 调用方（业务代码）只引用 `ImageProviderRequest` / `ImageProviderResponse` 类型，**禁止**引用任何 `*ImageProvider` 实现类

### 6.7 反例（禁止）

```ts
// ❌ 反例 1：业务代码直接 import Agnes 实现
import { RealAgnesClient } from "@/ai/agnes-client";
await new RealAgnesClient(env).generateImage({ ... });

// ❌ 反例 2：把厂商特定字段写进通用类型
interface ImageParams {
  agnesExtraSteps?: number;  // Agnes 才有
  jimengStyleId?: string;    // 即梦才有
}

// ❌ 反例 3：把 model 写死为单一厂商
type ImageModel = "agnes-image-2.1-flash";  // ← 当前就是错的

// ❌ 反例 4：在 Router 里写厂商特定逻辑
if (model.startsWith("jimeng-")) {
  // ... 直接调即梦 SDK，跳过 adapter
}

// ❌ 反例 5：在跨模块回退路径里硬编码 model 字面量
const model = params.model ?? "agnes-image-2.1-flash";  // 未来切默认 model 时要改 N 处
// 正例：const model = params.model ?? DEFAULT_IMAGE_MODEL;

// ❌ 反例 6：吞掉厂商对账 ID
const result = await this.client.generateImage(...);
return { imageUrls: result.urls };  // 丢失 X-Request-Id，排障无法对账
// 正例：return { imageUrls: result.imageUrls, providerMeta: { ..., requestId: result.requestId } };

// ❌ 反例 7：在 router catch 分支忘了 `instanceof ModelProviderError` 判断 → 双重包装
} catch (err) {
  throw new ModelProviderError({ ...err });  // err 本身可能就是 ModelProviderError，导致嵌套
}
// 正例：
} catch (err) {
  if (err instanceof ModelProviderError) throw err;  // 透传
  throw new ModelProviderError({ code: "invoke_failed", ... });
}

// ❌ 反例 8：把 `AgnesRateLimitError` 直接抛给上层，绕过 Router 错误翻译
throw err;  // 业务方拿到的是 Agnes SDK 内部错误类，无法做"统一重试"判断
// 正例：在 Provider 实现类里 `translateError(err)` 包装为 `ModelProviderError(code=rate_limited, retryable=true)` 再抛

// ❌ 反例 9：把 `signal.aborted` 检查放在 router 入口而非 Provider 内部
async generateImage(request, signal) {
  if (signal?.aborted) throw new Error("aborted");  // router 还没路由就 cancel，metrics 错乱
  return this.provider.generateImage(request, signal);
}
// 正例：让 Provider 实现内部检查 signal.aborted，抛 DOMException("Aborted", "AbortError")，
//       router catch 统一按"未知错误"包装为 invoke_failed
```

### 6.8 后续实施排期（建议）

- 抽 `ImageProviderAdapter` 接口 + `ImageProviderRouter` 框架
- 把 `RealAgnesClient.generateImage` 适配为 `AgnesImageProvider implements ImageProviderAdapter`
- 把 `RoutedAIClient.generateImage` 改为 `ImageProviderRouter.generateImage`（图片路由迁移）
- 单元测试（路由分派 + provider 替换）
- 后续每个新 Provider 增量约 +6h（实现 + 测试 + 文档）

---

## 7. 多类型模型统一架构（对话会话 / 图片 / 视频 / TTS）

> 用户原话："模型会有很多种，不同厂商的，不同类型的，有推理接口，有生图接口，这个咋弄？"
> 本节给出**统一的 Provider 抽象 + 能力探测 + 路由**架构，让所有模型类型走同一套模式。

### 7.1 架构核心：ModelKind + Provider + Adapter 三层

```
┌──────────────────────────────────────────────────────────────────┐
│  ModelKind（模型类型）             Provider（厂商）              │
│  ────────────                    ──────────────                 │
│  • chat（推理 / 文本生成）         • agnes                        │
│  • image（图片生成）               • zhipu                        │
│  • video（视频生成）               • cerebras                     │
│  • tts（语音合成）                 • sensenova                    │
│  • embedding（向量化）             • jimeng                       │
│  • asr（语音识别）                 • flux                         │
│                                   • sdxl                         │
│                                   • midjourney                   │
└──────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────┐
│  Adapter（厂商适配器）                                              │
│  ──────────────                                                     │
│  AgnesImageProvider、JimengImageProvider、FluxImageProvider、    │
│  ZhipuChatProvider、CerebrasChatProvider、MidjourneyVideoProvider│
│  等等                                                              │
│  全部 implements ModelAdapter<ModelKind, Request, Response>      │
└──────────────────────────────────────────────────────────────────┘
```

**关键抽象**：

1. **ModelKind** 区分"做什么"（chat / image / video / tts / embedding / asr）
2. **Provider** 区分"谁做"（agnes / zhipu / jimeng / flux ...）
3. **Adapter** 隔离"怎么调"（headers / payload schema / SSE / 异步轮询）

业务代码只需要"我要用 chat 模型做推理"或"我要用 image 模型生图"，不关心是谁家、什么协议。

### 7.2 通用 ModelAdapter 顶层接口

```ts
/**
 * 通用 Model Adapter 顶层接口
 * 所有 ModelKind（chat/image/video/tts/...）的具体 Adapter 都实现本接口
 */
export interface ModelAdapter<TKind extends ModelKind, TRequest, TResponse> {
  /** Provider 唯一 ID（"agnes" / "zhipu" / "jimeng" / "flux" 等） */
  readonly providerId: string;
  /** 适配的 ModelKind（"chat" / "image" / "video" / ...） */
  readonly kind: TKind;
  /** Provider 支持的所有 model ID 列表 */
  readonly supportedModels: readonly string[];
  /** 能力标签（用于 UI 智能模式推荐 + 路由策略） */
  readonly capabilities: ModelCapabilities;

  /** 执行调用（chat 流式 / image 同步 / video 异步 都通过本方法） */
  invoke(request: TRequest, signal?: AbortSignal): Promise<TResponse> | AsyncIterable<TResponse>;

  /** 异步任务查询（video / 异步 image 用） */
  queryTask?(taskId: string, signal?: AbortSignal): Promise<TaskStatus>;
}

/** 通用能力标签 */
export interface ModelCapabilities {
  /** 是否流式响应（chat 多数 true，image 多数 false） */
  streaming: boolean;
  /** 是否支持 system prompt / 负向提示 / 上下文参数等 */
  negativePrompt?: boolean;
  /** 是否支持 seed 复现 */
  seed?: boolean;
  /** 是否支持图生图（image 用） */
  image2Image?: boolean;
  /** 是否支持关键帧模式（video/image 用） */
  keyframe?: boolean;
  /** 是否支持异步（需 queryTask） */
  async?: boolean;
  /** 最大并发候选数（image 用） */
  maxN?: number;
  /** 支持的比例列表（image 用） */
  supportedRatios?: readonly string[];
  /** 支持的 thinking 模式（chat 用） */
  thinking?: boolean;
  /** 支持视觉理解（chat 用） */
  vision?: boolean;
  /** 支持工具调用（chat 用） */
  toolCalling?: boolean;
  /** 上下文窗口大小（chat 用） */
  contextWindow?: number;
}

/** ModelKind 枚举 */
export type ModelKind = "chat" | "image" | "video" | "tts" | "embedding" | "asr";
```

### 7.3 每种 ModelKind 的子接口

```ts
// ============ 对话会话 Adapter ============
export interface ChatModelAdapter extends ModelAdapter<"chat", ChatParams, ChatChunk> {
  invoke(request: ChatParams, signal?: AbortSignal): AsyncIterable<ChatChunk>;
}

// ============ 图片 Adapter ============
export interface ImageModelAdapter extends ModelAdapter<"image", ImageProviderRequest, ImageProviderResponse> {
  invoke(request: ImageProviderRequest, signal?: AbortSignal): Promise<ImageProviderResponse>;
  queryTask?(taskId: string, signal?: AbortSignal): Promise<ImageTaskStatus>;
}

// ============ 视频 Adapter（异步，强烈建议 queryTask）========
export interface VideoModelAdapter extends ModelAdapter<"video", VideoParams, VideoTaskCreated> {
  invoke(request: VideoParams, signal?: AbortSignal): Promise<VideoTaskCreated>;
  queryTask(taskId: string, signal?: AbortSignal): Promise<VideoTaskStatus>;
}

// ============ TTS Adapter（同步）========
export interface TTSModelAdapter extends ModelAdapter<"tts", TTSParams, TTSResult> {
  invoke(request: TTSParams, signal?: AbortSignal): Promise<TTSResult>;
}
```

### 7.4 路由层（每种 ModelKind 一个 Router）

```ts
/**
 * 通用 Model Router
 * 每种 ModelKind 一个 router 实例（避免 chat 路由 image 的混乱）
 */
export class ModelRouter<TKind extends ModelKind, TRequest, TResponse> {
  private adapters: Map<string, ModelAdapter<TKind, TRequest, TResponse>> = new Map();

  constructor(public readonly kind: TKind) {}

  register(adapter: ModelAdapter<TKind, TRequest, TResponse>): void {
    for (const model of adapter.supportedModels) {
      this.adapters.set(model, adapter);
    }
  }

  async invoke(model: string, request: TRequest, signal?: AbortSignal): Promise<TResponse | AsyncIterable<TResponse>> {
    const adapter = this.adapters.get(model);
    if (!adapter) throw new ModelNotFoundError(this.kind, model);
    return adapter.invoke(request, signal);
  }
}

/** 全局 Router 注册中心（每 kind 一个） */
export class ModelRegistry {
  private static routers: Map<ModelKind, ModelRouter<any, any, any>> = new Map();

  static getRouter<TKind extends ModelKind>(kind: TKind): ModelRouter<TKind, any, any> {
    let router = this.routers.get(kind);
    if (!router) {
      router = new ModelRouter(kind);
      this.routers.set(kind, router);
    }
    return router;
  }

  /** 启动时注册所有内置 Provider（Agnes/Zhipu/...） */
  static registerBuiltin(): void {
    // chat
    this.getRouter("chat").register(new AgnesChatProvider());
    this.getRouter("chat").register(new ZhipuChatProvider());
    this.getRouter("chat").register(new CerebrasChatProvider());
    this.getRouter("chat").register(new SenseNovaChatProvider());
    // image
    this.getRouter("image").register(new AgnesImageProvider());
    // video / tts 同理
  }
}
```

### 7.5 各 ModelKind 的 Provider 实现矩阵

| ModelKind | Provider | Adapter | 状态 | 备注 |
|---|---|---|---|---|
| **chat** | agnes | `AgnesChatProvider` | ✅ 已有 `RealAgnesClient.chat` | 需包一层 |
| chat | zhipu | `ZhipuChatProvider` | ✅ 已有 `ZhipuClient` | 需包一层 |
| chat | cerebras | `CerebrasChatProvider` | ✅ 已有 `CerebrasClient` | 需包一层 |
| chat | sensenova | `SenseNovaChatProvider` | ✅ 已有 `SenseNovaClient` | 需包一层 |
| **image** | agnes | `AgnesImageProvider` | ✅ 已有 `RealAgnesClient.generateImage` | 需适配 |
| image | jimeng | `JimengImageProvider` | ❌ 未支持 | 即梦 API 协议待评估 |
| image | flux | `FluxImageProvider` | ❌ 未支持 | OpenAI 兼容 |
| image | sdxl | `SdxlImageProvider` | ❌ 未支持 | StableDiffusion API |
| image | dalle | `DalleImageProvider` | ❌ 未支持 | OpenAI 兼容 |
| image | midjourney | `MidjourneyImageProvider` | ❌ 未支持 | Discord Bot，异步 |
| **video** | agnes | `AgnesVideoProvider` | ✅ 已有 | 需包一层 |
| video | kling | `KlingVideoProvider` | ❌ 未支持 | 可灵 API |
| video | jimeng | `JimengVideoProvider` | ❌ 未支持 | 即梦视频 |
| **tts** | edge | `EdgeTTSProvider` | ✅ 已有 | 需包一层 |
| tts | agnes | `AgnesTTSProvider` | ❌ Agnes 暂不支持 | 已抛错占位 |
| **embedding / asr** | 待评估 | — | ❌ | 未来按需 |

### 7.6 业务侧使用方式（统一模式）

```ts
// 业务代码不直接 import 任何 *Provider 类，只与 ModelRegistry / Router 交互
import { ModelRegistry } from "@/ai/model-registry";

const req: ChatParams = {
  model: "glm-4.6",
  message: "写一段古风少年剑客的描述",
  temperature: 0.7,
};

// 1. 推理（chat 永远返回 AsyncIterable，统一 stream 接口）
for await (const chunk of await ModelRegistry.getRouter("chat").invoke(req.model, req, signal)) {
  process.stdout.write(chunk.content);
}

// 2. 生图（image 同步返回）
const resp = await ModelRegistry.getRouter("image").invoke("jimeng-3.0", {
  model: "jimeng-3.0",
  prompt: "古风少年剑客",
  ratio: "9:16",
  size: "768x1152",
  n: 1,
  responseFormat: "url",
}, signal);
console.log(resp.imageUrls);

// 3. 视频（异步，返回 taskId 后轮询）
const { taskId } = await ModelRegistry.getRouter("video").invoke("kling-v1", req, signal);
const status = await ModelRegistry.getRouter("video").queryTask!(taskId, signal);
```

### 7.7 演进策略

**当前阶段**：

- chat 已有 4 个 provider，路由层在 `RoutedAIClient.pickClient`，能跑
- image / video / tts 还是单 provider，**先用本契约把"image 路由层"先抽出来**
- 工厂前端**保持不变**，先用 Agnes 跑通三厂多视图功能

**中期**：

- 把 chat 也迁到 `ModelRegistry` 架构（4 个 provider 已就绪，路由层换皮即可，4h）
- 接 Jimeng / Flux 第二个 image provider（6h + 6h）
- 工厂前端接入"模型下拉" UI（2h）

**长期**：

- 每个 ModelKind 都可插拔
- 管理员可在模型中心加新 provider（DB 存 + 启动时 register）
- 自动能力探测 + 智能路由（"用户要图生图 → 自动选支持 i2i 的 provider"）

### 7.8 关键决策

1. **不破坏现有 chat 路由**：chat 4 个 provider 先用 `RoutedAIClient.pickClient`，待 image 适配层落地后再统一迁到 `ModelRegistry`
2. **image 优先**：本轮先把 image 路由层抽出来（最痛的点），chat 等下一轮
3. **业务代码零改动**：`ModelRegistry.getRouter("image").invoke(...)` 与现在的 `RoutedAIClient.generateImage(...)` 调用点几乎一致，只需改 import 和方法名
4. **错误透传**：所有 adapter 把"限流/配额/网络"统一包装为 `ModelProviderError`，含 `providerId` + `retryable` 标志

---

## 8. 验收清单

### 8.1 文档基线

- [x] §6.1 现状盘点（chat 4 / image 1 / video 1 / tts 1）
- [x] §6.2 `ImageProviderAdapter` 标准接口冻结
- [x] §6.3 `ImageProviderRouter` 路由层冻结
- [x] §6.4 Provider 实现矩阵（5 个待接入）
- [x] §6.5 调用方约束（不 import 实现类）
- [x] §6.6 文档先于代码原则
- [x] §6.7 反例清单
- [x] §6.8 实施排期
- [x] §7.1-§7.4 多类型 ModelKind 通用架构
- [x] §7.5 各 ModelKind Provider 实现矩阵
- [x] §7.6 业务侧统一调用方式
- [x] §7.7 演进策略
- [x] §7.8 关键决策
- [x] 配套文档：`04-factories-assets-and-image-views.md §12.5/§12.6/§13` 已冻结
- [x] §6.2 `ImageProviderResponse.providerMeta` 增 `requestId` 字段
- [x] §6.3 Router 错误处理契约补 `invoke_failed` 包装 + `rate_limited` 翻译
- [x] §6.7 反例清单增补 "错误包装" 注意点
- [x] `04-factories-assets-and-image-views.md §13.2` 增"size 不字面量"提醒

### 8.2 实施清单

#### 新建 `backend/src/ai/image-provider.ts`

- [x] 定义 `ImageProviderCapabilities` / `ImageProviderRequest` / `ImageProviderResponse` / `ImageTaskStatus`（与 §6.2 一致）
- [x] 定义 `ImageProviderAdapter` 接口
- [x] 实现 `ImageProviderRouter` 类（按 model 路由 + capabilities 聚合）
- [x] 实现 `ModelProviderError`（含 `providerId` + `retryable` + `code`）
- [x] 单元测试：`image-provider-s1.test.mjs` (25) 覆盖：路由分派 / 能力聚合 / 错误透传

#### 新建 `backend/src/ai/agnes-image-provider.ts`

- [x] `AgnesImageProvider implements ImageProviderAdapter`
- [x] `providerId = "agnes"`
- [x] `supportedModels = ["agnes-image-2.1-flash"]`
- [x] `capabilities` 完整声明（image2Image=true, batchSupported=true, maxN=4, supportedRatios 全 5 种, async=false, seed=true, negativePrompt=true）
- [x] `generateImage` 内部委托给 `RealAgnesClient.generateImage`（**不改 RealAgnesClient**，只是包一层）
- [x] 错误转换：把 `AgnesRateLimitError` 包成 `ModelProviderError(retryable=true)`
- [x] 单元测试：`image-provider-s3.test.mjs` (15) 覆盖：能力声明 / 委托调用 / 错误转换

#### 改 `backend/src/ai/ai-client-factory.ts`

- [x] `RoutedAIClient.generateImage` 改为走 `ImageProviderRouter.generateImage`
- [x] 顶层 `requestId` 从 `providerMeta.requestId` 提升
- [x] `toImageProviderRequest` 把 ImageParams 缺省字段填上 image-config 默认值（DEFAULT_IMAGE_MODEL / DEFAULT_RATIO / recommendedSizeForRatio / DEFAULT_N / responseFormat=url）
- [x] **不影响 chat 路由**（`pickClient` 保持原样）
- [x] 单测回归：`image-provider-s1.test.mjs` 现有 chat 用例全过

#### 改 `backend/src/types/image.ts`

- [x] `type ImageModel = "agnes-image-2.1-flash"` → `type ImageModel = string & {}`（保留 `& {}` 收紧位以保留 TS 提示，同时支持新 model）
- [x] `ImageParams.size` 从字面量联合改为 `string`（size 是"比例 × 档位"的乘积，不维护字面量）
- [x] 注释：`// ImageModel 不再硬编码；路由层 ImageProviderRouter 按 model 字符串分派`
- [x] 现有调用方零改动（`ImageParams.model?: ImageModel` 兼容）

#### 端到端验证

- [ ] 启动后端，手动 curl `POST /api/images/generate` 用 agnes-image-2.1-flash → 拿到 imageUrls
- [ ] 启动后端，手动 curl `POST /api/images/generate` 用 jimeng-3.0 → 拿到 `ModelNotFoundError`（符合预期，未来接 Jimeng 时填）
- [ ] `npm run test` 全过（chat / image / 工厂 E2E 全部不破）
- [ ] dist 编译通过（`npx tsc -p tsconfig.json`）

### 8.3 明确推迟项

- [ ] 工厂前端"模型下拉"接 `/api/models?type=image`
- [ ] 接 Jimeng / Flux / SDXL / DALL-E / Midjourney
- [ ] chat 路由迁 `ModelRegistry`
- [ ] video / tts / embedding / asr 适配器

### 8.4 同步决策

- [ ] `04-factories-assets-and-image-views.md` 按钮文案改"📚 资产库 / 🎨 风格锚定"
- [ ] `04-factories-assets-and-image-views.md` 工厂模块移除所有 lucide SVG 图标
- [ ] `04-factories-assets-and-image-views.md` 取消 40 张上限；改 `backend/src/services/asset-image.service.ts` 删裁剪逻辑
- [ ] `04-factories-assets-and-image-views.md` §12.6.5 A↔B 双向导通
