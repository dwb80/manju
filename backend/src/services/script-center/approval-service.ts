/**
 * 剧本审批 CRUD 服务
 */

import type { AppContext } from "../app.js";
import type { ScriptApproval } from "../../types.js";
import { id, nowIso } from "../../utils.js";
import type { ScriptApprovalInput } from "./types.js";

export async function getApprovalByScript(ctx: AppContext, scriptId: string): Promise<ScriptApproval | null> {
  const approvals = await ctx.scriptApprovals.findMany({ script_id: scriptId }, { sort: "desc", limit: 1 });
  return approvals[0] ?? null;
}

export async function createApproval(ctx: AppContext, input: ScriptApprovalInput): Promise<ScriptApproval> {
  const approval: ScriptApproval = {
    id: id("sapr"),
    project_id: input.project_id ?? "",
    script_id: input.script_id ?? "",
    status: (input.status as ScriptApproval["status"]) ?? "pending",
    current_step: input.current_step ?? 1,
    total_steps: input.total_steps ?? 3,
    applicants: input.applicants ?? [],
    reviewers: input.reviewers ?? [],
    comments: input.comments ?? [],
    created_by: input.created_by ?? "",
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  await ctx.scriptApprovals.insert(approval);
  return approval;
}

export async function updateApproval(
  ctx: AppContext,
  approvalId: string,
  input: ScriptApprovalInput
): Promise<ScriptApproval> {
  const existing = await ctx.scriptApprovals.findById(approvalId);
  if (!existing) throw new Error("审批记录不存在");

  const patch: Partial<ScriptApproval> = {
    ...input,
    status: input.status ? (input.status as ScriptApproval["status"]) : undefined,
    updated_at: nowIso(),
  };

  await ctx.scriptApprovals.update(approvalId, patch);
  return { ...existing, ...patch } as ScriptApproval;
}
