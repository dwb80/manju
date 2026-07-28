"use client";

import { useState, useEffect } from "react";
import { HelpCircle, Book, Video, MessageCircle, Search, ChevronRight, ExternalLink, X, FolderOpen, Sparkles, Rocket } from "lucide-react";
import { create } from "zustand";


const helpCategories = [
  {
    id: "getting-started",
    name: "快速入门",
    icon: Rocket,
    items: [
      { id: "q1", question: "如何创建第一个项目？", answer: "点击首页的'新建项目'按钮，填写项目基本信息，选择合适的模板即可创建您的第一个漫剧项目。" },
      { id: "q2", question: "如何使用AI创作功能？", answer: "在创作工作台中，切换到'AI对话'模式，输入您的创作需求，AI将帮助您生成剧本、角色设定等内容。" },
    ],
  },
  {
    id: "ai-features",
    name: "AI功能",
    icon: Sparkles,
    items: [
      { id: "q3", question: "图片生成需要多长时间？", answer: "通常需要30-60秒，具体时间取决于图片尺寸和生成模型。" },
      { id: "q4", question: "如何提高生成质量？", answer: "提供更详细的提示词描述，明确指定风格、颜色、构图等要素，可以显著提升生成质量。" },
    ],
  },
  {
    id: "project-management",
    name: "项目管理",
    icon: FolderOpen,
    items: [
      { id: "q5", question: "如何邀请团队成员？", answer: "在项目设置中，点击'邀请成员'按钮，输入成员邮箱地址即可发送邀请。" },
      { id: "q6", question: "如何导出项目数据？", answer: "在数据中心页面，点击'导出报告'按钮，选择导出格式（PDF/Excel）即可下载项目数据。" },
    ],
  },
];

interface HelpStore {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const useHelpStore = create<HelpStore>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));

/** 任意位置打开帮助中心 */
export function useOpenHelpCenter() {
  return () => useHelpStore.getState().setOpen(true);
}

interface HelpCenterProps {
  /** 受控模式 */
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * HelpCenter - 帮助中心面板
 *
 * 拆分为受控组件后，host 负责 open 状态；面板只由用户主动打开。
 */
export function HelpCenter({ open, onOpenChange }: HelpCenterProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // 关闭时重置分类与搜索，避免下次打开时还停留在上次的分类
  useEffect(() => {
    if (open) return;
    setSelectedCategory(null);
    setSearchQuery("");
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="帮助中心"
    >
      <div className="w-full max-w-4xl max-h-[80vh] rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <HelpCircle className="h-6 w-6 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">帮助中心</h2>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="p-2 rounded-lg hover:bg-muted"
            aria-label="关闭帮助中心"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* 搜索框 */}
        <div className="p-4 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="搜索问题..."
              className="w-full rounded-lg border border-border bg-secondary py-2 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="搜索问题"
            />
          </div>
        </div>

        {/* 内容区 */}
        <div className="flex h-[400px]">
          {/* 分类列表 */}
          <div className="w-1/3 border-r border-border overflow-y-auto" role="tablist">
            {helpCategories.map((category) => {
              const Icon = category.icon;
              return (
                <button
                  key={category.id}
                  role="tab"
                  aria-selected={selectedCategory === category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`w-full flex items-center gap-3 p-4 text-left hover:bg-muted/50 transition-colors ${
                    selectedCategory === category.id ? "bg-muted border-l-2 border-primary" : ""
                  }`}
                >
                  <Icon className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-foreground">{category.name}</div>
                    <div className="text-xs text-muted-foreground">{category.items.length} 个问题</div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              );
            })}
          </div>

          {/* 问题列表 */}
          <div className="flex-1 overflow-y-auto p-4" role="tabpanel">
            {selectedCategory ? (
              <div className="space-y-3">
                {helpCategories
                  .find((c) => c.id === selectedCategory)
                  ?.items
                  .filter((item) =>
                    searchQuery
                      ? item.question.includes(searchQuery) || item.answer.includes(searchQuery)
                      : true,
                  )
                  .map((item) => (
                    <div
                      key={item.id}
                      className="rounded-lg border border-border bg-secondary p-4"
                    >
                      <div className="text-sm font-medium text-foreground mb-2">{item.question}</div>
                      <div className="text-xs text-muted-foreground">{item.answer}</div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Book className="h-12 w-12 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">选择左侧分类查看相关问题</p>
              </div>
            )}
          </div>
        </div>

        {/* 底部操作 */}
        <div className="flex items-center justify-between p-4 border-t border-border">
          <div className="flex gap-2">
            <button className="flex items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-2 text-xs text-muted-foreground hover:bg-muted/50">
              <Video className="h-4 w-4" />
              视频教程
            </button>
            <button className="flex items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-2 text-xs text-muted-foreground hover:bg-muted/50">
              <MessageCircle className="h-4 w-4" />
              在线客服
            </button>
          </div>
          <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ExternalLink className="h-3 w-3" />
            完整文档
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * HelpCenterHost - 帮助中心全局挂载点
 *
 * - 渲染右下角浮动按钮（始终可见）
 * - 仅在用户点击入口时打开，避免打断首屏任务和拦截页面操作
 * - 在 root layout 渲染一次即可
 */
export function HelpCenterHost() {
  const open = useHelpStore((s) => s.open);
  const setOpen = useHelpStore((s) => s.setOpen);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
        aria-label="打开帮助中心"
      >
        <HelpCircle className="h-6 w-6" />
      </button>
      <HelpCenter
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
