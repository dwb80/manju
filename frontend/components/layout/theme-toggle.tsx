/**
 * @file theme-toggle.tsx
 * @description 主题切换按钮（light / dark / system）
 *
 * 使用：
 *   <ThemeToggle />
 *   内联在 GlobalTopBar 的右侧
 */

"use client";

import { useEffect, useState } from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { useThemeStore, type ThemeMode } from "@/lib/stores/theme-store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const OPTIONS: { value: ThemeMode; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "浅色", Icon: Sun },
  { value: "dark", label: "深色", Icon: Moon },
  { value: "system", label: "跟随系统", Icon: Monitor },
];

export function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  // 防止 SSR/CSR mismatch：mounted 之前用固定 icon
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const current = OPTIONS.find((o) => o.value === theme) ?? OPTIONS[1];
  const CurrentIcon = current.Icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="切换主题"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {mounted ? <CurrentIcon className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {OPTIONS.map((opt) => {
          const Icon = opt.Icon;
          return (
            <DropdownMenuItem
              key={opt.value}
              onClick={() => setTheme(opt.value)}
              aria-label={opt.label}
              className={theme === opt.value ? "bg-muted" : undefined}
            >
              <Icon className="mr-2 h-4 w-4" />
              {opt.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
