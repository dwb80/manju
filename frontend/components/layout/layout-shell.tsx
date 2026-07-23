"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppSidebar } from "./app-sidebar";
import { GlobalTopBar } from "./global-top-bar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CommandPalette } from "@/components/layout/command-palette";

/**
 * 布局外壳：根据当前路径决定是否显示侧边栏。
 * 新标签页打开的"独占式编辑页"（剧本编辑器、角色图片编辑）不显示侧边栏。
 *
 * 路由持久化：
 * - 每次路径变化时把 pathname 写入 sessionStorage（"app:lastRoute"）
 * - 首次挂载时若当前是根路径 "/" 且有非根保存路径，调用 router.replace 恢复
 *   - 解决开发态热启动 + 浏览器刷新后 URL 退化为 http://localhost:3001/ 的问题
 *   - sessionStorage 跟随标签页，关闭后清空，不会跨会话污染
 *   - 显式导航到 "/" 时也会被记录；下次刷新如果 URL 仍是 "/" 则不会误跳
 */
const LAST_ROUTE_KEY = "app:lastRoute";

/**
 * LayoutShell - 布局外壳组件
 * @param {Readonly<{ children: React.ReactNode }>} props - 组件属性
 * @returns {JSX.Element} 渲染的布局外壳元素
 */
export function LayoutShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (typeof window === "undefined" || !pathname) return;

    if (isInitialMount.current) {
      isInitialMount.current = false;
      // 首次挂载：仅在当前是根路径时尝试恢复
      if (pathname === "/") {
        const saved = window.sessionStorage.getItem(LAST_ROUTE_KEY)
        if (saved && saved !== "/" && saved !== pathname) {
          // 放到下一帧再跳转，避免与 Next.js 水合冲突导致闪烁
          requestAnimationFrame(() => {
            router.replace(saved)
          })
          return
        }
      }
      // 首次挂载时同步记录一次当前路径（覆盖上次的值）
      window.sessionStorage.setItem(LAST_ROUTE_KEY, pathname)
    } else {
      // 路径变化时记录当前路径
      window.sessionStorage.setItem(LAST_ROUTE_KEY, pathname)
    }
  }, [pathname, router])

  const isScriptEditor = pathname?.startsWith("/scripts/")
  // 角色图片编辑：/characters/[id]/edit（与 props/[id]/edit 共享逻辑）
  const isCharacterEdit = /^\/characters\/[^/]+\/edit\/?$/.test(pathname ?? "")
  const isPropEdit = /^\/props\/[^/]+\/edit\/?$/.test(pathname ?? "")

  if (pathname === "/login") return <>{children}</>

  if (isScriptEditor || isCharacterEdit || isPropEdit) {
    // 独占式编辑页（剧本编辑器、角色图片编辑、道具编辑）不显示侧边栏，
    // 但仍要保留顶部导航栏，让用户能随时切换项目 / 返回其他工作区。
    return (
      <TooltipProvider delayDuration={200}>
        <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#0a0a0a]">
          <GlobalTopBar />
          <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
        </div>
        <CommandPalette />
      </TooltipProvider>
    )
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-screen w-screen overflow-hidden bg-[#181818]">
        <AppSidebar />
        <main
          id="main-content"
          tabIndex={-1}
          className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
        >
          <GlobalTopBar />
          <div className="min-h-0 flex-1 overflow-auto">{children}</div>
        </main>
      </div>
      <CommandPalette />
    </TooltipProvider>
  )
}
