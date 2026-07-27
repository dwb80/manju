import type { Metadata } from "next";
import "./globals.css";
import { BrowserCompatibilityBanner } from "@/components/layout/browser-compatibility-banner";
import { LayoutShell } from "@/components/layout/layout-shell";
import { ErrorBoundary } from "@/components/layout/error-boundary";
import { ToastContainer } from "@/components/common/toast";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { ConfirmDialogHost } from "@/lib/hooks/use-confirm";
import { OnboardingHost } from "@/lib/hooks/use-onboarding";
import { HelpCenterHost } from "@/components/common/help-center";

/**
 * 根布局：完整 V2 layout 链。
 *
 * - BrowserCompatibilityBanner：不支持浏览器时顶部提示
 * - skip-to-content：无障碍跳转链接
 * - ErrorBoundary：捕获子组件渲染错误并显示降级 UI
 * - LayoutShell：渲染侧边栏 + 顶部导航栏 + 命令面板，根据 pathname 切换
 *   独占式编辑页（剧本/角色/道具编辑）只保留顶部导航
 * - ToastContainer：全局消息提示
 * - ThemeProvider：应用主题（light / dark / system）
 * - ConfirmDialogHost：统一确认弹窗
 * - OnboardingHost：首次进入应用时自动弹出新手引导
 * - HelpCenterHost：右下角浮动帮助按钮 + 首次自动弹出
 */
export const metadata: Metadata = {
  title: "AI 漫剧工业化生产平台",
  description: "一站式 AI 漫剧工业化生成平台",
};

/**
 * 在 hydration 之前同步解析主题并写入 <html> class，避免初次渲染闪烁。
 * 行为：先读 localStorage，再读系统偏好；最后兜底 dark。
 */
const themeInitScript = `
(function() {
  try {
    var raw = localStorage.getItem('theme-preference');
    var mode = 'dark';
    if (raw) {
      var parsed = JSON.parse(raw);
      if (parsed && parsed.state && parsed.state.theme) {
        mode = parsed.state.theme;
      }
    }
    var resolved = mode;
    if (mode === 'system') {
      resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    var root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(resolved);
    root.style.colorScheme = resolved;
  } catch (e) {
    var r = document.documentElement;
    r.classList.remove('light');
    r.classList.add('dark');
    r.style.colorScheme = 'dark';
  }
})();
`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <a className="skip-to-content" href="#main-content">跳到主要内容</a>
        <BrowserCompatibilityBanner />
        <ErrorBoundary>
          <ThemeProvider>
            <LayoutShell>{children}</LayoutShell>
          </ThemeProvider>
        </ErrorBoundary>
        <ToastContainer />
        <ConfirmDialogHost />
        <OnboardingHost />
        <HelpCenterHost />
      </body>
    </html>
  );
}
