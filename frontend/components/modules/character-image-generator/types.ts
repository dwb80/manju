import type { ImageModel, ImageRatio, ImageResponseFormat, ImageSize, StyleValue } from "@/lib/module-types";
import type { CharacterImageHistory } from "@/lib/module-types";

export interface ImageTask {
  id: string;
  status: string;
  image_urls: string[];
  error?: string;
  prompt?: string;
}

export interface HistoryImage {
  id: string;
  url: string;
  prompt: string;
  timestamp: string;
  model: ImageModel;
  size: ImageSize;
  ratio?: ImageRatio;
  responseFormat: ImageResponseFormat;
  n: number;
  isApplied: boolean;
  appliedAt: string;
}

export interface CandidateImage {
  url: string;
  ratio: ImageRatio;
  isGrid?: boolean;
}

export interface AssetHistoryItem {
  id: string;
  url: string;
  ratio: ImageRatio;
  model: ImageModel;
  size: ImageSize;
  timestamp: string;
}

export interface CharacterImageGeneratorProps {
  character: {
    id: string;
    name: string;
    image?: string | null;
    project_id?: string | null;
    role?: string | null;
    gender?: string | null;
    age?: number | null;
    description?: string | null;
    traits?: string[] | null;
    /** 4 中心横切：参考图锁定（详见 docs/spec.md 3.4）。
     *  设置后，生成器会自动把该图作为 img2img 的参考图传入，无需用户手动上传。 */
    reference_image_id?: string | null;
  };
  scriptInfo?: {
    name: string;
    description?: string;
    traits?: string[];
    role?: string;
    gender?: string;
    age?: number;
  };
  onClose: () => void;
  onApplied?: (imageUrl: string) => void;
}

export const COUNT_OPTIONS = [
  { value: "1", label: "1 张" },
  { value: "2", label: "2 张" },
  { value: "3", label: "3 张" },
  { value: "4", label: "4 张" },
];

export const MODEL_OPTIONS: { value: ImageModel; label: string; description: string }[] = [
  {
    value: "agnes-image-2.1-flash",
    label: "Agnes Image 2.1 Flash",
    description: "高信息密度 / 复杂构图 / 图生图",
  },
];

export const RESPONSE_FORMAT_OPTIONS: { value: ImageResponseFormat; label: string; description: string }[] = [
  { value: "url", label: "URL", description: "返回远程图片 URL（推荐，速度快）" },
  { value: "b64_json", label: "Base64", description: "返回 Base64 编码（图生图建议使用，避免二次下载）" },
];

export const DEFAULT_SIZE: ImageSize = "1024x1024";
export const DEFAULT_MODEL: ImageModel = "agnes-image-2.1-flash";
export const DEFAULT_FORMAT: ImageResponseFormat = "url";
export const DEFAULT_STYLE: StyleValue = "";
export const DEFAULT_COUNT = 1;
export const MAX_REFERENCE_IMAGES = 4;
export const MAX_HISTORY = 20;
export const MAX_ASSET_HISTORY = 20;
export const SECONDS_PER_IMAGE = 30;

export const MAX_REFERENCE_IMAGE_SIZE = 200 * 1024 * 1024;
export const MAX_REFERENCE_IMAGE_MB = MAX_REFERENCE_IMAGE_SIZE / 1024 / 1024;

export const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export const ALLOWED_IMAGE_EXTS = /\.(jpe?g|png|webp)$/i;

export function ratioToAspectRatio(ratio: ImageRatio): string {
  const map: Record<ImageRatio, string> = {
    "1:1": "1 / 1",
    "4:3": "4 / 3",
    "3:4": "3 / 4",
    "3:2": "3 / 2",
    "2:3": "2 / 3",
    "9:16": "9 / 16",
    "16:9": "16 / 9",
  };
  return map[ratio] ?? "1 / 1";
}

export function detectClosestRatio(width: number, height: number): ImageRatio {
  if (!width || !height) return "1:1";
  const r = width / height;
  const options: Array<[ImageRatio, number]> = [
    ["1:1", 1],
    ["4:3", 4 / 3],
    ["3:4", 3 / 4],
    ["3:2", 3 / 2],
    ["2:3", 2 / 3],
    ["9:16", 9 / 16],
    ["16:9", 16 / 9],
  ];
  let best: ImageRatio = "1:1";
  let bestDiff = Infinity;
  for (const [name, val] of options) {
    const diff = Math.abs(val - r);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = name;
    }
  }
  return best;
}

export function detectRatioFromImageUrl(url: string): Promise<ImageRatio | null> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      if (!w || !h) return resolve(null);
      resolve(detectClosestRatio(w, h));
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export function formatIsoToLocal(iso: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function toHistoryItem(r: CharacterImageHistory): HistoryImage {
  return {
    id: r.id,
    url: r.url,
    prompt: r.prompt,
    timestamp: formatIsoToLocal(r.created_at),
    model: r.model as ImageModel,
    size: r.size as ImageSize,
    ratio: (r.ratio || "1:1") as ImageRatio,
    responseFormat: r.response_format as ImageResponseFormat,
    n: r.n,
    isApplied: r.is_applied,
    appliedAt: r.applied_at,
  };
}

export function mergeHistoryItems(prev: HistoryImage[], incoming: HistoryImage[]): HistoryImage[] {
  const incomingKeys = new Set(incoming.map((item) => item.id));
  const incomingUrls = new Set(incoming.map((item) => item.url));
  return [
    ...incoming,
    ...prev.filter((item) => !incomingKeys.has(item.id) && !incomingUrls.has(item.url)),
  ];
}
