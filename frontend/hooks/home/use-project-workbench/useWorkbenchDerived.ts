"use client";

/**
 * 工作台：派生计算值
 *
 *  - 过滤 (search + status + owner)
 *  - 排序 (按更新时间倒序)
 *  - 分页 (每页 10 条)
 *  - 资产额外过滤 (kind / tag / favorite)
 *
 * 所有派生值仅依赖 state，不在派生中触发副作用。
 */

import { useMemo } from "react";
import type {
  ProjectAsset,
  ProjectClip,
  ProjectEpisode,
  ProjectIssue,
  ProjectMember,
  ProjectMilestone,
  ProjectReview,
  ProjectScript,
  ProjectStoryboard,
  ProjectTask,
  WorkbenchTab,
} from "@/lib/app-types";
import { matchesWorkbenchFilters } from "./useWorkbenchState";
import type { WorkbenchState } from "./useWorkbenchState";

const PAGE_SIZE = 10;

interface DerivedCollection<T> {
  filtered: T[];
  sorted: T[];
  paged: T[];
  total: number;
  page: number;
  totalPages: number;
}

function paginate<T>(
  items: T[],
  workbenchPageByTab: Partial<Record<WorkbenchTab, number>>,
  tab: WorkbenchTab,
): DerivedCollection<T> {
  const sorted = items.slice().sort((a, b) => {
    const aT = new Date((a as { updated_at?: string }).updated_at ?? 0).getTime();
    const bT = new Date((b as { updated_at?: string }).updated_at ?? 0).getTime();
    return bT - aT;
  });
  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(workbenchPageByTab[tab] ?? 1, 1), totalPages);
  const start = (page - 1) * PAGE_SIZE;
  const paged = sorted.slice(start, start + PAGE_SIZE);
  return { filtered: sorted, sorted, paged, total, page, totalPages };
}

export function useWorkbenchDerived(state: WorkbenchState) {
  const {
    workbenchSearch, workbenchStatusFilter, workbenchOwnerFilter,
    workbenchPageByTab,
    projectTasks, projectMembers, projectEpisodes, projectIssues, projectMilestones,
    projectScripts, projectReviews, projectStoryboards, projectClips, projectAssets,
    assetSearch, assetKindFilter, assetTagFilter, assetFavoriteOnly,
  } = state;

  // ===== 7 个普通集合：search + status + owner 过滤 =====
  const taskSearchFields = ["title", "notes", "owner"];
  const memberSearchFields = ["name", "role", "contact", "notes"];
  const episodeSearchFields = ["title", "summary", "notes", "status"];
  const issueSearchFields = ["title", "target_type", "notes", "owner"];
  const milestoneSearchFields = ["title", "description", "owner"];
  const scriptSearchFields = ["title", "notes"];
  const reviewSearchFields = ["target_type", "comment", "reviewer"];
  const storyboardSearchFields = ["title", "description", "dialogue", "prompt", "location"];
  const clipSearchFields = ["title", "scene", "shot", "source_video_url", "notes"];

  const filteredProjectTasks = useMemo(
    () => projectTasks.filter((item) => matchesWorkbenchFilters(workbenchSearch, workbenchStatusFilter, workbenchOwnerFilter, item, taskSearchFields, item.status, item.owner)),
    [projectTasks, workbenchSearch, workbenchStatusFilter, workbenchOwnerFilter],
  );
  const filteredProjectMembers = useMemo(
    () => projectMembers.filter((item) => matchesWorkbenchFilters(workbenchSearch, workbenchStatusFilter, workbenchOwnerFilter, item, memberSearchFields, undefined, undefined)),
    [projectMembers, workbenchSearch, workbenchStatusFilter, workbenchOwnerFilter],
  );
  const filteredProjectEpisodes = useMemo(
    () => projectEpisodes.filter((item) => matchesWorkbenchFilters(workbenchSearch, workbenchStatusFilter, workbenchOwnerFilter, item, episodeSearchFields, item.status, undefined)),
    [projectEpisodes, workbenchSearch, workbenchStatusFilter, workbenchOwnerFilter],
  );
  const filteredProjectIssues = useMemo(
    () => projectIssues.filter((item) => matchesWorkbenchFilters(workbenchSearch, workbenchStatusFilter, workbenchOwnerFilter, item, issueSearchFields, item.status, item.owner)),
    [projectIssues, workbenchSearch, workbenchStatusFilter, workbenchOwnerFilter],
  );
  const filteredProjectMilestones = useMemo(
    () => projectMilestones.filter((item) => matchesWorkbenchFilters(workbenchSearch, workbenchStatusFilter, workbenchOwnerFilter, item, milestoneSearchFields, item.status, item.owner)),
    [projectMilestones, workbenchSearch, workbenchStatusFilter, workbenchOwnerFilter],
  );
  const filteredProjectScripts = useMemo(
    () => projectScripts.filter((item) => matchesWorkbenchFilters(workbenchSearch, workbenchStatusFilter, workbenchOwnerFilter, item, scriptSearchFields, item.status, undefined)),
    [projectScripts, workbenchSearch, workbenchStatusFilter, workbenchOwnerFilter],
  );
  const filteredProjectReviews = useMemo(
    () => projectReviews.filter((item) => matchesWorkbenchFilters(workbenchSearch, workbenchStatusFilter, workbenchOwnerFilter, item, reviewSearchFields, item.target_type, item.reviewer)),
    [projectReviews, workbenchSearch, workbenchStatusFilter, workbenchOwnerFilter],
  );
  const filteredProjectStoryboards = useMemo(
    () => projectStoryboards.filter((item) => matchesWorkbenchFilters(workbenchSearch, workbenchStatusFilter, workbenchOwnerFilter, item, storyboardSearchFields, item.status, undefined)),
    [projectStoryboards, workbenchSearch, workbenchStatusFilter, workbenchOwnerFilter],
  );
  const filteredProjectClips = useMemo(
    () => projectClips.filter((item) => matchesWorkbenchFilters(workbenchSearch, workbenchStatusFilter, workbenchOwnerFilter, item, clipSearchFields, item.status, undefined)),
    [projectClips, workbenchSearch, workbenchStatusFilter, workbenchOwnerFilter],
  );

  // ===== 排序 + 分页 =====
  const tasks: DerivedCollection<ProjectTask> = useMemo(() => paginate(filteredProjectTasks, workbenchPageByTab, "tasks"), [filteredProjectTasks, workbenchPageByTab]);
  const members: DerivedCollection<ProjectMember> = useMemo(() => paginate(filteredProjectMembers, workbenchPageByTab, "members"), [filteredProjectMembers, workbenchPageByTab]);
  const episodes: DerivedCollection<ProjectEpisode> = useMemo(() => paginate(filteredProjectEpisodes, workbenchPageByTab, "episodes"), [filteredProjectEpisodes, workbenchPageByTab]);
  const issues: DerivedCollection<ProjectIssue> = useMemo(() => paginate(filteredProjectIssues, workbenchPageByTab, "issues"), [filteredProjectIssues, workbenchPageByTab]);
  const milestones: DerivedCollection<ProjectMilestone> = useMemo(() => paginate(filteredProjectMilestones, workbenchPageByTab, "milestones"), [filteredProjectMilestones, workbenchPageByTab]);
  const scripts: DerivedCollection<ProjectScript> = useMemo(() => paginate(filteredProjectScripts, workbenchPageByTab, "scripts"), [filteredProjectScripts, workbenchPageByTab]);
  const reviews: DerivedCollection<ProjectReview> = useMemo(() => paginate(filteredProjectReviews, workbenchPageByTab, "reviews"), [filteredProjectReviews, workbenchPageByTab]);
  const storyboards: DerivedCollection<ProjectStoryboard> = useMemo(() => paginate(filteredProjectStoryboards, workbenchPageByTab, "storyboards"), [filteredProjectStoryboards, workbenchPageByTab]);
  const clips: DerivedCollection<ProjectClip> = useMemo(() => paginate(filteredProjectClips, workbenchPageByTab, "clips"), [filteredProjectClips, workbenchPageByTab]);

  // ===== 资产独立过滤：kind / 搜索 / tag / favorite =====
  const filteredProjectAssets: ProjectAsset[] = useMemo(() => {
    const keyword = assetSearch.trim().toLowerCase();
    const tag = assetTagFilter.trim().toLowerCase();
    return projectAssets.filter((asset) => {
      if (assetKindFilter !== "all" && asset.kind !== assetKindFilter) return false;
      if (assetFavoriteOnly && !asset.is_favorite) return false;
      if (tag && !((asset.tags ?? []).map((t) => t.toLowerCase()).includes(tag))) return false;
      if (!keyword) return true;
      const haystack = [
        asset.name,
        asset.prompt ?? "",
        ...((asset.tags ?? []) as string[]),
      ].join(" ").toLowerCase();
      return haystack.includes(keyword);
    });
  }, [projectAssets, assetKindFilter, assetSearch, assetTagFilter, assetFavoriteOnly]);

  return {
    // 过滤后集合
    filteredProjectTasks,
    filteredProjectMembers,
    filteredProjectEpisodes,
    filteredProjectIssues,
    filteredProjectMilestones,
    filteredProjectScripts,
    filteredProjectReviews,
    filteredProjectStoryboards,
    filteredProjectClips,
    filteredProjectAssets,

    // 排序+分页包装
    tasks, members, episodes, issues, milestones, scripts, reviews, storyboards, clips,
  };
}
