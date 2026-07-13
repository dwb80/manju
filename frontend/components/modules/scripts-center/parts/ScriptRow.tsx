"use client";

/**
 * 剧本表格行组件
 *
 * 单行渲染：标题 + 作者 + 状态 + 字数 + 章节 + 更新时间 + 操作列。
 * 行整体可点击进入编辑器（操作列需 stopPropagation 避免与按钮冲突）。
 */

import { FileText, Sparkles, Tag as TagIcon, CheckCircle, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Script } from "@/lib/module-types";

export function ScriptRow({
  script,
  onOpenEditor,
  onEdit,
  onDelete,
  onTagManager,
  onAnalysis,
  onApproval,
}: {
  script: Script;
  onOpenEditor: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTagManager: () => void;
  onAnalysis: () => void;
  onApproval: () => void;
}) {
  const statusLabels: Record<string, string> = {
    draft: "草稿",
    active: "进行中",
    review: "审核中",
    completed: "已完成",
    archived: "已归档",
  };

  const statusColors: Record<string, string> = {
    draft: "bg-gray-500/20 text-gray-400",
    active: "bg-blue-500/20 text-blue-400",
    review: "bg-yellow-500/20 text-yellow-400",
    completed: "bg-emerald-500/20 text-emerald-400",
    archived: "bg-[#252525] text-[#888]",
  };

  return (
    <tr
      className="border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors"
      onClick={onOpenEditor}
      title="点击进入编辑器"
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-white/5">
            <FileText className="h-4 w-4 text-emerald-400" />
          </div>
          <div>
            <div className="font-medium text-white">{script.title}</div>
            {script.description && (
              <div className="text-xs text-[#666] line-clamp-1">{script.description}</div>
            )}
            {script.tags && script.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {script.tags.slice(0, 3).map((tag, idx) => (
                  <span
                    key={idx}
                    className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400"
                  >
                    {tag}
                  </span>
                ))}
                {script.tags.length > 3 && (
                  <span className="text-[10px] text-[#666]">+{script.tags.length - 3}</span>
                )}
              </div>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-[#888] hidden md:table-cell">{script.author}</td>
      <td className="px-4 py-3">
        <span className={`px-2 py-0.5 rounded text-xs ${statusColors[script.status]}`}>
          {statusLabels[script.status]}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-[#888] hidden sm:table-cell">
        {script.words?.toLocaleString() ?? 0}
      </td>
      <td className="px-4 py-3 text-sm text-[#888] hidden lg:table-cell">{script.chapters ?? 0}</td>
      <td className="px-4 py-3 text-sm text-[#888] hidden md:table-cell">
        {new Date(script.updated_at).toLocaleDateString()}
      </td>
      <td
        className="px-4 py-3 text-right"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 justify-end">
          {/* 主操作：进入编辑器继续编辑（替代原先的铅笔图标） */}
          <Button
            size="sm"
            variant="outline"
            onClick={onOpenEditor}
            className="text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/10 hover:border-emerald-500/60"
            title="进入编辑器继续编辑"
          >
            继续编辑 →
          </Button>
          <Button variant="ghost" size="sm" onClick={onEdit} title="编辑标题和基础信息">
            <Pencil className="h-4 w-4 text-emerald-400" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onAnalysis} title="剧本分析（提取角色/场景/道具）">
            <Sparkles className="h-4 w-4 text-blue-400" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onTagManager} title="标签管理">
            <TagIcon className="h-4 w-4 text-purple-400" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onApproval} title="审批流程">
            <CheckCircle className="h-4 w-4 text-yellow-400" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete} title="删除">
            <Trash2 className="h-4 w-4 text-red-400" />
          </Button>
        </div>
      </td>
    </tr>
  );
}
