import type { AppContext } from "../app.js";
import { rootLogger } from "../../logger.js";
import { id, nowIso } from "../../utils.js";
import type { ReviewTargetType } from "../../types/horizontal.js";
import type { TodoPriority, TodoStatus } from "../../types/todo.js";

const log = rootLogger.child({ module: "rework-todo-service" });
const PIPELINE_REWORK_LINK_TYPES = new Set<ReviewTargetType>(["pipeline_run", "pipeline_node"]);

export function isPipelineReworkTargetType(targetType: ReviewTargetType | string): boolean {
  return PIPELINE_REWORK_LINK_TYPES.has(targetType as ReviewTargetType);
}

interface ReworkRunShape {
  id: string;
  name?: string;
  project_id?: string;
}

interface ReworkNodeShape {
  id: string;
  name?: string;
  type?: string;
  error?: string;
}

interface ReworkReviewShape {
  id: string;
  project_id?: string;
  submitted_by?: string;
}

export async function createPipelineReworkTodo(
  ctx: AppContext,
  opts: {
    review: ReworkReviewShape;
    run: ReworkRunShape;
    node: ReworkNodeShape | null;
    reasonCode: string;
    reasonLabel?: string;
    rejectedCount: number;
    submittedBy?: string;
  },
): Promise<{ todoId: string; created: boolean; reason?: string }> {
  const { review, run, node, reasonCode, reasonLabel, rejectedCount, submittedBy } = opts;
  const now = nowIso();
  const isNodeLevel = node !== null;
  const linkType: "pipeline_run" | "pipeline_node" = isNodeLevel ? "pipeline_node" : "pipeline_run";
  const linkId = isNodeLevel ? node.id : run.id;
  let owner = submittedBy ?? "";
  if (!owner && run.project_id) {
    const project = await ctx.projects.findById(run.project_id);
    owner = project?.owner ?? "";
  }
  if (!owner) return { todoId: "", created: false, reason: "no_owner" };

  const subject = isNodeLevel ? `节点 ${node.name || node.id}` : `流水线 ${run.name || run.id}`;
  const label = reasonLabel ?? reasonCode ?? "审核打回";
  const patch = {
    title: `返工：${subject}（${label}）`,
    description: [
      `流水线：${run.name || run.id}（${run.id}）`,
      isNodeLevel
        ? `节点：${node.name || node.id}（${node.id}）\n类型：${node.type || "?"}\n最近错误：${node.error || "无"}`
        : null,
      `审核：${review.id}\n累计退回：${rejectedCount || 1} 次\n原因：${label}`,
    ].filter(Boolean).join("\n"),
    status: "pending" as TodoStatus,
    priority: (rejectedCount >= 3 ? "high" : "medium") as TodoPriority,
    owner,
    due_date: "",
    link_type: linkType,
    link_id: linkId,
    link_url: isNodeLevel
      ? `/pipeline/runs/${run.id}?projectId=${encodeURIComponent(run.project_id ?? "")}&nodeId=${encodeURIComponent(node.id)}`
      : `/pipeline/runs/${run.id}?projectId=${encodeURIComponent(run.project_id ?? "")}`,
    updated_at: now,
    deleted_at: "",
  };

  const existing = await ctx.todos.findOne({ link_type: linkType, link_id: linkId, owner });
  if (existing?.status === "done") {
    return { todoId: existing.id, created: false, reason: "already_done" };
  }
  const created = !existing;
  const todoId = existing?.id ?? id("todo");
  if (existing) {
    await ctx.todos.update(todoId, patch);
  } else {
    await ctx.todos.insert({ id: todoId, ...patch, created_at: now });
  }
  log.info(
    { event: created ? "rework.todo.created" : "rework.todo.updated", todoId, linkType, linkId },
    created ? "返工 Todo 已创建" : "返工 Todo 已更新",
  );
  await ctx.pipelineRunService.recordEvent({
    runId: run.id,
    nodeId: node?.id ?? "",
    projectId: run.project_id ?? review.project_id ?? "",
    type: created ? "rework_todo_created" : "rework_todo_updated",
    payload: { todoId, reasonCode, rejectedCount },
  });
  return { todoId, created };
}
