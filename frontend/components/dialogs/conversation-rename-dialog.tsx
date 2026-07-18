/**
 * @file conversation-rename-dialog.tsx
 * @description 对话重命名对话框组件，用于修改对话名称
 */

"use client";

import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Conversation } from "@/lib/app-types";

interface ConversationRenameDialogProps {
    conversationRenameDraft: { conversation: Conversation; title: string } | null;
    onSubmit: () => Promise<void>;
    onClose: () => void;
    onTitleChange: (title: string) => void;
}

/**
 * 会话重命名弹窗。
 *
 * 基于 shadcn Dialog 封装，保留旧 API 接口，调用方零迁移成本。
 */
export function ConversationRenameDialog({
    conversationRenameDraft,
    onSubmit,
    onClose,
    onTitleChange,
}: ConversationRenameDialogProps) {
    if (!conversationRenameDraft) return null;

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="border-border">
                <DialogHeader>
                    <DialogTitle>重命名会话</DialogTitle>
                </DialogHeader>

                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        void onSubmit();
                    }}
                >
                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[80px_1fr] sm:items-center sm:gap-3">
                        <label
                            htmlFor="conversation-rename-title"
                            className="text-xs font-medium text-muted-foreground sm:text-right"
                        >
                            标题
                        </label>
                        <Input
                            id="conversation-rename-title"
                            value={conversationRenameDraft.title}
                            placeholder="输入会话标题"
                            onChange={(event) => onTitleChange(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                    event.preventDefault();
                                    void onSubmit();
                                }
                            }}
                            autoFocus
                        />
                    </div>

                    <DialogFooter className="mt-4">
                        <Button size="sm" variant="secondary" type="button" onClick={onClose}>
                            取消
                        </Button>
                        <Button size="sm" type="submit">
                            <Check className="mr-1 h-3.5 w-3.5" />
                            保存
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
