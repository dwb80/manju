"use client";

import { usePathname } from "next/navigation";
import { AppSidebar } from "./app-sidebar";

/**
 * 布局外壳：根据当前路径决定是否显示侧边栏。
 * /scripts/[id] 编辑器页面在新标签页打开，不显示侧边栏。
 */
export function LayoutShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const isScriptEditor = pathname?.startsWith("/scripts/");

  if (isScriptEditor) {
    return (
      <div className="h-screen w-screen overflow-hidden bg-[#0a0a0a]">{children}</div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#181818]">
      <AppSidebar />
      <main className="flex-1 min-w-0 min-h-0 overflow-auto">{children}</main>
    </div>
  );
}
