"use client";

/**
 * 剧本表格行组件
 *
 * 单行渲染：标题 + 作者 + 状态 + 字数 + 章节 + 更新时间 + 操作列。
 * 行整体可点击进入编辑器（操作列需 stopPropagation 避免与按钮冲突）。
 *
 * 配合 frontend/components/ui/table.tsx 使用，
 * 因此使用 TableRow/TableCell 等 shadcn 风格组件。
 */

import { FileText, Sparkles, Tag as TagIcon, CheckCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TableCell, TableRow } from "@/components/ui/table";
import type { Script } from "@/lib/module-types";

export function ScriptRow({
  script,
  onOpenEditor,
  onDelete,
  onTagManager,
  onAnalysis,
  onApproval,
}: {
  script: Script;
  onOpenEditor: () => void;
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

  const statusVariant: Record<string, "muted" | "info" | "warning" | "success" | "outline"> = {
    draft: "muted",
    active: "info",
    review: "warning",
    completed: "success",
    archived: "outline",
  };

  return (
    <TableRow
      className="cursor-pointer"
      onClick={onOpenEditor}
      title="点击进入编辑器"
    >
      <TableCell>
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-white/5">
            <FileText className="h-4 w-4 text-emerald-400" />
          </div>
          <div>
            <div className="font-medium text-foreground">{script.title}</div>
            {script.description && (
              <div className="text-xs text-muted-foreground line-clamp-1">{script.description}</div>
            )}
            {script.tags && script.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {script.tags.slice(0, 3).map((tag, idx) => (
                  <Badge key={idx} variant="success" className="text-[10px] py-0">
                    {tag}
                  </Badge>
                ))}
                {script.tags.length > 3 && (
                  <span className="text-[10px] text-muted-foreground">+{script.tags.length - 3}</span>
                )}
              </div>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground hidden md:table-cell">{script.author}</TableCell>
      <TableCell>
        <Badge variant={statusVariant[script.status] ?? "muted"}>
          {statusLabels[script.status] ?? script.status}
        </Badge>
      </TableCell>
      <TableCell className="text-muted-foreground hidden sm:table-cell">
        {script.words?.toLocaleString() ?? 0}
      </TableCell>
      <TableCell className="text-muted-foreground hidden lg:table-cell">{script.chapters ?? 0}</TableCell>
      <TableCell className="text-muted-foreground hidden md:table-cell">
        {new Date(script.updated_at).toLocaleDateString()}
      </TableCell>
      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1 justify-end">
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
          <Button variant="ghost" size="icon" onClick={onAnalysis} title="剧本分析（提取角色/场景/道具）" aria-label="剧本分析">
            <Sparkles className="h-4 w-4 text-blue-400" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onTagManager} title="标签管理" aria-label="标签管理">
            <TagIcon className="h-4 w-4 text-purple-400" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onApproval} title="审批流程" aria-label="审批流程">
            <CheckCircle className="h-4 w-4 text-yellow-400" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onDelete} title="删除" aria-label="删除">
            <Trash2 className="h-4 w-4 text-red-400" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
