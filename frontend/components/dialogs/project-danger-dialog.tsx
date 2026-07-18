/**
 * @file project-danger-dialog.tsx
 * @description 项目危险操作对话框，用于删除项目等危险操作的二次确认
 */

"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Project } from "@/lib/app-types";

interface ProjectDangerDialogProps {
    projectDangerAction: { type: "archive" | "remove"; project: Project } | null;
    onConfirm: () => Promise<void>;
    onClose: () => void;
}

/**
 * 项目危险操作确认弹窗（归档/移除）。
 *
 * 基于 shadcn AlertDialog 封装，保留旧 API 接口，调用方零迁移成本。
 */
export function ProjectDangerDialog({
    projectDangerAction,
    onConfirm,
    onClose,
}: ProjectDangerDialogProps) {
    if (!projectDangerAction) return null;

    const isArchive = projectDangerAction.type === "archive";
    const title = isArchive ? "归档项目对话" : "移除项目";
    const description = isArchive
        ? `确认归档"${projectDangerAction.project.name}"下的对话？归档后会从当前项目列表中隐藏。`
        : `确认移除项目"${projectDangerAction.project.name}"？项目下的会话会转为"不使用项目"。`;
    const confirmLabel = isArchive ? "确认归档" : "确认移除";

    return (
        <AlertDialog open onOpenChange={(open) => !open && onClose()}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <div className="flex items-start gap-3">
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-red-500/15 text-red-200">
                            <AlertTriangle className="h-5 w-5" />
                        </div>
                        <div>
                            <AlertDialogTitle>{title}</AlertDialogTitle>
                            <AlertDialogDescription className="mt-2 leading-6">
                                {description}
                            </AlertDialogDescription>
                        </div>
                    </div>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel asChild>
                        <Button size="sm" variant="secondary">取消</Button>
                    </AlertDialogCancel>
                    <AlertDialogAction asChild>
                        <Button size="sm" variant="destructive" onClick={() => void onConfirm()}>
                            {confirmLabel}
                        </Button>
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
