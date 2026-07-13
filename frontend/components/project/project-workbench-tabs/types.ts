"use client";

/**
 * project-workbench-tabs 公共类型
 *
 * 集中导出所有 tab 组件共享的接口与草稿类型，避免在多个 tab 文件里重复声明。
 */

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
  ProjectScript,
  ProjectStoryboard,
  ProjectStoryboardStatus,
  ProjectSummary,
  ProjectTask,
  ProjectTaskStatus,
  ProjectReview,
  ProjectHealth,
  WorkbenchTab,
} from "@/lib/app-types";

export type {
  ProjectHealth,
  ProjectIssueSeverity,
  ProjectIssueStatus,
  ProjectMilestoneStatus,
  ProjectTaskStatus,
  ProjectClipStatus,
  ProjectStoryboardStatus,
};

/** 分镜草稿（带"剧集/场次/镜号"位置 + 资源绑定 ID 列表） */
export type StoryboardDraft = {
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

/** 剧本草稿（与 useProjectWorkbench.scriptForm 类型一致） */
export type ScriptFormDraft = {
  episode: number;
  title: string;
  status: ProjectScript["status"];
  content: string;
  notes: string;
};

/** 项目阶段行（overview tab 用） */
export type ProjectStageRow = {
  key: WorkbenchTab;
  label: string;
  description: string;
  metric: string;
  step: number;
  ready: boolean;
  progress: number;
  action: string;
};

/**
 * ProjectWorkbenchTabs 公开 props —— 外部组件直接消费这个接口。
 * 12 个 tab 内部共享。
 *
 * 注意：ProjectReview target_type + status 等 enum 字面量约束保持
 * 与 lib/app-types.ts 一致；不要在本文件内做收紧。
 */
export interface ProjectWorkbenchTabsProps {
  projectWorkbenchTab: WorkbenchTab;
  selectedProject: Project | undefined;
  currentWorkbenchPageNumber: number;
  workbenchPageSize: number;

  // ===== Overview =====
  projectSummary: ProjectSummary | null;
  projectDraft: Partial<Project>;
  projectHealth: ProjectHealth | null;
  productionProgress: number;
  productionStageRows: ProjectStageRow[];
  openIssueCount: number;
  pendingReviewCount: number;
  completedTaskCount: number;
  projectTasks: ProjectTask[];

  // ===== Members =====
  projectMembers: ProjectMember[];
  filteredProjectMembers: ProjectMember[];
  pagedProjectMembers: ProjectMember[];
  memberDraft: Partial<ProjectMember>;
  editingMemberId: string;

  // ===== Episodes =====
  projectEpisodes: ProjectEpisode[];
  filteredProjectEpisodes: ProjectEpisode[];
  pagedProjectEpisodes: ProjectEpisode[];
  episodeDraft: Partial<ProjectEpisode>;
  editingEpisodeId: string;

  // ===== Issues =====
  projectIssues: ProjectIssue[];
  filteredProjectIssues: ProjectIssue[];
  pagedProjectIssues: ProjectIssue[];
  issueDraft: Partial<ProjectIssue>;
  editingIssueId: string;

  // ===== Milestones =====
  projectMilestones: ProjectMilestone[];
  filteredProjectMilestones: ProjectMilestone[];
  pagedProjectMilestones: ProjectMilestone[];
  milestoneDraft: Partial<ProjectMilestone>;
  editingMilestoneId: string;

  // ===== Scripts =====
  projectScripts: ProjectScript[];
  filteredProjectScripts: ProjectScript[];
  pagedProjectScripts: ProjectScript[];
  scriptForm: ScriptFormDraft;
  editingScriptId: string;
  scriptStatusText: (status: ProjectScript["status"]) => string;

  // ===== Storyboards =====
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

  // ===== Clips =====
  projectClips: ProjectClip[];
  filteredProjectClips: ProjectClip[];
  pagedProjectClips: ProjectClip[];
  clipDraft: Partial<ProjectClip>;
  editingClipId: string;
  clipStatuses: Array<{ key: ProjectClipStatus; label: string }>;
  clipStatusText: (status: ProjectClipStatus) => string;

  // ===== Reviews =====
  filteredProjectReviews: ProjectReview[];
  pagedProjectReviews: ProjectReview[];
  reviewTargetLabel: (review: ProjectReview) => string;

  // ===== Tasks =====
  filteredProjectTasks: ProjectTask[];
  pagedProjectTasks: ProjectTask[];
  taskDraft: Partial<ProjectTask>;
  editingTaskId: string;
  projectTaskColumns: readonly { key: ProjectTaskStatus; label: string }[];

  // ===== Assets =====
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

  // ===== Exports =====
  // projectScripts, projectStoryboards, projectClips, projectAssets 已在上面声明

  // ===== Callbacks =====
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
  setScriptForm: (updater: (draft: ScriptFormDraft) => ScriptFormDraft) => void;

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
