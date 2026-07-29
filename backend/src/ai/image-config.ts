/**
 * @file image-config.ts
 * @description S1.1 图片生成参数单一事实源（与 model-capabilities.ts 互补，但维度不同）
 *
 * ## 设计定位
 * - `model-capabilities.ts`：声明层（"agnes-image-2.1-flash 支持 image / 参数范围"）
 * - `image-config.ts`（本文件）：参数合法值集中表（"所有图片 API 共用的 ratio / size 枚举"）
 * - `image-provider.ts`：执行层（"调哪个 SDK、payload 怎么组装"）
 *
 * 工厂侧使用约束：见 `docs/requirements/modules/04-factories-assets-and-image-views.md §13` 与 `docs/requirements/modules/05-ai-image-config.md §6.1`。
 *
 * ## S1 阶段
 * 单一文件承载，**不依赖 DB**，可被前端/后端/测试三方 import。
 * V1.1+ 若需要分 Provider 维护，再拆 `image-config/{ratio,size}.ts`。
 */

// =====================================================================
// 比例（与 Agnes API `extra_body.ratio` 字段对齐）
// =====================================================================

/**
 * 支持的图片比例。
 * 工厂 UI 默认 9:16（竖屏分镜）/ 16:9（横屏分镜）/ 1:1（头像）。
 * 完整列表见 `model-capabilities.ts` 中 `agnes-image-2.1-flash.image.ratio.enum`。
 */
export type SupportedRatio = "1:1" | "3:2" | "2:3" | "16:9" | "9:16";

/** 全部合法比例（用于参数校验 + UI 下拉） */
export const ALL_RATIOS: readonly SupportedRatio[] = ["1:1", "3:2", "2:3", "16:9", "9:16"];

/** 比例是否合法 */
export function isSupportedRatio(value: unknown): value is SupportedRatio {
  return typeof value === "string" && (ALL_RATIOS as readonly string[]).includes(value);
}

// =====================================================================
// 尺寸（与比例联动；像素 = 比例 × base；base 默认 1024）
// =====================================================================

/**
 * 尺寸字符串格式："{width}x{height}"。
 * 工厂 UI 默认 1024×1024（1:1）、1024×1536（2:3）、1536×1024（3:2）、1280×720（16:9）、720×1280（9:16）。
 * 全部合法值见下 `ALL_SIZES`；校验时建议走 `image-config.ts` 而非硬编码字符串比较。
 */
export const ALL_SIZES: readonly string[] = [
  // 1:1
  "512x512", "768x768", "1024x1024", "1280x1280", "1536x1536",
  // 2:3 (竖屏)
  "512x768", "768x1152", "1024x1536", "1280x1920", "1536x2304",
  // 3:2 (横屏)
  "768x512", "1152x768", "1536x1024", "1920x1280", "2304x1536",
  // 16:9 (横屏)
  "512x288", "768x432", "1024x576", "1280x720", "1536x864", "1920x1080",
  // 9:16 (竖屏)
  "288x512", "432x768", "576x1024", "720x1280", "864x1536", "1080x1920",
];

/** 解析尺寸字符串为 [width, height] */
export function parseSize(size: string): { width: number; height: number } | null {
  const match = /^(\d+)x(\d+)$/.exec(size);
  if (!match) return null;
  return { width: Number(match[1]), height: Number(match[2]) };
}

/** 校验尺寸字符串是否合法 */
export function isValidSize(size: unknown): size is string {
  return typeof size === "string" && (ALL_SIZES as readonly string[]).includes(size);
}

// =====================================================================
// 默认值
// =====================================================================

/**
 * 工厂侧默认图片模型（V1.1 锁定 agnes-image-2.1-flash）。
 * 任何"未指定 model"的回退值都必须引用本常量，禁止各处硬编码。
 * V2 接入新 Provider 后，本常量会变成"默认首选 model"而非"唯一 model"——届时
 * 业务方应优先用 `model-center` 推过来的 model 选择（参见 05-ai-image-config.md §6.5）。
 */
export const DEFAULT_IMAGE_MODEL = "agnes-image-2.1-flash";

/** 工厂侧默认比例（竖屏分镜）。DEFAULT_SIZE 由此推导，禁止硬编码第二处。 */
export const DEFAULT_RATIO: SupportedRatio = "9:16";

/**
 * 工厂侧默认尺寸（与 DEFAULT_RATIO 联动）。
 * 通过 `recommendedSizeForRatio(DEFAULT_RATIO)` 派生，避免比例/尺寸双真相源漂移。
 * 如需"按比例自定义 size"，调用 `recommendedSizeForRatio(ratio)` 自行取；禁止硬编码第二份。
 */
export const DEFAULT_SIZE: string = recommendedSizeForRatio(DEFAULT_RATIO);

/**
 * 工厂侧默认 n（候选数）。
 * 与 `docs/requirements/modules/05-ai-image-config.md` 单一真相源对齐：默认生成 4 张候选图（范围 1~4，见 `MAX_N`/`MIN_N` 语义）。
 * 调用方未显式传 n 时回退到此值；越界由路由层 clamp 到 [1,4]。
 */
export const DEFAULT_N = 4;

// =====================================================================
// 响应格式
// =====================================================================

/** Agnes API `extra_body.response_format` 字段允许值 */
export type ResponseFormat = "url" | "b64_json";

/** 工厂 UI 默认响应格式（节省前端处理；b64_json 仅在用户主动选 "下载原图" 时切） */
export const DEFAULT_RESPONSE_FORMAT: ResponseFormat = "url";

// =====================================================================
// 比例 → 推荐尺寸的辅助函数
// =====================================================================

/** 根据比例返回"中间档"推荐尺寸（用于 UI 一键填充 size 字段） */
export function recommendedSizeForRatio(ratio: SupportedRatio): string {
  switch (ratio) {
    case "1:1": return "1024x1024";
    case "3:2": return "1536x1024";
    case "2:3": return "1024x1536";
    case "16:9": return "1280x720";
    case "9:16": return "720x1280";
  }
}
