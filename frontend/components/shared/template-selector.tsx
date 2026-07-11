"use client";

/**
 * 资产模板/预设选择器
 *
 * 三厂（角色 / 场景 / 道具）共用的"快速填表"模板选择对话框。
 *
 * 设计：
 * - props 是通用的 { key, name, role/type/category, description, ... } 形态，
 *   调用方负责通过 `fetcher` 拉取模板列表并指定 entityType 用于 label 渲染。
 * - 渲染模板卡片网格（每张卡片显示名称 + 缩略图占位 + 描述 + 关键属性 chip）。
 * - 点击「使用此模板」调 onSelect(template)，把模板数据交给父组件填表。
 *
 * 关键约束：
 * - 模板不依赖 project_id（全局可用）。
 * - 模板选择是辅助填表（不直接创建实体）。
 */

import { useEffect, useState } from "react";
import { LayoutTemplate, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/common/toast";

/** 模板的最小通用形态：三厂只取自己关心的字段。 */
export interface AssetTemplate {
  id: string;
  name: string;
  description?: string;
  /** 角色：role / 场景：type / 道具：category */
  role?: string;
  type?: string;
  category?: string;
  gender?: string;
  age?: number;
  traits?: string[];
  lighting?: string;
  time_of_day?: string;
  weather?: string;
  material?: string;
  color?: string;
  size?: string;
  appearance?: string;
  tags?: string[];
  image?: string;
}

export type TemplateEntityType = "character" | "scene" | "prop";

export interface TemplateSelectorProps {
  /** 对话框是否打开。 */
  isOpen: boolean;
  /** 关闭回调。 */
  onClose: () => void;
  /** 用户选择某个模板后回调，参数是模板对象，父组件负责填表。 */
  onSelect: (template: AssetTemplate) => void;
  /** 实体类型（用于标题 / 默认值 / 类型 chip 渲染）。 */
  entityType: TemplateEntityType;
  /** 实体中文名（按钮 / 标题），例如 "角色" / "场景" / "道具"。 */
  entityLabel: string;
  /** 拉取模板列表的函数（建议从 services/module.service.ts 注入）。 */
  fetcher: () => Promise<AssetTemplate[]>;
}

/** 类型字段值到中文标签的映射（三个工厂只取自己关心的那一项）。 */
const TYPE_LABEL: Record<TemplateEntityType, Record<string, string>> = {
  character: {
    protagonist: "主角",
    supporting: "配角",
    antagonist: "反派",
    minor: "次要",
    male: "男",
    female: "女",
    other: "其他",
  },
  scene: {
    indoor: "室内",
    outdoor: "室外",
    virtual: "虚拟",
  },
  prop: {
    weapon: "武器",
    tool: "工具",
    clothing: "服饰",
    food: "食物",
    vehicle: "交通工具",
    artifact: "神器/法宝",
    furniture: "家具",
    other: "其他",
  },
};

/** 给某条模板取一个简短"主属性"用于卡片顶部 chip 展示。 */
function pickPrimaryChip(template: AssetTemplate, entityType: TemplateEntityType): string {
  if (entityType === "character") {
    const value = template.role ?? "";
    return TYPE_LABEL.character[value] ?? value;
  }
  if (entityType === "scene") {
    const value = template.type ?? "";
    return TYPE_LABEL.scene[value] ?? value;
  }
  const value = template.category ?? "";
  return TYPE_LABEL.prop[value] ?? value;
}

/** 给某条模板取一个简短"次属性"用于卡片右上角 chip 展示。 */
function pickSecondaryChip(template: AssetTemplate, entityType: TemplateEntityType): string | null {
  if (entityType === "character") {
    if (template.gender) return TYPE_LABEL.character[template.gender] ?? template.gender;
    if (typeof template.age === "number" && template.age > 0) return `${template.age}岁`;
    return null;
  }
  if (entityType === "scene") {
    if (template.lighting) return template.lighting;
    if (template.time_of_day) return template.time_of_day;
    return null;
  }
  if (template.material) return template.material;
  if (template.color) return template.color;
  return null;
}

export function TemplateSelector({
  isOpen,
  onClose,
  onSelect,
  entityType,
  entityLabel,
  fetcher,
}: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<AssetTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // 每次打开对话框重新拉取最新模板列表。
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setIsLoading(true);
    fetcher()
      .then((list) => {
        if (cancelled) return;
        setTemplates(Array.isArray(list) ? list : []);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("TemplateSelector: failed to load templates", err);
        toast.error("加载模板失败", err?.message ?? "请稍后重试");
        setTemplates([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, fetcher]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[95] grid place-items-center bg-black/60 px-4 backdrop-blur-sm overflow-y-auto py-8"
      role="dialog"
      aria-modal="true"
      aria-label="选择模板"
    >
      <div className="w-full max-w-4xl max-h-[calc(100vh-4rem)] rounded-2xl border border-white/10 bg-[#202020] p-5 shadow-2xl flex flex-col">
        {/* 标题栏 */}
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-md bg-emerald-500/15 text-emerald-300">
              <LayoutTemplate className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">使用模板快速创建{entityLabel}</h2>
              <p className="text-xs text-[#888] mt-0.5">
                从常用预设中选择一个，应用后仍可在表单中继续修改
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-md hover:bg-white/10 flex items-center justify-center"
            aria-label="关闭"
          >
            <X className="h-4 w-4 text-[#888]" />
          </button>
        </div>

        {/* 内容 */}
        <div className="flex-1 min-h-0 overflow-y-auto pr-1">
          {isLoading ? (
            <div className="grid place-items-center py-16 text-[#888]">
              <Loader2 className="h-6 w-6 animate-spin mb-2" />
              <span className="text-sm">加载模板中…</span>
            </div>
          ) : templates.length === 0 ? (
            <div className="grid place-items-center py-16 text-[#888]">
              <span className="text-sm">暂无可用模板</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {templates.map((tpl) => {
                const primary = pickPrimaryChip(tpl, entityType);
                const secondary = pickSecondaryChip(tpl, entityType);
                return (
                  <div
                    key={tpl.id}
                    className="group flex flex-col gap-2 rounded-lg border border-white/10 bg-[#1a1a1a] p-3 hover:border-emerald-500/60 transition-colors"
                  >
                    {/* 缩略图占位 / 头部 */}
                    <div className="flex items-center gap-2">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 text-emerald-300 text-sm font-semibold">
                        {(tpl.name || "?").charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium text-white truncate">{tpl.name}</h3>
                        <div className="flex flex-wrap items-center gap-1 mt-0.5">
                          {primary && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                              {primary}
                            </span>
                          )}
                          {secondary && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-[#aaa]">
                              {secondary}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {/* 描述 */}
                    {tpl.description && (
                      <p className="text-xs text-[#888] line-clamp-3 min-h-[2.5rem]">
                        {tpl.description}
                      </p>
                    )}
                    {/* 操作 */}
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        onSelect(tpl);
                        onClose();
                      }}
                      className="mt-auto w-full text-xs"
                    >
                      使用此模板
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 底部操作 */}
        <div className="flex justify-end pt-4 mt-4 border-t border-white/10 flex-shrink-0">
          <Button type="button" size="sm" variant="secondary" onClick={onClose}>
            取消
          </Button>
        </div>
      </div>
    </div>
  );
}
