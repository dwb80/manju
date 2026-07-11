"use client";

import { useState, useCallback } from "react";
import { api } from "@/lib/api-client";
import { emptyProjectFormDraft } from "@/lib/project-workflow";
import type { Project, ProjectFormDraft, ProjectFormMode } from "@/lib/app-types";

export function useProjects({
  showNotice,
  requestConfirm,
}: {
  showNotice: (message: string) => void;
  requestConfirm: (title: string, description: string, confirmLabel: string, action: () => Promise<void> | void) => void;
}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectScope, setProjectScope] = useState("all");
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [projectCreateMenuOpen, setProjectCreateMenuOpen] = useState(false);
  const [projectFormMode, setProjectFormMode] = useState<ProjectFormMode | null>(null);
  const [projectFormTarget, setProjectFormTarget] = useState<Project | null>(null);
  const [projectFormDraft, setProjectFormDraft] = useState<ProjectFormDraft>(emptyProjectFormDraft);
  const [projectDangerAction, setProjectDangerAction] = useState<{ type: "archive" | "remove"; project: Project } | null>(null);
  const [projectActionMenuId, setProjectActionMenuId] = useState("");

  const selectedProject = projects.find((project) => project.id === projectScope);
  const projectScopeLabel = projectScope === "all" ? "全部项目" : projectScope === "" ? "不使用项目" : selectedProject?.name ?? "项目";
  const projectById = new Map(projects.map((project) => [project.id, project]));

  /** 加载项目列表，供侧边栏项目选择器使用。 */
  const loadProjects = useCallback(async () => {
    try {
      const items = await api<Project[]>("/api/projects");
      setProjects(items);
      return items;
    } catch (error) {
      showNotice((error as Error).message || "项目列表加载失败");
      return [];
    }
  }, [showNotice]);

  /** 打开项目创建弹层，并按选择的存储模式准备默认表单。 */
  const createProjectItem = useCallback((storageMode: "managed" | "existing") => {
    setProjectFormMode(storageMode === "existing" ? "create-existing" : "create-managed");
    setProjectFormTarget(null);
    setProjectFormDraft({ ...emptyProjectFormDraft });
    setProjectActionMenuId("");
    setProjectCreateMenuOpen(false);
  }, []);

  /** 打开项目编辑弹层，用标准表单替代浏览器原生输入框。 */
  const renameProject = useCallback((project: Project) => {
    setProjectFormMode("edit");
    setProjectFormTarget(project);
    setProjectFormDraft({
      name: project.name,
      category: project.category ?? "",
      status: project.status ?? "策划中",
      description: project.description ?? "",
      episode_count: Number(project.episode_count ?? 0),
      owner: project.owner ?? "",
      due_date: project.due_date ?? "",
      storage_path: project.storage_path ?? "",
    });
    setProjectActionMenuId("");
  }, []);

  /** 关闭项目表单弹层并清理临时草稿。 */
  const closeProjectDialog = useCallback(() => {
    setProjectFormMode(null);
    setProjectFormTarget(null);
    setProjectFormDraft(emptyProjectFormDraft);
  }, []);

  /** 提交项目新增或编辑表单，创建后自动进入项目工作台。 */
  const submitProjectDialog = useCallback(async () => {
    const name = projectFormDraft.name.trim();
    if (!name) {
      showNotice("请填写项目名称");
      return;
    }
    if (projectFormMode === "create-existing" && !projectFormDraft.storage_path.trim()) {
      showNotice("请填写现有项目文件夹");
      return;
    }
    try {
      if (projectFormMode === "edit" && projectFormTarget) {
        const updated = await api<Project>(`/api/projects/${projectFormTarget.id}`, {
          method: "PUT",
          body: JSON.stringify({
            name,
            category: projectFormDraft.category,
            status: projectFormDraft.status,
            description: projectFormDraft.description,
            episode_count: Number(projectFormDraft.episode_count || 0),
            owner: projectFormDraft.owner,
            due_date: projectFormDraft.due_date,
          }),
        });
        closeProjectDialog();
        await loadProjects();
        showNotice("项目已保存");
        return updated;
      }

      const project = await api<Project>("/api/projects", {
        method: "POST",
        body: JSON.stringify({
          name,
          storage_mode: projectFormMode === "create-existing" ? "existing" : "managed",
          storage_path: projectFormDraft.storage_path.trim(),
          category: projectFormDraft.category,
          status: projectFormDraft.status,
          description: projectFormDraft.description,
          episode_count: Number(projectFormDraft.episode_count || 0),
          owner: projectFormDraft.owner,
          due_date: projectFormDraft.due_date,
        }),
      });
      closeProjectDialog();
      await loadProjects();
      setProjectScope(project.id);
      showNotice("项目已创建");
      return project;
    } catch (error) {
      showNotice((error as Error).message || "项目保存失败");
      return null;
    }
  }, [projectFormDraft, projectFormMode, projectFormTarget, closeProjectDialog, loadProjects, showNotice]);

  /** 切换项目置顶状态，并刷新项目和会话分组。 */
  const togglePinProject = useCallback(
    async (project: Project) => {
      await api<Project>(`/api/projects/${project.id}`, {
        method: "PUT",
        body: JSON.stringify({ is_pinned: !project.is_pinned }),
      });
      setProjectActionMenuId("");
      await loadProjects();
      showNotice(project.is_pinned ? "已取消置顶项目" : "已置顶项目");
    },
    [loadProjects, showNotice]
  );

  /** 请求后端在本机资源管理器中打开项目目录。 */
  const openProjectFolder = useCallback(async (project: Project) => {
    try {
      showNotice("正在打开项目文件夹...");
      await api(`/api/projects/${project.id}/open-folder`, { method: "POST", body: JSON.stringify({}) });
      setProjectActionMenuId("");
      showNotice("已打开项目文件夹");
    } catch (error) {
      showNotice((error as Error).message || "打开项目文件夹失败");
    }
  }, [showNotice]);

  /** 软归档项目下的对话，让它们从项目列表和全部项目中隐藏。 */
  const archiveProject = useCallback((project: Project) => {
    setProjectDangerAction({ type: "archive", project });
    setProjectActionMenuId("");
  }, []);

  /** 删除项目前先打开危险操作确认弹层。 */
  const removeProject = useCallback((project: Project) => {
    setProjectDangerAction({ type: "remove", project });
    setProjectActionMenuId("");
  }, []);

  /** 执行项目归档或移除，并刷新侧边栏项目与会话。 */
  const confirmProjectDangerAction = useCallback(async () => {
    if (!projectDangerAction) return;
    const { type, project } = projectDangerAction;
    if (type === "archive") {
      await api<Project>(`/api/projects/${project.id}`, {
        method: "PUT",
        body: JSON.stringify({ archived_at: new Date().toISOString() }),
      });
      if (projectScope === project.id) setProjectScope("all");
      await loadProjects();
      setProjectDangerAction(null);
      showNotice("已归档对话");
      return;
    }
    await api(`/api/projects/${project.id}`, { method: "DELETE" });
    if (projectScope === project.id) setProjectScope("all");
    await loadProjects();
    setProjectDangerAction(null);
    showNotice("已移除项目");
  }, [projectDangerAction, projectScope, loadProjects, showNotice]);

  return {
    projects,
    setProjects,
    projectScope,
    setProjectScope,
    projectMenuOpen,
    setProjectMenuOpen,
    projectCreateMenuOpen,
    setProjectCreateMenuOpen,
    projectFormMode,
    setProjectFormMode,
    projectFormTarget,
    setProjectFormTarget,
    projectFormDraft,
    setProjectFormDraft,
    projectDangerAction,
    setProjectDangerAction,
    projectActionMenuId,
    setProjectActionMenuId,
    selectedProject,
    projectScopeLabel,
    projectById,
    loadProjects,
    createProjectItem,
    renameProject,
    closeProjectDialog,
    submitProjectDialog,
    togglePinProject,
    openProjectFolder,
    archiveProject,
    removeProject,
    confirmProjectDangerAction,
  };
}
