/**
 * 我的待办（评审优化 P1）
 *
 * 定位：与项目级 ProjectTask 不同，这是用户个人维度的轻量待办列表，
 * 用于汇总"我需要处理的事"，可以跨项目跳转。
 *
 * 设计原则：
 * - 软删除：通过 deleted_at 字段实现
 * - 状态：pending | doing | done
 * - 优先级：low | medium | high
 * - 关联：可选 link_type + link_id，指向具体的剧本/分镜/音频/项目等
 */

export type TodoStatus = "pending" | "doing" | "done";
export type TodoPriority = "low" | "medium" | "high";

/** 我的待办条目。 */
export interface Todo {
  id: string;
  /** 创建者（当前登录用户），用于按用户隔离。 */
  owner: string;
  title: string;
  description?: string;
  status: TodoStatus;
  priority: TodoPriority;
  /** 截止日期（ISO 字符串，可空）。 */
  due_date?: string;
  /** 关联资产类型（可选）：project / script / storyboard / audio / video / clip */
  link_type?: string;
  /** 关联资产 ID。 */
  link_id?: string;
  /** 关联跳转 URL（前端可直接用）。 */
  link_url?: string;
  created_at: string;
  updated_at: string;
  /** 软删除时间戳。 */
  deleted_at?: string;
}
