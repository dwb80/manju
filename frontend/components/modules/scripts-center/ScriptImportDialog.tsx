"use client";

/**
 * 导入剧本对话框
 *
 * 流程（对齐需求文档 Feature 4.5）：
 * 1. 用户选择格式 + 输入/上传剧本内容
 * 2. 点击"解析预览" → 本地解析展示识别结果（剧集/场景/对白）
 * 3. 用户确认或调整后点击"确认导入" → 写入数据库
 */

import { useState, useRef, useMemo } from "react";
import {
  FileText,
  FileType,
  FileCode,
  FileJson,
  Upload,
  Loader2,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { scriptCenterService } from "@/services/script-center.service";
import { listCharacters, createCharacter, createScriptDocumentApi, createScriptEpisodeApi, createScriptSceneApi, createScriptDialogueApi, createScript, listScenes, createScene, listProps, createProp } from "@/services/module.service";
import { DialogOverlay } from "./ScriptsCenterPage";
import { getImportPlaceholder, parseFountain, parseFDX } from "./utils";
import type { ImportFormat } from "./types";

/** 预览解析后的剧集结构（含 scenes + dialogues） */
interface PreviewScene {
  scene_no: number;
  location_name: string;
  time_of_day: string;
  description: string;
  dialogues: PreviewDialogue[];
}

interface PreviewDialogue {
  character: string;
  text: string;
  emotion: string;
  order: number;
}

interface PreviewEpisode {
  episode_no: number;
  title: string;
  synopsis: string;
  status: string;
  scenes: PreviewScene[];
}

/** 解析出的角色信息 + 资产匹配状态 */
interface PreviewCharacter {
  name: string;
  description?: string;
  role?: "protagonist" | "antagonist" | "supporting" | "minor";
  gender?: "male" | "female" | "other";
  appearance?: string;
  personality?: string;
  traits?: string[];
  /** 命中现有角色资产时的 id（直接复用） */
  matchedCharacterId?: string;
  /** 命中现有角色资产时的描述（用于展示） */
  matchedCharacterDescription?: string;
  /** 命中的角色工厂中的 image url（用于在预览中显示） */
  matchedImageUrl?: string;
  /** 该角色出现在多少句对白中 */
  dialogueCount: number;
  /** 出现该角色的剧集号列表 */
  episodes: number[];
  /** 资产匹配状态：matched=已匹配 / will_create=将自动创建 / unresolved=未解析 */
  matchStatus: "matched" | "will_create" | "unresolved";
}

/** 场景资产 */
interface PreviewSceneAsset {
  location_name: string;
  time_of_day: string;
  atmosphere?: string;
  description?: string;
  visual_keywords?: string[];
  first_appearance?: string;
  /** 匹配到工厂场景时的 id */
  matchedSceneId?: string;
  matchedImageUrl?: string;
  matchStatus: "matched" | "will_create" | "unresolved";
}

/** 道具资产 */
interface PreviewPropAsset {
  name: string;
  category: string;
  description?: string;
  color?: string;
  material?: string;
  size?: string;
  owner?: string;
  first_appearance?: string;
  /** 匹配到工厂道具时的 id */
  matchedPropId?: string;
  matchedImageUrl?: string;
  matchStatus: "matched" | "will_create" | "unresolved";
}

interface PreviewResult {
  title: string;
  format: string;
  file_name: string;
  editor_json: any;
  episodes: PreviewEpisode[];
  /** 从对白中识别出的角色集合（去重） */
  characters: PreviewCharacter[];
  /** AI 提取的场景资产 */
  sceneAssets: PreviewSceneAsset[];
  /** AI 提取的道具资产 */
  propAssets: PreviewPropAsset[];
  /** 数据来源：ai=大模型 / local=本地正则 */
  source: "ai" | "local";
  /** AI 输出警告 */
  warnings?: string[];
}

/** 规范化时间段枚举 */
function normalizeTimeOfDay(value: string): "day" | "night" | "dawn" | "dusk" {
  const v = (value || "").toLowerCase();
  if (v.includes("夜") || v.includes("night")) return "night";
  if (v.includes("黄昏") || v.includes("傍晚") || v.includes("dusk")) return "dusk";
  if (v.includes("晨") || v.includes("黎明") || v.includes("dawn")) return "dawn";
  return "day";
}

/**
 * 从剧集中提取所有出现过的角色名（去重 + 统计次数 + 出现剧集）。
 * 跳过空名 / 包含标点的"伪角色"段落（如"场景"、"时间"等）。
 */
function extractCharactersFromEpisodes(episodes: PreviewEpisode[]): PreviewCharacter[] {
  const map = new Map<string, PreviewCharacter>();
  for (const ep of episodes) {
    for (const scene of ep.scenes) {
      for (const d of scene.dialogues) {
        const name = (d.character || "").trim();
        if (!name) continue;
        // 排除明显是元信息的伪角色
        const lower = name.toLowerCase();
        if (["地点", "时间", "场景", "集", "scene", "location", "time", "action", "动作", "对白", "dialogue"].includes(lower)) {
          continue;
        }
        // 名字太短（1 个字且不是常见中文名）或太长都可能是误识别
        if (name.length < 1 || name.length > 20) continue;
        const existing = map.get(name);
        if (existing) {
          existing.dialogueCount += 1;
          if (!existing.episodes.includes(ep.episode_no)) {
            existing.episodes.push(ep.episode_no);
          }
        } else {
          map.set(name, {
            name,
            dialogueCount: 1,
            episodes: [ep.episode_no],
            matchStatus: "unresolved",
          });
        }
      }
    }
  }
  // 排序：按出现次数降序
  return Array.from(map.values()).sort((a, b) => b.dialogueCount - a.dialogueCount);
}

/**
 * 调用后端 AI 剧本分析接口（POST /api/ai/script-analyze）
 * 返回 { source, characters, sceneAssets, propAssets, episodes, warnings }
 *
 * 失败或超时（>50s）时返回 null，调用方自动回退本地正则
 */
async function aiAnalyzeScript(
  content: string,
  format: string
): Promise<{
  source: "ai" | "local";
  characters: PreviewCharacter[];
  sceneAssets: PreviewSceneAsset[];
  propAssets: PreviewPropAsset[];
  episodes: PreviewEpisode[];
  warnings: string[];
} | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 50_000);
    const resp = await fetch("/api/ai/script-analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, format }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!resp.ok) {
      console.warn(`AI 分析失败 HTTP ${resp.status}`);
      return null;
    }
    const json = await resp.json();
    const payload = json?.data?.data ?? json?.data;
    if (!payload || !payload.success) {
      console.warn("AI 分析返回不成功：", json);
      return null;
    }
    const aiData = payload.data;

    // 转换 AI 输出为 PreviewResult 友好结构
    const characters: PreviewCharacter[] = (aiData.characters || []).map((c: any) => ({
      name: String(c.name || "").trim(),
      description: c.description,
      role: c.role,
      gender: c.gender,
      appearance: c.appearance,
      personality: c.personality,
      traits: c.traits,
      dialogueCount: Number(c.dialogue_count) || 0,
      episodes: [],
      matchStatus: "unresolved" as const,
    }));

    const sceneAssets: PreviewSceneAsset[] = (aiData.scenes || []).map((s: any) => ({
      location_name: String(s.location_name || "").trim(),
      time_of_day: String(s.time_of_day || "day"),
      atmosphere: s.atmosphere,
      description: s.description,
      visual_keywords: s.visual_keywords,
      first_appearance: s.first_appearance,
      matchStatus: "unresolved" as const,
    }));

    const propAssets: PreviewPropAsset[] = (aiData.props || []).map((p: any) => ({
      name: String(p.name || "").trim(),
      category: String(p.category || "other"),
      description: p.description,
      color: p.color,
      material: p.material,
      size: p.size,
      owner: p.owner,
      first_appearance: p.first_appearance,
      matchStatus: "unresolved" as const,
    }));

    const episodes: PreviewEpisode[] = (aiData.episodes || []).map((e: any) => ({
      episode_no: Number(e.episode_no) || 1,
      title: String(e.title || "").trim() || `第${e.episode_no}集`,
      synopsis: String(e.synopsis || "").trim(),
      status: "draft",
      scenes: (e.scenes || []).map((s: any) => ({
        scene_no: Number(s.scene_no) || 1,
        location_name: String(s.location_name || "").trim(),
        time_of_day: String(s.time_of_day || "day"),
        description: String(s.description || "").trim(),
        dialogues: (s.dialogues || []).map((d: any, idx: number) => ({
          character: String(d.character || "").trim(),
          text: String(d.text || "").trim(),
          emotion: String(d.emotion || "").trim(),
          order: idx,
        })),
      })),
    }));

    return {
      source: aiData.source === "ai" ? "ai" : "local",
      characters,
      sceneAssets,
      propAssets,
      episodes,
      warnings: aiData.warnings || [],
    };
  } catch (err) {
    console.warn("AI 剧本分析异常:", err);
    return null;
  }
}

/**
 * 把 AI 返回的 episodes 数组转成 Tiptap editor_json。
 * 保留剧集-场景-对白三段式结构，方便剧本编辑器加载后还原。
 */
function aiEpisodesToEditorJson(episodes: PreviewEpisode[]): any {
  const doc: any = { type: "doc", content: [] };
  for (const ep of episodes) {
    // 剧集节点
    const epContent: any[] = [];
    if (ep.synopsis) {
      epContent.push({
        type: "paragraph",
        content: [{ type: "text", text: `【简介】${ep.synopsis}`, marks: [{ type: "italic" }] }],
      });
    }
    for (const scene of ep.scenes) {
      // 场景标题
      const scHeader = `景${scene.scene_no} · ${scene.location_name || "未命名地点"}${
        scene.time_of_day ? " · " + scene.time_of_day : ""
      }`;
      epContent.push({
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: scHeader }],
      });
      if (scene.description) {
        epContent.push({
          type: "paragraph",
          content: [{ type: "text", text: scene.description }],
        });
      }
      for (const d of scene.dialogues) {
        // 对白节点
        const dContent: any[] = [];
        const label = d.character || "未知角色";
        if (d.emotion) {
          dContent.push({
            type: "text",
            text: `${label}（${d.emotion}）：${d.text}`,
            marks: [{ type: "bold" }],
          });
        } else {
          dContent.push({
            type: "text",
            text: `${label}：${d.text}`,
            marks: [{ type: "bold" }],
          });
        }
        epContent.push({ type: "paragraph", content: dContent });
      }
    }
    doc.content.push({
      type: "heading",
      attrs: { level: 1 },
      content: [{ type: "text", text: `第${ep.episode_no}集 · ${ep.title}` }],
    });
    doc.content.push(...epContent);
  }
  if (doc.content.length === 0) doc.content.push({ type: "paragraph" });
  return doc;
}

/** 解析场景标题，拆出 location / time */
function parseSceneHeader(header: string): {
  location: string;
  time: string;
  description: string;
} {
  const cleaned = header
    .replace(/^Scene\s*\d+\s*/i, "")
    .replace(/^场景\s*\d+\s*/i, "")
    .trim();
  const parts = cleaned.split(/\s*[-/｜|]\s*/).filter((p) => p);
  if (parts.length >= 2) {
    return {
      location: parts[0] || "",
      time: parts[parts.length - 1] || "day",
      description: parts.length > 2 ? parts.slice(1, -1).join(" ") : "",
    };
  }
  if (parts.length === 1) return { location: parts[0] || "", time: "day", description: "" };
  return { location: "", time: "day", description: "" };
}

/** 解析对白行 */
function parseDialogueLine(line: string): PreviewDialogue | null {
  const m1 = line.match(/^\*\*([^*]+)\*\*[（(]([^）)]+)[）)]\s*[：:]\s*(.+)$/);
  if (m1) {
    return {
      character: m1[1].trim(),
      emotion: m1[2].trim(),
      text: m1[3].trim(),
      order: 0,
    };
  }
  const m2 = line.match(/^\*\*([^*]+)\*\*\s*[：:]\s*(.+)$/);
  if (m2) {
    return {
      character: m2[1].trim(),
      emotion: "",
      text: m2[2].trim(),
      order: 0,
    };
  }
  const m3 = line.match(/^([^：:\n]{1,20})\s*[：:]\s*(.+)$/);
  if (m3 && !/^[\s*>-]/.test(line)) {
    const name = m3[1].trim();
    if (
      !["地点", "时间", "场景", "集", "scene", "location", "time"].includes(
        name.toLowerCase()
      )
    ) {
      return {
        character: name,
        emotion: "",
        text: m3[2].trim(),
        order: 0,
      };
    }
  }
  return null;
}

/** 从 Markdown 解析为剧集结构（与后端 splitTextIntoEpisodes 保持一致） */
function parseMarkdownToEpisodes(text: string): PreviewEpisode[] {
  if (!text || text.trim().length === 0) {
    return [
      { episode_no: 1, title: "导入剧集", synopsis: "", status: "draft", scenes: [] },
    ];
  }
  const h1Chunks = text.split(/\n(?=#\s+)/);
  if (h1Chunks.length > 1) {
    return h1Chunks.map((chunk, idx) => parseEpisodeMarkdown(idx + 1, chunk));
  }
  const h2Chunks = text.split(/\n(?=##\s+)/);
  if (h2Chunks.length > 1) {
    return h2Chunks.map((chunk, idx) => {
      const lines = chunk.split("\n");
      const title = lines[0].replace(/^##\s+/, "").trim();
      return parseEpisodeMarkdown(
        idx + 1,
        `# ${title}\n${lines.slice(1).join("\n")}`
      );
    });
  }
  // 兜底：按 2000 字/集 自动分集
  const paragraphs = text.split(/\n+/).filter((p) => p.trim());
  if (paragraphs.length === 0) {
    return [
      { episode_no: 1, title: "导入剧集", synopsis: "", status: "draft", scenes: [] },
    ];
  }
  const CHARS_PER_EP = 2000;
  const PARAS_PER_EP = 30;
  const episodes: PreviewEpisode[] = [];
  let buffer: string[] = [];
  let charCount = 0;
  for (const p of paragraphs) {
    buffer.push(p);
    charCount += p.length;
    if (buffer.length >= PARAS_PER_EP || charCount >= CHARS_PER_EP) {
      episodes.push({
        episode_no: episodes.length + 1,
        title: `第${episodes.length + 1}集`,
        synopsis: buffer.join(" ").slice(0, 300),
        status: "draft",
        scenes: parseScenesFromParagraphs(buffer),
      });
      buffer = [];
      charCount = 0;
    }
  }
  if (buffer.length > 0) {
    episodes.push({
      episode_no: episodes.length + 1,
      title: `第${episodes.length + 1}集`,
      synopsis: buffer.join(" ").slice(0, 300),
      status: "draft",
      scenes: parseScenesFromParagraphs(buffer),
    });
  }
  return episodes;
}

function parseEpisodeMarkdown(episodeNo: number, block: string): PreviewEpisode {
  const lines = block.split("\n");
  const title = (lines[0] || "").replace(/^#\s+/, "").trim();
  const rest = lines.slice(1).join("\n").trim();
  const sceneChunks = rest.split(/\n(?=##\s+)/);
  const synopsisBefore = sceneChunks[0] || "";
  const synopsis = synopsisBefore
    .split("\n")
    .filter((l) => !/^##\s+/.test(l))
    .join(" ")
    .trim()
    .slice(0, 300);
  const sceneBlocks = sceneChunks.filter((c) => /^##\s+/.test(c));
  const scenes: PreviewScene[] = sceneBlocks.map((sb, idx) =>
    parseSceneMarkdown(idx + 1, sb)
  );
  return {
    episode_no: episodeNo,
    title: title || `第${episodeNo}集`,
    synopsis,
    status: "draft",
    scenes,
  };
}

function parseSceneMarkdown(sceneNo: number, block: string): PreviewScene {
  const lines = block.split("\n");
  const header = (lines[0] || "").replace(/^##\s+/, "").trim();
  const { location, time, description: headerDesc } = parseSceneHeader(header);
  const body = lines.slice(1).join("\n").trim();
  const fullDescription = [headerDesc, body].filter((s) => s).join("\n").trim();
  const dialogues: PreviewDialogue[] = [];
  for (const line of fullDescription.split(/\n+/)) {
    const trimmed = line
      .trim()
      .replace(/^>\s*/, "")
      .replace(/^[-*]\s+/, "");
    if (!trimmed) continue;
    const d = parseDialogueLine(trimmed);
    if (d) {
      d.order = dialogues.length;
      dialogues.push(d);
    }
  }
  return {
    scene_no: sceneNo,
    location_name: location,
    time_of_day: normalizeTimeOfDay(time),
    description: fullDescription,
    dialogues,
  };
}

function parseScenesFromParagraphs(paragraphs: string[]): PreviewScene[] {
  if (paragraphs.length === 0) return [];
  const text = paragraphs.join("\n");
  const dialogues: PreviewDialogue[] = [];
  for (const line of text.split(/\n+/)) {
    const trimmed = line
      .trim()
      .replace(/^>\s*/, "")
      .replace(/^[-*]\s+/, "");
    if (!trimmed) continue;
    const d = parseDialogueLine(trimmed);
    if (d) {
      d.order = dialogues.length;
      dialogues.push(d);
    }
  }
  return [
    {
      scene_no: 1,
      location_name: "",
      time_of_day: "day",
      description: text,
      dialogues,
    },
  ];
}

/** 将纯文本转换为 Tiptap doc JSON（按行拆分为段落） */
function textToEditorJson(text: string): any {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const content = lines.length > 0
    ? lines.map((line) => ({
        type: "paragraph",
        content: [{ type: "text", text: line }],
      }))
    : [{ type: "paragraph" }];
  return { type: "doc", content };
}

/** 将 Markdown 转换为 Tiptap doc JSON（简单解析标题和段落） */
function markdownToEditorJson(md: string): any {
  const lines = md.split(/\r?\n/);
  const content: any[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const h1 = line.match(/^#\s+(.+)$/);
    const h2 = line.match(/^##\s+(.+)$/);
    const h3 = line.match(/^###\s+(.+)$/);
    if (h1) {
      content.push({ type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: h1[1] }] });
    } else if (h2) {
      content.push({ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: h2[1] }] });
    } else if (h3) {
      content.push({ type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: h3[1] }] });
    } else {
      content.push({ type: "paragraph", content: [{ type: "text", text: line }] });
    }
  }
  return { type: "doc", content: content.length > 0 ? content : [{ type: "paragraph" }] };
}

/** 支持的导入格式 */
const IMPORT_FORMATS: Array<{ value: ImportFormat; label: string; icon: typeof FileText; accept: string }> = [
  { value: "txt", label: "TXT 纯文本", icon: FileText, accept: ".txt" },
  { value: "markdown", label: "Markdown", icon: FileType, accept: ".md,.markdown" },
  { value: "fountain", label: "Fountain 剧本", icon: FileCode, accept: ".fountain,.fountain.txt" },
  { value: "json", label: "JSON 数据", icon: FileJson, accept: ".json" },
  { value: "fdx", label: "Final Draft (FDX)", icon: FileCode, accept: ".fdx" },
];

export function ScriptImportDialog({
  isOpen,
  onClose,
  projectId,
  onImported,
}: {
  isOpen: boolean;
  onClose: () => void;
  projectId: string | null;
  onImported: () => void | Promise<void>;
}) {
  // 导入状态
  const [importFormat, setImportFormat] = useState<ImportFormat>("txt");
  const [importText, setImportText] = useState("");
  const [importFileName, setImportFileName] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [isAnalyzingScript, setIsAnalyzingScript] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState("");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // 处理文件选择
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setImportText(text);
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (ext === "md" || ext === "markdown") setImportFormat("markdown");
      else if (ext === "fountain") setImportFormat("fountain");
      else if (ext === "json") setImportFormat("json");
      else if (ext === "fdx") setImportFormat("fdx");
      else setImportFormat("txt");
    };
    reader.readAsText(file);
  };

  /**
   * 解析剧本内容，生成预览（不写入数据库）。
   * 对齐需求文档 Feature 4.5 流程：解析 → 预览展示 → 用户确认。
   */
  const handleParsePreview = async () => {
    if (!importText.trim()) {
      alert("请输入或上传剧本内容");
      return;
    }

    setIsAnalyzingScript(true);
    setAnalysisStatus("正在调用大模型分析剧本...");

    let title = importFileName || `导入剧本 ${new Date().toLocaleDateString()}`;
    let editorJson: any = textToEditorJson(importText);
    let episodes: PreviewEpisode[] = [];
    let sceneAssets: PreviewSceneAsset[] = [];
    let propAssets: PreviewPropAsset[] = [];
    let characters: PreviewCharacter[] = [];
    let source: "ai" | "local" = "local";
    let warnings: string[] = [];

    // 1) 优先调用 AI 分析（会同时拿到 characters/scenes/props/episodes）
    const aiResult = await aiAnalyzeScript(importText, importFormat);
    if (aiResult) {
      source = aiResult.source;
      characters = aiResult.characters;
      sceneAssets = aiResult.sceneAssets;
      propAssets = aiResult.propAssets;
      episodes = aiResult.episodes;
      warnings = aiResult.warnings;
      // 标题用 AI 提取的（如果有）
      if (aiResult.episodes[0]?.title) {
        title = aiResult.episodes[0].title;
      }
      // 用 AI 的 ep 数据生成 editor_json（保留对白）
      editorJson = aiEpisodesToEditorJson(episodes);
    } else {
      // 2) 兜底：本地正则解析
      setAnalysisStatus("AI 不可用，回退到本地解析...");
      switch (importFormat) {
        case "json": {
          try {
            const data = JSON.parse(importText);
            title = data.title || data.name || data.document?.title || title;
            if (data.editor_json) {
              editorJson = typeof data.editor_json === "string"
                ? JSON.parse(data.editor_json)
                : data.editor_json;
            } else if (data.document?.editor_json) {
              editorJson = typeof data.document.editor_json === "string"
                ? JSON.parse(data.document.editor_json)
                : data.document.editor_json;
            } else {
              editorJson = textToEditorJson(data.description || data.content || importText);
            }
            if (Array.isArray(data.episodes)) {
              episodes = data.episodes.map((ep: any, idx: number) => ({
                episode_no: ep.episode_no ?? ep.episodeNo ?? idx + 1,
                title: ep.title || `第${idx + 1}集`,
                synopsis: ep.synopsis || "",
                status: ep.status || "draft",
                scenes: Array.isArray(ep.scenes)
                  ? ep.scenes.map((s: any, sIdx: number) => ({
                      scene_no: s.scene_no ?? sIdx + 1,
                      location_name: s.location_name || s.location || "",
                      time_of_day: normalizeTimeOfDay(s.time_of_day || s.time || "day"),
                      description: s.description || "",
                      dialogues: Array.isArray(s.dialogues)
                        ? s.dialogues.map((d: any, dIdx: number) => ({
                            character: d.character || "",
                            text: d.text || "",
                            emotion: d.emotion || "",
                            order: d.order ?? dIdx,
                          }))
                        : [],
                    }))
                  : [],
              }));
            }
          } catch {
            episodes = [];
          }
          break;
        }
        case "fountain": {
          const parsed = parseFountain(importText);
          title = parsed.title || title;
          editorJson = textToEditorJson(parsed.content);
          episodes = parseMarkdownToEpisodes(parsed.content);
          break;
        }
        case "fdx": {
          const parsed = parseFDX(importText);
          title = parsed.title || title;
          editorJson = textToEditorJson(parsed.content);
          episodes = parseMarkdownToEpisodes(parsed.content);
          break;
        }
        case "markdown": {
          const titleMatch = importText.match(/^#\s+(.+)$/m);
          if (titleMatch) title = titleMatch[1];
          editorJson = markdownToEditorJson(importText);
          episodes = parseMarkdownToEpisodes(importText);
          break;
        }
        default: {
          editorJson = textToEditorJson(importText);
          episodes = parseMarkdownToEpisodes(importText);
          break;
        }
      }
      // 本地路径：从剧集里提取角色
      characters = extractCharactersFromEpisodes(episodes);
    }

    // 兜底：若没有解析到剧集，则默认生成 1 集
    if (episodes.length === 0) {
      episodes = [
        { episode_no: 1, title, synopsis: "", status: "draft", scenes: [] },
      ];
    }

    setIsAnalyzingScript(false);
    setAnalysisStatus("");

    setPreview({
      title,
      format: importFormat,
      file_name: importFileName,
      editor_json: editorJson,
      episodes,
      characters,
      sceneAssets,
      propAssets,
      source,
      warnings: warnings.length ? warnings : undefined,
    });
    setShowPreview(true);

    // 异步查现有角色做资产匹配
    void matchCharactersWithFactory(projectId, characters);
    // 异步匹配场景/道具
    void matchScenesAndPropsWithFactory(projectId, sceneAssets, propAssets);
  };

  /**
   * 把解析出的角色名与角色工厂已有资产做匹配。
   * - 命中：填 matchedCharacterId / matchedImageUrl，matchStatus=matched
   * - 未命中：matchStatus=will_create（导入时自动创建新角色）
   */
  const matchCharactersWithFactory = async (
    projId: string | null,
    chars: PreviewCharacter[]
  ) => {
    if (!projId || chars.length === 0) return;
    try {
      const existing = (await listCharacters(projId)) as Array<{
        id: string;
        name: string;
        description?: string;
        image_url?: string;
        image?: string;
      }>;
      const byName = new Map(
        existing
          .filter((c) => c && c.name)
          .map((c) => [String(c.name).trim().toLowerCase(), c])
      );
      setPreview((prev) => {
        if (!prev) return prev;
        const updated = prev.characters.map((c) => {
          const hit = byName.get(c.name.trim().toLowerCase());
          if (hit) {
            return {
              ...c,
              matchedCharacterId: hit.id,
              matchedCharacterDescription: hit.description,
              matchedImageUrl: hit.image_url || hit.image,
              matchStatus: "matched" as const,
            };
          }
          return { ...c, matchStatus: "will_create" as const };
        });
        return { ...prev, characters: updated };
      });
    } catch (err) {
      console.warn("角色资产匹配失败：", err);
      // 匹配失败时不影响主流程，全部标记为 will_create
      setPreview((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          characters: prev.characters.map((c) => ({ ...c, matchStatus: "will_create" as const })),
        };
      });
    }
  };

  /**
   * 把解析出的场景/道具资产与工厂已有资产做匹配。
   * - 命中：填 matchedId / matchedImageUrl，matchStatus=matched
   * - 未命中：matchStatus=will_create（导入时自动创建）
   */
  const matchScenesAndPropsWithFactory = async (
    projId: string | null,
    sceneAssets: PreviewSceneAsset[],
    propAssets: PreviewPropAsset[]
  ) => {
    if (!projId) return;
    try {
      const [existingScenes, existingProps] = await Promise.all([
        (listScenes(projId) as any) as Promise<
          Array<{
            id: string;
            name?: string;
            location_name?: string;
            image_url?: string;
            image?: string;
          }>
        >,
        (listProps(projId) as any) as Promise<
          Array<{ id: string; name: string; image_url?: string; image?: string }>
        >,
      ]);

      const sceneByKey = new Map<string, any>();
      for (const s of existingScenes || []) {
        if (!s) continue;
        const key = `${s.location_name || s.name || ""}`.trim().toLowerCase();
        if (key) sceneByKey.set(key, s);
      }
      const propByKey = new Map<string, any>();
      for (const p of existingProps || []) {
        if (!p || !p.name) continue;
        propByKey.set(p.name.trim().toLowerCase(), p);
      }

      setPreview((prev) => {
        if (!prev) return prev;
        const updatedScenes = prev.sceneAssets.map((s) => {
          const key = (s.location_name || "").trim().toLowerCase();
          const hit = sceneByKey.get(key);
          if (hit) {
            return {
              ...s,
              matchedSceneId: hit.id,
              matchedImageUrl: hit.image_url || hit.image,
              matchStatus: "matched" as const,
            };
          }
          return { ...s, matchStatus: "will_create" as const };
        });
        const updatedProps = prev.propAssets.map((p) => {
          const key = (p.name || "").trim().toLowerCase();
          const hit = propByKey.get(key);
          if (hit) {
            return {
              ...p,
              matchedPropId: hit.id,
              matchedImageUrl: hit.image_url || hit.image,
              matchStatus: "matched" as const,
            };
          }
          return { ...p, matchStatus: "will_create" as const };
        });
        return { ...prev, sceneAssets: updatedScenes, propAssets: updatedProps };
      });
    } catch (err) {
      console.warn("场景/道具资产匹配失败：", err);
      setPreview((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          sceneAssets: prev.sceneAssets.map((s) => ({ ...s, matchStatus: "will_create" as const })),
          propAssets: prev.propAssets.map((p) => ({ ...p, matchStatus: "will_create" as const })),
        };
      });
    }
  };

  /**
   * 确认导入：走新接口（plan B 路线）
   *
   * 步骤：
   * 1. POST /api/projects/:id/scripts        —— 创建基础剧本记录
   * 2. POST /api/script-documents            —— 创建富文本文档（editor_json）
   * 3. 对未匹配角色自动调用 createCharacter 建资产
   * 4. 对未匹配场景自动调用 createScene 建资产
   * 5. 对未匹配道具自动调用 createProp 建资产
   * 6. 逐条 POST episode → scene → dialogue
   */
  const handleConfirmImport = async () => {
    if (!preview) return;
    if (!projectId) {
      alert("请先选择一个项目");
      return;
    }
    setIsImporting(true);
    try {
      // 1. 创建基础剧本记录
      const script = await createScript(projectId, {
        title: preview.title,
        description: preview.editor_json
          ? `由 ${preview.format.toUpperCase()} 导入 · ${preview.file_name || "粘贴内容"}`
          : `由 ${preview.format.toUpperCase()} 导入`,
        author: "当前用户",
        status: "draft",
      } as any);
      const scriptId = (script as any).id;
      const documentId = (script as any).document_id || scriptId;

      // 2. 创建剧本文档（写入 Tiptap editor_json）
      try {
        await createScriptDocumentApi({
          project_id: projectId,
          editor_json: JSON.stringify(preview.editor_json),
          version: 1,
        });
      } catch (err) {
        // ScriptDocument 是辅助表，失败不阻塞主流程
        console.warn("创建剧本文档失败（不阻塞导入）：", err);
      }

      // 3. 处理未匹配角色：自动创建
      const charIdMap = new Map<string, string>();
      for (const pc of preview.characters) {
        if (pc.matchedCharacterId) {
          charIdMap.set(pc.name, pc.matchedCharacterId);
          continue;
        }
        if (pc.matchStatus === "unresolved") {
          // 匹配未完成的，按"将创建"处理
        }
        try {
          const created = await createCharacter({
            project_id: projectId,
            name: pc.name,
            description: `从剧本《${preview.title}》自动导入 · 出现于 ${pc.dialogueCount} 句对白`,
            tags: ["从剧本导入"],
          } as any);
          charIdMap.set(pc.name, (created as any).id);
        } catch (err) {
          console.warn(`创建角色 ${pc.name} 失败：`, err);
        }
      }

      // 3.5 处理未匹配场景：自动创建到场景工厂
      const sceneIdMap = new Map<string, string>();
      for (const sa of preview.sceneAssets) {
        if (sa.matchedSceneId) {
          sceneIdMap.set(sa.location_name, sa.matchedSceneId);
          continue;
        }
        try {
          const created = await createScene({
            project_id: projectId,
            name: sa.location_name || "未命名场景",
            location_name: sa.location_name || "未命名场景",
            time_of_day: (sa.time_of_day as any) || "day",
            atmosphere: sa.atmosphere || "",
            description: sa.description || "",
            tags: sa.visual_keywords || ["从剧本导入"],
          } as any);
          sceneIdMap.set(sa.location_name, (created as any).id);
        } catch (err) {
          console.warn(`创建场景 ${sa.location_name} 失败：`, err);
        }
      }

      // 3.6 处理未匹配道具：自动创建到道具工厂
      const propIdMap = new Map<string, string>();
      for (const pa of preview.propAssets) {
        if (pa.matchedPropId) {
          propIdMap.set(pa.name, pa.matchedPropId);
          continue;
        }
        try {
          const created = await createProp({
            project_id: projectId,
            name: pa.name,
            category: (pa.category as any) || "other",
            description: pa.description || "",
            color: pa.color || "",
            material: pa.material || "",
            size: pa.size || "",
            owner: pa.owner || "",
            tags: ["从剧本导入"],
          } as any);
          propIdMap.set(pa.name, (created as any).id);
        } catch (err) {
          console.warn(`创建道具 ${pa.name} 失败：`, err);
        }
      }

      // 4. 逐条写入 episode → scene → dialogue
      for (const ep of preview.episodes) {
        const epResp = await createScriptEpisodeApi({
          project_id: projectId,
          document_id: documentId,
          episode_no: ep.episode_no,
          title: ep.title,
          synopsis: ep.synopsis || "",
          status: (ep.status as any) || "draft",
        });
        const episodeId = (epResp as any).id;

        for (const scene of ep.scenes) {
          const scResp = await createScriptSceneApi({
            project_id: projectId,
            episode_id: episodeId,
            scene_no: scene.scene_no,
            location_name: scene.location_name || "",
            time_of_day: (scene.time_of_day as any) || "day",
            description: scene.description || "",
            notes: "",
          });
          const sceneId = (scResp as any).id;

          for (const d of scene.dialogues) {
            const characterId = charIdMap.get(d.character);
            if (!characterId) continue; // 跳过没有 character_id 的对白（不阻塞）
            try {
              await createScriptDialogueApi({
                project_id: projectId,
                scene_id: sceneId,
                character_id: characterId,
                dialogue: d.text || "",
                emotion: d.emotion || "",
                order: d.order ?? 0,
              });
            } catch (err) {
              console.warn(`对白写入失败 (${d.character})：`, err);
            }
          }
        }
      }

      setShowPreview(false);
      setPreview(null);
      onClose();
      setImportText("");
      setImportFileName("");
      await onImported();
    } catch (err) {
      console.error("导入失败:", err);
      alert(
        "导入失败，请检查内容格式是否正确：" +
          (err instanceof Error ? err.message : "未知错误")
      );
    } finally {
      setIsImporting(false);
    }
  };

  /**
   * 取消预览，返回编辑
   */
  const handleCancelPreview = () => {
    setShowPreview(false);
    setPreview(null);
  };

  return (
    <DialogOverlay title="导入剧本" onClose={onClose} wide>
      <div className="space-y-4">
        <div className="text-sm text-[#888]">
          支持导入多种格式的剧本文件：TXT纯文本、Markdown、Fountain剧本格式、JSON数据、Final Draft (FDX)。
        </div>

        {/* 格式选择 */}
        <div>
          <div className="text-xs text-[#888] mb-2">选择导入格式</div>
          <div className="flex flex-wrap gap-2">
            {IMPORT_FORMATS.map((fmt) => {
              const Icon = fmt.icon;
              return (
                <button
                  key={fmt.value}
                  onClick={() => setImportFormat(fmt.value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                    importFormat === fmt.value
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50"
                      : "bg-white/5 text-[#888] border border-white/10 hover:bg-white/10"
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  {fmt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 文件上传 */}
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept={IMPORT_FORMATS.find((f) => f.value === importFormat)?.accept}
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="mr-2 h-4 w-4" />
            选择文件
          </Button>
          {importFileName && (
            <span className="ml-3 text-sm text-emerald-400">
              已选择: {importFileName}
            </span>
          )}
        </div>

        {/* 内容输入 */}
        <div>
          <div className="text-xs text-[#888] mb-2">
            或直接粘贴{IMPORT_FORMATS.find((f) => f.value === importFormat)?.label}内容
          </div>
          <textarea
            className="w-full h-48 p-3 rounded-lg bg-[#1a1a1a] border border-white/10 text-sm text-white resize-none focus:outline-none focus:border-emerald-500/50"
            placeholder={getImportPlaceholder(importFormat)}
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
          />
        </div>

        {/* 字数统计 */}
        {importText && (
          <div className="text-xs text-[#888]">
            当前内容字数: <span className="text-emerald-400">{importText.replace(/\s/g, "").length.toLocaleString()}</span> 字
          </div>
        )}

        <div className="flex justify-end gap-2 items-center">
          {analysisStatus && (
            <span className="text-xs text-purple-300 mr-auto flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              {analysisStatus}
            </span>
          )}
          <Button variant="ghost" size="sm" onClick={onClose}>
            取消
          </Button>
          <Button
            size="sm"
            onClick={handleParsePreview}
            disabled={!importText.trim() || isAnalyzingScript}
          >
            {isAnalyzingScript ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                AI 分析中...
              </>
            ) : (
              <>
                <Eye className="mr-2 h-4 w-4" />
                解析预览（AI 优先）
              </>
            )}
          </Button>
        </div>
      </div>

      {/* 预览弹窗（Feature 4.5：解析预览 → 用户确认 → 写入） */}
      {showPreview && preview && (
        <PreviewDialog
          preview={preview}
          isImporting={isImporting}
          onConfirm={handleConfirmImport}
          onCancel={handleCancelPreview}
        />
      )}
    </DialogOverlay>
  );
}

/**
 * 导入预览弹窗
 * 展示解析结果：剧集列表、每个剧集下的场景、每个场景下的对白
 * 用户确认后调用后端接口写入数据库
 */
function PreviewDialog({
  preview,
  isImporting,
  onConfirm,
  onCancel,
}: {
  preview: PreviewResult;
  isImporting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [expandedEpisodes, setExpandedEpisodes] = useState<Set<string>>(new Set());
  const [expandedScenes, setExpandedScenes] = useState<Set<string>>(new Set());
  const [showCharacters, setShowCharacters] = useState<boolean>(true);
  const [showSceneAssets, setShowSceneAssets] = useState<boolean>(true);
  const [showPropAssets, setShowPropAssets] = useState<boolean>(true);

  const toggleEpisode = (id: string) => {
    setExpandedEpisodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleScene = (id: string) => {
    setExpandedScenes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const stats = useMemo(() => {
    const totalScenes = preview.episodes.reduce((s, ep) => s + ep.scenes.length, 0);
    const totalDialogues = preview.episodes.reduce(
      (s, ep) => s + ep.scenes.reduce((s2, sc) => s2 + sc.dialogues.length, 0),
      0
    );
    const matched = preview.characters.filter((c) => c.matchStatus === "matched").length;
    const willCreate = preview.characters.filter((c) => c.matchStatus === "will_create").length;
    const unresolved = preview.characters.filter((c) => c.matchStatus === "unresolved").length;
    const scenesMatched = preview.sceneAssets.filter((s) => s.matchStatus === "matched").length;
    const scenesWillCreate = preview.sceneAssets.filter((s) => s.matchStatus === "will_create").length;
    const propsMatched = preview.propAssets.filter((p) => p.matchStatus === "matched").length;
    const propsWillCreate = preview.propAssets.filter((p) => p.matchStatus === "will_create").length;
    return {
      episodes: preview.episodes.length,
      scenes: totalScenes,
      dialogues: totalDialogues,
      characters: preview.characters.length,
      matched,
      willCreate,
      unresolved,
      sceneAssetsCount: preview.sceneAssets.length,
      propAssetsCount: preview.propAssets.length,
      scenesMatched,
      scenesWillCreate,
      propsMatched,
      propsWillCreate,
    };
  }, [preview]);

  const sourceBadge =
    preview.source === "ai"
      ? { label: "AI 大模型", color: "bg-purple-500/20 text-purple-300 border-purple-500/40" }
      : { label: "本地正则", color: "bg-amber-500/20 text-amber-300 border-amber-500/40" };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <div className="w-[1100px] max-w-[95vw] max-h-[90vh] bg-[#1a1a1a] rounded-xl border border-white/10 shadow-2xl flex flex-col overflow-hidden">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-[#252525]">
          <div className="flex items-center gap-3">
            <div>
              <div className="text-sm font-medium text-white flex items-center gap-2">
                <Eye className="h-4 w-4 text-emerald-400" />
                导入预览 · {preview.title}
              </div>
              <div className="text-xs text-[#888] mt-1">
                请确认解析结果。点击「确认导入」将写入数据库。
              </div>
            </div>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full border ${sourceBadge.color}`}
            >
              {sourceBadge.label}
            </span>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 统计信息 */}
        <div className="px-4 py-2 border-b border-white/10 bg-[#1f1f1f] flex items-center gap-4 text-xs flex-wrap">
          <span className="text-[#888]">
            格式: <span className="text-white">{preview.format.toUpperCase()}</span>
          </span>
          <span className="text-[#888]">
            剧集: <span className="text-emerald-400">{stats.episodes}</span>
          </span>
          <span className="text-[#888]">
            场景: <span className="text-emerald-400">{stats.scenes}</span>
          </span>
          <span className="text-[#888]">
            对白: <span className="text-emerald-400">{stats.dialogues}</span>
          </span>
          <span className="text-[#888]">
            角色: <span className="text-emerald-400">{stats.characters}</span>
            {stats.characters > 0 && (
              <span className="ml-1">
                <span className="text-green-400">✓{stats.matched}</span>
                {" / "}
                <span className="text-blue-400">+{stats.willCreate}</span>
                {stats.unresolved > 0 && (
                  <>
                    {" / "}
                    <span className="text-gray-500">?{stats.unresolved}</span>
                  </>
                )}
              </span>
            )}
          </span>
          {preview.episodes.length === 0 && (
            <span className="text-yellow-400">⚠ 未识别到剧集</span>
          )}
        </div>

        {/* 角色资产匹配区（Feature 4.5 资产匹配） */}
        {preview.characters.length > 0 && (
          <div className="border-b border-white/10 bg-[#1a1a1a]">
            <button
              type="button"
              onClick={() => setShowCharacters((v) => !v)}
              className="w-full flex items-center gap-2 px-4 py-2 hover:bg-white/5 transition-colors text-left"
            >
              {showCharacters ? (
                <ChevronDown className="h-3 w-3 text-gray-500" />
              ) : (
                <ChevronRight className="h-3 w-3 text-gray-500" />
              )}
              <span className="text-xs font-medium text-white">🎭 角色与资产匹配</span>
              <span className="text-xs text-[#888] ml-auto">
                <span className="text-green-400">{stats.matched} 已匹配</span>
                {" · "}
                <span className="text-blue-400">{stats.willCreate} 将自动创建</span>
                {stats.unresolved > 0 && (
                  <>
                    {" · "}
                    <span className="text-gray-500">{stats.unresolved} 匹配中…</span>
                  </>
                )}
              </span>
            </button>
            {showCharacters && (
              <div className="px-4 pb-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {preview.characters.map((c) => {
                  const badge =
                    c.matchStatus === "matched"
                      ? { color: "green", icon: "✓", text: "已匹配" }
                      : c.matchStatus === "will_create"
                      ? { color: "blue", icon: "+", text: "将创建" }
                      : { color: "gray", icon: "?", text: "匹配中" };
                  return (
                    <div
                      key={c.name}
                      className="flex items-center gap-2 p-2 rounded border border-white/10 bg-[#1f1f1f]"
                    >
                      {/* 角色头像（命中时显示资产图，未命中时显示首字占位） */}
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-white/5 flex items-center justify-center flex-shrink-0">
                        {c.matchedImageUrl ? (
                          <img
                            src={c.matchedImageUrl}
                            alt={c.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-xs text-emerald-400 font-medium">
                            {c.name.slice(0, 1)}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="text-sm text-white truncate">{c.name}</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                              badge.color === "green"
                                ? "bg-green-500/20 text-green-400"
                                : badge.color === "blue"
                                ? "bg-blue-500/20 text-blue-400"
                                : "bg-white/5 text-gray-500"
                            }`}
                          >
                            {badge.icon} {badge.text}
                          </span>
                        </div>
                        <div className="text-[10px] text-[#888] truncate">
                          {c.dialogueCount} 句对白
                          {c.episodes.length > 0 && ` · 第${c.episodes.slice(0, 3).join("/")}集${c.episodes.length > 3 ? "..." : ""}`}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 场景资产匹配区 */}
        {preview.sceneAssets.length > 0 && (
          <div className="border-b border-white/10 bg-[#1a1a1a]">
            <button
              type="button"
              onClick={() => setShowSceneAssets((v) => !v)}
              className="w-full flex items-center gap-2 px-4 py-2 hover:bg-white/5 transition-colors text-left"
            >
              {showSceneAssets ? (
                <ChevronDown className="h-3 w-3 text-gray-500" />
              ) : (
                <ChevronRight className="h-3 w-3 text-gray-500" />
              )}
              <span className="text-xs font-medium text-white">🏞️ 场景资产</span>
              <span className="text-xs text-[#888] ml-auto">
                <span className="text-green-400">{stats.scenesMatched} 已匹配</span>
                {" · "}
                <span className="text-blue-400">{stats.scenesWillCreate} 将自动创建</span>
                <span className="ml-1 text-[#666]">/ {stats.sceneAssetsCount} 个</span>
              </span>
            </button>
            {showSceneAssets && (
              <div className="px-4 pb-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {preview.sceneAssets.map((s, idx) => {
                  const badge =
                    s.matchStatus === "matched"
                      ? { color: "green", icon: "✓", text: "已匹配" }
                      : s.matchStatus === "will_create"
                      ? { color: "blue", icon: "+", text: "将创建" }
                      : { color: "gray", icon: "?", text: "匹配中" };
                  return (
                    <div
                      key={`sc-${idx}-${s.location_name}`}
                      className="rounded border border-white/10 bg-[#1f1f1f] overflow-hidden"
                    >
                      <div className="aspect-video bg-white/5 flex items-center justify-center overflow-hidden">
                        {s.matchedImageUrl ? (
                          <img
                            src={s.matchedImageUrl}
                            alt={s.location_name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-2xl text-emerald-400/40">🏞</span>
                        )}
                      </div>
                      <div className="p-2">
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-white truncate flex-1">
                            {s.location_name || "未命名场景"}
                          </span>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                              badge.color === "green"
                                ? "bg-green-500/20 text-green-400"
                                : badge.color === "blue"
                                ? "bg-blue-500/20 text-blue-400"
                                : "bg-white/5 text-gray-500"
                            }`}
                          >
                            {badge.icon} {badge.text}
                          </span>
                        </div>
                        <div className="text-[10px] text-[#888] mt-0.5 flex items-center gap-1 flex-wrap">
                          <span>{s.time_of_day}</span>
                          {s.atmosphere && <span>· {s.atmosphere}</span>}
                        </div>
                        {s.visual_keywords && s.visual_keywords.length > 0 && (
                          <div className="text-[10px] text-emerald-300/70 mt-1 truncate">
                            🏷 {s.visual_keywords.slice(0, 4).join(" · ")}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 道具资产匹配区 */}
        {preview.propAssets.length > 0 && (
          <div className="border-b border-white/10 bg-[#1a1a1a]">
            <button
              type="button"
              onClick={() => setShowPropAssets((v) => !v)}
              className="w-full flex items-center gap-2 px-4 py-2 hover:bg-white/5 transition-colors text-left"
            >
              {showPropAssets ? (
                <ChevronDown className="h-3 w-3 text-gray-500" />
              ) : (
                <ChevronRight className="h-3 w-3 text-gray-500" />
              )}
              <span className="text-xs font-medium text-white">🧸 道具资产</span>
              <span className="text-xs text-[#888] ml-auto">
                <span className="text-green-400">{stats.propsMatched} 已匹配</span>
                {" · "}
                <span className="text-blue-400">{stats.propsWillCreate} 将自动创建</span>
                <span className="ml-1 text-[#666]">/ {stats.propAssetsCount} 个</span>
              </span>
            </button>
            {showPropAssets && (
              <div className="px-4 pb-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                {preview.propAssets.map((p, idx) => {
                  const badge =
                    p.matchStatus === "matched"
                      ? { color: "green", icon: "✓", text: "已匹配" }
                      : p.matchStatus === "will_create"
                      ? { color: "blue", icon: "+", text: "将创建" }
                      : { color: "gray", icon: "?", text: "匹配中" };
                  return (
                    <div
                      key={`pr-${idx}-${p.name}`}
                      className="rounded border border-white/10 bg-[#1f1f1f] p-2"
                    >
                      <div className="flex items-center gap-1 mb-1">
                        <span className="text-xs text-white truncate flex-1">🧸 {p.name}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                            badge.color === "green"
                              ? "bg-green-500/20 text-green-400"
                              : badge.color === "blue"
                              ? "bg-blue-500/20 text-blue-400"
                              : "bg-white/5 text-gray-500"
                          }`}
                        >
                          {badge.icon} {badge.text}
                        </span>
                      </div>
                      <div className="text-[10px] text-[#888] flex flex-wrap gap-1">
                        <span className="px-1 py-0.5 rounded bg-white/5">{p.category}</span>
                        {p.color && <span className="px-1 py-0.5 rounded bg-white/5">🎨 {p.color}</span>}
                        {p.material && <span className="px-1 py-0.5 rounded bg-white/5">🪵 {p.material}</span>}
                        {p.size && <span className="px-1 py-0.5 rounded bg-white/5">📏 {p.size}</span>}
                      </div>
                      {p.owner && (
                        <div className="text-[10px] text-emerald-300/70 mt-1">
                          持有人: {p.owner}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 解析结果列表 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {preview.episodes.map((ep) => {
            const epId = `ep-${ep.episode_no}`;
            const expanded = expandedEpisodes.has(epId);
            return (
              <div key={epId} className="rounded-lg border border-white/10 bg-[#1f1f1f] overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleEpisode(epId)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 transition-colors text-left"
                >
                  {expanded ? (
                    <ChevronDown className="h-3 w-3 text-gray-500" />
                  ) : (
                    <ChevronRight className="h-3 w-3 text-gray-500" />
                  )}
                  <FileText className="h-3 w-3 text-emerald-400" />
                  <span className="text-sm font-medium text-white flex-1">
                    第{ep.episode_no}集 · {ep.title}
                  </span>
                  <span className="text-xs text-[#888]">
                    {ep.scenes.length} 个场景
                  </span>
                </button>
                {expanded && (
                  <div className="border-t border-white/10 px-3 py-2 space-y-2 bg-[#181818]">
                    {ep.synopsis && (
                      <div className="text-xs text-[#888]">
                        简介: <span className="text-gray-300">{ep.synopsis}</span>
                      </div>
                    )}
                    {ep.scenes.length === 0 ? (
                      <div className="text-xs text-yellow-400">⚠ 本集未识别到场景</div>
                    ) : (
                      ep.scenes.map((scene) => {
                        const scId = `${epId}-sc-${scene.scene_no}`;
                        const scExpanded = expandedScenes.has(scId);
                        return (
                          <div key={scId} className="rounded border border-white/5 bg-[#1a1a1a] overflow-hidden">
                            <button
                              type="button"
                              onClick={() => toggleScene(scId)}
                              className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-white/5 transition-colors text-left"
                            >
                              {scExpanded ? (
                                <ChevronDown className="h-3 w-3 text-gray-500" />
                              ) : (
                                <ChevronRight className="h-3 w-3 text-gray-500" />
                              )}
                              <span className="text-xs text-emerald-400">景{scene.scene_no}</span>
                              <span className="text-xs text-white flex-1">
                                {scene.location_name || "未命名地点"}
                                {scene.time_of_day ? ` · ${scene.time_of_day}` : ""}
                              </span>
                              <span className="text-xs text-[#888]">
                                {scene.dialogues.length} 句对白
                              </span>
                            </button>
                            {scExpanded && (
                              <div className="border-t border-white/5 px-2 py-2 space-y-1">
                                {scene.description && (
                                  <div className="text-xs text-[#888] line-clamp-3">
                                    {scene.description}
                                  </div>
                                )}
                                {scene.dialogues.length === 0 ? (
                                  <div className="text-xs text-[#666]">无对白</div>
                                ) : (
                                  scene.dialogues.map((d, dIdx) => (
                                    <div
                                      key={dIdx}
                                      className="text-xs flex gap-2 px-2 py-1 rounded bg-white/5"
                                    >
                                      <span className="text-emerald-400 font-medium">
                                        {d.character}
                                      </span>
                                      {d.emotion && (
                                        <span className="text-yellow-400">
                                          （{d.emotion}）
                                        </span>
                                      )}
                                      <span className="text-gray-300 flex-1">：{d.text}</span>
                                    </div>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 底部操作 */}
        <div className="px-4 py-3 border-t border-white/10 bg-[#252525] flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={isImporting}>
            返回编辑
          </Button>
          <Button size="sm" onClick={onConfirm} disabled={isImporting}>
            {isImporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                导入中...
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                确认导入
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
