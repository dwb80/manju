/**
 * @file scene-image-history.ts
 * @description 场景图生成历史，结构与 prop-image-history 对称。
 */
export interface SceneImageHistory {
  id: string;
  scene_id: string;
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
