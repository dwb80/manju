"use client";

/**
 * 工作台：通用 7 套 CRUD（任务 / 成员 / 剧集 / 问题 / 里程碑 / 审核 / 剪辑）
 *
 * 这 7 类实体的增删改查模式高度相似（create / update / edit / reset / submit-form / delete），
 * 合并到一个文件便于批量调整；不依赖其它子 hook。
 */

import { useCallback } from "react";
import { api } from "@/lib/api-client";
import type {
  Project,
  ProjectClip,
  ProjectEpisode,
  ProjectIssue,
  ProjectMember,
  ProjectMilestone,
  ProjectReview,
  ProjectTask,
} from "@/lib/app-types";
import type { WorkbenchState } from "./useWorkbenchState";

// ============== Tasks ==============
export function useTaskItems({
  state,
  showNotice,
}: {
  state: WorkbenchState;
  showNotice: (message: string) => void;
}) {
  const { taskDraft, setTaskDraft, editingTaskId, setEditingTaskId, projectTasks, projectMembers, projectDraft } = state;

  const create = useCallback(async (selectedProject: Project | undefined) => {
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
  }, [taskDraft, projectMembers, projectDraft, setTaskDraft, showNotice]);

  const edit = useCallback((task: ProjectTask) => {
    setEditingTaskId(task.id);
    setTaskDraft({ title: task.title, status: task.status, owner: task.owner, due_date: task.due_date, notes: task.notes });
  }, [setEditingTaskId, setTaskDraft]);

  const reset = useCallback(() => {
    setEditingTaskId("");
    setTaskDraft({ title: "", status: "todo", owner: "", due_date: "", notes: "" });
  }, [setEditingTaskId, setTaskDraft]);

  const update = useCallback(async (selectedProject: Project | undefined, task: ProjectTask, patch: Partial<ProjectTask>) => {
    if (!selectedProject) return;
    try {
      await api<ProjectTask>(`/api/projects/${selectedProject.id}/tasks/${task.id}`, { method: "PUT", body: JSON.stringify(patch) });
      showNotice("任务已更新");
    } catch (error) {
      showNotice((error as Error).message || "任务更新失败");
    }
  }, [showNotice]);

  const submit = useCallback(async (selectedProject: Project | undefined) => {
    if (!editingTaskId) { await create(selectedProject); return; }
    const task = projectTasks.find((item) => item.id === editingTaskId);
    if (!task) { reset(); return; }
    const title = (taskDraft.title ?? "").trim();
    if (!title) { showNotice("请先输入任务名称"); return; }
    await update(selectedProject, task, { ...taskDraft, title });
    reset();
  }, [editingTaskId, projectTasks, taskDraft, create, update, reset, showNotice]);

  return { create, edit, reset, update, submit };
}

export function useDeleteTaskItem({
  showNotice,
}: {
  showNotice: (message: string) => void;
}) {
  // 单独 export 因为 useTaskItems 不直接接受 requestConfirm
  return useCallback((selectedProject: Project | undefined, task: ProjectTask, requestConfirm: (title: string, description: string, confirmLabel: string, action: () => Promise<void> | void) => void) => {
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
  }, [showNotice]);
}

// ============== Members ==============
export function useMemberItems({
  state,
  showNotice,
}: {
  state: WorkbenchState;
  showNotice: (message: string) => void;
}) {
  const { memberDraft, setMemberDraft, editingMemberId, setEditingMemberId, projectMembers } = state;

  const create = useCallback(async (selectedProject: Project | undefined) => {
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
  }, [memberDraft, setMemberDraft, showNotice]);

  const update = useCallback(async (selectedProject: Project | undefined, member: ProjectMember, patch: Partial<ProjectMember>) => {
    if (!selectedProject) return;
    try {
      await api<ProjectMember>(`/api/projects/${selectedProject.id}/members/${member.id}`, { method: "PUT", body: JSON.stringify(patch) });
      showNotice("成员已更新");
    } catch (error) {
      showNotice((error as Error).message || "成员更新失败");
    }
  }, [showNotice]);

  const edit = useCallback((member: ProjectMember) => {
    setEditingMemberId(member.id);
    setMemberDraft({ name: member.name, role: member.role, contact: member.contact, notes: member.notes });
  }, [setEditingMemberId, setMemberDraft]);

  const reset = useCallback(() => {
    setEditingMemberId("");
    setMemberDraft({ name: "", role: "导演", contact: "", notes: "" });
  }, [setEditingMemberId, setMemberDraft]);

  const submit = useCallback(async (selectedProject: Project | undefined) => {
    if (!editingMemberId) { await create(selectedProject); return; }
    const member = projectMembers.find((item) => item.id === editingMemberId);
    if (!member) { reset(); return; }
    await update(selectedProject, member, memberDraft);
    reset();
  }, [editingMemberId, projectMembers, memberDraft, create, update, reset]);

  return { create, update, edit, reset, submit };
}

export function useDeleteMemberItem({
  showNotice,
}: {
  showNotice: (message: string) => void;
}) {
  return useCallback((selectedProject: Project | undefined, member: ProjectMember, requestConfirm: (title: string, description: string, confirmLabel: string, action: () => Promise<void> | void) => void) => {
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
  }, [showNotice]);
}

// ============== Episodes ==============
export function useEpisodeItems({
  state,
  showNotice,
}: {
  state: WorkbenchState;
  showNotice: (message: string) => void;
}) {
  const { episodeDraft, setEpisodeDraft, editingEpisodeId, setEditingEpisodeId, projectEpisodes } = state;

  const create = useCallback(async (selectedProject: Project | undefined) => {
    if (!selectedProject) return;
    try {
      const created = await api<ProjectEpisode>(`/api/projects/${selectedProject.id}/episodes`, { method: "POST", body: JSON.stringify(episodeDraft) });
      setEpisodeDraft((draft) => ({ ...draft, episode: created.episode + 1, title: "", summary: "", notes: "" }));
      showNotice("剧集已添加");
      return created;
    } catch (error) {
      showNotice((error as Error).message || "剧集添加失败");
    }
  }, [episodeDraft, setEpisodeDraft, showNotice]);

  const update = useCallback(async (selectedProject: Project | undefined, episode: ProjectEpisode, patch: Partial<ProjectEpisode>) => {
    if (!selectedProject) return;
    try {
      await api<ProjectEpisode>(`/api/projects/${selectedProject.id}/episodes/${episode.id}`, { method: "PUT", body: JSON.stringify(patch) });
      showNotice("剧集已更新");
    } catch (error) {
      showNotice((error as Error).message || "剧集更新失败");
    }
  }, [showNotice]);

  const edit = useCallback((episode: ProjectEpisode) => {
    setEditingEpisodeId(episode.id);
    setEpisodeDraft({ episode: episode.episode, title: episode.title, status: episode.status, summary: episode.summary, due_date: episode.due_date, notes: episode.notes });
  }, [setEditingEpisodeId, setEpisodeDraft]);

  const reset = useCallback(() => {
    setEditingEpisodeId("");
    setEpisodeDraft({ episode: projectEpisodes.length + 1, title: "", status: "策划中", summary: "", due_date: "", notes: "" });
  }, [projectEpisodes.length, setEditingEpisodeId, setEpisodeDraft]);

  const submit = useCallback(async (selectedProject: Project | undefined) => {
    if (!editingEpisodeId) { await create(selectedProject); return; }
    const episode = projectEpisodes.find((item) => item.id === editingEpisodeId);
    if (!episode) { reset(); return; }
    await update(selectedProject, episode, episodeDraft);
    reset();
  }, [editingEpisodeId, projectEpisodes, episodeDraft, create, update, reset]);

  return { create, update, edit, reset, submit };
}

export function useDeleteEpisodeItem({
  showNotice,
}: {
  showNotice: (message: string) => void;
}) {
  return useCallback((selectedProject: Project | undefined, episode: ProjectEpisode, requestConfirm: (title: string, description: string, confirmLabel: string, action: () => Promise<void> | void) => void) => {
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
  }, [showNotice]);
}

// ============== Issues ==============
export function useIssueItems({
  state,
  showNotice,
}: {
  state: WorkbenchState;
  showNotice: (message: string) => void;
}) {
  const { issueDraft, setIssueDraft, editingIssueId, setEditingIssueId, projectIssues, projectMembers } = state;

  const create = useCallback(async (selectedProject: Project | undefined) => {
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
  }, [issueDraft, projectMembers, setIssueDraft, showNotice]);

  const update = useCallback(async (selectedProject: Project | undefined, issue: ProjectIssue, patch: Partial<ProjectIssue>) => {
    if (!selectedProject) return;
    try {
      await api<ProjectIssue>(`/api/projects/${selectedProject.id}/issues/${issue.id}`, { method: "PUT", body: JSON.stringify(patch) });
      showNotice("问题已更新");
    } catch (error) {
      showNotice((error as Error).message || "问题更新失败");
    }
  }, [showNotice]);

  const edit = useCallback((issue: ProjectIssue) => {
    setEditingIssueId(issue.id);
    setIssueDraft({ title: issue.title, severity: issue.severity, status: issue.status, owner: issue.owner, target_type: issue.target_type, target_id: issue.target_id, notes: issue.notes });
  }, [setEditingIssueId, setIssueDraft]);

  const reset = useCallback(() => {
    setEditingIssueId("");
    setIssueDraft({ title: "", severity: "medium", status: "open", owner: "", target_type: "", target_id: "", notes: "" });
  }, [setEditingIssueId, setIssueDraft]);

  const submit = useCallback(async (selectedProject: Project | undefined) => {
    if (!editingIssueId) { await create(selectedProject); return; }
    const issue = projectIssues.find((item) => item.id === editingIssueId);
    if (!issue) { reset(); return; }
    await update(selectedProject, issue, issueDraft);
    reset();
  }, [editingIssueId, projectIssues, issueDraft, create, update, reset]);

  return { create, update, edit, reset, submit };
}

export function useDeleteIssueItem({
  showNotice,
}: {
  showNotice: (message: string) => void;
}) {
  return useCallback((selectedProject: Project | undefined, issue: ProjectIssue, requestConfirm: (title: string, description: string, confirmLabel: string, action: () => Promise<void> | void) => void) => {
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
  }, [showNotice]);
}

// ============== Milestones ==============
export function useMilestoneItems({
  state,
  showNotice,
}: {
  state: WorkbenchState;
  showNotice: (message: string) => void;
}) {
  const { milestoneDraft, setMilestoneDraft, editingMilestoneId, setEditingMilestoneId, projectMilestones, projectMembers } = state;

  const create = useCallback(async (selectedProject: Project | undefined) => {
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
  }, [milestoneDraft, projectMembers, setMilestoneDraft, showNotice]);

  const update = useCallback(async (selectedProject: Project | undefined, milestone: ProjectMilestone, patch: Partial<ProjectMilestone>) => {
    if (!selectedProject) return;
    try {
      await api<ProjectMilestone>(`/api/projects/${selectedProject.id}/milestones/${milestone.id}`, { method: "PUT", body: JSON.stringify(patch) });
      showNotice("里程碑已更新");
    } catch (error) {
      showNotice((error as Error).message || "里程碑更新失败");
    }
  }, [showNotice]);

  const edit = useCallback((milestone: ProjectMilestone) => {
    setEditingMilestoneId(milestone.id);
    setMilestoneDraft({ title: milestone.title, status: milestone.status, owner: milestone.owner, due_date: milestone.due_date, description: milestone.description });
  }, [setEditingMilestoneId, setMilestoneDraft]);

  const reset = useCallback(() => {
    setEditingMilestoneId("");
    setMilestoneDraft({ title: "", status: "planned", owner: "", due_date: "", description: "" });
  }, [setEditingMilestoneId, setMilestoneDraft]);

  const submit = useCallback(async (selectedProject: Project | undefined) => {
    if (!editingMilestoneId) { await create(selectedProject); return; }
    const milestone = projectMilestones.find((item) => item.id === editingMilestoneId);
    if (!milestone) { reset(); return; }
    await update(selectedProject, milestone, milestoneDraft);
    reset();
  }, [editingMilestoneId, projectMilestones, milestoneDraft, create, update, reset]);

  return { create, update, edit, reset, submit };
}

export function useDeleteMilestoneItem({
  showNotice,
}: {
  showNotice: (message: string) => void;
}) {
  return useCallback((selectedProject: Project | undefined, milestone: ProjectMilestone, requestConfirm: (title: string, description: string, confirmLabel: string, action: () => Promise<void> | void) => void) => {
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
  }, [showNotice]);
}

// ============== Reviews ==============
export function useReviewItems({
  state,
  showNotice,
}: {
  state: WorkbenchState;
  showNotice: (message: string) => void;
}) {
  const { reviewDrafts, setReviewDrafts, projectStoryboards, projectClips, projectAssets } = state;

  const createForStoryboard = useCallback(async (selectedProject: Project | undefined, storyboardId: string, reviewer = "导演") => {
    if (!selectedProject) return;
    const comment = (reviewDrafts[storyboardId] ?? "").trim();
    if (!comment) { showNotice("请先填写审核意见"); return; }
    try {
      await api<ProjectReview>(`/api/projects/${selectedProject.id}/reviews`, {
        method: "POST",
        body: JSON.stringify({ target_type: "storyboard", target_id: storyboardId, comment, reviewer }),
      });
      setReviewDrafts((drafts) => ({ ...drafts, [storyboardId]: "" }));
      showNotice("审核意见已添加");
    } catch (error) {
      showNotice((error as Error).message || "审核意见添加失败");
    }
  }, [reviewDrafts, setReviewDrafts, showNotice]);

  const update = useCallback(async (selectedProject: Project | undefined, review: ProjectReview, patch: Partial<ProjectReview>) => {
    if (!selectedProject) return;
    try {
      await api<ProjectReview>(`/api/projects/${selectedProject.id}/reviews/${review.id}`, { method: "PUT", body: JSON.stringify(patch) });
      showNotice("审核意见已更新");
    } catch (error) {
      showNotice((error as Error).message || "审核意见更新失败");
    }
  }, [showNotice]);

  const remove = useCallback(async (selectedProject: Project | undefined, review: ProjectReview) => {
    if (!selectedProject) return;
    try {
      await api(`/api/projects/${selectedProject.id}/reviews/${review.id}`, { method: "DELETE" });
      showNotice("审核意见已删除");
    } catch (error) {
      showNotice((error as Error).message || "审核意见删除失败");
    }
  }, [showNotice]);

  /** 渲染审核对象时的可读名称：分镜 / 剪辑 / 资产 */
  const targetLabel = useCallback((review: ProjectReview) => {
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

  return { createForStoryboard, update, remove, targetLabel };
}

// ============== Clips ==============
export function useClipItems({
  state,
  showNotice,
}: {
  state: WorkbenchState;
  showNotice: (message: string) => void;
}) {
  const { clipDraft, setClipDraft, editingClipId, setEditingClipId, projectClips } = state;

  const sync = useCallback(async (selectedProject: Project | undefined) => {
    if (!selectedProject) return;
    try {
      const created = await api<ProjectClip[]>(`/api/projects/${selectedProject.id}/clips/sync`, { method: "POST" });
      showNotice(created.length ? `已同步 ${created.length} 条剪辑` : "没有新的可同步视频分镜");
      return created;
    } catch (error) {
      showNotice((error as Error).message || "剪辑同步失败");
    }
  }, [showNotice]);

  const create = useCallback(async (selectedProject: Project | undefined) => {
    if (!selectedProject) return;
    const title = (clipDraft.title ?? "").trim() || `第${clipDraft.episode}集 ${clipDraft.scene}-${clipDraft.shot}`;
    try {
      await api<ProjectClip>(`/api/projects/${selectedProject.id}/clips`, { method: "POST", body: JSON.stringify({ ...clipDraft, title }) });
      setClipDraft((draft) => ({ ...draft, shot: String(Number(draft.shot || 0) + 1), title: "", source_video_url: "", in_point: "", out_point: "", notes: "" }));
      showNotice("剪辑条目已添加");
    } catch (error) {
      showNotice((error as Error).message || "剪辑添加失败");
    }
  }, [clipDraft, setClipDraft, showNotice]);

  const update = useCallback(async (selectedProject: Project | undefined, clip: ProjectClip, patch: Partial<ProjectClip>) => {
    if (!selectedProject) return;
    try {
      await api<ProjectClip>(`/api/projects/${selectedProject.id}/clips/${clip.id}`, { method: "PUT", body: JSON.stringify(patch) });
      showNotice("剪辑条目已更新");
    } catch (error) {
      showNotice((error as Error).message || "剪辑更新失败");
    }
  }, [showNotice]);

  const edit = useCallback((clip: ProjectClip) => {
    setEditingClipId(clip.id);
    setClipDraft({
      episode: clip.episode, scene: clip.scene, shot: clip.shot, title: clip.title,
      source_video_url: clip.source_video_url, duration: clip.duration,
      in_point: clip.in_point, out_point: clip.out_point, order_index: clip.order_index,
      status: clip.status, notes: clip.notes,
    });
  }, [setEditingClipId, setClipDraft]);

  const reset = useCallback(() => {
    setEditingClipId("");
    setClipDraft((draft) => ({ ...draft, title: "", source_video_url: "", in_point: "", out_point: "", status: "todo", notes: "" }));
  }, [setEditingClipId, setClipDraft]);

  const submit = useCallback(async (selectedProject: Project | undefined) => {
    if (!editingClipId) { await create(selectedProject); return; }
    const clip = projectClips.find((item) => item.id === editingClipId);
    if (!clip) { reset(); return; }
    const title = (clipDraft.title ?? "").trim() || `第${clipDraft.episode}集 ${clipDraft.scene}-${clipDraft.shot}`;
    await update(selectedProject, clip, { ...clipDraft, title });
    reset();
  }, [editingClipId, projectClips, clipDraft, create, update, reset]);

  return { sync, create, update, edit, reset, submit };
}

export function useDeleteClipItem({
  showNotice,
}: {
  showNotice: (message: string) => void;
}) {
  return useCallback((selectedProject: Project | undefined, clip: ProjectClip, requestConfirm: (title: string, description: string, confirmLabel: string, action: () => Promise<void> | void) => void) => {
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
  }, [showNotice]);
}
