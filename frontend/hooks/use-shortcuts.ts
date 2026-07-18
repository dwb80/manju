/**
 * @file use-shortcuts.ts
 * @description 全局快捷键监听 Hook，提供统一的快捷键管理能力
 */

"use client";

import { useEffect, useCallback } from "react";

type ShortcutAction = () => void;

type ShortcutConfig = {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: ShortcutAction;
  description?: string;
};

/**
 * useShortcuts - 全局快捷键监听 Hook
 *
 * 支持的快捷键：
 * - Ctrl+K: 快速搜索（聚焦搜索框）
 * - Ctrl+/ : 打开/关闭 AI 助手面板
 * - Ctrl+1-9: 切换到对应项目页面
 * - Space: 预览选中资产
 * - E: 编辑选中项
 * - G: 生成图片
 * - V: 生成视频
 *
 * @param onQuickSearch - 快速搜索回调
 * @param onToggleAIAssistant - 切换 AI 助手回调
 * @param onSwitchProject - 切换项目回调，接收项目索引
 * @param onPreviewAsset - 预览资产回调
 * @param onEditItem - 编辑项目回调
 * @param onGenerateImage - 生成图片回调
 * @param onGenerateVideo - 生成视频回调
 * @param enabled - 是否启用快捷键，默认 true
 *
 * @returns shortcuts - 快捷键列表
 *
 * @example
 * ```tsx
 * const { shortcuts } = useShortcuts({
 *   onQuickSearch: () => focusSearch(),
 *   onEditItem: () => openEditDialog(),
 *   enabled: true,
 * });
 * ```
 */
export function useShortcuts({
  onQuickSearch,
  onToggleAIAssistant,
  onSwitchProject,
  onPreviewAsset,
  onEditItem,
  onGenerateImage,
  onGenerateVideo,
  enabled = true,
}: {
  onQuickSearch?: ShortcutAction;
  onToggleAIAssistant?: ShortcutAction;
  onSwitchProject?: (index: number) => void;
  onPreviewAsset?: ShortcutAction;
  onEditItem?: ShortcutAction;
  onGenerateImage?: ShortcutAction;
  onGenerateVideo?: ShortcutAction;
  enabled?: boolean;
}) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // 忽略输入框中的快捷键（除了Ctrl+K等特殊快捷键）
      const target = event.target as HTMLElement;
      const isInputField = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;

      // Ctrl+K: 快速搜索（在输入框中也有效）
      if (event.ctrlKey && event.key === "k") {
        event.preventDefault();
        onQuickSearch?.();
        return;
      }

      // Ctrl+/: 打开/关闭AI助手面板
      if (event.ctrlKey && event.key === "/") {
        event.preventDefault();
        onToggleAIAssistant?.();
        return;
      }

      // Ctrl+1-9: 切换到对应项目页面
      if (event.ctrlKey && /^[1-9]$/.test(event.key)) {
        event.preventDefault();
        const index = Number(event.key);
        onSwitchProject?.(index);
        return;
      }

      // 在输入框中时，忽略其他快捷键
      if (isInputField) return;

      // Space: 预览选中资产
      if (event.key === " " && !event.ctrlKey && !event.shiftKey && !event.altKey) {
        event.preventDefault();
        onPreviewAsset?.();
        return;
      }

      // E: 编辑选中项
      if (event.key === "e" && !event.ctrlKey && !event.shiftKey && !event.altKey) {
        event.preventDefault();
        onEditItem?.();
        return;
      }

      // G: 生成图片
      if (event.key === "g" && !event.ctrlKey && !event.shiftKey && !event.altKey) {
        event.preventDefault();
        onGenerateImage?.();
        return;
      }

      // V: 生成视频
      if (event.key === "v" && !event.ctrlKey && !event.shiftKey && !event.altKey) {
        event.preventDefault();
        onGenerateVideo?.();
        return;
      }
    },
    [
      enabled,
      onQuickSearch,
      onToggleAIAssistant,
      onSwitchProject,
      onPreviewAsset,
      onEditItem,
      onGenerateImage,
      onGenerateVideo,
    ]
  );

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, handleKeyDown]);

  return {
    shortcuts: [
      { key: "Ctrl+K", description: "快速搜索" },
      { key: "Ctrl+/", description: "打开/关闭AI助手" },
      { key: "Ctrl+1-9", description: "切换项目页面" },
      { key: "Space", description: "预览选中资产" },
      { key: "E", description: "编辑选中项" },
      { key: "G", description: "生成图片" },
      { key: "V", description: "生成视频" },
    ],
  };
}