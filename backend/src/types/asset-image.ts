/**
 * @file asset-image.ts
 * @description 角色 / 场景 / 道具的"成图"实体类型（与 image_tasks / 候选图历史区分）。
 *
 * ## 设计要点
 *  - 一次出图可能产生 N 张候选（n），但仅 1 张 is_primary=1 计入主库。
 *  - view_type 用于标注"正面 / 侧面 / 3/4 角度 / 半身 / 全身"等展示位，便于一致性比对。
 *  - script_id 可选：与"剧本 → 角色图"工作流的关联字段。
 */
export interface CharacterImage {
  id: string;
  character_id: string;
  project_id: string;
  script_id?: string;
  url: string;
  prompt?: string;
  view_type?: string;
  /** 0 = 候选，1 = 主图。SQLite 用 INTEGER 0/1 表达 boolean。 */
  is_primary: number;
  created_at: string;
  updated_at: string;
}

export interface SceneImage {
  id: string;
  scene_id: string;
  project_id: string;
  script_id?: string;
  url: string;
  prompt?: string;
  view_type?: string;
  is_primary: number;
  created_at: string;
  updated_at: string;
}

export interface PropImage {
  id: string;
  prop_id: string;
  project_id: string;
  script_id?: string;
  url: string;
  prompt?: string;
  view_type?: string;
  is_primary: number;
  created_at: string;
  updated_at: string;
}
