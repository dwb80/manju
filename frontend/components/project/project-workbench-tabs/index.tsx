"use client";

/**
 * ProjectWorkbenchTabs —— 项目工作台 tab 路由器（thin wrapper）
 *
 * 拆分前：1518 行单文件，12 个 tab 的实现全部内联。
 * 拆分后：
 *   - 6 个原有 tab 文件（overview / members / episodes / issues / milestones / scripts）
 *   - 6 个新建 tab 文件（tasks / storyboards / clips / reviews / assets / exports）
 *   - 本文件（< 200 行）只做：props 透传 + 按 projectWorkbenchTab 路由
 *
 * 公开 API 完全保持兼容：ProjectWorkbenchTabsProps 与拆分前一致。
 */

import type { ProjectWorkbenchTabsProps } from "./types";
import { OverviewTab } from "./overview-tab";
import { MembersTab } from "./members-tab";
import { EpisodesTab } from "./episodes-tab";
import { IssuesTab } from "./issues-tab";
import { MilestonesTab } from "./milestones-tab";
import { ScriptsTab } from "./scripts-tab";
import { TasksTab } from "./tasks-tab";
import { StoryboardsTab } from "./storyboards-tab";
import { ClipsTab } from "./clips-tab";
import { ReviewsTab } from "./reviews-tab";
import { AssetsTab } from "./assets-tab";
import { ExportsTab } from "./exports-tab";

export type { ProjectWorkbenchTabsProps } from "./types";

export function ProjectWorkbenchTabs(props: ProjectWorkbenchTabsProps) {
  const { projectWorkbenchTab } = props;

  switch (projectWorkbenchTab) {
    case "overview":
      return <OverviewTab {...buildOverviewProps(props)} />;
    case "members":
      return <MembersTab {...buildMembersProps(props)} />;
    case "episodes":
      return <EpisodesTab {...buildEpisodesProps(props)} />;
    case "issues":
      return <IssuesTab {...buildIssuesProps(props)} />;
    case "milestones":
      return <MilestonesTab {...buildMilestonesProps(props)} />;
    case "scripts":
      return <ScriptsTab {...buildScriptsProps(props)} />;
    case "tasks":
      return <TasksTab {...buildTasksProps(props)} />;
    case "storyboards":
      return <StoryboardsTab {...buildStoryboardsProps(props)} />;
    case "clips":
      return <ClipsTab {...buildClipsProps(props)} />;
    case "reviews":
      return <ReviewsTab {...buildReviewsProps(props)} />;
    case "assets":
      return <AssetsTab {...buildAssetsProps(props)} />;
    case "exports":
      return <ExportsTab {...buildExportsProps(props)} />;
    default:
      return <OverviewTab {...buildOverviewProps(props)} />;
  }
}

// ============== 各 tab 的 props 切片 ==============
//
// 每个 tab 只接收它需要的字段，避免 props 漂移和意外耦合。
// 字段命名与 ProjectWorkbenchTabsProps 一一对应。

function buildOverviewProps(p: ProjectWorkbenchTabsProps) {
  return {
    selectedProject: p.selectedProject,
    projectSummary: p.projectSummary,
    projectDraft: p.projectDraft,
    projectHealth: p.projectHealth,
    productionProgress: p.productionProgress,
    productionStageRows: p.productionStageRows,
    openIssueCount: p.openIssueCount,
    pendingReviewCount: p.pendingReviewCount,
    completedTaskCount: p.completedTaskCount,
    projectTasks: p.projectTasks,
    saveProjectPlan: p.saveProjectPlan,
    setProjectDraft: p.setProjectDraft,
    openWorkbenchPage: p.openWorkbenchPage,
  };
}

function buildMembersProps(p: ProjectWorkbenchTabsProps) {
  return {
    projectMembers: p.projectMembers,
    filteredProjectMembers: p.filteredProjectMembers,
    pagedProjectMembers: p.pagedProjectMembers,
    memberDraft: p.memberDraft,
    editingMemberId: p.editingMemberId,
    resetProjectMemberForm: p.resetProjectMemberForm,
    editProjectMemberItem: p.editProjectMemberItem,
    deleteProjectMemberItem: p.deleteProjectMemberItem,
    submitProjectMemberForm: p.submitProjectMemberForm,
    setMemberDraft: p.setMemberDraft,
  };
}

function buildEpisodesProps(p: ProjectWorkbenchTabsProps) {
  return {
    projectEpisodes: p.projectEpisodes,
    filteredProjectEpisodes: p.filteredProjectEpisodes,
    pagedProjectEpisodes: p.pagedProjectEpisodes,
    episodeDraft: p.episodeDraft,
    editingEpisodeId: p.editingEpisodeId,
    resetProjectEpisodeForm: p.resetProjectEpisodeForm,
    editProjectEpisodeItem: p.editProjectEpisodeItem,
    deleteProjectEpisodeItem: p.deleteProjectEpisodeItem,
    submitProjectEpisodeForm: p.submitProjectEpisodeForm,
    setEpisodeDraft: p.setEpisodeDraft,
  };
}

function buildIssuesProps(p: ProjectWorkbenchTabsProps) {
  return {
    projectIssues: p.projectIssues,
    filteredProjectIssues: p.filteredProjectIssues,
    pagedProjectIssues: p.pagedProjectIssues,
    issueDraft: p.issueDraft,
    editingIssueId: p.editingIssueId,
    resetProjectIssueForm: p.resetProjectIssueForm,
    editProjectIssueItem: p.editProjectIssueItem,
    deleteProjectIssueItem: p.deleteProjectIssueItem,
    submitProjectIssueForm: p.submitProjectIssueForm,
    setIssueDraft: p.setIssueDraft,
    projectMembers: p.projectMembers,
  };
}

function buildMilestonesProps(p: ProjectWorkbenchTabsProps) {
  return {
    projectMilestones: p.projectMilestones,
    filteredProjectMilestones: p.filteredProjectMilestones,
    pagedProjectMilestones: p.pagedProjectMilestones,
    milestoneDraft: p.milestoneDraft,
    editingMilestoneId: p.editingMilestoneId,
    resetProjectMilestoneForm: p.resetProjectMilestoneForm,
    editProjectMilestoneItem: p.editProjectMilestoneItem,
    deleteProjectMilestoneItem: p.deleteProjectMilestoneItem,
    submitProjectMilestoneForm: p.submitProjectMilestoneForm,
    setMilestoneDraft: p.setMilestoneDraft,
    projectMembers: p.projectMembers,
  };
}

function buildScriptsProps(p: ProjectWorkbenchTabsProps) {
  return {
    projectScripts: p.projectScripts,
    filteredProjectScripts: p.filteredProjectScripts,
    pagedProjectScripts: p.pagedProjectScripts,
    scriptForm: p.scriptForm,
    editingScriptId: p.editingScriptId,
    scriptStatusText: p.scriptStatusText,
    resetProjectScriptForm: p.resetProjectScriptForm,
    editProjectScriptItem: p.editProjectScriptItem,
    deleteProjectScriptItem: p.deleteProjectScriptItem,
    submitProjectScriptForm: p.submitProjectScriptForm,
    breakdownSavedScript: p.breakdownSavedScript,
    setScriptForm: p.setScriptForm,
    downloadProjectExport: p.downloadProjectExport,
  };
}

function buildTasksProps(p: ProjectWorkbenchTabsProps) {
  return {
    editingTaskId: p.editingTaskId,
    taskDraft: p.taskDraft,
    setTaskDraft: p.setTaskDraft,
    submitProjectTaskForm: p.submitProjectTaskForm,
    resetProjectTaskForm: p.resetProjectTaskForm,
    projectTaskColumns: p.projectTaskColumns,
    projectMembers: p.projectMembers,
    pagedProjectTasks: p.pagedProjectTasks,
    editProjectTaskItem: p.editProjectTaskItem,
    deleteProjectTaskItem: p.deleteProjectTaskItem,
  };
}

function buildStoryboardsProps(p: ProjectWorkbenchTabsProps) {
  return {
    projectStoryboards: p.projectStoryboards,
    filteredProjectStoryboards: p.filteredProjectStoryboards,
    pagedProjectStoryboards: p.pagedProjectStoryboards,
    storyboardDraft: p.storyboardDraft,
    setStoryboardDraft: p.setStoryboardDraft,
    editingStoryboardId: p.editingStoryboardId,
    setEditingStoryboardId: p.setEditingStoryboardId,
    selectedStoryboardIds: p.selectedStoryboardIds,
    setSelectedStoryboardIds: p.setSelectedStoryboardIds,
    toggleStoryboardSelection: p.toggleStoryboardSelection,
    storyboardStatuses: p.storyboardStatuses,
    storyboardStatusText: p.storyboardStatusText,
    characterAssets: p.characterAssets,
    sceneAssets: p.sceneAssets,
    projectReviews: p.projectReviews,
    reviewDrafts: p.reviewDrafts,
    setReviewDrafts: p.setReviewDrafts,
    createProjectStoryboardItem: p.createProjectStoryboardItem,
    editProjectStoryboard: p.editProjectStoryboard,
    deleteProjectStoryboardItem: p.deleteProjectStoryboardItem,
    useStoryboardForGeneration: p.useStoryboardForGeneration,
    createStoryboardReview: p.createStoryboardReview,
    updateProjectReviewItem: p.updateProjectReviewItem,
    deleteProjectReviewItem: p.deleteProjectReviewItem,
    scriptDraft: p.scriptDraft,
    setScriptDraft: p.setScriptDraft,
    breakdownScriptToStoryboards: p.breakdownScriptToStoryboards,
    batchUpdateStoryboards: p.batchUpdateStoryboards,
    downloadStoryboardCsv: p.downloadStoryboardCsv,
    copy: p.copy,
  };
}

function buildClipsProps(p: ProjectWorkbenchTabsProps) {
  return {
    currentWorkbenchPageNumber: p.currentWorkbenchPageNumber,
    workbenchPageSize: p.workbenchPageSize,
    projectClips: p.projectClips,
    filteredProjectClips: p.filteredProjectClips,
    pagedProjectClips: p.pagedProjectClips,
    editingClipId: p.editingClipId,
    clipDraft: p.clipDraft,
    setClipDraft: p.setClipDraft,
    submitProjectClipForm: p.submitProjectClipForm,
    resetProjectClipForm: p.resetProjectClipForm,
    editProjectClipItem: p.editProjectClipItem,
    deleteProjectClipItem: p.deleteProjectClipItem,
    clipStatuses: p.clipStatuses,
    clipStatusText: p.clipStatusText,
    syncProjectClips: p.syncProjectClips,
    downloadProjectExport: p.downloadProjectExport,
  };
}

function buildReviewsProps(p: ProjectWorkbenchTabsProps) {
  return {
    projectReviews: p.projectReviews,
    filteredProjectReviews: p.filteredProjectReviews,
    pagedProjectReviews: p.pagedProjectReviews,
    reviewTargetLabel: p.reviewTargetLabel,
    updateProjectReviewItem: p.updateProjectReviewItem,
    deleteProjectReviewItem: p.deleteProjectReviewItem,
  };
}

function buildAssetsProps(p: ProjectWorkbenchTabsProps) {
  return {
    projectAssets: p.projectAssets,
    filteredProjectAssets: p.filteredProjectAssets,
    pagedProjectAssets: p.pagedProjectAssets,
    currentWorkbenchPageNumber: p.currentWorkbenchPageNumber,
    workbenchPageSize: p.workbenchPageSize,
    setCurrentWorkbenchPage: p.setCurrentWorkbenchPage,
    editingAssetId: p.editingAssetId,
    assetComposerKind: p.assetComposerKind,
    setAssetComposerKind: p.setAssetComposerKind,
    currentAssetDraft: p.currentAssetDraft,
    setAssetDrafts: p.setAssetDrafts,
    resetProjectAssetForm: p.resetProjectAssetForm,
    submitProjectAssetForm: p.submitProjectAssetForm,
    editProjectAssetItem: p.editProjectAssetItem,
    deleteProjectAssetItem: p.deleteProjectAssetItem,
    reuseProjectAsset: p.reuseProjectAsset,
    toggleProjectAssetFavorite: p.toggleProjectAssetFavorite,
    projectAssetReferenceUrls: p.projectAssetReferenceUrls,
    continueEditImage: p.continueEditImage,
    copy: p.copy,
    projectAssetKinds: p.projectAssetKinds,
    assetKindCounts: p.assetKindCounts,
    assetSearch: p.assetSearch,
    setAssetSearch: p.setAssetSearch,
    assetKindFilter: p.assetKindFilter,
    setAssetKindFilter: p.setAssetKindFilter,
    assetTagFilter: p.assetTagFilter,
    setAssetTagFilter: p.setAssetTagFilter,
    assetFavoriteOnly: p.assetFavoriteOnly,
    setAssetFavoriteOnly: p.setAssetFavoriteOnly,
  };
}

function buildExportsProps(p: ProjectWorkbenchTabsProps) {
  return {
    selectedProject: p.selectedProject,
    projectScripts: p.projectScripts,
    projectStoryboards: p.projectStoryboards,
    projectClips: p.projectClips,
    projectAssets: p.projectAssets,
    downloadProjectExport: p.downloadProjectExport,
    downloadStoryboardCsv: p.downloadStoryboardCsv,
    generateProjectPackageIndex: p.generateProjectPackageIndex,
    openProjectFolder: p.openProjectFolder,
    refreshProjectWorkbench: p.refreshProjectWorkbench,
  };
}
