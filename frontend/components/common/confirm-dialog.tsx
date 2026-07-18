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
    title: string;
    description: string;
    confirmLabel: string;
    onClose: () => void;
    onConfirm: () => void;
};

/**
 * ConfirmDialog - 确认弹窗组件
 * @param {ConfirmDialogProps} props - 组件属性
 * @returns {JSX.Element} 渲染的确认弹窗元素
 */
export function ConfirmDialog({ title, description, confirmLabel, onClose, onConfirm }: ConfirmDialogProps) {
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
                        <Button size="sm" variant="destructive" onClick={onConfirm}>
                            {confirmLabel}
                        </Button>
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
