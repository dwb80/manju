import { X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Conversation } from "@/lib/app-types";

interface ConversationRenameDialogProps {
    conversationRenameDraft: { conversation: Conversation; title: string } | null;
    onSubmit: () => Promise<void>;
    onClose: () => void;
    onTitleChange: (title: string) => void;
}

export function ConversationRenameDialog({
    conversationRenameDraft,
    onSubmit,
    onClose,
    onTitleChange,
}: ConversationRenameDialogProps) {
    if (!conversationRenameDraft) return null;

    return (
        <div className="fixed inset-0 z-[92] grid place-items-center bg-black/60 px-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="重命名会话">
            <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#202020] shadow-2xl">
                <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                    <div className="text-base font-semibold text-white">重命名会话</div>
                    <button className="grid h-8 w-8 place-items-center rounded-lg text-[#d8d8d8] hover:bg-white/10 hover:text-white" onClick={onClose} aria-label="关闭重命名会话">
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="p-5">
                    <label className="grid grid-cols-[80px_1fr] items-center gap-3 max-sm:grid-cols-1 max-sm:gap-1">
                        <span className="text-right text-xs font-medium text-[#d8d8d8] max-sm:text-left">标题</span>
                        <input
                            className="h-10 rounded-lg border border-white/10 bg-[#2f2f2f] px-3 text-sm text-white outline-none focus:border-emerald-500"
                            value={conversationRenameDraft.title}
                            placeholder="输入会话标题"
                            onChange={(event) => onTitleChange(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === "Enter") void onSubmit();
                            }}
                        />
                    </label>
                </div>
                <div className="flex justify-end gap-2 border-t border-white/10 px-5 py-4">
                    <Button size="sm" variant="secondary" onClick={onClose}>取消</Button>
                    <Button size="sm" onClick={() => void onSubmit()}><Check className="h-4 w-4" />保存</Button>
                </div>
            </div>
        </div>
    );
}