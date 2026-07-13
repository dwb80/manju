/**
 * 剧本评论 CRUD 服务
 */

import type { AppContext } from "../app.js";
import type { ScriptComment } from "../../types/script.js";
import { id, nowIso } from "../../utils.js";
import type { ScriptCommentInput } from "./types.js";

/** 按剧本文档 ID 列出全部评论（含回复），按创建时间升序。 */
export async function listScriptComments(ctx: AppContext, scriptId: string): Promise<ScriptComment[]> {
  if (!scriptId) return [];
  return ctx.scriptComments.findMany({ script_id: scriptId }, { sort: "asc" });
}

/** 创建评论或回复（通过 parent_id 区分）。 */
export async function createScriptComment(ctx: AppContext, input: ScriptCommentInput): Promise<ScriptComment> {
  if (!input.script_id) throw new Error("script_id 不能为空");
  if (!input.content || !input.content.trim()) throw new Error("评论内容不能为空");
  const now = nowIso();
  const comment: ScriptComment = {
    id: id("scmt"),
    script_id: input.script_id,
    episode_id: input.episode_id ?? "",
    user_name: input.user_name ?? "匿名用户",
    content: input.content,
    selected_text: input.selected_text ?? "",
    position_from: input.position_from ?? 0,
    position_to: input.position_to ?? 0,
    parent_id: input.parent_id ?? "",
    resolved: input.resolved ?? false,
    created_at: now,
    updated_at: now,
  };
  await ctx.scriptComments.insert(comment);
  return comment;
}

/** 局部更新评论（如内容、是否解决等）。 */
export async function updateScriptComment(
  ctx: AppContext,
  commentId: string,
  input: Partial<ScriptCommentInput>
): Promise<ScriptComment> {
  const existing = await ctx.scriptComments.findById(commentId);
  if (!existing) throw new Error("评论不存在");

  const patch: Partial<ScriptComment> = {
    ...input,
    updated_at: nowIso(),
  };

  await ctx.scriptComments.update(commentId, patch);
  return { ...existing, ...patch } as ScriptComment;
}

/** 删除评论（不级联，前端按需处理回复的清理）。 */
export async function deleteScriptComment(ctx: AppContext, commentId: string): Promise<void> {
  await ctx.scriptComments.delete(commentId);
}
