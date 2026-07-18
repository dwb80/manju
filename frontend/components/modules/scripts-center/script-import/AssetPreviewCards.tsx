"use client";

/**
 * 资产预览卡片组件（角色/场景/道具）
 *
 * 按需求变更：
 * 1. 不再使用 lucide-react 图标（ChevronDown/Right），改用纯文本 [+] / [-] 折叠符
 * 2. 场景卡片不再显示图片（去掉 aspect-[4/3]）
 * 3. 角色/场景/道具卡片底部展示「完整 AI 数据」可折叠区块，
 *    完整呈现 aiRawData 内容，导入时一并持久化到 ScriptDocument.ai_raw_data
 * 4. 不写入任何工厂（角色/场景/道具工厂）
 */

import { useState } from "react";
import type { PreviewCharacter, PreviewSceneAsset, PreviewPropAsset } from "./types";

/** 统一构造资产匹配状态徽章 */
type BadgeColor = "green" | "blue" | "gray";
function buildBadge(
  matchStatus: "matched" | "will_create" | "unresolved"
): { color: BadgeColor; icon: string; text: string } {
  if (matchStatus === "matched") return { color: "green", icon: "✓", text: "已匹配" };
  if (matchStatus === "will_create") return { color: "blue", icon: "+", text: "将创建" };
  return { color: "gray", icon: "?", text: "匹配中" };
}

/**
 * 健壮的 JSON 序列化。
 * 处理 JSON.stringify 抛错的情况（循环引用、BigInt、不可序列化值等），
 * 避免 React 渲染时整个组件崩溃。
 */
function safeStringify(data: unknown): string {
  if (data === undefined || data === null) return "(空)";
  try {
    // 第一次尝试：标准序列化
    return JSON.stringify(data, null, 2);
  } catch {
    // 第二次：手写 replacer 跳过不可序列化值
    try {
      const seen = new WeakSet();
      return JSON.stringify(
        data,
        (_key, value) => {
          if (typeof value === "bigint") return `[BigInt: ${value.toString()}]`;
          if (typeof value === "function") return "[Function]";
          if (value && typeof value === "object") {
            if (seen.has(value)) return "[Circular]";
            seen.add(value);
          }
          return value;
        },
        2
      );
    } catch (err) {
      return `(序列化失败: ${err instanceof Error ? err.message : "未知错误"})`;
    }
  }
}

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
        <span className="text-xs text-gray-500 font-mono w-3 inline-block text-center">
          {showCharacters ? "[-]" : "[+]"}
        </span>
        <span className="text-xs font-medium text-white">角色与资产匹配</span>
        <span className="text-xs text-[#888] ml-auto">
          <span className="text-green-400">{matched} 已匹配</span>
          {" · "}
          <span className="text-blue-400">{willCreate} 将创建</span>
          {unresolved > 0 && (
            <>
              {" · "}
              <span className="text-gray-500">{unresolved} 匹配中…</span>
            </>
          )}
        </span>
      </button>
      {showCharacters && (
        <div className="px-4 pb-3 max-h-[280px] overflow-y-auto">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {characters.map((c) => {
              const badge = buildBadge(c.matchStatus);
              return (
                <CharacterCard key={c.name} character={c} badge={badge} />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function CharacterCard({
  character,
  badge,
}: {
  character: PreviewCharacter;
  badge: { color: "green" | "blue" | "gray"; icon: string; text: string };
}) {
  const [expanded, setExpanded] = useState(false);
  const hasRaw = !!character.aiRawData;
  return (
    <div className="rounded border border-white/10 bg-[#1f1f1f] overflow-hidden">
      <div className="flex items-center gap-2 p-2">
        <div className="w-8 h-8 rounded-full overflow-hidden bg-white/5 flex items-center justify-center flex-shrink-0">
          {character.matchedImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={character.matchedImageUrl}
              alt={character.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-xs text-emerald-400 font-medium">
              {character.name.slice(0, 1)}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="text-sm text-white truncate">{character.name}</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${badge.color === "green"
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
            {character.dialogueCount} 句对白
            {character.role ? ` · ${character.role}` : ""}
            {character.age ? ` · ${character.age}` : ""}
          </div>
        </div>
      </div>
      {hasRaw && (
        <>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="w-full text-left px-2 pb-2 text-[10px] text-emerald-300/80 hover:text-emerald-200"
          >
            {expanded ? "[-] 收起 AI 完整数据" : "[+] 查看 AI 完整数据"}
          </button>
          {expanded && (
            <div className="px-2 pb-2 max-h-48 overflow-y-auto border-t border-white/5">
              <pre className="text-[10px] text-gray-300 whitespace-pre-wrap break-all font-mono leading-snug">
                {safeStringify(character.aiRawData)}
              </pre>
            </div>
          )}
        </>
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
        <span className="text-xs text-gray-500 font-mono w-3 inline-block text-center">
          {showSceneAssets ? "[-]" : "[+]"}
        </span>
        <span className="text-xs font-medium text-white">场景资产</span>
        <span className="text-xs text-[#888] ml-auto">
          <span className="text-green-400">{scenesMatched} 已匹配</span>
          {" · "}
          <span className="text-blue-400">{scenesWillCreate} 将创建</span>
          <span className="ml-1 text-[#666]">/ {sceneAssetsCount} 个</span>
        </span>
      </button>
      {showSceneAssets && (
        <div className="px-4 pb-3 max-h-[320px] overflow-y-auto">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {sceneAssets.map((s, idx) => {
              const badge = buildBadge(s.matchStatus);
              return (
                <SceneCard
                  key={`sc-${idx}-${s.location_name}`}
                  scene={s}
                  badge={badge}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function SceneCard({
  scene,
  badge,
}: {
  scene: PreviewSceneAsset;
  badge: { color: "green" | "blue" | "gray"; icon: string; text: string };
}) {
  const [expanded, setExpanded] = useState(false);
  const hasRaw = !!scene.aiRawData;
  return (
    <div className="rounded border border-white/10 bg-[#1f1f1f] overflow-hidden">
      <div className="p-2">
        <div className="flex items-center gap-1">
          <span className="text-xs text-white truncate flex-1">
            {scene.location_name || "未命名场景"}
          </span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${badge.color === "green"
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
          <span>{scene.time_of_day}</span>
          {scene.atmosphere && <span>· {scene.atmosphere}</span>}
        </div>
        {scene.visual_keywords && scene.visual_keywords.length > 0 && (
          <div className="text-[10px] text-emerald-300/70 mt-1 truncate">
            {scene.visual_keywords.slice(0, 4).join(" · ")}
          </div>
        )}
        {scene.description && (
          <div className="text-[10px] text-gray-400 mt-1 line-clamp-2">
            {scene.description}
          </div>
        )}
      </div>
      {hasRaw && (
        <>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="w-full text-left px-2 pb-2 text-[10px] text-emerald-300/80 hover:text-emerald-200 border-t border-white/5 pt-1"
          >
            {expanded ? "[-] 收起 AI 完整数据" : "[+] 查看 AI 完整数据"}
          </button>
          {expanded && (
            <div className="px-2 pb-2 max-h-48 overflow-y-auto">
              <pre className="text-[10px] text-gray-300 whitespace-pre-wrap break-all font-mono leading-snug">
                {JSON.stringify(scene.aiRawData, null, 2)}
              </pre>
            </div>
          )}
        </>
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
        <span className="text-xs text-gray-500 font-mono w-3 inline-block text-center">
          {showPropAssets ? "[-]" : "[+]"}
        </span>
        <span className="text-xs font-medium text-white">道具资产</span>
        <span className="text-xs text-[#888] ml-auto">
          <span className="text-green-400">{propsMatched} 已匹配</span>
          {" · "}
          <span className="text-blue-400">{propsWillCreate} 将创建</span>
          <span className="ml-1 text-[#666]">/ {propAssetsCount} 个</span>
        </span>
      </button>
      {showPropAssets && (
        <div className="px-4 pb-3 max-h-[240px] overflow-y-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {propAssets.map((p, idx) => {
              const badge = buildBadge(p.matchStatus);
              return (
                <PropCard
                  key={`pr-${idx}-${p.name}`}
                  prop={p}
                  badge={badge}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function PropCard({
  prop,
  badge,
}: {
  prop: PreviewPropAsset;
  badge: { color: "green" | "blue" | "gray"; icon: string; text: string };
}) {
  const [expanded, setExpanded] = useState(false);
  const hasRaw = !!prop.aiRawData;
  return (
    <div className="rounded border border-white/10 bg-[#1f1f1f] p-2">
      <div className="flex items-center gap-1 mb-1">
        <span className="text-xs text-white truncate flex-1">{prop.name}</span>
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${badge.color === "green"
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
        <span className="px-1 py-0.5 rounded bg-white/5">{prop.category}</span>
        {prop.color && <span className="px-1 py-0.5 rounded bg-white/5">{prop.color}</span>}
        {prop.material && <span className="px-1 py-0.5 rounded bg-white/5">{prop.material}</span>}
        {prop.size && <span className="px-1 py-0.5 rounded bg-white/5">{prop.size}</span>}
      </div>
      {prop.description && (
        <div className="text-[10px] text-gray-400 mt-1 line-clamp-2">
          {prop.description}
        </div>
      )}
      {prop.owner && (
        <div className="text-[10px] text-emerald-300/70 mt-1">
          持有人: {prop.owner}
        </div>
      )}
      {hasRaw && (
        <>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="w-full text-left mt-1 text-[10px] text-emerald-300/80 hover:text-emerald-200 border-t border-white/5 pt-1"
          >
            {expanded ? "[-] 收起 AI 完整数据" : "[+] 查看 AI 完整数据"}
          </button>
          {expanded && (
            <div className="mt-1 max-h-48 overflow-y-auto">
              <pre className="text-[10px] text-gray-300 whitespace-pre-wrap break-all font-mono leading-snug">
                {JSON.stringify(prop.aiRawData, null, 2)}
              </pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}
