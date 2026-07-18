/**
 * @file version-history-dialog.tsx
 * @description 资产版本历史弹窗组件，适用于角色/场景/道具三个工厂共用
 */

"use client";

/**
 * 资产版本历史弹窗（任务12：三厂共性 - 统一版本管理）
 *
 * 适用对象：角色 / 场景 / 道具 三个工厂共用同一个弹窗。
 *
 * 功能：
 * - 展示指定实体的全部历史版本（按 version 倒序）
 * - 查看单版本完整 JSON 快照
 * - 回滚到任意历史版本（带二次确认）
 *
 * 设计原则：
 * - 不依赖具体实体类型，通过 entityType + entityId 拉数据
 * - 弹窗只读，回滚通过 fetchVersions 参数注入
 * - 异常时给出 toast 提示，不抛出未处理错误
 */

import { useEffect, useState } from "react";
import { History, Eye, RotateCcw, X, Clock, Tag, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { toast } from "@/components/common/toast";
import { listVersions, restoreVersion } from "@/services/module.service";
import type { AssetEntityType, AssetVersion, AssetVersionChangeType } from "@/lib/module-types";

export interface VersionHistoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: AssetEntityType;
  entityId: string;
  entityName?: string;
  /** 实体显示名（用于标题），例如 "角色"。 */
  entityLabel?: string;
  /** 回滚成功后的回调（用于通知父组件刷新列表）。 */
  onRestored?: () => void;
}

/** 变更类型对应的中文标签与配色。 */
const CHANGE_TYPE_META: Record<AssetVersionChangeType, { label: string; className: string }> = {
  create: { label: "创建", className: "bg-emerald-500/20 text-emerald-300" },
  update: { label: "修改", className: "bg-blue-500/20 text-blue-300" },
  restore: { label: "回滚", className: "bg-amber-500/20 text-amber-300" },
};

/** 格式化时间戳为本地可读字符串。 */
function formatTime(iso: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("zh-CN", { hour12: false });
}

/** 安全解析版本快照 data。 */
function parseSnapshot(data: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(data);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    return null;
  } catch {
    return null;
  }
}

/**
 * 单条版本快照的查看弹窗。
 */
function SnapshotViewer({
  version,
  onClose,
}: {
  version: AssetVersion | null;
  onClose: () => void;
}) {
  if (!version) return null;
  const snapshot = parseSnapshot(version.data);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="wide" className="border-border">
        <DialogHeader>
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2 text-foreground">
              <FileText className="h-4 w-4 text-emerald-400" />
              <span className="text-sm font-semibold">v{version.version} 完整快照</span>
              <span className="text-xs text-muted-foreground">· {formatTime(version.created_at)}</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-white/10 hover:text-foreground"
              aria-label="关闭"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </DialogHeader>
        <pre className="flex-1 overflow-auto p-5 text-xs leading-5 text-foreground whitespace-pre-wrap break-all">
          {snapshot ? JSON.stringify(snapshot, null, 2) : `（无法解析快照）\n\n${version.data}`}
        </pre>
      </DialogContent>
    </Dialog>
  );
}

/**
 * VersionHistoryDialog - 版本历史弹窗组件
 * @param {VersionHistoryDialogProps} props - 组件属性
 * @returns {JSX.Element} 渲染的版本历史弹窗元素
 */
export function VersionHistoryDialog({
  isOpen,
  onClose,
  entityType,
  entityId,
  entityName,
  entityLabel = "资产",
  onRestored,
}: VersionHistoryDialogProps) {
  const [versions, setVersions] = useState<AssetVersion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [viewing, setViewing] = useState<AssetVersion | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<AssetVersion | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  // 加载版本列表
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setIsLoading(true);
    setVersions([]);
    listVersions(entityType, entityId)
      .then((list) => {
        if (cancelled) return;
        setVersions(list);
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error("加载版本历史失败", (err as Error).message ?? "请稍后重试");
      })
      .finally(() => {
        if (cancelled) return;
        setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, entityType, entityId]);

  // 回滚确认
  const handleConfirmRestore = async () => {
    if (!restoreTarget) return;
    const target = restoreTarget;
    setRestoreTarget(null);
    setIsRestoring(true);
    try {
      const result = await restoreVersion(target.id);
      toast.success("回滚成功", `已回滚到 v${target.version}，并生成新版本 v${result.version}`);
      // 重新加载列表
      const list = await listVersions(entityType, entityId);
      setVersions(list);
      onRestored?.();
    } catch (err) {
      toast.error("回滚失败", (err as Error).message ?? "请稍后重试");
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent size="wide" className="border-border">
          {/* 标题栏 */}
          <DialogHeader>
            <div className="flex items-center gap-2 text-foreground">
              <History className="h-5 w-5 text-emerald-400" />
              <div>
                <DialogTitle>
                  {entityLabel}版本历史
                  {entityName ? <span className="text-muted-foreground text-sm font-normal"> · {entityName}</span> : null}
                </DialogTitle>
                <DialogDescription>共 {versions.length} 个版本</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* 列表 */}
          <div className="flex-1 overflow-y-auto p-3">
            {isLoading ? (
              <div className="grid place-items-center py-12 text-sm text-muted-foreground">加载中…</div>
            ) : versions.length === 0 ? (
              <div className="grid place-items-center py-12 text-sm text-muted-foreground">
                <div className="flex flex-col items-center gap-2">
                  <History className="h-8 w-8 opacity-40" />
                  <div>暂无版本历史</div>
                  <div className="text-xs opacity-70">创建或编辑{entityLabel}后会自动记录版本</div>
                </div>
              </div>
            ) : (
              <ul className="space-y-2">
                {versions.map((v) => {
                  const meta = CHANGE_TYPE_META[v.change_type] ?? CHANGE_TYPE_META.update;
                  const isLatest = versions[0]?.id === v.id;
                  return (
                    <li
                      key={v.id}
                      className="rounded-lg border border-white/10 bg-[#252525] p-3 hover:border-emerald-500/30 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-foreground">v{v.version}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${meta.className}`}>
                              {meta.label}
                            </span>
                            {isLatest && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                                当前
                              </span>
                            )}
                            {v.change_note && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Tag className="h-3 w-3 opacity-60" />
                                {v.change_note}
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatTime(v.created_at)}
                            </span>
                            {v.created_by && <span>by {v.created_by}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setViewing(v)}
                            className="text-xs"
                          >
                            <Eye className="mr-1 h-3 w-3" />
                            查看
                          </Button>
                          {!isLatest && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setRestoreTarget(v)}
                              disabled={isRestoring}
                              className="text-xs"
                            >
                              <RotateCcw className="mr-1 h-3 w-3" />
                              回滚
                            </Button>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 单条快照查看 */}
      <SnapshotViewer version={viewing} onClose={() => setViewing(null)} />

      {/* 回滚二次确认 */}
      {restoreTarget && (
        <ConfirmDialog
          title={`回滚到 v${restoreTarget.version}`}
          description={`确定要把${entityLabel}回滚到 v${restoreTarget.version} 吗？\n\n回滚后会生成一条新的"回滚"版本记录，原始历史不会被删除。`}
          confirmLabel="确认回滚"
          onClose={() => setRestoreTarget(null)}
          onConfirm={handleConfirmRestore}
        />
      )}
    </>
  );
}
