"use client";

/**
 * 视频生产线模块
 *
 * 设计原则同分镜：复用 FactoryCRUDPage 基座，与三厂同构。
 */

import { Video, Pencil, Trash2, CheckSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FactoryCRUDPage, type FactoryCRUDPageProps, getEntityLabel } from "@/components/factory";
import type { FormFieldConfig } from "@/components/ui/form-dialog";
import type { VideoTask } from "@/lib/module-types";
import {
  listModuleVideoTasks,
  createModuleVideoTask,
  updateModuleVideoTask,
  deleteModuleVideoTask,
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
  { name: "duration", label: "时长(秒)", type: "number", placeholder: "0", min: 0 },
  { name: "progress", label: "进度(0-100)", type: "number", placeholder: "0", min: 0, max: 100 },
  { name: "resolution", label: "分辨率", type: "text", placeholder: "如：1080p, 4K" },
  { name: "fps", label: "帧率", type: "number", placeholder: "30", min: 0 },
  { name: "format", label: "格式", type: "text", placeholder: "如：mp4, mov" },
  { name: "file_url", label: "文件地址", type: "text", placeholder: "请输入文件URL" },
];

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

  fields: videoFields,
  toFormValues: (v) => ({
    title: v.title ?? "",
    status: v.status ?? "queued",
    duration: v.duration ?? 0,
    progress: v.progress ?? 0,
    resolution: v.resolution ?? "",
    fps: v.fps ?? 0,
    format: v.format ?? "",
    file_url: v.file_url ?? "",
  }),

  gridClassName: "grid-cols-1",

  renderCard: (v, actions) => {
    const status = v.status ?? "queued";
    const color = VIDEO_STATUS_COLORS[status as keyof typeof VIDEO_STATUS_COLORS] ?? "bg-gray-500/20 text-gray-400";
    const label = VIDEO_STATUS_LABELS[status as keyof typeof VIDEO_STATUS_LABELS] ?? status;
    const progress = status === "completed" ? 100 : v.progress ?? 0;
    const display = getEntityLabel(v, "未命名视频");
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
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-medium text-white truncate">{display}</h3>
            <span className={`px-2 py-0.5 rounded text-xs ${color}`}>{label}</span>
            <span className="text-xs text-[#888]">时长: {v.duration ?? 0}s</span>
          </div>
          {(status === "processing" || status === "queued") && (
            <div className="w-full bg-[#1a1a1a] rounded-full h-2 mb-2">
              <div className="bg-emerald-500 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
          )}
          <div className="flex flex-wrap items-center gap-4 text-xs text-[#888]">
            {v.resolution && <span>分辨率: {v.resolution}</span>}
            {v.fps ? <span>帧率: {v.fps}</span> : null}
            {v.format && <span>格式: {v.format}</span>}
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
  },

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
