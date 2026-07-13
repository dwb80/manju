/**
 * 剧本中心子模块工具函数
 *
 * - collectChatContent: 从 AsyncIterable<ChatChunk> 中收集完整内容
 * - normalizeTimeOfDay: 规范化时间段枚举
 * - extractPlainText: 从 Tiptap editor_json 中递归提取纯文本
 * - parseSceneHeader: 解析场景标题
 */

import type { ChatChunk } from "../../types.js";

/**
 * 辅助函数：从 AsyncIterable<ChatChunk> 中收集完整内容
 */
export async function collectChatContent(chunks: AsyncIterable<ChatChunk>): Promise<string> {
  let content = "";
  for await (const chunk of chunks) {
    if (chunk.content) {
      content += chunk.content;
    }
  }
  return content;
}

/** 规范化时间段枚举 */
export function normalizeTimeOfDay(value: string): "day" | "night" | "dawn" | "dusk" {
  const v = (value || "").toLowerCase();
  if (v.includes("夜") || v.includes("night")) return "night";
  if (v.includes("黄昏") || v.includes("傍晚") || v.includes("dusk")) return "dusk";
  if (v.includes("晨") || v.includes("黎明") || v.includes("dawn")) return "dawn";
  return "day";
}

/**
 * 从 Tiptap editor_json 中递归提取纯文本。
 * 支持 string/对象两种格式；处理 doc 根节点和 heading/paragraph 等 block。
 */
export function extractPlainText(editorJson: any): string {
  if (!editorJson) return "";
  let json = editorJson;
  if (typeof json === "string") {
    try {
      json = JSON.parse(json);
    } catch {
      return json; // 纯文本直接返回
    }
  }
  const parts: string[] = [];
  const walk = (node: any) => {
    if (!node) return;
    if (typeof node.text === "string") {
      parts.push(node.text);
      return;
    }
    if (Array.isArray(node.content)) {
      // heading 节点后追加换行，便于后续按标题切分
      const isBlock = ["heading", "paragraph", "blockquote"].includes(node.type);
      node.content.forEach((c: any) => walk(c));
      if (isBlock) parts.push("\n");
    }
  };
  walk(json);
  return parts.join("").trim();
}

/**
 * 解析场景标题，支持多种分隔符
 * 输入示例：
 *   "Scene 01 - 茶信馆门口 - 白天"
 *   "Scene 2 / 茶信馆门口 / 白天"
 *   "场景01 茶信馆门口 白天"
 *   "茶信馆门口 - 白天"
 */
export function parseSceneHeader(header: string): {
  location: string;
  time: string;
  description: string;
} {
  // 去掉 "Scene XX" / "场景XX" 前缀
  const cleaned = header
    .replace(/^Scene\s*\d+\s*/i, "")
    .replace(/^场景\s*\d+\s*/i, "")
    .trim();
  // 按 - / ｜ 分隔
  const parts = cleaned.split(/\s*[-/｜|]\s*/).filter((p) => p);
  if (parts.length >= 2) {
    // 第一段是地点，最后一段是时间，中间是描述
    const location = parts[0] || "";
    const time = parts[parts.length - 1] || "day";
    const description = parts.length > 2 ? parts.slice(1, -1).join(" ") : "";
    return { location, time, description };
  }
  if (parts.length === 1) {
    return { location: parts[0] || "", time: "day", description: "" };
  }
  return { location: "", time: "day", description: "" };
}
