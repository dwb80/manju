/** 资产类型 */
export type AssetType = 'image' | 'video' | 'audio' | 'document';

/** 资产实体（独立模块） */
export interface Asset {
  id: string;
  project_id: string;
  name: string;
  type: AssetType;
  file_url: string;
  size: number;
  format: string;
  tags: string[];
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type ProjectAssetKind = "image" | "video" | "character" | "scene" | "style" | "prompt" | "project" | "storyboard";

/** 项目资产，统一描述图片、视频、角色卡、场景、风格和提示词模板。 */
export interface ProjectAsset {
  id: string;
  project_id: string;
  kind: ProjectAssetKind;
  name: string;
  prompt: string;
  image_url: string;
  video_url: string;
  folder: string;
  tags: string[];
  is_favorite: boolean;
  resolution: string;
  duration: string;
  role_images: string[];
  role_traits: string[];
  style_keywords: string[];
  notes: string;
  created_at: string;
  updated_at: string;
}
