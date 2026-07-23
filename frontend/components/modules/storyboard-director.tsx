"use client";

/**
 * 分镜导演台模块（V2 父子结构）
 *
 * 设计原则：
 * - 复用 FactoryCRUDPage 基座，与三厂同构，享受：5秒撤销 / 回收站 / 批量改状态。
 * - 字段配置 / 卡片渲染 / 搜索 / 状态映射全部走本地 config。
 * - 状态枚举与中文标签从 module-dictionaries 共享，避免重复。
 * - V2：分镜（Storyboard）= 导演台层面，镜头（Shot）= 生产层面，分镜可包含多个镜头。
 */

import { useEffect, useState, useMemo } from "react";
import { Film, Pencil, Trash2, CheckSquare, Wand2, Users, Package, Scissors, Plus, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FactoryCRUDPage, type FactoryCRUDPageProps, getEntityLabel } from "@/components/factory";
import type { FormFieldConfig } from "@/components/ui/form-dialog";
import { toast } from "@/components/common/toast";
import { useProjectStore } from "@/lib/stores/project-store";
import { clearApiCache } from "@/lib/api-client";
import { useNameLookup } from "@/hooks/use-name-lookup";
import type { Storyboard, Shot, Scene, Character, Prop } from "@/lib/module-types";
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
  generateVideoFromShot,
  listShots,
  createShot,
  deleteShot,
  autoSplitShots,
} from "@/services/storyboard.service";
import { getScenesByIds } from "@/services/scene.service";
import { listCharacters } from "@/services/character.service";
import { listProps } from "@/services/prop.service";
import {
  STORYBOARD_STATUS_LABELS,
  STORYBOARD_STATUS_COLORS,
  STORYBOARD_STATUS_OPTIONS,
  SHOT_STATUS_LABELS,
  SHOT_STATUS_COLORS,
} from "@/lib/module-dictionaries";

/** 角色类型中文标签（与角色工厂保持一致）。 */
const characterRoleLabels: Record<string, string> = {
  protagonist: "主角",
  supporting: "配角",
  antagonist: "反派",
  minor: "次要",
};

/** 道具类别中文标签。 */
const propCategoryLabels: Record<string, string> = {
  weapon: "武器",
  tool: "工具",
  clothing: "服饰",
  food: "食物",
  vehicle: "交通",
  artifact: "法宝",
  furniture: "家具",
  other: "其他",
};

/** 分镜表单字段配置（V2：纯分镜字段）。 */
const storyboardFields: FormFieldConfig[] = [
  { name: "title", label: "分镜标题", type: "text", required: true, placeholder: "请输入分镜标题" },
  { name: "description", label: "分镜描述", type: "textarea", required: true, placeholder: "请输入分镜描述（导演意图、场景概述）", rows: 3 },
  {
    name: "status",
    label: "状态",
    type: "select",
    required: true,
    options: STORYBOARD_STATUS_OPTIONS,
    defaultValue: "draft",
  },
  { name: "episode", label: "集数", type: "number", placeholder: "1", min: 1, defaultValue: 1 },
  { name: "storyboard_number", label: "分镜编号", type: "text", placeholder: "如：SB-001" },
  { name: "dialogue", label: "对白", type: "textarea", placeholder: "请输入对白内容（用于 AI 拆分镜头）", rows: 2 },
  { name: "notes", label: "备注", type: "textarea", placeholder: "请输入备注信息", rows: 2 },
  { name: "scene_id", label: "场景ID", type: "text", placeholder: "请输入场景ID" },
  {
    name: "character_asset_ids",
    label: "出场角色（多选）",
    type: "entity-multi",
    placeholder: "点击选择角色...",
    entityMultiConfig: {
      fetcher: (projectId: string) => listCharacters(projectId),
      formatLabel: (c) => (c as { name?: string }).name ?? "",
      formatHint: (c) => {
        const role = (c as { role?: string }).role;
        return role ? characterRoleLabels[role] ?? role : "";
      },
    },
  },
  {
    name: "prop_asset_ids",
    label: "相关道具（多选）",
    type: "entity-multi",
    placeholder: "点击选择道具...",
    entityMultiConfig: {
      fetcher: (projectId: string) => listProps(projectId),
      formatLabel: (p) => (p as { name?: string }).name ?? "",
      formatHint: (p) => {
        const category = (p as { category?: string }).category;
        return category ? propCategoryLabels[category] ?? category : "";
      },
    },
  },
];

/** 集数下拉选项（1-20）。 */
const episodeOptions: { value: string; label: string }[] = [
  { value: "", label: "全部集数" },
  ...Array.from({ length: 20 }, (_, i) => ({ value: String(i + 1), label: `第 ${i + 1} 集` })),
];

/** FactoryCRUDPage 完整配置。 */
const config: FactoryCRUDPageProps<Storyboard> = {
  title: "分镜导演台",
  description: "设计与编排漫剧分镜（V2 父子结构：分镜 → 镜头）",
  entityLabel: "分镜",
  listTitle: "分镜时间轴",
  emptyTitle: "未找到分镜",
  searchPlaceholder: "搜索分镜标题、描述、对白、备注...",

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
    title: sb.title ?? "",
    description: sb.description ?? "",
    status: sb.status ?? "draft",
    episode: sb.episode ?? 1,
    storyboard_number: sb.storyboard_number ?? "",
    dialogue: sb.dialogue ?? "",
    notes: sb.notes ?? "",
    scene_id: sb.scene_id ?? "",
    character_asset_ids: sb.character_asset_ids ?? [],
    prop_asset_ids: sb.prop_asset_ids ?? [],
  }),

  /** 分镜是纵向时间轴，用单列长卡片。 */
  gridClassName: "grid-cols-1",

  // P0-5：集数二级筛选
  secondaryFilter: {
    options: episodeOptions,
    placeholder: "集数",
    match: (sb, v) => !v || String(sb.episode ?? 1) === v,
  },

  // 占位渲染（真正的渲染在 <StoryboardDirectorPage /> 中以 JSX 形式提供）
  renderCard: (sb, actions) => (
    <div className="rounded-lg border border-white/10 bg-[#202020] p-4 text-xs text-[#666]">
      {sb.title || sb.description || getEntityLabel(sb, "占位分镜")}
    </div>
  ),

  /** 搜索覆盖 title / description / dialogue / notes。 */
  searchFields: (sb, q) => {
    if ((sb.title ?? "").toLowerCase().includes(q)) return true;
    if ((sb.description ?? "").toLowerCase().includes(q)) return true;
    if ((sb.dialogue ?? "").toLowerCase().includes(q)) return true;
    if ((sb.notes ?? "").toLowerCase().includes(q)) return true;
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
    { label: "审核中", value: list.filter((s) => s.status === "in_review").length, color: "orange" },
    { label: "已通过", value: list.filter((s) => s.status === "approved").length, color: "emerald" },
  ],
  // 分镜导演台：不展示顶部统计卡片
  showStats: false,
};

/**
 * 单条分镜行（V2：纯分镜，显示分镜编号/标题/状态，可展开查看镜头）
 */
function StoryboardRow({
  sb,
  actions,
  sceneNameMap,
  characterNameMap,
  propNameMap,
  shots,
  onAddShot,
  onEditShot,
  onDeleteShot,
  onAutoSplit,
  onGenerateVideo,
  onGenerateShotVideo,
  isSplitting,
  isGeneratingVideo,
  generatingShotId,
}: {
  sb: Storyboard;
  actions: import("@/components/factory").CardActions;
  sceneNameMap: Record<string, string>;
  characterNameMap: Record<string, string>;
  propNameMap: Record<string, string>;
  shots: Shot[];
  onAddShot: (storyboardId: string) => void;
  onEditShot: (shot: Shot) => void;
  onDeleteShot: (shotId: string) => void;
  onAutoSplit: (storyboardId: string) => void;
  onGenerateVideo: (storyboardId: string) => void;
  onGenerateShotVideo: (storyboardId: string, shotId: string) => void;
  isSplitting: boolean;
  isGeneratingVideo: boolean;
  generatingShotId: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const status = sb.status ?? "draft";
  const color =
    STORYBOARD_STATUS_COLORS[status as keyof typeof STORYBOARD_STATUS_COLORS] ??
    "bg-gray-500/20 text-gray-400";
  const label = STORYBOARD_STATUS_LABELS[status as keyof typeof STORYBOARD_STATUS_LABELS] ?? status;
  const sceneName = sb.scene_id ? sceneNameMap[sb.scene_id] : undefined;
  const characterNames = (sb.character_asset_ids ?? [])
    .map((id) => characterNameMap[id])
    .filter((n): n is string => Boolean(n));
  const propNames = (sb.prop_asset_ids ?? [])
    .map((id) => propNameMap[id])
    .filter((n): n is string => Boolean(n));

  const storyboardShots = shots.filter((s) => s.storyboard_id === sb.id);

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
        <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded bg-[#1a1a1a] text-emerald-400 font-bold text-sm">
          {sb.storyboard_number || "SB"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`px-2 py-0.5 rounded text-xs ${color}`}>{label}</span>
            <span className="text-xs text-emerald-300/90 bg-emerald-500/10 px-1.5 py-0.5 rounded">
              第 {sb.episode ?? 1} 集
            </span>
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
            <span className="text-xs text-[#888]">
              镜头: {storyboardShots.length}
            </span>
          </div>
          <p className="text-sm text-white font-medium">{sb.title || "未命名分镜"}</p>
          <p className="text-sm text-white/70 line-clamp-2">{sb.description}</p>
          {sb.dialogue && (
            <p className="mt-1 text-sm text-white/70 italic line-clamp-1">&quot;{sb.dialogue}&quot;</p>
          )}
          {(characterNames.length > 0 || propNames.length > 0) && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {characterNames.length > 0 && (
                <div className="flex flex-wrap items-center gap-1">
                  <Users className="h-3 w-3 text-blue-400" />
                  {characterNames.map((name, idx) => (
                    <span
                      key={`${name}-${idx}`}
                      className="inline-flex items-center rounded bg-blue-500/10 px-1.5 py-0.5 text-xs text-blue-300"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              )}
              {propNames.length > 0 && (
                <div className="flex flex-wrap items-center gap-1">
                  <Package className="h-3 w-3 text-amber-400" />
                  {propNames.map((name, idx) => (
                    <span
                      key={`${name}-${idx}`}
                      className="inline-flex items-center rounded bg-amber-500/10 px-1.5 py-0.5 text-xs text-amber-300"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 镜头列表（展开时显示） */}
      {expanded && (
        <div className="mt-3 pl-7 border-t border-white/5 pt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[#888]">镜头列表</span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => onAutoSplit(sb.id)} disabled={isSplitting}>
                <Scissors className={`mr-1 h-3 w-3 ${isSplitting ? "animate-spin" : ""}`} />
                {isSplitting ? "拆分中..." : "AI 拆分"}
              </Button>
              <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => onAddShot(sb.id)}>
                <Plus className="mr-1 h-3 w-3" />
                添加镜头
              </Button>
            </div>
          </div>
          {storyboardShots.length === 0 ? (
            <div className="text-xs text-[#666] py-2">暂无镜头，点击「AI 拆分」或「添加镜头」</div>
          ) : (
            <div className="space-y-2">
              {storyboardShots.map((shot) => {
                const shotStatus = shot.status ?? "draft";
                const shotColor = SHOT_STATUS_COLORS[shotStatus as keyof typeof SHOT_STATUS_COLORS] ?? "bg-gray-500/20 text-gray-400";
                const shotLabel = SHOT_STATUS_LABELS[shotStatus as keyof typeof SHOT_STATUS_LABELS] ?? shotStatus;
                return (
                  <div key={shot.id} className="flex items-center gap-2 rounded bg-[#1a1a1a] p-2 text-xs">
                    <span className="font-mono text-emerald-400 w-12">{shot.shot_number}</span>
                    <span className={`px-1.5 py-0.5 rounded ${shotColor}`}>{shotLabel}</span>
                    <span className="flex-1 truncate text-white/80">{shot.title}</span>
                    <span className="text-[#666]">{shot.duration}s</span>
                    {shot.shot_size && <span className="text-[#888]">{shot.shot_size}</span>}
                    {shot.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={shot.image_url} alt="" className="h-8 w-12 object-cover rounded" />
                    )}
                    {shot.video_url && (
                      <span className="text-emerald-400 text-[10px] bg-emerald-500/10 px-1 rounded">已生成</span>
                    )}
                    <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-emerald-400" onClick={() => onGenerateShotVideo(sb.id, shot.id)} disabled={generatingShotId === shot.id}>
                      <Video className={`h-3 w-3 ${generatingShotId === shot.id ? "animate-pulse" : ""}`} />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => onEditShot(shot)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-red-400" onClick={() => onDeleteShot(shot.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="sm" onClick={actions.onEdit} className="flex-1">
          <Pencil className="mr-1 h-3 w-3" />
          编辑
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onGenerateVideo(sb.id)}
          disabled={isGeneratingVideo}
          className="flex-1 text-emerald-300"
        >
          <Video className={`mr-1 h-3 w-3 ${isGeneratingVideo ? "animate-pulse" : ""}`} />
          {isGeneratingVideo ? "生成中..." : "图生视频"}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setExpanded((v) => !v)} className="flex-1">
          {expanded ? "收起镜头" : `展开镜头 (${storyboardShots.length})`}
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
  const [shots, setShots] = useState<Shot[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  /**
   * 一键生成视频（P0-1）：
   * 选中若干分镜（来自 FactoryCRUDPage 的 selectedIds），
   * 逐个调用 generateVideoFromStoryboard。
   */
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingVideoId, setGeneratingVideoId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 监听 FactoryCRUDPage 内的 selectedIds 变化
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

  // 拉取分镜列表
  useEffect(() => {
    if (!selectedProjectId) {
      setList([]);
      setShots([]);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    listStoryboards(selectedProjectId)
      .then((storyboards) => {
        if (!cancelled) setList(storyboards);
      })
      .catch((err) => console.warn("listStoryboards failed", err))
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

  const characterIds = useMemo(() => {
    const ids = new Set<string>();
    for (const sb of list) {
      for (const id of sb.character_asset_ids ?? []) {
        if (id) ids.add(id);
      }
    }
    return Array.from(ids);
  }, [list]);

  const propIds = useMemo(() => {
    const ids = new Set<string>();
    for (const sb of list) {
      for (const id of sb.prop_asset_ids ?? []) {
        if (id) ids.add(id);
      }
    }
    return Array.from(ids);
  }, [list]);

  const sceneFetcher = useMemo(
    () => async (ids: string[]) => {
      if (!selectedProjectId) return [];
      return getScenesByIds(selectedProjectId, ids);
    },
    [selectedProjectId],
  );

  const characterFetcher = useMemo(
    () => async (ids: string[]) => {
      if (!selectedProjectId) return [];
      const all = await listCharacters(selectedProjectId);
      const idSet = new Set(ids);
      return all.filter((c) => idSet.has(c.id));
    },
    [selectedProjectId],
  );

  const propFetcher = useMemo(
    () => async (ids: string[]) => {
      if (!selectedProjectId) return [];
      const all = await listProps(selectedProjectId);
      const idSet = new Set(ids);
      return all.filter((p) => idSet.has(p.id));
    },
    [selectedProjectId],
  );

  const sceneNameMap = useNameLookup<Scene>(sceneIds, sceneFetcher, (items, ids) => {
    const m: Record<string, string> = {};
    for (const it of items) m[it.id] = it.name;
    for (const id of ids) if (!(id in m)) m[id] = "";
    return m;
  });

  const characterNameMap = useNameLookup<Character>(
    characterIds,
    characterFetcher,
    (items, ids) => {
      const m: Record<string, string> = {};
      for (const it of items) m[it.id] = it.name;
      for (const id of ids) if (!(id in m)) m[id] = "";
      return m;
    },
  );

  const propNameMap = useNameLookup<Prop>(propIds, propFetcher, (items, ids) => {
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

  const [generatingShotId, setGeneratingShotId] = useState<string | null>(null);

  const handleGenerateShotVideo = async (storyboardId: string, shotId: string) => {
    if (!selectedProjectId) {
      toast.error("未选择项目", "请先在右上角选择或创建项目");
      return;
    }
    setGeneratingShotId(shotId);
    try {
      await generateVideoFromShot(storyboardId, shotId, { project_id: selectedProjectId });
      toast.success("已提交生成", "该镜头已加入视频生产线");
      clearApiCache();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("factory:reload"));
      }
    } catch (err) {
      console.error("generate shot video failed", shotId, err);
      toast.error("生成视频失败", String(err));
    } finally {
      setGeneratingShotId(null);
    }
  };

  // 镜头操作
  const handleAddShot = async (storyboardId: string) => {
    if (!selectedProjectId) return;
    try {
      const newShot = await createShot({
        storyboard_id: storyboardId,
        project_id: selectedProjectId,
        title: "新镜头",
        description: "",
        duration: 5,
        shot_number: `shot_${Date.now()}`,
        status: "draft",
      });
      setShots((prev) => [...prev, newShot]);
      toast.success("镜头已创建");
    } catch (err) {
      toast.error("创建镜头失败", String(err));
    }
  };

  const handleEditShot = async (shot: Shot) => {
    // 简化：直接弹窗或跳转（实际项目中可打开编辑对话框）
    toast.success("编辑镜头", `编辑镜头 ${shot.shot_number}`);
  };

  const handleDeleteShot = async (shotId: string) => {
    try {
      await deleteShot(shotId);
      setShots((prev) => prev.filter((s) => s.id !== shotId));
      toast.success("镜头已删除");
    } catch (err) {
      toast.error("删除镜头失败", String(err));
    }
  };

  const [isSplitting, setIsSplitting] = useState(false);

  const handleAutoSplit = async (storyboardId: string) => {
    setIsSplitting(true);
    try {
      toast.success("AI 拆分中", "正在分析分镜内容并拆分为镜头...");
      const newShots = await autoSplitShots(storyboardId);
      setShots((prev) => {
        const filtered = prev.filter((s) => s.storyboard_id !== storyboardId);
        return [...filtered, ...newShots];
      });
      toast.success("拆分完成", `生成了 ${newShots.length} 个镜头`);
    } catch (err) {
      toast.error("AI 拆分失败", String(err));
    } finally {
      setIsSplitting(false);
    }
  };

  const handleGenerateVideo = async (storyboardId: string) => {
    if (!selectedProjectId) {
      toast.error("未选择项目", "请先在右上角选择或创建项目");
      return;
    }
    setGeneratingVideoId(storyboardId);
    try {
      await generateVideoFromStoryboard(storyboardId, { project_id: selectedProjectId });
      toast.success("已提交生成", "该分镜已加入视频生产线");
      clearApiCache();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("factory:reload"));
      }
    } catch (err) {
      console.error("generate video failed", storyboardId, err);
      toast.error("生成视频失败", String(err));
    } finally {
      setGeneratingVideoId(null);
    }
  };
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
        <StoryboardRow
          sb={sb}
          actions={actions}
          sceneNameMap={sceneNameMap}
          characterNameMap={characterNameMap}
          propNameMap={propNameMap}
          shots={shots}
          onAddShot={handleAddShot}
          onEditShot={handleEditShot}
          onDeleteShot={handleDeleteShot}
          onAutoSplit={handleAutoSplit}
          onGenerateVideo={handleGenerateVideo}
          onGenerateShotVideo={handleGenerateShotVideo}
          isSplitting={isSplitting}
          isGeneratingVideo={generatingVideoId === sb.id}
          generatingShotId={generatingShotId}
        />
      )}
    />
  );
}

