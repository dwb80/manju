/**
 * @file quick-review.tsx
 * @description 快捷审核组件，提供一键通过/拒绝、快捷短语模板和快速评分功能
 */

"use client";

import { useState } from "react";
import { ThumbsUp, ThumbsDown, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * 快捷审核组件
 *
 * 功能：
 * - 一键通过/拒绝
 * - 快捷短语模板
 * - 快速评分
 * - 键盘快捷键支持
 */

interface QuickReviewProps {
  contentId: string;
  onApprove: (id: string, comment?: string) => void;
  onReject: (id: string, reason: string) => void;
  onPending: (id: string, note: string) => void;
}

const quickComments = [
  { label: "内容质量优秀", type: "approve" as const },
  { label: "需要重新生成", type: "reject" as const },
  { label: "不符合要求", type: "reject" as const },
  { label: "细节需要优化", type: "pending" as const },
];

/**
 * QuickReview - 快捷审核组件
 * @param {QuickReviewProps} props - 组件属性
 * @returns {JSX.Element} 渲染的快捷审核元素
 */
export function QuickReview({ contentId, onApprove, onReject, onPending }: QuickReviewProps) {
  const [selectedComment, setSelectedComment] = useState<string | null>(null);
  const [customComment, setCustomComment] = useState("");

  const handleQuickAction = (action: "approve" | "reject" | "pending", comment?: string) => {
    switch (action) {
      case "approve":
        onApprove(contentId, comment);
        break;
      case "reject":
        onReject(contentId, comment || "不符合要求");
        break;
      case "pending":
        onPending(contentId, comment || "需要进一步审核");
        break;
    }
  };

  return (
    <div className="space-y-4 rounded-lg border border-white/10 bg-[#252525] p-4">
      {/* 快捷按钮 */}
      <div className="flex gap-2">
        <Button
          variant="default"
          size="sm"
          onClick={() => handleQuickAction("approve")}
          className="flex-1"
          aria-label="快速通过"
        >
          <ThumbsUp className="mr-2 h-4 w-4" />
          通过
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => handleQuickAction("reject")}
          className="flex-1"
          aria-label="快速拒绝"
        >
          <ThumbsDown className="mr-2 h-4 w-4" />
          拒绝
        </Button>
      </div>

      {/* 快捷短语 */}
      <div>
        <div className="mb-2 text-xs font-medium text-[#888]">快捷短语</div>
        <div className="flex flex-wrap gap-2">
          {quickComments.map((comment) => (
            <button
              key={comment.label}
              onClick={() => {
                setSelectedComment(comment.label);
                handleQuickAction(comment.type, comment.label);
              }}
              className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                selectedComment === comment.label
                  ? "border-white/30 bg-white/10 text-white"
                  : "border-white/10 bg-transparent text-[#888] hover:border-white/20 hover:text-white"
              }`}
              aria-pressed={selectedComment === comment.label}
            >
              {comment.label}
            </button>
          ))}
        </div>
      </div>

      {/* 自定义备注 */}
      <div>
        <label htmlFor="custom-comment" className="mb-2 block text-xs font-medium text-[#888]">
          审核备注（可选）
        </label>
        <textarea
          id="custom-comment"
          className="w-full rounded-lg border border-white/10 bg-[#1a1a1a] px-3 py-2 text-sm text-white placeholder-[#666] focus:border-emerald-500/50 focus:outline-none"
          placeholder="输入详细的审核意见..."
          rows={3}
          value={customComment}
          onChange={(e) => setCustomComment(e.target.value)}
        />
      </div>

      {/* 键盘快捷键提示 */}
      <div className="flex items-center justify-between text-xs text-[#666]">
        <div>
          <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-white">A</kbd> 通过
        </div>
        <div>
          <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-white">R</kbd> 拒绝
        </div>
        <div>
          <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-white">Enter</kbd> 提交
        </div>
      </div>
    </div>
  );
}