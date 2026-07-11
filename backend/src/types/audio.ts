/** 音频类型 */
export type AudioType = 'voiceover' | 'bgm' | 'sfx';

/** 音频实体（独立模块） */
export interface Audio {
  id: string;
  project_id: string;
  name: string;
  type: AudioType;
  duration: number;
  file_url: string;
  speaker?: string;
  tags: string[];
  format?: string;
  size?: number;
  created_at: string;
  updated_at: string;
}
