/**
 * @file image.ts
 * @description 图片生成相关类型定义，包括图片参数、图片任务等
 *
 * ## S1.4 说明
 * `ImageModel` 不再硬编码为单一值。
 * - 历史保留：`"agnes-image-2.1-flash"`（首期唯一可用的 image model）
 * - V1.x 起可扩展为 `jimeng-*` / `flux-*` / `sdxl-*` / `dall-e-*` / `midjourney-*`
 * - 运行时校验以 `image-provider.ts` 中 `ImageProviderRouter` 的注册表为准；
 *   此处只提供类型提示，实际可用性由 `getAllModels({ capability: "image" })` 给出。
 */

import type { TaskStatus } from "./common.js";

/**
 * 图片模型 ID（名义类型，按 S1 决策解绑）。
 *
 * 采用 `string & {}` 模式构造名义类型（nominal typing）：
 * - 结构上仍接受任意 string——V1.x+ 接入 `jimeng-*` / `flux-*` / `sdxl-*` / `dall-e-*` / `midjourney-*`
 *   等新 Provider 时无需修改本类型即可放行；
 * - 同时与普通 `string`、以及其它 `string & {}` 品牌类型（如视频模型 ID）互相不可直接赋值，
 *   避免不同字符串类型之间意外赋值；
 * - IDE 仍可在字面量上下文给出 `agnes-image-2.1-flash` 等已知值的提示。
 *
 * 运行时校验以 `image-provider.ts` 中 `ImageProviderRouter` 的注册表为准；此处只提供类型提示，
 * 实际可用性由 `getAllModels({ capability: "image" })` 给出：
 * ```ts
 * import { getAllModels } from "@/types/model-capabilities.js";
 * const models = getAllModels({ capability: "image", visibleOnly: true });
 * ```
 */
export type ImageModel = string & {};

/** 图片生成入参，images 支持多张参考图；model 允许调用方显式指定模型（默认 agnes-image-2.1-flash）。 */
export interface ImageParams {
  /**
   * 模型名称。
   * - 类型：`ImageModel`（`string & {}` 名义类型，既保留已知值提示又接受任意 string，新 model 可直接放行）
   * - 运行时：路由层会校验是否已注册
   * - 默认：`agnes-image-2.1-flash`（见 `image-config.ts:DEFAULT_IMAGE_MODEL`）
   */
  model?: ImageModel;
  prompt: string;
  negative_prompt?: string;
  image?: string;
  images?: string[];
  /**
   * 图片尺寸字符串（"1024x1024" / "768x1152" 等）。
   * - V1.3 起：改为 `string`，**禁止**用字面量联合锁死。原因：size 是"比例 × 档位"的乘积，
   *   随 model 能力扩展（V2 接 Jimeng/Flux/SDXL）会持续新增合法值。字面量联合无法维护。
   * - 校验：调用前应走 `image-config.ts:isValidSize()`。
   * - 默认值：见 `image-config.ts:DEFAULT_SIZE` / `recommendedSizeForRatio(ratio)`。
   */
  size?: string;
  ratio?: "1:1" | "3:2" | "2:3" | "16:9" | "9:16";
  /** 生成张数（顶层 n，文档示例未列出但生产环境支持 1-4）。 */
  n?: number;
  seed?: number;
  steps?: number;
  cfg?: number;
  /**
   * 输出格式：
   * - `url`：返回远程图片 URL（默认）
   * - `b64_json`：返回 Base64 编码
   * 注意：必须放在 extra_body.response_format 中（不是顶层）。
   */
  response_format?: "url" | "b64_json";
}

/** 图片生成任务，保存提示词、参数、结果图 URL 和执行状态。 */
export interface ImageTask {
  id: string;
  user_id?: string;
  conversation_id: string;
  prompt: string;
  negative: string;
  params: ImageParams;
  image_urls: string[];
  status: TaskStatus;
  error: string;
  created_at: string;
}
