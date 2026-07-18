"use client";

/**
 * 跨项目复制资产弹窗
 *
 * 任务14：在三厂（角色/场景/道具）通用 CRUD 页面中实现"复制到其他项目"功能。
 * 该弹窗展示项目列表（多选 checkbox），用户勾选后调用后端 copy 接口。
 *
 * 不变量：
 * - 列表中自动排除源项目（资产已绑定的项目）以及已归档项目。
 * - 至少选择 1 个目标项目才能提交。
 * - 父组件负责在 onConfirm 返回后刷新列表 / 提示用户。
 */

import { useEffect, useMemo, useState } from "react";
import { Copy, Folder, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { listProjects } from "@/services/project.service";
import type { Project } from "@/lib/app-types";

export interface CopyToProjectDialogProps {
  /** 是否打开。 */
  isOpen: boolean;
  /** 关闭回调。 */
  onClose: () => void;
  /** 源资产（用于在标题上展示名称）。 */
  sourceItem: { id: string; name: string; project_id?: string } | null;
  /** 实体中文名（角色 / 场景 / 道具），用于标题。 */
  entityLabel: string;
  /** 确认回调：父组件在拿到目标项目 ID 后调用后端复制接口。 */
  onConfirm: (targetProjectIds: string[]) => Promise<{ copied: number; skipped: number }>;
}

/**
 * CopyToProjectDialog - 跨项目复制资产弹窗组件
 * @param {CopyToProjectDialogProps} props - 组件属性
 * @returns {JSX.Element | null} 渲染的弹窗元素
 */
export function CopyToProjectDialog({
  isOpen,
  onClose,
  sourceItem,
  entityLabel,
  onConfirm,
}: CopyToProjectDialogProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>("");

  // 打开时拉取项目列表
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setIsLoading(true);
    setError("");
    listProjects()
      .then((list) => {
        if (cancelled) return;
        // 过滤：排除源项目 + 归档项目
        const filtered = list.filter(
          (p) => p.id !== sourceItem?.project_id && !p.archived_at,
        );
        setProjects(filtered);
        setSelected(new Set());
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "加载项目列表失败");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, sourceItem?.project_id]);

  const canSubmit = selected.size > 0 && !isSubmitting;

  const allSelected = useMemo(
    () => projects.length > 0 && projects.every((p) => selected.has(p.id)),
    [projects, selected],
  );

  const toggleProject = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(projects.map((p) => p.id)));
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    setError("");
    try {
      const ids = Array.from(selected);
      await onConfirm(ids);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "复制失败");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="border-border">
        {/* 标题栏 */}
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-500/15 text-emerald-300">
              <Copy className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>复制{entityLabel}到其他项目</DialogTitle>
              <DialogDescription>
                {sourceItem ? `源资产：「${sourceItem.name}」` : ""}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* 描述 */}
        <p className="text-sm text-muted-foreground leading-6">
          选择要复制到的目标项目。同名{entityLabel}将按去重规则处理：目标项目已存在同名资产时跳过复制。
        </p>

        {/* 列表 */}
        <div className="rounded-lg border border-border bg-card">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              加载项目列表...
            </div>
          ) : error ? (
            <div className="px-3 py-4 text-sm text-destructive">{error}</div>
          ) : projects.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              暂无可选项目
            </div>
          ) : (
            <>
              {/* 全选行 */}
              <label className="flex items-center gap-2 border-b border-border px-3 py-2 text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="h-4 w-4 rounded border-white/30 bg-transparent accent-emerald-500"
                />
                <span>全选</span>
                <span className="ml-auto text-[10px] text-muted-foreground">
                  已选 {selected.size} / {projects.length}
                </span>
              </label>
              <div className="max-h-64 overflow-y-auto py-1">
                {projects.map((p) => (
                  <label
                    key={p.id}
                    className="flex items-center gap-3 px-3 py-2 text-sm text-foreground hover:bg-white/5 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(p.id)}
                      onChange={() => toggleProject(p.id)}
                      className="h-4 w-4 rounded border-white/30 bg-transparent accent-emerald-500"
                    />
                    <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate flex-1">{p.name}</span>
                    {p.status && (
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {p.status}
                      </span>
                    )}
                  </label>
                ))}
              </div>
            </>
          )}
        </div>

        {/* 操作按钮 */}
        <DialogFooter className="gap-2">
          <Button size="sm" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            取消
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={!canSubmit}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                复制中...
              </>
            ) : (
              <>
                <Copy className="mr-2 h-3 w-3" />
                复制到 {selected.size} 个项目
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
