"use client";

import { Check, Download, ExternalLink, FolderOpen, Pencil, Plus, RefreshCw, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ManagementTable as ProjectManagementTable, WorkbenchPager as ProjectWorkbenchPager } from "@/components/project/project-workbench";
import { EmptyStoryboards, EmptyClips } from "@/components/shared";
import type {
    AssetDraft,
    Project,
    ProjectEpisode,
    ProjectIssue,
    ProjectIssueSeverity,
    ProjectIssueStatus,
    ProjectMember,
    ProjectMilestone,
    ProjectMilestoneStatus,
    ProjectScript,
    ProjectStoryboard,
    ProjectStoryboardStatus,
    ProjectClip,
    ProjectClipStatus,
    ProjectAsset,
    ProjectAssetKind,
    ProjectSummary,
    ProjectTask,
    ProjectTaskStatus,
    ProjectReview,
    ProjectHealth,
    WorkbenchTab,
} from "@/lib/app-types";

type StoryboardDraft = {
    episode: number;
    scene: string;
    shot: string;
    title: string;
    description: string;
    dialogue: string;
    characters: string;
    character_asset_ids: string[];
    location: string;
    scene_asset_id: string;
    shot_size: string;
    camera_move: string;
    duration: number;
    status: ProjectStoryboardStatus;
    prompt: string;
};

interface ProjectWorkbenchTabsProps {
    projectWorkbenchTab: WorkbenchTab;
    selectedProject: Project | undefined;
    currentWorkbenchPageNumber: number;
    workbenchPageSize: number;

    // Overview tab
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

    // Members tab
    projectMembers: ProjectMember[];
    filteredProjectMembers: ProjectMember[];
    pagedProjectMembers: ProjectMember[];
    memberDraft: Partial<ProjectMember>;
    editingMemberId: string;

    // Episodes tab
    projectEpisodes: ProjectEpisode[];
    filteredProjectEpisodes: ProjectEpisode[];
    pagedProjectEpisodes: ProjectEpisode[];
    episodeDraft: Partial<ProjectEpisode>;
    editingEpisodeId: string;

    // Issues tab
    projectIssues: ProjectIssue[];
    filteredProjectIssues: ProjectIssue[];
    pagedProjectIssues: ProjectIssue[];
    issueDraft: Partial<ProjectIssue>;
    editingIssueId: string;

    // Milestones tab
    projectMilestones: ProjectMilestone[];
    filteredProjectMilestones: ProjectMilestone[];
    pagedProjectMilestones: ProjectMilestone[];
    milestoneDraft: Partial<ProjectMilestone>;
    editingMilestoneId: string;

    // Scripts tab
    projectScripts: ProjectScript[];
    filteredProjectScripts: ProjectScript[];
    pagedProjectScripts: ProjectScript[];
    scriptForm: { episode: number; title: string; status: ProjectScript["status"]; content: string; notes: string };
    editingScriptId: string;
    scriptStatusText: (status: ProjectScript["status"]) => string;


    // Storyboards tab
    projectStoryboards: ProjectStoryboard[];
    filteredProjectStoryboards: ProjectStoryboard[];
    pagedProjectStoryboards: ProjectStoryboard[];
    storyboardDraft: StoryboardDraft;
    editingStoryboardId: string;
    selectedStoryboardIds: string[];
    characterAssets: ProjectAsset[];
    sceneAssets: ProjectAsset[];
    projectReviews: ProjectReview[];
    reviewDrafts: Record<string, string>;
    scriptDraft: string;
    storyboardStatuses: Array<{ key: ProjectStoryboardStatus; label: string }>;
    storyboardStatusText: (status: ProjectStoryboardStatus) => string;

    // Clips tab
    projectClips: ProjectClip[];
    filteredProjectClips: ProjectClip[];
    pagedProjectClips: ProjectClip[];
    clipDraft: Partial<ProjectClip>;
    editingClipId: string;
    clipStatuses: Array<{ key: ProjectClipStatus; label: string }>;
    clipStatusText: (status: ProjectClipStatus) => string;

    // Reviews tab
    // projectReviews already defined above
    filteredProjectReviews: ProjectReview[];
    pagedProjectReviews: ProjectReview[];
    reviewTargetLabel: (review: ProjectReview) => string;

    // Tasks tab
    // projectTasks already defined above
    filteredProjectTasks: ProjectTask[];
    pagedProjectTasks: ProjectTask[];
    taskDraft: Partial<ProjectTask>;
    editingTaskId: string;
    projectTaskColumns: readonly { key: ProjectTaskStatus; label: string }[];

    // Assets tab
    // projectAssets defined below
    projectAssets: ProjectAsset[];
    filteredProjectAssets: ProjectAsset[];
    pagedProjectAssets: ProjectAsset[];
    assetDrafts: Record<ProjectAssetKind, AssetDraft>;
    editingAssetId: string;
    assetComposerKind: ProjectAssetKind;
    assetSearch: string;
    assetKindFilter: ProjectAssetKind | "all";
    assetTagFilter: string;
    assetFavoriteOnly: boolean;
    projectAssetKinds: readonly { key: ProjectAssetKind; label: string; placeholder: string }[];
    assetKindCounts: Record<string, number>;
    currentAssetDraft: AssetDraft;

    // Exports tab - projectScripts, projectStoryboards, projectClips, projectAssets already defined

    // Callbacks
    setCurrentWorkbenchPage: (page: number) => void;
    openWorkbenchPage: (tab: WorkbenchTab) => void;
    saveProjectPlan: () => Promise<void>;
    setProjectDraft: (updater: (draft: Partial<Project>) => Partial<Project>) => void;

    resetProjectMemberForm: () => void;
    editProjectMemberItem: (member: ProjectMember) => void;
    deleteProjectMemberItem: (member: ProjectMember) => Promise<void>;
    submitProjectMemberForm: () => Promise<void>;
    setMemberDraft: (updater: (draft: Partial<ProjectMember>) => Partial<ProjectMember>) => void;

    resetProjectEpisodeForm: () => void;
    editProjectEpisodeItem: (episode: ProjectEpisode) => void;
    deleteProjectEpisodeItem: (episode: ProjectEpisode) => Promise<void>;
    submitProjectEpisodeForm: () => Promise<void>;
    setEpisodeDraft: (updater: (draft: Partial<ProjectEpisode>) => Partial<ProjectEpisode>) => void;

    resetProjectIssueForm: () => void;
    editProjectIssueItem: (issue: ProjectIssue) => void;
    deleteProjectIssueItem: (issue: ProjectIssue) => Promise<void>;
    submitProjectIssueForm: () => Promise<void>;
    setIssueDraft: (updater: (draft: Partial<ProjectIssue>) => Partial<ProjectIssue>) => void;

    resetProjectMilestoneForm: () => void;
    editProjectMilestoneItem: (milestone: ProjectMilestone) => void;
    deleteProjectMilestoneItem: (milestone: ProjectMilestone) => Promise<void>;
    submitProjectMilestoneForm: () => Promise<void>;
    setMilestoneDraft: (updater: (draft: Partial<ProjectMilestone>) => Partial<ProjectMilestone>) => void;

    resetProjectScriptForm: () => void;
    editProjectScriptItem: (script: ProjectScript) => void;
    deleteProjectScriptItem: (script: ProjectScript) => Promise<void>;
    submitProjectScriptForm: () => Promise<void>;
    breakdownSavedScript: (script: ProjectScript) => Promise<void>;
    setScriptForm: (updater: (draft: { episode: number; title: string; status: ProjectScript["status"]; content: string; notes: string }) => { episode: number; title: string; status: ProjectScript["status"]; content: string; notes: string }) => void;

    createProjectStoryboardItem: () => Promise<void>;
    editProjectStoryboard: (storyboard: ProjectStoryboard) => void;
    deleteProjectStoryboardItem: (storyboard: ProjectStoryboard) => Promise<void>;
    breakdownScriptToStoryboards: () => Promise<void>;
    batchUpdateStoryboards: (status: ProjectStoryboardStatus) => Promise<void>;
    toggleStoryboardSelection: (storyboardId: string) => void;
    useStoryboardForGeneration: (storyboard: ProjectStoryboard, targetMode: "image" | "video") => void;
    createStoryboardReview: (storyboard: ProjectStoryboard) => Promise<void>;
    updateProjectReviewItem: (review: ProjectReview, patch: Partial<ProjectReview>) => Promise<void>;
    deleteProjectReviewItem: (review: ProjectReview) => Promise<void>;
    setStoryboardDraft: (updater: (draft: StoryboardDraft) => StoryboardDraft) => void;
    setScriptDraft: (value: string) => void;
    setReviewDrafts: (updater: (drafts: Record<string, string>) => Record<string, string>) => void;
    setSelectedStoryboardIds: (ids: string[] | ((ids: string[]) => string[])) => void;
    setEditingStoryboardId: (id: string) => void;

    resetProjectClipForm: () => void;
    editProjectClipItem: (clip: ProjectClip) => void;
    deleteProjectClipItem: (clip: ProjectClip) => Promise<void>;
    submitProjectClipForm: () => Promise<void>;
    syncProjectClips: () => Promise<void>;
    setClipDraft: (updater: (draft: Partial<ProjectClip>) => Partial<ProjectClip>) => void;

    // updateProjectReviewItem, deleteProjectReviewItem already defined above

    resetProjectTaskForm: () => void;
    editProjectTaskItem: (task: ProjectTask) => void;
    deleteProjectTaskItem: (task: ProjectTask) => Promise<void>;
    submitProjectTaskForm: () => Promise<void>;
    setTaskDraft: (updater: (draft: Partial<ProjectTask>) => Partial<ProjectTask>) => void;

    resetProjectAssetForm: (kind: ProjectAssetKind) => void;
    editProjectAssetItem: (asset: ProjectAsset) => void;
    deleteProjectAssetItem: (asset: ProjectAsset) => Promise<void>;
    submitProjectAssetForm: () => Promise<void>;
    reuseProjectAsset: (asset: ProjectAsset, targetMode?: "image" | "video") => Promise<void>;
    toggleProjectAssetFavorite: (asset: ProjectAsset) => Promise<void>;
    projectAssetReferenceUrls: (asset: ProjectAsset) => string[];
    continueEditImage: (url: string) => void;
    setAssetDrafts: (updater: (drafts: Record<ProjectAssetKind, AssetDraft>) => Record<ProjectAssetKind, AssetDraft>) => void;
    setAssetComposerKind: (kind: ProjectAssetKind) => void;
    setAssetSearch: (value: string) => void;
    setAssetKindFilter: (kind: ProjectAssetKind | "all") => void;
    setAssetTagFilter: (value: string) => void;
    setAssetFavoriteOnly: (value: boolean | ((value: boolean) => boolean)) => void;

    downloadProjectExport: (file: "scripts.txt" | "edit-list.csv" | "manifest.json") => void;
    downloadStoryboardCsv: () => void;
    generateProjectPackageIndex: () => Promise<void>;
    openProjectFolder: (project: Project) => Promise<void>;
    refreshProjectWorkbench: () => Promise<void>;
    copy: (text: string) => Promise<void>;
}

export function ProjectWorkbenchTabs(props: ProjectWorkbenchTabsProps) {
    return (
        <>
            {props.projectWorkbenchTab === "overview" && (
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
                            <Button size="sm" onClick={() => void props.saveProjectPlan()} className="transition-all duration-200 hover:scale-[1.02]"><Check className="h-4 w-4" />保存信息</Button>
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
            )}

            {props.projectWorkbenchTab === "members" && (
                <div className="space-y-4">
                    <div className="rounded-2xl border border-white/10 bg-[#202020]">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
                            <div>
                                <div className="text-base font-semibold text-white">团队成员</div>
                                <div className="mt-1 text-sm text-[#bdbdbd]">维护导演、编剧、美术、剪辑、审核等小团队成员。</div>
                            </div>
                            <Button size="sm" variant="secondary" onClick={props.resetProjectMemberForm}><Plus className="h-4 w-4" />新增成员</Button>
                        </div>
                        {props.filteredProjectMembers.length === 0 ? (
                            <div className="px-5 py-10 text-center">
                                <div className="text-base font-semibold text-white">{props.projectMembers.length === 0 ? "还没有团队成员" : "没有匹配的成员"}</div>
                                <div className="mt-2 text-sm text-[#bdbdbd]">{props.projectMembers.length === 0 ? "先在下方添加导演、编剧、美术或剪辑成员。" : "调整搜索、状态或负责人筛选后再试。"}</div>
                            </div>
                        ) : (
                            <ProjectManagementTable columns={["姓名", "角色", "联系方式", "职责说明", "操作"]}>
                                {props.pagedProjectMembers.map((member) => (
                                    <tr key={member.id} className="align-top transition-colors hover:bg-white/[0.03]">
                                        <td className="px-4 py-4 font-semibold text-white">{member.name}</td>
                                        <td className="px-4 py-4">
                                            <span className="inline-flex rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-xs font-medium text-[#dcdcdc]">{member.role}</span>
                                        </td>
                                        <td className="px-4 py-4 text-[#cfcfcf]">{member.contact || "未填写"}</td>
                                        <td className="px-4 py-4">
                                            <div className="line-clamp-2 max-w-[360px] whitespace-pre-wrap text-[#cfcfcf]">{member.notes || "无"}</div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex flex-wrap gap-2">
                                                <Button size="sm" variant="secondary" onClick={() => props.editProjectMemberItem(member)}><Pencil className="h-4 w-4" />编辑</Button>
                                                <Button size="sm" variant="destructive" onClick={() => void props.deleteProjectMemberItem(member)}><Trash2 className="h-4 w-4" /></Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </ProjectManagementTable>
                        )}
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-[#202020] p-5">
                        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <div className="text-base font-semibold text-white">{props.editingMemberId ? "编辑成员" : "新增成员"}</div>
                                <div className="mt-1 text-sm text-[#bdbdbd]">成员姓名会在任务、问题、里程碑负责人中复用。</div>
                            </div>
                            {props.editingMemberId && <Button size="sm" variant="secondary" onClick={props.resetProjectMemberForm}>取消编辑</Button>}
                        </div>
                        <div className="grid grid-cols-3 gap-3 max-lg:grid-cols-1">
                            <label className="space-y-1.5">
                                <span className="block text-sm font-medium text-[#d8d8d8]">成员姓名</span>
                                <input className="h-11 w-full rounded-xl border border-white/10 bg-[#2f2f2f] px-3 text-sm text-white outline-none transition-colors focus:border-emerald-500" value={props.memberDraft.name ?? ""} placeholder="例如：张导" onChange={(event) => props.setMemberDraft((draft) => ({ ...draft, name: event.target.value }))} />
                            </label>
                            <label className="space-y-1.5">
                                <span className="block text-sm font-medium text-[#d8d8d8]">角色</span>
                                <select className="h-11 w-full rounded-xl border border-white/10 bg-[#2f2f2f] px-3 text-sm text-white outline-none transition-colors focus:border-emerald-500" value={props.memberDraft.role ?? ""} onChange={(event) => props.setMemberDraft((draft) => ({ ...draft, role: event.target.value }))}>
                                    {["制片", "导演", "编剧", "分镜", "美术", "剪辑", "审核", "运营", "成员"].map((role) => <option key={role}>{role}</option>)}
                                </select>
                            </label>
                            <label className="space-y-1.5">
                                <span className="block text-sm font-medium text-[#d8d8d8]">联系方式</span>
                                <input className="h-11 w-full rounded-xl border border-white/10 bg-[#2f2f2f] px-3 text-sm text-white outline-none transition-colors focus:border-emerald-500" value={props.memberDraft.contact ?? ""} placeholder="手机号、微信或邮箱" onChange={(event) => props.setMemberDraft((draft) => ({ ...draft, contact: event.target.value }))} />
                            </label>
                        </div>
                        <label className="mt-3 block space-y-1.5">
                            <span className="block text-sm font-medium text-[#d8d8d8]">职责说明</span>
                            <textarea className="min-h-24 w-full resize-y rounded-xl border border-white/10 bg-[#2f2f2f] px-3 py-3 text-sm leading-6 text-white outline-none transition-colors focus:border-emerald-500" value={props.memberDraft.notes ?? ""} placeholder="例如：负责第1-3集分镜审核" onChange={(event) => props.setMemberDraft((draft) => ({ ...draft, notes: event.target.value }))} />
                        </label>
                        <div className="mt-5 flex justify-end">
                            <Button size="sm" onClick={() => void props.submitProjectMemberForm()}>
                                {props.editingMemberId ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                                {props.editingMemberId ? "保存成员" : "添加成员"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {props.projectWorkbenchTab === "episodes" && (
                <div className="space-y-4">
                    <div className="rounded-2xl border border-white/10 bg-[#202020]">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
                            <div>
                                <div className="text-base font-semibold text-white">剧集规划</div>
                                <div className="mt-1 text-sm text-[#bdbdbd]">按集管理故事简介、制作阶段、截止日期和备注。</div>
                            </div>
                            <Button size="sm" variant="secondary" onClick={props.resetProjectEpisodeForm}><Plus className="h-4 w-4" />新增剧集</Button>
                        </div>
                        {props.filteredProjectEpisodes.length === 0 ? (
                            <div className="px-5 py-10 text-center">
                                <div className="text-base font-semibold text-white">{props.projectEpisodes.length === 0 ? "还没有剧集规划" : "没有匹配的剧集"}</div>
                                <div className="mt-2 text-sm text-[#bdbdbd]">{props.projectEpisodes.length === 0 ? "先在下方添加第 1 集，后续剧本、分镜和剪辑都可以绑定到剧集。" : "调整搜索、状态或负责人筛选后再试。"}</div>
                            </div>
                        ) : (
                            <ProjectManagementTable columns={["集数", "标题", "阶段", "截止日期", "剧情简介", "备注", "操作"]}>
                                {props.pagedProjectEpisodes.map((episode) => (
                                    <tr key={episode.id} className="align-top transition-colors hover:bg-white/[0.03]">
                                        <td className="whitespace-nowrap px-4 py-4 font-semibold text-white">第{episode.episode}集</td>
                                        <td className="px-4 py-4">
                                            <div className="max-w-[200px] truncate font-semibold text-white">{episode.title || "未命名剧集"}</div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-100">{episode.status}</span>
                                        </td>
                                        <td className="px-4 py-4 text-[#cfcfcf]">{episode.due_date || "未设置"}</td>
                                        <td className="px-4 py-4">
                                            <div className="line-clamp-2 max-w-[300px] whitespace-pre-wrap text-[#cfcfcf]">{episode.summary || "无"}</div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="line-clamp-2 max-w-[220px] whitespace-pre-wrap text-[#bdbdbd]">{episode.notes || "无"}</div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex flex-wrap gap-2">
                                                <Button size="sm" variant="secondary" onClick={() => props.editProjectEpisodeItem(episode)}><Pencil className="h-4 w-4" />编辑</Button>
                                                <Button size="sm" variant="destructive" onClick={() => void props.deleteProjectEpisodeItem(episode)}><Trash2 className="h-4 w-4" /></Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </ProjectManagementTable>
                        )}
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-[#202020] p-5">
                        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <div className="text-base font-semibold text-white">{props.editingEpisodeId ? "编辑剧集" : "新增剧集"}</div>
                                <div className="mt-1 text-sm text-[#bdbdbd]">按集管理故事简介、制作阶段、截止日期和备注。</div>
                            </div>
                            {props.editingEpisodeId && <Button size="sm" variant="secondary" onClick={props.resetProjectEpisodeForm}>取消编辑</Button>}
                        </div>
                        <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-x-4 gap-y-3 max-md:grid-cols-1">
                            <label className="contents">
                                <span className="pt-3 text-right text-sm font-medium text-[#d8d8d8] max-md:pt-0 max-md:text-left">集数</span>
                                <input className="h-11 rounded-xl border border-white/10 bg-[#2f2f2f] px-3 text-sm text-white outline-none transition-colors focus:border-emerald-500" type="number" min={1} value={props.episodeDraft.episode ?? 1} placeholder="第几集" onChange={(event) => props.setEpisodeDraft((draft) => ({ ...draft, episode: Number(event.target.value) }))} />
                            </label>
                            <label className="contents">
                                <span className="pt-3 text-right text-sm font-medium text-[#d8d8d8] max-md:pt-0 max-md:text-left">标题</span>
                                <input className="h-11 rounded-xl border border-white/10 bg-[#2f2f2f] px-3 text-sm text-white outline-none transition-colors focus:border-emerald-500" value={props.episodeDraft.title ?? ""} placeholder="剧集标题" onChange={(event) => props.setEpisodeDraft((draft) => ({ ...draft, title: event.target.value }))} />
                            </label>
                            <label className="contents">
                                <span className="pt-3 text-right text-sm font-medium text-[#d8d8d8] max-md:pt-0 max-md:text-left">制作阶段</span>
                                <select className="h-11 rounded-xl border border-white/10 bg-[#2f2f2f] px-3 text-sm text-white outline-none transition-colors focus:border-emerald-500" value={props.episodeDraft.status ?? "策划中"} onChange={(event) => props.setEpisodeDraft((draft) => ({ ...draft, status: event.target.value }))}>
                                    {["策划中", "剧本中", "分镜中", "出图中", "视频中", "剪辑中", "审核中", "已完成"].map((status) => <option key={status}>{status}</option>)}
                                </select>
                            </label>
                            <label className="contents">
                                <span className="pt-3 text-right text-sm font-medium text-[#d8d8d8] max-md:pt-0 max-md:text-left">截止日期</span>
                                <input className="h-11 rounded-xl border border-white/10 bg-[#2f2f2f] px-3 text-sm text-white outline-none transition-colors focus:border-emerald-500" type="date" value={props.episodeDraft.due_date ?? ""} onChange={(event) => props.setEpisodeDraft((draft) => ({ ...draft, due_date: event.target.value }))} />
                            </label>
                            <label className="contents">
                                <span className="pt-3 text-right text-sm font-medium text-[#d8d8d8] max-md:pt-0 max-md:text-left">剧情简介</span>
                                <textarea className="min-h-28 w-full resize-y rounded-xl border border-white/10 bg-[#2f2f2f] px-3 py-3 text-sm leading-6 text-white outline-none transition-colors focus:border-emerald-500" value={props.episodeDraft.summary ?? ""} placeholder="本集剧情简介" onChange={(event) => props.setEpisodeDraft((draft) => ({ ...draft, summary: event.target.value }))} />
                            </label>
                            <label className="contents">
                                <span className="pt-3 text-right text-sm font-medium text-[#d8d8d8] max-md:pt-0 max-md:text-left">备注</span>
                                <textarea className="min-h-20 w-full resize-y rounded-xl border border-white/10 bg-[#2f2f2f] px-3 py-3 text-sm leading-6 text-white outline-none transition-colors focus:border-emerald-500" value={props.episodeDraft.notes ?? ""} placeholder="制作备注、风险、交付要求" onChange={(event) => props.setEpisodeDraft((draft) => ({ ...draft, notes: event.target.value }))} />
                            </label>
                        </div>
                        <div className="mt-5 flex justify-end">
                            <Button size="sm" onClick={() => void props.submitProjectEpisodeForm()}>
                                {props.editingEpisodeId ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                                {props.editingEpisodeId ? "保存剧集" : "添加剧集"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {props.projectWorkbenchTab === "issues" && (
                <div className="space-y-4">
                    <div className="rounded-2xl border border-white/10 bg-[#202020]">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
                            <div>
                                <div className="text-base font-semibold text-white">问题与风险</div>
                                <div className="mt-1 text-sm text-[#bdbdbd]">记录影响交付的风险、阻塞点和待决策事项。</div>
                            </div>
                            <Button size="sm" variant="secondary" onClick={props.resetProjectIssueForm}><Plus className="h-4 w-4" />新增问题</Button>
                        </div>
                        {props.filteredProjectIssues.length === 0 ? (
                            <div className="px-5 py-10 text-center">
                                <div className="text-base font-semibold text-white">{props.projectIssues.length === 0 ? "暂无问题或风险" : "没有匹配的问题"}</div>
                                <div className="mt-2 text-sm text-[#bdbdbd]">{props.projectIssues.length === 0 ? "项目风险会影响交付节奏，建议及时记录并指定负责人。" : "调整搜索、状态或负责人筛选后再试。"}</div>
                            </div>
                        ) : (
                            <ProjectManagementTable columns={["标题", "级别", "状态", "负责人", "说明", "操作"]}>
                                {props.pagedProjectIssues.map((issue) => (
                                    <tr key={issue.id} className="align-top transition-colors hover:bg-white/[0.03]">
                                        <td className="px-4 py-4">
                                            <div className="max-w-[260px] truncate font-semibold text-white">{issue.title}</div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className="inline-flex rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-xs font-medium text-[#dcdcdc]">{issue.severity === "critical" ? "严重" : issue.severity === "high" ? "高" : issue.severity === "medium" ? "中" : "低"}</span>
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className="inline-flex rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-xs font-medium text-[#dcdcdc]">{issue.status === "open" ? "待处理" : issue.status === "doing" ? "处理中" : issue.status === "resolved" ? "已解决" : "已关闭"}</span>
                                        </td>
                                        <td className="px-4 py-4 text-[#cfcfcf]">{issue.owner || "未分配"}</td>
                                        <td className="px-4 py-4">
                                            <div className="line-clamp-2 max-w-[360px] whitespace-pre-wrap text-[#cfcfcf]">{issue.notes || "无"}</div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex flex-wrap gap-2">
                                                <Button size="sm" variant="secondary" onClick={() => props.editProjectIssueItem(issue)}><Pencil className="h-4 w-4" />编辑</Button>
                                                <Button size="sm" variant="destructive" onClick={() => void props.deleteProjectIssueItem(issue)}><Trash2 className="h-4 w-4" /></Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </ProjectManagementTable>
                        )}
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-[#202020] p-5">
                        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <div className="text-base font-semibold text-white">{props.editingIssueId ? "编辑问题" : "新增问题"}</div>
                                <div className="mt-1 text-sm text-[#bdbdbd]">记录风险级别、处理状态、负责人和解决方案。</div>
                            </div>
                            {props.editingIssueId && <Button size="sm" variant="secondary" onClick={props.resetProjectIssueForm}>取消编辑</Button>}
                        </div>
                        <div className="grid grid-cols-4 gap-3 max-lg:grid-cols-2 max-md:grid-cols-1">
                            <label className="space-y-1.5 lg:col-span-2">
                                <span className="block text-sm font-medium text-[#d8d8d8]">问题标题</span>
                                <input className="h-11 w-full rounded-xl border border-white/10 bg-[#2f2f2f] px-3 text-sm text-white outline-none transition-colors focus:border-emerald-500" value={props.issueDraft.title ?? ""} placeholder="问题标题" onChange={(event) => props.setIssueDraft((draft) => ({ ...draft, title: event.target.value }))} />
                            </label>
                            <label className="space-y-1.5">
                                <span className="block text-sm font-medium text-[#d8d8d8]">级别</span>
                                <select className="h-11 w-full rounded-xl border border-white/10 bg-[#2f2f2f] px-3 text-sm text-white outline-none transition-colors focus:border-emerald-500" value={props.issueDraft.severity ?? "low"} onChange={(event) => props.setIssueDraft((draft) => ({ ...draft, severity: event.target.value as ProjectIssueSeverity }))}>
                                    <option value="low">低</option>
                                    <option value="medium">中</option>
                                    <option value="high">高</option>
                                    <option value="critical">严重</option>
                                </select>
                            </label>
                            <label className="space-y-1.5">
                                <span className="block text-sm font-medium text-[#d8d8d8]">状态</span>
                                <select className="h-11 w-full rounded-xl border border-white/10 bg-[#2f2f2f] px-3 text-sm text-white outline-none transition-colors focus:border-emerald-500" value={props.issueDraft.status ?? "open"} onChange={(event) => props.setIssueDraft((draft) => ({ ...draft, status: event.target.value as ProjectIssueStatus }))}>
                                    <option value="open">待处理</option>
                                    <option value="doing">处理中</option>
                                    <option value="resolved">已解决</option>
                                    <option value="closed">已关闭</option>
                                </select>
                            </label>
                            <label className="space-y-1.5">
                                <span className="block text-sm font-medium text-[#d8d8d8]">负责人</span>
                                <select className="h-11 w-full rounded-xl border border-white/10 bg-[#2f2f2f] px-3 text-sm text-white outline-none transition-colors focus:border-emerald-500" value={props.issueDraft.owner ?? ""} onChange={(event) => props.setIssueDraft((draft) => ({ ...draft, owner: event.target.value }))}>
                                    <option value="">负责人</option>
                                    {props.projectMembers.map((member) => <option key={member.id} value={member.name}>{member.name} · {member.role}</option>)}
                                </select>
                            </label>
                        </div>
                        <label className="mt-3 block space-y-1.5">
                            <span className="block text-sm font-medium text-[#d8d8d8]">问题说明</span>
                            <textarea className="min-h-24 w-full resize-y rounded-xl border border-white/10 bg-[#2f2f2f] px-3 py-3 text-sm leading-6 text-white outline-none transition-colors focus:border-emerald-500" value={props.issueDraft.notes ?? ""} placeholder="问题描述、影响范围、解决方案" onChange={(event) => props.setIssueDraft((draft) => ({ ...draft, notes: event.target.value }))} />
                        </label>
                        <div className="mt-5 flex justify-end">
                            <Button size="sm" onClick={() => void props.submitProjectIssueForm()}>
                                {props.editingIssueId ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                                {props.editingIssueId ? "保存问题" : "添加问题"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {props.projectWorkbenchTab === "milestones" && (
                <div className="space-y-4">
                    <div className="rounded-2xl border border-white/10 bg-[#202020]">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
                            <div>
                                <div className="text-base font-semibold text-white">里程碑</div>
                                <div className="mt-1 text-sm text-[#bdbdbd]">管理样片、分镜锁定、成片审核、最终交付等关键节点。</div>
                            </div>
                            <Button size="sm" variant="secondary" onClick={props.resetProjectMilestoneForm}><Plus className="h-4 w-4" />新增里程碑</Button>
                        </div>
                        {props.filteredProjectMilestones.length === 0 ? (
                            <div className="px-5 py-10 text-center">
                                <div className="text-base font-semibold text-white">{props.projectMilestones.length === 0 ? "暂无里程碑" : "没有匹配的里程碑"}</div>
                                <div className="mt-2 text-sm text-[#bdbdbd]">{props.projectMilestones.length === 0 ? "可以先添加\"第一集样片交付\"作为关键节点。" : "调整搜索、状态或负责人筛选后再试。"}</div>
                            </div>
                        ) : (
                            <ProjectManagementTable columns={["标题", "状态", "负责人", "截止日期", "交付说明", "操作"]}>
                                {props.pagedProjectMilestones.map((milestone) => (
                                    <tr key={milestone.id} className="align-top transition-colors hover:bg-white/[0.03]">
                                        <td className="px-4 py-4">
                                            <div className="max-w-[260px] truncate font-semibold text-white">{milestone.title}</div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className="inline-flex rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-xs font-medium text-[#dcdcdc]">{milestone.status === "planned" ? "计划中" : milestone.status === "doing" ? "进行中" : milestone.status === "done" ? "已完成" : "延期"}</span>
                                        </td>
                                        <td className="px-4 py-4 text-[#cfcfcf]">{milestone.owner || "未分配"}</td>
                                        <td className="px-4 py-4 text-[#cfcfcf]">{milestone.due_date || "未设置"}</td>
                                        <td className="px-4 py-4">
                                            <div className="line-clamp-2 max-w-[360px] whitespace-pre-wrap text-[#cfcfcf]">{milestone.description || "无"}</div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex flex-wrap gap-2">
                                                <Button size="sm" variant="secondary" onClick={() => props.editProjectMilestoneItem(milestone)}><Pencil className="h-4 w-4" />编辑</Button>
                                                <Button size="sm" variant="destructive" onClick={() => void props.deleteProjectMilestoneItem(milestone)}><Trash2 className="h-4 w-4" /></Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </ProjectManagementTable>
                        )}
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-[#202020] p-5">
                        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <div className="text-base font-semibold text-white">{props.editingMilestoneId ? "编辑里程碑" : "新增里程碑"}</div>
                                <div className="mt-1 text-sm text-[#bdbdbd]">定义交付范围、验收标准、负责人和截止日期。</div>
                            </div>
                            {props.editingMilestoneId && <Button size="sm" variant="secondary" onClick={props.resetProjectMilestoneForm}>取消编辑</Button>}
                        </div>
                        <div className="grid grid-cols-4 gap-3 max-lg:grid-cols-2 max-md:grid-cols-1">
                            <label className="space-y-1.5 lg:col-span-2">
                                <span className="block text-sm font-medium text-[#d8d8d8]">里程碑标题</span>
                                <input className="h-11 w-full rounded-xl border border-white/10 bg-[#2f2f2f] px-3 text-sm text-white outline-none transition-colors focus:border-emerald-500" value={props.milestoneDraft.title ?? ""} placeholder="里程碑标题" onChange={(event) => props.setMilestoneDraft((draft) => ({ ...draft, title: event.target.value }))} />
                            </label>
                            <label className="space-y-1.5">
                                <span className="block text-sm font-medium text-[#d8d8d8]">状态</span>
                                <select className="h-11 w-full rounded-xl border border-white/10 bg-[#2f2f2f] px-3 text-sm text-white outline-none transition-colors focus:border-emerald-500" value={props.milestoneDraft.status ?? "planned"} onChange={(event) => props.setMilestoneDraft((draft) => ({ ...draft, status: event.target.value as ProjectMilestoneStatus }))}>
                                    <option value="planned">计划中</option>
                                    <option value="doing">进行中</option>
                                    <option value="done">已完成</option>
                                    <option value="delayed">延期</option>
                                </select>
                            </label>
                            <label className="space-y-1.5">
                                <span className="block text-sm font-medium text-[#d8d8d8]">负责人</span>
                                <select className="h-11 w-full rounded-xl border border-white/10 bg-[#2f2f2f] px-3 text-sm text-white outline-none transition-colors focus:border-emerald-500" value={props.milestoneDraft.owner ?? ""} onChange={(event) => props.setMilestoneDraft((draft) => ({ ...draft, owner: event.target.value }))}>
                                    <option value="">负责人</option>
                                    {props.projectMembers.map((member) => <option key={member.id} value={member.name}>{member.name} · {member.role}</option>)}
                                </select>
                            </label>
                            <label className="space-y-1.5">
                                <span className="block text-sm font-medium text-[#d8d8d8]">截止日期</span>
                                <input className="h-11 w-full rounded-xl border border-white/10 bg-[#2f2f2f] px-3 text-sm text-white outline-none transition-colors focus:border-emerald-500" type="date" value={props.milestoneDraft.due_date ?? ""} onChange={(event) => props.setMilestoneDraft((draft) => ({ ...draft, due_date: event.target.value }))} />
                            </label>
                        </div>
                        <label className="mt-3 block space-y-1.5">
                            <span className="block text-sm font-medium text-[#d8d8d8]">交付说明</span>
                            <textarea className="min-h-24 w-full resize-y rounded-xl border border-white/10 bg-[#2f2f2f] px-3 py-3 text-sm leading-6 text-white outline-none transition-colors focus:border-emerald-500" value={props.milestoneDraft.description ?? ""} placeholder="交付范围、验收标准、依赖事项" onChange={(event) => props.setMilestoneDraft((draft) => ({ ...draft, description: event.target.value }))} />
                        </label>
                        <div className="mt-5 flex justify-end">
                            <Button size="sm" onClick={() => void props.submitProjectMilestoneForm()}>
                                {props.editingMilestoneId ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                                {props.editingMilestoneId ? "保存里程碑" : "添加里程碑"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {props.projectWorkbenchTab === "scripts" && (
                <div className="space-y-4">
                    <div className="rounded-2xl border border-white/10 bg-[#202020]">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
                            <div>
                                <div className="text-base font-semibold text-white">剧本列表</div>
                                <div className="mt-1 text-sm text-[#bdbdbd]">按剧集管理剧本文档，后续可直接拆分镜和导出交付。</div>
                            </div>
                            <Button size="sm" variant="secondary" onClick={() => props.downloadProjectExport("scripts.txt")}><Download className="h-4 w-4" />导出剧本</Button>
                        </div>
                        {props.filteredProjectScripts.length === 0 ? (
                            props.projectScripts.length === 0 ? (
                                <div className="px-5 py-10 text-center">
                                    <div className="text-base font-semibold text-white">还没有剧本</div>
                                    <div className="mt-2 text-sm text-[#bdbdbd]">先在下方新增第一集剧本，保存后即可生成分镜。</div>
                                </div>
                            ) : (
                                <div className="px-5 py-10 text-center">
                                    <div className="text-base font-semibold text-white">没有匹配的剧本</div>
                                    <div className="mt-2 text-sm text-[#bdbdbd]">调整搜索、状态或负责人筛选后再试。</div>
                                </div>
                            )
                        ) : (
                            <ProjectManagementTable columns={["集数", "标题", "状态", "内容摘要", "备注", "操作"]}>
                                {props.pagedProjectScripts.map((script) => (
                                    <tr key={script.id} className="align-top transition-colors hover:bg-white/[0.03]">
                                        <td className="whitespace-nowrap px-4 py-4 font-semibold text-white">第{script.episode}集</td>
                                        <td className="px-4 py-4">
                                            <div className="max-w-[220px] truncate font-semibold text-white">{script.title || "未命名剧本"}</div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className="inline-flex rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-xs font-medium text-[#dcdcdc]">{props.scriptStatusText(script.status)}</span>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="line-clamp-2 max-w-[360px] whitespace-pre-wrap text-[#cfcfcf]">{script.content || "暂无正文"}</div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="line-clamp-2 max-w-[180px] whitespace-pre-wrap text-[#bdbdbd]">{script.notes || "无"}</div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex flex-wrap gap-2">
                                                <Button size="sm" variant="secondary" onClick={() => void props.breakdownSavedScript(script)}>生成分镜</Button>
                                                <Button size="sm" variant="secondary" onClick={() => props.editProjectScriptItem(script)}><Pencil className="h-4 w-4" />编辑</Button>
                                                <Button size="sm" variant="destructive" onClick={() => void props.deleteProjectScriptItem(script)}><Trash2 className="h-4 w-4" /></Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </ProjectManagementTable>
                        )}
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-[#202020] p-5">
                        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <div className="text-base font-semibold text-white">{props.editingScriptId ? "编辑剧本" : "新增剧本"}</div>
                                <div className="mt-1 text-sm text-[#bdbdbd]">填写剧集、状态、标题和正文，保存后会出现在上方列表。</div>
                            </div>
                            {props.editingScriptId && <Button size="sm" variant="secondary" onClick={props.resetProjectScriptForm}>取消编辑</Button>}
                        </div>
                        <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-x-4 gap-y-3 max-md:grid-cols-1">
                            <label className="contents">
                                <span className="pt-3 text-right text-sm font-medium text-[#d8d8d8] max-md:pt-0 max-md:text-left">剧集</span>
                                <input className="h-11 rounded-xl border border-white/10 bg-[#2f2f2f] px-3 text-sm text-white outline-none transition-colors focus:border-emerald-500" type="number" min={1} value={props.scriptForm.episode} placeholder="第几集" onChange={(event) => props.setScriptForm((draft) => ({ ...draft, episode: Number(event.target.value) }))} />
                            </label>
                            <label className="contents">
                                <span className="pt-3 text-right text-sm font-medium text-[#d8d8d8] max-md:pt-0 max-md:text-left">状态</span>
                                <select className="h-11 rounded-xl border border-white/10 bg-[#2f2f2f] px-3 text-sm text-white outline-none transition-colors focus:border-emerald-500" value={props.scriptForm.status} onChange={(event) => props.setScriptForm((draft) => ({ ...draft, status: event.target.value as ProjectScript["status"] }))}>
                                    <option value="draft">草稿</option>
                                    <option value="ready">可拆分镜</option>
                                    <option value="storyboarded">已生成分镜</option>
                                    <option value="archived">已归档</option>
                                </select>
                            </label>
                            <label className="contents">
                                <span className="pt-3 text-right text-sm font-medium text-[#d8d8d8] max-md:pt-0 max-md:text-left">标题</span>
                                <input className="h-11 rounded-xl border border-white/10 bg-[#2f2f2f] px-3 text-sm text-white outline-none transition-colors focus:border-emerald-500" value={props.scriptForm.title} placeholder="例如：第一集 归来" onChange={(event) => props.setScriptForm((draft) => ({ ...draft, title: event.target.value }))} />
                            </label>
                            <label className="contents">
                                <span className="pt-3 text-right text-sm font-medium text-[#d8d8d8] max-md:pt-0 max-md:text-left">正文</span>
                                <textarea className="min-h-48 w-full resize-y rounded-xl border border-white/10 bg-[#2f2f2f] px-3 py-3 text-sm leading-6 text-white outline-none transition-colors focus:border-emerald-500" value={props.scriptForm.content} placeholder="粘贴或编写剧本文本" onChange={(event) => props.setScriptForm((draft) => ({ ...draft, content: event.target.value }))} />
                            </label>
                            <label className="contents">
                                <span className="pt-3 text-right text-sm font-medium text-[#d8d8d8] max-md:pt-0 max-md:text-left">备注</span>
                                <textarea className="min-h-20 w-full resize-y rounded-xl border border-white/10 bg-[#2f2f2f] px-3 py-3 text-sm leading-6 text-white outline-none transition-colors focus:border-emerald-500" value={props.scriptForm.notes} placeholder="制作备注、改稿要求、交付说明" onChange={(event) => props.setScriptForm((draft) => ({ ...draft, notes: event.target.value }))} />
                            </label>
                        </div>
                        <div className="mt-5 flex justify-end">
                            <Button size="sm" onClick={() => void props.submitProjectScriptForm()}>
                                {props.editingScriptId ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                                {props.editingScriptId ? "保存剧本" : "添加剧本"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {props.projectWorkbenchTab === "storyboards" && (
                <div className="space-y-3">
                    <div className="rounded-lg border border-white/10 bg-[#202020] p-3">
                        <div className="mb-3 flex items-center justify-between gap-3">
                            <div>
                                <div className="text-sm font-semibold">分镜中心</div>
                                <div className="text-xs text-[#b4b4b4]">每条分镜绑定底图、视频、角色、场景和提示词。</div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Button size="sm" variant="secondary" onClick={props.downloadStoryboardCsv}><Download className="h-4 w-4" />导出分镜表</Button>
                                {props.editingStoryboardId && <Button size="sm" variant="secondary" onClick={() => {
                                    props.setEditingStoryboardId("");
                                    props.setStoryboardDraft((draft) => ({ ...draft, title: "", description: "", dialogue: "", prompt: "", status: "draft", character_asset_ids: [], scene_asset_id: "" }));
                                }}>取消编辑</Button>}
                                <Button size="sm" onClick={() => void props.createProjectStoryboardItem()}>
                                    {props.editingStoryboardId ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                                    {props.editingStoryboardId ? "保存修改" : "新增分镜"}
                                </Button>
                            </div>
                        </div>
                        <div className="mb-3 rounded-lg border border-white/10 bg-[#2a2a2a] p-3">
                            <div className="mb-2 flex items-center justify-between gap-2">
                                <div className="text-xs font-medium text-white">剧本自动拆分镜</div>
                                <Button size="sm" variant="secondary" onClick={() => void props.breakdownScriptToStoryboards()}>生成分镜</Button>
                            </div>
                            <textarea
                                className="min-h-24 w-full resize-none rounded-lg border border-white/10 bg-[#202020] px-3 py-2 text-xs text-white outline-none focus:border-emerald-500"
                                value={props.scriptDraft}
                                placeholder="粘贴剧本文本，系统会自动拆场景、生成分镜和提示词，并尝试绑定已有角色/场景资产"
                                onChange={(event) => props.setScriptDraft(event.target.value)}
                            />
                        </div>
                        <div className="grid grid-cols-6 gap-2 max-lg:grid-cols-2 max-md:grid-cols-1">
                            <input className="h-9 rounded-lg border border-white/10 bg-[#2f2f2f] px-3 text-xs text-white outline-none focus:border-emerald-500" type="number" min={1} value={props.storyboardDraft.episode} placeholder="集数" onChange={(event) => props.setStoryboardDraft((draft) => ({ ...draft, episode: Number(event.target.value) }))} />
                            <input className="h-9 rounded-lg border border-white/10 bg-[#2f2f2f] px-3 text-xs text-white outline-none focus:border-emerald-500" value={props.storyboardDraft.scene} placeholder="场次" onChange={(event) => props.setStoryboardDraft((draft) => ({ ...draft, scene: event.target.value }))} />
                            <input className="h-9 rounded-lg border border-white/10 bg-[#2f2f2f] px-3 text-xs text-white outline-none focus:border-emerald-500" value={props.storyboardDraft.shot} placeholder="镜号" onChange={(event) => props.setStoryboardDraft((draft) => ({ ...draft, shot: event.target.value }))} />
                            <select className="h-9 rounded-lg border border-white/10 bg-[#2f2f2f] px-3 text-xs text-white outline-none focus:border-emerald-500" value={props.storyboardDraft.status} onChange={(event) => props.setStoryboardDraft((draft) => ({ ...draft, status: event.target.value as ProjectStoryboardStatus }))}>
                                {props.storyboardStatuses.map((status) => <option key={status.key} value={status.key}>{status.label}</option>)}
                            </select>
                            <input className="h-9 rounded-lg border border-white/10 bg-[#2f2f2f] px-3 text-xs text-white outline-none focus:border-emerald-500" value={props.storyboardDraft.title} placeholder="分镜标题" onChange={(event) => props.setStoryboardDraft((draft) => ({ ...draft, title: event.target.value }))} />
                            <input className="h-9 rounded-lg border border-white/10 bg-[#2f2f2f] px-3 text-xs text-white outline-none focus:border-emerald-500" type="number" min={1} value={props.storyboardDraft.duration} placeholder="时长" onChange={(event) => props.setStoryboardDraft((draft) => ({ ...draft, duration: Number(event.target.value) }))} />
                        </div>
                        <div className="mt-2 grid grid-cols-4 gap-2 max-lg:grid-cols-2 max-md:grid-cols-1">
                            <input className="h-9 rounded-lg border border-white/10 bg-[#2f2f2f] px-3 text-xs text-white outline-none focus:border-emerald-500" value={props.storyboardDraft.characters} placeholder="角色，逗号分隔" onChange={(event) => props.setStoryboardDraft((draft) => ({ ...draft, characters: event.target.value }))} />
                            <input className="h-9 rounded-lg border border-white/10 bg-[#2f2f2f] px-3 text-xs text-white outline-none focus:border-emerald-500" value={props.storyboardDraft.location} placeholder="场景" onChange={(event) => props.setStoryboardDraft((draft) => ({ ...draft, location: event.target.value }))} />
                            <input className="h-9 rounded-lg border border-white/10 bg-[#2f2f2f] px-3 text-xs text-white outline-none focus:border-emerald-500" value={props.storyboardDraft.shot_size} placeholder="景别" onChange={(event) => props.setStoryboardDraft((draft) => ({ ...draft, shot_size: event.target.value }))} />
                            <input className="h-9 rounded-lg border border-white/10 bg-[#2f2f2f] px-3 text-xs text-white outline-none focus:border-emerald-500" value={props.storyboardDraft.camera_move} placeholder="镜头运动" onChange={(event) => props.setStoryboardDraft((draft) => ({ ...draft, camera_move: event.target.value }))} />
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2 max-md:grid-cols-1">
                            <select
                                className="h-9 rounded-lg border border-white/10 bg-[#2f2f2f] px-3 text-xs text-white outline-none focus:border-emerald-500"
                                value={props.storyboardDraft.character_asset_ids[0] ?? ""}
                                onChange={(event) => props.setStoryboardDraft((draft) => ({ ...draft, character_asset_ids: event.target.value ? [event.target.value] : [] }))}
                            >
                                <option value="">绑定角色资产</option>
                                {props.characterAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
                            </select>
                            <select
                                className="h-9 rounded-lg border border-white/10 bg-[#2f2f2f] px-3 text-xs text-white outline-none focus:border-emerald-500"
                                value={props.storyboardDraft.scene_asset_id}
                                onChange={(event) => props.setStoryboardDraft((draft) => ({ ...draft, scene_asset_id: event.target.value }))}
                            >
                                <option value="">绑定场景资产</option>
                                {props.sceneAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
                            </select>
                        </div>
                        <textarea className="mt-2 min-h-16 w-full resize-none rounded-lg border border-white/10 bg-[#2f2f2f] px-3 py-2 text-xs text-white outline-none focus:border-emerald-500" value={props.storyboardDraft.description} placeholder="画面描述" onChange={(event) => props.setStoryboardDraft((draft) => ({ ...draft, description: event.target.value }))} />
                        <textarea className="mt-2 min-h-16 w-full resize-none rounded-lg border border-white/10 bg-[#2f2f2f] px-3 py-2 text-xs text-white outline-none focus:border-emerald-500" value={props.storyboardDraft.prompt} placeholder="生成提示词" onChange={(event) => props.setStoryboardDraft((draft) => ({ ...draft, prompt: event.target.value }))} />
                    </div>

                    {props.filteredProjectStoryboards.length > 0 && (
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-[#202020] px-3 py-2">
                            <label className="flex items-center gap-2 text-xs text-[#d8d8d8]">
                                <input
                                    className="h-4 w-4 accent-emerald-500"
                                    type="checkbox"
                                    checked={props.filteredProjectStoryboards.every((item) => props.selectedStoryboardIds.includes(item.id))}
                                    onChange={(event) => props.setSelectedStoryboardIds(event.target.checked ? props.filteredProjectStoryboards.map((item) => item.id) : [])}
                                />
                                已选 {props.selectedStoryboardIds.length} / {props.filteredProjectStoryboards.length} 条分镜
                            </label>
                            <div className="flex flex-wrap gap-2">
                                <Button size="sm" variant="secondary" onClick={() => props.setSelectedStoryboardIds([])}>清空</Button>
                                <Button size="sm" variant="secondary" onClick={() => void props.batchUpdateStoryboards("review")}>批量送审</Button>
                                <Button size="sm" variant="secondary" onClick={() => void props.batchUpdateStoryboards("done")}><Check className="h-4 w-4" />标记完成</Button>
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                        {props.filteredProjectStoryboards.length === 0 ? (
                            props.projectStoryboards.length === 0 ? (
                                <EmptyStoryboards onCreateStoryboard={() => void props.createProjectStoryboardItem()} />
                            ) : (
                                <div className="px-5 py-10 text-center">
                                    <div className="text-base font-semibold text-white">没有匹配的分镜</div>
                                    <div className="mt-2 text-sm text-[#bdbdbd]">调整搜索或状态筛选后再试。</div>
                                </div>
                            )
                        ) : (
                            props.pagedProjectStoryboards.map((storyboard) => (
                            <div key={storyboard.id} className="group relative rounded-lg border border-white/10 bg-[#202020] p-4 transition-all duration-200 hover:bg-white/5 hover:border-white/20">
                                <div className="flex flex-wrap items-start justify-between gap-4">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <input
                                                aria-label={`选择分镜 ${storyboard.title}`}
                                                className="h-4 w-4 accent-emerald-500"
                                                type="checkbox"
                                                checked={props.selectedStoryboardIds.includes(storyboard.id)}
                                                onChange={() => props.toggleStoryboardSelection(storyboard.id)}
                                            />
                                            <span className="rounded-md bg-white/10 px-2 py-1 text-xs">第{storyboard.episode}集</span>
                                            <span className="rounded-md bg-white/10 px-2 py-1 text-xs">{storyboard.scene}-{storyboard.shot}</span>
                                            <span className="rounded-md bg-white/10 px-2 py-1">{props.storyboardStatusText(storyboard.status)}</span>
                                        </div>
                                        <div className="mt-2 font-medium text-white">{storyboard.title}</div>
                                        <div className="mt-1 line-clamp-2 text-xs text-[#b4b4b4]">{storyboard.description || storyboard.prompt}</div>
                                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-[#b4b4b4]">
                                            {storyboard.characters.length > 0 && <span>角色：{storyboard.characters.join(" / ")}</span>}
                                            {storyboard.location && <span>场景：{storyboard.location}</span>}
                                            {storyboard.shot_size && <span>景别：{storyboard.shot_size}</span>}
                                            {storyboard.camera_move && <span>镜头：{storyboard.camera_move}</span>}
                                            <span>{storyboard.duration}s</span>
                                        </div>
                                        <div className="mt-2 flex flex-wrap gap-2 text-xs">
                                            {(storyboard.character_asset_ids ?? []).map((assetId) => {
                                                const asset = props.characterAssets.find((item) => item.id === assetId);
                                                return asset ? <span key={asset.id} className="rounded-md bg-emerald-500/10 px-2 py-1 text-emerald-200">角色卡：{asset.name}</span> : null;
                                            })}
                                            {storyboard.scene_asset_id && (() => {
                                                const asset = props.sceneAssets.find((item) => item.id === storyboard.scene_asset_id);
                                                return asset ? <span className="rounded-md bg-sky-500/10 px-2 py-1 text-sky-200">场景卡：{asset.name}</span> : null;
                                            })()}
                                        </div>
                                    </div>
                                    {storyboard.image_url && (
                                        <button className="w-40 h-24 overflow-hidden rounded-md bg-black/20 transition-all duration-200 hover:scale-[1.02]" onClick={() => window.open(storyboard.image_url, "_blank", "noopener,noreferrer")}>
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img className="aspect-video w-full h-full object-cover" src={storyboard.image_url} alt={storyboard.title} />
                                        </button>
                                    )}
                                    {/* 快捷操作按钮（hover时显示） */}
                                    <div className="absolute right-4 top-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex gap-2 z-10">
                                        <Button size="sm" variant="secondary" className="h-7 px-2.5 text-xs" onClick={() => props.useStoryboardForGeneration(storyboard, "image")}>
                                            🎨 图片
                                        </Button>
                                        <Button size="sm" variant="secondary" className="h-7 px-2.5 text-xs" onClick={() => props.useStoryboardForGeneration(storyboard, "video")}>
                                            🎬 视频
                                        </Button>
                                        <Button size="sm" variant="secondary" className="h-7 px-2.5 text-xs" onClick={() => props.editProjectStoryboard(storyboard)}>
                                            ✏️ 编辑
                                        </Button>
                                        <Button size="sm" variant="destructive" className="h-7 px-2.5 text-xs" onClick={() => void props.deleteProjectStoryboardItem(storyboard)}>
                                            🗑️ 删除
                                        </Button>
                                    </div>
                                </div>
                                <div className="mt-3 rounded-lg border border-white/10 bg-[#2b2b2b] p-2">
                                    <div className="mb-2 text-xs font-medium text-white">审核意见</div>
                                    <div className="space-y-1">
                                        {props.projectReviews.filter((review) => review.target_type === "storyboard" && review.target_id === storyboard.id).map((review) => (
                                            <div key={review.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-[#202020] px-2 py-1 text-xs text-[#d8d8d8]">
                                                <span className={review.status === "open" ? "text-yellow-200" : review.status === "resolved" ? "text-emerald-200" : "text-red-200"}>{review.status === "open" ? "待处理" : review.status === "resolved" ? "已解决" : "已驳回"}</span>
                                                <span className="min-w-0 flex-1 truncate">{review.comment}</span>
                                                <button className="text-emerald-200 hover:text-white" onClick={() => void props.updateProjectReviewItem(review, { status: "resolved" })}>通过</button>
                                                <button className="text-red-200 hover:text-white" onClick={() => void props.deleteProjectReviewItem(review)}>删除</button>
                                            </div>
                                        ))}
                                        {props.projectReviews.filter((review) => review.target_type === "storyboard" && review.target_id === storyboard.id).length === 0 && (
                                            <div className="text-xs text-[#777]">暂无审核意见</div>
                                        )}
                                    </div>
                                    <div className="mt-2 flex gap-2">
                                        <input
                                            className="h-8 min-w-0 flex-1 rounded-md border border-white/10 bg-[#202020] px-2 text-xs text-white outline-none focus:border-emerald-500"
                                            value={props.reviewDrafts[storyboard.id] ?? ""}
                                            placeholder="输入返工点、通过意见或剪辑备注"
                                            onChange={(event) => props.setReviewDrafts((drafts) => ({ ...drafts, [storyboard.id]: event.target.value }))}
                                        />
                                        <Button size="sm" variant="secondary" onClick={() => void props.createStoryboardReview(storyboard)}>添加</Button>
                                    </div>
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    <Button size="sm" variant="secondary" onClick={() => props.editProjectStoryboard(storyboard)}><Pencil className="h-4 w-4" />编辑</Button>
                                    <Button size="sm" variant="secondary" onClick={() => props.useStoryboardForGeneration(storyboard, "image")}>生成底图</Button>
                                    <Button size="sm" variant="secondary" onClick={() => props.useStoryboardForGeneration(storyboard, "video")}>图生视频</Button>
                                    <Button size="sm" variant="secondary" onClick={() => void props.copy(storyboard.prompt || storyboard.description)}>复制提示词</Button>
                                    <Button size="sm" variant="destructive" onClick={() => void props.deleteProjectStoryboardItem(storyboard)}><Trash2 className="h-4 w-4" /></Button>
                                </div>
                            </div>
                        ))
                        )}
                    </div>
                </div>
            )}

            {props.projectWorkbenchTab === "clips" && (
                <div className="space-y-3">
                    <div className="rounded-lg border border-white/10 bg-[#202020] p-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <div className="text-sm font-semibold">剪辑清单</div>
                                <div className="text-xs text-[#b4b4b4]">从已出视频的分镜同步片段，再维护入点、出点、顺序和剪辑备注。</div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Button size="sm" variant="secondary" onClick={() => void props.syncProjectClips()}><RefreshCw className="h-4 w-4" />同步分镜视频</Button>
                                <Button size="sm" variant="secondary" onClick={() => props.downloadProjectExport("edit-list.csv")}><Download className="h-4 w-4" />导出剪辑清单</Button>
                            </div>
                        </div>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-[#202020] p-3">
                        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <div className="text-sm font-semibold">{props.editingClipId ? "编辑剪辑条目" : "新增剪辑条目"}</div>
                                <div className="text-xs text-[#b4b4b4]">用表单维护片段名、视频地址、入点、出点和剪辑备注。</div>
                            </div>
                            {props.editingClipId && <Button size="sm" variant="secondary" onClick={props.resetProjectClipForm}>取消编辑</Button>}
                        </div>
                        <div className="grid grid-cols-6 gap-2 max-lg:grid-cols-2 max-md:grid-cols-1">
                            <input className="h-9 rounded-lg border border-white/10 bg-[#2f2f2f] px-3 text-xs text-white outline-none focus:border-emerald-500" type="number" min={1} value={props.clipDraft.episode ?? 1} placeholder="集数" onChange={(event) => props.setClipDraft((draft) => ({ ...draft, episode: Number(event.target.value) }))} />
                            <input className="h-9 rounded-lg border border-white/10 bg-[#2f2f2f] px-3 text-xs text-white outline-none focus:border-emerald-500" value={props.clipDraft.scene ?? ""} placeholder="场次" onChange={(event) => props.setClipDraft((draft) => ({ ...draft, scene: event.target.value }))} />
                            <input className="h-9 rounded-lg border border-white/10 bg-[#2f2f2f] px-3 text-xs text-white outline-none focus:border-emerald-500" value={props.clipDraft.shot ?? ""} placeholder="镜号" onChange={(event) => props.setClipDraft((draft) => ({ ...draft, shot: event.target.value }))} />
                            <select className="h-9 rounded-lg border border-white/10 bg-[#2f2f2f] px-3 text-xs text-white outline-none focus:border-emerald-500" value={props.clipDraft.status ?? "todo"} onChange={(event) => props.setClipDraft((draft) => ({ ...draft, status: event.target.value as ProjectClipStatus }))}>
                                {props.clipStatuses.map((status) => <option key={status.key} value={status.key}>{status.label}</option>)}
                            </select>
                            <input className="h-9 rounded-lg border border-white/10 bg-[#2f2f2f] px-3 text-xs text-white outline-none focus:border-emerald-500" value={props.clipDraft.title ?? ""} placeholder="片段名" onChange={(event) => props.setClipDraft((draft) => ({ ...draft, title: event.target.value }))} />
                            <input className="h-9 rounded-lg border border-white/10 bg-[#2f2f2f] px-3 text-xs text-white outline-none focus:border-emerald-500" type="number" min={1} value={props.clipDraft.duration ?? 5} placeholder="时长" onChange={(event) => props.setClipDraft((draft) => ({ ...draft, duration: Number(event.target.value) }))} />
                        </div>
                        <div className="mt-2 grid grid-cols-4 gap-2 max-lg:grid-cols-2 max-md:grid-cols-1">
                            <input className="h-9 rounded-lg border border-white/10 bg-[#2f2f2f] px-3 text-xs text-white outline-none focus:border-emerald-500" value={props.clipDraft.source_video_url ?? ""} placeholder="视频文件地址" onChange={(event) => props.setClipDraft((draft) => ({ ...draft, source_video_url: event.target.value }))} />
                            <input className="h-9 rounded-lg border border-white/10 bg-[#2f2f2f] px-3 text-xs text-white outline-none focus:border-emerald-500" value={props.clipDraft.in_point ?? ""} placeholder="入点 00:00:00" onChange={(event) => props.setClipDraft((draft) => ({ ...draft, in_point: event.target.value }))} />
                            <input className="h-9 rounded-lg border border-white/10 bg-[#2f2f2f] px-3 text-xs text-white outline-none focus:border-emerald-500" value={props.clipDraft.out_point ?? ""} placeholder="出点 00:00:05" onChange={(event) => props.setClipDraft((draft) => ({ ...draft, out_point: event.target.value }))} />
                            <input className="h-9 rounded-lg border border-white/10 bg-[#2f2f2f] px-3 text-xs text-white outline-none focus:border-emerald-500" type="number" min={0} value={props.clipDraft.order_index ?? 0} placeholder="顺序" onChange={(event) => props.setClipDraft((draft) => ({ ...draft, order_index: Number(event.target.value) }))} />
                        </div>
                        <textarea className="mt-2 min-h-14 w-full resize-none rounded-lg border border-white/10 bg-[#2f2f2f] px-3 py-2 text-xs text-white outline-none focus:border-emerald-500" value={props.clipDraft.notes ?? ""} placeholder="剪辑备注、音效、字幕、转场要求" onChange={(event) => props.setClipDraft((draft) => ({ ...draft, notes: event.target.value }))} />
                        <div className="mt-3 flex justify-end">
                            <Button size="sm" onClick={() => void props.submitProjectClipForm()}>
                                {props.editingClipId ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                                {props.editingClipId ? "保存剪辑条目" : "添加剪辑条目"}
                            </Button>
                        </div>
                    </div>
                    <div className="space-y-2">
                        {props.filteredProjectClips.length === 0 ? (
                            props.projectClips.length === 0 ? (
                                <EmptyClips onSyncClips={() => void props.syncProjectClips()} />
                            ) : (
                                <div className="px-5 py-10 text-center">
                                    <div className="text-base font-semibold text-white">没有匹配的剪辑条目</div>
                                    <div className="mt-2 text-sm text-[#bdbdbd]">调整搜索或状态筛选后再试。</div>
                                </div>
                            )
                        ) : (
                            props.pagedProjectClips.map((clip, index) => (
                            <div key={clip.id} className="rounded-lg border border-white/10 bg-[#202020] p-3">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2 text-xs text-[#b4b4b4]">
                                            <span className="rounded-md bg-white/10 px-2 py-1">#{(Math.max(props.currentWorkbenchPageNumber, 1) - 1) * props.workbenchPageSize + index + 1}</span>
                                            <span className="rounded-md bg-white/10 px-2 py-1">第{clip.episode}集</span>
                                            <span className="rounded-md bg-white/10 px-2 py-1">{clip.scene}-{clip.shot}</span>
                                            <span className="rounded-md bg-white/10 px-2 py-1">{props.clipStatusText(clip.status)}</span>
                                        </div>
                                        <div className="mt-2 font-medium text-white">{clip.title}</div>
                                        <div className="mt-1 text-xs text-[#d0d0d0]">{clip.source_video_url || "未绑定视频文件"}</div>
                                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-[#d8d8d8]">
                                            {clip.in_point && <span className="rounded-md bg-white/10 px-2 py-1">入点：{clip.in_point}</span>}
                                            {clip.out_point && <span className="rounded-md bg-white/10 px-2 py-1">出点：{clip.out_point}</span>}
                                            <span className="rounded-md bg-white/10 px-2 py-1">时长：{clip.duration}s</span>
                                            <span className="rounded-md bg-white/10 px-2 py-1">顺序：{clip.order_index}</span>
                                        </div>
                                        {clip.notes && <div className="mt-2 whitespace-pre-wrap text-xs text-[#d8d8d8]">{clip.notes}</div>}
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {clip.source_video_url && <Button size="sm" variant="secondary" onClick={() => window.open(clip.source_video_url, "_blank", "noopener,noreferrer")}><ExternalLink className="h-4 w-4" />打开视频</Button>}
                                        <Button size="sm" variant="secondary" onClick={() => props.editProjectClipItem(clip)}><Pencil className="h-4 w-4" />编辑</Button>
                                        <Button size="sm" variant="destructive" onClick={() => void props.deleteProjectClipItem(clip)}><Trash2 className="h-4 w-4" /></Button>
                                    </div>
                                </div>
                            </div>
                        ))
                        )}
                    </div>
                </div>
            )}

            {props.projectWorkbenchTab === "reviews" && (
                <div className="space-y-4">
                    <div className="rounded-2xl border border-white/10 bg-[#202020]">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
                            <div>
                                <div className="text-base font-semibold text-white">审核中心</div>
                                <div className="mt-1 text-sm text-[#bdbdbd]">集中处理分镜、剪辑、资产相关审核意见。</div>
                            </div>
                            <div className="rounded-full border border-yellow-500/20 bg-yellow-500/10 px-3 py-1 text-sm font-medium text-yellow-100">
                                待处理 {props.filteredProjectReviews.filter((review) => review.status === "open").length} / 当前 {props.filteredProjectReviews.length}
                            </div>
                        </div>
                        {props.filteredProjectReviews.length === 0 ? (
                            <div className="px-5 py-10 text-center">
                                <div className="text-base font-semibold text-white">{props.projectReviews.length === 0 ? "暂无审核意见" : "没有匹配的审核意见"}</div>
                                <div className="mt-2 text-sm text-[#bdbdbd]">{props.projectReviews.length === 0 ? "可以在分镜卡片里添加返工点或通过意见。" : "调整搜索或状态筛选后再试。"}</div>
                            </div>
                        ) : (
                            <ProjectManagementTable columns={["状态", "对象", "意见", "审核人", "时间", "操作"]}>
                                {props.pagedProjectReviews.map((review) => (
                                    <tr key={review.id} className="align-top transition-colors hover:bg-white/[0.03]">
                                        <td className="px-4 py-4">
                                            <span className={review.status === "open" ? "inline-flex rounded-full border border-yellow-500/20 bg-yellow-500/10 px-2.5 py-1 text-xs font-medium text-yellow-100" : review.status === "resolved" ? "inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-100" : "inline-flex rounded-full border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-100"}>
                                                {review.status === "open" ? "待处理" : review.status === "resolved" ? "已解决" : "已驳回"}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="max-w-[220px] truncate font-semibold text-white">{props.reviewTargetLabel(review)}</div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="line-clamp-3 max-w-[420px] whitespace-pre-wrap text-[#cfcfcf]">{review.comment}</div>
                                        </td>
                                        <td className="px-4 py-4 text-[#cfcfcf]">{review.reviewer || "审核人"}</td>
                                        <td className="px-4 py-4 text-[#bdbdbd]">{review.created_at?.slice(0, 10) || "-"}</td>
                                        <td className="px-4 py-4">
                                            <div className="flex flex-wrap gap-2">
                                                <Button size="sm" variant="secondary" onClick={() => void props.updateProjectReviewItem(review, { status: "resolved" })}>通过</Button>
                                                <Button size="sm" variant="secondary" onClick={() => void props.updateProjectReviewItem(review, { status: "rejected" })}>驳回</Button>
                                                <Button size="sm" variant="destructive" onClick={() => void props.deleteProjectReviewItem(review)}><Trash2 className="h-4 w-4" /></Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </ProjectManagementTable>
                        )}
                    </div>
                </div>
            )}

            {props.projectWorkbenchTab === "tasks" && (
                <div className="space-y-4">
                    <div className="rounded-2xl border border-white/10 bg-[#202020] p-5">
                        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <div className="text-base font-semibold text-white">{props.editingTaskId ? "编辑制作任务" : "新增制作任务"}</div>
                                <div className="mt-1 text-sm text-[#bdbdbd]">维护任务标题、状态、负责人、截止日期和备注；下方看板按状态展示。</div>
                            </div>
                            {props.editingTaskId && <Button size="sm" variant="secondary" onClick={props.resetProjectTaskForm}>取消编辑</Button>}
                        </div>
                        <div className="grid grid-cols-4 gap-3 max-lg:grid-cols-2 max-md:grid-cols-1">
                            <label className="space-y-1.5 lg:col-span-2">
                                <span className="block text-sm font-medium text-[#d8d8d8]">任务名称</span>
                                <input
                                    className="h-11 w-full rounded-xl border border-white/10 bg-[#2f2f2f] px-3 text-sm text-white outline-none transition-colors focus:border-emerald-500"
                                    value={props.taskDraft.title ?? ""}
                                    placeholder="任务名称"
                                    onChange={(event) => props.setTaskDraft((draft) => ({ ...draft, title: event.target.value }))}
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter") {
                                            event.preventDefault();
                                            void props.submitProjectTaskForm();
                                        }
                                    }}
                                />
                            </label>
                            <label className="space-y-1.5">
                                <span className="block text-sm font-medium text-[#d8d8d8]">状态</span>
                                <select
                                    className="h-11 w-full rounded-xl border border-white/10 bg-[#2f2f2f] px-3 text-sm text-white outline-none transition-colors focus:border-emerald-500"
                                    value={props.taskDraft.status ?? "todo"}
                                    onChange={(event) => props.setTaskDraft((draft) => ({ ...draft, status: event.target.value as ProjectTaskStatus }))}
                                >
                                    {props.projectTaskColumns.map((column) => <option key={column.key} value={column.key}>{column.label}</option>)}
                                </select>
                            </label>
                            <label className="space-y-1.5">
                                <span className="block text-sm font-medium text-[#d8d8d8]">负责人</span>
                                <select
                                    className="h-11 w-full rounded-xl border border-white/10 bg-[#2f2f2f] px-3 text-sm text-white outline-none transition-colors focus:border-emerald-500"
                                    value={props.taskDraft.owner ?? ""}
                                    onChange={(event) => props.setTaskDraft((draft) => ({ ...draft, owner: event.target.value }))}
                                >
                                    <option value="">未分配</option>
                                    {props.projectMembers.map((member) => <option key={member.id} value={member.name}>{member.name} · {member.role}</option>)}
                                </select>
                            </label>
                            <label className="space-y-1.5">
                                <span className="block text-sm font-medium text-[#d8d8d8]">截止日期</span>
                                <input
                                    className="h-11 w-full rounded-xl border border-white/10 bg-[#2f2f2f] px-3 text-sm text-white outline-none transition-colors focus:border-emerald-500"
                                    type="date"
                                    value={props.taskDraft.due_date ?? ""}
                                    onChange={(event) => props.setTaskDraft((draft) => ({ ...draft, due_date: event.target.value }))}
                                />
                            </label>
                        </div>
                        <label className="mt-3 block space-y-1.5">
                            <span className="block text-sm font-medium text-[#d8d8d8]">任务备注</span>
                            <textarea
                                className="min-h-20 w-full resize-y rounded-xl border border-white/10 bg-[#2f2f2f] px-3 py-3 text-sm leading-6 text-white outline-none transition-colors focus:border-emerald-500"
                                value={props.taskDraft.notes ?? ""}
                                placeholder="任务备注、验收标准、依赖事项"
                                onChange={(event) => props.setTaskDraft((draft) => ({ ...draft, notes: event.target.value }))}
                            />
                        </label>
                        <div className="mt-5 flex justify-end">
                            <Button size="sm" onClick={() => void props.submitProjectTaskForm()}>
                                {props.editingTaskId ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                                {props.editingTaskId ? "保存任务" : "新增任务"}
                            </Button>
                        </div>
                    </div>
                    <div className="grid grid-cols-7 gap-2 overflow-x-auto pb-1 max-lg:grid-cols-[repeat(7,minmax(150px,1fr))]">
                        {props.projectTaskColumns.map((column) => {
                            const columnTasks = props.pagedProjectTasks.filter((task) => task.status === column.key);
                            return (
                                <div key={column.key} className="min-h-28 rounded-lg border border-white/10 bg-[#202020] p-2">
                                    <div className="mb-2 flex items-center justify-between text-xs text-[#b4b4b4]">
                                        <span>{column.label}</span>
                                        <span>{columnTasks.length}</span>
                                    </div>
                                    <div className="space-y-2">
                                        {columnTasks.map((task) => (
                                            <div key={task.id} className="space-y-2 rounded-md border border-white/10 bg-[#2f2f2f] p-2 text-xs">
                                                <div className="font-medium text-white">{task.title}</div>
                                                {(task.owner || task.due_date) && (
                                                    <div className="truncate text-[#b4b4b4]">{[task.owner, task.due_date].filter(Boolean).join(" · ")}</div>
                                                )}
                                                {task.notes && <div className="line-clamp-2 text-[#b4b4b4]">{task.notes}</div>}
                                                <div className="flex gap-1">
                                                    <button className="inline-flex h-7 flex-1 items-center justify-center gap-1 rounded-md bg-white/10 px-2 text-[#eeeeee] hover:bg-white/15" onClick={() => props.editProjectTaskItem(task)}>
                                                        <Pencil className="h-3.5 w-3.5" />编辑
                                                    </button>
                                                    <button className="grid h-7 w-7 place-items-center rounded-md text-red-300 hover:bg-red-500/10" onClick={() => void props.deleteProjectTaskItem(task)} aria-label="删除任务">
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {props.projectWorkbenchTab === "assets" && (
                <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <div className="text-sm font-semibold">资产库</div>
                            <div className="text-xs text-[#b4b4b4]">素材统一管理，点击复用可直接带入生成输入区。</div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <input
                                className="h-8 w-40 rounded-lg border border-white/10 bg-[#202020] px-3 text-xs text-white outline-none focus:border-emerald-500"
                                value={props.assetSearch}
                                placeholder="搜索资产"
                                onChange={(event) => props.setAssetSearch(event.target.value)}
                            />
                            <input
                                className="h-8 w-32 rounded-lg border border-white/10 bg-[#202020] px-3 text-xs text-white outline-none focus:border-emerald-500"
                                value={props.assetTagFilter}
                                placeholder="标签筛选"
                                onChange={(event) => props.setAssetTagFilter(event.target.value)}
                            />
                            <Button size="sm" variant={props.assetFavoriteOnly ? "default" : "secondary"} onClick={() => props.setAssetFavoriteOnly((value) => !value)}>
                                <Star className={`h-4 w-4 ${props.assetFavoriteOnly ? "fill-current" : ""}`} />收藏
                            </Button>
                        </div>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-1 flex-wrap">
                        <button
                            className={`shrink-0 rounded-lg border px-4 py-2.5 text-xs ${props.assetKindFilter === "all" ? "border-emerald-500 bg-emerald-500/10 text-emerald-100" : "border-white/10 bg-[#202020] text-[#b4b4b4] hover:bg-white/10 hover:border-white/20"}`}
                            onClick={() => props.setAssetKindFilter("all")}
                        >
                            全部 {props.projectAssets.length}
                        </button>
                        {props.projectAssetKinds.map((item) => (
                            <button
                                key={item.key}
                                className={`shrink-0 rounded-lg border px-4 py-2.5 text-xs ${props.assetKindFilter === item.key ? "border-emerald-500 bg-emerald-500/10 text-emerald-100" : "border-white/10 bg-[#202020] text-[#b4b4b4] hover:bg-white/10 hover:border-white/20"}`}
                                onClick={() => {
                                    props.setAssetKindFilter(item.key);
                                    props.setAssetComposerKind(item.key);
                                }}
                            >
                                {item.label} {props.assetKindCounts[item.key] ?? 0}
                            </button>
                        ))}
                    </div>
                    <div className="rounded-lg border border-white/10 bg-[#202020] p-3">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                            <div>
                                <div className="text-sm font-medium">{props.editingAssetId ? "编辑资产" : "新增资产"}</div>
                                <div className="mt-1 text-xs text-[#b4b4b4]">用表单维护资产名称、标签、媒体地址、提示词和特征信息。</div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {props.editingAssetId && <Button size="sm" variant="secondary" onClick={() => props.resetProjectAssetForm(props.assetComposerKind)}>取消编辑</Button>}
                                <select
                                    className="h-8 rounded-lg border border-white/10 bg-[#2f2f2f] px-2 text-xs text-white outline-none"
                                    value={props.assetComposerKind}
                                    disabled={Boolean(props.editingAssetId)}
                                    onChange={(event) => props.setAssetComposerKind(event.target.value as ProjectAssetKind)}
                                >
                                    {props.projectAssetKinds.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 max-md:grid-cols-1">
                            <input
                                className="h-9 rounded-lg border border-white/10 bg-[#2f2f2f] px-3 text-sm text-white outline-none focus:border-emerald-500"
                                value={props.currentAssetDraft.name}
                                placeholder={props.projectAssetKinds.find((item) => item.key === props.assetComposerKind)?.placeholder}
                                onChange={(event) => props.setAssetDrafts((items) => ({ ...items, [props.assetComposerKind]: { ...items[props.assetComposerKind], name: event.target.value } }))}
                            />
                            <input
                                className="h-9 rounded-lg border border-white/10 bg-[#2f2f2f] px-3 text-xs text-white outline-none focus:border-emerald-500"
                                value={props.currentAssetDraft.tags}
                                placeholder="标签，逗号分隔"
                                onChange={(event) => props.setAssetDrafts((items) => ({ ...items, [props.assetComposerKind]: { ...items[props.assetComposerKind], tags: event.target.value } }))}
                            />
                            <input
                                className="h-9 rounded-lg border border-white/10 bg-[#2f2f2f] px-3 text-xs text-white outline-none focus:border-emerald-500"
                                value={props.currentAssetDraft.image_url}
                                placeholder="图片 / 参考图 URL"
                                onChange={(event) => props.setAssetDrafts((items) => ({ ...items, [props.assetComposerKind]: { ...items[props.assetComposerKind], image_url: event.target.value } }))}
                            />
                            <input
                                className="h-9 rounded-lg border border-white/10 bg-[#2f2f2f] px-3 text-xs text-white outline-none focus:border-emerald-500"
                                value={props.currentAssetDraft.video_url}
                                placeholder="视频 URL"
                                onChange={(event) => props.setAssetDrafts((items) => ({ ...items, [props.assetComposerKind]: { ...items[props.assetComposerKind], video_url: event.target.value } }))}
                            />
                            <input
                                className="h-9 rounded-lg border border-white/10 bg-[#2f2f2f] px-3 text-xs text-white outline-none focus:border-emerald-500"
                                value={props.currentAssetDraft.folder}
                                placeholder="文件夹，例如 角色/主角"
                                onChange={(event) => props.setAssetDrafts((items) => ({ ...items, [props.assetComposerKind]: { ...items[props.assetComposerKind], folder: event.target.value } }))}
                            />
                            <div className="grid grid-cols-2 gap-2">
                                <input
                                    className="h-9 rounded-lg border border-white/10 bg-[#2f2f2f] px-3 text-xs text-white outline-none focus:border-emerald-500"
                                    value={props.currentAssetDraft.resolution}
                                    placeholder="分辨率"
                                    onChange={(event) => props.setAssetDrafts((items) => ({ ...items, [props.assetComposerKind]: { ...items[props.assetComposerKind], resolution: event.target.value } }))}
                                />
                                <input
                                    className="h-9 rounded-lg border border-white/10 bg-[#2f2f2f] px-3 text-xs text-white outline-none focus:border-emerald-500"
                                    value={props.currentAssetDraft.duration}
                                    placeholder="时长"
                                    onChange={(event) => props.setAssetDrafts((items) => ({ ...items, [props.assetComposerKind]: { ...items[props.assetComposerKind], duration: event.target.value } }))}
                                />
                            </div>
                        </div>
                        <textarea
                            className="mt-2 min-h-20 w-full resize-none rounded-lg border border-white/10 bg-[#2f2f2f] px-3 py-2 text-xs text-white outline-none focus:border-emerald-500"
                            value={props.currentAssetDraft.prompt}
                            placeholder="设定词 / 生成提示词 / 角色描述 / 风格模板"
                            onChange={(event) => props.setAssetDrafts((items) => ({ ...items, [props.assetComposerKind]: { ...items[props.assetComposerKind], prompt: event.target.value } }))}
                        />
                        <div className="mt-2 grid grid-cols-2 gap-2 max-md:grid-cols-1">
                            <input
                                className="h-9 rounded-lg border border-white/10 bg-[#2f2f2f] px-3 text-xs text-white outline-none focus:border-emerald-500"
                                value={props.currentAssetDraft.role_traits}
                                placeholder="角色特征：发型/服装/脸型"
                                onChange={(event) => props.setAssetDrafts((items) => ({ ...items, [props.assetComposerKind]: { ...items[props.assetComposerKind], role_traits: event.target.value } }))}
                            />
                            <input
                                className="h-9 rounded-lg border border-white/10 bg-[#2f2f2f] px-3 text-xs text-white outline-none focus:border-emerald-500"
                                value={props.currentAssetDraft.style_keywords}
                                placeholder="风格关键词：色调/光影/镜头"
                                onChange={(event) => props.setAssetDrafts((items) => ({ ...items, [props.assetComposerKind]: { ...items[props.assetComposerKind], style_keywords: event.target.value } }))}
                            />
                        </div>
                        <div className="mt-3 flex justify-end">
                            <Button size="sm" onClick={() => void props.submitProjectAssetForm()}>
                                {props.editingAssetId ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                                {props.editingAssetId ? "保存资产" : "加入资产库"}
                            </Button>
                        </div>
                    </div>
                    <ProjectWorkbenchPager
                        total={props.filteredProjectAssets.length}
                        page={props.currentWorkbenchPageNumber}
                        pageSize={props.workbenchPageSize}
                        label="资产列表"
                        onPageChange={props.setCurrentWorkbenchPage}
                    />
                    {props.filteredProjectAssets.length === 0 ? (
                        props.projectAssets.length === 0 ? (
                            <div className="px-5 py-10 text-center">
                                <div className="text-base font-semibold text-white">暂无资产</div>
                                <div className="mt-2 text-sm text-[#bdbdbd]">资产库用于管理角色卡、场景卡、风格模板等素材，可在分镜中快速复用。</div>
                            </div>
                        ) : (
                            <div className="agnes-empty-state rounded-xl p-6 text-center text-sm">暂无匹配资产。可以清空搜索条件，或在上方快速加入资产。</div>
                        )
                    ) : (
                        <ProjectManagementTable columns={["预览", "名称", "类型", "标签/文件夹", "媒体信息", "操作"]}>
                            {props.pagedProjectAssets.map((asset) => (
                                <tr key={asset.id} className="group align-top hover:bg-white/[0.03] transition-all duration-200">
                                    <td className="w-40 px-4 py-4">
                                        {asset.image_url ? (
                                            <button className="block h-24 w-40 overflow-hidden rounded-lg bg-black/30 transition-all duration-200 hover:scale-[1.02] hover:ring-2 hover:ring-emerald-500/50" onClick={() => window.open(asset.image_url, "_blank", "noopener,noreferrer")}>
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img className="h-full w-full object-cover" src={asset.image_url} alt={asset.name} />
                                            </button>
                                        ) : asset.video_url ? (
                                            <button className="block h-24 w-40 overflow-hidden rounded-lg bg-black/30 transition-all duration-200 hover:scale-[1.02]" onClick={() => window.open(asset.video_url, "_blank", "noopener,noreferrer")}>
                                                <video className="h-full w-full object-cover" src={asset.video_url} preload="metadata" />
                                            </button>
                                        ) : (
                                            <div className="grid h-24 w-40 place-items-center rounded-lg border border-dashed border-white/15 bg-[#2a2a2a] text-[#888]">无预览</div>
                                        )}
                                    </td>
                                    <td className="max-w-72 px-3 py-3">
                                        <div className="font-semibold text-white">{asset.name || "未命名资产"}</div>
                                        {asset.prompt && <div className="mt-1 line-clamp-2 whitespace-pre-wrap text-[#d6d6d6]">{asset.prompt}</div>}
                                    </td>
                                    <td className="px-3 py-3 text-[#eeeeee]">
                                        {props.projectAssetKinds.find((item) => item.key === asset.kind)?.label ?? asset.kind}
                                        {asset.is_favorite && <span className="ml-2 rounded-md bg-yellow-500/10 px-1.5 py-0.5 text-yellow-200">收藏</span>}
                                    </td>
                                    <td className="max-w-64 px-3 py-3 text-[#d6d6d6]">
                                        <div className="truncate">{asset.folder || "未分组"}</div>
                                        {asset.tags?.length > 0 && <div className="mt-1 line-clamp-2">{asset.tags.join(" / ")}</div>}
                                    </td>
                                    <td className="px-3 py-3 text-[#d6d6d6]">
                                        <div>{[asset.resolution, asset.duration].filter(Boolean).join(" · ") || "未记录"}</div>
                                        {asset.role_traits?.length > 0 && <div className="mt-1 line-clamp-1">角色：{asset.role_traits.join(" / ")}</div>}
                                        {asset.style_keywords?.length > 0 && <div className="mt-1 line-clamp-1">风格：{asset.style_keywords.join(" / ")}</div>}
                                    </td>
                                    <td className="w-56 px-3 py-3">
                                        <div className="flex flex-wrap gap-1">
                                            <Button size="sm" variant="secondary" onClick={() => void props.reuseProjectAsset(asset)}>复用</Button>
                                            <Button size="sm" variant="secondary" onClick={() => props.editProjectAssetItem(asset)}><Pencil className="h-4 w-4" />编辑</Button>
                                            {asset.prompt && <Button size="sm" variant="secondary" onClick={() => void props.copy(asset.prompt)}>复制</Button>}
                                            {props.projectAssetReferenceUrls(asset).length > 0 && <Button size="sm" variant="secondary" onClick={() => void props.reuseProjectAsset(asset, "video")}>视频</Button>}
                                            {asset.image_url && <Button size="sm" variant="secondary" onClick={() => props.continueEditImage(asset.image_url)}>参考图</Button>}
                                            <button className={`grid h-8 w-8 place-items-center rounded-md bg-white/10 hover:bg-white/15 ${asset.is_favorite ? "text-yellow-300" : "text-[#d8d8d8]"}`} onClick={() => void props.toggleProjectAssetFavorite(asset)} aria-label="收藏资产">
                                                <Star className={`h-3.5 w-3.5 ${asset.is_favorite ? "fill-current" : ""}`} />
                                            </button>
                                            <button className="grid h-8 w-8 place-items-center rounded-md bg-red-500/10 text-red-200 hover:bg-red-500/20" onClick={() => void props.deleteProjectAssetItem(asset)} aria-label="删除资产">
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </ProjectManagementTable>
                    )}
                </div>
            )}

            {props.projectWorkbenchTab === "exports" && (
                <div className="space-y-3">
                    <div className="rounded-lg border border-white/10 bg-[#202020] p-3">
                        <div className="text-sm font-semibold">交付中心</div>
                        <div className="mt-1 text-xs text-[#b4b4b4]">集中导出剧本文档、分镜表、剪辑清单和项目素材清单。</div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-sm max-lg:grid-cols-2 max-md:grid-cols-1">
                        {[
                            ["剧本", props.projectScripts.length],
                            ["分镜", props.projectStoryboards.length],
                            ["剪辑", props.projectClips.length],
                            ["资产", props.projectAssets.length],
                        ].map(([label, value]) => (
                            <div key={label} className="rounded-lg border border-white/10 bg-[#202020] px-3 py-2">
                                <div className="text-xs text-[#b4b4b4]">{label}</div>
                                <div className="mt-1 text-lg font-semibold">{value}</div>
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
                        <button className="rounded-lg border border-white/10 bg-[#202020] p-4 text-left hover:bg-white/5" onClick={() => props.downloadProjectExport("scripts.txt")}>
                            <div className="flex items-center gap-2 text-sm font-semibold"><Download className="h-4 w-4" />剧本文档 TXT</div>
                            <div className="mt-1 text-xs text-[#b4b4b4]">按集数合并导出已保存剧本。</div>
                        </button>
                        <button className="rounded-lg border border-white/10 bg-[#202020] p-4 text-left hover:bg-white/5" onClick={props.downloadStoryboardCsv}>
                            <div className="flex items-center gap-2 text-sm font-semibold"><Download className="h-4 w-4" />分镜表 CSV</div>
                            <div className="mt-1 text-xs text-[#b4b4b4]">包含场次、镜号、提示词、底图和视频地址。</div>
                        </button>
                        <button className="rounded-lg border border-white/10 bg-[#202020] p-4 text-left hover:bg-white/5" onClick={() => props.downloadProjectExport("edit-list.csv")}>
                            <div className="flex items-center gap-2 text-sm font-semibold"><Download className="h-4 w-4" />剪辑清单 CSV</div>
                            <div className="mt-1 text-xs text-[#b4b4b4]">优先导出剪辑页维护的入点、出点和片段顺序。</div>
                        </button>
                        <button className="rounded-lg border border-white/10 bg-[#202020] p-4 text-left hover:bg-white/5" onClick={() => props.downloadProjectExport("manifest.json")}>
                            <div className="flex items-center gap-2 text-sm font-semibold"><Download className="h-4 w-4" />项目清单 JSON</div>
                            <div className="mt-1 text-xs text-[#b4b4b4]">包含项目、团队、剧本、分镜、剪辑、审核和资产索引。</div>
                        </button>
                    </div>
                    <div className="flex flex-wrap gap-2 rounded-lg border border-white/10 bg-[#202020] p-3">
                        <Button size="sm" variant="secondary" onClick={() => void props.generateProjectPackageIndex()}><Download className="h-4 w-4" />生成交付包索引</Button>
                        <Button size="sm" variant="secondary" onClick={() => void props.openProjectFolder(props.selectedProject!)}><FolderOpen className="h-4 w-4" />打开项目素材目录</Button>
                        <Button size="sm" variant="secondary" onClick={() => void props.refreshProjectWorkbench()}><RefreshCw className="h-4 w-4" />刷新交付数据</Button>
                    </div>
                </div>
            )}
        </>
    );
}