"use client";

import { useState } from "react";
import { HelpCircle, Book, Video, MessageCircle, Search, ChevronRight, ExternalLink, X, FolderOpen, Sparkles, Rocket } from "lucide-react";

/**
 * 帮助中心组件
 *
 * 功能：
 * - 快速帮助入口
 * - FAQ常见问题
 * - 视频教程链接
 * - 在线客服入口
 */

interface HelpItem {
  id: string;
  category: string;
  question: string;
  answer: string;
}

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

/**
 * HelpCenter - 帮助中心组件
 * @returns {JSX.Element} 渲染的帮助中心元素
 */
export function HelpCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <>
      {/* 帮助按钮 */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 shadow-lg hover:bg-emerald-600 transition-colors z-40"
        aria-label="打开帮助中心"
      >
        <HelpCircle className="h-6 w-6 text-white" />
      </button>

      {/* 帮助中心面板 */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-4xl max-h-[80vh] rounded-2xl border border-white/10 bg-[#1a1a1a] shadow-2xl overflow-hidden">
            {/* 头部 */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <HelpCircle className="h-6 w-6 text-emerald-400" />
                <h2 className="text-lg font-semibold text-white">帮助中心</h2>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-lg hover:bg-white/10"
                aria-label="关闭帮助中心"
              >
                <X className="h-5 w-5 text-[#888]" />
              </button>
            </div>

            {/* 搜索框 */}
            <div className="p-4 border-b border-white/10">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#888]" />
                <input
                  type="text"
                  placeholder="搜索问题..."
                  className="w-full rounded-lg border border-white/10 bg-[#252525] py-2 pl-10 pr-4 text-sm text-white placeholder-[#888] focus:border-emerald-500/50 focus:outline-none"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="搜索问题"
                />
              </div>
            </div>

            {/* 内容区 */}
            <div className="flex h-[400px]">
              {/* 分类列表 */}
              <div className="w-1/3 border-r border-white/10 overflow-y-auto" role="tablist">
                {helpCategories.map((category) => {
                  const Icon = category.icon;
                  return (
                    <button
                      key={category.id}
                      role="tab"
                      aria-selected={selectedCategory === category.id}
                      onClick={() => setSelectedCategory(category.id)}
                      className={`w-full flex items-center gap-3 p-4 text-left hover:bg-white/5 transition-colors ${
                        selectedCategory === category.id ? "bg-white/10 border-l-2 border-emerald-500" : ""
                      }`}
                    >
                      <Icon className="h-5 w-5 text-[#888]" />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-white">{category.name}</div>
                        <div className="text-xs text-[#888]">{category.items.length} 个问题</div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-[#666]" />
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
                      ?.items.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-lg border border-white/10 bg-[#252525] p-4"
                        >
                          <div className="text-sm font-medium text-white mb-2">{item.question}</div>
                          <div className="text-xs text-[#888]">{item.answer}</div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <Book className="h-12 w-12 text-[#666] mb-3" />
                    <p className="text-sm text-[#888]">选择左侧分类查看相关问题</p>
                  </div>
                )}
              </div>
            </div>

            {/* 底部操作 */}
            <div className="flex items-center justify-between p-4 border-t border-white/10">
              <div className="flex gap-2">
                <button className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#252525] px-3 py-2 text-xs text-[#888] hover:bg-white/5">
                  <Video className="h-4 w-4" />
                  视频教程
                </button>
                <button className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#252525] px-3 py-2 text-xs text-[#888] hover:bg-white/5">
                  <MessageCircle className="h-4 w-4" />
                  在线客服
                </button>
              </div>
              <button className="flex items-center gap-1 text-xs text-[#888] hover:text-white">
                <ExternalLink className="h-3 w-3" />
                完整文档
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}