/**
 * 剧本中心模块 - 内部类型定义
 */

/** 支持的导入格式 */
export type ImportFormat = "txt" | "markdown" | "fountain" | "json" | "fdx";

export type ViewMode = "list" | "classification";

/** 剧本分析提取的资产类型 */
export interface ExtractedAsset {
  id: string;
  type: "character" | "scene" | "prop";
  name: string;
  description: string;
  confirmed: boolean;
  // 角色专属
  role?: string;
  gender?: string;
  age?: number;
  traits?: string[];
  // 场景专属
  sceneType?: string;
  lighting?: string;
  timeOfDay?: string;
  weather?: string;
  // 道具专属
  category?: string;
  material?: string;
  color?: string;
}
