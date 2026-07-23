import type { CharacterImageGeneratorProps, AssetImageGeneratorProps } from "./types";
export function adaptCharacterPropsToAsset(props: CharacterImageGeneratorProps): AssetImageGeneratorProps { return { ...props, assetKind: "character" }; }
