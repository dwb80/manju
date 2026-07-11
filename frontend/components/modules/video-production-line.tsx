"use client";

/**
 * 视频生产线模块
 *
 * 设计原则同分镜：复用 FactoryCRUDPage 基座，与三厂同构。
 *
 * 增强点（p1-1）：
 * - 缩略图（image_url）展示
 * - 内嵌 HTML5 播放器（file_url）
 * - 处理中状态进度轮询（每 3s）
 * - 失败状态：失败原因 + 重试 / 重新生成 按钮
 */

import { useEffect, useState, useRef } from "react";
import { Video, Pencil, Trash2, CheckSquare, RefreshCcw, RotateCcw, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FactoryCRUDPage, type FactoryCRUDPageProps, getEntityLabel } from "@/components/factory";
import { toast } from "@/components/common/toast";
import type { FormFieldConfig } from "@/components/ui/form-dialog";
import type { VideoTask } from "@/lib/module-types";
import {
  listModuleVideoTasks,
  createModuleVideoTask,
  updateModuleVideoTask,
  deleteModuleVideoTask,
  listDeletedVideos,
  restoreVideo,
  permanentDeleteVideos,
  copyVideoToProjects,
  retryVideoTask,
  regenerateVideo,
  syncVideoTaskStatus,
} from "@/services/module-video.service";
import {
  VIDEO_STATUS_LABELS,
  VIDEO_STATUS_COLORS,
  VIDEO_STATUS_OPTIONS,
} from "@/lib/module-dictionaries";

/** 视频任务表单字段。 */
const videoFields: FormFieldConfig[] = [
  { name: "title", label: "视频标题", type: "text", required: true, placeholder: "请输入视频标题" },
  {
    name: "status",
    label: "状态",
    type: "select",
    required: true,
    options: VIDEO_STATUS_OPTIONS,
    defaultValue: "queued",
  },
  { name: "episode", label: "集数", type: "number", placeholder: "1", min: 1, defaultValue: 1 },
  { name: "duration", label: "时长(秒)", type: "number", placeholder: "0", min: 0 },
  { name: "progress", label: "进度(0-100)", type: "number", placeholder: "0", min: 0, max: 100 },
  { name: "resolution", label: "分辨率", type: "text", placeholder: "如：1080p, 4K" },
  { name: "fps", label: "帧率", type: "number", placeholder: "30", min: 0 },
  { name: "format", label: "格式", type: "text", placeholder: "如：mp4, mov" },
  { name: "file_url", label: "文件地址", type: "text", placeholder: "请输入文件URL" },
];

/** 集数下拉选项（1-20）。 */
const episodeOptions: { value: string; label: string }[] = [
  { value: "", label: "全部集数" },
  ...Array.from({ length: 20 }, (_, i) => ({ value: String(i + 1), label: `第 ${i + 1} 集` })),
];

/**
 * 视频任务卡片（含缩略图、内嵌播放器、进度轮询、失败重试/重新生成）
 */
function VideoCard({
  v,
  actions,
  onUpdate,
}: {
  v: VideoTask;
  actions: import("@/components/factory").CardActions;
  onUpdate?: (v: VideoTask) => void;
}) {
  const status = v.status ?? "queued";
  const color =
    VIDEO_STATUS_COLORS[status as keyof typeof VIDEO_STATUS_COLORS] ?? "bg-gray-500/20 text-gray-400";
  const label = VIDEO_STATUS_LABELS[status as keyof typeof VIDEO_STATUS_LABELS] ?? status;
  const progress = status === "completed" ? 100 : v.progress ?? 0;
  const display = getEntityLabel(v, "未命名视频");
  const [expanded, setExpanded] = useState<boolean>(false);
  const [busy, setBusy] = useState<"retry" | "regenerate" | "sync" | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 进度轮询：processing / queued 状态下每 3 秒拉取一次最新状态
  useEffect(() => {
    if (status !== "processing" && status !== "queued") {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }
    pollingRef.current = setInterval(async () => {
      try {
        const updated = (await syncVideoTaskStatus(v.id, {})) as VideoTask;
        if (onUpdate && updated) onUpdate(updated);
      } catch (err) {
        console.warn("syncVideoTaskStatus failed", err);
      }
    }, 3000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [status, v.id, onUpdate]);

  const handleRetry = async () => {
    if (busy) return;
    setBusy("retry");
    try {
      await retryVideoTask(v.id);
      toast.success("已提交重试", "视频任务已重新加入队列");
    } catch (err) {
      toast.error("重试失败", (err as Error)?.message ?? "请稍后重试");
    } finally {
      setBusy(null);
    }
  };

  const handleRegenerate = async () => {
    if (busy) return;
    setBusy("regenerate");
    try {
      await regenerateVideo(v.id, {});
      toast.success("已重新生成", "已基于最新参数重新生成视频");
    } catch (err) {
      toast.error("重新生成失败", (err as Error)?.message ?? "请稍后重试");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      className={`group relative rounded-lg border bg-[#202020] p-4 transition-colors ${
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
        className={`absolute left-2 top-2 z-10 grid h-5 w-5 place-items-center rounded border transition-opacity ${
          actions.selected
            ? "border-emerald-500 bg-emerald-500 opacity-100"
            : "border-white/40 bg-black/30 opacity-0 group-hover:opacity-100 hover:border-emerald-400"
        }`}
        aria-label={actions.selected ? "取消选择" : "选择"}
      >
        {actions.selected && <CheckSquare className="h-3 w-3 text-white" />}
      </button>

      <div className="pl-7">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <h3 className="text-sm font-medium text-white truncate">{display}</h3>
          <span className={`px-2 py-0.5 rounded text-xs ${color}`}>{label}</span>
          <span className="text-emerald-300/90 bg-emerald-500/10 px-1.5 py-0.5 rounded text-xs">
            第 {v.episode ?? 1} 集
          </span>
          <span className="text-xs text-[#888]">时长: {v.duration ?? 0}s</span>
          {v.resolution && <span className="text-xs text-[#888]">{v.resolution}</span>}
          {v.fps ? <span className="text-xs text-[#888]">{v.fps} FPS</span> : null}
        </div>

        {/* 缩略图 / 播放器 */}
        {v.file_url && status === "completed" ? (
          <div className="mb-2">
            {expanded ? (
              <video
                src={v.file_url}
                controls
                className="w-full max-h-72 rounded border border-white/10 bg-black"
                poster={v.image_url || undefined}
              />
            ) : (
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="relative w-full max-h-48 aspect-video rounded border border-white/10 overflow-hidden group/preview"
              >
                {v.image_url ? (
                  <img src={v.image_url} alt={display} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-[#1a1a1a] grid place-items-center text-[#666] text-xs">
                    视频已生成
                  </div>
                )}
                <span className="absolute inset-0 grid place-items-center bg-black/30 group-hover/preview:bg-black/50 transition-colors">
                  <Play className="h-10 w-10 text-white opacity-80" />
                </span>
              </button>
            )}
          </div>
        ) : v.image_url ? (
          <div className="mb-2">
            <img
              src={v.image_url}
              alt={display}
              className="w-full max-h-40 rounded border border-white/10 object-cover"
            />
          </div>
        ) : null}

        {/* 进度条（处理中 / 排队） */}
        {(status === "processing" || status === "queued") && (
          <div className="mb-2">
            <div className="w-full bg-[#1a1a1a] rounded-full h-2 mb-1">
              <div
                className="bg-emerald-500 h-2 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="text-[10px] text-emerald-300/80">
              {status === "queued" ? "排队中..." : "处理中..."} {progress}%
            </div>
          </div>
        )}

        {/* 错误信息 + 重试 / 重新生成 */}
        {status === "failed" && (
          <div className="mb-2 rounded border border-red-500/40 bg-red-500/10 p-2">
            <div className="text-xs text-red-300 mb-1.5">生成失败：{v.error || "未知错误"}</div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={handleRetry}
                disabled={busy !== null}
              >
                <RefreshCcw className={`mr-1 h-3 w-3 ${busy === "retry" ? "animate-spin" : ""}`} />
                {busy === "retry" ? "重试中..." : "重试"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleRegenerate}
                disabled={busy !== null}
                className="text-emerald-300"
              >
                <RotateCcw className="mr-1 h-3 w-3" />
                重新生成
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-4 text-xs text-[#888]">
          {v.resolution && <span>分辨率: {v.resolution}</span>}
          {v.fps ? <span>帧率: {v.fps}</span> : null}
          {v.format && <span>格式: {v.format}</span>}
          {v.tags && v.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {v.tags.slice(0, 3).map((tag, idx) => (
                <span key={idx} className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400">{tag}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="sm" onClick={actions.onEdit} className="flex-1">
          <Pencil className="mr-1 h-3 w-3" />
          编辑
        </Button>
        <Button variant="ghost" size="sm" onClick={actions.onDelete} className="text-red-400">
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

const config: FactoryCRUDPageProps<VideoTask> = {
  title: "视频生产线",
  description: "管理视频生成与编辑流程",
  entityLabel: "视频",
  listTitle: "视频任务",
  emptyTitle: "未找到视频",
  searchPlaceholder: "搜索视频标题、分辨率、格式...",

  fetchList: listModuleVideoTasks,
  createItem: createModuleVideoTask as unknown as (input: Record<string, unknown>) => Promise<VideoTask>,
  updateItem: updateModuleVideoTask as unknown as (id: string, input: Record<string, unknown>) => Promise<VideoTask>,
  deleteItem: deleteModuleVideoTask,
  restoreItem: restoreVideo,
  fetchDeleted: listDeletedVideos,
  permanentDelete: permanentDeleteVideos,
  copyToProjects: copyVideoToProjects,

  fields: videoFields,
  toFormValues: (v) => ({
    title: v.title ?? "",
    status: v.status ?? "queued",
    episode: v.episode ?? 1,
    duration: v.duration ?? 0,
    progress: v.progress ?? 0,
    resolution: v.resolution ?? "",
    fps: v.fps ?? 0,
    format: v.format ?? "",
    file_url: v.file_url ?? "",
  }),

  gridClassName: "grid-cols-1",

  // P0-5：集数二级筛选
  secondaryFilter: {
    options: episodeOptions,
    placeholder: "集数",
    match: (v, val) => !val || String(v.episode ?? 1) === val,
  },

  renderCard: (v, actions) => <VideoCard v={v} actions={actions} />,

  searchFields: (v, q) => {
    if ((v.title ?? "").toLowerCase().includes(q)) return true;
    if ((v.resolution ?? "").toLowerCase().includes(q)) return true;
    if ((v.format ?? "").toLowerCase().includes(q)) return true;
    return false;
  },

  filterOptions: [
    { value: "", label: "全部状态" },
    ...VIDEO_STATUS_OPTIONS,
  ],
  filterField: (v, val) => !val || v.status === val,
  filterPlaceholder: "状态",

  stats: (list) => {
    const totalDuration = list.reduce((sum, v) => sum + (v.duration ?? 0), 0);
    const hours = Math.floor(totalDuration / 3600);
    const minutes = Math.floor((totalDuration % 3600) / 60);
    return [
      { label: "视频总数", value: list.length, icon: Video, color: "emerald" },
      { label: "处理中", value: list.filter((v) => v.status === "processing" || v.status === "queued").length, color: "blue" },
      { label: "已完成", value: list.filter((v) => v.status === "completed").length, color: "purple" },
      { label: "总时长", value: `${hours}h ${minutes}m`, color: "orange" },
    ];
  },
};

export function VideoProductionLinePage() {
  return <FactoryCRUDPage<VideoTask> {...config} />;
}
