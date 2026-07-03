import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agnes AI Studio",
  description: "一站式 AI 创作平台",
};

/** Next.js 根布局，统一设置中文页面和暗色主题。 */
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" className="dark">
      <body>{children}</body>
    </html>
  );
}
