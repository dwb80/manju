import type { Metadata } from "next";
import "./globals.css";
import { BrowserCompatibilityBanner } from "@/components/layout/browser-compatibility-banner";
import { LayoutShell } from "@/components/layout/layout-shell";
import { ErrorBoundary } from "@/components/layout/error-boundary";
import { ToastContainer } from "@/components/common/toast";

/**
 * 根布局：完整 V2 layout 链。
 *
 * - BrowserCompatibilityBanner：不支持浏览器时顶部提示
 * - skip-to-content：无障碍跳转链接
 * - ErrorBoundary：捕获子组件渲染错误并显示降级 UI
 * - LayoutShell：渲染侧边栏 + 顶部导航栏 + 命令面板，根据 pathname 切换
 *   独占式编辑页（剧本/角色/道具编辑）只保留顶部导航
 * - ToastContainer：全局消息提示
 */
export const metadata: Metadata = {
  title: "AI 漫剧工业化生产平台",
  description: "一站式 AI 漫剧工业化生成平台",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" className="dark">
      <body>
        <a className="skip-to-content" href="#main-content">跳到主要内容</a>
        <BrowserCompatibilityBanner />
        <ErrorBoundary>
          <LayoutShell>{children}</LayoutShell>
        </ErrorBoundary>
        <ToastContainer />
      </body>
    </html>
  );
}
