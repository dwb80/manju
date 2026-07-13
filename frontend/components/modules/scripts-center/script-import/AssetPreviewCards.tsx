"use client";

/**
 * 资产预览卡片组件
 * 角色/场景/道具资产预览卡片
 */

import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { PreviewCharacter, PreviewSceneAsset, PreviewPropAsset } from "./types";

interface CharacterAssetCardsProps {
  characters: PreviewCharacter[];
  matched: number;
  willCreate: number;
  unresolved: number;
}

export function CharacterAssetCards({ characters, matched, willCreate, unresolved }: CharacterAssetCardsProps) {
  const [showCharacters, setShowCharacters] = useState<boolean>(true);

  if (characters.length === 0) return null;

  return (
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
          <span className="text-green-400">{matched} 已匹配</span>
          {" · "}
          <span className="text-blue-400">{willCreate} 将自动创建</span>
          {unresolved > 0 && (
            <>
              {" · "}
              <span className="text-gray-500">{unresolved} 匹配中…</span>
            </>
          )}
        </span>
      </button>
      {showCharacters && (
        <div className="px-4 pb-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {characters.map((c) => {
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
  );
}

interface SceneAssetCardsProps {
  sceneAssets: PreviewSceneAsset[];
  scenesMatched: number;
  scenesWillCreate: number;
  sceneAssetsCount: number;
}

export function SceneAssetCards({ sceneAssets, scenesMatched, scenesWillCreate, sceneAssetsCount }: SceneAssetCardsProps) {
  const [showSceneAssets, setShowSceneAssets] = useState<boolean>(true);

  if (sceneAssets.length === 0) return null;

  return (
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
          <span className="text-green-400">{scenesMatched} 已匹配</span>
          {" · "}
          <span className="text-blue-400">{scenesWillCreate} 将自动创建</span>
          <span className="ml-1 text-[#666]">/ {sceneAssetsCount} 个</span>
        </span>
      </button>
      {showSceneAssets && (
        <div className="px-4 pb-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {sceneAssets.map((s, idx) => {
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
  );
}

interface PropAssetCardsProps {
  propAssets: PreviewPropAsset[];
  propsMatched: number;
  propsWillCreate: number;
  propAssetsCount: number;
}

export function PropAssetCards({ propAssets, propsMatched, propsWillCreate, propAssetsCount }: PropAssetCardsProps) {
  const [showPropAssets, setShowPropAssets] = useState<boolean>(true);

  if (propAssets.length === 0) return null;

  return (
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
          <span className="text-green-400">{propsMatched} 已匹配</span>
          {" · "}
          <span className="text-blue-400">{propsWillCreate} 将自动创建</span>
          <span className="ml-1 text-[#666]">/ {propAssetsCount} 个</span>
        </span>
      </button>
      {showPropAssets && (
        <div className="px-4 pb-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
          {propAssets.map((p, idx) => {
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
  );
}
