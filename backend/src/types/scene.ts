/** 场景类型 */
export type SceneType = 'indoor' | 'outdoor' | 'virtual';

/** 场景实体（独立模块） */
export interface Scene {
  id: string;
  project_id: string;
  name: string;
  type: SceneType;
  description: string;
  image?: string;
  tags: string[];
  lighting?: string;
  time_of_day?: string;
  weather?: string;
  /** 资产被引用次数（缓存字段，由后端定期/按需计算） */
  usage_count?: number;
  /** 当前版本号（任务12：统一版本管理），每次 update 自增，初值为 1。 */
  version?: number;
  created_at: string;
  updated_at: string;
  /** 软删除时间戳；为空字符串或 undefined 时表示正常，未设置只读字段。 */
  deleted_at?: string;
}
