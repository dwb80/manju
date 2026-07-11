/**
 * 剧本编辑页面布局：直接透传 children，不添加额外包裹。
 * 侧边栏的隐藏由根布局中的 LayoutShell 根据路径处理。
 */
export default function ScriptsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;
}
