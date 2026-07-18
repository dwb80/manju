"use client";

/**
 * 场景工厂模块
 *
 * 通过通用 FactoryCRUDPage 渲染：保留场景卡片视觉差异 + 字段 / AI 配置。
 *
 * 功能：
 * - 场景列表展示
 * - 新建/编辑场景对话框（含必填验证）
 * - 删除场景确认 + 撤销
 * - 多选 + 批量删除 / 批量改类型
 * - AI 生成场景
 * - 引用来源（UsageBadge）+ 快速插入到分镜
 */

import { useState } from "react";
import { Image, Pencil, Trash2, CheckSquare, Copy, Wand2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/shared/avatar";
import { UsageBadge } from "@/components/shared";
import { FactoryCRUDPage, flattenUsageReferences, type FactoryCRUDPageProps, type CardActions } from "@/components/factory";
import type { AITypeFieldConfig } from "@/components/shared/ai-generate-dialog";
import type { FormFieldConfig } from "@/components/ui/form-dialog";
import type { Scene } from "@/lib/module-types";
import { useProjectStore } from "@/lib/stores/project-store";
import { clearApiCache } from "@/lib/api-client";
import { toast } from "@/components/common/toast";
import {
  listScenes,
  createScene,
  updateScene,
  deleteScene,
  restoreScene,
  listDeletedScenes,
  permanentDeleteScenes,
  batchScenes,
  getSceneUsage,
  copyScenesToProjects,
  type UsageReferenceItem,
} from "@/services/module.service";
import { createStoryboardFromAsset } from "@/services/storyboard.service";

/** 场景类型中文标签映射 */
const typeLabels: Record<string, string> = {
  indoor: "室内",
  outdoor: "室外",
  virtual: "虚拟",
};

/** AI 生成对话框：类型字段配置 */
const sceneAITypeField: AITypeFieldConfig = {
  name: "type",
  label: "场景类型",
  defaultValue: "indoor",
  options: [
    { value: "indoor", label: "室内" },
    { value: "outdoor", label: "室外" },
    { value: "virtual", label: "虚拟" },
  ],
};

/** AI 生成对话框：额外字段（与新建场景表单 sceneFields 对齐） */
const sceneAIExtraFields = [
  { name: "lighting", label: "光线（可留空）", placeholder: "如：自然光、暖色调" },
  { name: "time_of_day", label: "时间段（可留空）", placeholder: "如：白天、夜晚、黄昏" },
  { name: "weather", label: "天气（可留空）", placeholder: "如：晴、阴、雨" },
  { name: "category", label: "场景分类（可留空）", placeholder: "如：古代街道、宫殿内室、战场" },
  { name: "indoor_outdoor", label: "室内/室外（可留空）", placeholder: "indoor / outdoor / mixed" },
  { name: "location", label: "具体地点（可留空）", placeholder: "如：长安城东市、紫禁城太和殿" },
  { name: "architecture", label: "建筑风格（可留空）", placeholder: "如：中式宫殿、哥特式教堂" },
  { name: "terrain", label: "地形特征（可留空）", placeholder: "如：山地、平原、湖泊" },
  { name: "plants", label: "植物描述（可留空）", placeholder: "如：竹林、樱花树、枯藤" },
  { name: "objects", label: "场景物体（可留空）", placeholder: "如：石灯笼、古琴、茶盏" },
  { name: "period", label: "时代/时期（可留空）", placeholder: "如：唐代、民国时期、未来" },
  { name: "tone", label: "氛围基调（可留空）", placeholder: "如：肃穆、温馨、紧张" },
  { name: "visual_style", label: "视觉风格（可留空）", placeholder: "如：水墨风、写实、赛博朋克" },
  { name: "atmosphere_emotion", label: "氛围情绪（可留空）", placeholder: "如：孤独、希望、压抑" },
  { name: "suitable_shots", label: "适合镜头（可留空，逗号分隔）", placeholder: "如：全景, 中景, 特写" },
  { name: "reusable_elements", label: "可复用元素（可留空，逗号分隔）", placeholder: "如：背景建筑, 天空盒" },
];

/** 场景表单字段配置 */
const sceneFields: FormFieldConfig[] = [
  { name: "name", label: "场景名称", type: "text", required: true, placeholder: "请输入场景名称" },
  {
    name: "type",
    label: "场景类型",
    type: "select",
    required: true,
    options: [
      { value: "indoor", label: "室内" },
      { value: "outdoor", label: "室外" },
      { value: "virtual", label: "虚拟" },
    ],
    defaultValue: "indoor",
  },
  { name: "description", label: "场景描述", type: "textarea", required: true, placeholder: "请输入场景描述", rows: 3 },
  { name: "lighting", label: "光线", type: "text", placeholder: "如：自然光、暖色调" },
  { name: "time_of_day", label: "时间段", type: "text", placeholder: "如：白天、夜晚、黄昏" },
  { name: "weather", label: "天气", type: "text", placeholder: "如：晴、阴、雨" },
  // === AI 剧本分析扩展字段 ===
  { name: "category", label: "场景分类", type: "text", placeholder: "如：古代街道、宫殿内室、战场" },
  { name: "indoor_outdoor", label: "室内/室外", type: "text", placeholder: "indoor / outdoor / mixed" },
  { name: "location", label: "具体地点", type: "text", placeholder: "如：长安城东市、紫禁城太和殿" },
  { name: "architecture", label: "建筑风格", type: "text", placeholder: "如：中式宫殿、哥特式教堂" },
  { name: "terrain", label: "地形特征", type: "text", placeholder: "如：山地、平原、湖泊" },
  { name: "plants", label: "植物描述", type: "text", placeholder: "如：竹林、樱花树、枯藤" },
  { name: "objects", label: "场景物体", type: "text", placeholder: "如：石灯笼、古琴、茶盏" },
  { name: "period", label: "时代/时期", type: "text", placeholder: "如：唐代、民国时期、未来" },
  { name: "tone", label: "氛围基调", type: "text", placeholder: "如：肃穆、温馨、紧张" },
  { name: "visual_style", label: "视觉风格", type: "text", placeholder: "如：水墨风、写实、赛博朋克" },
  { name: "atmosphere_emotion", label: "氛围情绪", type: "text", placeholder: "如：孤独、希望、压抑" },
  { name: "suitable_shots", label: "适合镜头", type: "text", placeholder: "如：全景, 中景, 特写" },
  { name: "reusable_elements", label: "可复用元素", type: "text", placeholder: "如：背景建筑, 天空盒" },
  { name: "generation_prompt", label: "生成提示词", type: "textarea", placeholder: "AI 生图标准化提示词", rows: 2 },
  { name: "first_appearance", label: "首次出现", type: "text", placeholder: "如：EP01-Scene01" },
  { name: "confidence", label: "可信度", type: "text", placeholder: "confirmed / inferred" },
];

/** 场景类型颜色映射 */
const typeColors: Record<string, string> = {
  indoor: "bg-blue-500/20 text-blue-400",
  outdoor: "bg-emerald-500/20 text-emerald-400",
  virtual: "bg-purple-500/20 text-purple-400",
};

/** FactoryCRUDPage 需要的全部配置。 */

/** 场景卡片（含 UsageBadge onOpenSource + 插入到分镜） */
function SceneCard({
  scene,
  actions,
}: {
  scene: Scene;
  actions: CardActions;
}) {
  const router = useRouter();
  const selectedProjectId = useProjectStore((s) => s.selectedProjectId);
  const [inserting, setInserting] = useState<boolean>(false);

  const handleInsert = async () => {
    if (inserting) return;
    setInserting(true);
    try {
      const created = await createStoryboardFromAsset({
        name: scene.name,
        description: scene.description,
        image: scene.image,
        tags: scene.tags,
        type: "scene",
        asset_id: scene.id,
        project_id: selectedProjectId,
      });
      clearApiCache();
      toast.success("已插入分镜", `「${scene.name}」 → 新分镜「${created.title || created.description || "未命名"}」`);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("factory:reload"));
      }
    } catch (err) {
      toast.error("插入失败", (err as Error)?.message ?? "请稍后重试");
    } finally {
      setInserting(false);
    }
  };

  const handleOpenRef = (ref: UsageReferenceItem) => {
    if (ref.type === "storyboard") {
      router.push(`/storyboards?storyboardId=${encodeURIComponent(ref.id)}`);
    } else if (ref.type === "script" || ref.type === "script_center") {
      router.push(`/scripts/${encodeURIComponent(ref.id)}`);
    } else {
      router.push(`/storyboards?focus=usage:${ref.id}`);
    }
  };

  // 打开场景编辑页（新标签页）—— 全屏生图界面
  const handleEdit = () => {
    window.open(
      `/scenes/${encodeURIComponent(scene.id)}/edit`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  return (
    <div
      className={`group relative flex flex-col rounded-lg border bg-[#252525] overflow-hidden transition-colors ${actions.selected
          ? "border-emerald-500 ring-1 ring-emerald-500/40"
          : "border-white/10 hover:border-white/20"
        }`}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          actions.onToggleSelect();
        }}
        className={`absolute left-2 top-2 z-10 grid h-5 w-5 place-items-center rounded border transition-opacity ${actions.selected
            ? "border-emerald-500 bg-emerald-500 opacity-100"
            : "border-white/40 bg-black/40 opacity-0 group-hover:opacity-100 hover:border-emerald-400"
          }`}
        aria-label={actions.selected ? "取消选择" : "选择"}
      >
        {actions.selected && (
          <CheckSquare className="h-3 w-3 text-white" />
        )}
      </button>

      <div className="relative aspect-[16/9] bg-[#1a1a1a] flex items-center justify-center overflow-hidden">
        {scene.image ? (
          <img
            src={scene.image}
            alt={scene.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = "none";
              const parent = target.parentElement;
              if (parent) {
                const fallback = parent.querySelector("[data-avatar-fallback]") as HTMLElement | null;
                if (fallback) fallback.style.display = "flex";
              }
            }}
          />
        ) : null}
        <div
          data-avatar-fallback
          className="absolute inset-0 flex items-center justify-center"
          style={{ display: scene.image ? "none" : "flex" }}
        >
          <Avatar src={null} name={scene.name} size={56} />
        </div>
        {(scene.time_of_day || scene.weather) && (
          <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center gap-1.5 text-[10px] text-white/90">
            {scene.time_of_day && (
              <span className="px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm">{scene.time_of_day}</span>
            )}
            {scene.weather && (
              <span className="px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm">{scene.weather}</span>
            )}
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium text-white">{scene.name}</h3>
          <span className={`px-2 py-0.5 rounded text-xs ${typeColors[scene.type] ?? "bg-gray-500/20 text-gray-400"}`}>
            {typeLabels[scene.type] ?? scene.type}
          </span>
        </div>
        <p className="text-xs text-[#888] line-clamp-2 mb-2">{scene.description}</p>
        <div className="flex items-center justify-between">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#666]">
            {scene.lighting && <span>光线: {scene.lighting}</span>}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleEdit} title="在新标签页打开场景编辑页（配生图）">
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleInsert}
              disabled={inserting}
              title="基于此场景快速新建一个分镜"
              className="text-emerald-300"
            >
              {inserting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            </Button>
            {actions.onCopyToProjects && (
              <Button
                variant="ghost"
                size="sm"
                onClick={actions.onCopyToProjects}
                title="复制到其他项目"
                className="text-emerald-300"
              >
                <Copy className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={actions.onDelete}>
              <Trash2 className="h-4 w-4 text-red-400" />
            </Button>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <UsageBadge
            entityType="scene"
            entityId={scene.id}
            entityName={scene.name}
            initialCount={scene.usage_count ?? 0}
            onOpenSource={handleOpenRef}
          />
        </div>
      </div>
    </div>
  );
}

const config: FactoryCRUDPageProps<Scene> = {
  title: "场景工厂",
  description: "设计和生成漫剧场景",
  entityLabel: "场景",
  listTitle: "场景列表",
  emptyTitle: "未找到场景",
  searchPlaceholder: "搜索场景名称、描述、标签...",

  fetchList: listScenes,
  createItem: createScene as unknown as (input: Record<string, unknown>) => Promise<Scene>,
  updateItem: updateScene as unknown as (id: string, input: Record<string, unknown>) => Promise<Scene>,
  deleteItem: deleteScene,
  restoreItem: restoreScene,
  fetchDeleted: listDeletedScenes,
  permanentDelete: permanentDeleteScenes,
  batch: batchScenes as unknown as (action: "delete" | "update", ids: string[], patch?: Record<string, unknown>) => Promise<{ deleted?: number; updated?: number }>,

  fields: sceneFields,
  toFormValues: (s) => ({
    name: s.name,
    type: s.type,
    description: s.description,
    lighting: s.lighting || "",
    time_of_day: s.time_of_day || "",
    weather: s.weather || "",
    // === AI 剧本分析扩展字段 ===
    category: s.category || "",
    indoor_outdoor: s.indoor_outdoor || "",
    location: s.location || "",
    architecture: s.architecture || "",
    terrain: s.terrain || "",
    plants: s.plants || "",
    objects: s.objects || "",
    period: s.period || "",
    tone: s.tone || "",
    visual_style: s.visual_style || "",
    atmosphere_emotion: s.atmosphere_emotion || "",
    suitable_shots: s.suitable_shots || "",
    reusable_elements: s.reusable_elements || "",
    generation_prompt: s.generation_prompt || "",
    first_appearance: s.first_appearance || "",
    confidence: s.confidence || "",
  }),
  transformFormValues: (values, projectId) => ({ ...values, project_id: projectId }),

  renderCard: (scene, actions) => <SceneCard scene={scene} actions={actions} />,
  gridClassName: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",

  searchFields: (s, q) => {
    if (s.name.toLowerCase().includes(q)) return true;
    if ((s.description ?? "").toLowerCase().includes(q)) return true;
    if (Array.isArray(s.tags) && s.tags.some((t) => t.toLowerCase().includes(q))) return true;
    if ((s.lighting ?? "").toLowerCase().includes(q)) return true;
    if ((s.time_of_day ?? "").toLowerCase().includes(q)) return true;
    if ((s.weather ?? "").toLowerCase().includes(q)) return true;
    return false;
  },

  filterOptions: [
    { value: "", label: "全部类型" },
    { value: "indoor", label: "室内场景" },
    { value: "outdoor", label: "室外场景" },
    { value: "virtual", label: "虚拟场景" },
  ],
  filterField: (s, value) => s.type === value,
  filterPlaceholder: "场景类型",

  stats: (list) => [
    { label: "场景总数", value: list.length, icon: Image, color: "emerald" },
    { label: "室内场景", value: list.filter((s) => s.type === "indoor").length, color: "blue" },
    { label: "室外场景", value: list.filter((s) => s.type === "outdoor").length, color: "purple" },
    { label: "虚拟场景", value: list.filter((s) => s.type === "virtual").length, color: "orange" },
  ],
  // 场景工厂：不展示顶部统计卡片
  showStats: false,

  fetchUsage: getSceneUsage as unknown as (id: string) => Promise<{ total?: number; usage_count?: number }>,
  usageImpact: "删除可能影响分镜/剧本中的引用。",

  copyToProjects: async (sourceId, targetProjectIds) => {
    const result = await copyScenesToProjects(sourceId, targetProjectIds);
    return { copied: result.copied, skipped: result.skipped };
  },

  batchTypeConfig: {
    fieldName: "type",
    confirmTitle: "批量修改场景类型",
    buttonLabel: "批量改类型",
    patchKey: "type",
    typeLabels: typeLabels,
    options: [
      { value: "indoor", label: "室内" },
      { value: "outdoor", label: "室外" },
      { value: "virtual", label: "虚拟" },
    ],
  },

  aiConfig: {
    title: "AI 生成场景",
    promptPlaceholder: "请输入场景描述，例如：江南雨巷，青石板路，老式灯笼，微雨朦胧，远处小桥流水…",
    typeField: sceneAITypeField,
    extraFields: sceneAIExtraFields,
    buttonLabel: "AI生成场景",
    onGenerate: async (payload) => {
      const tags = ["AI生成"];
      if (payload.style) tags.push(`风格:${payload.style}`);

      await createScene({
        name: payload.name,
        type: payload.typeFieldValue as Scene["type"],
        image: payload.imageUrl,
        description: payload.prompt,
        lighting: (payload.extra.lighting ?? "").trim(),
        time_of_day: (payload.extra.time_of_day ?? "").trim(),
        weather: (payload.extra.weather ?? "").trim(),
        // === AI 剧本分析扩展字段 ===
        category: (payload.extra.category ?? "").trim(),
        indoor_outdoor: (payload.extra.indoor_outdoor ?? "").trim(),
        location: (payload.extra.location ?? "").trim(),
        architecture: (payload.extra.architecture ?? "").trim(),
        terrain: (payload.extra.terrain ?? "").trim(),
        plants: (payload.extra.plants ?? "").trim(),
        objects: (payload.extra.objects ?? "").trim(),
        period: (payload.extra.period ?? "").trim(),
        tone: (payload.extra.tone ?? "").trim(),
        visual_style: (payload.extra.visual_style ?? "").trim(),
        atmosphere_emotion: (payload.extra.atmosphere_emotion ?? "").trim(),
        suitable_shots: (payload.extra.suitable_shots ?? "").trim(),
        reusable_elements: (payload.extra.reusable_elements ?? "").trim(),
        generation_prompt: payload.prompt,
        tags,
      } as any);
    },
  },

  // P0-4：UsageBadge 引用次数与来源
  fetchReferences: async (entity) => {
    const usage = await getSceneUsage(entity.id);
    return flattenUsageReferences(usage);
  },
  // P0-4：插入到分镜
  insertToStoryboard: async (entity) => {
    await createStoryboardFromAsset({
      name: entity.name,
      description: entity.description,
      image: (entity as { image?: string }).image,
      tags: (entity as { tags?: string[] }).tags,
      type: "scene",
      asset_id: entity.id,
      project_id: (entity as { project_id?: string }).project_id,
    });
  },
};

export function SceneFactoryPage() {
  return (
    <FactoryCRUDPage<Scene>
      {...config}
      // 任务12：统一版本管理 - 启用版本历史入口
      fetchVersions={{ entityType: "scene" }}
    />
  );
}
