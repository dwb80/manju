/**
 * 剧本富文本结构（剧集/场景/对白）API
 *
 * - 与 backend/src/services/script-center-impl.ts 中的 createScriptEpisode/Scene/Dialogue 对应
 * - 与 frontend/services/script-center.service.ts 中的旧实现解耦，避免 import 路径冲突
 * - 用于 ScriptImportDialog 的导入流程：每条 episode/scene/dialogue 单独 POST 一次
 *
 * 注意：ScriptDialogue.character_id 必填，因此调用方必须先解析/创建 character
 * （可以通过 @/services/module.service 的 listCharacters/createCharacter 完成）
 */

import { api } from "@/lib/api-client";

// ============ 类型定义（与后端 types/script.ts 对齐） ============

export interface ScriptEpisodePayload {
  project_id: string;
  document_id: string;
  episode_no: number;
  title: string;
  synopsis?: string;
  status?: "draft" | "review" | "approved" | "production";
}

export interface ScriptScenePayload {
  project_id: string;
  episode_id: string;
  scene_no: number;
  location_name: string;
  time_of_day?: "day" | "night" | "dawn" | "dusk";
  description?: string;
  notes?: string;
}

export interface ScriptDialoguePayload {
  project_id: string;
  scene_id: string;
  character_id: string;
  dialogue: string;
  emotion?: string;
  order?: number;
}

export interface ScriptDocumentPayload {
  /** 可选：显式指定文档 ID。若不传，后端会生成新 ID。
   *  建议在"导入"流程传入与 Script.id 一致的值，便于编辑器通过 docId 直接找到对应文档。 */
  id?: string;
  project_id: string;
  editor_json: string;
  version?: number;
}

// ============ API 调用 ============

/** 创建剧本文档（写入 Tiptap editor_json） */
export async function createScriptDocumentApi(
  payload: ScriptDocumentPayload
): Promise<{ id: string; project_id: string; editor_json: string; version: number }> {
  return api("/api/script-documents", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** 创建剧集 */
export async function createScriptEpisodeApi(
  payload: ScriptEpisodePayload
): Promise<{ id: string; episode_no: number; title: string }> {
  return api("/api/script-episodes", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** 创建场景 */
export async function createScriptSceneApi(
  payload: ScriptScenePayload
): Promise<{ id: string; scene_no: number; location_name: string }> {
  return api("/api/script-scenes", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** 创建对白（character_id 必填） */
export async function createScriptDialogueApi(
  payload: ScriptDialoguePayload
): Promise<{ id: string; dialogue: string; order: number }> {
  return api("/api/script-dialogues", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
