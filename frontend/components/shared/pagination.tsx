"use client";

/**
 * 通用分页组件
 *
 * 功能：
 * - 页码切换（上一页/下一页、首页/尾页）
 * - 每页显示数量选择
 * - 快速跳转输入框
 * - 总数显示
 * - 响应式设计（移动端简化显示）
 * - 键盘导航支持
 *
 * 设计原则：
 * - 深色主题（bg-[#252525])
 * - 圆角矩形设计
 * - 当前页使用品牌色（emerald-500）
 * - 禁用状态使用灰色（#888）
 */

import { useState, useCallback, KeyboardEvent } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

/**
 * 分页组件Props
 */
export interface PaginationProps {
  /** 当前页码（从1开始） */
  currentPage: number;
  /** 总页数 */
  totalPages: number;
  /** 总条目数 */
  totalItems: number;
  /** 每页显示数量 */
  pageSize: number;
  /** 页码切换回调 */
  onPageChange: (page: number) => void;
  /** 每页显示数量切换回调（可选） */
  onPageSizeChange?: (size: number) => void;
  /** 每页显示数量选项 */
  pageSizeOptions?: number[];
  /** 是否显示每页数量选择器 */
  showPageSize?: boolean;
  /** 是否显示总数 */
  showTotal?: boolean;
  /** 是否显示快速跳转 */
  showQuickJumper?: boolean;
}

/**
 * 分页组件
 */
export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  showPageSize = true,
  showTotal = true,
  showQuickJumper = true,
}: PaginationProps) {
  // 快速跳转输入值
  const [jumpValue, setJumpValue] = useState<string>("");

  /**
   * 计算需要显示的页码范围
   * 显示策略：首页 + ... + 当前页附近 + ... + 尾页
   */
  const getPageNumbers = useCallback(() => {
    const pages: (number | "ellipsis")[] = [];

    // 如果总页数小于7，显示所有页码
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
      return pages;
    }

    // 总是显示首页
    pages.push(1);

    // 计算当前页附近的页码范围
    const leftBound = Math.max(2, currentPage - 2);
    const rightBound = Math.min(totalPages - 1, currentPage + 2);

    // 左侧省略号
    if (leftBound > 2) {
      pages.push("ellipsis");
    }

    // 当前页附近的页码
    for (let i = leftBound; i <= rightBound; i++) {
      pages.push(i);
    }

    // 右侧省略号
    if (rightBound < totalPages - 1) {
      pages.push("ellipsis");
    }

    // 总是显示尾页
    if (totalPages > 1) {
      pages.push(totalPages);
    }

    return pages;
  }, [currentPage, totalPages]);

  /**
   * 处理页码跳转
   */
  const handleJump = useCallback(() => {
    const page = parseInt(jumpValue, 10);
    if (page >= 1 && page <= totalPages) {
      onPageChange(page);
      setJumpValue("");
    }
  }, [jumpValue, totalPages, onPageChange]);

  /**
   * 处理键盘事件
   */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        handleJump();
      }
    },
    [handleJump]
  );

  /**
   * 处理每页数量切换
   */
  const handlePageSizeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const size = parseInt(e.target.value, 10);
      if (onPageSizeChange) {
        onPageSizeChange(size);
        // 切换每页数量后，回到第一页
        onPageChange(1);
      }
    },
    [onPageSizeChange, onPageChange]
  );

  // 如果只有一页或没有数据，不显示分页
  if (totalPages <= 1) {
    return null;
  }

  const pageNumbers = getPageNumbers();

  return (
    <div className="flex flex-nowrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-[#252525] px-3 py-2 whitespace-nowrap">
      {/* 左侧：总数、每页数量、快速跳转 */}
      <div className="flex flex-nowrap items-center gap-3 shrink-0 min-w-0">
        {showTotal && (
          <div className="text-xs text-[#888] whitespace-nowrap">
            共 <span className="font-medium text-white">{totalItems}</span> 条
          </div>
        )}

        {showPageSize && onPageSizeChange && (
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="text-xs text-[#888]">每页</span>
            <select
              value={pageSize}
              onChange={handlePageSizeChange}
              className="rounded border border-white/10 bg-[#1a1a1a] px-1.5 py-0.5 text-xs text-white focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <span className="text-xs text-[#888]">条</span>
          </div>
        )}

        {/* 快速跳转 - 整合到同一行 */}
        {showQuickJumper && (
          <div className="hidden md:flex items-center gap-1.5 whitespace-nowrap">
            <span className="text-xs text-[#888]">跳至</span>
            <input
              type="number"
              min={1}
              max={totalPages}
              value={jumpValue}
              onChange={(e) => setJumpValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-14 rounded border border-white/10 bg-[#1a1a1a] px-1.5 py-0.5 text-xs text-white focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
              placeholder={currentPage.toString()}
            />
            <span className="text-xs text-[#888]">页</span>
            <button
              onClick={handleJump}
              className="rounded border border-white/10 bg-[#1a1a1a] px-2 py-0.5 text-xs text-white transition-colors hover:bg-white/10"
            >
              确定
            </button>
          </div>
        )}
      </div>

      {/* 右侧：页码导航 */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* 首页按钮 - 移动端隐藏 */}
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className="hidden rounded border border-white/10 bg-[#1a1a1a] p-1 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50 sm:block"
          aria-label="首页"
        >
          <ChevronsLeft className="h-4 w-4 text-[#888]" />
        </button>

        {/* 上一页按钮 */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="rounded border border-white/10 bg-[#1a1a1a] p-1 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="上一页"
        >
          <ChevronLeft className="h-4 w-4 text-[#888]" />
        </button>

        {/* 页码按钮 - 移动端只显示当前页 */}
        <div className="hidden sm:flex items-center gap-1">
          {pageNumbers.map((page, index) =>
            page === "ellipsis" ? (
              <span key={`ellipsis-${index}`} className="px-1 text-[#888]">
                ...
              </span>
            ) : (
              <button
                key={page}
                onClick={() => onPageChange(page)}
                className={`min-w-[28px] rounded border px-1.5 py-0.5 text-xs transition-colors whitespace-nowrap ${
                  currentPage === page
                    ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-400 font-medium"
                    : "border-white/10 bg-[#1a1a1a] text-[#888] hover:bg-white/10"
                }`}
                aria-label={`第${page}页`}
                aria-current={currentPage === page ? "page" : undefined}
              >
                {page}
              </button>
            )
          )}
        </div>

        {/* 移动端：当前页显示 */}
        <div className="flex sm:hidden items-center gap-1 px-1">
          <span className="text-xs text-emerald-400 font-medium">{currentPage}</span>
          <span className="text-xs text-[#888]">/ {totalPages}</span>
        </div>

        {/* 下一页按钮 */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="rounded border border-white/10 bg-[#1a1a1a] p-1 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="下一页"
        >
          <ChevronRight className="h-4 w-4 text-[#888]" />
        </button>

        {/* 尾页按钮 - 移动端隐藏 */}
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className="hidden rounded border border-white/10 bg-[#1a1a1a] p-1 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50 sm:block"
          aria-label="尾页"
        >
          <ChevronsRight className="h-4 w-4 text-[#888]" />
        </button>
      </div>
    </div>
  );
}