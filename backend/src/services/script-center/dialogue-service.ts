/**
 * 对白 CRUD 服务
 */

import type { AppContext } from "../app.js";
import type { ScriptDialogue } from "../../types.js";
import { id, nowIso } from "../../utils.js";
import type { ScriptDialogueInput } from "./types.js";

/**
 * 列出对白。必须传 sceneId，避免全表返回造成跨项目数据泄露。
 * 调用方若只知道 projectId，应通过 /api/script-scenes 拿到 sceneId 后再来取。
 */
export async function listScriptDialogues(ctx: AppContext, sceneId: string): Promise<ScriptDialogue[]> {
  if (!sceneId) {
    throw new Error("sceneId 必填");
  }
  return ctx.scriptDialogues.findMany({ scene_id: sceneId }, { sort: "asc" });
}

export async function getScriptDialogue(ctx: AppContext, dialogueId: string): Promise<ScriptDialogue | null> {
  return ctx.scriptDialogues.findById(dialogueId);
}

export async function createScriptDialogue(ctx: AppContext, input: ScriptDialogueInput): Promise<ScriptDialogue> {
  // 必填校验：scene_id 是核心外键
  if (!input.scene_id) throw new Error("scene_id 必填");
  if (!input.dialogue) throw new Error("对白内容不能为空");
  const now = nowIso();
  const dialogue: ScriptDialogue = {
    id: id("sdlg"),
    project_id: input.project_id ?? "",
    scene_id: input.scene_id,
    character_id: input.character_id ?? "",
    dialogue: input.dialogue,
    emotion: input.emotion ?? "",
    order: input.order ?? 0,
    created_at: now,
    updated_at: now,
  };
  await ctx.scriptDialogues.insert(dialogue);
  return dialogue;
}

export async function updateScriptDialogue(
  ctx: AppContext,
  dialogueId: string,
  input: ScriptDialogueInput
): Promise<ScriptDialogue> {
  const existing = await ctx.scriptDialogues.findById(dialogueId);
  if (!existing) throw new Error("对白不存在");

  // 白名单字段：禁止通过 PATCH 改 project_id / scene_id（破坏引用完整性）
  const {
    project_id: _blockedProjectId,
    scene_id: _blockedSceneId,
    ...allowed
  } = input;

  const patch: Partial<ScriptDialogue> = {
    ...allowed,
    project_id: existing.project_id,
    scene_id: existing.scene_id,
    updated_at: nowIso(),
  };

  await ctx.scriptDialogues.update(dialogueId, patch);
  return { ...existing, ...patch } as ScriptDialogue;
}

export async function deleteScriptDialogue(ctx: AppContext, dialogueId: string): Promise<void> {
  const existing = await ctx.scriptDialogues.findById(dialogueId);
  if (!existing) throw new Error("对白不存在");
  await ctx.scriptDialogues.delete(dialogueId);
}
