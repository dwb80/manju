/**
 * @file prop-image-history.ts
 * @description 道具图生成历史。
 *
 * 该类型在 `character-image-history.ts` 中定义（与 scene / character 同构），
 * 这里 re-export 出去，保持 `types/prop-image-history` 这条历史 import 路径仍然有效。
 */
export type { PropImageHistory } from "./character-image-history.js";
