"use client";

/**
 * 导入预览弹窗
 *
 * 展示解析结果：剧集列表、每个剧集下的场景、每个场景下的对白；
 * 展示 AI 提取出的角色 / 场景 / 道具与现有工厂资产的匹配状态。
 * 用户确认后调用 onConfirm 写入数据库。
 */

import { useMemo } from "react";
import { Check, Eye, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EpisodePreview } from "./EpisodePreview";
import { CharacterAssetCards, SceneAssetCards, PropAssetCards } from "./AssetPreviewCards";
import type { PreviewResult } from "./types";

export interface PreviewDialogProps {
  preview: PreviewResult;
  isImporting: boolean;
  onTitleChange: (title: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function PreviewDialog({
  preview,
  isImporting,
  onTitleChange,
  onConfirm,
  onCancel,
}: PreviewDialogProps) {
  const stats = useMemo(() => {
    const totalScenes = preview.episodes.reduce((s, ep) => s + ep.scenes.length, 0);
    const totalDialogues = preview.episodes.reduce(
      (s, ep) => s + ep.scenes.reduce((s2, sc) => s2 + sc.dialogues.length, 0),
      0
    );
    return {
      episodes: preview.episodes.length,
      scenes: totalScenes,
      dialogues: totalDialogues,
      characters: preview.characters.length,
      matched: preview.characters.filter((c) => c.matchStatus === "matched").length,
      willCreate: preview.characters.filter((c) => c.matchStatus === "will_create").length,
      unresolved: preview.characters.filter((c) => c.matchStatus === "unresolved").length,
      sceneAssetsCount: preview.sceneAssets.length,
      propAssetsCount: preview.propAssets.length,
      scenesMatched: preview.sceneAssets.filter((s) => s.matchStatus === "matched").length,
      scenesWillCreate: preview.sceneAssets.filter((s) => s.matchStatus === "will_create").length,
      propsMatched: preview.propAssets.filter((p) => p.matchStatus === "matched").length,
      propsWillCreate: preview.propAssets.filter((p) => p.matchStatus === "will_create").length,
    };
  }, [preview]);

  const sourceBadge =
    preview.source === "ai"
      ? { label: "AI 大模型", color: "bg-purple-500/20 text-purple-300 border-purple-500/40" }
      : { label: "本地正则", color: "bg-amber-500/20 text-amber-300 border-amber-500/40" };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <div className="w-[1100px] max-w-[95vw] max-h-[90vh] bg-[#1a1a1a] rounded-xl border border-white/10 shadow-2xl flex flex-col overflow-hidden">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-[#252525]">
          <div className="flex items-center gap-3">
            <div>
              <div className="text-sm font-medium text-white flex items-center gap-2">
                <Eye className="h-4 w-4 text-emerald-400" />
                导入预览
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-[#888] flex-shrink-0">剧本标题</span>
                <input
                  className="h-8 w-80 max-w-[50vw] rounded border border-white/10 bg-[#1a1a1a] px-2 text-sm text-white outline-none focus:border-emerald-500/60"
                  value={preview.title}
                  onChange={(event) => onTitleChange(event.target.value)}
                  placeholder="请输入剧本标题"
                  disabled={isImporting}
                />
              </div>
              <div className="text-xs text-[#888] mt-1">
                请确认解析结果。点击「确认导入」将写入数据库。
              </div>
            </div>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full border ${sourceBadge.color}`}
            >
              {sourceBadge.label}
            </span>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 统计信息 */}
        <div className="px-4 py-2 border-b border-white/10 bg-[#1f1f1f] flex items-center gap-4 text-xs flex-wrap">
          <span className="text-[#888]">
            格式: <span className="text-white">{preview.format.toUpperCase()}</span>
          </span>
          <span className="text-[#888]">
            剧集: <span className="text-emerald-400">{stats.episodes}</span>
          </span>
          <span className="text-[#888]">
            场景: <span className="text-emerald-400">{stats.scenes}</span>
          </span>
          <span className="text-[#888]">
            对白: <span className="text-emerald-400">{stats.dialogues}</span>
          </span>
          <span className="text-[#888]">
            角色: <span className="text-emerald-400">{stats.characters}</span>
            {stats.characters > 0 && (
              <span className="ml-1">
                <span className="text-green-400">✓{stats.matched}</span>
                {" / "}
                <span className="text-blue-400">+{stats.willCreate}</span>
                {stats.unresolved > 0 && (
                  <>
                    {" / "}
                    <span className="text-gray-500">?{stats.unresolved}</span>
                  </>
                )}
              </span>
            )}
          </span>
          <span className="text-[#888]">
            道具: <span className="text-emerald-400">{stats.propAssetsCount}</span>
          </span>
          {preview.episodes.length === 0 && (
            <span className="text-yellow-400">⚠ 未识别到剧集</span>
          )}
        </div>

        {/* 角色资产匹配区 */}
        <CharacterAssetCards
          characters={preview.characters}
          matched={stats.matched}
          willCreate={stats.willCreate}
          unresolved={stats.unresolved}
        />

        {/* 场景资产匹配区 */}
        <SceneAssetCards
          sceneAssets={preview.sceneAssets}
          scenesMatched={stats.scenesMatched}
          scenesWillCreate={stats.scenesWillCreate}
          sceneAssetsCount={stats.sceneAssetsCount}
        />

        {/* 道具资产匹配区 */}
        <PropAssetCards
          propAssets={preview.propAssets}
          propsMatched={stats.propsMatched}
          propsWillCreate={stats.propsWillCreate}
          propAssetsCount={stats.propAssetsCount}
        />

        {/* 解析结果列表 */}
        <EpisodePreview episodes={preview.episodes} />

        {/* 底部操作 */}
        <div className="px-4 py-3 border-t border-white/10 bg-[#252525] flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={isImporting}>
            返回编辑
          </Button>
          <Button size="sm" onClick={onConfirm} disabled={isImporting}>
            {isImporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                导入中...
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                确认导入
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
