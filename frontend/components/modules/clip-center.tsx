"use client";

/**
 * 剪辑模块
 *
 * 设计目标：
 * - 复用 FactoryCRUDPage 基座，与角色/场景/道具/分镜/视频/音频同构。
 * - 享受：5秒撤销 / 回收站 / 跨项目复制 / 软删除。
 * - 工具栏通过 `toolbarExtra` 注入「从分镜同步」按钮 + 视图切换（列表/时间轴）。
 * - 时间轴视图由 ClipTimeline 提供（p2-1）。
 */

import { useCallback, useState, useEffect } from "react";
import { Scissors, RefreshCw, List, Clock } from "lucide-react";
import { FactoryCRUDPage, type FactoryCRUDPageProps, getEntityLabel } from "@/components/factory";
import type { FormFieldConfig } from "@/components/ui/form-dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/common/toast";
import { clearApiCache } from "@/lib/api-client";
import { useProjectStore } from "@/lib/stores/project-store";
import { ClipTimeline } from "./clip-timeline";
import {
  listClips,
  createClip,
  updateClip,
  deleteClip,
  syncClips,
  listDeletedClips,
  restoreClip,
  permanentDeleteClips,
  copyClipToProjects,
} from "@/services/clip.service";
import type { ProjectClip, ProjectClipStatus } from "@/lib/app-types";
import { PROJECT_CLIP_STATUS_LABELS, PROJECT_CLIP_STATUS_COLORS, PROJECT_CLIP_STATUS_OPTIONS } from "@/lib/module-dictionaries";

/** 剪辑表单字段。 */
const clipFields: FormFieldConfig[] = [
  { name: "title", label: "标题", type: "text", required: true, placeholder: "请输入剪辑标题" },
  {
    name: "status",
    label: "状态",
    type: "select",
    required: true,
    defaultValue: "todo",
    options: PROJECT_CLIP_STATUS_OPTIONS,
  },
  { name: "episode", label: "集数", type: "number", placeholder: "1", min: 1 },
  { name: "scene", label: "场景", type: "text", placeholder: "如：S01E03" },
  { name: "shot", label: "镜头", type: "text", placeholder: "如：shot-001" },
  { name: "storyboard_id", label: "分镜ID", type: "text", placeholder: "请输入分镜ID" },
  { name: "source_video_url", label: "源视频URL", type: "text", placeholder: "https://..." },
  { name: "duration", label: "时长(秒)", type: "number", placeholder: "0", min: 0 },
  { name: "in_point", label: "入点", type: "text", placeholder: "00:00:00" },
  { name: "out_point", label: "出点", type: "text", placeholder: "00:00:05" },
  { name: "order_index", label: "顺序", type: "number", placeholder: "0", min: 0 },
  { name: "notes", label: "备注", type: "textarea", placeholder: "剪辑要点、节奏、音效…", rows: 2 },
];

/** FactoryCRUDPage 完整配置。 */
const config: FactoryCRUDPageProps<ProjectClip> = {
  title: "剪辑中心",
  description: "从已生成视频的分镜同步并管理剪辑条目",
  entityLabel: "剪辑",
  listTitle: "剪辑列表",
  emptyTitle: "暂无剪辑",
  searchPlaceholder: "搜索标题 / 场景 / 镜头...",

  fetchList: listClips,
  createItem: ((input: Record<string, unknown>) => createClip(String(input.project_id ?? ""), input as Partial<ProjectClip>)) as unknown as (input: Record<string, unknown>) => Promise<ProjectClip>,
  updateItem: ((id: string, input: Record<string, unknown>) => updateClip(String(input.project_id ?? ""), id, input as Partial<ProjectClip>)) as unknown as (id: string, input: Record<string, unknown>) => Promise<ProjectClip>,
  deleteItem: deleteClip as unknown as (id: string) => Promise<void>,
  restoreItem: restoreClip,
  fetchDeleted: listDeletedClips,
  permanentDelete: permanentDeleteClips,
  copyToProjects: copyClipToProjects,

  fields: clipFields,
  toFormValues: (c) => ({
    title: c.title ?? "",
    status: c.status ?? "todo",
    episode: c.episode ?? 1,
    scene: c.scene ?? "",
    shot: c.shot ?? "",
    storyboard_id: c.storyboard_id ?? "",
    source_video_url: c.source_video_url ?? "",
    duration: c.duration ?? 0,
    in_point: c.in_point ?? "",
    out_point: c.out_point ?? "",
    order_index: c.order_index ?? 0,
    notes: c.notes ?? "",
  }),

  gridClassName: "grid-cols-1",

  renderCard: (c, actions) => {
    const status = (c.status ?? "todo") as ProjectClipStatus;
    const color = PROJECT_CLIP_STATUS_COLORS[status] ?? "bg-gray-500/20 text-gray-400";
    const label = PROJECT_CLIP_STATUS_LABELS[status] ?? c.status;
    const display = getEntityLabel(c, "未命名剪辑");
    return (
      <div
        className={`group flex items-center gap-3 rounded-lg border bg-[#202020] p-3 transition-colors ${
          actions.selected
            ? "border-emerald-500 ring-1 ring-emerald-500/40"
            : "border-white/10 hover:border-emerald-500/50"
        }`}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            actions.onToggleSelect();
          }}
          className={`grid h-5 w-5 shrink-0 place-items-center rounded border transition-opacity ${
            actions.selected
              ? "border-emerald-500 bg-emerald-500 opacity-100"
              : "border-white/40 bg-black/30 opacity-0 group-hover:opacity-100 hover:border-emerald-400"
          }`}
          aria-label={actions.selected ? "取消选择" : "选择"}
        >
          {actions.selected && (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-white"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </button>
        <Scissors className="h-4 w-4 shrink-0 text-emerald-400" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-medium text-white">{display}</h3>
            <span className={`rounded px-2 py-0.5 text-xs ${color}`}>{label}</span>
            {c.episode > 0 && <span className="text-xs text-[#888]">第 {c.episode} 集</span>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[#888]">
            {c.scene && <span>场景: {c.scene}</span>}
            {c.shot && <span>镜头: {c.shot}</span>}
            {c.duration > 0 && <span>时长: {c.duration}s</span>}
            {c.in_point && c.out_point && (
              <span>
                {c.in_point} → {c.out_point}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  },

  searchFields: (c, q) => {
    if ((c.title ?? "").toLowerCase().includes(q)) return true;
    if ((c.scene ?? "").toLowerCase().includes(q)) return true;
    if ((c.shot ?? "").toLowerCase().includes(q)) return true;
    if ((c.notes ?? "").toLowerCase().includes(q)) return true;
    return false;
  },

  filterOptions: [{ value: "", label: "全部状态" }, ...PROJECT_CLIP_STATUS_OPTIONS],
  filterField: (c, v) => !v || c.status === v,
  filterPlaceholder: "状态",

  stats: (list) => [
    { label: "剪辑总数", value: list.length, icon: Scissors, color: "emerald" },
    { label: "待剪辑", value: list.filter((c) => c.status === "todo").length, color: "blue" },
    { label: "剪辑中", value: list.filter((c) => c.status === "editing").length, color: "purple" },
    { label: "已完成", value: list.filter((c) => c.status === "done").length, color: "orange" },
  ],
  // 剪辑中心：不展示顶部统计卡片
  showStats: false,
};

export function ClipCenterPage() {
  const [isSyncing, setIsSyncing] = useState(false);
  const selectedProjectId = useProjectStore((s) => s.selectedProjectId);
  const [view, setView] = useState<"list" | "timeline">("list");
  // 时间轴视图自己管理一份数据
  const [timelineClips, setTimelineClips] = useState<ProjectClip[]>([]);
  const [isTimelineLoading, setIsTimelineLoading] = useState<boolean>(false);

  /**
   * 工具栏：注入「从分镜同步」按钮。
   * FactoryCRUDPage 内部已通过 useFactoryEntity 监听相同 projectId，
   * 同步完成后我们 dispatch 一个 window 事件，FactoryCRUDPage 监听后会重新拉取列表。
   */
  const handleSync = useCallback(async () => {
    if (!selectedProjectId) {
      toast.error("未选择项目", "请先在右上角选择或创建项目");
      return;
    }
    setIsSyncing(true);
    try {
      const result = await syncClips(selectedProjectId);
      toast.success("同步完成", `新增/更新 ${result.length} 条剪辑`);
      clearApiCache();
      // 触发 FactoryCRUDPage 重新拉取
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("factory:reload"));
      }
      // 同时刷新时间轴
      const list = await listClips(selectedProjectId);
      setTimelineClips(list);
    } catch (err) {
      toast.error("同步失败", (err as Error).message ?? "请稍后重试");
    } finally {
      setIsSyncing(false);
    }
  }, [selectedProjectId]);

  // 切到时间轴视图时拉取数据
  useEffect(() => {
    if (view !== "timeline" || !selectedProjectId) return;
    let cancelled = false;
    setIsTimelineLoading(true);
    listClips(selectedProjectId)
      .then((list) => {
        if (!cancelled) setTimelineClips(list);
      })
      .catch((err) => console.warn("listClips for timeline failed", err))
      .finally(() => {
        if (!cancelled) setIsTimelineLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [view, selectedProjectId]);

  const toolbarExtra = (
    <div className="flex items-center gap-2">
      <div className="flex rounded-md border border-white/10 bg-[#1a1a1a] p-0.5">
        <button
          type="button"
          onClick={() => setView("list")}
          className={`flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors ${
            view === "list"
              ? "bg-emerald-500/20 text-emerald-300"
              : "text-[#888] hover:text-white"
          }`}
        >
          <List className="h-3 w-3" />
          列表
        </button>
        <button
          type="button"
          onClick={() => setView("timeline")}
          className={`flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors ${
            view === "timeline"
              ? "bg-emerald-500/20 text-emerald-300"
              : "text-[#888] hover:text-white"
          }`}
        >
          <Clock className="h-3 w-3" />
          时间轴
        </button>
      </div>
      <Button
        variant="secondary"
        size="sm"
        onClick={handleSync}
        disabled={isSyncing || !selectedProjectId}
      >
        <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
        {isSyncing ? "同步中..." : "从分镜同步"}
      </Button>
    </div>
  );

  if (view === "timeline") {
    return (
      <FactoryCRUDPage<ProjectClip>
        {...config}
        toolbarExtra={toolbarExtra}
        // 时间轴模式下隐藏内置列表卡槽（不渲染卡片）
        renderCard={() => null}
        extraToolbarContent={
          isTimelineLoading ? (
            <div className="p-8 text-center text-sm text-[#666]">加载中...</div>
          ) : (
            <ClipTimeline clips={timelineClips} />
          )
        }
      />
    );
  }

  return <FactoryCRUDPage<ProjectClip> {...config} toolbarExtra={toolbarExtra} />;
}
