"use client";

/**
 * 道具详情弹框（V2 W4 占位实现 — 仅满足 build 依赖）
 *
 * 历史：原 V1 PropDetailModal 在 Stream C 重构期间被遗漏，scripts/[id]
 * 页面 import 该模块但文件不存在，导致 Next dev server 报 ModuleBuildError。
 * 本占位提供最小可用实现（仅渲染基础字段 + onClose / onSaveAsAsset 回调）。
 */

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface PropDetailMerged {
  id: string;
  name: string;
  description?: string;
  image?: string;
  category?: string;
  material?: string;
  importance?: string;
  importance_level?: string;
  owner?: string;
  appearance?: string;
  size?: string;
  color?: string;
  shape?: string;
  texture?: string;
  visual_features?: string;
  camera_usage?: string;
  story_function?: string;
  first_appearance?: string;
  tags?: string[];
  factoryId?: string;
  factoryImage?: string;
  factoryDescription?: string;
  source?: "script" | "factory" | "merged";
}

interface PropDetailModalProps {
  prop: {
    id: string;
    name: string;
    description?: string;
    image?: string;
    category?: string;
    material?: string;
  };
  analyzePreviewProp?: unknown | null;
  onClose: () => void;
  onSaveAsAsset?: (merged: PropDetailMerged) => Promise<void> | void;
  onSyncToFactory?: (merged: PropDetailMerged) => Promise<void> | void;
  projectId?: string;
  scriptId?: string;
}

export function PropDetailModal({
  prop,
  onClose,
  onSaveAsAsset,
  onSyncToFactory,
}: PropDetailModalProps) {
  const merged: PropDetailMerged = { ...prop, source: "script" };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-[#1a1a1a] border border-white/10 rounded-lg shadow-2xl max-w-2xl w-[90vw] max-h-[85vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-white">道具详情：{prop.name}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-white/60 hover:text-white"
            aria-label="关闭"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {prop.image && (
          <div className="mb-4">
            <img
              src={prop.image}
              alt={prop.name}
              className="w-full h-64 object-cover rounded border border-white/10"
            />
          </div>
        )}
        <dl className="grid grid-cols-2 gap-3 text-sm">
          {prop.category && (
            <div>
              <dt className="text-white/50 text-xs">分类</dt>
              <dd className="text-white/90">{prop.category}</dd>
            </div>
          )}
          {prop.material && (
            <div>
              <dt className="text-white/50 text-xs">材质</dt>
              <dd className="text-white/90">{prop.material}</dd>
            </div>
          )}
          {prop.description && (
            <div className="col-span-2">
              <dt className="text-white/50 text-xs">描述</dt>
              <dd className="text-white/90 whitespace-pre-wrap">{prop.description}</dd>
            </div>
          )}
        </dl>
        <div className="flex gap-2 mt-6 justify-end">
          <Button variant="ghost" onClick={onClose}>
            关闭
          </Button>
          {onSaveAsAsset && <Button onClick={() => onSaveAsAsset(merged)}>存为工厂资产</Button>}
          {onSyncToFactory && (
            <Button variant="outline" onClick={() => onSyncToFactory(merged)}>
              同步到工厂
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default PropDetailModal;
