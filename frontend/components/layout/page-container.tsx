/**
 * @file page-container.tsx
 * @description 页面容器框架组件，提供统一的页面布局结构，包括页面标题、描述区域和顶部操作栏
 */

"use client";

import { ReactNode } from "react";
import { ArrowLeft, Bell, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { openCommandPalette } from "@/components/layout/command-palette";

/**
 * 页面容器框架组件
 *
 * 功能：
 * - 统一的页面布局结构
 * - 页面标题和描述区域
 * - 顶部操作栏
 * - 响应式设计
 * - 可选的面包屑导航
 */

interface PageContainerProps {
  /** 页面标题 */
  title: string;
  /** 页面描述（可选） */
  description?: string;
  /** 页面内容 */
  children: ReactNode;
  /** 顶部操作按钮（可选） */
  actions?: ReactNode;
  /** 是否显示返回按钮 */
  showBackButton?: boolean;
  /** 返回路径 */
  backPath?: string;
  /** 是否显示搜索按钮 */
  showSearchButton?: boolean;
  /** 是否显示通知按钮 */
  showNotificationButton?: boolean;
  /** 自定义头部内容（可选） */
  customHeader?: ReactNode;
  /** 页面背景色 */
  backgroundColor?: string;
  /** 是否显示底部状态栏 */
  showFooter?: boolean;
}

export function PageContainer({
  title,
  description,
  children,
  actions,
  showBackButton = false,
  backPath = "/",
  showSearchButton = true,
  showNotificationButton = true,
  customHeader,
  backgroundColor = "#1a1a1a",
  showFooter = false,
}: PageContainerProps) {
  const router = useRouter();

  const handleBack = () => {
    router.push(backPath);
  };

  const handleSearch = () => {
    openCommandPalette();
  };

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor }}>
      {/* 顶部导航栏 */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#1a1a1a]/95 backdrop-blur">
        {customHeader || (
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              {/* 左侧：返回按钮和标题 */}
              <div className="flex items-center gap-4">
                {showBackButton && (
                  <button
                    onClick={handleBack}
                    className="flex items-center gap-2 text-[#888] hover:text-white transition-colors"
                    aria-label="返回上一页"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                )}
                <div>
                  <h1 className="text-xl font-semibold text-white">{title}</h1>
                  {description && (
                    <p className="mt-1 text-sm text-[#888]">{description}</p>
                  )}
                </div>
              </div>

              {/* 右侧：操作按钮 */}
              <div className="flex items-center gap-3">
                {showSearchButton && (
                  <button
                    onClick={handleSearch}
                    className="rounded-lg p-2 text-[#888] hover:bg-white/10 hover:text-white transition-colors"
                    aria-label="全局搜索（Ctrl+K）"
                    title="全局搜索（Ctrl+K）"
                  >
                    <Search className="h-5 w-5" />
                  </button>
                )}

                {showNotificationButton && (
                  <button
                    className="relative rounded-lg p-2 text-[#888] hover:bg-white/10 hover:text-white transition-colors"
                    aria-label="通知"
                    title="通知"
                  >
                    <Bell className="h-5 w-5" />
                    <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-emerald-500" />
                  </button>
                )}

                {actions}
              </div>
            </div>
          </div>
        )}
      </header>

      {/* 主内容区域 */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-6">
          {children}
        </div>
      </main>

      {/* 底部状态栏（可选） */}
      {showFooter && (
        <footer className="border-t border-white/10 px-6 py-3">
          <div className="flex items-center justify-between text-xs text-[#888]">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500" />
              <span>系统运行正常</span>
            </div>
            <div>
              按 <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-white">Ctrl</kbd> + <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-white">K</kbd> 快速搜索
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}

/**
 * 页面内容卡片组件
 *
 * 用于在页面内创建统一的内容块
 */

interface PageCardProps {
  /** 卡片标题 */
  title?: string;
  /** 卡片描述（可选） */
  description?: string;
  /** 卡片内容 */
  children: ReactNode;
  /** 是否显示边框 */
  showBorder?: boolean;
  /** 自定义样式 */
  className?: string;
}

export function PageCard({
  title,
  description,
  children,
  showBorder = true,
  className = "",
}: PageCardProps) {
  return (
    <div
      className={`rounded-xl ${showBorder ? "border border-white/10" : ""
        } bg-[#202020] p-6 ${className}`}
    >
      {title && (
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          {description && (
            <p className="mt-1 text-sm text-[#888]">{description}</p>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

/**
 * 页面分隔组件
 *
 * 用于在页面内创建统一的分隔区域
 */

interface PageDividerProps {
  /** 分隔线标题（可选） */
  title?: string;
}

/**
 * PageDivider - 页面分隔组件
 * @param {PageDividerProps} props - 组件属性
 * @returns {JSX.Element} 渲染的分隔线元素
 */
export function PageDivider({ title }: PageDividerProps) {
  return (
    <div className="my-6">
      {title && (
        <div className="mb-3 text-sm font-medium text-[#888]">{title}</div>
      )}
      <div className="h-px bg-white/10" />
    </div>
  );
}