import { Plus, FolderOpen, Download, RefreshCw, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Project, ProjectFormDraft, ProjectHealth, ProjectMilestone, ProjectTask } from "@/lib/app-types";

interface ProjectHeaderProps {
    selectedProject: Project;
    projectDraft: Partial<Project>;
    projectHealth: ProjectHealth | null;
    productionProgress: number;
    productionProgressItems: (string | boolean | undefined)[];
    openIssueCount: number;
    pendingReviewCount: number;
    completedTaskCount: number;
    nextMilestone: ProjectMilestone | undefined;
    projectTasks: ProjectTask[];
    onCreateConversation: () => Promise<void>;
    onOpenFolder: () => Promise<void>;
    onExportManifest: () => void;
    onRefresh: () => Promise<void>;
    onSave: () => Promise<void>;
}

/**
 * ProjectHeader - 项目头部组件
 * @param {ProjectHeaderProps} props - 组件属性
 * @returns {JSX.Element} 渲染的项目头部元素
 */
export function ProjectHeader({
    selectedProject,
    projectDraft,
    projectHealth,
    productionProgress,
    productionProgressItems,
    openIssueCount,
    pendingReviewCount,
    completedTaskCount,
    nextMilestone,
    projectTasks,
    onCreateConversation,
    onOpenFolder,
    onExportManifest,
    onRefresh,
    onSave,
}: ProjectHeaderProps) {
    return (
        <section className="rounded-[22px] border border-white/10 bg-[#202020] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.22)]">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                    <div className="mb-2 text-sm font-medium text-emerald-200/90">AI 漫剧制作中枢</div>
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="truncate text-2xl font-semibold text-white">{selectedProject.name}</div>
                        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-sm text-emerald-100">{projectDraft.status ?? selectedProject.status ?? "策划中"}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-3 text-sm font-medium text-[#d6d6d6]">
                        <span>题材：{selectedProject.category || "未设置"}</span>
                        <span>负责人：{selectedProject.owner || "未分配"}</span>
                        <span>截止：{selectedProject.due_date || "未设置"}</span>
                        <span className="max-w-[460px] truncate">存储：{selectedProject.storage_path}</span>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={() => void onCreateConversation()}><Plus className="h-4 w-4" />新会话</Button>
                    <Button size="sm" variant="secondary" onClick={() => void onOpenFolder()}><FolderOpen className="h-4 w-4" />打开目录</Button>
                    <Button size="sm" variant="secondary" onClick={onExportManifest}><Download className="h-4 w-4" />项目清单</Button>
                    <Button size="sm" variant="secondary" onClick={() => void onRefresh()}><RefreshCw className="h-4 w-4" />刷新</Button>
                    <Button size="sm" onClick={() => void onSave()}><Check className="h-4 w-4" />保存</Button>
                </div>
            </div>
            <div className="mt-5 grid grid-cols-[1.4fr_1fr_1fr_1fr] gap-3 max-lg:grid-cols-2 max-md:grid-cols-1">
                {[
                    ["制作进度", `${productionProgress}%`, `${productionProgressItems.filter(Boolean).length}/${productionProgressItems.length} 阶段已就绪`],
                    ["健康度", projectHealth ? `${projectHealth.score}/100` : "--", projectHealth?.label ?? "未计算"],
                    ["待处理", `${openIssueCount + pendingReviewCount}`, `问题 ${openIssueCount} · 审核 ${pendingReviewCount} · 任务 ${projectTasks.length - completedTaskCount}`],
                    ["下一节点", nextMilestone?.title ?? "未设置", nextMilestone?.due_date || "暂无截止日期"],
                ].map(([label, value, hint]) => (
                    <div key={label} className="rounded-2xl border border-white/10 bg-[#2a2a2a] p-4">
                        <div className="text-sm font-medium text-[#cfcfcf]">{label}</div>
                        <div className="mt-1 truncate text-xl font-semibold text-white">{value}</div>
                        <div className="mt-1 truncate text-sm text-[#bdbdbd]">{hint}</div>
                        {label === "制作进度" && (
                            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${productionProgress}%` }} />
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </section>
    );
}