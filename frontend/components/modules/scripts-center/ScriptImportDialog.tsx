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

interface PreviewResult {
  title: string;
  format: string;
  file_name: string;
  editor_json: any;
  episodes: PreviewEpisode[];
}

/** 规范化时间段枚举 */
function normalizeTimeOfDay(value: string): "day" | "night" | "dawn" | "dusk" {
  const v = (value || "").toLowerCase();
  if (v.includes("夜") || v.includes("night")) return "night";
  if (v.includes("黄昏") || v.includes("傍晚") || v.includes("dusk")) return "dusk";
  if (v.includes("晨") || v.includes("黎明") || v.includes("dawn")) return "dawn";
  return "day";
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
  const handleParsePreview = () => {
    if (!importText.trim()) {
      alert("请输入或上传剧本内容");
      return;
    }

    let title = importFileName || `导入剧本 ${new Date().toLocaleDateString()}`;
    let editorJson: any = textToEditorJson(importText);
    let episodes: PreviewEpisode[] = [];

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

    // 兜底：若没有解析到剧集，则默认生成 1 集
    if (episodes.length === 0) {
      episodes = [
        { episode_no: 1, title, synopsis: "", status: "draft", scenes: [] },
      ];
    }

    setPreview({
      title,
      format: importFormat,
      file_name: importFileName,
      editor_json: editorJson,
      episodes,
    });
    setShowPreview(true);
  };

  /**
   * 确认导入：调用后端接口写入数据库
   */
  const handleConfirmImport = async () => {
    if (!preview) return;
    if (!projectId) {
      alert("请先选择一个项目");
      return;
    }
    setIsImporting(true);
    try {
      const importData = {
        title: preview.title,
        format: preview.format,
        file_name: preview.file_name,
        document: {
          editor_json: JSON.stringify(preview.editor_json),
        },
        episodes: preview.episodes,
      };

      await scriptCenterService.importScript(projectId, JSON.stringify(importData));

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

        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            取消
          </Button>
          <Button size="sm" onClick={handleParsePreview} disabled={!importText.trim()}>
            <Eye className="mr-2 h-4 w-4" />
            解析预览
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
    return {
      episodes: preview.episodes.length,
      scenes: totalScenes,
      dialogues: totalDialogues,
    };
  }, [preview]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <div className="w-[760px] max-h-[80vh] bg-[#1a1a1a] rounded-xl border border-white/10 shadow-2xl flex flex-col overflow-hidden">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#252525]">
          <div>
            <div className="text-sm font-medium text-white flex items-center gap-2">
              <Eye className="h-4 w-4 text-emerald-400" />
              导入预览 · {preview.title}
            </div>
            <div className="text-xs text-[#888] mt-1">
              请确认解析结果。点击「确认导入」将写入数据库。
            </div>
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
        <div className="px-4 py-2 border-b border-white/10 bg-[#1f1f1f] flex items-center gap-4 text-xs">
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
          {preview.episodes.length === 0 && (
            <span className="text-yellow-400">⚠ 未识别到剧集</span>
          )}
        </div>

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
