/**
 * 剧本文档 CRUD 服务
 */

import type { AppContext } from "../app.js";
import type { ScriptDocument } from "../../types.js";
import { id, nowIso } from "../../utils.js";
import type { ScriptDocumentInput } from "./types.js";

export async function listScriptDocuments(ctx: AppContext, projectId?: string): Promise<ScriptDocument[]> {
  const filter = projectId ? { project_id: projectId } : {};
  return ctx.scriptDocuments.findMany(filter, { sort: "desc" });
}

export async function getScriptDocument(ctx: AppContext, documentId: string): Promise<ScriptDocument | null> {
  return ctx.scriptDocuments.findById(documentId);
}

export async function createScriptDocument(ctx: AppContext, input: ScriptDocumentInput): Promise<ScriptDocument> {
  const document: ScriptDocument = {
    id: input.id ?? id("sd"),
    project_id: input.project_id ?? "",
    editor_json: input.editor_json ?? "",
    version: input.version ?? 1,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  await ctx.scriptDocuments.insert(document);
  return document;
}

export async function updateScriptDocument(
  ctx: AppContext,
  documentId: string,
  input: ScriptDocumentInput
): Promise<ScriptDocument> {
  const existing = await ctx.scriptDocuments.findById(documentId);
  if (!existing) throw new Error("剧本文档不存在");

  const patch: Partial<ScriptDocument> = {
    ...input,
    version: existing.version + 1, // 每次更新自动增加版本号
    updated_at: nowIso(),
  };

  await ctx.scriptDocuments.update(documentId, patch);
  return { ...existing, ...patch } as ScriptDocument;
}

export async function deleteScriptDocument(ctx: AppContext, documentId: string): Promise<void> {
  await ctx.scriptDocuments.delete(documentId);
}
