/**
 * @file audio.ts
 * @description 音频资产相关类型定义，包括音频实体、音频类型等
 */

/**
 * 音频类型
 * @property voiceover - 配音
 * @property bgm - 背景音乐
 * @property sfx - 音效
 */
export type AudioType = 'voiceover' | 'bgm' | 'sfx';

/** 音频实体（独立模块）。 */
export interface Audio {
  id: string;
  project_id: string;
  name: string;
  type: AudioType;
  /** 备注 / 文本（AI 配音的原始台词）。 */
  description: string;
  duration: number;
  file_url: string;
  /** 发言人（兼容旧版纯文本）。 */
  speaker: string;
  /** 绑定到角色工厂的角色 ID。 */
  character_id: string;
  /** 绑定到分镜导演台的分镜 ID（这条音频用在哪个镜头）。 */
  storyboard_id: string;
  /** 所属集数。 */
  episode: number;
  tags: string[];
  format: string;
  size: number;
  /** 资产被引用次数（缓存字段）。 */
  usage_count?: number;
  /** 当前版本号，每次 update 自增，初值为 1。 */
  version?: number;
  created_at: string;
  updated_at: string;
  /** 软删除时间戳。 */
  deleted_at?: string;
}
