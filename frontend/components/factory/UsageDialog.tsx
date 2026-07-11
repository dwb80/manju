"use client";

/**
 * 引用来源列表弹窗
 *
 * 由 FactoryCRUDPage 在用户点击 UsageBadge 时弹出。
 * 列出该资产在剧本 / 分镜 / 对白 / 视频中被引用的所有位置。
 */

import { FileText, X, ExternalLink } from "lucide-react";

export interface UsageDialogProps {
  isOpen: boolean;
  onClose: () => void;
  entityName: string;
  references: { id: string; title: string }[];
  /** 唯一出场集数（已排序）。 */
  episodes?: number[];
}

export function UsageDialog({ isOpen, onClose, entityName, references, episodes }: UsageDialogProps) {
  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-lg border border-white/10 bg-[#1a1a1a] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-emerald-400" />
              <h2 className="text-base font-medium text-white">{entityName} 的引用</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#888]">
              <span>共 {references.length} 处引用</span>
              {episodes && episodes.length > 0 && (
                <span className="text-emerald-300/90 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                  出场 {episodes.length} 集（{formatEpisodeList(episodes)}）
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-[#888] hover:bg-white/10 hover:text-white"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-96 overflow-y-auto p-5">
          {references.length === 0 ? (
            <p className="py-8 text-center text-sm text-[#888]">该资产尚未被任何地方引用。</p>
          ) : (
            <ul className="space-y-1">
              {references.map((ref) => (
                <li key={ref.id}>
                  <button
                    type="button"
                    onClick={() => {
                      // 简单处理：打印 id 到控制台，未来可以跳转到对应页面
                      console.log("open reference", ref);
                    }}
                    className="flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm text-white transition-colors hover:bg-white/5"
                  >
                    <span className="flex-1 truncate">{ref.title}</span>
                    <ExternalLink className="ml-2 h-3 w-3 shrink-0 text-[#888]" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="border-t border-white/10 px-5 py-3 text-right text-xs text-[#888]">
          共 {references.length} 处引用
        </div>
      </div>
    </div>
  );
}

/** 把集数数组格式化为 "1, 3-5, 7" 这种紧凑形式（连续区间用 - 连接）。 */
function formatEpisodeList(episodes: number[]): string {
  if (episodes.length === 0) return "";
  const sorted = [...episodes].sort((a, b) => a - b);
  const parts: string[] = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    if (j > i) parts.push(`${sorted[i]}-${sorted[j]}`);
    else parts.push(`${sorted[i]}`);
    i = j + 1;
  }
  return parts.join(", ");
}
