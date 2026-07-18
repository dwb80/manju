/**
 * 工厂页工具函数
 *
 * entityTypeFromLabel：根据中文 entityLabel（角色/场景/道具）推导 TemplateSelector 需要的 TemplateEntityType。
 */

import type { TemplateEntityType } from "@/components/shared/template-selector";

/**
 * entityTypeFromLabel - 根据 entityLabel 推导 entityType
 * @description 用于 TemplateSelector 的类型 chip 渲染，将中文实体名称映射为类型标识
 * @param {string} label - 实体中文名称（如"角色"、"场景"、"道具"）
 * @returns {TemplateEntityType} 对应的类型标识（character/scene/prop）
 */
export function entityTypeFromLabel(label: string): TemplateEntityType {
  if (label.includes("角色")) return "character";
  if (label.includes("场景")) return "scene";
  if (label.includes("道具")) return "prop";
  return "character";
}
