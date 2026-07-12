/**
 * 剧本编辑页面布局：套一层 ErrorBoundary 隔离剧本编辑器/工厂加载错误，
 * 避免单个剧本页崩溃影响整站。
 * 侧边栏的隐藏由根布局中的 LayoutShell 根据路径处理。
 */
import { ErrorBoundary } from "@/components/layout/error-boundary";

export default function ScriptsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}
