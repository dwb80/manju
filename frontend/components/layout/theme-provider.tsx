/**
 * @file theme-provider.tsx
 * @description 主题 Provider：监听 useThemeStore 并把 light/dark className 同步到 <html>
 *
 * 设计动机：
 * - 原 layout 写死 `<html className="dark">`，所有页面都强制深色
 * - P1 评审要求支持 light mode / system preference
 * - 通过 store 订阅式同步，避免全局 re-render
 *
 * 用法：
 *   <ThemeProvider>{children}</ThemeProvider>
 */

"use client";

import { useEffect } from "react";
import { useThemeStore, resolveThemeClass } from "@/lib/stores/theme-store";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useThemeStore((s) => s.theme);

  // 初次挂载与 theme 变化时同步到 <html>
  useEffect(() => {
    if (typeof document === "undefined") return;
    const cls = resolveThemeClass(theme);
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(cls);
    root.style.colorScheme = cls;
  }, [theme]);

  // system 模式：监听系统主题变化
  useEffect(() => {
    if (theme !== "system") return;
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const cls = resolveThemeClass("system");
      const root = document.documentElement;
      root.classList.remove("light", "dark");
      root.classList.add(cls);
      root.style.colorScheme = cls;
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  return <>{children}</>;
}
