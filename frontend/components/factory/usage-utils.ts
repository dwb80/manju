/**
 * 把后端 AssetUsage 结构扁平化，供 FactoryCRUDPage 的 fetchReferences 使用。
 *
 * 后端返回结构（来自 character.service / scene.service / prop.service）：
 *   {
 *     total, usage_count,
 *     storyboards: UsageReferenceItem[],
 *     scripts:     UsageReferenceItem[],
 *     dialogues:   UsageReferenceItem[],
 *     sceneCharacters / sceneLocations: UsageReferenceItem[],
 *   }
 *
 * 工厂卡片需要的形式：
 *   {
 *     count: number;
 *     references: { id: string; title: string }[];
 *     episodes: number[];   // 唯一集数（已排序、去重）
 *   }
 */
import type { AssetUsage, UsageReferenceItem } from "@/services/character.service";

/**
 * flattenUsageReferences - 扁平化资产引用数据
 * @description 将后端 AssetUsage 结构扁平化为工厂卡片需要的格式，提取所有引用项并合并集数信息
 * @param {AssetUsage | null | undefined} usage - 后端返回的资产引用结构
 * @returns {{count: number; references: {id: string; title: string}[]; episodes: number[]}} 扁平化后的引用数据
 */
export function flattenUsageReferences(
  usage: AssetUsage | null | undefined,
): {
  count: number;
  references: { id: string; title: string }[];
  episodes: number[];
} {
  if (!usage) {
    return { count: 0, references: [], episodes: [] };
  }
  const refs: { id: string; title: string }[] = [];
  const episodeSet = new Set<number>();
  const push = (list: UsageReferenceItem[] | undefined) => {
    if (!list) return;
    for (const item of list) {
      refs.push({ id: item.id, title: item.title });
      if (typeof item.episode === "number" && item.episode > 0) {
        episodeSet.add(item.episode);
      }
    }
  };
  push(usage.storyboards);
  push(usage.scripts);
  push(usage.dialogues);
  push(usage.sceneCharacters);
  push(usage.sceneLocations);
  const episodes = Array.from(episodeSet).sort((a, b) => a - b);
  return { count: usage.usage_count ?? refs.length, references: refs, episodes };
}
