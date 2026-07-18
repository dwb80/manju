/**
 * @file global-search.tsx
 * @description 全局搜索组件，支持快捷键激活、实时搜索结果、分类显示和键盘导航
 */

"use client";

import { useState, useEffect, useRef } from "react";
import { Search, Command, X, ArrowRight, FolderOpen, MessageSquare, Image, Video } from "lucide-react";

/**
 * 全局搜索组件
 *
 * 功能：
 * - 快捷键激活（Ctrl+K）
 * - 实时搜索结果
 * - 分类显示
 * - 键盘导航
 */

interface SearchItem {
  id: string;
  type: "project" | "conversation" | "task";
  title: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
}

export function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // 监听快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(true);
      }

      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }

      if (isOpen && e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex(Math.min(selectedIndex + 1, results.length - 1));
      }

      if (isOpen && e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(Math.max(selectedIndex - 1, 0));
      }

      if (isOpen && e.key === "Enter" && results.length > 0) {
        e.preventDefault();
        navigateToItem(results[selectedIndex]);
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, selectedIndex, results]);

  // 搜索逻辑
  useEffect(() => {
    if (query.trim()) {
      searchItems(query).then(setResults);
    } else {
      setResults([]);
    }
    setSelectedIndex(0);
  }, [query]);

  const searchItems = async (query: string): Promise<SearchItem[]> => {
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      return data.items || [];
    } catch (error) {
      console.error("Search failed:", error);
      return [];
    }
  };

  if (!isOpen) return null;

  const getIconComponent = (type: string) => {
    switch (type) {
      case "project":
        return FolderOpen;
      case "conversation":
        return MessageSquare;
      case "task":
        return Image;
      default:
        return Search;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#1a1a1a] shadow-2xl overflow-hidden">
        {/* 搜索框 */}
        <div className="flex items-center gap-3 p-4 border-b border-white/10">
          <Search className="h-5 w-5 text-[#888]" />
          <input
            ref={inputRef}
            type="text"
            placeholder="搜索项目、会话、任务..."
            className="flex-1 bg-transparent text-white placeholder-[#888] focus:outline-none"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            aria-label="搜索输入框"
          />
          <kbd className="hidden md:flex items-center gap-1 rounded bg-white/10 px-2 py-1 text-xs text-[#888]">
            <Command className="h-3 w-3" /> K
          </kbd>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 rounded hover:bg-white/10"
            aria-label="关闭搜索"
          >
            <X className="h-4 w-4 text-[#888]" />
          </button>
        </div>

        {/* 搜索结果 */}
        <div className="max-h-[400px] overflow-y-auto p-2" role="listbox">
          {results.length > 0 ? (
            <div className="space-y-1">
              {results.map((item, index) => {
                const Icon = getIconComponent(item.type);
                return (
                  <button
                    key={item.id}
                    role="option"
                    aria-selected={index === selectedIndex}
                    className={`w-full flex items-center gap-3 rounded-lg p-3 ${
                      index === selectedIndex
                        ? "bg-white/10 border-l-2 border-emerald-500"
                        : "hover:bg-white/5"
                    } text-left`}
                    onClick={() => {
                      navigateToItem(item);
                      setIsOpen(false);
                    }}
                  >
                    <Icon className="h-5 w-5 text-[#888]" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white truncate">
                        {item.title}
                      </div>
                      {item.description && (
                        <div className="text-xs text-[#888] truncate">
                          {item.description}
                        </div>
                      )}
                    </div>
                    <ArrowRight className="h-4 w-4 text-[#666]" />
                  </button>
                );
              })}
            </div>
          ) : query.trim() ? (
            <div className="py-12 text-center">
              <Search className="mx-auto h-12 w-12 text-[#666] mb-3" />
              <p className="text-sm text-[#888]">未找到相关结果</p>
            </div>
          ) : (
            <div className="py-8 text-center">
              <p className="text-sm text-[#888]">输入关键词开始搜索</p>
            </div>
          )}
        </div>

        {/* 快捷提示 */}
        <div className="border-t border-white/10 p-3 flex items-center gap-4 text-xs text-[#888]">
          <div>
            <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-white">↑↓</kbd> 导航
          </div>
          <div>
            <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-white">Enter</kbd> 选择
          </div>
          <div>
            <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-white">Esc</kbd> 关闭
          </div>
        </div>
      </div>
    </div>
  );
}

function navigateToItem(item: SearchItem) {
  const routes = {
    project: `/projects/${item.id}`,
    conversation: `/?conversation=${item.id}`,
    task: `/ai-tasks?task=${item.id}`,
  };
  window.location.href = routes[item.type];
}