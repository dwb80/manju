"use client";

/**
 * @file character-image-generator/ImageGeneratorPreview.tsx
 * @description 角色图片生成器预览区域组件，展示生成结果和候选图片
 */

import { useCallback } from "react";
import {
  Loader2,
  X,
  Check,
  Circle,
  CheckCircle2,
  Maximize2,
  Image as ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ratioToAspectRatio } from "./types";
import type { CandidateImage } from "./types";
import type { ImageRatio } from "@/lib/module-types";
import type { CSSProperties } from "react";

export interface ImageGeneratorPreviewProps {
  isGenerating: boolean;
  isImg2Img: boolean;
  isSaving: boolean;
  n: number;
  estimatedSeconds: number;
  candidates: CandidateImage[];
  selectedIndex: number | null;
  selectedAsset: string | null;
  onCancel: () => void;
  onSelectIndex: (idx: number | null) => void;
  onSelectAsAsset: (url: string, ratio?: ImageRatio) => void;
  onOpenOriginal: (url: string) => void;
}

/**
 * ImageGeneratorPreview - 图片生成器预览区域
 * @param {ImageGeneratorPreviewProps} props - 组件属性
 * @returns {JSX.Element} 渲染的 React 元素
 * 
 * 功能：
 * - 显示生成中状态和进度
 * - 展示候选图片网格（支持单图和多图）
 * - 支持四宫格图片的分块预览
 * - 设为角色资产操作
 * - 查看原图功能
 */
export function ImageGeneratorPreview({
  isGenerating,
  isImg2Img,
  isSaving,
  n,
  estimatedSeconds,
  candidates,
  selectedIndex,
  selectedAsset,
  onCancel,
  onSelectIndex,
  onSelectAsAsset,
  onOpenOriginal,
}: ImageGeneratorPreviewProps) {
  const renderSingleItemStyle = (r: ImageRatio): CSSProperties => ({
    aspectRatio: ratioToAspectRatio(r),
    maxHeight: "100%",
    maxWidth: "100%",
    width: "auto",
    height: "auto",
  });

  const renderGridItemStyle = (r: ImageRatio): CSSProperties => ({
    aspectRatio: ratioToAspectRatio(r),
    width: "100%",
  });

  if (isGenerating) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-gray-400 border border-dashed border-white/10 rounded-lg">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
        <div className="text-sm">AI 正在生成 {n} 张图片，请稍候…</div>
        <div className="text-[11px] text-gray-500">预计耗时 {estimatedSeconds}s（最多 2min）</div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCancel}
          className="mt-2 border-white/15 text-gray-300 hover:text-white hover:border-red-500/60 hover:text-red-300 gap-1.5"
        >
          <X className="h-3.5 w-3.5" />
          终止生成
        </Button>
      </div>
    );
  }

  if (candidates.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-gray-500 border border-dashed border-white/10 rounded-lg">
        <ImageIcon className="h-12 w-12 mb-3 opacity-50" />
        <span className="text-sm">填写提示词后点击「{isImg2Img ? "图生图生成" : "生成图片"}」</span>
        {isImg2Img && (
          <span className="mt-2 text-xs text-amber-300/80">已加载参考图，将作为图生图输入</span>
        )}
      </div>
    );
  }

  return (
    <div
      className={
        candidates.length === 1
          ? "flex-1 flex items-center justify-center min-h-0 overflow-hidden"
          : "flex-1 grid grid-cols-2 gap-4 max-w-4xl w-full mx-auto content-start overflow-auto"
      }
    >
      {candidates.map((item, idx) => {
        const url = item.url;
        const itemRatio = item.ratio;
        const selected = selectedIndex === idx;
        const isApplied = selectedAsset === url;

        if (item.isGrid) {
          return (
            <div
              key={`${url}-${idx}`}
              className="flex-1 flex items-center justify-center min-h-0 overflow-hidden"
            >
              <div className="grid grid-cols-2 gap-3 max-h-full max-w-full">
                {[0, 1, 2, 3].map((gridIdx) => {
                  const gridSelected = selectedIndex === idx && selectedAsset === url;
                  const positions = [
                    { clip: "inset(0 50% 50% 0)", label: "左上" },
                    { clip: "inset(0 0 50% 50%)", label: "右上" },
                    { clip: "inset(50% 50% 0 0)", label: "左下" },
                    { clip: "inset(50% 0 0 50%)", label: "右下" },
                  ];
                  const pos = positions[gridIdx];
                  return (
                    <div
                      key={gridIdx}
                      className={`group relative overflow-hidden rounded-lg border-2 transition-all cursor-pointer ${gridSelected
                        ? "border-emerald-400 ring-2 ring-emerald-400/40"
                        : "border-white/10 hover:border-white/30"
                        }`}
                      style={{ aspectRatio: ratioToAspectRatio(itemRatio) }}
                      onClick={() => {
                        onSelectIndex(idx);
                        onOpenOriginal(url);
                      }}
                    >
                      <img
                        src={url}
                        alt={`四宫格 ${pos.label}`}
                        className="absolute inset-0 w-[200%] h-[200%] object-cover"
                        style={{ clipPath: pos.clip }}
                      />
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/60 text-[10px] text-white/90">
                        {pos.label}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectIndex(idx);
                        }}
                        className={`absolute top-2 right-2 h-7 w-7 rounded-full flex items-center justify-center transition-all ${gridSelected
                          ? "bg-emerald-500 text-white"
                          : "bg-black/60 text-white/70 hover:bg-black/80 border border-white/20"
                          }`}
                      >
                        {gridSelected ? <Check className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                      </button>
                      {gridSelected && (
                        <div className="absolute bottom-2 left-2 right-2">
                          <Button
                            type="button"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectAsAsset(url, itemRatio);
                            }}
                            disabled={isSaving}
                            className="w-full bg-emerald-500 hover:bg-emerald-600"
                          >
                            {isSaving ? (
                              <>
                                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                保存中…
                              </>
                            ) : (
                              <>设为角色资产</>
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        }

        return (
          <div
            key={`${url}-${idx}`}
            style={
              candidates.length === 1
                ? renderSingleItemStyle(itemRatio)
                : renderGridItemStyle(itemRatio)
            }
            role="button"
            tabIndex={0}
            onClick={() => onOpenOriginal(url)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpenOriginal(url);
              }
            }}
            className={`group relative overflow-hidden rounded-lg border-2 transition-all cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 ${isApplied
              ? "border-emerald-500/70 ring-2 ring-emerald-500/30"
              : selected
                ? "border-emerald-400 ring-2 ring-emerald-400/40"
                : "border-white/10 hover:border-white/30"
              } ${candidates.length === 1 ? "" : "w-full"}`}
          >
            <img
              src={url}
              alt={`候选图 ${idx + 1}`}
              className="max-h-full max-w-full object-contain bg-[#1a1a1a]"
            />
            <div className="pointer-events-none absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/40" aria-hidden="true" />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenOriginal(url);
              }}
              className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md bg-black/75 px-2.5 py-1.5 text-[11px] font-medium text-white opacity-0 shadow-lg backdrop-blur transition-all group-hover:opacity-100 hover:bg-emerald-500/90 focus-visible:opacity-100"
            >
              <Maximize2 className="h-3 w-3" />
              查看原图
            </button>
            {isApplied ? (
              <div className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/95 px-2.5 py-1 text-[10px] font-medium text-white shadow">
                <CheckCircle2 className="h-3 w-3" />
                已应用
              </div>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectIndex(selected ? null : idx);
                }}
                className={`absolute top-2 right-2 h-7 w-7 rounded-full flex items-center justify-center transition-all ${selected
                  ? "bg-emerald-500 text-white"
                  : "bg-black/60 text-white/70 hover:bg-black/80 border border-white/20"
                  }`}
              >
                {selected ? <Check className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
              </button>
            )}
            {selected && !isApplied && (
              <div className="absolute bottom-2 left-2 right-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectAsAsset(url, itemRatio);
                  }}
                  disabled={isSaving}
                  className="w-full bg-emerald-500 hover:bg-emerald-600"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                      保存中…
                    </>
                  ) : (
                    <>设为角色资产</>
                  )}
                </Button>
              </div>
            )}
            <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/60 text-[10px] text-white/90 inline-flex items-center gap-1">
              <span>#{idx + 1}</span>
              <span className="text-gray-400">·</span>
              <span className="text-emerald-300">{itemRatio}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
