"use client";

/**
 * 回收站中每个条目的极简行
 *
 * 展示：选择框 + 缩略图（缺失时降级为首字）+ 名称 + 元信息（默认删除时间）+ 恢复/永久删除按钮。
 * 适用于角色/场景/道具工厂的回收站视图。
 */

import { CheckSquare, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getEntityLabel, type FactoryEntity } from "../types";

/**
 * RecycleBinRow - 回收站条目行组件
 * @description 回收站中每个条目的极简行，展示选择框、缩略图、名称、删除时间及恢复/永久删除按钮
 * @template TEntity - 工厂实体类型，需继承 FactoryEntity
 * @param {TEntity} item - 实体数据
 * @param {string} entityLabel - 实体中文名称（如"角色"）
 * @param {string} [metaLabel="删除时间"] - 元信息标签
 * @param {boolean} selected - 是否选中
 * @param {() => void} onToggleSelect - 切换选中状态回调
 * @param {() => void} onRestore - 恢复回调
 * @param {() => void} onPermanentDelete - 永久删除回调
 * @returns {JSX.Element} 渲染的回收站条目行
 */
export function RecycleBinRow<TEntity extends FactoryEntity>({
  item,
  entityLabel,
  metaLabel = "删除时间",
  selected,
  onToggleSelect,
  onRestore,
  onPermanentDelete,
}: {
  item: TEntity;
  entityLabel: string;
  metaLabel?: string;
  selected: boolean;
  onToggleSelect: () => void;
  onRestore: () => void;
  onPermanentDelete: () => void;
}) {
  const image = (item as { image?: string }).image;
  const deletedAt = item.deleted_at;
  return (
    <div
      className={`group flex items-center gap-3 rounded-lg border bg-[#1f1f1f] px-4 py-3 transition-colors ${
        selected
          ? "border-emerald-500 ring-1 ring-emerald-500/40"
          : "border-white/10 hover:border-white/20"
      }`}
    >
      <button
        type="button"
        onClick={onToggleSelect}
        className={`grid h-5 w-5 shrink-0 place-items-center rounded border transition-opacity ${
          selected
            ? "border-emerald-500 bg-emerald-500"
            : "border-white/40 bg-black/30 hover:border-emerald-400"
        }`}
        aria-label={selected ? "取消选择" : "选择"}
      >
        {selected && <CheckSquare className="h-3 w-3 text-white" />}
      </button>
      <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-md bg-[#2a2a2a]">
        {image ? (
          <img src={image} alt={getEntityLabel(item)} className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        ) : (
          <span className="text-xs text-[#888]">{getEntityLabel(item).slice(0, 2) || entityLabel.slice(0, 2)}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-sm text-white truncate">
          {getEntityLabel(item)}
        </div>
        <div className="text-xs text-[#666] truncate">
          {metaLabel}: {deletedAt ? new Date(deletedAt).toLocaleString() : "—"}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button variant="secondary" size="sm" onClick={onRestore} className="text-xs">
          <RotateCcw className="mr-1 h-3 w-3" />
          恢复
        </Button>
        <Button variant="destructive" size="sm" onClick={onPermanentDelete} className="text-xs">
          <Trash2 className="mr-1 h-3 w-3" />
          永久删除
        </Button>
      </div>
    </div>
  );
}
