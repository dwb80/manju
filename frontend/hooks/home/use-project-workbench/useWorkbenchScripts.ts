"use client";

/**
 * 工作台：剧本（Script）CRUD + 回收站（软删除/恢复/彻底删除）
 *
 * 与普通 CRUD 不同：剧本删除走软删除（30 天保留期）+ 回收站接口。
 * 软删除后从默认列表移除，恢复 / 彻底删除走专用接口。
 */

import { useCallback } from "react";
import { api } from "@/lib/api-client";
import type {
  Project,
  ProjectScript,
  ProjectStoryboard,
} from "@/lib/app-types";
import type { WorkbenchState } from "./useWorkbenchState";

const RECYCLE_BIN_GRACE_DAYS = 30;

export function useScriptItems({
  state,
  showNotice,
}: {
  state: WorkbenchState;
  showNotice: (message: string) => void;
}) {
  const { scriptForm, setScriptForm, editingScriptId, setEditingScriptId, projectScripts, setProjectScripts, storyboardDraft } = state;

  const create = useCallback(async (selectedProject: Project | undefined) => {
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
  }, [scriptForm, setScriptForm, showNotice]);

  const update = useCallback(async (selectedProject: Project | undefined, script: ProjectScript, patch: Partial<ProjectScript>) => {
    if (!selectedProject) return;
    try {
      await api<ProjectScript>(`/api/projects/${selectedProject.id}/scripts/${script.id}`, { method: "PUT", body: JSON.stringify(patch) });
      showNotice("剧本已更新");
    } catch (error) {
      showNotice((error as Error).message || "剧本更新失败");
    }
  }, [showNotice]);

  const edit = useCallback((script: ProjectScript) => {
    setEditingScriptId(script.id);
    setScriptForm({ episode: script.episode, title: script.title, status: script.status, content: script.content, notes: script.notes });
  }, [setEditingScriptId, setScriptForm]);

  const reset = useCallback(() => {
    setEditingScriptId("");
    setScriptForm({ episode: scriptForm.episode, title: "", status: "draft", content: "", notes: "" });
  }, [scriptForm.episode, setEditingScriptId, setScriptForm]);

  const submit = useCallback(async (selectedProject: Project | undefined) => {
    if (!editingScriptId) { await create(selectedProject); return; }
    const script = projectScripts.find((item) => item.id === editingScriptId);
    if (!script) { reset(); return; }
    await update(selectedProject, script, scriptForm);
    reset();
  }, [editingScriptId, projectScripts, scriptForm, create, update, reset]);

  /** 由后端剧本 record 生成分镜（调 /storyboards/breakdown） */
  const breakdownSaved = useCallback(async (selectedProject: Project | undefined, script: ProjectScript) => {
    if (!selectedProject) return;
    try {
      showNotice("正在从剧本生成分镜...");
      const created = await api<ProjectStoryboard[]>(`/api/projects/${selectedProject.id}/storyboards/breakdown`, { method: "POST", body: JSON.stringify({ script_id: script.id }) });
      showNotice(`已生成 ${created.length} 条分镜`);
      return created;
    } catch (error) {
      showNotice((error as Error).message || "剧本拆分失败");
    }
  }, [showNotice]);

  return { create, update, edit, reset, submit, breakdownSaved };
}

/**
 * 剧本软删除 / 恢复 / 彻底删除
 */
export function useScriptRecycleBin({
  state,
  showNotice,
}: {
  state: WorkbenchState;
  showNotice: (message: string) => void;
}) {
  const { setProjectScripts } = state;

  /** 软删除剧本：先调 DELETE 把记录移到回收站，再从默认列表移除 */
  const softDelete = useCallback((selectedProject: Project | undefined, script: ProjectScript, requestConfirm: (title: string, description: string, confirmLabel: string, action: () => Promise<void> | void) => void) => {
    if (!selectedProject) return;
    const projectId = selectedProject.id;
    requestConfirm("删除剧本", `确认将剧本"${script.title}"移到回收站？30 天内可在回收站恢复或彻底删除。`, "移到回收站", async () => {
      try {
        const result = await api<{ deleted_at: string }>(`/api/projects/${projectId}/scripts/${script.id}`, { method: "DELETE" });
        setProjectScripts((items) => items.filter((item) => item.id !== script.id));
        showNotice(`剧本已移到回收站，30 天后自动清理（删除于 ${new Date(result.deleted_at).toLocaleString()}）`);
      } catch (error) {
        showNotice((error as Error).message || "剧本删除失败");
      }
    });
  }, [setProjectScripts, showNotice]);

  /** 恢复软删除的剧本：从默认列表移除（reload 会接管） */
  const restore = useCallback(async (selectedProject: Project | undefined, script: ProjectScript) => {
    if (!selectedProject) return;
    try {
      const restored = await api<ProjectScript>(`/api/projects/${selectedProject.id}/scripts/${script.id}/restore`, { method: "POST" });
      setProjectScripts((items) => items.filter((item) => item.id !== script.id));
      showNotice(`剧本"${restored.title}"已恢复`);
      return restored;
    } catch (error) {
      showNotice((error as Error).message || "剧本恢复失败");
    }
  }, [setProjectScripts, showNotice]);

  /** 彻底删除剧本（级联清理剧集/场景/对白/备份等所有关联数据） */
  const purge = useCallback((selectedProject: Project | undefined, script: ProjectScript, requestConfirm: (title: string, description: string, confirmLabel: string, action: () => Promise<void> | void) => void) => {
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
  }, [showNotice]);

  /** 计算回收站剧本距保留期截止还差几天（负数表示可彻底删除） */
  const remainingDays = useCallback((deletedAt: string | undefined): number => {
    if (!deletedAt) return 0;
    const deletedTime = new Date(deletedAt).getTime();
    if (Number.isNaN(deletedTime)) return 0;
    const graceMs = RECYCLE_BIN_GRACE_DAYS * 24 * 60 * 60 * 1000;
    return Math.ceil((deletedTime + graceMs - Date.now()) / (24 * 60 * 60 * 1000));
  }, []);

  return { softDelete, restore, purge, remainingDays };
}
