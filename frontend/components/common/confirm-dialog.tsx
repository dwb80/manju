/**
 * @file confirm-dialog.tsx
 * @description 确认弹窗组件，用于删除、移除等危险操作的二次确认
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

type ConfirmDialogProps = {
    /** 弹窗是否打开（受控）。 */
    isOpen?: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    /** 取消按钮文案，默认 "取消"。 */
    cancelLabel?: string;
    /**
     * 主操作视觉变体：
     * - "destructive"：红色填充（删除、放弃等）
     * - "default"：主色填充（默认）
     */
    variant?: "destructive" | "default";
    onClose: () => void;
    onConfirm: () => void;
};

/**
 * ConfirmDialog - 确认弹窗组件
 */
export function ConfirmDialog({
    isOpen = true,
    title,
    description,
    confirmLabel,
    cancelLabel = "取消",
    variant = "destructive",
    onClose,
    onConfirm,
}: ConfirmDialogProps) {
    return (
        <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <div className="flex items-start gap-3">
                        <div
                            className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${
                                variant === "destructive"
                                    ? "bg-destructive/15 text-destructive"
                                    : "bg-primary/15 text-primary"
                            }`}
                        >
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
                        <Button size="sm" variant="secondary">{cancelLabel}</Button>
                    </AlertDialogCancel>
                    <AlertDialogAction asChild>
                        <Button
                            size="sm"
                            variant={variant === "destructive" ? "destructive" : "default"}
                            onClick={onConfirm}
                        >
                            {confirmLabel}
                        </Button>
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
