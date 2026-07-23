"use client";

/**
 * @file command-palette.tsx
 * @description 命令面板占位（V2 W4 — 仅满足 build 依赖）
 *
 * 历史：原 V1 CommandPalette 在 Stream C 重构期间被遗漏，layout-shell
 * 和 page-container 都 import 该模块，导致 Next dev server 报 ModuleBuildError。
 * 本占位提供最小可用实现：键盘 ⌘K 触发的命令面板 UI 壳子 + openCommandPalette() 编程式打开。
 * 实际命令列表注册逻辑可后续从 git 历史恢复，本任务不强求。
 */

import { useEffect, useState } from "react";
import { Command } from "lucide-react";

const SHORTCUT = (typeof window !== "undefined" && navigator?.platform?.toLowerCase().includes("mac")) ? "⌘K" : "Ctrl+K";

/**
 * 编程式打开命令面板（当前为 no-op：UI 默认根据快捷键自动打开）。
 * 保留此函数导出以满足 page-container.tsx 的调用点。
 */
export function openCommandPalette(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("app:open-command-palette"));
}

/**
 * 命令面板 UI 壳子
 * - 监听 ⌘K / Ctrl+K 快捷键
 * - 监听 openCommandPalette() 触发的自定义事件
 * - 当前不实现具体命令，仅渲染搜索输入框占位
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    const onCustom = () => setOpen((v) => !v);
    window.addEventListener("keydown", onKey);
    window.addEventListener("app:open-command-palette", onCustom as EventListener);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("app:open-command-palette", onCustom as EventListener);
    };
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/60 pt-32"
      onClick={() => setOpen(false)}
    >
      <div
        className="bg-[#1a1a1a] border border-white/15 rounded-lg shadow-2xl w-[36rem] max-w-[90vw]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
          <Command className="h-4 w-4 text-white/50" />
          <input
            type="text"
            placeholder="输入命令（占位）…"
            className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-white/40"
            autoFocus
          />
          <kbd className="text-[10px] text-white/40 border border-white/10 px-1.5 py-0.5 rounded">
            {SHORTCUT}
          </kbd>
        </div>
        <div className="p-6 text-center text-white/40 text-sm">
          命令面板占位（W4 临时实现）
        </div>
      </div>
    </div>
  );
}

export default CommandPalette;
