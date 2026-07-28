/**
 * @file theme-store.ts
 * @description 主题状态管理（light / dark / system）
 *
 * P1 评审修复：
 * - 增加 light mode 主题支持
 * - 集成 system preference 自动切换
 * - 持久化到 localStorage
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeMode = "light" | "dark" | "system";

interface ThemeState {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
}

/**
 * 系统偏好是否偏暗（仅在浏览器 API 可用时）
 */
export function systemPrefersDark(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? true;
}

/**
 * 根据 theme 模式解析出最终应用于 <html> 的 className
 */
export function resolveThemeClass(theme: ThemeMode): "light" | "dark" {
  if (theme === "system") {
    return systemPrefersDark() ? "dark" : "light";
  }
  return theme;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: "dark",
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: "theme-preference",
    },
  ),
);
