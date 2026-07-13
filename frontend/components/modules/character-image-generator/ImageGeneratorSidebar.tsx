"use client";

import {
  User,
  ExternalLink,
  Trash2,
  CheckCircle2,
  History as HistoryIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MAX_ASSET_HISTORY, MAX_HISTORY } from "./types";
import type { HistoryImage, AssetHistoryItem } from "./types";
import type { ImageRatio } from "@/lib/module-types";

export interface ImageGeneratorSidebarProps {
  character: { name: string };
  selectedAsset: string | null;
  isSaving: boolean;
  assetHistory: AssetHistoryItem[];
  history: HistoryImage[];
  onPreviewAsset: (url: string) => void;
  onRemoveAsset: () => void;
  onOpenOriginal: (url: string) => void;
  onReapplyAssetFromHistory: (item: HistoryImage) => void;
  onDeleteAssetHistory: (id: string) => void;
  onPreviewAssetHistory: (item: HistoryImage) => void;
  onUseFromHistory: (item: HistoryImage) => void;
  onDeleteFromHistory: (id: string) => void;
}

export function ImageGeneratorSidebar({
  character,
  selectedAsset,
  isSaving,
  assetHistory,
  history,
  onPreviewAsset,
  onRemoveAsset,
  onOpenOriginal,
  onReapplyAssetFromHistory,
  onDeleteAssetHistory,
  onPreviewAssetHistory,
  onUseFromHistory,
  onDeleteFromHistory,
}: ImageGeneratorSidebarProps) {
  return (
    <div className="w-72 flex-shrink-0 border-l border-white/10 bg-[#1a1a1a] p-4 overflow-y-auto">
      {/* 已选角色资产 */}
      {selectedAsset && (
        <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-emerald-300">
            <User className="h-3.5 w-3.5" />
            已选角色资产
          </div>
          <div
            role="button"
            tabIndex={0}
            onClick={() => onPreviewAsset(selectedAsset)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onPreviewAsset(selectedAsset);
              }
            }}
            className="flex cursor-pointer items-center gap-2 rounded-md p-1 -m-1 outline-none transition-colors hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-emerald-500/40"
          >
            <img
              src={selectedAsset}
              alt="角色资产"
              className="h-16 w-16 flex-shrink-0 rounded-md object-cover border border-white/10"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-white" title={character.name}>{character.name}</p>
              <p className="text-[10px] text-gray-400">已应用到角色 · 点击预览</p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onOpenOriginal(selectedAsset);
              }}
              disabled={isSaving}
              className="h-7 px-2 text-gray-400 hover:text-emerald-300"
            >
              <ExternalLink className="h-3 w-3" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onRemoveAsset();
              }}
              disabled={isSaving}
              className="h-7 px-2 text-red-400 hover:text-red-300"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      {/* 已选资产历史 */}
      {assetHistory.length > 0 && (
        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-medium text-white inline-flex items-center gap-1.5">
              <HistoryIcon className="h-3.5 w-3.5 text-emerald-300" />
              已选资产历史
            </h2>
            <span className="text-[10px] text-gray-500">{assetHistory.length}/{MAX_ASSET_HISTORY}</span>
          </div>
          <p className="mb-2 text-[10px] text-gray-500 leading-relaxed">
            每次「设为角色资产」都会自动保留一份，被新图覆盖也不会丢失，可一键还原或删除。
          </p>
          <div className="grid grid-cols-3 gap-2">
            {assetHistory.map((item) => {
              const isCurrent = selectedAsset === item.url;
              return (
                <div
                  key={item.id}
                  className={`group relative overflow-hidden rounded-md border transition-colors ${isCurrent
                    ? "border-emerald-500/60 ring-1 ring-emerald-500/30"
                    : "border-white/10 hover:border-emerald-500/50"
                    }`}
                  title={`${item.ratio} · ${item.size} · ${item.timestamp}`}
                >
                  <div className="aspect-square w-full bg-[#0f0f0f]">
                    <img
                      src={item.url}
                      alt="历史资产"
                      className="h-full w-full object-cover cursor-pointer"
                      onClick={() => onPreviewAssetHistory(item as unknown as HistoryImage)}
                    />
                    {isCurrent && (
                      <div className="absolute top-1 left-1 inline-flex items-center gap-0.5 rounded-full bg-emerald-500/95 px-1.5 py-0.5 text-[9px] font-medium text-white">
                        <CheckCircle2 className="h-2.5 w-2.5" />
                        当前
                      </div>
                    )}
                    <div className="absolute top-1 right-1 rounded bg-black/70 px-1 py-0.5 text-[9px] text-emerald-300">
                      {item.ratio}
                    </div>
                  </div>
                  <div className="flex border-t border-white/10 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => onReapplyAssetFromHistory(item as unknown as HistoryImage)}
                      disabled={isSaving || isCurrent}
                      className="flex-1 px-1 py-1 text-[10px] text-emerald-300 hover:bg-emerald-500/20 transition-colors disabled:opacity-40"
                    >
                      {isCurrent ? "已应用" : "应用"}
                    </button>
                    <span className="w-px bg-white/10" />
                    <button
                      type="button"
                      onClick={() => onDeleteAssetHistory(item.id)}
                      className="flex-1 px-1 py-1 text-[10px] text-gray-400 hover:bg-red-500/20 hover:text-red-300 transition-colors"
                    >
                      删除
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 历史图片 */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-white">历史图片</h2>
        <span className="text-[10px] text-gray-500">{history.length}/{MAX_HISTORY}</span>
      </div>

      {history.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">暂无历史记录</div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {history.map((item) => (
            <div
              key={item.id}
              className={`group relative overflow-hidden rounded-md border transition-colors ${item.isApplied
                ? "border-emerald-500/50"
                : "border-white/10 hover:border-emerald-500/50"
                }`}
            >
              <div className="aspect-square w-full bg-[#0f0f0f]">
                <img
                  src={item.url}
                  alt={item.prompt}
                  className="h-full w-full object-cover cursor-zoom-in"
                  title={item.prompt}
                  onClick={() => onOpenOriginal(item.url)}
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenOriginal(item.url);
                  }}
                  className="absolute top-1 right-1 grid h-5 w-5 place-items-center rounded bg-black/70 text-white/80 opacity-0 transition group-hover:opacity-100 hover:bg-emerald-500/80"
                >
                  <ExternalLink className="h-2.5 w-2.5" />
                </button>
              </div>
              <div className="px-1.5 py-1 text-[10px] leading-tight text-gray-400">
                <div className="truncate">
                  <span className="text-emerald-300">{item.model.replace("agnes-image-", "")}</span>
                  <span className="mx-1 text-gray-600">·</span>
                  <span>{item.size}</span>
                </div>
                <div className="truncate text-gray-500">
                  {item.responseFormat} · {item.n}张 · {item.timestamp.split(" ")[1] || item.timestamp}
                </div>
              </div>
              {item.isApplied && (
                <div className="absolute top-1 left-1 inline-flex items-center gap-0.5 rounded-full bg-emerald-500/95 px-1.5 py-0.5 text-[9px] font-medium text-white">
                  <CheckCircle2 className="h-2.5 w-2.5" />
                  已应用
                </div>
              )}
              <div className="flex border-t border-white/10 bg-black/40">
                <button
                  type="button"
                  onClick={() => onUseFromHistory(item)}
                  className="flex-1 px-2 py-1 text-[10px] text-emerald-300 hover:bg-emerald-500/20 transition-colors"
                >
                  使用
                </button>
                <span className="w-px bg-white/10" />
                <button
                  type="button"
                  onClick={() => onDeleteFromHistory(item.id)}
                  className="flex-1 px-2 py-1 text-[10px] text-gray-400 hover:bg-red-500/20 hover:text-red-300 transition-colors"
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
