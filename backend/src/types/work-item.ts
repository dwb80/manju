/**
 * 统一工作项（评审优化 P2 / 状态机收敛）
 *
 * 把 4 类业务实体（任务 / 问题 / 审核 / 里程碑）合并到 1 张表 + 1 个状态机：
 * - 任务（task）：原 ProjectTask，状态语义统一为 {pending, doing, done, dismissed}；
 *   原 7 阶段（todo/script/storyboard/image/video/review/done）按以下规则映射：
 *     todo    → pending
 *     script  → doing
 *     storyboard → doing
 *     image   → doing
 *     video   → doing
 *     review  → doing
 *     done    → done
 * - 问题（issue）：原 ProjectIssue，状态映射：
 *     open    → pending
 *     doing   → doing
 *     resolved → done
 *     closed  → dismissed
 * - 审核（review）：原 ProjectReview，状态映射：
 *     open    → pending
 *     resolved → done
 *     rejected → dismissed
 * - 里程碑（milestone）：原 ProjectMilestone（API 仍可派生），状态映射：
 *     planned → pending
 *     doing   → doing
 *     done    → done
 *     delayed → pending（结合 due_date 判定逾期）
 *
 * 设计原则：
 * - 单一状态机：所有工作项共享 pending → doing → done | dismissed
 * - kind 字段用于区分类型，控制详情页字段渲染
 * - 软删除统一通过 deleted_at
 * - 进度字段由后端从关联资产派生（不存储在 work_item 本体）
 */

/** 工作项的 4 种 kind。 */
export type WorkItemKind = "task" | "issue" | "review" | "milestone";

/** 统一状态机（4 态）。 */
export type WorkItemStatus = "pending" | "doing" | "done" | "dismissed";

/** 严重度（仅 issue kind 使用）。 */
export type WorkItemSeverity = "low" | "medium" | "high" | "critical";

/** 关联资产类型（仅 issue/review kind 使用）。 */
export type WorkItemTargetType = "storyboard" | "image" | "video" | "asset" | "clip" | "script" | "episode";

/** 统一工作项实体。 */
export interface WorkItem {
  id: string;
  project_id: string;
  /** 类型：task / issue / review / milestone。 */
  kind: WorkItemKind;
  title: string;
  /** 统一状态：pending | doing | done | dismissed。 */
  status: WorkItemStatus;
  /** 负责人（task/issue/milestone 的 owner，review 的 reviewer）。 */
  owner: string;
  /** 截止日期（ISO 字符串，可空）。 */
  due_date?: string;
  /** 严重度（仅 issue）。 */
  severity?: WorkItemSeverity;
  /** 关联资产类型（仅 issue/review）。 */
  target_type?: WorkItemTargetType;
  /** 关联资产 ID（仅 issue/review）。 */
  target_id?: string;
  /** 描述/备注/评论（合并自原 notes / description / comment）。 */
  description?: string;
  /** 标签，便于筛选/搜索。 */
  tags?: string[];
  /** 创建时间。 */
  created_at: string;
  /** 更新时间。 */
  updated_at: string;
  /** 软删除时间戳。 */
  deleted_at?: string;
}

/** 状态机的合法值集合（用于服务端校验）。 */
export const WORK_ITEM_STATUSES: readonly WorkItemStatus[] = ["pending", "doing", "done", "dismissed"] as const;

/** kind 的合法值集合。 */
export const WORK_ITEM_KINDS: readonly WorkItemKind[] = ["task", "issue", "review", "milestone"] as const;

/** 把任意 status 规整为合法值，未知值默认 pending。 */
export function normalizeWorkItemStatus(status: unknown): WorkItemStatus {
  return WORK_ITEM_STATUSES.includes(status as WorkItemStatus) ? (status as WorkItemStatus) : "pending";
}

/** 把任意 kind 规整为合法值，未知值默认 task。 */
export function normalizeWorkItemKind(kind: unknown): WorkItemKind {
  return WORK_ITEM_KINDS.includes(kind as WorkItemKind) ? (kind as WorkItemKind) : "task";
}
