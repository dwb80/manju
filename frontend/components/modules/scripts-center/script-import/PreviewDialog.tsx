"use client";

/**
 * 导入预览弹窗
 *
 * 关键设计（按需求变更）：
 * 1. 使用 React Portal 渲染到 document.body，脱离父级 DialogOverlay 的 DOM 与事件流，
 *    配合高 z-index（z-[200]）保证预览期间始终位于最顶端。
 * 2. 不再使用 lucide-react 图标（Eye / X / Check / Loader2 / ChevronDown 等），改用纯文本符号。
 * 3. 展示 AI 完整返回数据，导入时持久化到 ScriptDocument.ai_raw_data，不写入任何工厂。
 */

import { useMemo } from "react";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
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
  // 仅在客户端 mount 后才创建 portal，避免 hydration mismatch
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

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

  // 是否存在未完成匹配的资产
  const hasUnresolved = useMemo(() => {
    const all = [...preview.characters, ...preview.sceneAssets, ...preview.propAssets];
    return all.some((a) => a.matchStatus === "unresolved");
  }, [preview.characters, preview.sceneAssets, preview.propAssets]);

  // 阻止背景点击冒泡（虽然 Portal 已经隔离了 DOM，但保险起见）
  const stopProp = (e: React.MouseEvent) => e.stopPropagation();

  if (!mounted) return null;

  const dialog = (
    <div
      // z-[200] 远高于项目内其它对话框（最高 100），保证预览期间始终在最顶端
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4"
      // 阻止冒泡到任何父级 onClick handler
      onClick={stopProp}
    >
      <div className="w-[920px] max-w-[95vw] max-h-[90vh] bg-[#1a1a1a] rounded-xl border border-white/10 shadow-2xl flex flex-col overflow-hidden">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-[#252525] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div>
              <div className="text-sm font-medium text-white">导入预览</div>
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
                请确认解析结果。点击「确认导入」将写入数据库，AI 完整数据将一并保存（不写入任何工厂）。
              </div>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full border bg-purple-500/20 text-purple-300 border-purple-500/40">
              AI 大模型
            </span>
          </div>
          {/* 关闭按钮改为纯文本 "×"，避免 lucide-react X 图标 */}
          <button
            type="button"
            onClick={onCancel}
            className="text-gray-400 hover:text-white transition-colors text-xl leading-none w-7 h-7 flex items-center justify-center rounded hover:bg-white/10"
            aria-label="关闭"
            disabled={isImporting}
          >
            ×
          </button>
        </div>

        {/* 统计信息 */}
        <div className="px-4 py-2 border-b border-white/10 bg-[#1f1f1f] flex items-center gap-4 text-xs flex-wrap flex-shrink-0">
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

        {/* 可滚动内容区：让中间预览内容在弹窗高度受限时独立滚动，
            底部"确认导入"按钮始终可见。 */}
        <div className="flex-1 min-h-0 overflow-y-auto">
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
        </div>

        {/* 底部操作 */}
        <div className="px-4 py-3 border-t border-white/10 bg-[#252525] flex items-center justify-end gap-2 flex-shrink-0">
          {hasUnresolved && (
            <span className="text-xs text-amber-400 mr-auto">
              资产匹配中，请稍候...
            </span>
          )}
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={isImporting}>
            返回编辑
          </Button>
          <Button
            size="sm"
            onClick={onConfirm}
            disabled={isImporting || hasUnresolved}
            title={hasUnresolved ? "资产匹配未完成" : undefined}
          >
            {isImporting ? "导入中..." : "确认导入"}
          </Button>
        </div>
      </div>
    </div>
  );

  // 关键：Portal 到 body，脱离父级 DialogOverlay 的 DOM 与 z-index 上下文
  return createPortal(dialog, document.body);
}
