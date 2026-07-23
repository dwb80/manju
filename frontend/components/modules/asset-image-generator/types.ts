import type { CharacterImageGeneratorProps } from "../character-image-generator/types";
export type { CharacterImageGeneratorProps };
export type AssetImageGeneratorProps = CharacterImageGeneratorProps & { assetKind?: "character" | "scene" | "prop" };
export { ratioToAspectRatio, detectClosestRatio, detectRatioFromImageUrl } from "../character-image-generator/types";
