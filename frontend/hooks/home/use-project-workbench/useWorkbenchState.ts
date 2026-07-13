"use client";

/**
 * 工作台状态容器
 *
 * 集中管理 useProjectWorkbench 全部 useState 状态、表单草稿、UI 状态与通用过滤器。
 * 子 hook（按领域拆分的 useWorkbenchItems / useWorkbenchScripts / ...）通过
 * `state` 与 `setters` 访问 / 修改这些状态，main hook 在 index.ts 中组合。
 */

import { useState, useRef } from "react";
import type {
  AssetDraft,
  Project,
  ProjectAsset,
  ProjectAssetKind,
  ProjectClip,
  ProjectClipStatus,
  ProjectEpisode,
  ProjectIssue,
  ProjectIssueSeverity,
  ProjectIssueStatus,
  ProjectMember,
  ProjectMilestone,
  ProjectMilestoneStatus,
  ProjectReview,
  ProjectScript,
  ProjectStoryboard,
  ProjectStoryboardStatus,
  ProjectSummary,
  ProjectTask,
  ProjectTaskStatus,
  WorkbenchTab,
  ImageTask,
  StoryboardDraft,
  ScriptFormDraft,
} from "@/lib/app-types";
import { emptyAssetDraft } from "@/lib/project-workflow";

/** 工作台状态与 setter 集合，供子 hook 注入 */
export interface WorkbenchState {
  // ===== 核心数据 =====
  projectSummary: ProjectSummary | null;
  setProjectSummary: (v: ProjectSummary | null | ((prev: ProjectSummary | null) => ProjectSummary | null)) => void;

  projectEpisodes: ProjectEpisode[];
  setProjectEpisodes: (v: ProjectEpisode[] | ((prev: ProjectEpisode[]) => ProjectEpisode[])) => void;

  projectIssues: ProjectIssue[];
  setProjectIssues: (v: ProjectIssue[] | ((prev: ProjectIssue[]) => ProjectIssue[])) => void;

  projectMilestones: ProjectMilestone[];
  setProjectMilestones: (v: ProjectMilestone[] | ((prev: ProjectMilestone[]) => ProjectMilestone[])) => void;

  projectScripts: ProjectScript[];
  setProjectScripts: (v: ProjectScript[] | ((prev: ProjectScript[]) => ProjectScript[])) => void;

  projectMembers: ProjectMember[];
  setProjectMembers: (v: ProjectMember[] | ((prev: ProjectMember[]) => ProjectMember[])) => void;

  projectReviews: ProjectReview[];
  setProjectReviews: (v: ProjectReview[] | ((prev: ProjectReview[]) => ProjectReview[])) => void;

  projectClips: ProjectClip[];
  setProjectClips: (v: ProjectClip[] | ((prev: ProjectClip[]) => ProjectClip[])) => void;

  projectTasks: ProjectTask[];
  setProjectTasks: (v: ProjectTask[] | ((prev: ProjectTask[]) => ProjectTask[])) => void;

  projectStoryboards: ProjectStoryboard[];
  setProjectStoryboards: (v: ProjectStoryboard[] | ((prev: ProjectStoryboard[]) => ProjectStoryboard[])) => void;

  projectAssets: ProjectAsset[];
  setProjectAssets: (v: ProjectAsset[] | ((prev: ProjectAsset[]) => ProjectAsset[])) => void;

  projectDraft: Partial<Project>;
  setProjectDraft: (v: Partial<Project> | ((prev: Partial<Project>) => Partial<Project>)) => void;

  // ===== UI 状态 =====
  selectedStoryboardIds: string[];
  setSelectedStoryboardIds: (v: string[] | ((prev: string[]) => string[])) => void;

  projectWorkbenchTab: WorkbenchTab;
  setProjectWorkbenchTab: (v: WorkbenchTab | ((prev: WorkbenchTab) => WorkbenchTab)) => void;

  workbenchSearch: string;
  setWorkbenchSearch: (v: string | ((prev: string) => string)) => void;

  workbenchStatusFilter: string;
  setWorkbenchStatusFilter: (v: string | ((prev: string) => string)) => void;

  workbenchOwnerFilter: string;
  setWorkbenchOwnerFilter: (v: string | ((prev: string) => string)) => void;

  workbenchPageByTab: Partial<Record<WorkbenchTab, number>>;
  setWorkbenchPageByTab: (v: Partial<Record<WorkbenchTab, number>> | ((prev: Partial<Record<WorkbenchTab, number>>) => Partial<Record<WorkbenchTab, number>>)) => void;

  // ===== 表单草稿 =====
  taskDraft: Partial<ProjectTask>;
  setTaskDraft: (v: Partial<ProjectTask> | ((prev: Partial<ProjectTask>) => Partial<ProjectTask>)) => void;
  editingTaskId: string;
  setEditingTaskId: (v: string | ((prev: string) => string)) => void;

  memberDraft: Partial<ProjectMember>;
  setMemberDraft: (v: Partial<ProjectMember> | ((prev: Partial<ProjectMember>) => Partial<ProjectMember>)) => void;
  editingMemberId: string;
  setEditingMemberId: (v: string | ((prev: string) => string)) => void;

  episodeDraft: Partial<ProjectEpisode>;
  setEpisodeDraft: (v: Partial<ProjectEpisode> | ((prev: Partial<ProjectEpisode>) => Partial<ProjectEpisode>)) => void;
  editingEpisodeId: string;
  setEditingEpisodeId: (v: string | ((prev: string) => string)) => void;

  issueDraft: Partial<ProjectIssue>;
  setIssueDraft: (v: Partial<ProjectIssue> | ((prev: Partial<ProjectIssue>) => Partial<ProjectIssue>)) => void;
  editingIssueId: string;
  setEditingIssueId: (v: string | ((prev: string) => string)) => void;

  milestoneDraft: Partial<ProjectMilestone>;
  setMilestoneDraft: (v: Partial<ProjectMilestone> | ((prev: Partial<ProjectMilestone>) => Partial<ProjectMilestone>)) => void;
  editingMilestoneId: string;
  setEditingMilestoneId: (v: string | ((prev: string) => string)) => void;

  clipDraft: Partial<ProjectClip>;
  setClipDraft: (v: Partial<ProjectClip> | ((prev: Partial<ProjectClip>) => Partial<ProjectClip>)) => void;
  editingClipId: string;
  setEditingClipId: (v: string | ((prev: string) => string)) => void;

  scriptForm: ScriptFormDraft;
  setScriptForm: (v: ScriptFormDraft | ((prev: ScriptFormDraft) => ScriptFormDraft)) => void;
  editingScriptId: string;
  setEditingScriptId: (v: string | ((prev: string) => string)) => void;

  reviewDrafts: Record<string, string>;
  setReviewDrafts: (v: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => void;

  storyboardDraft: StoryboardDraft;
  setStoryboardDraft: (v: StoryboardDraft | ((prev: StoryboardDraft) => StoryboardDraft)) => void;
  editingStoryboardId: string;
  setEditingStoryboardId: (v: string | ((prev: string) => string)) => void;

  scriptDraft: string;
  setScriptDraft: (v: string | ((prev: string) => string)) => void;

  assetComposerKind: ProjectAssetKind;
  setAssetComposerKind: (v: ProjectAssetKind | ((prev: ProjectAssetKind) => ProjectAssetKind)) => void;
  editingAssetId: string;
  setEditingAssetId: (v: string | ((prev: string) => string)) => void;

  assetDrafts: Record<ProjectAssetKind, AssetDraft>;
  setAssetDrafts: (v: Record<ProjectAssetKind, AssetDraft> | ((prev: Record<ProjectAssetKind, AssetDraft>) => Record<ProjectAssetKind, AssetDraft>)) => void;

  assetSearch: string;
  setAssetSearch: (v: string | ((prev: string) => string)) => void;
  assetKindFilter: ProjectAssetKind | "all";
  setAssetKindFilter: (v: ProjectAssetKind | "all" | ((prev: ProjectAssetKind | "all") => ProjectAssetKind | "all")) => void;
  assetTagFilter: string;
  setAssetTagFilter: (v: string | ((prev: string) => string)) => void;
  assetFavoriteOnly: boolean;
  setAssetFavoriteOnly: (v: boolean | ((prev: boolean) => boolean)) => void;

  generatedAssetDialog: { task: ImageTask; imageUrl: string; projectId: string; kind: ProjectAssetKind; name: string } | null;
  setGeneratedAssetDialog: (v: { task: ImageTask; imageUrl: string; projectId: string; kind: ProjectAssetKind; name: string } | null | ((prev: { task: ImageTask; imageUrl: string; projectId: string; kind: ProjectAssetKind; name: string } | null) => { task: ImageTask; imageUrl: string; projectId: string; kind: ProjectAssetKind; name: string } | null)) => void;

  // ===== Refs =====
  activeStoryboardRef: React.MutableRefObject<{ id: string; mode: "image" | "video" } | null>;
}

/**
 * 工作台状态 hook —— 集中声明所有 useState。
 * 注意：所有 setter 类型已支持函数式更新（setter<X | ((prev: X) => X)>），
 * 子 hook 可以直接用 setState(prev => ...) 风格。
 */
export function useWorkbenchState(): WorkbenchState {
  // ===== 核心数据 =====
  const [projectSummary, setProjectSummary] = useState<ProjectSummary | null>(null);
  const [projectEpisodes, setProjectEpisodes] = useState<ProjectEpisode[]>([]);
  const [projectIssues, setProjectIssues] = useState<ProjectIssue[]>([]);
  const [projectMilestones, setProjectMilestones] = useState<ProjectMilestone[]>([]);
  const [projectScripts, setProjectScripts] = useState<ProjectScript[]>([]);
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);
  const [projectReviews, setProjectReviews] = useState<ProjectReview[]>([]);
  const [projectClips, setProjectClips] = useState<ProjectClip[]>([]);
  const [projectTasks, setProjectTasks] = useState<ProjectTask[]>([]);
  const [projectStoryboards, setProjectStoryboards] = useState<ProjectStoryboard[]>([]);
  const [projectAssets, setProjectAssets] = useState<ProjectAsset[]>([]);
  const [projectDraft, setProjectDraft] = useState<Partial<Project>>({});

  // ===== UI 状态 =====
  const [selectedStoryboardIds, setSelectedStoryboardIds] = useState<string[]>([]);
  const [projectWorkbenchTab, setProjectWorkbenchTab] = useState<WorkbenchTab>("overview");
  const [workbenchSearch, setWorkbenchSearch] = useState("");
  const [workbenchStatusFilter, setWorkbenchStatusFilter] = useState("all");
  const [workbenchOwnerFilter, setWorkbenchOwnerFilter] = useState("all");
  const [workbenchPageByTab, setWorkbenchPageByTab] = useState<Partial<Record<WorkbenchTab, number>>>({});

  // ===== 表单草稿 =====
  const [taskDraft, setTaskDraft] = useState<Partial<ProjectTask>>({ title: "", status: "todo" as ProjectTaskStatus, owner: "", due_date: "", notes: "" });
  const [editingTaskId, setEditingTaskId] = useState("");
  const [memberDraft, setMemberDraft] = useState<Partial<ProjectMember>>({ name: "", role: "导演", contact: "", notes: "" });
  const [episodeDraft, setEpisodeDraft] = useState<Partial<ProjectEpisode>>({ episode: 1, title: "", status: "策划中", summary: "", due_date: "", notes: "" });
  const [issueDraft, setIssueDraft] = useState<Partial<ProjectIssue>>({ title: "", severity: "medium" as ProjectIssueSeverity, status: "open" as ProjectIssueStatus, owner: "", target_type: "", target_id: "", notes: "" });
  const [milestoneDraft, setMilestoneDraft] = useState<Partial<ProjectMilestone>>({ title: "", status: "planned" as ProjectMilestoneStatus, owner: "", due_date: "", description: "" });
  const [editingMemberId, setEditingMemberId] = useState("");
  const [editingEpisodeId, setEditingEpisodeId] = useState("");
  const [editingIssueId, setEditingIssueId] = useState("");
  const [editingMilestoneId, setEditingMilestoneId] = useState("");
  const [clipDraft, setClipDraft] = useState<Partial<ProjectClip>>({ episode: 1, scene: "1", shot: "1", title: "", source_video_url: "", duration: 5, in_point: "", out_point: "", order_index: 0, status: "todo" as ProjectClipStatus, notes: "" });
  const [scriptForm, setScriptForm] = useState<ScriptFormDraft>({ episode: 1, title: "", status: "draft" as ProjectScript["status"], content: "", notes: "" });
  const [editingScriptId, setEditingScriptId] = useState("");
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, string>>({});
  const [storyboardDraft, setStoryboardDraft] = useState<StoryboardDraft>({
    episode: 1, scene: "1", shot: "1", title: "", description: "", dialogue: "",
    characters: "", character_asset_ids: [] as string[], location: "", scene_asset_id: "",
    shot_size: "", camera_move: "", duration: 5, status: "draft" as ProjectStoryboardStatus, prompt: "",
  });
  const [editingStoryboardId, setEditingStoryboardId] = useState("");
  const [editingClipId, setEditingClipId] = useState("");
  const [scriptDraft, setScriptDraft] = useState("");
  const [assetComposerKind, setAssetComposerKind] = useState<ProjectAssetKind>("image");
  const [editingAssetId, setEditingAssetId] = useState("");
  const [assetDrafts, setAssetDrafts] = useState<Record<ProjectAssetKind, AssetDraft>>({
    image: { ...emptyAssetDraft },
    video: { ...emptyAssetDraft },
    character: { ...emptyAssetDraft },
    scene: { ...emptyAssetDraft },
    style: { ...emptyAssetDraft },
    prompt: { ...emptyAssetDraft },
    project: { ...emptyAssetDraft },
    storyboard: { ...emptyAssetDraft },
  });
  const [assetSearch, setAssetSearch] = useState("");
  const [assetKindFilter, setAssetKindFilter] = useState<ProjectAssetKind | "all">("all");
  const [assetTagFilter, setAssetTagFilter] = useState("");
  const [assetFavoriteOnly, setAssetFavoriteOnly] = useState(false);
  const [generatedAssetDialog, setGeneratedAssetDialog] = useState<{ task: ImageTask; imageUrl: string; projectId: string; kind: ProjectAssetKind; name: string } | null>(null);

  const activeStoryboardRef = useRef<{ id: string; mode: "image" | "video" } | null>(null);

  return {
    // 核心数据
    projectSummary, setProjectSummary,
    projectEpisodes, setProjectEpisodes,
    projectIssues, setProjectIssues,
    projectMilestones, setProjectMilestones,
    projectScripts, setProjectScripts,
    projectMembers, setProjectMembers,
    projectReviews, setProjectReviews,
    projectClips, setProjectClips,
    projectTasks, setProjectTasks,
    projectStoryboards, setProjectStoryboards,
    projectAssets, setProjectAssets,
    projectDraft, setProjectDraft,

    // UI
    selectedStoryboardIds, setSelectedStoryboardIds,
    projectWorkbenchTab, setProjectWorkbenchTab,
    workbenchSearch, setWorkbenchSearch,
    workbenchStatusFilter, setWorkbenchStatusFilter,
    workbenchOwnerFilter, setWorkbenchOwnerFilter,
    workbenchPageByTab, setWorkbenchPageByTab,

    // 表单草稿
    taskDraft, setTaskDraft,
    editingTaskId, setEditingTaskId,
    memberDraft, setMemberDraft,
    episodeDraft, setEpisodeDraft,
    issueDraft, setIssueDraft,
    milestoneDraft, setMilestoneDraft,
    editingMemberId, setEditingMemberId,
    editingEpisodeId, setEditingEpisodeId,
    editingIssueId, setEditingIssueId,
    editingMilestoneId, setEditingMilestoneId,
    clipDraft, setClipDraft,
    scriptForm, setScriptForm,
    editingScriptId, setEditingScriptId,
    reviewDrafts, setReviewDrafts,
    storyboardDraft, setStoryboardDraft,
    editingStoryboardId, setEditingStoryboardId,
    editingClipId, setEditingClipId,
    scriptDraft, setScriptDraft,
    assetComposerKind, setAssetComposerKind,
    editingAssetId, setEditingAssetId,
    assetDrafts, setAssetDrafts,
    assetSearch, setAssetSearch,
    assetKindFilter, setAssetKindFilter,
    assetTagFilter, setAssetTagFilter,
    assetFavoriteOnly, setAssetFavoriteOnly,
    generatedAssetDialog, setGeneratedAssetDialog,

    // Refs
    activeStoryboardRef,
  };
}

/**
 * 通用过滤器：搜索关键字 + 状态 + 负责人匹配。
 * 暴露在 state hook 是为了让子 hook 也能复用（filteredProject* 在 derived hook 中用）。
 */
export function matchesWorkbenchFilters(
  workbenchSearch: string,
  workbenchStatusFilter: string,
  workbenchOwnerFilter: string,
  item: object,
  textFields: string[],
  status?: string,
  owner?: string,
) {
  const record = item as Record<string, unknown>;
  const keyword = workbenchSearch.trim().toLowerCase();
  const textMatched = !keyword || textFields.some((field) => String(record[field] ?? "").toLowerCase().includes(keyword));
  const statusMatched = workbenchStatusFilter === "all" || !status || status === workbenchStatusFilter;
  const ownerMatched = workbenchOwnerFilter === "all" || !owner || owner === workbenchOwnerFilter;
  return textMatched && statusMatched && ownerMatched;
}
