/**
 * @file prop-image-history.ts
 * @description 道具图生成历史。每一次"出 N 张候选"记录一条主表 + 候选 url 列表，
 *              便于回溯 prompt / seed / model 等参数。
 */
export interface PropImageHistory {
  id: string;
  prop_id: string;
  project_id: string;
  url: string;
  ratio: string;
  model: string;
  size: string;
  prompt: string;
  negative_prompt?: string;
  response_format: string;
  n: number;
  is_applied: boolean;
  applied_at: string;
  created_at: string;
}
