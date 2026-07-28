"use client";

import { useState } from "react";
import { HelpCircle, Keyboard, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type ShortcutItem = {
  key: string;
  description: string;
  category?: string;
};

/**
 * ShortcutsHelp - 快捷键帮助组件
 * @returns {JSX.Element} 渲染的快捷键帮助元素
 */
export function ShortcutsHelp() {
  const [isOpen, setIsOpen] = useState(false);

  const shortcuts: ShortcutItem[] = [
    { key: "Ctrl + K", description: "快速搜索", category: "全局" },
    { key: "Ctrl + /", description: "打开/关闭 AI 助手", category: "全局" },
    { key: "Ctrl + 1-9", description: "切换项目页面", category: "全局" },
    { key: "Space", description: "预览选中资产", category: "操作" },
    { key: "E", description: "编辑选中项", category: "操作" },
    { key: "G", description: "生成图片", category: "创作" },
    { key: "V", description: "生成视频", category: "创作" },
  ];

  return (
    <>
      {/* 快捷键帮助按钮 */}
      <button
        className="fixed right-4 bottom-4 z-40 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground transition-all duration-200 hover:border-border hover:bg-secondary hover:text-foreground"
        onClick={() => setIsOpen(true)}
        aria-label="快捷键帮助"
      >
        <HelpCircle className="h-5 w-5" />
      </button>

      {/* 快捷键帮助模态框 */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setIsOpen(false)}>
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            {/* 标题 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Keyboard className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-base font-semibold text-foreground">快捷键指南</div>
                  <div className="text-xs text-muted-foreground">使用快捷键提高工作效率</div>
                </div>
              </div>
              <button
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                onClick={() => setIsOpen(false)}
                aria-label="关闭"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* 快捷键列表 */}
            <div className="mt-6 space-y-4">
              {["全局", "操作", "创作"].map((category) => (
                <div key={category}>
                  <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">{category}</div>
                  <div className="space-y-2">
                    {shortcuts
                      .filter((shortcut) => shortcut.category === category)
                      .map((shortcut, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between rounded-lg border border-border bg-muted px-4 py-3"
                        >
                          <div className="text-sm text-muted-foreground">{shortcut.description}</div>
                          <kbd className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-foreground">{shortcut.key}</kbd>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>

            {/* 底部提示 */}
            <div className="mt-6 rounded-lg border border-border bg-secondary p-4 text-xs text-muted-foreground">
              <div className="font-medium text-foreground">提示</div>
              <div className="mt-1">在输入框中时，只有 Ctrl 组合快捷键有效。其他快捷键需要先离开输入框才能使用。</div>
            </div>

            {/* 关闭按钮 */}
            <div className="mt-6 flex justify-end">
              <Button size="sm" variant="secondary" onClick={() => setIsOpen(false)}>
                关闭
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
