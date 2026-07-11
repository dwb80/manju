"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

type ConfirmDialogProps = {
    title: string;
    description: string;
    confirmLabel: string;
    onClose: () => void;
    onConfirm: () => void;
};

/** 确认弹窗组件，用于删除、移除等危险操作的二次确认。 */
export function ConfirmDialog({ title, description, confirmLabel, onClose, onConfirm }: ConfirmDialogProps) {
    return (
        <div className="fixed inset-0 z-[95] grid place-items-center bg-black/60 px-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={title}>
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#202020] p-5 shadow-2xl">
                <div className="flex items-start gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-red-500/15 text-red-200">
                        <AlertTriangle className="h-5 w-5" />
                    </div>
                    <div>
                        <div className="text-base font-semibold text-white">{title}</div>
                        <div className="mt-2 text-sm leading-6 text-[#cfcfcf]">{description}</div>
                    </div>
                </div>
                <div className="mt-5 flex justify-end gap-2">
                    <Button size="sm" variant="secondary" onClick={onClose}>取消</Button>
                    <Button size="sm" variant="destructive" onClick={onConfirm}>{confirmLabel}</Button>
                </div>
            </div>
        </div>
    );
}