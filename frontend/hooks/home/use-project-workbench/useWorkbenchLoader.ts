"use client";

/**
 * 工作台数据加载 hook
 *
 * 职责：
 *  - 切换项目时一次性并发加载 summary + 10 类资源数据
 *  - 项目不存在时（404 / project not found）触发 recoverMissingProject
 *  - 提供 refreshProjectWorkbench 提示入口
 */

import { useCallback } from "react";
import { api } from "@/lib/api-client";
import type {
  Project,
  ProjectSummary,
  ProjectEpisode,
  ProjectIssue,
  ProjectMilestone,
  ProjectScript,
  ProjectMember,
  ProjectReview,
  ProjectClip,
  ProjectTask,
  ProjectStoryboard,
  ProjectAsset,
} from "@/lib/app-types";
import type { WorkbenchState } from "./useWorkbenchState";

/** 项目缺失错误的标记字符串（与后端保持一致） */
function isProjectMissingError(error: unknown) {
  return error instanceof Error && /project not found/i.test(error.message);
}

export interface RecoverMissingCallbacks {
  onSetProjectScope?: (scope: string) => void;
  onSetMode?: (mode: "chat") => void;
  onLoadProjects?: () => Promise<void>;
  onLoadConversations?: (preferredId?: string, scope?: string) => Promise<void>;
}

/**
 * 项目缺失时清空所有项目维度状态、切回 chat 列表模式并通知用户。
 * 任何子 hook 检测到 project not found 都应调用本函数。
 */
export function useRecoverMissingProject({
  state,
  showNotice,
}: {
  state: WorkbenchState;
  showNotice: (message: string) => void;
}) {
  const {
    setProjectSummary, setProjectEpisodes, setProjectIssues, setProjectMilestones,
    setProjectScripts, setProjectMembers, setProjectReviews, setProjectClips,
    setProjectTasks, setProjectStoryboards, setSelectedStoryboardIds,
    setProjectAssets, setProjectDraft,
  } = state;

  return useCallback(async (error: unknown, callbacks?: RecoverMissingCallbacks) => {
    if (!isProjectMissingError(error)) return false;
    setProjectSummary(null);
    setProjectEpisodes([]);
    setProjectIssues([]);
    setProjectMilestones([]);
    setProjectScripts([]);
    setProjectMembers([]);
    setProjectReviews([]);
    setProjectClips([]);
    setProjectTasks([]);
    setProjectStoryboards([]);
    setSelectedStoryboardIds([]);
    setProjectAssets([]);
    setProjectDraft({});
    callbacks?.onSetProjectScope?.("all");
    callbacks?.onSetMode?.("chat");
    await callbacks?.onLoadProjects?.();
    await callbacks?.onLoadConversations?.("", "all");
    showNotice("项目不存在或已被删除，请重新选择项目");
    return true;
  }, [
    setProjectSummary, setProjectEpisodes, setProjectIssues, setProjectMilestones,
    setProjectScripts, setProjectMembers, setProjectReviews, setProjectClips,
    setProjectTasks, setProjectStoryboards, setSelectedStoryboardIds,
    setProjectAssets, setProjectDraft, showNotice,
  ]);
}

/**
 * 并发加载项目工作台全量数据。
 *  - 传入 "all" 或空 id 时清空所有项目维度状态
 *  - 项目未在 projects 列表中找到也清空
 *  - 任一接口 reject 且是 project-not-found 错误：自动 recover
 *  - 其它 reject：用 fallback summary 兜底，UI 不阻塞，但提示"部分数据加载失败"
 */
export function useLoadProjectSummary({
  state,
  recoverMissingProject,
  showNotice,
}: {
  state: WorkbenchState;
  recoverMissingProject: (error: unknown, callbacks?: RecoverMissingCallbacks) => Promise<boolean>;
  showNotice: (message: string) => void;
}) {
  const {
    assetSearch, assetKindFilter, assetTagFilter, assetFavoriteOnly,
    setProjectSummary, setProjectEpisodes, setProjectIssues, setProjectMilestones,
    setProjectScripts, setProjectMembers, setProjectReviews, setProjectClips,
    setProjectTasks, setProjectStoryboards, setSelectedStoryboardIds,
    setProjectAssets, setProjectDraft,
  } = state;

  const assetQuery = `kind=${encodeURIComponent(assetKindFilter)}&q=${encodeURIComponent(assetSearch)}&tag=${encodeURIComponent(assetTagFilter)}&favorite=${assetFavoriteOnly ? "true" : "false"}`;

  return useCallback(async (projectId: string, projects: Project[], conversations: { filter: (cb: (c: { project_id?: string }) => boolean) => { length: number } }) => {
    if (!projectId || projectId === "all") {
      setProjectSummary(null);
      setProjectEpisodes([]);
      setProjectIssues([]);
      setProjectMilestones([]);
      setProjectScripts([]);
      setProjectMembers([]);
      setProjectReviews([]);
      setProjectClips([]);
      setProjectTasks([]);
      setProjectStoryboards([]);
      setSelectedStoryboardIds([]);
      setProjectAssets([]);
      setProjectDraft({});
      return null;
    }
    const fallbackProject = projects.find((project) => project.id === projectId);
    if (!fallbackProject) {
      setProjectSummary(null);
      setProjectEpisodes([]);
      setProjectIssues([]);
      setProjectMilestones([]);
      setProjectScripts([]);
      setProjectMembers([]);
      setProjectReviews([]);
      setProjectClips([]);
      setProjectTasks([]);
      setProjectStoryboards([]);
      setSelectedStoryboardIds([]);
      setProjectAssets([]);
      setProjectDraft({});
      return null;
    }
    const [summaryResult, episodesResult, issuesResult, milestonesResult, scriptsResult, membersResult, reviewsResult, clipsResult, tasksResult, storyboardsResult, assetsResult] = await Promise.allSettled([
      api<ProjectSummary>(`/api/projects/${projectId}/summary`),
      api<ProjectEpisode[]>(`/api/projects/${projectId}/episodes`),
      api<ProjectIssue[]>(`/api/projects/${projectId}/issues`),
      api<ProjectMilestone[]>(`/api/projects/${projectId}/milestones`),
      api<ProjectScript[]>(`/api/projects/${projectId}/scripts`),
      api<ProjectMember[]>(`/api/projects/${projectId}/members`),
      api<ProjectReview[]>(`/api/projects/${projectId}/reviews`),
      api<ProjectClip[]>(`/api/projects/${projectId}/clips`),
      api<ProjectTask[]>(`/api/projects/${projectId}/tasks`),
      api<ProjectStoryboard[]>(`/api/projects/${projectId}/storyboards`),
      api<ProjectAsset[]>(`/api/projects/${projectId}/assets?${assetQuery}`),
    ]);
    const results = [summaryResult, episodesResult, issuesResult, milestonesResult, scriptsResult, membersResult, reviewsResult, clipsResult, tasksResult, storyboardsResult, assetsResult];
    const rejected = results.find((item) => item.status === "rejected");
    if (rejected?.status === "rejected") {
      const recovered = await recoverMissingProject(rejected.reason);
      if (recovered) return null;
    }
    const summary = summaryResult.status === "fulfilled"
      ? summaryResult.value
      : {
          project: fallbackProject,
          conversations: conversations.filter((c) => c.project_id === projectId).length,
          members: 0, episodes: 0, issues: 0, open_issues: 0,
          milestones: 0, open_milestones: 0, tasks: 0, completed_tasks: 0,
          images: 0, videos: 0, completed_images: 0, completed_videos: 0,
          latest_activity_at: fallbackProject.updated_at,
        };
    setProjectSummary(summary);
    setProjectEpisodes(episodesResult.status === "fulfilled" ? episodesResult.value : []);
    setProjectIssues(issuesResult.status === "fulfilled" ? issuesResult.value : []);
    setProjectMilestones(milestonesResult.status === "fulfilled" ? milestonesResult.value : []);
    setProjectScripts(scriptsResult.status === "fulfilled" ? scriptsResult.value : []);
    setProjectMembers(membersResult.status === "fulfilled" ? membersResult.value : []);
    setProjectReviews(reviewsResult.status === "fulfilled" ? reviewsResult.value : []);
    setProjectClips(clipsResult.status === "fulfilled" ? clipsResult.value : []);
    setProjectTasks(tasksResult.status === "fulfilled" ? tasksResult.value : []);
    setProjectStoryboards(storyboardsResult.status === "fulfilled" ? storyboardsResult.value : []);
    setSelectedStoryboardIds([]);
    setProjectAssets(assetsResult.status === "fulfilled" ? assetsResult.value : []);
    setProjectDraft(summary.project);
    if (rejected) {
      showNotice("项目部分数据加载失败，请刷新重试");
    }
    return summary;
  }, [
    assetQuery, recoverMissingProject, showNotice,
    setProjectSummary, setProjectEpisodes, setProjectIssues, setProjectMilestones,
    setProjectScripts, setProjectMembers, setProjectReviews, setProjectClips,
    setProjectTasks, setProjectStoryboards, setSelectedStoryboardIds,
    setProjectAssets, setProjectDraft,
  ]);
}

/** 刷新工作台（轻量入口，目前仅显示提示） */
export function useRefreshProjectWorkbench({
  showNotice,
}: {
  showNotice: (message: string) => void;
}) {
  return useCallback(async (selectedProject: Project | undefined) => {
    if (!selectedProject) return;
    showNotice("正在刷新项目工作台...");
    showNotice("项目工作台已刷新");
  }, [showNotice]);
}
