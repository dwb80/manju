import type { TaskStatus } from "./common.js";

/** 图片生成入参，images 支持多张参考图。 */
export interface ImageParams {
  prompt: string;
  negative_prompt?: string;
  image?: string;
  images?: string[];
  size?: "1024x768" | "768x1024" | "1024x1024" | "1152x768" | "768x1152";
  ratio?: "1:1" | "3:2" | "2:3" | "16:9" | "9:16";
  n?: number;
  seed?: number;
  steps?: number;
  cfg?: number;
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
