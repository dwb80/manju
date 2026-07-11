import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Project } from "@/lib/app-types";

interface ProjectDangerDialogProps {
    projectDangerAction: { type: "archive" | "remove"; project: Project } | null;
    onConfirm: () => Promise<void>;
    onClose: () => void;
}

export function ProjectDangerDialog({
    projectDangerAction,
    onConfirm,
    onClose,
}: ProjectDangerDialogProps) {
    if (!projectDangerAction) return null;

    return (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-black/60 px-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="确认项目操作">
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#202020] p-5 shadow-2xl">
                <div className="flex items-start gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-red-500/15 text-red-200">
                        <AlertTriangle className="h-5 w-5" />
                    </div>
                    <div>
                        <div className="text-base font-semibold text-white">{projectDangerAction.type === "archive" ? "归档项目对话" : "移除项目"}</div>
                        <div className="mt-2 text-sm leading-6 text-[#cfcfcf]">
                            {projectDangerAction.type === "archive"
                                ? `确认归档"${projectDangerAction.project.name}"下的对话？归档后会从当前项目列表中隐藏。`
                                : `确认移除项目"${projectDangerAction.project.name}"？项目下的会话会转为"不使用项目"。`}
                        </div>
                    </div>
                </div>
                <div className="mt-5 flex justify-end gap-2">
                    <Button size="sm" variant="secondary" onClick={onClose}>取消</Button>
                    <Button size="sm" variant="destructive" onClick={() => void onConfirm()}>
                        {projectDangerAction.type === "archive" ? "确认归档" : "确认移除"}
                    </Button>
                </div>
            </div>
        </div>
    );
}