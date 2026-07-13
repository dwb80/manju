"use client";

/**
 * 工作台：资产（Assets）CRUD + 收藏
 */

import { useCallback } from "react";
import { api } from "@/lib/api-client";
import type {
  Project,
  ProjectAsset,
  ProjectAssetKind,
} from "@/lib/app-types";
import type { WorkbenchState } from "./useWorkbenchState";
import { emptyAssetDraft } from "@/lib/project-workflow";

export function useAssetItems({
  state,
  showNotice,
}: {
  state: WorkbenchState;
  showNotice: (message: string) => void;
}) {
  const { assetComposerKind, setAssetComposerKind, assetDrafts, setAssetDrafts, editingAssetId, setEditingAssetId, projectAssets, setProjectAssets } = state;

  /** 提交资产表单：editingAssetId 存在则更新，否则新建 */
  const submit = useCallback(async (selectedProject: Project | undefined) => {
    if (!selectedProject) return;
    const draft = assetDrafts[assetComposerKind];
    const name = (draft?.name ?? "").trim();
    if (!name) { showNotice("请先输入资产名称"); return; }
    try {
      if (editingAssetId) {
        showNotice("正在保存资产...");
        await api<ProjectAsset>(`/api/projects/${selectedProject.id}/assets/${editingAssetId}`, { method: "PUT", body: JSON.stringify(draft) });
        showNotice("资产已保存");
      } else {
        showNotice("正在添加资产...");
        await api<ProjectAsset>(`/api/projects/${selectedProject.id}/assets`, { method: "POST", body: JSON.stringify(draft) });
        showNotice("资产已添加");
      }
      setAssetDrafts((drafts) => ({ ...drafts, [assetComposerKind]: { ...emptyAssetDraft } }));
      setEditingAssetId("");
    } catch (error) {
      showNotice((error as Error).message || "资产保存失败");
    }
  }, [assetComposerKind, assetDrafts, editingAssetId, setAssetDrafts, setEditingAssetId, showNotice]);

  /** 把已有资产载入到编辑表单 */
  const edit = useCallback((asset: ProjectAsset) => {
    setAssetComposerKind(asset.kind);
    setAssetDrafts((drafts) => ({ ...drafts, [asset.kind]: { ...emptyAssetDraft, ...asset } }));
    setEditingAssetId(asset.id);
    showNotice("已载入资产，可在上方表单修改");
  }, [setAssetComposerKind, setAssetDrafts, setEditingAssetId, showNotice]);

  /** 删除资产（带引用检查） */
  const remove = useCallback((selectedProject: Project | undefined, asset: ProjectAsset, requestConfirm: (title: string, description: string, confirmLabel: string, action: () => Promise<void> | void) => void) => {
    if (!selectedProject) return;
    const projectId = selectedProject.id;
    requestConfirm("删除资产", `确认删除资产"${asset.name}"？已经被分镜或剪辑引用的资产会保留引用关系，但显示会回退到占位。`, "删除资产", async () => {
      try {
        await api(`/api/projects/${projectId}/assets/${asset.id}`, { method: "DELETE" });
        setProjectAssets((items) => items.filter((item) => item.id !== asset.id));
        showNotice("资产已删除");
      } catch (error) {
        showNotice((error as Error).message || "资产删除失败");
      }
    });
  }, [setProjectAssets, showNotice]);

  /** 切换收藏状态（PATCH /assets/:id 局部字段） */
  const toggleFavorite = useCallback(async (selectedProject: Project | undefined, asset: ProjectAsset) => {
    if (!selectedProject) return;
    const next = !asset.is_favorite;
    try {
      await api<ProjectAsset>(`/api/projects/${selectedProject.id}/assets/${asset.id}`, { method: "PUT", body: JSON.stringify({ is_favorite: next }) });
      setProjectAssets((items) => items.map((item) => item.id === asset.id ? { ...item, is_favorite: next } : item));
    } catch (error) {
      showNotice((error as Error).message || "资产收藏切换失败");
    }
  }, [setProjectAssets, showNotice]);

  /** 在前端把生成的图片（来自分镜生成）落地为资产，触发确认对话框 */
  const landGeneratedAsset = useCallback((args: { task: unknown; imageUrl: string; projectId: string; kind: ProjectAssetKind; name: string }) => {
    if (!state.setGeneratedAssetDialog) return;
    state.setGeneratedAssetDialog({ task: args.task as any, imageUrl: args.imageUrl, projectId: args.projectId, kind: args.kind, name: args.name });
  }, [state]);

  /** 用户在"生成资产"对话框里确认后，落库 + 局部更新 */
  const confirmLanding = useCallback(async (selectedProject: Project | undefined) => {
    if (!state.generatedAssetDialog) return;
    const dialog = state.generatedAssetDialog;
    if (!selectedProject) return;
    try {
      const created = await api<ProjectAsset>(`/api/projects/${selectedProject.id}/assets`, {
        method: "POST",
        body: JSON.stringify({
          kind: dialog.kind,
          name: dialog.name,
          url: dialog.imageUrl,
          thumbnail_url: dialog.imageUrl,
          tags: [],
          metadata: { source: "storyboard_generation", task_id: (dialog.task as { id?: string })?.id },
        }),
      });
      setProjectAssets((items) => [created, ...items]);
      showNotice("生成结果已加入资产库");
      state.setGeneratedAssetDialog(null);
    } catch (error) {
      showNotice((error as Error).message || "资产保存失败");
    }
  }, [state, setProjectAssets, showNotice]);

  return { submit, edit, remove, toggleFavorite, landGeneratedAsset, confirmLanding };
}
