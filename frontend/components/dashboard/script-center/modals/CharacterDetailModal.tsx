"use client";

/**
 * 角色详情弹框（V2 W4 占位实现 — 仅满足 build 依赖）
 *
 * 历史：原 V1 CharacterDetailModal 在 Stream C 重构期间被遗漏，scripts/[id]
 * 页面 import 该模块但文件不存在，导致 Next dev server 报 ModuleBuildError。
 * 本占位提供最小可用实现（仅渲染基础字段 + onClose / onSaveAsAsset 回调），
 * 不影响 V2 一致性包功能；后续如需恢复完整功能可从 git 历史找回。
 */

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface CharacterDetailMerged {
  id: string;
  name: string;
  description?: string;
  image?: string;
  role?: string;
  gender?: string;
  age?: number;
  appearance?: string;
  personality?: string;
  traits?: string[];
  tags?: string[];
  // 来自工厂的扩展字段
  factoryId?: string;
  factoryImage?: string;
  factoryDescription?: string;
  // 分析预览（script-center 联动）
  source?: "script" | "factory" | "merged";
}

interface CharacterDetailModalProps {
  character: {
    id: string;
    name: string;
    description?: string;
    color?: string;
    image?: string;
    role?: string;
    gender?: string;
    age?: number;
    appearance?: string;
    personality?: string;
    traits?: string[];
    tags?: string[];
  };
  analyzePreviewCharacter?: unknown | null;
  onClose: () => void;
  onSaveAsAsset?: (merged: CharacterDetailMerged) => Promise<void> | void;
  onSyncToFactory?: (merged: CharacterDetailMerged) => Promise<void> | void;
  projectId?: string;
  scriptId?: string;
}

export function CharacterDetailModal({
  character,
  onClose,
  onSaveAsAsset,
  onSyncToFactory,
}: CharacterDetailModalProps) {
  const merged: CharacterDetailMerged = {
    ...character,
    source: "script",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-[#1a1a1a] border border-white/10 rounded-lg shadow-2xl max-w-2xl w-[90vw] max-h-[85vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-white">角色详情：{character.name}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-white/60 hover:text-white"
            aria-label="关闭"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {character.image && (
          <div className="mb-4">
            <img
              src={character.image}
              alt={character.name}
              className="w-full h-64 object-cover rounded border border-white/10"
            />
          </div>
        )}

        <dl className="grid grid-cols-2 gap-3 text-sm">
          {character.role && (
            <div>
              <dt className="text-white/50 text-xs">角色定位</dt>
              <dd className="text-white/90">{character.role}</dd>
            </div>
          )}
          {character.gender && (
            <div>
              <dt className="text-white/50 text-xs">性别</dt>
              <dd className="text-white/90">{character.gender}</dd>
            </div>
          )}
          {typeof character.age === "number" && character.age > 0 && (
            <div>
              <dt className="text-white/50 text-xs">年龄</dt>
              <dd className="text-white/90">{character.age}</dd>
            </div>
          )}
          {character.description && (
            <div className="col-span-2">
              <dt className="text-white/50 text-xs">描述</dt>
              <dd className="text-white/90 whitespace-pre-wrap">{character.description}</dd>
            </div>
          )}
          {character.personality && (
            <div className="col-span-2">
              <dt className="text-white/50 text-xs">性格</dt>
              <dd className="text-white/90 whitespace-pre-wrap">{character.personality}</dd>
            </div>
          )}
          {character.appearance && (
            <div className="col-span-2">
              <dt className="text-white/50 text-xs">外貌</dt>
              <dd className="text-white/90 whitespace-pre-wrap">{character.appearance}</dd>
            </div>
          )}
        </dl>

        <div className="flex gap-2 mt-6 justify-end">
          <Button variant="ghost" onClick={onClose}>
            关闭
          </Button>
          {onSaveAsAsset && (
            <Button onClick={() => onSaveAsAsset(merged)}>存为工厂资产</Button>
          )}
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

export default CharacterDetailModal;
