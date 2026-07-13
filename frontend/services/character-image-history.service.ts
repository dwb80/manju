/**
 * 角色图片生成历史 API
 *
 * 持久化位置：后端 SQLite `character_image_history` 表。
 * 角色图片生成器右侧的「历史图片」和「已选资产历史」都用这张表。
 *
 * 设计：单表 + is_applied 字段区分两种记录，避免拆表带来的"取消应用"状态丢失。
 * 前端 GET 全量后本地按 is_applied 过滤出两个 UI 区块。
 */

import { api } from "./api-client";
import type { CharacterImageHistory } from "@/lib/module-types";

/** 追加历史时使用的入参（id / is_applied / created_at 由后端生成）。 */
export interface AppendImageHistoryInput {
  character_id: string;
  project_id: string;
  url: string;
  ratio: string;
  model: string;
  size: string;
  prompt: string;
  negative_prompt?: string;
  response_format: string;
  n: number;
}

/** 列出某角色所有图片生成历史（按 created_at 倒序）。 */
export async function listCharacterImageHistory(characterId: string): Promise<CharacterImageHistory[]> {
  return api<CharacterImageHistory[]>(`/api/character-image-history?characterId=${encodeURIComponent(characterId)}`);
}

/** 追加一条历史（AI 生成图后调用）。同 character + url 已存在时返回旧记录。 */
export async function appendCharacterImageHistory(input: AppendImageHistoryInput): Promise<CharacterImageHistory> {
  return api<CharacterImageHistory>("/api/character-image-history", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** 标记一条历史为「已应用」（点「设为角色资产」时调用）。 */
export async function applyCharacterImageHistory(id: string): Promise<CharacterImageHistory> {
  return api<CharacterImageHistory>(`/api/character-image-history/${encodeURIComponent(id)}/apply`, {
    method: "PATCH",
  });
}

/** 删除单条历史。 */
export async function deleteCharacterImageHistory(id: string): Promise<void> {
  await api(`/api/character-image-history/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/** 清空某角色的所有图片历史。 */
export async function clearCharacterImageHistory(characterId: string): Promise<{ deleted: number }> {
  return api<{ deleted: number }>("/api/character-image-history/clear", {
    method: "POST",
    body: JSON.stringify({ character_id: characterId }),
  });
}
