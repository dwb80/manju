import type { TaskStatus } from "./common.js";

/** Agnes Image 模型选项。 */
export type ImageModel = "agnes-image-2.1-flash";

/** 图片生成入参，images 支持多张参考图；model 允许调用方显式指定模型（默认 agnes-image-2.1-flash）。 */
export interface ImageParams {
  /** 模型名称，默认 agnes-image-2.1-flash。 */
  model?: ImageModel;
  prompt: string;
  negative_prompt?: string;
  image?: string;
  images?: string[];
  size?: "1024x768" | "768x1024" | "1024x1024" | "1152x768" | "768x1152";
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
  conversation_id: string;
  prompt: string;
  negative: string;
  params: ImageParams;
  image_urls: string[];
  status: TaskStatus;
  error: string;
  created_at: string;
}
