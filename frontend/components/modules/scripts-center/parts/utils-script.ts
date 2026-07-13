"use client";

/**
 * 剧本中心 - 工具函数
 *
 * - loadScriptContentForAnalysis：拉取剧本文档正文，回退到 description
 * - editorJsonToPlainText：把 Tiptap editor_json 转成纯文本
 * - mergeExtractedAssets：合并 AI 分析结果与本地兜底结果，按 type+name 去重
 */

import type { Script } from "@/lib/module-types";
import type { ExtractedAsset } from "../types";

/**
 * 加载剧本正文，优先从 ScriptDocument.editor_json 中提取纯文本；
 * 若拉取失败则回退到 script.description。
 */
export async function loadScriptContentForAnalysis(script: Script): Promise<string> {
  let documentText = "";
  try {
    const resp = await fetch(`/api/script-documents/${encodeURIComponent(script.id)}`);
    if (resp.ok) {
      const payload = await resp.json();
      const document = payload?.data ?? payload;
      documentText = editorJsonToPlainText(document?.editor_json);
    }
  } catch (err) {
    console.warn("读取剧本文档正文失败，回退到 description:", err);
  }
  return (documentText || script.description || "").trim();
}

/**
 * 把 Tiptap 风格的 editor_json 转成纯文本。
 * 接受对象或 JSON 字符串；字符串无法解析时直接返回原文。
 */
export function editorJsonToPlainText(input: unknown): string {
  if (!input) return "";
  let value: any = input;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return value;
    }
  }
  const walk = (node: any): string => {
    if (!node) return "";
    if (typeof node === "string") return node;
    if (typeof node.text === "string") return node.text;
    if (Array.isArray(node.content)) {
      const text = node.content.map(walk).filter(Boolean).join(node.type === "doc" ? "\n" : "");
      return node.type && node.type !== "doc" && node.type !== "text" ? `${text}\n` : text;
    }
    return "";
  };
  return walk(value).replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * 合并两组已提取资产：primary 优先，按 type+name 去重；
 * 同名资产会被跳过（保留主结果），且 fallback 命中后会标记 confirmed=true。
 */
export function mergeExtractedAssets(primary: ExtractedAsset[], fallback: ExtractedAsset[]): ExtractedAsset[] {
  const result = [...primary].filter((asset) => asset.name.trim());
  const seen = new Set(result.map((asset) => `${asset.type}:${asset.name.trim()}`));
  for (const asset of fallback) {
    const key = `${asset.type}:${asset.name.trim()}`;
    if (!asset.name.trim() || seen.has(key)) continue;
    seen.add(key);
    result.push({
      ...asset,
      id: `local-${asset.id}-${Date.now()}`,
      confirmed: true,
    });
  }
  return result;
}
