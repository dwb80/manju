"use client";

/**
 * @file character-image-generator/index.tsx
 * @description 角色图片生成器 - 兼容层。
 *
 * 历史：2026-07-17 起，所有 character/prop/scene 工厂统一走
 * `AssetImageGenerator`（见 `components/modules/asset-image-generator`），
 * 本文件保留 `CharacterImageGenerator` 旧 API，向下转译为新组件，
 * 以避免老调用方（角色编辑页、对话框、剧本中心）大规模改动。
 */

import { AssetImageGenerator } from "../asset-image-generator";
import type { CharacterImageGeneratorProps } from "../asset-image-generator/types";
import { adaptCharacterPropsToAsset } from "../asset-image-generator/registry";

export { ratioToAspectRatio, detectClosestRatio, detectRatioFromImageUrl } from "./types";
export type { CharacterImageGeneratorProps } from "../asset-image-generator/types";

export function CharacterImageGenerator(props: CharacterImageGeneratorProps) {
  const adapted = adaptCharacterPropsToAsset(props);
  return <AssetImageGenerator {...adapted} />;
}
