/**
 * 剧本导入模块 - 类型定义
 */

/** 预览解析后的场景结构（含 dialogues） */
export interface PreviewScene {
  scene_no: number;
  scene_name: string;
  location_name: string;
  time_of_day: string;
  description: string;
  dialogues: PreviewDialogue[];
}

export interface PreviewDialogue {
  character: string;
  text: string;
  emotion: string;
  order: number;
}

export interface PreviewEpisode {
  episode_no: number;
  title: string;
  synopsis: string;
  status: string;
  scenes: PreviewScene[];
}

/** 解析出的角色信息 + 资产匹配状态 */
export interface PreviewCharacter {
  name: string;
  description?: string;
  role?: "protagonist" | "antagonist" | "supporting" | "minor";
  gender?: "male" | "female" | "other";
  appearance?: string;
  personality?: string;
  traits?: string[];
  /** 命中现有角色资产时的 id（直接复用） */
  matchedCharacterId?: string;
  /** 命中现有角色资产时的描述（用于展示） */
  matchedCharacterDescription?: string;
  /** 命中的角色工厂中的 image url（用于在预览中显示） */
  matchedImageUrl?: string;
  /** 该角色出现在多少句对白中 */
  dialogueCount: number;
  /** 出现该角色的剧集号列表 */
  episodes: number[];
  /** 资产匹配状态：matched=已匹配 / will_create=将自动创建 / unresolved=未解析 */
  matchStatus: "matched" | "will_create" | "unresolved";
}

/** 场景资产 */
export interface PreviewSceneAsset {
  location_name: string;
  time_of_day: string;
  atmosphere?: string;
  description?: string;
  visual_keywords?: string[];
  first_appearance?: string;
  /** 匹配到工厂场景时的 id */
  matchedSceneId?: string;
  matchedImageUrl?: string;
  matchStatus: "matched" | "will_create" | "unresolved";
}

/** 道具资产 */
export interface PreviewPropAsset {
  name: string;
  category: string;
  description?: string;
  color?: string;
  material?: string;
  size?: string;
  owner?: string;
  first_appearance?: string;
  /** 匹配到工厂道具时的 id */
  matchedPropId?: string;
  matchedImageUrl?: string;
  matchStatus: "matched" | "will_create" | "unresolved";
}

export interface PreviewResult {
  title: string;
  format: string;
  file_name: string;
  editor_json: any;
  episodes: PreviewEpisode[];
  /** 从对白中识别出的角色集合（去重） */
  characters: PreviewCharacter[];
  /** AI 提取的场景资产 */
  sceneAssets: PreviewSceneAsset[];
  /** AI 提取的道具资产 */
  propAssets: PreviewPropAsset[];
  /** 数据来源：ai=大模型 / local=本地正则 */
  source: "ai" | "local";
  /** AI 输出警告 */
  warnings?: string[];
}
