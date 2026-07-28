"use client";

/**
 * 导入剧本：格式选择 + 文件上传 + 文本输入
 */

import { FileText, FileType, FileCode, FileJson, Upload, Loader2, Eye, Cpu, RefreshCw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getImportPlaceholder } from "../utils";
import type { ImportFormat } from "../types";
import type { RefObject } from "react";

/** 支持的导入格式（集中在此处，避免在主入口重复声明） */
export const IMPORT_FORMATS: Array<{ value: ImportFormat; label: string; icon: typeof FileText; accept: string }> = [
  { value: "txt", label: "TXT 纯文本", icon: FileText, accept: ".txt" },
  { value: "markdown", label: "Markdown", icon: FileType, accept: ".md,.markdown" },
  { value: "fountain", label: "Fountain 剧本", icon: FileCode, accept: ".fountain,.fountain.txt" },
  { value: "json", label: "JSON 数据", icon: FileJson, accept: ".json" },
  { value: "fdx", label: "Final Draft (FDX)", icon: FileCode, accept: ".fdx" },
];

/** 导入对话框内可选的聊天模型行（与 useScriptImport 暴露的 ImportChatModel 对齐） */
export interface ImportChatModelOption {
  id: string;
  name: string;
  description?: string;
  isDefault: boolean;
  is_enabled: boolean;
  provider?: string;
}

export interface ImportFormPanelProps {
  importFormat: ImportFormat;
  setImportFormat: (format: ImportFormat) => void;
  importText: string;
  setImportText: (text: string) => void;
  importFileName: string;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onParse: () => void;
  onClose: () => void;
  isAnalyzingScript: boolean;
  analysisStatus: string;
  /** 模型下拉：可用的聊天模型 + 当前选中 + 加载状态 */
  chatModels: ImportChatModelOption[];
  selectedModelId: string;
  setSelectedModelId: (id: string) => void;
  isLoadingModels: boolean;
  onReloadModels: () => void;
}

export function ImportFormPanel({
  importFormat,
  setImportFormat,
  importText,
  setImportText,
  importFileName,
  fileInputRef,
  onFileSelect,
  onParse,
  onClose,
  isAnalyzingScript,
  analysisStatus,
  chatModels,
  selectedModelId,
  setSelectedModelId,
  isLoadingModels,
  onReloadModels,
}: ImportFormPanelProps) {
  const currentAccept = IMPORT_FORMATS.find((f) => f.value === importFormat)?.accept;
  // 没拉到任何启用中的聊天模型：禁用解析按钮 + 引导用户去模型中心
  const noModelAvailable = !isLoadingModels && chatModels.length === 0;
  // 选中项的展示名：用于"解析预览"按钮上的 tooltip
  const selectedModel = chatModels.find((m) => m.id === selectedModelId);
  const parseButtonTitle = noModelAvailable
    ? "请先到「模型中心」配置并启用至少一个聊天模型"
    : selectedModel
    ? `使用 ${selectedModel.name}${selectedModel.isDefault ? "（默认）" : ""} 解析剧本`
    : "快捷键：Ctrl/⌘ + Enter";

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        支持导入多种格式的剧本文件：TXT纯文本、Markdown、Fountain剧本格式、JSON数据、Final Draft (FDX)。
      </div>

      {/* 格式选择 */}
      <div>
        <div className="text-xs text-muted-foreground mb-2">选择导入格式</div>
        <div className="flex flex-wrap gap-2">
          {IMPORT_FORMATS.map((fmt) => {
            const Icon = fmt.icon;
            return (
              <button
                key={fmt.value}
                onClick={() => setImportFormat(fmt.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                  importFormat === fmt.value
                    ? "bg-primary/20 text-primary border border-primary/50"
                    : "bg-muted/50 text-muted-foreground border border-border hover:bg-muted"
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
          accept={currentAccept}
          onChange={onFileSelect}
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
          <span className="ml-3 text-sm text-primary">
            已选择: {importFileName}
          </span>
        )}
      </div>

      {/* 内容输入 */}
      <div>
        <div className="text-xs text-muted-foreground mb-2">
          或直接粘贴{IMPORT_FORMATS.find((f) => f.value === importFormat)?.label}内容
        </div>
        <textarea
          className="w-full h-48 p-3 rounded-lg bg-card border border-border text-sm text-foreground resize-none focus:outline-none focus:border-primary/50"
          placeholder={getImportPlaceholder(importFormat)}
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
        />
      </div>

      {/* 字数统计 + 超限预警 */}
      {importText && (() => {
        const charCount = importText.replace(/\s/g, "").length;
        // 阈值：10000 字变橙，50000 字变红 + 强制提示
        const colorClass =
          charCount > 50_000
            ? "text-destructive"
            : charCount > 10_000
            ? "text-warning"
            : "text-primary";
        return (
          <div className="text-xs text-muted-foreground">
            当前内容字数:{" "}
            <span className={colorClass}>{charCount.toLocaleString()}</span> 字
            {charCount > 50_000 && (
              <span className="ml-2 text-destructive">
                ⚠ 内容过长，可能导致 AI 解析超时或本地正则失败
              </span>
            )}
            {charCount > 10_000 && charCount <= 50_000 && (
              <span className="ml-2 text-warning">· 偏长</span>
            )}
          </div>
        );
      })()}

      <div className="flex justify-end gap-2 items-center">
        {analysisStatus && (
          <span className="text-xs text-chart-1 mr-auto flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            {analysisStatus}
          </span>
        )}
        <span className="text-[10px] text-muted-foreground mr-auto">
          提示：<kbd className="px-1 py-0.5 rounded bg-muted/50 border border-border">Esc</kbd> 关闭 ·
          <kbd className="px-1 py-0.5 rounded bg-muted/50 border border-border ml-1">Ctrl/⌘ + Enter</kbd> 解析
        </span>

        {/* 模型下拉：放在「取消」按钮左边；只显示 chat 模型（剧本分析只允许聊天模型） */}
        <div className="flex items-center gap-1.5">
          <Cpu className="h-3.5 w-3.5 text-muted-foreground" />
          <select
            aria-label="选择剧本分析模型"
            value={selectedModelId}
            onChange={(e) => setSelectedModelId(e.target.value)}
            disabled={isLoadingModels || chatModels.length === 0 || isAnalyzingScript}
            className="h-7 max-w-[180px] rounded-md border border-border bg-card px-2 text-xs text-foreground focus:border-primary/50 focus:outline-none disabled:opacity-50"
            title={
              chatModels.length === 0
                ? "暂无可用聊天模型，请到「模型中心」配置"
                : "选择用于剧本分析的聊天模型"
            }
          >
            {isLoadingModels ? (
              <option value="">加载模型中…</option>
            ) : chatModels.length === 0 ? (
              <option value="">无可用聊天模型</option>
            ) : (
              chatModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {m.isDefault ? "（默认）" : ""}
                  {m.provider ? ` · ${m.provider}` : ""}
                </option>
              ))
            )}
          </select>
          <button
            type="button"
            onClick={onReloadModels}
            disabled={isLoadingModels || isAnalyzingScript}
            className="rounded p-1 text-muted-foreground hover:bg-muted/50 hover:text-foreground disabled:opacity-50"
            title="刷新模型列表"
            aria-label="刷新模型列表"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoadingModels ? "animate-spin" : ""}`} />
          </button>
        </div>

        {noModelAvailable && (
          <span className="hidden md:flex items-center gap-1 text-[10px] text-warning">
            <AlertTriangle className="h-3 w-3" />
            请到「模型中心」配置
          </span>
        )}

        <Button variant="ghost" size="sm" onClick={onClose}>
          取消
        </Button>
        <Button
          size="sm"
          onClick={onParse}
          disabled={!importText.trim() || isAnalyzingScript || noModelAvailable}
          title={parseButtonTitle}
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
  );
}
