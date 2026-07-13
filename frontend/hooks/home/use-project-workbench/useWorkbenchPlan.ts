"use client";

/**
 * 工作台：项目规划（项目级别元信息）
 */

import { useCallback } from "react";
import { api } from "@/lib/api-client";
import type { Project } from "@/lib/app-types";
import type { WorkbenchState } from "./useWorkbenchState";

export function useSaveProjectPlan({
  state,
  showNotice,
}: {
  state: WorkbenchState;
  showNotice: (message: string) => void;
}) {
  const { projectDraft, setProjectDraft } = state;

  return useCallback(async (selectedProject: Project | undefined) => {
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
  }, [projectDraft, setProjectDraft, showNotice]);
}
