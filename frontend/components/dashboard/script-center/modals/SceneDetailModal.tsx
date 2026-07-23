"use client";

/**
 * 场景详情弹框（V2 W4 占位实现 — 仅满足 build 依赖）
 *
 * 历史：原 V1 SceneDetailModal 在 Stream C 重构期间被遗漏，scripts/[id]
 * 页面 import 该模块但文件不存在，导致 Next dev server 报 ModuleBuildError。
 * 本占位提供最小可用实现（仅渲染基础字段 + onClose / onSaveAsAsset 回调）。
 */

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface SceneDetailMerged {
  id: string;
  name: string;
  description?: string;
  image?: string;
  type?: string;
  location?: string;
  timeOfDay?: string;
  time_of_day?: string;
  atmosphere?: string;
  category?: string;
  lighting?: string;
  weather?: string;
  architecture?: string;
  terrain?: string;
  plants?: string;
  objects?: string;
  period?: string;
  tone?: string;
  visual_style?: string;
  atmosphere_emotion?: string;
  indoor_outdoor?: string;
  tags?: string[];
  factoryId?: string;
  factoryImage?: string;
  factoryDescription?: string;
  source?: "script" | "factory" | "merged";
}

interface SceneDetailModalProps {
  scene: {
    id: string;
    name: string;
    description?: string;
    image?: string;
    type?: string;
    location?: string;
  };
  analyzePreviewScene?: unknown | null;
  onClose: () => void;
  onSaveAsAsset?: (merged: SceneDetailMerged) => Promise<void> | void;
  onSyncToFactory?: (merged: SceneDetailMerged) => Promise<void> | void;
  projectId?: string;
  scriptId?: string;
}

export function SceneDetailModal({
  scene,
  onClose,
  onSaveAsAsset,
  onSyncToFactory,
}: SceneDetailModalProps) {
  const merged: SceneDetailMerged = { ...scene, source: "script" };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-[#1a1a1a] border border-white/10 rounded-lg shadow-2xl max-w-2xl w-[90vw] max-h-[85vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-white">场景详情：{scene.name}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-white/60 hover:text-white"
            aria-label="关闭"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {scene.image && (
          <div className="mb-4">
            <img
              src={scene.image}
              alt={scene.name}
              className="w-full h-64 object-cover rounded border border-white/10"
            />
          </div>
        )}
        <dl className="grid grid-cols-2 gap-3 text-sm">
          {scene.type && (
            <div>
              <dt className="text-white/50 text-xs">类型</dt>
              <dd className="text-white/90">{scene.type}</dd>
            </div>
          )}
          {scene.location && (
            <div>
              <dt className="text-white/50 text-xs">地点</dt>
              <dd className="text-white/90">{scene.location}</dd>
            </div>
          )}
          {scene.description && (
            <div className="col-span-2">
              <dt className="text-white/50 text-xs">描述</dt>
              <dd className="text-white/90 whitespace-pre-wrap">{scene.description}</dd>
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

export default SceneDetailModal;
