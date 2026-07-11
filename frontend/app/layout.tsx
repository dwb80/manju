import type { Metadata } from "next";
import "./globals.css";
import { AppSidebar } from "@/components/layout/app-sidebar";

export const metadata: Metadata = {
  title: "AI 漫剧工业化生产平台",
  description: "一站式 AI 漫剧工业化生成平台",
};

/**
 * 根布局：左侧 AppSidebar + 右侧页面内容。
 * 驾驶舱（/）、AI 生产中心、管理中心下的所有页面都共用这套布局。
 */
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" className="dark">
      <body>
        <div className="flex h-screen w-screen overflow-hidden bg-[#181818]">
          <AppSidebar />
          <main className="flex-1 min-w-0 min-h-0 overflow-auto">{children}</main>
        </div>
      </body>
    </html>
  );
}
