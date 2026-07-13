"use client";

import { useState, useCallback, useRef } from "react";
import { api, apiUrl } from "@/lib/api-client";
import {
  buildProjectHealth,
  clipStatuses,
  clipStatusText,
  emptyAssetDraft,
  projectAssetKinds,
  scriptStatusText,
  storyboardStatuses,
  storyboardStatusText,
  workbenchStatusOptions,
} from "@/lib/project-workflow";
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

export function useProjectWorkbench({
  showNotice,
  requestConfirm,
}: {
  showNotice: (message: string) => void;
  requestConfirm: (title: string, description: string, confirmLabel: string, action: () => Promise<void> | void) => void;
}) {
  // Core data states
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

  // UI states
  const [selectedStoryboardIds, setSelectedStoryboardIds] = useState<string[]>([]);
  const [projectWorkbenchTab, setProjectWorkbenchTab] = useState<WorkbenchTab>("overview");
  const [workbenchSearch, setWorkbenchSearch] = useState("");
  const [workbenchStatusFilter, setWorkbenchStatusFilter] = useState("all");
  const [workbenchOwnerFilter, setWorkbenchOwnerFilter] = useState("all");
  const [workbenchPageByTab, setWorkbenchPageByTab] = useState<Partial<Record<WorkbenchTab, number>>>({});

  // Form drafts
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
    episode: 1,
    scene: "1",
    shot: "1",
    title: "",
    description: "",
    dialogue: "",
    characters: "",
    character_asset_ids: [] as string[],
    location: "",
    scene_asset_id: "",
    shot_size: "",
    camera_move: "",
    duration: 5,
    status: "draft" as ProjectStoryboardStatus,
    prompt: "",
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

  // Derived state helpers
  const assetQuery = `kind=${encodeURIComponent(assetKindFilter)}&q=${encodeURIComponent(assetSearch)}&tag=${encodeURIComponent(assetTagFilter)}&favorite=${assetFavoriteOnly ? "true" : "false"}`;
  const assetKindCounts = projectAssetKinds.reduce<Record<string, number>>((counts, kind) => {
    counts[kind.key] = projectAssets.filter((asset) => asset.kind === kind.key).length;
    return counts;
  }, {});
  const currentAssetDraft = assetDrafts[assetComposerKind];
  const characterAssets = projectAssets.filter((asset) => asset.kind === "character");
  const sceneAssets = projectAssets.filter((asset) => asset.kind === "scene");
  const currentWorkbenchStatusOptions = workbenchStatusOptions(projectWorkbenchTab);
  const workbenchOwnerOptions = Array.from(new Set([
    ...projectMembers.map((member) => member.name),
    ...projectTasks.map((task) => task.owner),
    ...projectIssues.map((issue) => issue.owner),
    ...projectMilestones.map((milestone) => milestone.owner),
  ].map((value) => value.trim()).filter(Boolean))).sort((left, right) => left.localeCompare(right, "zh-Hans"));

  function matchesWorkbenchFilters(item: object, textFields: string[], status?: string, owner?: string) {
    const record = item as Record<string, unknown>;
    const keyword = workbenchSearch.trim().toLowerCase();
    const textMatched = !keyword || textFields.some((field) => String(record[field] ?? "").toLowerCase().includes(keyword));
    const statusMatched = workbenchStatusFilter === "all" || !status || status === workbenchStatusFilter;
    const ownerMatched = workbenchOwnerFilter === "all" || !owner || owner === workbenchOwnerFilter;
    return textMatched && statusMatched && ownerMatched;
  }

  function isProjectMissingError(error: unknown) {
    return error instanceof Error && /project not found/i.test(error.message);
  }

  const recoverMissingProject = useCallback(async (error: unknown, callbacks?: { onSetProjectScope?: (scope: string) => void; onSetMode?: (mode: "chat") => void; onLoadProjects?: () => Promise<void>; onLoadConversations?: (preferredId?: string, scope?: string) => Promise<void> }) => {
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
  }, [showNotice]);

  const loadProjectSummary = useCallback(async (projectId: string, projects: Project[], conversations: { filter: (cb: (c: { project_id?: string }) => boolean) => { length: number } }) => {
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
    const rejected = [summaryResult, episodesResult, issuesResult, milestonesResult, scriptsResult, membersResult, reviewsResult, clipsResult, tasksResult, storyboardsResult, assetsResult].find((item) => item.status === "rejected");
    if (rejected?.status === "rejected") {
      const recovered = await recoverMissingProject(rejected.reason);
      if (recovered) return null;
    }
    const summary = summaryResult.status === "fulfilled"
      ? summaryResult.value
      : {
          project: fallbackProject,
          conversations: conversations.filter((c) => c.project_id === projectId).length,
          members: 0,
          episodes: 0,
          issues: 0,
          open_issues: 0,
          milestones: 0,
          open_milestones: 0,
          tasks: 0,
          completed_tasks: 0,
          images: 0,
          videos: 0,
          completed_images: 0,
          completed_videos: 0,
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
  }, [assetQuery, recoverMissingProject, showNotice]);

  // --- Project Plan ---
  const saveProjectPlan = useCallback(async (selectedProject: Project | undefined) => {
    if (!selectedProject) return;
    try {
      showNotice("正在保存项目规划...");
      const updated = await api<Project>(`/api/projects/${selectedProject.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: projectDraft.name ?? selectedProject.name,
          category: projectDraft.category ?? "",
          status: projectDraft.status ?? "策划中",
          description: projectDraft.description ?? "",
          episode_count: Number(projectDraft.episode_count ?? 0),
          owner: projectDraft.owner ?? "",
          due_date: projectDraft.due_date ?? "",
        }),
      });
      setProjectDraft(updated);
      showNotice("项目规划已保存");
      return updated;
    } catch (error) {
      showNotice((error as Error).message || "项目规划保存失败");
    }
  }, [projectDraft, showNotice]);

  // --- Tasks ---
  const createProjectTaskItem = useCallback(async (selectedProject: Project | undefined) => {
    if (!selectedProject) return;
    const title = (taskDraft.title ?? "").trim();
    if (!title) { showNotice("请先输入任务名称"); return; }
    try {
      showNotice("正在添加任务...");
      await api<ProjectTask>(`/api/projects/${selectedProject.id}/tasks`, {
        method: "POST",
        body: JSON.stringify({ ...taskDraft, title, owner: taskDraft.owner || projectMembers[0]?.name || projectDraft.owner || selectedProject.owner || "" }),
      });
      setTaskDraft({ title: "", status: "todo", owner: "", due_date: "", notes: "" });
      showNotice("任务已添加");
    } catch (error) {
      showNotice((error as Error).message || "任务添加失败");
    }
  }, [taskDraft, projectMembers, projectDraft, showNotice]);

  const editProjectTaskItem = useCallback((task: ProjectTask) => {
    setEditingTaskId(task.id);
    setTaskDraft({ title: task.title, status: task.status, owner: task.owner, due_date: task.due_date, notes: task.notes });
  }, []);

  const resetProjectTaskForm = useCallback(() => {
    setEditingTaskId("");
    setTaskDraft({ title: "", status: "todo", owner: "", due_date: "", notes: "" });
  }, []);

  const updateProjectTaskItem = useCallback(async (selectedProject: Project | undefined, task: ProjectTask, patch: Partial<ProjectTask>) => {
    if (!selectedProject) return;
    try {
      await api<ProjectTask>(`/api/projects/${selectedProject.id}/tasks/${task.id}`, { method: "PUT", body: JSON.stringify(patch) });
      showNotice("任务已更新");
    } catch (error) {
      showNotice((error as Error).message || "任务更新失败");
    }
  }, [showNotice]);

  const submitProjectTaskForm = useCallback(async (selectedProject: Project | undefined) => {
    if (!editingTaskId) { await createProjectTaskItem(selectedProject); return; }
    const task = projectTasks.find((item) => item.id === editingTaskId);
    if (!task) { resetProjectTaskForm(); return; }
    const title = (taskDraft.title ?? "").trim();
    if (!title) { showNotice("请先输入任务名称"); return; }
    await updateProjectTaskItem(selectedProject, task, { ...taskDraft, title });
    resetProjectTaskForm();
  }, [editingTaskId, projectTasks, taskDraft, createProjectTaskItem, updateProjectTaskItem, resetProjectTaskForm, showNotice]);

  const deleteProjectTaskItem = useCallback((selectedProject: Project | undefined, task: ProjectTask) => {
    if (!selectedProject) return;
    const projectId = selectedProject.id;
    requestConfirm("删除任务", `确认删除任务"${task.title}"？`, "删除任务", async () => {
      try {
        await api(`/api/projects/${projectId}/tasks/${task.id}`, { method: "DELETE" });
        showNotice("任务已删除");
      } catch (error) {
        showNotice((error as Error).message || "任务删除失败");
      }
    });
  }, [requestConfirm, showNotice]);

  // --- Members ---
  const createProjectMemberItem = useCallback(async (selectedProject: Project | undefined) => {
    if (!selectedProject) return;
    const name = (memberDraft.name ?? "").trim();
    if (!name) { showNotice("请先输入成员姓名"); return; }
    try {
      await api<ProjectMember>(`/api/projects/${selectedProject.id}/members`, { method: "POST", body: JSON.stringify(memberDraft) });
      setMemberDraft({ name: "", role: "导演", contact: "", notes: "" });
      showNotice("成员已添加");
    } catch (error) {
      showNotice((error as Error).message || "成员添加失败");
    }
  }, [memberDraft, showNotice]);

  const updateProjectMemberItem = useCallback(async (selectedProject: Project | undefined, member: ProjectMember, patch: Partial<ProjectMember>) => {
    if (!selectedProject) return;
    try {
      await api<ProjectMember>(`/api/projects/${selectedProject.id}/members/${member.id}`, { method: "PUT", body: JSON.stringify(patch) });
      showNotice("成员已更新");
    } catch (error) {
      showNotice((error as Error).message || "成员更新失败");
    }
  }, [showNotice]);

  const editProjectMemberItem = useCallback((member: ProjectMember) => {
    setEditingMemberId(member.id);
    setMemberDraft({ name: member.name, role: member.role, contact: member.contact, notes: member.notes });
  }, []);

  const resetProjectMemberForm = useCallback(() => {
    setEditingMemberId("");
    setMemberDraft({ name: "", role: "导演", contact: "", notes: "" });
  }, []);

  const submitProjectMemberForm = useCallback(async (selectedProject: Project | undefined) => {
    if (!editingMemberId) { await createProjectMemberItem(selectedProject); return; }
    const member = projectMembers.find((item) => item.id === editingMemberId);
    if (!member) { resetProjectMemberForm(); return; }
    await updateProjectMemberItem(selectedProject, member, memberDraft);
    resetProjectMemberForm();
  }, [editingMemberId, projectMembers, memberDraft, createProjectMemberItem, updateProjectMemberItem, resetProjectMemberForm]);

  const deleteProjectMemberItem = useCallback((selectedProject: Project | undefined, member: ProjectMember) => {
    if (!selectedProject) return;
    const projectId = selectedProject.id;
    requestConfirm("删除成员", `确认删除成员"${member.name}"？历史任务上的负责人名称会保留。`, "删除成员", async () => {
      try {
        await api(`/api/projects/${projectId}/members/${member.id}`, { method: "DELETE" });
        showNotice("成员已删除");
      } catch (error) {
        showNotice((error as Error).message || "成员删除失败");
      }
    });
  }, [requestConfirm, showNotice]);

  // --- Episodes ---
  const createProjectEpisodeItem = useCallback(async (selectedProject: Project | undefined) => {
    if (!selectedProject) return;
    try {
      const created = await api<ProjectEpisode>(`/api/projects/${selectedProject.id}/episodes`, { method: "POST", body: JSON.stringify(episodeDraft) });
      setEpisodeDraft((draft) => ({ ...draft, episode: created.episode + 1, title: "", summary: "", notes: "" }));
      showNotice("剧集已添加");
      return created;
    } catch (error) {
      showNotice((error as Error).message || "剧集添加失败");
    }
  }, [episodeDraft, showNotice]);

  const updateProjectEpisodeItem = useCallback(async (selectedProject: Project | undefined, episode: ProjectEpisode, patch: Partial<ProjectEpisode>) => {
    if (!selectedProject) return;
    try {
      await api<ProjectEpisode>(`/api/projects/${selectedProject.id}/episodes/${episode.id}`, { method: "PUT", body: JSON.stringify(patch) });
      showNotice("剧集已更新");
    } catch (error) {
      showNotice((error as Error).message || "剧集更新失败");
    }
  }, [showNotice]);

  const editProjectEpisodeItem = useCallback((episode: ProjectEpisode) => {
    setEditingEpisodeId(episode.id);
    setEpisodeDraft({ episode: episode.episode, title: episode.title, status: episode.status, summary: episode.summary, due_date: episode.due_date, notes: episode.notes });
  }, []);

  const resetProjectEpisodeForm = useCallback(() => {
    setEditingEpisodeId("");
    setEpisodeDraft({ episode: projectEpisodes.length + 1, title: "", status: "策划中", summary: "", due_date: "", notes: "" });
  }, [projectEpisodes.length]);

  const submitProjectEpisodeForm = useCallback(async (selectedProject: Project | undefined) => {
    if (!editingEpisodeId) { await createProjectEpisodeItem(selectedProject); return; }
    const episode = projectEpisodes.find((item) => item.id === editingEpisodeId);
    if (!episode) { resetProjectEpisodeForm(); return; }
    await updateProjectEpisodeItem(selectedProject, episode, episodeDraft);
    resetProjectEpisodeForm();
  }, [editingEpisodeId, projectEpisodes, episodeDraft, createProjectEpisodeItem, updateProjectEpisodeItem, resetProjectEpisodeForm]);

  const deleteProjectEpisodeItem = useCallback((selectedProject: Project | undefined, episode: ProjectEpisode) => {
    if (!selectedProject) return;
    const projectId = selectedProject.id;
    requestConfirm("删除剧集规划", `确认删除"第${episode.episode}集 ${episode.title}"规划？已生成的剧本、分镜和视频不会被删除。`, "删除剧集", async () => {
      try {
        await api(`/api/projects/${projectId}/episodes/${episode.id}`, { method: "DELETE" });
        showNotice("剧集已删除");
      } catch (error) {
        showNotice((error as Error).message || "剧集删除失败");
      }
    });
  }, [requestConfirm, showNotice]);

  // --- Issues ---
  const createProjectIssueItem = useCallback(async (selectedProject: Project | undefined) => {
    if (!selectedProject) return;
    const title = (issueDraft.title ?? "").trim();
    if (!title) { showNotice("请先输入问题标题"); return; }
    try {
      await api<ProjectIssue>(`/api/projects/${selectedProject.id}/issues`, { method: "POST", body: JSON.stringify({ ...issueDraft, owner: issueDraft.owner || projectMembers[0]?.name || "" }) });
      setIssueDraft({ title: "", severity: "medium", status: "open", owner: "", target_type: "", target_id: "", notes: "" });
      showNotice("问题已添加");
    } catch (error) {
      showNotice((error as Error).message || "问题添加失败");
    }
  }, [issueDraft, projectMembers, showNotice]);

  const updateProjectIssueItem = useCallback(async (selectedProject: Project | undefined, issue: ProjectIssue, patch: Partial<ProjectIssue>) => {
    if (!selectedProject) return;
    try {
      await api<ProjectIssue>(`/api/projects/${selectedProject.id}/issues/${issue.id}`, { method: "PUT", body: JSON.stringify(patch) });
      showNotice("问题已更新");
    } catch (error) {
      showNotice((error as Error).message || "问题更新失败");
    }
  }, [showNotice]);

  const editProjectIssueItem = useCallback((issue: ProjectIssue) => {
    setEditingIssueId(issue.id);
    setIssueDraft({ title: issue.title, severity: issue.severity, status: issue.status, owner: issue.owner, target_type: issue.target_type, target_id: issue.target_id, notes: issue.notes });
  }, []);

  const resetProjectIssueForm = useCallback(() => {
    setEditingIssueId("");
    setIssueDraft({ title: "", severity: "medium", status: "open", owner: "", target_type: "", target_id: "", notes: "" });
  }, []);

  const submitProjectIssueForm = useCallback(async (selectedProject: Project | undefined) => {
    if (!editingIssueId) { await createProjectIssueItem(selectedProject); return; }
    const issue = projectIssues.find((item) => item.id === editingIssueId);
    if (!issue) { resetProjectIssueForm(); return; }
    await updateProjectIssueItem(selectedProject, issue, issueDraft);
    resetProjectIssueForm();
  }, [editingIssueId, projectIssues, issueDraft, createProjectIssueItem, updateProjectIssueItem, resetProjectIssueForm]);

  const deleteProjectIssueItem = useCallback((selectedProject: Project | undefined, issue: ProjectIssue) => {
    if (!selectedProject) return;
    const projectId = selectedProject.id;
    requestConfirm("删除问题", `确认删除问题"${issue.title}"？`, "删除问题", async () => {
      try {
        await api(`/api/projects/${projectId}/issues/${issue.id}`, { method: "DELETE" });
        showNotice("问题已删除");
      } catch (error) {
        showNotice((error as Error).message || "问题删除失败");
      }
    });
  }, [requestConfirm, showNotice]);

  // --- Milestones ---
  const createProjectMilestoneItem = useCallback(async (selectedProject: Project | undefined) => {
    if (!selectedProject) return;
    const title = (milestoneDraft.title ?? "").trim();
    if (!title) { showNotice("请先输入里程碑标题"); return; }
    try {
      await api<ProjectMilestone>(`/api/projects/${selectedProject.id}/milestones`, { method: "POST", body: JSON.stringify({ ...milestoneDraft, owner: milestoneDraft.owner || projectMembers[0]?.name || "" }) });
      setMilestoneDraft({ title: "", status: "planned", owner: "", due_date: "", description: "" });
      showNotice("里程碑已添加");
    } catch (error) {
      showNotice((error as Error).message || "里程碑添加失败");
    }
  }, [milestoneDraft, projectMembers, showNotice]);

  const updateProjectMilestoneItem = useCallback(async (selectedProject: Project | undefined, milestone: ProjectMilestone, patch: Partial<ProjectMilestone>) => {
    if (!selectedProject) return;
    try {
      await api<ProjectMilestone>(`/api/projects/${selectedProject.id}/milestones/${milestone.id}`, { method: "PUT", body: JSON.stringify(patch) });
      showNotice("里程碑已更新");
    } catch (error) {
      showNotice((error as Error).message || "里程碑更新失败");
    }
  }, [showNotice]);

  const editProjectMilestoneItem = useCallback((milestone: ProjectMilestone) => {
    setEditingMilestoneId(milestone.id);
    setMilestoneDraft({ title: milestone.title, status: milestone.status, owner: milestone.owner, due_date: milestone.due_date, description: milestone.description });
  }, []);

  const resetProjectMilestoneForm = useCallback(() => {
    setEditingMilestoneId("");
    setMilestoneDraft({ title: "", status: "planned", owner: "", due_date: "", description: "" });
  }, []);

  const submitProjectMilestoneForm = useCallback(async (selectedProject: Project | undefined) => {
    if (!editingMilestoneId) { await createProjectMilestoneItem(selectedProject); return; }
    const milestone = projectMilestones.find((item) => item.id === editingMilestoneId);
    if (!milestone) { resetProjectMilestoneForm(); return; }
    await updateProjectMilestoneItem(selectedProject, milestone, milestoneDraft);
    resetProjectMilestoneForm();
  }, [editingMilestoneId, projectMilestones, milestoneDraft, createProjectMilestoneItem, updateProjectMilestoneItem, resetProjectMilestoneForm]);

  const deleteProjectMilestoneItem = useCallback((selectedProject: Project | undefined, milestone: ProjectMilestone) => {
    if (!selectedProject) return;
    const projectId = selectedProject.id;
    requestConfirm("删除里程碑", `确认删除里程碑"${milestone.title}"？`, "删除里程碑", async () => {
      try {
        await api(`/api/projects/${projectId}/milestones/${milestone.id}`, { method: "DELETE" });
        showNotice("里程碑已删除");
      } catch (error) {
        showNotice((error as Error).message || "里程碑删除失败");
      }
    });
  }, [requestConfirm, showNotice]);

  // --- Scripts ---
  const createProjectScriptItem = useCallback(async (selectedProject: Project | undefined) => {
    if (!selectedProject) return;
    if (!scriptForm.content.trim()) { showNotice("请先填写剧本正文"); return; }
    try {
      showNotice("正在保存剧本...");
      await api<ProjectScript>(`/api/projects/${selectedProject.id}/scripts`, { method: "POST", body: JSON.stringify(scriptForm) });
      setScriptForm({ episode: scriptForm.episode, title: "", status: "draft", content: "", notes: "" });
      showNotice("剧本已保存");
    } catch (error) {
      showNotice((error as Error).message || "剧本保存失败");
    }
  }, [scriptForm, showNotice]);

  const updateProjectScriptItem = useCallback(async (selectedProject: Project | undefined, script: ProjectScript, patch: Partial<ProjectScript>) => {
    if (!selectedProject) return;
    try {
      await api<ProjectScript>(`/api/projects/${selectedProject.id}/scripts/${script.id}`, { method: "PUT", body: JSON.stringify(patch) });
      showNotice("剧本已更新");
    } catch (error) {
      showNotice((error as Error).message || "剧本更新失败");
    }
  }, [showNotice]);

  const editProjectScriptItem = useCallback((script: ProjectScript) => {
    setEditingScriptId(script.id);
    setScriptForm({ episode: script.episode, title: script.title, status: script.status, content: script.content, notes: script.notes });
  }, []);

  const resetProjectScriptForm = useCallback(() => {
    setEditingScriptId("");
    setScriptForm({ episode: scriptForm.episode, title: "", status: "draft", content: "", notes: "" });
  }, [scriptForm.episode]);

  const submitProjectScriptForm = useCallback(async (selectedProject: Project | undefined) => {
    if (!editingScriptId) { await createProjectScriptItem(selectedProject); return; }
    const script = projectScripts.find((item) => item.id === editingScriptId);
    if (!script) { resetProjectScriptForm(); return; }
    await updateProjectScriptItem(selectedProject, script, scriptForm);
    resetProjectScriptForm();
  }, [editingScriptId, projectScripts, scriptForm, createProjectScriptItem, updateProjectScriptItem, resetProjectScriptForm]);

  const deleteProjectScriptItem = useCallback((selectedProject: Project | undefined, script: ProjectScript) => {
    if (!selectedProject) return;
    const projectId = selectedProject.id;
    requestConfirm("删除剧本", `确认将剧本"${script.title}"移到回收站？30 天内可在回收站恢复或彻底删除。`, "移到回收站", async () => {
      try {
        const result = await api<{ deleted_at: string }>(`/api/projects/${projectId}/scripts/${script.id}`, { method: "DELETE" });
        // 软删后从默认列表移除
        setProjectScripts((items) => items.filter((item) => item.id !== script.id));
        showNotice(`剧本已移到回收站，30 天后自动清理（删除于 ${new Date(result.deleted_at).toLocaleString()}）`);
      } catch (error) {
        showNotice((error as Error).message || "剧本删除失败");
      }
    });
  }, [requestConfirm, showNotice]);

  const restoreProjectScriptItem = useCallback(async (selectedProject: Project | undefined, script: ProjectScript) => {
    if (!selectedProject) return;
    try {
      const restored = await api<ProjectScript>(`/api/projects/${selectedProject.id}/scripts/${script.id}/restore`, { method: "POST" });
      // 从当前 projectScripts 列表移除（如果还在），由 reload 接管
      setProjectScripts((items) => items.filter((item) => item.id !== script.id));
      showNotice(`剧本"${restored.title}"已恢复`);
      return restored;
    } catch (error) {
      showNotice((error as Error).message || "剧本恢复失败");
    }
  }, [showNotice]);

  const purgeProjectScriptItem = useCallback((selectedProject: Project | undefined, script: ProjectScript) => {
    if (!selectedProject) return;
    const projectId = selectedProject.id;
    requestConfirm("彻底删除剧本", `确认彻底删除"${script.title}"？此操作会级联清理剧集、场景、对白、备份等所有关联数据，且不可恢复。`, "彻底删除", async () => {
      try {
        const result = await api<{ script_id: string; cascade: Record<string, number> }>(`/api/projects/${projectId}/scripts/${script.id}/purge`, { method: "DELETE" });
        const total = Object.values(result.cascade ?? {}).reduce((sum, count) => sum + count, 0);
        showNotice(`剧本已彻底清理（联动删除 ${total} 条记录）`);
      } catch (error) {
        showNotice((error as Error).message || "剧本彻底删除失败");
      }
    });
  }, [requestConfirm, showNotice]);

  // 计算回收站剧本距 30 天保留期还差几天（负数表示可彻底删除）
  const scriptRecycleBinRemainingDays = useCallback((deletedAt: string | undefined): number => {
    if (!deletedAt) return 0;
    const deletedTime = new Date(deletedAt).getTime();
    if (Number.isNaN(deletedTime)) return 0;
    const graceMs = 30 * 24 * 60 * 60 * 1000;
    return Math.ceil((deletedTime + graceMs - Date.now()) / (24 * 60 * 60 * 1000));
  }, []);

  const breakdownSavedScript = useCallback(async (selectedProject: Project | undefined, script: ProjectScript) => {
    if (!selectedProject) return;
    try {
      showNotice("正在从剧本生成分镜...");
      const created = await api<ProjectStoryboard[]>(`/api/projects/${selectedProject.id}/storyboards/breakdown`, { method: "POST", body: JSON.stringify({ script_id: script.id }) });
      setProjectWorkbenchTab("storyboards");
      showNotice(`已生成 ${created.length} 条分镜`);
      return created;
    } catch (error) {
      showNotice((error as Error).message || "剧本拆分失败");
    }
  }, [showNotice]);

  // --- Reviews ---
  const createStoryboardReview = useCallback(async (selectedProject: Project | undefined, storyboard: ProjectStoryboard) => {
    if (!selectedProject) return;
    const comment = (reviewDrafts[storyboard.id] ?? "").trim();
    if (!comment) { showNotice("请先填写审核意见"); return; }
    try {
      await api<ProjectReview>(`/api/projects/${selectedProject.id}/reviews`, {
        method: "POST",
        body: JSON.stringify({ target_type: "storyboard", target_id: storyboard.id, comment, reviewer: "导演" }),
      });
      if (storyboard.status !== "review") await updateProjectStoryboardItem(selectedProject, storyboard, { status: "review" });
      setReviewDrafts((drafts) => ({ ...drafts, [storyboard.id]: "" }));
      showNotice("审核意见已添加");
    } catch (error) {
      showNotice((error as Error).message || "审核意见添加失败");
    }
  }, [reviewDrafts, showNotice]);

  const updateProjectReviewItem = useCallback(async (selectedProject: Project | undefined, review: ProjectReview, patch: Partial<ProjectReview>) => {
    if (!selectedProject) return;
    try {
      await api<ProjectReview>(`/api/projects/${selectedProject.id}/reviews/${review.id}`, { method: "PUT", body: JSON.stringify(patch) });
      showNotice("审核意见已更新");
    } catch (error) {
      showNotice((error as Error).message || "审核意见更新失败");
    }
  }, [showNotice]);

  const deleteProjectReviewItem = useCallback(async (selectedProject: Project | undefined, review: ProjectReview) => {
    if (!selectedProject) return;
    try {
      await api(`/api/projects/${selectedProject.id}/reviews/${review.id}`, { method: "DELETE" });
      showNotice("审核意见已删除");
    } catch (error) {
      showNotice((error as Error).message || "审核意见删除失败");
    }
  }, [showNotice]);

  const reviewTargetLabel = useCallback((review: ProjectReview) => {
    if (review.target_type === "storyboard") {
      const storyboard = projectStoryboards.find((item) => item.id === review.target_id);
      return storyboard ? `分镜：第${storyboard.episode}集 ${storyboard.scene}-${storyboard.shot} ${storyboard.title}` : "分镜：已删除";
    }
    if (review.target_type === "clip") {
      const clip = projectClips.find((item) => item.id === review.target_id);
      return clip ? `剪辑：第${clip.episode}集 ${clip.scene}-${clip.shot} ${clip.title}` : "剪辑：已删除";
    }
    if (review.target_type === "asset") {
      const asset = projectAssets.find((item) => item.id === review.target_id);
      return asset ? `资产：${asset.name}` : "资产：已删除";
    }
    return `${review.target_type}：${review.target_id}`;
  }, [projectStoryboards, projectClips, projectAssets]);

  // --- Storyboards ---
  const createProjectStoryboardItem = useCallback(async (selectedProject: Project | undefined) => {
    if (!selectedProject) return;
    const title = storyboardDraft.title.trim() || `第${storyboardDraft.episode}集 ${storyboardDraft.scene}-${storyboardDraft.shot}`;
    try {
      if (editingStoryboardId) {
        showNotice("正在保存分镜...");
        await api<ProjectStoryboard>(`/api/projects/${selectedProject.id}/storyboards/${editingStoryboardId}`, {
          method: "PUT",
          body: JSON.stringify({ ...storyboardDraft, title, characters: storyboardDraft.characters.split(",").map((item) => item.trim()).filter(Boolean) }),
        });
        setEditingStoryboardId("");
        setStoryboardDraft((draft) => ({ ...draft, title: "", description: "", dialogue: "", prompt: "", character_asset_ids: [], scene_asset_id: "" }));
        showNotice("分镜已保存");
        return;
      }
      showNotice("正在添加分镜...");
      await api<ProjectStoryboard>(`/api/projects/${selectedProject.id}/storyboards`, {
        method: "POST",
        body: JSON.stringify({ ...storyboardDraft, title, characters: storyboardDraft.characters.split(",").map((item) => item.trim()).filter(Boolean) }),
      });
      setStoryboardDraft((draft) => ({ ...draft, shot: String(Number(draft.shot || 0) + 1), title: "", description: "", dialogue: "", prompt: "", character_asset_ids: [], scene_asset_id: "" }));
      showNotice("分镜已添加");
    } catch (error) {
      showNotice((error as Error).message || "分镜添加失败");
    }
  }, [storyboardDraft, editingStoryboardId, showNotice]);

  const editProjectStoryboard = useCallback((storyboard: ProjectStoryboard) => {
    setEditingStoryboardId(storyboard.id);
    setStoryboardDraft({
      episode: storyboard.episode,
      scene: storyboard.scene,
      shot: storyboard.shot,
      title: storyboard.title,
      description: storyboard.description,
      dialogue: storyboard.dialogue,
      characters: storyboard.characters.join(", "),
      character_asset_ids: storyboard.character_asset_ids ?? [],
      location: storyboard.location,
      scene_asset_id: storyboard.scene_asset_id,
      shot_size: storyboard.shot_size,
      camera_move: storyboard.camera_move,
      duration: storyboard.duration,
      status: storyboard.status,
      prompt: storyboard.prompt,
    });
    showNotice("已载入分镜，可在上方表单修改");
  }, []);

  const updateProjectStoryboardItem = useCallback(async (selectedProject: Project | undefined, storyboard: ProjectStoryboard, patch: Partial<ProjectStoryboard>) => {
    if (!selectedProject) return;
    try {
      await api<ProjectStoryboard>(`/api/projects/${selectedProject.id}/storyboards/${storyboard.id}`, { method: "PUT", body: JSON.stringify(patch) });
      showNotice("分镜已更新");
    } catch (error) {
      showNotice((error as Error).message || "分镜更新失败");
    }
  }, [showNotice]);

  const toggleStoryboardSelection = useCallback((storyboardId: string) => {
    setSelectedStoryboardIds((ids) => ids.includes(storyboardId) ? ids.filter((id) => id !== storyboardId) : [...ids, storyboardId]);
  }, []);

  const batchUpdateStoryboards = useCallback(async (selectedProject: Project | undefined, status: ProjectStoryboardStatus) => {
    if (!selectedProject) return;
    if (selectedStoryboardIds.length === 0) { showNotice("请先选择分镜"); return; }
    try {
      await api<ProjectStoryboard[]>(`/api/projects/${selectedProject.id}/storyboards/batch`, { method: "POST", body: JSON.stringify({ ids: selectedStoryboardIds, status }) });
      showNotice(status === "review" ? "已批量送审" : "已批量更新分镜");
    } catch (error) {
      showNotice((error as Error).message || "批量更新失败");
    }
  }, [selectedStoryboardIds, showNotice]);

  const deleteProjectStoryboardItem = useCallback((selectedProject: Project | undefined, storyboard: ProjectStoryboard) => {
    if (!selectedProject) return;
    const projectId = selectedProject.id;
    requestConfirm("删除分镜", `确认删除分镜"${storyboard.title}"？`, "删除分镜", async () => {
      try {
        await api(`/api/projects/${projectId}/storyboards/${storyboard.id}`, { method: "DELETE" });
        showNotice("分镜已删除");
      } catch (error) {
        showNotice((error as Error).message || "分镜删除失败");
      }
    });
  }, [requestConfirm, showNotice]);

  const breakdownScriptToStoryboards = useCallback(async (selectedProject: Project | undefined) => {
    if (!selectedProject) return;
    const script = scriptDraft.trim();
    if (!script) { showNotice("请先粘贴剧本文本"); return; }
    try {
      showNotice("正在拆分剧本...");
      const created = await api<ProjectStoryboard[]>(`/api/projects/${selectedProject.id}/storyboards/breakdown`, { method: "POST", body: JSON.stringify({ script, episode: storyboardDraft.episode }) });
      setScriptDraft("");
      showNotice(`已生成 ${created.length} 条分镜`);
      return created;
    } catch (error) {
      showNotice((error as Error).message || "剧本拆分失败");
    }
  }, [scriptDraft, storyboardDraft.episode, showNotice]);

  // --- Clips ---
  const syncProjectClips = useCallback(async (selectedProject: Project | undefined) => {
    if (!selectedProject) return;
    try {
      const created = await api<ProjectClip[]>(`/api/projects/${selectedProject.id}/clips/sync`, { method: "POST" });
      showNotice(created.length ? `已同步 ${created.length} 条剪辑` : "没有新的可同步视频分镜");
      return created;
    } catch (error) {
      showNotice((error as Error).message || "剪辑同步失败");
    }
  }, [showNotice]);

  const createProjectClipItem = useCallback(async (selectedProject: Project | undefined) => {
    if (!selectedProject) return;
    const title = (clipDraft.title ?? "").trim() || `第${clipDraft.episode}集 ${clipDraft.scene}-${clipDraft.shot}`;
    try {
      await api<ProjectClip>(`/api/projects/${selectedProject.id}/clips`, { method: "POST", body: JSON.stringify({ ...clipDraft, title }) });
      setClipDraft((draft) => ({ ...draft, shot: String(Number(draft.shot || 0) + 1), title: "", source_video_url: "", in_point: "", out_point: "", notes: "" }));
      showNotice("剪辑条目已添加");
    } catch (error) {
      showNotice((error as Error).message || "剪辑添加失败");
    }
  }, [clipDraft, showNotice]);

  const updateProjectClipItem = useCallback(async (selectedProject: Project | undefined, clip: ProjectClip, patch: Partial<ProjectClip>) => {
    if (!selectedProject) return;
    try {
      await api<ProjectClip>(`/api/projects/${selectedProject.id}/clips/${clip.id}`, { method: "PUT", body: JSON.stringify(patch) });
      showNotice("剪辑条目已更新");
    } catch (error) {
      showNotice((error as Error).message || "剪辑更新失败");
    }
  }, [showNotice]);

  const editProjectClipItem = useCallback((clip: ProjectClip) => {
    setEditingClipId(clip.id);
    setClipDraft({
      episode: clip.episode, scene: clip.scene, shot: clip.shot, title: clip.title,
      source_video_url: clip.source_video_url, duration: clip.duration,
      in_point: clip.in_point, out_point: clip.out_point, order_index: clip.order_index,
      status: clip.status, notes: clip.notes,
    });
  }, []);

  const resetProjectClipForm = useCallback(() => {
    setEditingClipId("");
    setClipDraft((draft) => ({ ...draft, title: "", source_video_url: "", in_point: "", out_point: "", status: "todo", notes: "" }));
  }, []);

  const submitProjectClipForm = useCallback(async (selectedProject: Project | undefined) => {
    if (!editingClipId) { await createProjectClipItem(selectedProject); return; }
    const clip = projectClips.find((item) => item.id === editingClipId);
    if (!clip) { resetProjectClipForm(); return; }
    const title = (clipDraft.title ?? "").trim() || `第${clipDraft.episode}集 ${clipDraft.scene}-${clipDraft.shot}`;
    await updateProjectClipItem(selectedProject, clip, { ...clipDraft, title });
    resetProjectClipForm();
  }, [editingClipId, projectClips, clipDraft, createProjectClipItem, updateProjectClipItem, resetProjectClipForm]);

  const deleteProjectClipItem = useCallback((selectedProject: Project | undefined, clip: ProjectClip) => {
    if (!selectedProject) return;
    const projectId = selectedProject.id;
    requestConfirm("删除剪辑条目", `确认删除剪辑"${clip.title}"？原始分镜和视频文件不会被删除。`, "删除剪辑", async () => {
      try {
        await api(`/api/projects/${projectId}/clips/${clip.id}`, { method: "DELETE" });
        showNotice("剪辑条目已删除");
      } catch (error) {
        showNotice((error as Error).message || "剪辑删除失败");
      }
    });
  }, [requestConfirm, showNotice]);

  // --- Exports ---
  const downloadStoryboardCsv = useCallback((selectedProject: Project | undefined) => {
    if (!selectedProject) return;
    window.open(apiUrl(`/api/projects/${selectedProject.id}/exports/storyboards.csv`), "_blank", "noopener,noreferrer");
  }, []);

  const downloadProjectExport = useCallback((selectedProject: Project | undefined, file: "scripts.txt" | "edit-list.csv" | "manifest.json") => {
    if (!selectedProject) return;
    window.open(apiUrl(`/api/projects/${selectedProject.id}/exports/${file}`), "_blank", "noopener,noreferrer");
  }, []);

  const generateProjectPackageIndex = useCallback(async (selectedProject: Project | undefined) => {
    if (!selectedProject) return;
    try {
      const result = await api<{ path: string; files: string[] }>(`/api/projects/${selectedProject.id}/exports/package`, { method: "POST" });
      showNotice(`交付包索引已生成：${result.path}`);
    } catch (error) {
      showNotice((error as Error).message || "交付包索引生成失败");
    }
  }, [showNotice]);

  // --- Storyboard Generation ---
  const storyboardGenerationPrompt = useCallback((storyboard: ProjectStoryboard) => {
    const boundCharacters = characterAssets.filter((asset) => storyboard.character_asset_ids?.includes(asset.id));
    const boundScene = sceneAssets.find((asset) => asset.id === storyboard.scene_asset_id);
    return [
      storyboard.prompt || storyboard.description || storyboard.title,
      boundCharacters.length > 0 ? `角色资产：${boundCharacters.map((asset) => [asset.name, asset.prompt, asset.role_traits?.join("、")].filter(Boolean).join("，")).join("\n")}` : "",
      boundScene ? `场景资产：${[boundScene.name, boundScene.prompt, boundScene.style_keywords?.join("、")].filter(Boolean).join("，")}` : "",
    ].filter(Boolean).join("\n");
  }, [characterAssets, sceneAssets]);

  const useStoryboardForGeneration = useCallback((selectedProject: Project | undefined, storyboard: ProjectStoryboard, targetMode: "image" | "video") => {
    activeStoryboardRef.current = { id: storyboard.id, mode: targetMode };
    const boundCharacters = characterAssets.filter((asset) => storyboard.character_asset_ids?.includes(asset.id));
    const boundScene = sceneAssets.find((asset) => asset.id === storyboard.scene_asset_id);
    const referenceUrls = [
      ...(targetMode === "video" && storyboard.image_url ? [storyboard.image_url] : []),
      ...boundCharacters.flatMap(projectAssetReferenceUrls),
      ...(boundScene ? projectAssetReferenceUrls(boundScene) : []),
    ].filter(Boolean).slice(0, 8);
    return {
      prompt: storyboardGenerationPrompt(storyboard),
      attachments: referenceUrls.map((url, index) => ({
        id: crypto.randomUUID(),
        name: index === 0 && targetMode === "video" ? storyboard.title : `分镜参考图 ${index + 1}`,
        size: 0,
        previewUrl: url,
        url,
        status: "success" as const,
      })),
      mode: targetMode,
      notice: targetMode === "video" ? "已带入分镜底图和视频提示词" : "已带入分镜图片提示词",
    };
  }, [characterAssets, sceneAssets, storyboardGenerationPrompt]);

  // --- Assets ---
  const createProjectAssetItem = useCallback(async (selectedProject: Project | undefined, kind: ProjectAssetKind = assetComposerKind) => {
    if (!selectedProject) return;
    const draft = assetDrafts[kind];
    const name = draft.name.trim() || draft.prompt.trim().slice(0, 24) || "新资产";
    try {
      showNotice("正在加入资产库...");
      await api<ProjectAsset>(`/api/projects/${selectedProject.id}/assets`, {
        method: "POST",
        body: JSON.stringify({ ...draft, kind, name, tags: draft.tags, role_traits: draft.role_traits, style_keywords: draft.style_keywords }),
      });
      setAssetDrafts((items) => ({ ...items, [kind]: { ...emptyAssetDraft } }));
      showNotice("资产已添加");
    } catch (error) {
      showNotice((error as Error).message || "资产添加失败");
    }
  }, [assetDrafts, assetComposerKind, showNotice]);

  const editProjectAssetItem = useCallback((asset: ProjectAsset) => {
    setEditingAssetId(asset.id);
    setAssetComposerKind(asset.kind);
    setAssetDrafts((items) => ({
      ...items,
      [asset.kind]: {
        name: asset.name,
        prompt: asset.prompt,
        image_url: asset.image_url,
        video_url: asset.video_url,
        folder: asset.folder,
        tags: (asset.tags ?? []).join(", "),
        resolution: asset.resolution,
        duration: asset.duration,
        role_traits: (asset.role_traits ?? []).join(", "),
        style_keywords: (asset.style_keywords ?? []).join(", "),
        notes: asset.notes,
      },
    }));
  }, []);

  const resetProjectAssetForm = useCallback((kind: ProjectAssetKind = assetComposerKind) => {
    setEditingAssetId("");
    setAssetDrafts((items) => ({ ...items, [kind]: { ...emptyAssetDraft } }));
  }, [assetComposerKind]);

  const submitProjectAssetForm = useCallback(async (selectedProject: Project | undefined) => {
    if (!editingAssetId) { await createProjectAssetItem(selectedProject); return; }
    if (!selectedProject) return;
    const asset = projectAssets.find((item) => item.id === editingAssetId);
    if (!asset) { resetProjectAssetForm(); return; }
    const draft = assetDrafts[assetComposerKind];
    const name = draft.name.trim() || draft.prompt.trim().slice(0, 24) || "新资产";
    try {
      showNotice("正在保存资产...");
      await api<ProjectAsset>(`/api/projects/${selectedProject.id}/assets/${asset.id}`, {
        method: "PUT",
        body: JSON.stringify({ ...draft, kind: assetComposerKind, name, tags: draft.tags, role_traits: draft.role_traits, style_keywords: draft.style_keywords }),
      });
      resetProjectAssetForm(assetComposerKind);
      showNotice("资产已保存");
    } catch (error) {
      showNotice((error as Error).message || "资产保存失败");
    }
  }, [editingAssetId, assetComposerKind, assetDrafts, projectAssets, createProjectAssetItem, resetProjectAssetForm, showNotice]);

  const deleteProjectAssetItem = useCallback((selectedProject: Project | undefined, asset: ProjectAsset) => {
    if (!selectedProject) return;
    const projectId = selectedProject.id;
    requestConfirm("删除资产", `确认删除资产"${asset.name}"？`, "删除资产", async () => {
      try {
        await api(`/api/projects/${projectId}/assets/${asset.id}`, { method: "DELETE" });
        showNotice("资产已删除");
      } catch (error) {
        showNotice((error as Error).message || "资产删除失败");
      }
    });
  }, [requestConfirm, showNotice]);

  const toggleProjectAssetFavorite = useCallback(async (selectedProject: Project | undefined, asset: ProjectAsset) => {
    if (!selectedProject) return;
    try {
      await api<ProjectAsset>(`/api/projects/${selectedProject.id}/assets/${asset.id}`, { method: "PUT", body: JSON.stringify({ is_favorite: !asset.is_favorite }) });
      showNotice(asset.is_favorite ? "已取消收藏资产" : "已收藏资产");
    } catch (error) {
      showNotice((error as Error).message || "资产收藏更新失败");
    }
  }, [showNotice]);

  const projectAssetReferenceUrls = useCallback((asset: ProjectAsset) => {
    return [asset.image_url, ...(asset.role_images ?? [])].filter(Boolean);
  }, []);

  const reuseProjectAsset = useCallback((asset: ProjectAsset, currentMode: string) => {
    const urls = projectAssetReferenceUrls(asset);
    const nextMode = currentMode === "video" ? "video" : asset.kind === "video" && asset.video_url ? "video" : "image";
    return {
      prompt: asset.prompt,
      attachments: urls.length > 0 ? urls.slice(0, 8).map((url) => ({
        id: crypto.randomUUID(),
        name: asset.name,
        size: 0,
        previewUrl: url,
        url,
        status: "success" as const,
      })) : [],
      mode: nextMode,
      notice: nextMode === "video" ? "已作为视频参考素材" : "已应用到生成输入",
    };
  }, [projectAssetReferenceUrls]);

  // --- Generated Asset Dialog ---
  const addGeneratedImageToAsset = useCallback((task: ImageTask, imageUrl: string, selectedProject: Project | undefined, projects: Project[], conversations: { find: (cb: (c: { id?: string; project_id?: string }) => boolean) => { project_id?: string } | undefined }) => {
    const currentConversation = conversations.find((c) => c.id === task.conversation_id);
    const targetProject = selectedProject ?? projects.find((p) => p.id === currentConversation?.project_id);
    if (!targetProject) { showNotice("请先选择图片所属项目"); return; }
    setGeneratedAssetDialog({ task, imageUrl, projectId: targetProject.id, kind: "image", name: task.prompt.slice(0, 24) || "生成图片" });
  }, [showNotice]);

  const submitGeneratedAssetDialog = useCallback(async (projectScope: string) => {
    if (!generatedAssetDialog) return;
    const name = generatedAssetDialog.name.trim();
    if (!name) { showNotice("请填写资产名称"); return; }
    await api<ProjectAsset>(`/api/projects/${generatedAssetDialog.projectId}/assets`, {
      method: "POST",
      body: JSON.stringify({ kind: generatedAssetDialog.kind, name, prompt: generatedAssetDialog.task.prompt, image_url: generatedAssetDialog.imageUrl, folder: "生成图片", tags: ["生成图"] }),
    });
    setGeneratedAssetDialog(null);
    showNotice("已加入资产库");
  }, [generatedAssetDialog, showNotice]);

  // --- Refresh ---
  const refreshProjectWorkbench = useCallback(async (selectedProject: Project | undefined) => {
    if (!selectedProject) return;
    showNotice("正在刷新项目工作台...");
    showNotice("项目工作台已刷新");
  }, [showNotice]);

  // --- URL Sync ---
  const syncProjectWorkspaceUrl = useCallback((tab: WorkbenchTab, projectId: string, replace = false) => {
    if (typeof window === "undefined" || !projectId || projectId === "all") return;
    const url = new URL(window.location.href);
    url.searchParams.delete("conversationId");
    url.searchParams.set("projectId", projectId);
    url.searchParams.set("workspace", tab);
    window.history[replace ? "replaceState" : "pushState"]({}, "", url);
  }, []);

  const clearProjectWorkspaceUrl = useCallback(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.delete("projectId");
    url.searchParams.delete("workspace");
    window.history.replaceState({}, "", url);
  }, []);

  const openWorkbenchPage = useCallback((tab: WorkbenchTab) => {
    setProjectWorkbenchTab(tab);
    setWorkbenchStatusFilter("all");
  }, []);

  // --- Derived computed values ---
  const projectHealth = projectSummary
    ? buildProjectHealth({ summary: projectSummary, issues: projectIssues, milestones: projectMilestones, tasks: projectTasks, storyboards: projectStoryboards, assets: projectAssets, reviews: projectReviews })
    : null;

  const filteredProjectMembers = projectMembers.filter((member) => matchesWorkbenchFilters(member, ["name", "role", "contact", "notes"], undefined, member.name));
  const filteredProjectEpisodes = projectEpisodes.filter((episode) => matchesWorkbenchFilters(episode, ["title", "summary", "notes"], episode.status));
  const filteredProjectIssues = projectIssues.filter((issue) => matchesWorkbenchFilters(issue, ["title", "notes", "target_type", "target_id"], issue.status, issue.owner));
  const filteredProjectMilestones = projectMilestones.filter((milestone) => matchesWorkbenchFilters(milestone, ["title", "description"], milestone.status, milestone.owner));
  const filteredProjectScripts = projectScripts.filter((script) => matchesWorkbenchFilters(script, ["title", "content", "notes"], script.status));
  const filteredProjectStoryboards = projectStoryboards.filter((storyboard) => matchesWorkbenchFilters(storyboard, ["title", "description", "dialogue", "characters", "location", "prompt", "notes"], storyboard.status));
  const filteredProjectClips = projectClips.filter((clip) => matchesWorkbenchFilters(clip, ["title", "scene", "shot", "notes"], clip.status));
  const filteredProjectReviews = projectReviews.filter((review) => matchesWorkbenchFilters(review, ["comment", "target_type", "target_id"], review.status, review.reviewer));
  const filteredProjectTasks = projectTasks.filter((task) => matchesWorkbenchFilters(task, ["title", "notes"], task.status, task.owner));

  const normalizedAssetSearch = assetSearch.trim().toLowerCase();
  const normalizedAssetTag = assetTagFilter.trim().toLowerCase();
  const filteredProjectAssets = projectAssets.filter((asset) => {
    const text = [asset.name, asset.prompt, asset.folder, asset.resolution, asset.duration, asset.notes, ...(asset.tags ?? []), ...(asset.role_traits ?? []), ...(asset.style_keywords ?? [])].join(" ").toLowerCase();
    const tagText = (asset.tags ?? []).join(" ").toLowerCase();
    return (assetKindFilter === "all" || asset.kind === assetKindFilter)
      && (!normalizedAssetSearch || text.includes(normalizedAssetSearch))
      && (!normalizedAssetTag || tagText.includes(normalizedAssetTag))
      && (!assetFavoriteOnly || asset.is_favorite);
  });

  const sortedFilteredProjectIssues = [...filteredProjectIssues].sort((left, right) => {
    const severityWeight = { critical: 0, high: 1, medium: 2, low: 3 };
    const statusWeight = { open: 0, doing: 1, resolved: 2, closed: 3 };
    return statusWeight[left.status] - statusWeight[right.status] || severityWeight[left.severity] - severityWeight[right.severity];
  });
  const sortedFilteredProjectMilestones = [...filteredProjectMilestones].sort((left, right) => (left.due_date || "9999-12-31").localeCompare(right.due_date || "9999-12-31"));
  const sortedFilteredProjectClips = [...filteredProjectClips].sort((left, right) => left.order_index - right.order_index || left.episode - right.episode);
  const sortedFilteredProjectReviews = [...filteredProjectReviews].sort((left, right) => {
    const weight = { open: 0, rejected: 1, resolved: 2 };
    return weight[left.status] - weight[right.status] || right.created_at.localeCompare(left.created_at);
  });

  const currentWorkbenchPageNumber = workbenchPageByTab[projectWorkbenchTab] ?? 1;
  const workbenchPageSize = projectWorkbenchTab === "assets" ? 12 : 8;
  const setCurrentWorkbenchPage = useCallback((page: number) => setWorkbenchPageByTab((pages) => ({ ...pages, [projectWorkbenchTab]: Math.max(1, page) })), [projectWorkbenchTab]);
  const paginateWorkbench = useCallback(<T,>(items: T[]) => {
    const pageCount = Math.max(1, Math.ceil(items.length / workbenchPageSize));
    const safePage = Math.min(Math.max(currentWorkbenchPageNumber, 1), pageCount);
    return items.slice((safePage - 1) * workbenchPageSize, safePage * workbenchPageSize);
  }, [currentWorkbenchPageNumber, workbenchPageSize]);

  const pagedProjectMembers = paginateWorkbench(filteredProjectMembers);
  const pagedProjectEpisodes = paginateWorkbench(filteredProjectEpisodes);
  const pagedProjectIssues = paginateWorkbench(sortedFilteredProjectIssues);
  const pagedProjectMilestones = paginateWorkbench(sortedFilteredProjectMilestones);
  const pagedProjectScripts = paginateWorkbench(filteredProjectScripts);
  const pagedProjectStoryboards = paginateWorkbench(filteredProjectStoryboards);
  const pagedProjectClips = paginateWorkbench(sortedFilteredProjectClips);
  const pagedProjectReviews = paginateWorkbench(sortedFilteredProjectReviews);
  const pagedProjectTasks = paginateWorkbench(filteredProjectTasks);
  const pagedProjectAssets = paginateWorkbench(filteredProjectAssets);

  const workbenchFilteredCountByTab: Record<WorkbenchTab, number> = {
    overview: 0,
    members: filteredProjectMembers.length,
    episodes: filteredProjectEpisodes.length,
    issues: filteredProjectIssues.length,
    milestones: filteredProjectMilestones.length,
    scripts: filteredProjectScripts.length,
    storyboards: filteredProjectStoryboards.length,
    clips: filteredProjectClips.length,
    reviews: filteredProjectReviews.length,
    tasks: filteredProjectTasks.length,
    assets: filteredProjectAssets.length,
    exports: 0,
  };

  const openIssueCount = projectIssues.filter((issue) => issue.status !== "resolved" && issue.status !== "closed").length;
  const pendingReviewCount = projectReviews.filter((review) => review.status === "open" || review.status === "rejected").length;
  const completedTaskCount = projectTasks.filter((task) => task.status === "done").length;

  const productionProgressItems = [
    projectScripts.length > 0,
    projectStoryboards.length > 0,
    projectAssets.length > 0,
    projectClips.length > 0,
    projectReviews.length > 0 && pendingReviewCount === 0,
    projectSummary ? projectSummary.completed_videos > 0 : false,
  ];
  const productionProgress = Math.round((productionProgressItems.filter(Boolean).length / productionProgressItems.length) * 100);
  const nextMilestone = [...projectMilestones].filter((milestone) => milestone.status !== "done").sort((left, right) => (left.due_date || "9999").localeCompare(right.due_date || "9999"))[0];

  const workbenchPages: Array<{ key: WorkbenchTab; label: string; description: string; metric: string }> = [
    { key: "scripts", label: "剧本", description: "分集剧本、拆分镜入口", metric: `${projectScripts.length} 个剧本` },
    { key: "storyboards", label: "分镜", description: "镜头、角色、场景、提示词", metric: `${projectStoryboards.length} 条分镜` },
    { key: "assets", label: "资产", description: "角色、场景、风格、底图", metric: `${projectAssets.length} 个资产` },
    { key: "clips", label: "剪辑", description: "剪辑清单、入点出点、顺序", metric: `${projectClips.length} 个片段` },
    { key: "reviews", label: "审核", description: "返工点、通过意见、处理状态", metric: `${projectReviews.filter((review) => review.status === "open").length} 条待处理` },
    { key: "exports", label: "交付", description: "剧本、分镜、剪辑、项目清单", metric: "导出文件" },
  ];

  const productionStageRows = workbenchPages.map((page, index) => {
    const stageReady = page.key === "exports" ? productionProgress >= 80 : Boolean(productionProgressItems[index]);
    const actionText: Record<WorkbenchTab, string> = {
      overview: "查看总览",
      members: "配置团队",
      episodes: "规划剧集",
      issues: "处理问题",
      milestones: "维护节点",
      tasks: "打开看板",
      scripts: projectScripts.length > 0 ? "继续打磨剧本" : "先创建剧本",
      storyboards: projectStoryboards.length > 0 ? "维护分镜表" : "由剧本拆分镜",
      assets: projectAssets.length > 0 ? "整理资产包" : "建立角色/场景资产",
      clips: projectClips.length > 0 ? "维护剪辑清单" : "从分镜同步片段",
      reviews: pendingReviewCount > 0 ? "处理返工意见" : "建立审核记录",
      exports: stageReady ? "生成交付包" : "补齐前置材料",
    };
    return { ...page, step: index + 1, ready: stageReady, progress: stageReady ? 100 : Math.max(18, Math.min(72, index * 11 + 24)), action: actionText[page.key] };
  });

  const supportWorkbenchPages: Array<{ key: WorkbenchTab; label: string; metric: string }> = [
    { key: "members", label: "团队", metric: `${projectMembers.length}` },
    { key: "episodes", label: "剧集", metric: `${projectEpisodes.length}` },
    { key: "issues", label: "问题", metric: `${projectIssues.filter((issue) => issue.status !== "resolved" && issue.status !== "closed").length}/${projectIssues.length}` },
    { key: "milestones", label: "里程碑", metric: `${projectMilestones.filter((milestone) => milestone.status !== "done").length}/${projectMilestones.length}` },
    { key: "tasks", label: "任务", metric: `${projectTasks.filter((task) => task.status === "done").length}/${projectTasks.length}` },
  ];

  const currentWorkbenchPage = [...workbenchPages, ...supportWorkbenchPages, { key: "overview" as WorkbenchTab, label: "项目首页", metric: "" }]
    .find((page) => page.key === projectWorkbenchTab);

  return {
    // Core data
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

    // UI states
    selectedStoryboardIds, setSelectedStoryboardIds,
    projectWorkbenchTab, setProjectWorkbenchTab,
    workbenchSearch, setWorkbenchSearch,
    workbenchStatusFilter, setWorkbenchStatusFilter,
    workbenchOwnerFilter, setWorkbenchOwnerFilter,
    workbenchPageByTab, setWorkbenchPageByTab,

    // Form drafts
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

    // Derived helpers
    assetQuery,
    assetKindCounts,
    currentAssetDraft,
    characterAssets,
    sceneAssets,
    currentWorkbenchStatusOptions,
    workbenchOwnerOptions,
    matchesWorkbenchFilters,

    // Core functions
    recoverMissingProject,
    loadProjectSummary,
    saveProjectPlan,

    // Tasks
    createProjectTaskItem,
    editProjectTaskItem,
    resetProjectTaskForm,
    updateProjectTaskItem,
    submitProjectTaskForm,
    deleteProjectTaskItem,

    // Members
    createProjectMemberItem,
    updateProjectMemberItem,
    editProjectMemberItem,
    resetProjectMemberForm,
    submitProjectMemberForm,
    deleteProjectMemberItem,

    // Episodes
    createProjectEpisodeItem,
    updateProjectEpisodeItem,
    editProjectEpisodeItem,
    resetProjectEpisodeForm,
    submitProjectEpisodeForm,
    deleteProjectEpisodeItem,

    // Issues
    createProjectIssueItem,
    updateProjectIssueItem,
    editProjectIssueItem,
    resetProjectIssueForm,
    submitProjectIssueForm,
    deleteProjectIssueItem,

    // Milestones
    createProjectMilestoneItem,
    updateProjectMilestoneItem,
    editProjectMilestoneItem,
    resetProjectMilestoneForm,
    submitProjectMilestoneForm,
    deleteProjectMilestoneItem,

    // Scripts
    createProjectScriptItem,
    updateProjectScriptItem,
    editProjectScriptItem,
    resetProjectScriptForm,
    submitProjectScriptForm,
    deleteProjectScriptItem,
    restoreProjectScriptItem,
    purgeProjectScriptItem,
    scriptRecycleBinRemainingDays,
    breakdownSavedScript,

    // Reviews
    createStoryboardReview,
    updateProjectReviewItem,
    deleteProjectReviewItem,
    reviewTargetLabel,

    // Storyboards
    createProjectStoryboardItem,
    editProjectStoryboard,
    updateProjectStoryboardItem,
    toggleStoryboardSelection,
    batchUpdateStoryboards,
    deleteProjectStoryboardItem,
    breakdownScriptToStoryboards,

    // Clips
    syncProjectClips,
    createProjectClipItem,
    updateProjectClipItem,
    editProjectClipItem,
    resetProjectClipForm,
    submitProjectClipForm,
    deleteProjectClipItem,

    // Exports
    downloadStoryboardCsv,
    downloadProjectExport,
    generateProjectPackageIndex,

    // Storyboard generation
    storyboardGenerationPrompt,
    useStoryboardForGeneration,

    // Assets
    createProjectAssetItem,
    editProjectAssetItem,
    resetProjectAssetForm,
    submitProjectAssetForm,
    deleteProjectAssetItem,
    toggleProjectAssetFavorite,
    projectAssetReferenceUrls,
    reuseProjectAsset,

    // Generated asset dialog
    addGeneratedImageToAsset,
    submitGeneratedAssetDialog,

    // Refresh
    refreshProjectWorkbench,

    // URL sync
    syncProjectWorkspaceUrl,
    clearProjectWorkspaceUrl,
    openWorkbenchPage,

    // Derived computed values
    projectHealth,
    filteredProjectMembers,
    filteredProjectEpisodes,
    filteredProjectIssues,
    filteredProjectMilestones,
    filteredProjectScripts,
    filteredProjectStoryboards,
    filteredProjectClips,
    filteredProjectReviews,
    filteredProjectTasks,
    filteredProjectAssets,
    sortedFilteredProjectIssues,
    sortedFilteredProjectMilestones,
    sortedFilteredProjectClips,
    sortedFilteredProjectReviews,
    currentWorkbenchPageNumber,
    workbenchPageSize,
    setCurrentWorkbenchPage,
    paginateWorkbench,
    pagedProjectMembers,
    pagedProjectEpisodes,
    pagedProjectIssues,
    pagedProjectMilestones,
    pagedProjectScripts,
    pagedProjectStoryboards,
    pagedProjectClips,
    pagedProjectReviews,
    pagedProjectTasks,
    pagedProjectAssets,
    workbenchFilteredCountByTab,
    openIssueCount,
    pendingReviewCount,
    completedTaskCount,
    productionProgressItems,
    productionProgress,
    nextMilestone,
    workbenchPages,
    productionStageRows,
    supportWorkbenchPages,
    currentWorkbenchPage,
  };
}
