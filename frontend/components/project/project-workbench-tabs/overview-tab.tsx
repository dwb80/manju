"use client";

import { Button } from "@/components/ui/button";
import type { Project, ProjectHealth, ProjectSummary, ProjectTask, WorkbenchTab } from "@/lib/app-types";

interface OverviewTabProps {
    projectSummary: ProjectSummary | null;
    projectDraft: Partial<Project>;
    projectHealth: ProjectHealth | null;
    productionProgress: number;
    productionStageRows: Array<{
        key: WorkbenchTab;
        label: string;
        description: string;
        metric: string;
        step: number;
        ready: boolean;
        progress: number;
        action: string;
    }>;
    openIssueCount: number;
    pendingReviewCount: number;
    completedTaskCount: number;
    projectTasks: ProjectTask[];
    selectedProject: Project | undefined;
    setProjectDraft: (updater: (draft: Partial<Project>) => Partial<Project>) => void;
    openWorkbenchPage: (tab: WorkbenchTab) => void;
    saveProjectPlan: () => Promise<void>;
}

export function OverviewTab(props: OverviewTabProps) {
    return (
        <>
            <div className="grid grid-cols-[minmax(0,1fr)_320px] gap-5 max-xl:grid-cols-1">
                <div className="rounded-[22px] border border-white/10 bg-[#202020] p-6 shadow-lg">
                    <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
                        <div>
                            <div className="text-base font-semibold text-white">制作流水线</div>
                            <div className="mt-1 text-sm text-[#bdbdbd]">项目 - 剧本 - 分镜 - 分镜底图 - 图生视频 - 剪辑 - 审核 - 导出。</div>
                        </div>
                        <Button size="sm" variant="secondary" onClick={() => props.openWorkbenchPage("storyboards")} className="transition-all duration-200 hover:scale-[1.02]">进入分镜</Button>
                    </div>
                    <div className="grid grid-cols-6 gap-3 max-lg:grid-cols-3 max-sm:grid-cols-2">
                        {props.productionStageRows.map((page) => (
                            <button
                                key={page.key}
                                className={`group min-h-28 rounded-2xl border p-4 text-left transition-all duration-200 ${page.ready ? "border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/15" : "border-white/10 bg-[#2a2a2a] hover:border-emerald-500/40 hover:bg-[#303030]"}`}
                                onClick={() => props.openWorkbenchPage(page.key)}
                            >
                                <div className="text-xs font-medium text-[#bdbdbd]">阶段 {String(page.step).padStart(2, "0")}</div>
                                <div className="mt-2 text-base font-semibold text-white">{page.label}</div>
                                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${page.progress}%` }} />
                                </div>
                                <div className="mt-2 truncate text-xs text-[#cfcfcf]">{page.metric}</div>
                            </button>
                        ))}
                    </div>
                </div>
                <div className="rounded-[22px] border border-white/10 bg-[#202020] p-6 shadow-lg">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <div className="text-base font-semibold text-white">项目状态</div>
                            <div className="mt-1 text-sm text-[#bdbdbd]">{props.projectHealth?.label ?? "未计算"}</div>
                        </div>
                        <div className="text-4xl font-semibold text-emerald-200">{props.projectHealth?.score ?? "--"}<span className="text-sm text-[#bdbdbd]">/100</span></div>
                    </div>
                    <div className="mt-5 space-y-2.5">
                        {(props.projectHealth?.items ?? ["当前项目节奏正常"]).slice(0, 3).map((item) => (
                            <div key={item} className="rounded-xl bg-white/[0.04] px-4 py-2.5 text-sm text-[#d8d8d8] transition-all duration-200 hover:bg-white/[0.06]">{item}</div>
                        ))}
                    </div>
                </div>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_320px] gap-5 max-xl:grid-cols-1">
                <div className="rounded-[22px] border border-white/10 bg-[#202020] p-6 shadow-lg">
                    <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
                        <div>
                            <div className="text-base font-semibold text-white">下一步行动</div>
                            <div className="mt-1 text-sm text-[#bdbdbd]">只展示当前最该处理的三件事。</div>
                        </div>
                        <Button size="sm" variant="secondary" onClick={() => props.openWorkbenchPage("tasks")} className="transition-all duration-200 hover:scale-[1.02]">查看任务</Button>
                    </div>
                    <div className="grid grid-cols-3 gap-4 max-lg:grid-cols-1">
                        {[
                            ["剧本拆分", `${props.projectSummary?.episodes ?? 0} 个剧集，${props.projectSummary?.conversations ?? 0} 条会话可沉淀为剧本资料。`, "scripts"],
                            ["资产绑定", `图片 ${props.projectSummary?.completed_images ?? 0}/${props.projectSummary?.images ?? 0}，视频 ${props.projectSummary?.completed_videos ?? 0}/${props.projectSummary?.videos ?? 0}。`, "assets"],
                            ["审核闭环", `待处理 ${props.openIssueCount + props.pendingReviewCount} 项，任务完成 ${props.completedTaskCount}/${props.projectTasks.length}。`, "reviews"],
                        ].map(([title, detail, tab]) => (
                            <button key={title} className="rounded-2xl border border-white/10 bg-[#2a2a2a] p-5 text-left transition-all duration-200 hover:border-emerald-500/50 hover:bg-[#303030] hover:scale-[1.01]" onClick={() => props.openWorkbenchPage(tab as WorkbenchTab)}>
                                <div className="text-sm font-semibold text-white">{title}</div>
                                <div className="mt-2 text-sm leading-6 text-[#cfcfcf]">{detail}</div>
                            </button>
                        ))}
                    </div>
                </div>
                <div className="rounded-[22px] border border-white/10 bg-[#202020] p-6 shadow-lg">
                    <div className="text-base font-semibold text-white">关键指标</div>
                    <div className="mt-4 space-y-2.5">
                        {[
                            ["制作进度", `${props.productionProgress}%`],
                            ["剧集", `${props.projectSummary?.episodes ?? 0}/${Number(props.projectDraft.episode_count ?? props.selectedProject?.episode_count ?? 0)}`],
                            ["待解决", `${props.projectSummary?.open_issues ?? 0}/${props.projectSummary?.issues ?? 0}`],
                            ["里程碑", `${props.projectSummary?.open_milestones ?? 0}/${props.projectSummary?.milestones ?? 0}`],
                            ["成员", props.projectSummary?.members ?? 0],
                        ].map(([label, value]) => (
                            <div key={label} className="flex items-center justify-between rounded-xl bg-white/[0.04] px-4 py-3 transition-all duration-200 hover:bg-white/[0.06]">
                                <span className="text-sm text-[#cfcfcf]">{label}</span>
                                <span className="text-base font-semibold text-white">{value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            <div className="rounded-[22px] border border-white/10 bg-[#202020] p-6 shadow-lg">
                <div className="mb-5 flex items-center justify-between gap-4">
                    <div>
                        <div className="text-base font-semibold text-white">项目基础信息</div>
                        <div className="mt-1 text-sm text-[#bdbdbd]">用于导出项目清单和团队交付说明。</div>
                    </div>
                    <Button size="sm" onClick={() => void props.saveProjectPlan()} className="transition-all duration-200 hover:scale-[1.02]">
                        <svg className="h-4 w-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                        保存信息
                    </Button>
                </div>
                <div className="grid grid-cols-3 gap-4 max-xl:grid-cols-2 max-md:grid-cols-1">
                    {[
                        { label: "项目名称", value: props.projectDraft.name ?? props.selectedProject?.name, key: "name", placeholder: "项目名称" },
                        { label: "题材类型", value: props.projectDraft.category ?? props.selectedProject?.category ?? "", key: "category", placeholder: "古风、玄幻、科幻、都市..." },
                        { label: "负责人", value: props.projectDraft.owner ?? props.selectedProject?.owner ?? "", key: "owner", placeholder: "负责人" },
                    ].map((field) => (
                        <label key={field.key} className="space-y-2">
                            <span className="block text-sm font-medium text-[#d8d8d8]">{field.label}</span>
                            <input
                                className="h-12 w-full rounded-xl border border-white/10 bg-[#2f2f2f] px-4 text-sm text-white outline-none transition-all duration-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
                                value={String(field.value)}
                                placeholder={field.placeholder}
                                onChange={(event) => props.setProjectDraft((draft) => ({ ...draft, [field.key]: event.target.value }))}
                            />
                        </label>
                    ))}
                    <label className="space-y-2">
                        <span className="block text-sm font-medium text-[#d8d8d8]">制作阶段</span>
                        <select
                            className="h-12 w-full rounded-xl border border-white/10 bg-[#2f2f2f] px-4 text-sm text-white outline-none transition-all duration-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
                            value={props.projectDraft.status ?? props.selectedProject?.status ?? "策划中"}
                            onChange={(event) => props.setProjectDraft((draft) => ({ ...draft, status: event.target.value }))}
                        >
                            {["策划中", "剧本中", "分镜中", "出图中", "视频中", "剪辑中", "已完成"].map((status) => <option key={status}>{status}</option>)}
                        </select>
                    </label>
                    <label className="space-y-2">
                        <span className="block text-sm font-medium text-[#d8d8d8]">目标集数</span>
                        <input
                            className="h-12 w-full rounded-xl border border-white/10 bg-[#2f2f2f] px-4 text-sm text-white outline-none transition-all duration-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
                            min={0}
                            max={999}
                            type="number"
                            value={Number(props.projectDraft.episode_count ?? props.selectedProject?.episode_count ?? 0)}
                            onChange={(event) => props.setProjectDraft((draft) => ({ ...draft, episode_count: Number(event.target.value) }))}
                        />
                    </label>
                    <label className="space-y-2">
                        <span className="block text-sm font-medium text-[#d8d8d8]">截止日期</span>
                        <input
                            className="h-12 w-full rounded-xl border border-white/10 bg-[#2f2f2f] px-4 text-sm text-white outline-none transition-all duration-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
                            type="date"
                            value={props.projectDraft.due_date ?? props.selectedProject?.due_date ?? ""}
                            onChange={(event) => props.setProjectDraft((draft) => ({ ...draft, due_date: event.target.value }))}
                        />
                    </label>
                </div>
                <label className="mt-4 block space-y-2">
                    <span className="block text-sm font-medium text-[#d8d8d8]">项目简介</span>
                    <textarea
                        className="min-h-24 w-full resize-y rounded-xl border border-white/10 bg-[#2f2f2f] px-4 py-3.5 text-sm leading-7 text-white outline-none transition-all duration-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
                        value={props.projectDraft.description ?? props.selectedProject?.description ?? ""}
                        placeholder="世界观、制作目标、受众定位、交付标准"
                        onChange={(event) => props.setProjectDraft((draft) => ({ ...draft, description: event.target.value }))}
                    />
                </label>
            </div>
        </>
    );
}
