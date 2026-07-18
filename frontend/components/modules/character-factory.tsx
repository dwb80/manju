"use client";

/**
 * 角色工厂模块
 *
 * 通过通用 FactoryCRUDPage 渲染：保留角色卡片视觉差异 + 字段 / AI 配置。
 * 编辑角色时打开图片生成页面。
 *
 * 功能：
 * - 角色列表展示（根据项目选择状态过滤）
 * - 编辑角色打开图片生成页面（三列布局）
 * - 删除角色确认 + 撤销
 * - 多选 + 批量删除 / 批量改类型
 * - AI 生成角色
 * - 引用来源（UsageBadge）+ 快速插入到分镜
 */

import { useState } from "react";
import { Users, Pencil, Trash2, ImageIcon, CheckSquare, Copy, Wand2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/shared/avatar";
import { UsageBadge } from "@/components/shared";
import { FactoryCRUDPage, flattenUsageReferences, type FactoryCRUDPageProps, type CardActions } from "@/components/factory";
import type { AITypeFieldConfig } from "@/components/shared/ai-generate-dialog";
import type { FormFieldConfig } from "@/components/ui/form-dialog";
import type { Character } from "@/lib/module-types";
import { useProjectStore } from "@/lib/stores/project-store";
import { toast } from "@/components/common/toast";
import {
  listCharacters,
  createCharacter,
  updateCharacter,
  deleteCharacter,
  restoreCharacter,
  listDeletedCharacters,
  permanentDeleteCharacters,
  batchCharacters,
  getCharacterUsage,
  copyCharactersToProjects,
  type UsageReferenceItem,
} from "@/services/module.service";
import { createStoryboardFromAsset } from "@/services/storyboard.service";
// CharacterImageGenerator 不再在本页直接渲染；点击"编辑"按钮会在新标签页打开 /characters/[id]/edit

/** 角色类型中文标签映射 */
const roleLabels: Record<string, string> = {
  protagonist: "主角",
  supporting: "配角",
  antagonist: "反派",
  minor: "次要",
};

/** AI 生成对话框：类型字段配置 */
const characterAITypeField: AITypeFieldConfig = {
  name: "role",
  label: "角色类型",
  defaultValue: "supporting",
  options: [
    { value: "protagonist", label: "主角" },
    { value: "supporting", label: "配角" },
    { value: "antagonist", label: "反派" },
    { value: "minor", label: "次要" },
  ],
};

/** AI 生成对话框：额外字段（与新建角色表单 characterFields 对齐） */
const characterAIExtraFields = [
  { name: "description", label: "描述（可留空）", placeholder: "可填写：性格、背景、特征…" },
  { name: "traits", label: "性格特点（可留空，逗号分隔）", placeholder: "如：勇敢, 机智, 善良" },
  { name: "identity", label: "身份（可留空）", placeholder: "如：剑客、公主、侦探" },
  { name: "face", label: "面部特征（可留空）", placeholder: "脸型、五官、肤色、瞳色" },
  { name: "hair", label: "发型（可留空）", placeholder: "发型、发色、长度、特殊造型" },
  { name: "body", label: "身材（可留空）", placeholder: "身高、胖瘦、体态特征" },
  { name: "temperament", label: "气质（可留空）", placeholder: "如：优雅、粗犷、冷峻、活泼" },
  { name: "costume_name", label: "服装名称（可留空）", placeholder: "如：夜行衣、校服、铠甲" },
  { name: "costume_description", label: "服装描述（可留空）", placeholder: "服装详细描述" },
  { name: "costume_color", label: "服装颜色（可留空）", placeholder: "如：玄黑色、月白色、藏青色" },
  { name: "costume_material", label: "服装材质（可留空）", placeholder: "如：丝绸、皮革、金属、棉布" },
  { name: "costume_style", label: "服装风格（可留空）", placeholder: "如：古风、现代、民族风" },
  { name: "accessories", label: "配饰（可留空，逗号分隔）", placeholder: "如：玉佩、耳环、腰带、护腕" },
  { name: "first_appearance", label: "首次出现（可留空）", placeholder: "如：EP01-Scene01" },
  { name: "dialogue_count", label: "对白数量（可留空）", placeholder: "0" },
  { name: "generation_prompt", label: "生图提示词（可留空）", placeholder: "用于 AI 生图的标准化提示词" },
  { name: "confidence", label: "可信度（可留空）", placeholder: "confirmed 或 inferred" },
];

/** 角色表单字段配置 */
const characterFields: FormFieldConfig[] = [
  { name: "name", label: "角色名称", type: "text", required: true, placeholder: "请输入角色名称" },
  {
    name: "role",
    label: "角色类型",
    type: "select",
    required: true,
    options: [
      { value: "protagonist", label: "主角" },
      { value: "supporting", label: "配角" },
      { value: "antagonist", label: "反派" },
      { value: "minor", label: "次要" },
    ],
    defaultValue: "supporting",
  },
  {
    name: "gender",
    label: "性别",
    type: "select",
    options: [
      { value: "male", label: "男" },
      { value: "female", label: "女" },
      { value: "other", label: "其他" },
    ],
  },
  { name: "age", label: "年龄", type: "number", placeholder: "0", min: 0 },
  { name: "identity", label: "身份", type: "text", placeholder: "如：剑客、公主、侦探" },
  { name: "face", label: "面部特征", type: "textarea", placeholder: "脸型、五官、肤色、瞳色、表情习惯", rows: 2 },
  { name: "hair", label: "发型", type: "text", placeholder: "发型、发色、长度、特殊造型" },
  { name: "body", label: "身材", type: "text", placeholder: "身高、胖瘦、体态特征" },
  { name: "temperament", label: "气质", type: "text", placeholder: "如：优雅、粗犷、冷峻、活泼" },
  { name: "costume_name", label: "服装名称", type: "text", placeholder: "如：夜行衣、校服、铠甲" },
  { name: "costume_description", label: "服装描述", type: "textarea", placeholder: "服装详细描述", rows: 2 },
  { name: "costume_color", label: "服装颜色", type: "text", placeholder: "如：玄黑色、月白色、藏青色" },
  { name: "costume_material", label: "服装材质", type: "text", placeholder: "如：丝绸、皮革、金属、棉布" },
  { name: "costume_style", label: "服装风格", type: "text", placeholder: "如：古风、现代、民族风" },
  { name: "accessories", label: "配饰 (逗号分隔)", type: "text", placeholder: "如：玉佩、耳环、腰带、护腕" },
  { name: "emotion_states", label: "情绪状态 (JSON)", type: "textarea", placeholder: '[{"emotion":"愤怒","trigger":"被背叛时","visual_expression":"眉头紧锁"}]', rows: 2 },
  { name: "action_assets", label: "动作资产 (JSON)", type: "textarea", placeholder: '[{"action":"拔剑","description":"拔剑姿态"}]', rows: 2 },
  { name: "relationships", label: "人物关系 (JSON)", type: "textarea", placeholder: '[{"target":"张三","relation":"父子"}]', rows: 2 },
  { name: "first_appearance", label: "首次出现", type: "text", placeholder: "如：EP01-Scene01" },
  { name: "dialogue_count", label: "对白数量", type: "number", placeholder: "0", min: 0 },
  { name: "generation_prompt", label: "生图提示词", type: "textarea", placeholder: "用于 AI 生图的标准化提示词", rows: 3 },
  { name: "confidence", label: "可信度", type: "select", options: [{ value: "confirmed", label: "confirmed" }, { value: "inferred", label: "inferred" }] },
  { name: "description", label: "角色描述", type: "textarea", placeholder: "请输入角色描述", rows: 3 },
  { name: "traits", label: "性格特点 (逗号分隔)", type: "text", placeholder: "如：勇敢, 机智, 善良" },
];

/** 角色类型颜色映射 */
const roleColors: Record<string, string> = {
  protagonist: "bg-emerald-500/20 text-emerald-400",
  supporting: "bg-blue-500/20 text-blue-400",
  antagonist: "bg-red-500/20 text-red-400",
  minor: "bg-gray-500/20 text-gray-400",
};

/** 角色卡片（含 UsageBadge onOpenSource + 插入到分镜） */
function CharacterCard({
  character,
  actions,
}: {
  character: Character;
  actions: CardActions;
}) {
  const router = useRouter();
  const selectedProjectId = useProjectStore((s) => s.selectedProjectId);
  const [inserting, setInserting] = useState<boolean>(false);

  // 打开角色图片编辑（新标签页）—— 不打断当前列表浏览
  const handleEdit = () => {
    window.open(
      `/characters/${encodeURIComponent(character.id)}/edit`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  const handleInsert = async () => {
    if (inserting) return;
    setInserting(true);
    try {
      const created = await createStoryboardFromAsset({
        name: character.name,
        description: character.description,
        image: character.image,
        tags: character.tags,
        type: "character",
        asset_id: character.id,
        project_id: selectedProjectId,
      });
      toast.success("已插入分镜", `「${character.name}」 → 新分镜「${created.title || created.description || "未命名"}」`);
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
      router.push(`/scripts?focus=usage:${ref.id}`);
    }
  };

  return (
    <>
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
        {actions.selected && (
          <CheckSquare className="h-3 w-3 text-white" />
        )}
      </button>

      <div className="flex items-center gap-3 mb-3 pl-7">
        <Avatar src={character.image} name={character.name} size={40} />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-white truncate">{character.name}</h3>
          <span className={`text-xs px-1.5 py-0.5 rounded ${roleColors[character.role] ?? "bg-gray-500/20 text-gray-400"}`}>
            {roleLabels[character.role] ?? character.role}
          </span>
        </div>
        {!character.image && (
          <span
            className="hidden group-hover:flex items-center gap-1 text-[10px] text-emerald-400/80 bg-emerald-500/10 px-1.5 py-0.5 rounded"
            title="可上传角色形象图"
          >
            <ImageIcon className="h-3 w-3" />
            暂无图
          </span>
        )}
      </div>

      {/* 身份 + 年龄 + 性别 */}
      <div className="flex flex-wrap gap-1 mb-2">
        {character.identity && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300">{character.identity}</span>
        )}
        {character.gender && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-300">
            {character.gender === "male" ? "男" : character.gender === "female" ? "女" : "其他"}
          </span>
        )}
        {character.age !== undefined && character.age > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-300">{character.age}岁</span>
        )}
        {character.dialogue_count !== undefined && character.dialogue_count > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-500/10 text-gray-400">{character.dialogue_count}句对白</span>
        )}
      </div>

      {/* 外貌概览 */}
      {(character.face || character.hair || character.body || character.temperament) && (
        <p className="text-[10px] text-[#666] mb-2 line-clamp-2">
          {[character.face, character.hair, character.body, character.temperament].filter(Boolean).join(" / ")}
        </p>
      )}

      {/* 服装概览 */}
      {(character.costume_name || character.costume_color || character.costume_style) && (
        <p className="text-[10px] text-[#666] mb-2 line-clamp-1">
          {[character.costume_name, character.costume_color, character.costume_style].filter(Boolean).join(" / ")}
        </p>
      )}

      {character.description && (
        <p className="text-xs text-[#888] mb-2 line-clamp-2">{character.description}</p>
      )}

      {Array.isArray(character.traits) && character.traits.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {character.traits.map((trait, idx) => (
            <span key={idx} className="text-xs px-1.5 py-0.5 rounded bg-white/5 text-[#aaa]">
              {trait}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 mb-2">
        <UsageBadge
          entityType="character"
          entityId={character.id}
          entityName={character.name}
          initialCount={character.usage_count ?? 0}
          onOpenSource={handleOpenRef}
        />
      </div>

      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="sm" onClick={handleEdit} className="flex-1" title="在新标签页打开角色图片编辑">
          <Pencil className="mr-1 h-3 w-3" />
          编辑
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleInsert}
          disabled={inserting}
          title="基于此角色快速新建一个分镜"
          className="text-emerald-300"
        >
          {inserting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
        </Button>
        {actions.onCopyToProjects && (
          <Button
            variant="ghost"
            size="sm"
            onClick={actions.onCopyToProjects}
            title="复制到其他项目"
            className="text-emerald-300"
          >
            <Copy className="h-3 w-3" />
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={actions.onDelete} className="text-red-400">
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
      </div>
    </>
  );
}

const config: FactoryCRUDPageProps<Character> = {
  title: "角色工厂",
  description: "设计和生成漫剧角色",
  entityLabel: "角色",
  listTitle: "角色列表",
  emptyTitle: "未找到角色",
  searchPlaceholder: "搜索角色名称、描述、标签...",

  fetchList: listCharacters,
  createItem: createCharacter as unknown as (input: Record<string, unknown>) => Promise<Character>,
  updateItem: updateCharacter as unknown as (id: string, input: Record<string, unknown>) => Promise<Character>,
  deleteItem: deleteCharacter,
  restoreItem: restoreCharacter,
  fetchDeleted: listDeletedCharacters,
  permanentDelete: permanentDeleteCharacters,
  batch: batchCharacters as unknown as (action: "delete" | "update", ids: string[], patch?: Record<string, unknown>) => Promise<{ deleted?: number; updated?: number }>,

  fields: characterFields,
  toFormValues: (c) => ({
    name: c.name,
    role: c.role,
    gender: c.gender || "",
    age: c.age ?? 0,
    identity: c.identity || "",
    face: c.face || "",
    hair: c.hair || "",
    body: c.body || "",
    temperament: c.temperament || "",
    costume_name: c.costume_name || "",
    costume_description: c.costume_description || "",
    costume_color: c.costume_color || "",
    costume_material: c.costume_material || "",
    costume_style: c.costume_style || "",
    accessories: Array.isArray(c.accessories) ? c.accessories.join(", ") : "",
    emotion_states: c.emotion_states || "",
    action_assets: c.action_assets || "",
    relationships: c.relationships || "",
    first_appearance: c.first_appearance || "",
    dialogue_count: c.dialogue_count ?? 0,
    generation_prompt: c.generation_prompt || "",
    confidence: c.confidence || "",
    description: c.description || "",
    traits: Array.isArray(c.traits) ? c.traits.join(", ") : "",
  }),
  transformFormValues: (values, projectId) => {
    const payload: Record<string, unknown> = { ...values, project_id: projectId };
    if (typeof payload.traits === "string") {
      payload.traits = (payload.traits as string).split(",").map((t) => t.trim()).filter(Boolean);
    }
    if (typeof payload.accessories === "string") {
      payload.accessories = (payload.accessories as string).split(",").map((t) => t.trim()).filter(Boolean);
    }
    // 空字符串转 undefined，避免写入数据库
    ["emotion_states", "action_assets", "relationships", "confidence", "generation_prompt"].forEach((k) => {
      if (payload[k] === "") payload[k] = undefined;
    });
    return payload;
  },

  renderCard: (character, actions) => (
    <CharacterCard character={character} actions={actions} />
  ),
  gridClassName: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",

  searchFields: (c, q) => {
    if (c.name.toLowerCase().includes(q)) return true;
    if ((c.description ?? "").toLowerCase().includes(q)) return true;
    if (Array.isArray(c.traits) && c.traits.some((t) => t.toLowerCase().includes(q))) return true;
    if (Array.isArray(c.tags) && c.tags.some((t) => t.toLowerCase().includes(q))) return true;
    return false;
  },

  filterOptions: [
    { value: "", label: "全部类型" },
    { value: "protagonist", label: "主角" },
    { value: "supporting", label: "配角" },
    { value: "antagonist", label: "反派" },
    { value: "minor", label: "次要" },
  ],
  filterField: (c, value) => c.role === value,
  filterPlaceholder: "角色类型",

  stats: (list) => [
    { label: "角色总数", value: list.length, icon: Users, color: "emerald" },
    { label: "主角", value: list.filter((c) => c.role === "protagonist").length, color: "blue" },
    { label: "配角", value: list.filter((c) => c.role === "supporting").length, color: "purple" },
    { label: "反派", value: list.filter((c) => c.role === "antagonist").length, color: "orange" },
  ],
  // 角色工厂：不展示顶部统计卡片
  showStats: false,

  fetchUsage: getCharacterUsage as unknown as (id: string) => Promise<{ total?: number; usage_count?: number }>,
  usageImpact: "删除可能影响剧本/分镜/对白中的引用。",

  copyToProjects: async (sourceId, targetProjectIds) => {
    const result = await copyCharactersToProjects(sourceId, targetProjectIds);
    return { copied: result.copied, skipped: result.skipped };
  },

  batchTypeConfig: {
    fieldName: "role",
    confirmTitle: "批量修改角色类型",
    buttonLabel: "批量改类型",
    patchKey: "role",
    typeLabels: roleLabels,
    options: [
      { value: "protagonist", label: "主角" },
      { value: "supporting", label: "配角" },
      { value: "antagonist", label: "反派" },
      { value: "minor", label: "次要" },
    ],
  },

  aiConfig: {
    title: "AI 生成角色",
    promptPlaceholder: "请输入角色描述，例如：古风少年剑客，黑发高马尾，身披白袍，眉目清冷，手持长剑…",
    typeField: characterAITypeField,
    extraFields: characterAIExtraFields,
    buttonLabel: "AI生成角色",
    onGenerate: async (payload) => {
      const traitsRaw = (payload.extra.traits ?? "").trim();
      const traits = traitsRaw
        ? traitsRaw.split(",").map((t) => t.trim()).filter(Boolean)
        : [];
      const accessoriesRaw = (payload.extra.accessories ?? "").trim();
      const accessories = accessoriesRaw
        ? accessoriesRaw.split(",").map((t) => t.trim()).filter(Boolean)
        : [];
      const description = (payload.extra.description ?? "").trim();
      const tags = ["AI生成"];
      if (payload.style) tags.push(`风格:${payload.style}`);

      // 从 extra 提取所有 AI 分析扩展字段（与 characterFields 对齐）
      const extra = payload.extra;
      const dialogueCount = extra.dialogue_count ? parseInt(extra.dialogue_count, 10) || undefined : undefined;

      await createCharacter({
        name: payload.name,
        role: payload.typeFieldValue as Character["role"],
        image: payload.imageUrl,
        description: description || payload.prompt,
        traits,
        tags,
        // === AI 剧本分析扩展字段 ===
        identity: extra.identity || undefined,
        face: extra.face || undefined,
        hair: extra.hair || undefined,
        body: extra.body || undefined,
        temperament: extra.temperament || undefined,
        costume_name: extra.costume_name || undefined,
        costume_description: extra.costume_description || undefined,
        costume_color: extra.costume_color || undefined,
        costume_material: extra.costume_material || undefined,
        costume_style: extra.costume_style || undefined,
        accessories: accessories.length > 0 ? accessories : undefined,
        first_appearance: extra.first_appearance || undefined,
        dialogue_count: dialogueCount,
        generation_prompt: extra.generation_prompt || undefined,
        confidence: extra.confidence || undefined,
      } as any);
    },
  },

  // P0-4：UsageBadge 引用次数与来源（拉取后通过 UsageDialog 展示）
  fetchReferences: async (entity) => {
    const usage = await getCharacterUsage(entity.id);
    return flattenUsageReferences(usage);
  },
  // P0-4：插入到分镜（卡片按钮已自带，FactoryCRUDPage 也会尝试调用一份）
  insertToStoryboard: async (entity) => {
    await createStoryboardFromAsset({
      name: entity.name,
      description: entity.description,
      image: (entity as { image?: string }).image,
      tags: (entity as { tags?: string[] }).tags,
      type: "character",
      asset_id: entity.id,
      project_id: (entity as { project_id?: string }).project_id,
    });
  },
};

export function CharacterFactoryPage() {
  // 编辑功能已迁移到独立路由 /characters/[id]/edit，不再在本页维护模态弹窗。
  // 顶部筛选 Tabs（评审 P1：全部 / 最近使用 / 我创建的 / 已收藏），
  // FactoryCRUDPage 内部已接好 useFilterState；缺字段时自动降级隐藏。
  return (
    <FactoryCRUDPage<Character>
      {...config}
      fetchVersions={{ entityType: "character" }}
      filterTabs={{
        // 后端 listCharacters 返回的对象支持 updated_at / created_by
        getUpdatedAt: (c) => (c as { updated_at?: string }).updated_at,
        getCreatedBy: (c) => (c as { created_by?: string }).created_by,
        // 收藏功能未上线，先留口子
        // getIsFavorited: (c) => (c as { is_favorited?: boolean }).is_favorited,
      }}
    />
  );
}
