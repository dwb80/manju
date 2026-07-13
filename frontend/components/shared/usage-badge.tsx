"use client";

/**
 * 资产引用徽标组件
 *
 * 显示资产被剧本/分镜/对白等引用的次数；点击弹窗展示完整引用清单。
 */

import { useEffect, useState } from "react";
import { Link2, X, ExternalLink, Loader2 } from "lucide-react";
import { getCharacterUsage, getSceneUsage, getPropUsage, type AssetUsage, type UsageReferenceItem } from "@/services/module.service";

/** 资产类型，决定调用哪个引用查询接口。 */
export type UsageEntityType = "character" | "scene" | "prop";

export interface UsageBadgeProps {
  /** 资产类型。 */
  entityType: UsageEntityType;
  /** 资产 ID。 */
  entityId: string;
  /** 资产名称，用于弹窗标题。 */
  entityName: string;
  /** 初始引用次数（可选，未传则由组件自己查询）。 */
  initialCount?: number;
  /** 自定义点击行为（如跳转到剧本中心）。 */
  onOpenSource?: (ref: UsageReferenceItem) => void;
}

/** 把引用方类型映射为中文标签。 */
const typeLabels: Record<UsageReferenceItem["type"], string> = {
  script: "剧本",
  storyboard: "分镜",
  dialogue: "对白",
  scene_character: "场景-角色",
  scene_location: "场景-地点",
  script_center: "剧本中心",
};

/** 调用对应服务的引用查询 API。 */
async function fetchUsage(entityType: UsageEntityType, entityId: string): Promise<AssetUsage> {
  switch (entityType) {
    case "character":
      return getCharacterUsage(entityId);
    case "scene":
      return getSceneUsage(entityId);
    case "prop":
      return getPropUsage(entityId);
  }
}

/**
 * 通用引用徽标：
 * - 次数 = 0 时不显示，避免视觉噪声。
 * - 次数 > 0 时显示一个可点击的小徽标，点击后弹出引用清单。
 */
export function UsageBadge({ entityType, entityId, entityName, initialCount, onOpenSource }: UsageBadgeProps) {
  const [count, setCount] = useState<number>(initialCount ?? 0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [usage, setUsage] = useState<AssetUsage | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // 优化：不再在挂载时自动请求引用次数。
  // 原因：
  // 1. 列表页可能有几十上百个卡片，每个卡片都请求会产生大量并发请求
  // 2. initialCount 已由父组件（列表接口）提供，足够展示徽标
  // 3. 用户点击徽标打开弹窗时才会请求最新数据
  // 4. 如需刷新，父组件重新加载列表即可更新 initialCount
  //
  // 保留 useEffect 仅用于同步 initialCount 变化（如列表刷新后）
  useEffect(() => {
    if (initialCount !== undefined) {
      setCount(initialCount);
    }
  }, [initialCount]);

  // 点击徽标时打开弹窗并按需加载完整清单。
  const handleOpen = async () => {
    setIsModalOpen(true);
    if (usage) return;
    setIsLoading(true);
    try {
      const data = await fetchUsage(entityType, entityId);
      setUsage(data);
      setCount(data.usage_count ?? 0);
    } finally {
      setIsLoading(false);
    }
  };

  if (count <= 0 && initialCount === undefined) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-300 hover:bg-emerald-500/25 transition-colors"
        title={`查看「${entityName}」被哪些剧本/分镜引用`}
      >
        <Link2 className="h-3 w-3" />
        被 {count} 处引用
      </button>

      {isModalOpen && (
        <UsageDialog
          entityName={entityName}
          entityType={entityType}
          usage={usage}
          loading={isLoading}
          onClose={() => setIsModalOpen(false)}
          onOpenSource={onOpenSource}
        />
      )}
    </>
  );
}

/** 引用清单弹窗。 */
function UsageDialog({
  entityName,
  entityType,
  usage,
  loading,
  onClose,
  onOpenSource,
}: {
  entityName: string;
  entityType: UsageEntityType;
  usage: AssetUsage | null;
  loading: boolean;
  onClose: () => void;
  onOpenSource?: (ref: UsageReferenceItem) => void;
}) {
  const typeName = entityType === "character" ? "角色" : entityType === "scene" ? "场景" : "道具";
  const allRefs: UsageReferenceItem[] = usage
    ? [
        ...usage.storyboards,
        ...usage.scripts,
        ...usage.dialogues,
        ...usage.sceneCharacters,
        ...usage.sceneLocations,
      ]
    : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-[640px] max-w-[95vw] max-h-[80vh] flex flex-col rounded-lg border border-white/10 bg-[#1a1a1a] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
          <div>
            <h2 className="text-base font-medium text-white">
              「{entityName}」的引用清单
            </h2>
            <p className="mt-0.5 text-xs text-[#888]">
              该{typeName}在剧本/分镜/对白中的所有引用
            </p>
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-12 text-[#888]">
              <Loader2 className="h-4 w-4 animate-spin" />
              正在查询引用...
            </div>
          )}
          {!loading && usage && allRefs.length === 0 && (
            <div className="py-12 text-center text-sm text-[#666]">
              该{typeName}暂无任何引用
            </div>
          )}
          {!loading && usage && allRefs.length > 0 && (
            <div className="space-y-3">
              {(["storyboard", "script", "dialogue", "scene_character", "scene_location"] as const).map((category) => {
                const items = usage[
                  category === "storyboard" ? "storyboards"
                  : category === "script" ? "scripts"
                  : category === "dialogue" ? "dialogues"
                  : category === "scene_character" ? "sceneCharacters"
                  : "sceneLocations"
                ] as UsageReferenceItem[];
                if (items.length === 0) return null;
                return (
                  <div key={category}>
                    <h3 className="mb-1.5 text-xs font-medium text-[#888]">
                      {typeLabels[category]}（{items.length}）
                    </h3>
                    <div className="space-y-1.5">
                      {items.map((ref) => (
                        <div
                          key={`${ref.type}-${ref.id}`}
                          className="flex items-start gap-2 rounded-md border border-white/10 bg-[#252525] px-3 py-2 hover:border-emerald-500/40"
                        >
                          <span className="mt-0.5 inline-flex items-center rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-300">
                            {typeLabels[ref.type]}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="truncate text-sm text-white">{ref.title}</p>
                            {ref.context && (
                              <p className="mt-0.5 line-clamp-2 text-xs text-[#888]">{ref.context}</p>
                            )}
                          </div>
                          {onOpenSource && (
                            <button
                              type="button"
                              onClick={() => onOpenSource(ref)}
                              className="rounded p-1 text-[#888] hover:bg-white/10 hover:text-white"
                              title="跳转到源"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-white/10 px-5 py-2.5 text-xs text-[#666]">
          共 {usage?.total ?? 0} 处引用
          {usage && usage.usage_count !== usage.total ? ` · 缓存值 ${usage.usage_count}` : ""}
        </div>
      </div>
    </div>
  );
}
