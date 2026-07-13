"use client";

/**
 * 工作台：分镜（Storyboard）CRUD + 批量操作
 */

import { useCallback } from "react";
import { api } from "@/lib/api-client";
import type {
  Project,
  ProjectStoryboard,
  ProjectStoryboardStatus,
} from "@/lib/app-types";
import type { WorkbenchState } from "./useWorkbenchState";

export function useStoryboardItems({
  state,
  showNotice,
}: {
  state: WorkbenchState;
  showNotice: (message: string) => void;
}) {
  const { storyboardDraft, setStoryboardDraft, editingStoryboardId, setEditingStoryboardId, selectedStoryboardIds, setSelectedStoryboardIds, scriptDraft } = state;

  /** 提交分镜表单：editingStoryboardId 存在则更新，否则新建 */
  const submit = useCallback(async (selectedProject: Project | undefined) => {
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
  }, [storyboardDraft, editingStoryboardId, setEditingStoryboardId, setStoryboardDraft, showNotice]);

  /** 载入分镜到编辑表单 */
  const edit = useCallback((storyboard: ProjectStoryboard) => {
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
  }, [setEditingStoryboardId, setStoryboardDraft, showNotice]);

  /** 通用 patch 更新（细粒度调用） */
  const update = useCallback(async (selectedProject: Project | undefined, storyboard: ProjectStoryboard, patch: Partial<ProjectStoryboard>) => {
    if (!selectedProject) return;
    try {
      await api<ProjectStoryboard>(`/api/projects/${selectedProject.id}/storyboards/${storyboard.id}`, { method: "PUT", body: JSON.stringify(patch) });
      showNotice("分镜已更新");
    } catch (error) {
      showNotice((error as Error).message || "分镜更新失败");
    }
  }, [showNotice]);

  /** 选中 / 取消选中单条分镜（用于批量操作） */
  const toggleSelection = useCallback((storyboardId: string) => {
    setSelectedStoryboardIds((ids) => ids.includes(storyboardId) ? ids.filter((id) => id !== storyboardId) : [...ids, storyboardId]);
  }, [setSelectedStoryboardIds]);

  /** 批量更新分镜状态（如批量送审） */
  const batchUpdate = useCallback(async (selectedProject: Project | undefined, status: ProjectStoryboardStatus) => {
    if (!selectedProject) return;
    if (selectedStoryboardIds.length === 0) { showNotice("请先选择分镜"); return; }
    try {
      await api<ProjectStoryboard[]>(`/api/projects/${selectedProject.id}/storyboards/batch`, { method: "POST", body: JSON.stringify({ ids: selectedStoryboardIds, status }) });
      showNotice(status === "review" ? "已批量送审" : "已批量更新分镜");
    } catch (error) {
      showNotice((error as Error).message || "批量更新失败");
    }
  }, [selectedStoryboardIds, showNotice]);

  return { submit, edit, update, toggleSelection, batchUpdate };
}

export function useDeleteStoryboardItem({
  showNotice,
}: {
  showNotice: (message: string) => void;
}) {
  return useCallback((selectedProject: Project | undefined, storyboard: ProjectStoryboard, requestConfirm: (title: string, description: string, confirmLabel: string, action: () => Promise<void> | void) => void) => {
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
  }, [showNotice]);
}

/** 把粘贴的剧本文本传给后端做分镜拆分（不同于 breakdownSaved 接受已保存的 ProjectScript） */
export function useBreakdownScriptText({
  state,
  showNotice,
}: {
  state: WorkbenchState;
  showNotice: (message: string) => void;
}) {
  const { scriptDraft, setScriptDraft, storyboardDraft } = state;

  return useCallback(async (selectedProject: Project | undefined) => {
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
  }, [scriptDraft, setScriptDraft, storyboardDraft.episode, showNotice]);
}
