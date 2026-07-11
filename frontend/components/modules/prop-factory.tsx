"use client";

/**
 * 道具工厂模块
 *
 * 通过通用 FactoryCRUDPage 渲染：保留道具卡片视觉差异 + 字段 / AI 配置 + 分页。
 *
 * 功能：
 * - 道具列表展示（卡片式）
 * - 新建/编辑道具对话框（含必填验证）
 * - 删除道具确认 + 撤销
 * - 按类别筛选和搜索
 * - 多选 + 批量删除 / 批量改类别
 * - 分页
 * - 引用来源（UsageBadge）+ 快速插入到分镜
 */

import { useState } from "react";
import { Package, Pencil, Trash2, CheckSquare, Copy, Wand2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/shared/avatar";
import { UsageBadge } from "@/components/shared";
import { FactoryCRUDPage, flattenUsageReferences, type FactoryCRUDPageProps, type CardActions } from "@/components/factory";
import type { AITypeFieldConfig } from "@/components/shared/ai-generate-dialog";
import type { FormFieldConfig } from "@/components/ui/form-dialog";
import type { Prop } from "@/lib/module-types";
import { useProjectStore } from "@/lib/stores/project-store";
import { clearApiCache } from "@/lib/api-client";
import { toast } from "@/components/common/toast";
import {
  listProps,
  createProp,
  updateProp,
  deleteProp,
  restoreProp,
  listDeletedProps,
  permanentDeleteProps,
  batchProps,
  getPropUsage,
  copyPropsToProjects,
  type UsageReferenceItem,
} from "@/services/module.service";
import { createStoryboardFromAsset } from "@/services/storyboard.service";

/** 道具类别中文标签映射 */
const categoryLabels: Record<string, string> = {
  weapon: "武器",
  tool: "工具",
  clothing: "服饰",
  food: "食物",
  vehicle: "交通工具",
  artifact: "神器/法宝",
  furniture: "家具",
  other: "其他",
};

/** AI 生成对话框：类别字段配置 */
const propAITypeField: AITypeFieldConfig = {
  name: "category",
  label: "道具类别",
  defaultValue: "other",
  options: [
    { value: "weapon", label: "武器" },
    { value: "tool", label: "工具" },
    { value: "clothing", label: "服饰" },
    { value: "food", label: "食物" },
    { value: "vehicle", label: "交通工具" },
    { value: "artifact", label: "神器/法宝" },
    { value: "furniture", label: "家具" },
    { value: "other", label: "其他" },
  ],
};

/** AI 生成对话框：额外字段（外观 / 材质 / 尺寸 / 颜色） */
const propAIExtraFields = [
  { name: "appearance", label: "外观（可留空）", placeholder: "可填写：造型、纹饰、风格…" },
  { name: "material", label: "材质（可留空）", placeholder: "如：金属、木质、水晶" },
  { name: "size", label: "尺寸（可留空）", placeholder: "如：长30cm、高1.5m" },
  { name: "color", label: "颜色（可留空）", placeholder: "如：金色、暗红色" },
];

/** 道具表单字段配置 */
const propFields: FormFieldConfig[] = [
  { name: "name", label: "道具名称", type: "text", required: true, placeholder: "请输入道具名称" },
  {
    name: "category",
    label: "道具类别",
    type: "select",
    required: true,
    options: [
      { value: "weapon", label: "武器" },
      { value: "tool", label: "工具" },
      { value: "clothing", label: "服饰" },
      { value: "food", label: "食物" },
      { value: "vehicle", label: "交通工具" },
      { value: "artifact", label: "神器/法宝" },
      { value: "furniture", label: "家具" },
      { value: "other", label: "其他" },
    ],
    defaultValue: "other",
  },
  { name: "description", label: "道具描述", type: "textarea", required: true, placeholder: "请输入道具描述、用途等", rows: 3 },
  { name: "appearance", label: "外观描述", type: "textarea", placeholder: "请输入道具的外观描述", rows: 2 },
  { name: "material", label: "材质", type: "text", placeholder: "如：金属、木质、水晶" },
  { name: "size", label: "尺寸", type: "text", placeholder: "如：长30cm、高1.5m" },
  { name: "color", label: "颜色", type: "text", placeholder: "如：金色、暗红色" },
];

/** 道具类别颜色映射 */
const categoryColors: Record<string, string> = {
  weapon: "bg-red-500/20 text-red-400",
  tool: "bg-blue-500/20 text-blue-400",
  clothing: "bg-purple-500/20 text-purple-400",
  food: "bg-orange-500/20 text-orange-400",
  vehicle: "bg-cyan-500/20 text-cyan-400",
  artifact: "bg-yellow-500/20 text-yellow-400",
  furniture: "bg-emerald-500/20 text-emerald-400",
  other: "bg-gray-500/20 text-gray-400",
};

/** FactoryCRUDPage 需要的全部配置。 */

/** 道具卡片（含 UsageBadge onOpenSource + 插入到分镜） */
function PropCard({
  prop,
  actions,
}: {
  prop: Prop;
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
        name: prop.name,
        description: prop.description,
        image: prop.image,
        tags: prop.tags,
        type: "prop",
        project_id: selectedProjectId,
      });
      clearApiCache();
      toast.success("已插入分镜", `「${prop.name}」 → 新分镜「${created.title || created.description || "未命名"}」`);
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

  return (
    <div
      className={`group relative flex flex-col rounded-lg border bg-[#252525] overflow-hidden transition-colors ${
        actions.selected
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
        className={`absolute left-2 top-2 z-10 grid h-5 w-5 place-items-center rounded border transition-opacity ${
          actions.selected
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
        {prop.image ? (
          <img
            src={prop.image}
            alt={prop.name}
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
          style={{ display: prop.image ? "none" : "flex" }}
        >
          <Avatar src={null} name={prop.name} size={56} />
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium text-white">{prop.name}</h3>
          <span className={`px-2 py-0.5 rounded text-xs ${categoryColors[prop.category] ?? "bg-gray-500/20 text-gray-400"}`}>
            {categoryLabels[prop.category] ?? prop.category}
          </span>
        </div>
        <p className="text-xs text-[#888] line-clamp-2 mb-2">{prop.description}</p>
        <div className="flex flex-wrap items-center gap-2 text-xs text-[#666] mb-2">
          {prop.material && <span>材质: {prop.material}</span>}
          {prop.color && <span>颜色: {prop.color}</span>}
          {prop.size && <span>尺寸: {prop.size}</span>}
        </div>
        {prop.tags && prop.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {prop.tags.slice(0, 3).map((tag, idx) => (
              <span key={idx} className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400">{tag}</span>
            ))}
          </div>
        )}
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={actions.onEdit}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleInsert}
            disabled={inserting}
            title="基于此道具快速新建一个分镜"
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
        <div className="mt-2 flex items-center gap-2">
          <UsageBadge
            entityType="prop"
            entityId={prop.id}
            entityName={prop.name}
            initialCount={prop.usage_count ?? 0}
            onOpenSource={handleOpenRef}
          />
        </div>
      </div>
    </div>
  );
}

const config: FactoryCRUDPageProps<Prop> = {
  title: "道具工厂",
  description: "设计和管理漫剧中的道具资产",
  entityLabel: "道具",
  listTitle: "道具列表",
  emptyTitle: "未找到道具",
  searchPlaceholder: "搜索道具名称、描述、标签...",

  fetchList: listProps,
  createItem: createProp as unknown as (input: Record<string, unknown>) => Promise<Prop>,
  updateItem: updateProp as unknown as (id: string, input: Record<string, unknown>) => Promise<Prop>,
  deleteItem: deleteProp,
  restoreItem: restoreProp,
  fetchDeleted: listDeletedProps,
  permanentDelete: permanentDeleteProps,
  batch: batchProps as unknown as (action: "delete" | "update", ids: string[], patch?: Record<string, unknown>) => Promise<{ deleted?: number; updated?: number }>,

  fields: propFields,
  toFormValues: (p) => ({
    name: p.name,
    category: p.category,
    description: p.description,
    appearance: p.appearance || "",
    material: p.material || "",
    size: p.size || "",
    color: p.color || "",
  }),
  transformFormValues: (values, projectId) => ({ ...values, project_id: projectId }),

  renderCard: (prop, actions) => <PropCard prop={prop} actions={actions} />,
  gridClassName: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",

  searchFields: (p, q) => {
    if (p.name.toLowerCase().includes(q)) return true;
    if ((p.description ?? "").toLowerCase().includes(q)) return true;
    if (Array.isArray(p.tags) && p.tags.some((t) => t.toLowerCase().includes(q))) return true;
    if ((p.material ?? "").toLowerCase().includes(q)) return true;
    if ((p.color ?? "").toLowerCase().includes(q)) return true;
    return false;
  },

  filterOptions: [
    { value: "", label: "全部类别" },
    { value: "weapon", label: "武器" },
    { value: "tool", label: "工具" },
    { value: "clothing", label: "服饰" },
    { value: "food", label: "食物" },
    { value: "vehicle", label: "交通工具" },
    { value: "artifact", label: "神器/法宝" },
    { value: "furniture", label: "家具" },
    { value: "other", label: "其他" },
  ],
  filterField: (p, value) => p.category === value,
  filterPlaceholder: "道具类别",

  stats: (list) => [
    { label: "道具总数", value: list.length, icon: Package, color: "emerald" },
    { label: "武器", value: list.filter((p) => p.category === "weapon").length, color: "blue" },
    { label: "神器/法宝", value: list.filter((p) => p.category === "artifact").length, color: "purple" },
    { label: "其他", value: list.filter((p) => p.category === "other").length, color: "orange" },
  ],

  fetchUsage: getPropUsage as unknown as (id: string) => Promise<{ total?: number; usage_count?: number }>,
  usageImpact: "删除可能影响剧本中的引用。",

  copyToProjects: async (sourceId, targetProjectIds) => {
    const result = await copyPropsToProjects(sourceId, targetProjectIds);
    return { copied: result.copied, skipped: result.skipped };
  },

  batchTypeConfig: {
    fieldName: "category",
    confirmTitle: "批量修改道具类别",
    buttonLabel: "批量改类别",
    patchKey: "category",
    typeLabels: categoryLabels,
    options: [
      { value: "weapon", label: "武器" },
      { value: "tool", label: "工具" },
      { value: "clothing", label: "服饰" },
      { value: "food", label: "食物" },
      { value: "vehicle", label: "交通工具" },
      { value: "artifact", label: "神器/法宝" },
      { value: "furniture", label: "家具" },
      { value: "other", label: "其他" },
    ],
  },

  pageSize: 12,
  selectAllLabel: "全选所有页",
  loadingView: (
    <div className="flex items-center justify-center py-12 text-[#888]">加载中...</div>
  ),

  aiConfig: {
    title: "AI 生成道具",
    promptPlaceholder: "请输入道具描述，例如：一柄汉代青铜长剑，缠金丝，剑鞘饰以云纹，剑身泛出冷光…",
    typeField: propAITypeField,
    extraFields: propAIExtraFields,
    buttonLabel: "AI生成道具",
    onGenerate: async (payload) => {
      const tags = ["AI生成"];
      if (payload.style) tags.push(`风格:${payload.style}`);

      await createProp({
        name: payload.name,
        category: payload.typeFieldValue as Prop["category"],
        image: payload.imageUrl,
        description: payload.prompt,
        appearance: (payload.extra.appearance ?? "").trim(),
        material: (payload.extra.material ?? "").trim(),
        size: (payload.extra.size ?? "").trim(),
        color: (payload.extra.color ?? "").trim(),
        tags,
      } as any);
    },
  },

  // P0-4：UsageBadge 引用次数与来源
  fetchReferences: async (entity) => {
    const usage = await getPropUsage(entity.id);
    return flattenUsageReferences(usage);
  },
  // P0-4：插入到分镜
  insertToStoryboard: async (entity) => {
    await createStoryboardFromAsset({
      name: entity.name,
      description: entity.description,
      image: (entity as { image?: string }).image,
      tags: (entity as { tags?: string[] }).tags,
      type: "prop",
    });
  },
};

export function PropFactoryPage() {
  return (
    <FactoryCRUDPage<Prop>
      {...config}
      // 任务12：统一版本管理 - 启用版本历史入口
      fetchVersions={{ entityType: "prop" }}
    />
  );
}
