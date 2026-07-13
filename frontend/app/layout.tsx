import type { Metadata } from "next";
import "./globals.css";
import { LayoutShell } from "@/components/layout/layout-shell";
import { ErrorBoundary } from "@/components/layout/error-boundary";
import { ToastContainer } from "@/components/common/toast";

export const metadata: Metadata = {
  title: "AI 漫剧工业化生产平台",
  description: "一站式 AI 漫剧工业化生成平台",
};

/**
 * 根布局：唯一包含 <html>/<body> 的布局。
 * 通过 LayoutShell 客户端组件根据路径决定是否显示侧边栏。
 * 顶层包一层 ErrorBoundary，防止单页错误白屏整站。
 * 挂载 ToastContainer 让 toast.success/error/progress 等方法在所有页面生效。
 */
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" className="dark">
      <body>
        <ErrorBoundary>
          <LayoutShell>{children}</LayoutShell>
        </ErrorBoundary>
        <ToastContainer />
      </body>
    </html>
  );
}
