"use client";

/**
 * StandalonePageHeader —— 独立页面的统一头部
 *
 * 设计动机（评审 P0-修复 C1/C2/C3）：
 * - 此前 /ai-tasks /models /data /publish 等独立页面各自写一份"返回首页 + 面包屑 + H1 + 描述"代码
 * - 4 个页面约 200+ 行重复样式/结构
 * - 抽到本组件后，所有独立页只需提供 title/description/extraRight 即可
 *
 * 设计原则：
 * - 单一职责：仅负责"页面级头部布局"，不涉及具体业务
 * - 可配置：标题、描述、面包屑、右侧辅助、错误提示均可选
 * - 可访问：面包屑带 aria-label，操作按钮带 aria-label
 *
 * 使用示例：
 *   <StandalonePageHeader
 *     title="AI 任务队列"
 *     description="监控跨项目、跨会话的 AI 生成任务"
 *     breadcrumbs={['首页', 'AI任务队列']}
 *     extraRight={<div>共 24 个任务</div>}
 *   />
 */

import { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, LayoutDashboard } from "lucide-react";
import { createLogger } from "@/lib/logger";

// 模块级 logger
const log = createLogger('standalone-page-header')

export interface StandalonePageHeaderProps {
  /** 页面主标题（H1） */
  title: string;
  /** 页面副标题/描述 */
  description?: string;
  /**
   * 面包屑（数组：按从外到内排列）
   * 例：['首页', 'AI任务队列'] 会渲染为 "首页 / AI任务队列"
   * 最后一项会被高亮为"当前页"
   */
  breadcrumbs?: string[];
  /** 右侧辅助信息（统计、刷新按钮等） */
  extraRight?: ReactNode;
  /** 返回路径（默认 "/"） */
  backPath?: string;
  /** 自定义背景色（默认 #181818） */
  backgroundColor?: string;
  /** 自定义背景透明度（默认 95） */
  opacity?: number;
}

/**
 * 独立页面统一头部
 */
export function StandalonePageHeader({
  title,
  description,
  breadcrumbs = [],
  extraRight,
  backPath = "/",
  backgroundColor = "#181818",
  opacity = 95,
}: StandalonePageHeaderProps) {
  const router = useRouter();

  /** 返回上层（点击返回首页按钮时调用） */
  const handleBack = () => {
    log.debug('back clicked', { backPath })
    router.push(backPath);
  };

  /** 点击面包屑中的非末尾项 */
  const handleBreadcrumbClick = (index: number, item: string) => {
    // 仅最外层（index=0）触发返回；其它视为占位
    if (index === 0) {
      log.debug('breadcrumb click', { item, to: backPath })
      router.push(backPath)
    }
  };

  return (
    <header
      className="sticky top-0 z-10 border-b border-white/10 px-6 py-4 backdrop-blur"
      style={{ backgroundColor: `${backgroundColor}/${opacity}` }}
    >
      <div className="flex items-center justify-between">
        {/* 左侧：返回按钮 + 面包屑 */}
        <div className="flex items-center gap-4">
          {/* 返回首页按钮 */}
          <button
            onClick={handleBack}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-[#888] transition-colors hover:bg-white/10 hover:text-white"
            aria-label={`返回${backPath === "/" ? "首页" : "上一页"}`}
          >
            <ArrowLeft className="h-4 w-4" />
            <span>返回首页</span>
          </button>

          {/* 分隔线 */}
          {breadcrumbs.length > 0 && (
            <div className="h-4 w-px bg-white/20" aria-hidden="true" />
          )}

          {/* 面包屑导航 */}
          {breadcrumbs.length > 0 && (
            <nav
              className="flex items-center gap-2 text-sm text-[#888]"
              aria-label="面包屑导航"
            >
              {breadcrumbs.map((item, index) => {
                const isLast = index === breadcrumbs.length - 1
                return (
                  <span key={item} className="flex items-center gap-2">
                    {index === 0 && (
                      <LayoutDashboard
                        className="h-3 w-3"
                        aria-hidden="true"
                      />
                    )}
                    {isLast ? (
                      <span className="text-white font-medium" aria-current="page">
                        {item}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleBreadcrumbClick(index, item)}
                        className="hover:text-white transition-colors"
                      >
                        {item}
                      </button>
                    )}
                    {!isLast && (
                      <span className="text-white/40" aria-hidden="true">
                        /
                      </span>
                    )}
                  </span>
                )
              })}
            </nav>
          )}
        </div>

        {/* 右侧：辅助信息 */}
        {extraRight && (
          <div className="flex items-center gap-4 text-xs text-[#888]">
            {extraRight}
          </div>
        )}
      </div>

      {/* 页面主标题与描述 */}
      <div className="mt-4">
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-[#888]">{description}</p>
        )}
      </div>
    </header>
  );
}
