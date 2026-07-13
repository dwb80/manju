/**
 * 工厂页工具函数
 *
 * entityTypeFromLabel：根据中文 entityLabel（角色/场景/道具）推导 TemplateSelector 需要的 TemplateEntityType。
 */

import type { TemplateEntityType } from "@/components/shared/template-selector";

/** 根据 entityLabel 推导 entityType（用于 TemplateSelector 的类型 chip 渲染）。 */
export function entityTypeFromLabel(label: string): TemplateEntityType {
  if (label.includes("角色")) return "character";
  if (label.includes("场景")) return "scene";
  if (label.includes("道具")) return "prop";
  return "character";
}
