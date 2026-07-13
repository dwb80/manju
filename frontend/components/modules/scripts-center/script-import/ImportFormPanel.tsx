"use client";

/**
 * 导入剧本：格式选择 + 文件上传 + 文本输入
 */

import { FileText, FileType, FileCode, FileJson, Upload, Loader2, Eye } from "lucide-react";
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
}: ImportFormPanelProps) {
  const currentAccept = IMPORT_FORMATS.find((f) => f.value === importFormat)?.accept;

  return (
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
          onClick={onParse}
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
  );
}
