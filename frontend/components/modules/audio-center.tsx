"use client";

/**
 * 音频中心模块
 *
 * 设计原则同分镜 / 视频：复用 FactoryCRUDPage 基座。
 */

import { Music, Pencil, Trash2, CheckSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FactoryCRUDPage, type FactoryCRUDPageProps, getEntityLabel } from "@/components/factory";
import type { FormFieldConfig } from "@/components/ui/form-dialog";
import type { AudioItem, AudioType } from "@/lib/module-types";
import {
  listAudios,
  createAudio,
  updateAudio,
  deleteAudio,
} from "@/services/audio.service";
import {
  AUDIO_TYPE_LABELS,
  AUDIO_TYPE_COLORS,
  AUDIO_TYPE_OPTIONS,
} from "@/lib/module-dictionaries";

/** 音频表单字段。 */
const audioFields: FormFieldConfig[] = [
  { name: "name", label: "音频名称", type: "text", required: true, placeholder: "请输入音频名称" },
  {
    name: "type",
    label: "音频类型",
    type: "select",
    required: true,
    options: AUDIO_TYPE_OPTIONS,
    defaultValue: "voiceover",
  },
  { name: "duration", label: "时长（秒）", type: "number", placeholder: "0", min: 0 },
  { name: "file_url", label: "文件路径", type: "text", placeholder: "请输入文件路径" },
  { name: "speaker", label: "说话人", type: "text", placeholder: "请输入说话人" },
  { name: "format", label: "格式", type: "text", placeholder: "mp3" },
];

/** 把秒数格式化为 m:ss。 */
function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const config: FactoryCRUDPageProps<AudioItem> = {
  title: "音频中心",
  description: "管理音频素材与配音",
  entityLabel: "音频",
  listTitle: "音频素材",
  emptyTitle: "未找到音频",
  searchPlaceholder: "搜索音频名称、说话人、格式...",

  fetchList: listAudios,
  createItem: createAudio as unknown as (input: Record<string, unknown>) => Promise<AudioItem>,
  updateItem: updateAudio as unknown as (id: string, input: Record<string, unknown>) => Promise<AudioItem>,
  deleteItem: deleteAudio,

  fields: audioFields,
  toFormValues: (a) => ({
    name: a.name ?? "",
    type: a.type ?? "voiceover",
    duration: a.duration ?? 0,
    file_url: a.file_url ?? "",
    speaker: a.speaker ?? "",
    format: a.format ?? "",
  }),

  gridClassName: "grid-cols-1",

  renderCard: (a, actions) => {
    const type = (a.type ?? "voiceover") as AudioType;
    const color = AUDIO_TYPE_COLORS[type] ?? "bg-gray-500/20 text-gray-400";
    const label = AUDIO_TYPE_LABELS[type] ?? type;
    const display = getEntityLabel(a, "未命名音频");
    return (
      <div
        className={`group relative flex items-center gap-3 rounded-lg border bg-[#202020] p-3 transition-colors ${
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
          {actions.selected && <CheckSquare className="h-3 w-3 text-white" />}
        </button>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
          <Music className="h-5 w-5 text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium text-white text-sm truncate">{display}</h3>
            <span className={`px-2 py-0.5 rounded text-xs ${color}`}>{label}</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-[#888]">
            <span>时长: {formatDuration(a.duration ?? 0)}</span>
            {a.speaker && <span>说话人: {a.speaker}</span>}
            {a.format && <span>格式: {a.format}</span>}
          </div>
        </div>
        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="sm" onClick={actions.onEdit}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={actions.onDelete} className="text-red-400">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  },

  searchFields: (a, q) => {
    if ((a.name ?? "").toLowerCase().includes(q)) return true;
    if ((a.speaker ?? "").toLowerCase().includes(q)) return true;
    if ((a.format ?? "").toLowerCase().includes(q)) return true;
    return false;
  },

  filterOptions: [
    { value: "", label: "全部类型" },
    ...AUDIO_TYPE_OPTIONS,
  ],
  filterField: (a, v) => !v || a.type === v,
  filterPlaceholder: "音频类型",

  stats: (list) => [
    { label: "音频总数", value: list.length, icon: Music, color: "emerald" },
    { label: "配音", value: list.filter((a) => a.type === "voiceover").length, color: "blue" },
    { label: "背景音乐", value: list.filter((a) => a.type === "bgm").length, color: "purple" },
    { label: "音效", value: list.filter((a) => a.type === "sfx").length, color: "orange" },
  ],
};

export function AudioCenterPage() {
  return <FactoryCRUDPage<AudioItem> {...config} />;
}
