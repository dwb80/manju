"use client";

/**
 * 分镜导演台模块
 *
 * 设计原则：
 * - 复用 FactoryCRUDPage 基座，与三厂同构，享受：5秒撤销 / 回收站 / 批量改状态。
 * - 字段配置 / 卡片渲染 / 搜索 / 状态映射全部走本地 config。
 * - 状态枚举与中文标签从 module-dictionaries 共享，避免重复。
 */

import { useEffect, useState, useMemo } from "react";
import { Film, Pencil, Trash2, CheckSquare, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FactoryCRUDPage, type FactoryCRUDPageProps, getEntityLabel } from "@/components/factory";
import type { FormFieldConfig } from "@/components/ui/form-dialog";
import { toast } from "@/components/common/toast";
import { useProjectStore } from "@/lib/stores/project-store";
import { clearApiCache } from "@/lib/api-client";
import { useNameLookup } from "@/hooks/use-name-lookup";
import type { Storyboard, Scene } from "@/lib/module-types";
import {
  listStoryboards,
  createStoryboard,
  updateStoryboard,
  deleteStoryboard,
  listDeletedStoryboards,
  restoreStoryboard,
  permanentDeleteStoryboards,
  copyStoryboardToProjects,
  generateVideoFromStoryboard,
} from "@/services/storyboard.service";
import { getScenesByIds } from "@/services/scene.service";
import {
  STORYBOARD_STATUS_LABELS,
  STORYBOARD_STATUS_COLORS,
  STORYBOARD_STATUS_OPTIONS,
} from "@/lib/module-dictionaries";

/** 分镜表单字段配置。 */
const storyboardFields: FormFieldConfig[] = [
  { name: "description", label: "分镜描述", type: "textarea", required: true, placeholder: "请输入分镜描述", rows: 3 },
  {
    name: "status",
    label: "状态",
    type: "select",
    required: true,
    options: STORYBOARD_STATUS_OPTIONS,
    defaultValue: "draft",
  },
  { name: "episode", label: "集数", type: "number", placeholder: "1", min: 1, defaultValue: 1 },
  { name: "shot_number", label: "镜头号", type: "number", placeholder: "1", min: 1 },
  { name: "duration", label: "时长(秒)", type: "number", placeholder: "5", min: 1 },
  { name: "camera_angle", label: "机位", type: "text", placeholder: "如：全景、特写、仰角" },
  { name: "movement", label: "运动", type: "text", placeholder: "如：固定、跟随、环绕" },
  { name: "dialogue", label: "台词", type: "textarea", placeholder: "请输入台词内容", rows: 2 },
  { name: "notes", label: "备注", type: "textarea", placeholder: "请输入备注信息", rows: 2 },
  { name: "scene_id", label: "场景ID", type: "text", placeholder: "请输入场景ID" },
];

/** 集数下拉选项（1-20）。 */
const episodeOptions: { value: string; label: string }[] = [
  { value: "", label: "全部集数" },
  ...Array.from({ length: 20 }, (_, i) => ({ value: String(i + 1), label: `第 ${i + 1} 集` })),
];

/** FactoryCRUDPage 完整配置。 */
const config: FactoryCRUDPageProps<Storyboard> = {
  title: "分镜导演台",
  description: "设计与编排漫剧分镜",
  entityLabel: "分镜",
  listTitle: "分镜时间轴",
  emptyTitle: "未找到分镜",
  searchPlaceholder: "搜索分镜描述、台词、备注...",

  fetchList: listStoryboards,
  createItem: createStoryboard as unknown as (input: Record<string, unknown>) => Promise<Storyboard>,
  updateItem: updateStoryboard as unknown as (id: string, input: Record<string, unknown>) => Promise<Storyboard>,
  deleteItem: deleteStoryboard,
  restoreItem: restoreStoryboard,
  fetchDeleted: listDeletedStoryboards,
  permanentDelete: permanentDeleteStoryboards,
  copyToProjects: copyStoryboardToProjects,

  fields: storyboardFields,
  toFormValues: (sb) => ({
    description: sb.description ?? "",
    status: sb.status ?? "draft",
    episode: sb.episode ?? 1,
    shot_number: sb.shot_number ?? 0,
    duration: sb.duration ?? 0,
    camera_angle: sb.camera_angle ?? "",
    movement: sb.movement ?? "",
    dialogue: sb.dialogue ?? "",
    notes: sb.notes ?? "",
    scene_id: sb.scene_id ?? "",
  }),

  /** 分镜是纵向时间轴，用单列长卡片。 */
  gridClassName: "grid-cols-1",

  // P0-5：集数二级筛选
  secondaryFilter: {
    options: episodeOptions,
    placeholder: "集数",
    match: (sb, v) => !v || String(sb.episode ?? 1) === v,
  },

  // P1-3：renderCard 拆为 StoryboardRow 组件，外部注入 sceneNameMap。
  // 真正的渲染在 <StoryboardDirectorPage /> 中以 JSX 形式提供。
  // 此处占位渲染（保证 type 与行为一致）见下方 StoryboardRow。
  renderCard: (sb, actions) => (
    <div className="rounded-lg border border-white/10 bg-[#202020] p-4 text-xs text-[#666]">
      {sb.description || getEntityLabel(sb, "占位分镜")}
    </div>
  ),

  /** 搜索覆盖 description / dialogue / notes。 */
  searchFields: (sb, q) => {
    if ((sb.description ?? "").toLowerCase().includes(q)) return true;
    if ((sb.dialogue ?? "").toLowerCase().includes(q)) return true;
    if ((sb.notes ?? "").toLowerCase().includes(q)) return true;
    if (sb.camera_angle?.toLowerCase().includes(q)) return true;
    return false;
  },

  filterOptions: [
    { value: "", label: "全部状态" },
    ...STORYBOARD_STATUS_OPTIONS,
  ],
  filterField: (sb, v) => !v || sb.status === v,
  filterPlaceholder: "状态",

  stats: (list) => [
    { label: "分镜总数", value: list.length, icon: Film, color: "emerald" },
    { label: "草稿", value: list.filter((s) => s.status === "draft").length, color: "blue" },
    { label: "审核中", value: list.filter((s) => s.status === "approved" || s.status === "production").length, color: "purple" },
    { label: "已完成", value: list.filter((s) => s.status === "completed").length, color: "orange" },
  ],
};

/**
 * 单条分镜行（含场景名反向展示）
 */
function StoryboardRow({
  sb,
  actions,
  sceneNameMap,
}: {
  sb: Storyboard;
  actions: import("@/components/factory").CardActions;
  sceneNameMap: Record<string, string>;
}) {
  const status = sb.status ?? "draft";
  const color =
    STORYBOARD_STATUS_COLORS[status as keyof typeof STORYBOARD_STATUS_COLORS] ??
    "bg-gray-500/20 text-gray-400";
  const label = STORYBOARD_STATUS_LABELS[status as keyof typeof STORYBOARD_STATUS_LABELS] ?? status;
  const display = getEntityLabel(sb, "未命名分镜");
  const sceneName = sb.scene_id ? sceneNameMap[sb.scene_id] : undefined;
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

      <div className="flex items-start gap-3 pl-7">
        <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded bg-[#1a1a1a] text-emerald-400 font-bold text-lg">
          {sb.shot_number ?? "-"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`px-2 py-0.5 rounded text-xs ${color}`}>{label}</span>
            <span className="text-xs text-emerald-300/90 bg-emerald-500/10 px-1.5 py-0.5 rounded">
              第 {sb.episode ?? 1} 集
            </span>
            <span className="text-xs text-[#888]">时长: {sb.duration ?? 0}s</span>
            {sb.scene_id && (
              <span className="text-xs text-[#888]">
                场景：
                {sceneName ? (
                  <span className="text-white/80">{sceneName}</span>
                ) : (
                  <span className="text-[#666]">未命名</span>
                )}
              </span>
            )}
          </div>
          <p className="text-sm text-white line-clamp-2">{display}</p>
          {sb.dialogue && (
            <p className="mt-1 text-sm text-white/70 italic line-clamp-1">"{sb.dialogue}"</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-[#666]">
            {sb.camera_angle && <span>机位: {sb.camera_angle}</span>}
            {sb.movement && <span>运动: {sb.movement}</span>}
          </div>
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

export function StoryboardDirectorPage() {
  const selectedProjectId = useProjectStore((s) => s.selectedProjectId);
  const [list, setList] = useState<Storyboard[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  /**
   * 一键生成视频（P0-1）：
   * 选中若干分镜（来自 FactoryCRUDPage 的 selectedIds），
   * 逐个调用 generateVideoFromStoryboard。
   */
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 监听 FactoryCRUDPage 内的 selectedIds 变化（通过 DOM data 属性同步，简单可靠）
  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = setInterval(() => {
      const container = document.querySelector("[data-factory-selected]");
      if (!container) return;
      try {
        const raw = container.getAttribute("data-factory-selected") ?? "[]";
        const ids: string[] = JSON.parse(raw);
        setSelectedIds((prev) => {
          const next = new Set(ids);
          if (next.size === prev.size && Array.from(next).every((x) => prev.has(x))) return prev;
          return next;
        });
      } catch {
        // ignore parse errors
      }
    }, 500);
    return () => clearInterval(id);
  }, []);

  // P1-3：单独拉一次分镜列表（用于收集 scene_id），然后 useNameLookup 反查场景名
  useEffect(() => {
    if (!selectedProjectId) {
      setList([]);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    listStoryboards(selectedProjectId)
      .then((data) => {
        if (!cancelled) setList(data);
      })
      .catch((err) => console.warn("listStoryboards for lookup failed", err))
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedProjectId]);

  const sceneIds = useMemo(
    () => list.map((s) => s.scene_id).filter((x): x is string => Boolean(x)),
    [list],
  );

  const fetcher = useMemo(
    () => async (ids: string[]) => {
      if (!selectedProjectId) return [];
      return getScenesByIds(selectedProjectId, ids);
    },
    [selectedProjectId],
  );

  const sceneNameMap = useNameLookup<Scene>(sceneIds, fetcher, (items, ids) => {
    const m: Record<string, string> = {};
    for (const it of items) m[it.id] = it.name;
    for (const id of ids) if (!(id in m)) m[id] = "";
    return m;
  });

  const handleGenerate = async () => {
    if (!selectedProjectId) {
      toast.error("未选择项目", "请先在右上角选择或创建项目");
      return;
    }
    if (selectedIds.size === 0) {
      toast.error("未选择分镜", "请先在卡片上勾选要生成分镜");
      return;
    }
    setIsGenerating(true);
    try {
      let ok = 0;
      for (const id of Array.from(selectedIds)) {
        try {
          await generateVideoFromStoryboard(id, { project_id: selectedProjectId });
          ok += 1;
        } catch (err) {
          console.error("generate video failed", id, err);
        }
      }
      toast.success("已提交生成", `${ok}/${selectedIds.size} 个分镜已加入视频生产线`);
      clearApiCache();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("factory:reload"));
      }
    } finally {
      setIsGenerating(false);
    }
  };

  // 静默吸收 isLoading（避免未使用变量警告）
  void isLoading;

  return (
    <FactoryCRUDPage<Storyboard>
      {...config}
      toolbarExtra={
        <Button
          variant="secondary"
          size="sm"
          onClick={handleGenerate}
          disabled={isGenerating}
        >
          <Wand2 className={`mr-2 h-4 w-4 ${isGenerating ? "animate-pulse" : ""}`} />
          {isGenerating ? "生成中..." : `一键生成视频（${selectedIds.size}）`}
        </Button>
      }
      renderCard={(sb, actions) => (
        <StoryboardRow sb={sb} actions={actions} sceneNameMap={sceneNameMap} />
      )}
    />
  );
}
