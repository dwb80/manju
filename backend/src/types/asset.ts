/**
 * @file asset.ts
 * @description 资产相关类型定义，包括资产实体、资产类型、项目资产等
 */

/**
 * 资产类型
 * @property image - 图片资产
 * @property video - 视频资产
 * @property audio - 音频资产
 * @property document - 文档资产
 */
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
  // 兼容 ProjectAsset 字段（SQLite 存储共用同一张表 assets）。
  kind?: ProjectAssetKind;
  prompt?: string;
  image_url?: string;
  video_url?: string;
  folder?: string;
  is_favorite?: boolean;
  resolution?: string;
  duration?: string;
  role_images?: string[];
  role_traits?: string[];
  style_keywords?: string[];
  notes?: string;
}

/**
 * 项目资产类型
 * @property image - 图片
 * @property video - 视频
 * @property character - 角色
 * @property scene - 场景
 * @property style - 风格
 * @property prompt - 提示词模板
 * @property project - 项目
 * @property storyboard - 分镜
 */
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
