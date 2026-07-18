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
  /** 外貌描述（来自 AI 提取或本地正则） */
  appearance?: string;
  /** 性格描述（来自 AI 提取或本地正则） */
  personality?: string;
  traits?: string[];
  /** 工厂标签（与 factory 对齐：Character.tags / Scene.tags / Prop.tags） */
  tags?: string[];
  // === AI 剧本分析扩展字段（与 Character 表对齐） ===
  /** 角色身份，如 剑客、公主、侦探 */
  identity?: string;
  /** 面部特征 */
  face?: string;
  /** 发型、发色、长度 */
  hair?: string;
  /** 身材体型 */
  body?: string;
  /** 气质，如 优雅、粗犷、冷峻 */
  temperament?: string;
  /** 服装名称 */
  costumeName?: string;
  /** 服装详细描述 */
  costumeDescription?: string;
  /** 服装主色调 */
  costumeColor?: string;
  /** 服装材质 */
  costumeMaterial?: string;
  /** 服装风格 */
  costumeStyle?: string;
  /** 配饰列表，如 玉佩、耳环、腰带 */
  accessories?: string[];
  /** 情绪状态 JSON 数组字符串 */
  emotionStates?: string;
  /** 动作资产 JSON 数组字符串 */
  actionAssets?: string;
  /** 人物关系 JSON 数组字符串 */
  relationships?: string;
  /** 首次出现场次，如 EP01-Scene01 */
  firstAppearance?: string;
  /** 对白数量 */
  dialogueCount?: number;
  /** AI 生图标准化提示词 */
  generationPrompt?: string;
  /** 推断可信度：confirmed / inferred */
  confidence?: string;
  // 场景专属
  sceneType?: string;
  lighting?: string;
  timeOfDay?: string;
  weather?: string;
  // === AI 剧本分析扩展字段（与 Scene 表对齐） ===
  /** 场景分类，如 古代建筑/现代都市/自然景观 */
  sceneCategory?: string;
  /** 室内/室外/混合 */
  indoorOutdoor?: string;
  /** 具体地点描述 */
  location?: string;
  /** 建筑结构 */
  architecture?: string;
  /** 地形特征 */
  terrain?: string;
  /** 植物元素 */
  plants?: string;
  /** 场景中固定物件 */
  objects?: string;
  /** 时间段 */
  period?: string;
  /** 整体色调 */
  tone?: string;
  /** 视觉风格 */
  visualStyle?: string;
  /** 情感氛围 */
  atmosphereEmotion?: string;
  /** 适合镜头 JSON 数组字符串 */
  suitableShots?: string;
  /** 可复用元素 JSON 数组字符串 */
  reusableElements?: string;
  // 道具专属
  category?: string;
  material?: string;
  /** 尺寸（与 factory Prop.size 对齐） */
  size?: string;
  color?: string;
  // === AI 剧本分析扩展字段（与 Prop 表对齐） ===
  /** 道具重要性级别：核心道具/普通道具/背景道具 */
  importanceLevel?: string;
  /** 归属角色名 */
  owner?: string;
  /** 形状/形态 */
  shape?: string;
  /** 表面质感 */
  texture?: string;
  /** 剧情作用 */
  storyFunction?: string;
  /** 视觉特征 JSON 数组字符串 */
  visualFeatures?: string;
  /** 镜头用法 JSON 数组字符串 */
  cameraUsage?: string;
}
