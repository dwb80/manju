"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { CSSProperties } from "react";
import {
  Loader2,
  Sparkles,
  X,
  Check,
  CheckCircle2,
  Trash2,
  Wand2,
  Image as ImageIcon,
  User,
  Upload,
  RotateCcw,
  Info,
  ChevronDown,
  ChevronRight,
  Circle,
  RefreshCw,
  Maximize2,
  ExternalLink,
  History as HistoryIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { api, uploadImages } from "@/lib/api-client";
import { toast } from "@/components/common/toast";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import type { Character, CharacterImageHistory, ImageModel, ImageRatio, ImageResponseFormat, ImageSize, StyleValue } from "@/lib/module-types";
import { updateCharacter } from "@/services/character.service";
import {
  appendCharacterImageHistory,
  applyCharacterImageHistory,
  deleteCharacterImageHistory,
  listCharacterImageHistory,
} from "@/services/character-image-history.service";
import {
  aspectRatioOptions,
  defaultSizeFromRatio,
  findStyleOption,
  imageRatioFromSize,
  imageSizeOptions,
  styleOptions,
} from "@/lib/project-workflow";
import { AspectRatioSelect } from "@/components/modules/image-picker-aspect-ratio-select";
import { StylePicker } from "@/components/modules/image-picker-style";

interface ImageTask {
  id: string;
  status: string;
  image_urls: string[];
  error?: string;
  prompt?: string;
}

interface HistoryImage {
  id: string;
  url: string;
  prompt: string;
  timestamp: string;
  model: ImageModel;
  size: ImageSize;
  /**
   * 记录时的精确图片比例（9:16/16:9 等会与 2:3/3:2 共享同一 size，保留 ratio 才能
   * 在历史回放时正确还原用户原选）。旧记录无此字段时按 size 反查（会有歧义但不报错）。
   */
  ratio?: ImageRatio;
  responseFormat: ImageResponseFormat;
  n: number;
  /**
   * 是否曾被设为角色资产。后端持久化语义：true 后永真（除非显式删除该条记录），
   * 移除角色资产不影响此字段，保证「已选资产历史」不丢。
   */
  isApplied: boolean;
  appliedAt: string;
}

/**
 * 候选图：每张图都带着生成时提交的比例。
 * 中间预览区按每张图自身的 ratio 渲染（不是当前表单 ratio），保证
 * 「生图时提交的比例要求」严格生效——即使后续改了 ratio 设置，已生成的
 * 图片预览比例也不会变。
 */
interface CandidateImage {
  url: string;
  ratio: ImageRatio;
}

/** 历史中保存的角色资产条目：每次「设为角色资产」都会新增一条，URL 去重。 */
interface AssetHistoryItem {
  id: string;
  url: string;
  ratio: ImageRatio;
  model: ImageModel;
  size: ImageSize;
  timestamp: string;
}

interface CharacterImageGeneratorProps {
  character: Character;
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

const COUNT_OPTIONS = [
  { value: "1", label: "1 张" },
  { value: "2", label: "2 张" },
  { value: "3", label: "3 张" },
  { value: "4", label: "4 张" },
];

const MODEL_OPTIONS: { value: ImageModel; label: string; description: string }[] = [
  {
    value: "agnes-image-2.1-flash",
    label: "Agnes Image 2.1 Flash",
    description: "高信息密度 / 复杂构图 / 图生图",
  },
];

const RESPONSE_FORMAT_OPTIONS: { value: ImageResponseFormat; label: string; description: string }[] = [
  { value: "url", label: "URL", description: "返回远程图片 URL（推荐，速度快）" },
  { value: "b64_json", label: "Base64", description: "返回 Base64 编码（图生图建议使用，避免二次下载）" },
];

/** 一组默认图片参数（点击「重置」时使用）。 */
const DEFAULT_SIZE: ImageSize = "1024x1024";
const DEFAULT_MODEL: ImageModel = "agnes-image-2.1-flash";
const DEFAULT_FORMAT: ImageResponseFormat = "url";
const DEFAULT_STYLE: StyleValue = "";
// Agnes 官方文档对参考图附件大小无硬限；10MB 是 base64 后的硬限（image queue input image size），
// 后端会在传给 Agnes 前用 sharp 压缩到 9MB（base64）以内。所以这里的"上限"是后端传输防御，
// 设大一些（200MB）让正常用户几乎感受不到限制，同时挡住明显异常的大文件（防 DoS）。
const DEFAULT_COUNT = 1;
const MAX_REFERENCE_IMAGES = 4;
const MAX_HISTORY = 20;
/** 已选资产历史的最大保留条数。多了旧图往下挤，保留用户最近用过的。 */
const MAX_ASSET_HISTORY = 20;
const SECONDS_PER_IMAGE = 30;

/**
 * 单张参考图大小上限（200MB）。
 * 与后端 parseMultipartImages 严格对齐（@see backend/src/http/router.ts）：
 *   - 后端单张硬限 200MB；
 *   - 后端 body 接收上限 850MB（200MB × 4 张 + multipart 开销）。
 * 浏览器层面无法拦截 OS 级限制（恶意客户端可绕过），所以后端是兜底。
 * 注意：Agnes 官方文档对参考图大小无硬限；超过 200MB 的图片会被后端拒绝(返回 413)。
 * 即使后端接收后,resolveMediaInput 会用 sharp 压缩到 9MB（base64）以内再传给 Agnes。
 */
const MAX_REFERENCE_IMAGE_SIZE = 200 * 1024 * 1024; // 200MB
const MAX_REFERENCE_IMAGE_MB = MAX_REFERENCE_IMAGE_SIZE / 1024 / 1024;

/** 允许的图片 MIME 子集（白名单；GIF/BMP/SVG 在生成模型里支持差，干脆禁掉）。 */
const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
const ALLOWED_IMAGE_EXTS = /\.(jpe?g|png|webp)$/i;

/** 失败占位图：本地 1x1 灰色 SVG，data URI 避免 placehold.co 中文乱码（H1）。 */
const FALLBACK_PLACEHOLDER =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="768" viewBox="0 0 1024 768">` +
    `<rect width="100%" height="100%" fill="#1f1f1f"/>` +
    `<g fill="none" stroke="#555" stroke-width="2">` +
    `<rect x="382" y="284" width="260" height="200" rx="8"/>` +
    `<circle cx="450" cy="350" r="14"/>` +
    `<path d="M382 420l80-70 70 60 60-50 50 40"/>` +
    `</g>` +
    `<text x="512" y="540" font-family="sans-serif" font-size="22" fill="#888" text-anchor="middle">` +
    `AI 生成失败 · 占位图` +
    `</text></svg>`
  );

/** ImageRatio → CSS aspect-ratio 值。抽到顶层方便复用，候选 / 资产 / 历史三处都用得到。 */
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

/**
 * 从图片真实尺寸反推最接近的标准 ImageRatio。
 * 用于：右侧「已选角色资产」卡片点击预览时，中间区不知道该图原始 ratio，
 * 不能拿当前表单 ratio 强加——必须从图自身 naturalWidth / naturalHeight 推算。
 * 加载失败 / data URL 拿不到尺寸时返回 undefined，由调用方决定 fallback。
 */
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

/** 用一个 Image 元素加载并读取 naturalWidth/Height，返回最接近的 ImageRatio。 */
export function detectRatioFromImageUrl(url: string): Promise<ImageRatio | null> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(null);
    const img = new Image();
    // data: URL 同样能拿到 naturalWidth；只对跨域无 CORS 头的远程图会拿到 0
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

/**
 * 持久化 key（前缀 + character.id）。
 * 用 localStorage 而不是 sessionStorage：sessionStorage 跟 tab 生命周期绑定，
 * 关闭 tab 就清空，刷新页面后 history 全部丢失；localStorage 跨 tab 持久（G3）。
 */
const historyStorageKey = (characterId: string) => `img-gen-history:${characterId}`;
/** 已选资产历史的持久化 key。每次「设为角色资产」都追加一条。 */
const assetHistoryStorageKey = (characterId: string) => `img-gen-asset-history:${characterId}`;

/**
 * 后端 ISO 时间 → 本地化字符串（用于历史卡片展示）。
 * 无效输入返回空串，避免"undefined/Invalid Date"出现在 UI。
 */
function formatIsoToLocal(iso: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

/**
 * 后端 CharacterImageHistory → 前端 HistoryImage 归一化。
 *
 * 转换要点：
 * - created_at (ISO) → timestamp (本地化字符串)，让 UI 不感知时区；
 * - response_format → responseFormat（camelCase，UI 字段）；
 * - is_applied / applied_at → isApplied / appliedAt；
 * - ratio 留作 ImageRatio，未知值回落 "1:1"。
 */
function toHistoryItem(r: CharacterImageHistory): HistoryImage {
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

function mergeHistoryItems(prev: HistoryImage[], incoming: HistoryImage[]): HistoryImage[] {
  const incomingKeys = new Set(incoming.map((item) => item.id));
  const incomingUrls = new Set(incoming.map((item) => item.url));
  return [
    ...incoming,
    ...prev.filter((item) => !incomingKeys.has(item.id) && !incomingUrls.has(item.url)),
  ];
}

/**
 * 带 loading + error 状态的缩略图组件。
 * - 上传后立即渲染，URL 是后端 /media/... 相对路径（已被 next.config.mjs rewrite 代理到后端）；
 * - 加载中显示骨架 + 旋转图标；
 * - 加载失败显示带删除按钮的占位，避免空白块让用户以为系统卡死。
 */
function ThumbnailImage({ url, alt }: { url: string; alt: string }) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");
  // url 变化时重置状态（覆盖删除/重新上传）
  useEffect(() => {
    setStatus("loading");
  }, [url]);
  if (status === "error") {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center bg-[#2a1a1a] text-red-300">
        <X className="h-4 w-4" />
        <span className="mt-1 text-[9px]">加载失败</span>
      </div>
    );
  }
  return (
    <>
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#1a1a1a]">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-500" />
        </div>
      )}
      <img
        src={url}
        alt={alt}
        className="h-full w-full object-cover"
        onLoad={() => setStatus("loaded")}
        onError={() => {
          console.error("[img-gen] 缩略图加载失败", url);
          setStatus("error");
        }}
      />
    </>
  );
}

/**
 * 计数高亮：数字变化时用 key 强制 remount，触发一次脉冲动画，
 * 肉眼可见"0/4 → 1/4"的联动效果。
 */
function CountHighlight({ value, max }: { value: number; max: number }) {
  // key = value，每次数字变化都会重新挂载，触发 entry 动画
  return (
    <span
      key={value}
      className="inline-block animate-in fade-in slide-in-from-right-1 zoom-in-110 duration-300"
    >
      {value}/{max}
    </span>
  );
}

export function CharacterImageGenerator({ character, scriptInfo, onClose, onApplied }: CharacterImageGeneratorProps) {
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState<StyleValue>(DEFAULT_STYLE);
  const [count, setCount] = useState(String(DEFAULT_COUNT));

  // 与文档/images.txt 对齐的完整图片参数
  const [model, setModel] = useState<ImageModel>(DEFAULT_MODEL);
  const [size, setSize] = useState<ImageSize>(DEFAULT_SIZE);
  /**
   * 比例与 size 并存：9:16/2:3、16:9/3:2 会共享同一尺寸（768x1152 / 1152x768），
   * 仅靠 size 反查 ratio 会丢精度。ratio 才是用户选中的真相，size 用于 API 请求。
   */
  const [ratio, setRatio] = useState<ImageRatio>("1:1");
  const [responseFormat, setResponseFormat] = useState<ImageResponseFormat>(DEFAULT_FORMAT);
  const [negativePrompt, setNegativePrompt] = useState("");
  const [seed, setSeed] = useState("");

  // 图生图：参考图（多张）
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [uploadingRef, setUploadingRef] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 调试：每次 referenceImages 变化时打印，方便排查"上传了但 UI 不变"的问题
  useEffect(() => {
    console.info("[img-gen] referenceImages 状态变化", {
      count: referenceImages.length,
      urls: referenceImages,
    });
  }, [referenceImages]);

  // 高级选项折叠状态（默认折叠）
  const [showAdvanced, setShowAdvanced] = useState(false);
  // 重置确认弹窗（D4）
  const [confirmReset, setConfirmReset] = useState(false);

  const [isGenerating, setIsGenerating] = useState(false);
  // 强化提示词：调 /api/prompts/enhance 把现有 prompt 按推荐结构（主体/动作/环境/风格/构图/质量）改写。
  // 与 isGenerating 互不干扰：强化不会触发生图，生图也不会中断强化。
  const [isEnhancing, setIsEnhancing] = useState(false);
  // candidates 初始 = 当前角色资产（character.image 是 DB 持久的，刷新后仍在），
  // 这样刷新页面中间预览区会默认显示已选资产图，而不是空状态。
  // 每张图携带自己的 ratio：生图时按当前表单 ratio 提交，预览就严格按这个 ratio 显示，
  // 不会被后续修改的 ratio 拉扯变形。
  const [candidates, setCandidates] = useState<CandidateImage[]>(
    character.image ? [{ url: character.image, ratio: imageRatioFromSize(DEFAULT_SIZE) }] : []
  );
  const [selectedIndex, setSelectedIndex] = useState<number | null>(
    character.image ? 0 : null
  );
  /**
   * 角色图片生成历史（后端持久化）。
   *
   * 单一 state 驱动两个 UI 区块：
   * - 「历史图片」= historyRecords 全部
   * - 「已选资产历史」= historyRecords.filter(r => r.is_applied)
   *
   * 旧实现是 localStorage，刷新/换设备即丢；改成后端 SQLite 后跨设备/刷新都不丢。
   */
  const [historyRecords, setHistoryRecords] = useState<HistoryImage[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState<string | null>(character.image || null);
  const [isSaving, setIsSaving] = useState(false);
  // 当前生成任务的 AbortController（用于"终止"按钮）；每次发起新任务时新建
  const abortControllerRef = useRef<AbortController | null>(null);
  // 是否被用户主动终止（区分"网络/AI 失败"和"用户取消"）
  const isCancelledRef = useRef(false);
  // 当前角色 id 的最新引用，避免 fetch 闭包拿到旧 character.id
  const latestCharacterIdRef = useRef(character.id);
  useEffect(() => { latestCharacterIdRef.current = character.id; }, [character.id]);

  // ============ 图生图自动判断 ============
  // 只要上传了参考图（referenceImages.length > 0），就自动判定为图生图模式：
  // 1) isImg2Img 自动为 true → UI 顶部显示「图生图 · N 张」徽标
  // 2) handleGenerate 自动把 referenceImages 作为 images 数组传给后端
  //    （后端再放进 extra_body.image，触发 Agnes 的图生图工作流）
  // 3) 「生成图片」按钮文案自动变为「图生图生成」
  // 用户无需手动切换模式，上传即触发。
  const isImg2Img = referenceImages.length > 0;
  const n = useMemo(() => Math.max(1, Math.min(4, Number(count) || DEFAULT_COUNT)), [count]);
  // 预计耗时（F3）：每张 ~30s，最长 2min
  const estimatedSeconds = useMemo(() => Math.min(120, n * SECONDS_PER_IMAGE), [n]);

  // ============ 卸载时清理：用户关闭标签页时中止后台请求，避免泄漏 ============
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // ============ 初始化：从后端加载历史（替代旧 localStorage 实现） ============
  // 旧实现是 localStorage，刷新浏览器/换设备/清缓存即丢；改成后端 SQLite 后：
  // - 刷新不丢
  // - 跨设备同步
  // - 多人协作时其他人也能看到
  useEffect(() => {
    let cancelled = false;
    setHistoryLoading(true);
    listCharacterImageHistory(character.id)
      .then((records) => {
        if (cancelled) return;
        setHistoryRecords((records ?? []).map(toHistoryItem));
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[img-gen] 加载图片历史失败:", err);
        // 失败时不阻塞 UI，用户依然可以正常生成图，只是右侧两个区块为空
        setHistoryRecords([]);
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [character.id]);

  /**
   * 已选资产历史 = historyRecords 中 isApplied=true 的子集。
   * useMemo 避免每次渲染都过滤；后端 list 时已按 created_at 倒序。
   */
  const assetHistory = useMemo(
    () => historyRecords.filter((h) => h.isApplied),
    [historyRecords]
  );
  /**
   * 兼容别名：旧代码用 `history` 这个名字直接 .length / .map，state 重命名为 historyRecords 后
   * 保留这个别名避免大面积改 UI（history 与 window.history 重名时 TS 会优先取后者，所以
   * 显式 const 声明覆盖掉）。
   */
  const history = historyRecords;

  /**
   * 把 AI 生成的图片批量追加到后端历史。
   * - 单条失败不阻塞整体；
   * - 全部失败时 toast 提示一次，避免静默丢数据；
   * - 成功后用后端返回的 record（带稳定 id）更新前端 state，方便后续 PATCH/DELETE。
   */
  const persistGeneratedImages = useCallback(
    async (params: {
      characterId: string;
      projectId: string;
      urls: string[];
      ratio: ImageRatio;
      model: ImageModel;
      size: ImageSize;
      prompt: string;
      negativePrompt: string;
      responseFormat: ImageResponseFormat;
    }) => {
      const results = await Promise.allSettled(
        params.urls.map((url) =>
          appendCharacterImageHistory({
            character_id: params.characterId,
            project_id: params.projectId,
            url,
            ratio: params.ratio,
            model: params.model,
            size: params.size,
            prompt: params.prompt,
            negative_prompt: params.negativePrompt || undefined,
            response_format: params.responseFormat,
            n: params.urls.length,
          }).then(toHistoryItem)
        )
      );
      const succeeded: HistoryImage[] = [];
      const failed = results.length;
      results.forEach((r, idx) => {
        if (r.status === "fulfilled") {
          succeeded.push(r.value);
        } else {
          console.error(`[img-gen] 追加历史失败 url=${params.urls[idx]}`, r.reason);
        }
      });
      if (succeeded.length > 0) {
        setHistoryRecords((prev) => mergeHistoryItems(prev, succeeded));
      }
      if (succeeded.length === 0 && failed > 0) {
        toast.error("历史保存失败", "刷新后可能看不到刚生成的图，请稍后重试");
      } else if (succeeded.length < failed) {
        toast.error("部分历史保存失败", `${failed - succeeded.length} 张未保存`);
      }
    },
    []
  );

  const ensureHistoryRecordForAsset = useCallback(
    async (params: {
      url: string;
      ratioAtGen?: ImageRatio;
      promptText?: string;
      markApplied?: boolean;
    }): Promise<HistoryImage | null> => {
      const existing =
        historyRecords.find((h) => h.url === params.url && (!params.ratioAtGen || h.ratio === params.ratioAtGen)) ??
        historyRecords.find((h) => h.url === params.url);

      let record: CharacterImageHistory | null = null;
      if (existing) {
        if (!params.markApplied) return existing;
        record = await applyCharacterImageHistory(existing.id);
      } else {
        record = await appendCharacterImageHistory({
          character_id: character.id,
          project_id: character.project_id ?? "",
          url: params.url,
          ratio: params.ratioAtGen ?? ratio,
          model: model || DEFAULT_MODEL,
          size: size || DEFAULT_SIZE,
          prompt: params.promptText ?? prompt.trim(),
          negative_prompt: negativePrompt.trim() || undefined,
          response_format: responseFormat || DEFAULT_FORMAT,
          n: 1,
        });
      }

      if (params.markApplied && !existing) {
        record = await applyCharacterImageHistory(record.id);
      }

      const item = toHistoryItem(record);
      setHistoryRecords((prev) => mergeHistoryItems(prev, [item]));
      return item;
    },
    [character.id, character.project_id, historyRecords, model, negativePrompt, prompt, ratio, responseFormat, size],
  );

  useEffect(() => {
    if (scriptInfo) {
      const parts: string[] = [];
      if (scriptInfo.name) parts.push(scriptInfo.name);
      if (scriptInfo.role) {
        const roleMap: Record<string, string> = {
          protagonist: "主角",
          supporting: "配角",
          antagonist: "反派",
          minor: "次要角色",
        };
        parts.push(roleMap[scriptInfo.role] || scriptInfo.role);
      }
      if (scriptInfo.gender) {
        const genderMap: Record<string, string> = { male: "男性", female: "女性", other: "其他" };
        parts.push(genderMap[scriptInfo.gender] || scriptInfo.gender);
      }
      if (scriptInfo.age) parts.push(`${scriptInfo.age}岁`);
      if (scriptInfo.description) parts.push(scriptInfo.description);
      if (scriptInfo.traits && scriptInfo.traits.length > 0) parts.push(scriptInfo.traits.join("，"));
      setPrompt(parts.join("，"));
    } else if (character.description) {
      const parts: string[] = [];
      parts.push(character.name);
      const roleMap: Record<string, string> = {
        protagonist: "主角",
        supporting: "配角",
        antagonist: "反派",
        minor: "次要角色",
      };
      if (character.role) parts.push(roleMap[character.role] || character.role);
      if (character.gender) {
        const genderMap: Record<string, string> = { male: "男性", female: "女性", other: "其他" };
        parts.push(genderMap[character.gender] || character.gender);
      }
      if (character.age) parts.push(`${character.age}岁`);
      if (character.description) parts.push(character.description);
      if (character.traits && character.traits.length > 0) parts.push(character.traits.join("，"));
      setPrompt(parts.join("，"));
    }
  }, [character, scriptInfo]);

  /**
   * 上传参考图：调用 /api/uploads，拿到 URL 后塞入 referenceImages 触发图生图。
   * - 自动判断：上传成功后 referenceImages.length > 0，
   *   isImg2Img 自动为 true，handleGenerate 会自动把参考图作为 images 数组传给后端，
   *   无需用户手动切换模式。
   * - 文件类型白名单 + 大小硬限制：只允许 PNG/JPG/JPEG/WEBP；超过 100MB 直接跳过。
   *   早期直接 return，**不会发起任何网络请求**，避免大文件拖慢后端。
   * - console 调试日志：上传链路出问题方便定位。
   */
  const handleUploadReference = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) {
      console.info("[img-gen] 未选择文件");
      return;
    }
    setUploadingRef(true);
    try {
      const allFiles = Array.from(files);
      // 1) 客户端先过滤：非白名单 / 超大文件 —— 全部在送后端前剔除
      const fileArray: File[] = [];
      for (const file of allFiles) {
        // MIME 缺失时按扩展名兜底
        const mimeOk = file.type
          ? (ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)
          : ALLOWED_IMAGE_EXTS.test(file.name);
        if (!mimeOk) {
          toast.error(
            "已跳过非图片文件",
            `${file.name}（仅支持 PNG / JPG / WEBP）`
          );
          continue;
        }
        if (file.size > MAX_REFERENCE_IMAGE_SIZE) {
          toast.error(
            "已跳过超大文件",
            `${file.name}（${(file.size / 1024 / 1024).toFixed(1)}MB > ${MAX_REFERENCE_IMAGE_MB}MB）`
          );
          continue;
        }
        fileArray.push(file);
      }
      if (fileArray.length === 0) {
        toast.error(
          "没有可用的图片文件",
          `请选择 PNG / JPG / WEBP 格式（单张 ≤ ${MAX_REFERENCE_IMAGE_MB}MB）`
        );
        return;
      }
      console.info(
        "[img-gen] 开始上传参考图",
        fileArray.map((f) => `${f.name}(${f.type || "?"}, ${(f.size / 1024 / 1024).toFixed(2)}MB)`)
      );
      // 2) 调后端 /api/uploads
      const uploaded = await uploadImages(fileArray);
      console.info("[img-gen] 上传返回", uploaded);
      const urls = uploaded.map((item) => item.url).filter(Boolean);
      if (urls.length === 0) throw new Error("上传失败：未返回 URL");
      // 3) 写入 referenceImages；只要数量 > 0，isImg2Img 自动为 true，UI 自动显示"图生图"徽标
      setReferenceImages((prev) => {
        const next = [...prev, ...urls].slice(0, MAX_REFERENCE_IMAGES);
        console.info("[img-gen] referenceImages 更新", { prev: prev.length, added: urls.length, next: next.length });
        return next;
      });
      toast.success(
        `已添加 ${urls.length} 张参考图`,
        `已自动切换为图生图模式（${referenceImages.length + urls.length}/${MAX_REFERENCE_IMAGES}）`
      );
    } catch (err) {
      console.error("[img-gen] 参考图上传失败:", err);
      toast.error("参考图上传失败", (err as Error).message);
    } finally {
      setUploadingRef(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [referenceImages.length]);

  const handleRemoveReference = (url: string) => {
    setReferenceImages((prev) => prev.filter((u) => u !== url));
  };

  /** 一键重置所有图片参数（D4：带确认弹窗）。 */
  const doResetParams = () => {
    setModel(DEFAULT_MODEL);
    setSize(DEFAULT_SIZE);
    setRatio("1:1");
    setResponseFormat(DEFAULT_FORMAT);
    setCount(String(DEFAULT_COUNT));
    setStyle(DEFAULT_STYLE);
    setNegativePrompt("");
    setSeed("");
    setReferenceImages([]);
    setShowAdvanced(false);
    toast.success("参数已重置");
    setConfirmReset(false);
  };

  const handleResetParams = () => {
    // 简化策略：仅当存在非默认修改时才弹确认
    const hasChanges =
      model !== DEFAULT_MODEL ||
      size !== DEFAULT_SIZE ||
      ratio !== "9:16" ||
      responseFormat !== DEFAULT_FORMAT ||
      count !== String(DEFAULT_COUNT) ||
      style !== DEFAULT_STYLE ||
      negativePrompt !== "" ||
      seed !== "" ||
      referenceImages.length > 0;
    if (hasChanges) {
      setConfirmReset(true);
    } else {
      toast.success("参数已是默认值", undefined, 1500);
    }
  };

  /** 用户在比例下拉框中选择：同时更新 ratio（UI 真相）和 size（API 真相）。 */
  const handleRatioChange = useCallback((r: ImageRatio) => {
    setRatio(r);
    setSize(defaultSizeFromRatio(r));
  }, []);

  /**
   * 强化提示词：调 /api/prompts/enhance。
   * - 成功：用 AI 改写后的内容替换 prompt，toast 提示。
   * - 失败：toast 错误，prompt 不变。
   * - 超时：30s 内必须返回（后端 AI_TIMEOUTS.enhancePrompt）。
   * - 防御：返回的 enhanced 为空时回退原 prompt，不覆盖。
   */
  const handleEnhancePrompt = async () => {
    const trimmed = prompt.trim();
    if (!trimmed) {
      toast.error("提示词为空", "请先输入要强化的内容");
      return;
    }
    if (isEnhancing) return;
    setIsEnhancing(true);
    try {
      const result = await api<{ enhanced?: string; prompt?: string }>(
        "/api/prompts/enhance",
        {
          method: "POST",
          body: JSON.stringify({ prompt: trimmed, mode: "image" }),
        }
      );
      const enhanced = (result.enhanced ?? result.prompt ?? "").trim();
      if (!enhanced) {
        toast.error("强化失败", "AI 未返回内容，请稍后重试");
        return;
      }
      setPrompt(enhanced);
      toast.success("提示词已强化", undefined, 1500);
    } catch (err) {
      toast.error("强化失败", (err as Error).message || "网络异常");
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleGenerate = async () => {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      toast.error("请输入描述");
      return;
    }
    // 每次发起新任务都新建一个 AbortController（旧的会被覆盖，符合"单 in-flight 任务"语义）
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    isCancelledRef.current = false;

    setIsGenerating(true);
    setCandidates([]);
    setSelectedIndex(null);
    try {
      // 提示词 + 可选风格修饰（图生图时不要追加，避免覆盖参考图特征）
      const styleOption = findStyleOption(style);
      const styleSuffix = styleOption?.promptSuffix || "";
      const finalPrompt =
        styleSuffix && referenceImages.length === 0
          ? `${trimmedPrompt}${styleSuffix}`
          : trimmedPrompt;
      const seedNum = seed.trim() ? Number(seed) : undefined;
      const task = await api<ImageTask>("/api/images/generate", {
        method: "POST",
        // 传 signal，让用户在等得不耐烦时能终止请求
        signal: controller.signal,
        body: JSON.stringify({
          model,
          prompt: finalPrompt,
          n,
          size,
          negative_prompt: negativePrompt.trim() || undefined,
          seed: Number.isFinite(seedNum) ? seedNum : undefined,
          // 图生图：把参考图放在顶层 images 数组（后端会转到 extra_body.image）
          ...(referenceImages.length > 0 ? { images: referenceImages } : {}),
          response_format: responseFormat,
        }),
      });
      const urls = Array.isArray(task.image_urls) ? task.image_urls.filter(Boolean) : [];
      if (urls.length === 0) {
        throw new Error("AI 未返回任何图片");
      }
      // 每张候选图都带 ratio：严格按本次生成提交的比例显示，不被后续修改的 ratio 拉扯。
      const newCandidates: CandidateImage[] = urls.map((url) => ({ url, ratio }));
      setCandidates(newCandidates);
      setSelectedIndex(0);
      // 先把历史写入后端再结束本次生成流程，避免用户立即刷新时历史还没落库。
      await persistGeneratedImages({
        characterId: character.id,
        projectId: character.project_id ?? "",
        urls,
        ratio,
        model,
        size,
        prompt: finalPrompt,
        negativePrompt: negativePrompt.trim(),
        responseFormat,
      });
    } catch (err) {
      // 主动终止：fetch 会 reject 一个 AbortError；不弹错误 toast，只在控制台记一下
      if ((err as Error)?.name === "AbortError" || isCancelledRef.current) {
        console.info("[img-gen] 用户已终止生成");
        // 终止时清掉 candidates，避免在中间区显示半截结果
        setCandidates([]);
        return;
      }
      console.error("AI 生成图片失败:", err);
      // fallback 用本地 SVG 避免中文乱码（H1）
      const fallback = Array.from({ length: n }, () => FALLBACK_PLACEHOLDER);
      setCandidates(fallback.map((url) => ({ url, ratio })));
      setSelectedIndex(0);
      toast.error("AI 生成失败", "已使用占位图，你可以重新尝试");
    } finally {
      // 清理 controller（如果还是自己，说明是当前任务结束的回调）
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      setIsGenerating(false);
    }
  };

  /**
   * 用户点击"终止"按钮：中止当前 in-flight 请求。
   * 终止后 UI 回到"无候选图"状态，所有输入参数保留，方便用户调整后再次发起。
   */
  const handleCancel = useCallback(() => {
    if (!isGenerating) return;
    isCancelledRef.current = true;
    abortControllerRef.current?.abort();
    toast.success("已终止生成", "可以调整参数后重新发起");
  }, [isGenerating]);

  /** 重新生成同款参数（E3）。 */
  const handleRegenerateSame = useCallback(() => {
    if (!prompt.trim()) {
      toast.error("暂无参数可复用", "请先填写提示词");
      return;
    }
    handleGenerate();
  }, [prompt, handleGenerate]);

  /** 设为角色资产：成功后从候选区移除（F2），toast 带下一步行动（G1）。 */
  const handleSelectAsAsset = async (url: string, ratioAtGen?: ImageRatio) => {
    if (selectedAsset === url) {
      toast.success("该图已是当前角色资产", undefined, 1500);
      return;
    }
    setIsSaving(true);
    try {
      await updateCharacter(character.id, { image: url });
      setSelectedAsset(url);
      // 取消该候选的选中态
      setSelectedIndex(null);
      try {
        await ensureHistoryRecordForAsset({
          url,
          ratioAtGen,
          promptText: prompt.trim(),
          markApplied: true,
        });
      } catch (err) {
        // 历史标记失败不影响"主流程成功"（character.image 已更新），但要明确提示用户刷新后可能缺记录。
        console.warn("[img-gen] 保存已选资产历史失败:", err);
        toast.error("资产历史保存失败", "当前角色图片已更新，但刷新后可能缺少这条历史");
      }
      // toast 带"在分镜中使用"行动按钮（G1）
      toast.action("角色图片已更新", {
        label: "在分镜中使用",
        onClick: () => {
          onApplied?.(url);
        },
      });
    } catch (err) {
      toast.error("更新失败", (err as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveAsset = async () => {
    setIsSaving(true);
    try {
      await updateCharacter(character.id, { image: "" });
      setSelectedAsset(null);
      // 注意：这里**不**清空 is_applied 标记。已选资产历史的语义是"所有曾被设为角色资产的图"，
      // 即便被新图覆盖也应该保留。历史里 isApplied=true 的项依然会显示在「已选资产历史」区块。
      toast.success("角色图片已移除");
    } catch (err) {
      toast.error("移除失败", (err as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  /** 从「历史图片」中删除单条（同步到后端 + 前端 state）。 */
  const handleDeleteFromHistory = async (id: string) => {
    // 乐观更新：先从 UI 移除，再调 API；API 失败时回滚并提示。
    const prev = historyRecords;
    setHistoryRecords((curr) => curr.filter((h) => h.id !== id));
    try {
      await deleteCharacterImageHistory(id);
    } catch (err) {
      console.error("[img-gen] 删除历史失败:", err);
      toast.error("删除失败", (err as Error).message);
      setHistoryRecords(prev);
    }
  };

  const handleUseFromHistory = (item: HistoryImage) => {
    // 优先用历史里的精确 ratio（9:16 vs 2:3 这种歧义靠它消解）；旧记录无此字段则按 size 反查
    const itemRatio: ImageRatio = item.ratio ?? imageRatioFromSize(item.size) ?? "1:1";
    setCandidates([{ url: item.url, ratio: itemRatio }]);
    setSelectedIndex(0);
    setPrompt(item.prompt);
    setModel(item.model);
    setSize(item.size);
    setRatio(itemRatio);
    setResponseFormat(item.responseFormat);
    setCount(String(item.n));
  };

  /**
   * 点击"已选角色资产"卡片：在中间预览区显示该图。
   * 不修改 prompt/model/size（资产图就是当前已应用状态，参数面板应该反映"如果要再生成一张"的设定）。
   * ratio 从图片自身 naturalWidth/Height 反推——不让当前表单 ratio 强加给一张比例未知的图。
   * 检测失败时回退到当前表单 ratio。
   */
  const handlePreviewAsset = useCallback(async (url: string) => {
    const detected = await detectRatioFromImageUrl(url);
    setCandidates([{ url, ratio: detected ?? ratio }]);
    setSelectedIndex(0);
  }, [ratio]);

  /**
   * 点击「已选资产历史」里的图：中间预览 + 左侧参数同步切换为生成时的状态。
   *
   * 设计意图：用户想"回到这张图"——既看当时的图，也看当时用的 prompt/ratio/size/model。
   * 切换后点「生成图片」会按这套参数重出一张同风格的新图，相当于"重做"入口。
   *
   * - ratio 优先用历史里存的精确 ratio（生图时提交的）；
   * - prompt/model/size/responseFormat/count 全部按历史快照恢复；
   * - 防御：缺字段时回落 "1:1" / DEFAULT_*，不让 UI 出现 undefined。
   */
  const handlePreviewAssetHistory = useCallback((item: HistoryImage) => {
    const itemRatio: ImageRatio = item.ratio ?? "1:1";
    setCandidates([{ url: item.url, ratio: itemRatio }]);
    setSelectedIndex(0);
    // 左侧参数同步切到生成时的状态（"切图即切参"是用户预期）
    setPrompt(item.prompt);
    setModel((item.model || DEFAULT_MODEL) as ImageModel);
    setSize((item.size || DEFAULT_SIZE) as ImageSize);
    setRatio(itemRatio);
    setResponseFormat((item.responseFormat || DEFAULT_FORMAT) as ImageResponseFormat);
    setCount(String(item.n || 1));
  }, []);

  /**
   * 一键把「已选资产历史」里的图重新应用为当前角色资产。
   * - 复用 updateCharacter（设 character.image）+ applyCharacterImageHistory（打 is_applied 标）；
   * - 不影响其他历史项的 is_applied 状态。
   * - 同步恢复左侧参数：让用户"用这张图的设定再生成一张"成为可能（重做入口）。
   */
  const handleReapplyAssetFromHistory = useCallback(
    async (item: HistoryImage) => {
      setIsSaving(true);
      try {
        await updateCharacter(character.id, { image: item.url });
        setSelectedAsset(item.url);
        // 左侧参数同步切到该图的生成参数
        const itemRatio: ImageRatio = item.ratio ?? "1:1";
        setPrompt(item.prompt);
        setModel((item.model || DEFAULT_MODEL) as ImageModel);
        setSize((item.size || DEFAULT_SIZE) as ImageSize);
        setRatio(itemRatio);
        setResponseFormat((item.responseFormat || DEFAULT_FORMAT) as ImageResponseFormat);
        setCount(String(item.n || 1));
        // 后端已允许 url 已存在时直接返回旧记录，所以这里即便再次 apply 也不会重复；
        // 但为了 state 立即更新，仍 PATCH 一次确保 is_applied=true 和 applied_at 最新。
        const updated = await applyCharacterImageHistory(item.id);
        setHistoryRecords((prev) => prev.map((h) => (h.id === updated.id ? toHistoryItem(updated) : h)));
        toast.success("已应用历史资产");
      } catch (err) {
        toast.error("应用失败", (err as Error).message);
      } finally {
        setIsSaving(false);
      }
    },
    [character.id]
  );

  /**
   * 从「已选资产历史」中删除一条（同步到后端 + 前端 state）。
   * 即便该图是当前 selectedAsset，也只删历史记录，不影响 character.image。
   */
  const handleDeleteAssetHistory = useCallback(async (id: string) => {
    const prev = historyRecords;
    setHistoryRecords((curr) => curr.filter((h) => h.id !== id));
    try {
      await deleteCharacterImageHistory(id);
    } catch (err) {
      console.error("[img-gen] 删除资产历史失败:", err);
      toast.error("删除失败", (err as Error).message);
      setHistoryRecords(prev);
    }
  }, [historyRecords]);

  /**
   * 在新浏览器标签页打开图片原图。
   * 适用场景：候选图 / 已选资产 / 历史图 → 用户想看 AI 生成的原尺寸大图时点一下。
   * - data: URL 太大浏览器会卡死,提示用户改用 URL 模式;URL 模式（Agnes 默认）下直接打开。
   * - 走 noopener,noreferrer:安全考虑,新页面拿不到 opener 引用,不会污染 window.opener。
   * - 失败时 toast 提示（极端情况：浏览器拦截弹窗）。
   */
  const handleOpenOriginal = useCallback((url: string) => {
    if (!url) return;
    if (url.startsWith("data:")) {
      toast.error("无法在新页面打开", "当前图为 Base64 编码,数据量较大。请改用 URL 输出格式重新生成。");
      return;
    }
    try {
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error("打开新标签页失败", (err as Error).message);
    }
  }, []);

  /**
   * 单图容器内联样式（按候选图自身的 ratio）。
   * - aspectRatio 锁死「生图时提交的比例」；
   * - maxHeight / maxWidth 限制在父容器内（不会顶天立地，也不会超出可视区）；
   * - 不显式设 width/height，让浏览器按"容器内能放下的最大尺寸 + aspectRatio"自动计算；
   *   再加上父容器的 items-center + justify-center，图片被锁在中间可视区中央。
   * 每张候选图独立计算——切换 ratio 设置不会影响已生成图的预览比例。
   */
  const renderSingleItemStyle = (r: ImageRatio): CSSProperties => ({
    aspectRatio: ratioToAspectRatio(r),
    maxHeight: "100%",
    maxWidth: "100%",
    width: "auto",
    height: "auto",
  });

  /** 多图容器内联样式：宽度由网格决定，比例由每张候选图自己的 ratio 决定。 */
  const renderGridItemStyle = (r: ImageRatio): CSSProperties => ({
    aspectRatio: ratioToAspectRatio(r),
    width: "100%",
  });

  const fullTitle = `编辑角色 - ${character.name}（${scriptInfo?.name || character.name}）`;

  return (
    <div className="fixed inset-0 z-[100] bg-[#0a0a0a] flex flex-col">
      {/* 顶栏：极简，仅保留角色名 + 关闭 + 重置（D1） */}
      <div className="border-b border-white/10 bg-[#1a1a1a] px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Wand2 className="h-5 w-5 text-emerald-400 flex-shrink-0" />
          <h1
            className="text-lg font-semibold text-white truncate"
            title={fullTitle}
          >
            {character.name}
          </h1>
          {character.role && (
            <span className="hidden sm:inline-flex items-center rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-gray-300 flex-shrink-0">
              {({ protagonist: "主角", supporting: "配角", antagonist: "反派", minor: "次要" } as Record<string, string>)[character.role] || character.role}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetParams}
            className="gap-1 border-white/15 text-gray-300 hover:text-white"
            title="重置所有图片参数到默认值"
          >
            <RotateCcw className="h-4 w-4" />
            重置
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose} className="gap-1">
            <X className="h-4 w-4" />
            关闭
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* 左侧参数栏：宽度 360px（A3/B3） */}
        <div className="w-[360px] flex-shrink-0 border-r border-white/10 bg-[#1a1a1a] p-4 overflow-y-auto">
          {scriptInfo && (
            <div className="mb-4 p-3 rounded-lg bg-white/5 border border-white/10">
              <div className="text-xs text-gray-400 mb-2">剧本中心导入信息</div>
              <div className="space-y-1 text-sm">
                {scriptInfo.name && (
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-400 flex-shrink-0">角色名</span>
                    <span className="text-white truncate" title={scriptInfo.name}>{scriptInfo.name}</span>
                  </div>
                )}
                {scriptInfo.role && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">类型</span>
                    <span className="text-white">
                      {{ protagonist: "主角", supporting: "配角", antagonist: "反派", minor: "次要" }[scriptInfo.role] || scriptInfo.role}
                    </span>
                  </div>
                )}
                {scriptInfo.gender && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">性别</span>
                    <span className="text-white">
                      {{ male: "男", female: "女", other: "其他" }[scriptInfo.gender] || scriptInfo.gender}
                    </span>
                  </div>
                )}
                {scriptInfo.age && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">年龄</span>
                    <span className="text-white">{scriptInfo.age}岁</span>
                  </div>
                )}
                {scriptInfo.description && (
                  <div className="mt-2">
                    <span className="text-gray-400">描述</span>
                    <div className="text-white text-xs mt-1 line-clamp-2" title={scriptInfo.description}>{scriptInfo.description}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="space-y-5">
            {/* ===== 分组 1：提示词 ===== */}
            <section>
              <label className="mb-1.5 flex items-center justify-between text-sm font-medium text-gray-200">
                <span className="flex items-center gap-2">
                  <span>
                    提示词 <span className="text-red-400">*</span>
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleEnhancePrompt}
                    disabled={!prompt.trim() || isEnhancing}
                    title="按 [主体]+[动作]+[环境]+[风格]+[构图]+[质量要求] 结构强化当前提示词"
                    className="h-6 px-2 text-[11px] border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10 hover:text-emerald-200 hover:border-emerald-400/60 disabled:border-white/10 disabled:text-gray-500 disabled:bg-transparent"
                  >
                    {isEnhancing ? (
                      <>
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        强化中…
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-1 h-3 w-3" />
                        强化提示词
                      </>
                    )}
                  </Button>
                </span>
                <span className="text-[11px] text-gray-400">{prompt.length} 字符</span>
              </label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={isImg2Img
                  ? "图生图：请描述你希望调整的内容，如：把服装换成黑色斗篷，雨夜氛围"
                  : "请输入角色描述，如：古风少年剑客，黑发高马尾，身披白袍…"}
                rows={10}
                className="bg-[#252525] border-white/10 text-sm"
                title={prompt}
              />
            </section>

            {/* ===== 分组 2：基础参数（模型 / 比例 / 数量） ===== */}
            <section className="space-y-3">
              {/* 模型：保留 <select> 以备未来扩展，1 个选项时降级为静态文本（评审 D2 方案） */}
              <div>
                <label className="mb-1.5 flex items-center justify-between text-sm font-medium text-gray-200">
                  <span className="flex items-center gap-1.5">
                    模型
                    {/* 模型说明挪到 tooltip：右侧 Info 图标 hover 查看（评审方案） */}
                    <span
                      className="cursor-help text-gray-500 hover:text-gray-300"
                      title={MODEL_OPTIONS[0].description}
                      aria-label="模型说明"
                    >
                      <Info className="h-3.5 w-3.5" />
                    </span>
                  </span>
                  {MODEL_OPTIONS.length > 1 && (
                    <span
                      className="cursor-help text-[10px] text-emerald-400"
                      title="已开放多模型切换"
                    >
                      可选 {MODEL_OPTIONS.length}
                    </span>
                  )}
                </label>
                {MODEL_OPTIONS.length === 1 ? (
                  // 1 个选项：渲染为静态文本，减少一次点击；同时为未来多模型预留 select 模板
                  <div
                    className="h-10 w-full rounded-md border border-white/10 bg-[#252525] px-3 py-2 text-sm text-white flex items-center"
                    title={MODEL_OPTIONS[0].description}
                  >
                    {MODEL_OPTIONS[0].label}（已固定）
                  </div>
                ) : (
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value as ImageModel)}
                    className="h-10 w-full rounded-md border border-white/10 bg-[#252525] px-3 text-sm outline-none focus:border-emerald-500 text-white"
                  >
                    {MODEL_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* 比例：下拉框 + 比例条 mini icon（评审优化：节省纵向空间，保留形状直觉） */}
              <div>
                <label className="mb-1.5 flex items-center justify-between text-sm font-medium text-gray-200">
                  <span>比例</span>
                  <span className="text-[10px] text-gray-400" title="选择比例后会自动推荐对应的输出尺寸">
                    {imageSizeOptions.find((o) => o.value === size)?.label}
                  </span>
                </label>
                <AspectRatioSelect
                  value={ratio}
                  options={aspectRatioOptions}
                  onChange={handleRatioChange}
                />
              </div>

              {/* 输出格式/生成数量：已下移到「高级选项」折叠区（评审优化：普通用户用默认即可） */}

            </section>

            {/* ===== 分组 3：高级选项（默认折叠） ===== */}
            <section className="rounded-lg border border-white/10 bg-[#1f1f1f]">
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="flex w-full items-center justify-between px-3 py-2 text-left"
              >
                <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  {showAdvanced ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  高级选项
                  <span
                    className="ml-1 cursor-help text-gray-500 hover:text-gray-300 normal-case tracking-normal"
                    title="风格修饰仅作用于文生图（图生图时忽略，避免覆盖参考图特征）。反向提示词用于排除你不想要的视觉元素。随机种子留空则由模型自动选择，固定种子可复现相同结果。"
                  >
                    <Info className="h-3 w-3" />
                  </span>
                </span>
                <span className="text-[10px] text-gray-500">
                  {style || negativePrompt || seed || responseFormat !== DEFAULT_FORMAT || count !== String(DEFAULT_COUNT) ? "已配置" : "可选"}
                </span>
              </button>
              {showAdvanced && (
                <div className="space-y-3 border-t border-white/10 p-3">
                  {/* 生成数量：默认 1 张;多张会触发 N 次并行 API 调用,耗时约 30s/批 */}
                  <div>
                    <label className="mb-1.5 flex items-center justify-between text-sm font-medium text-gray-200">
                      <span className="flex items-center gap-1.5">
                        生成数量
                        <span
                          className="cursor-help text-gray-500 hover:text-gray-300"
                          title="Agnes 一次接口只返回 1 张图；选择多张时会由后端并发 N 次调用。耗时约 30s/批（4 张 ≈ 30s）"
                        >
                          <Info className="h-3.5 w-3.5" />
                        </span>
                      </span>
                      <span className="text-[10px] text-emerald-400">将生成 {n} 张候选</span>
                    </label>
                    <select
                      value={count}
                      onChange={(e) => setCount(e.target.value)}
                      className="h-10 w-full rounded-md border border-white/10 bg-[#252525] px-3 text-sm outline-none focus:border-emerald-500 text-white"
                    >
                      {COUNT_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* 输出格式：从基础参数下移（评审优化：普通用户用不到） */}
                  <div>
                    <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-gray-200">
                      <span>输出格式</span>
                      <span
                        className="cursor-help text-gray-500 hover:text-gray-300"
                        title={RESPONSE_FORMAT_OPTIONS.find((o) => o.value === responseFormat)?.description}
                      >
                        <Info className="h-3.5 w-3.5" />
                      </span>
                    </label>
                    <select
                      value={responseFormat}
                      onChange={(e) => setResponseFormat(e.target.value as ImageResponseFormat)}
                      className="h-10 w-full rounded-md border border-white/10 bg-[#252525] px-3 text-sm outline-none focus:border-emerald-500 text-white"
                    >
                      {RESPONSE_FORMAT_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* 风格修饰：12 个带 emoji 的 chip（用户截图样式） */}
                  <div>
                    <label className="mb-1.5 flex items-center justify-between text-sm font-medium text-gray-200">
                      <span>风格修饰</span>
                      <span className="text-[10px] text-gray-400">
                        {findStyleOption(style)?.label || "默认"}
                      </span>
                    </label>
                    <StylePicker
                      value={style}
                      options={styleOptions}
                      onChange={setStyle}
                    />
                    <p className="mt-1.5 text-[11px] text-gray-500">
                      仅文生图追加（图生图忽略以保留原图特征）。
                    </p>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-200">反向提示词</label>
                    <Input
                      value={negativePrompt}
                      onChange={(e) => setNegativePrompt(e.target.value)}
                      placeholder="避免模糊、畸形、错误结构、水印"
                      className="bg-[#252525] border-white/10 text-sm"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-200">随机种子（可选）</label>
                    <Input
                      value={seed}
                      onChange={(e) => setSeed(e.target.value.replace(/[^\d-]/g, ""))}
                      placeholder="留空则随机"
                      inputMode="numeric"
                      className="bg-[#252525] border-white/10 text-sm"
                    />
                  </div>
                </div>
              )}
            </section>

            {/* ===== 分组 4：参考图（图生图） ===== */}
            <section>
              <label className="mb-1.5 flex items-center justify-between text-sm font-medium text-gray-200">
                <span className="flex items-center gap-1.5">
                  参考图（图生图）
                  <span
                    className="inline-grid h-3.5 w-3.5 cursor-help place-items-center rounded-full border border-white/20 text-[10px] leading-none text-gray-400 hover:border-emerald-400/60 hover:text-emerald-300"
                    title="仅支持 PNG / JPG / WEBP 格式，单张 ≤ 200MB，最多 4 张。 上传后以 extra_body.image 数组传入 Agnes 触发图生图。"
                    aria-label="参考图上传说明"
                  >
                    ?
                  </span>
                </span>
                {/* 计数联动：上传/删除都会实时更新 + 数字变化时高亮闪烁 */}
                <span
                  className={[
                    "text-[10px] tabular-nums transition-colors",
                    referenceImages.length >= MAX_REFERENCE_IMAGES
                      ? "text-amber-400"
                      : "text-gray-400",
                  ].join(" ")}
                  aria-live="polite"
                >
                  <CountHighlight value={referenceImages.length} max={MAX_REFERENCE_IMAGES} />
                </span>
              </label>
              <input
                ref={fileInputRef}
                type="file"
                // MIME 白名单：仅 PNG / JPG / WEBP。GIF/BMP/SVG 浏览器/AI 模型支持差直接禁掉。
                // 浏览器拿到 accept 会过滤文件选择器，缩小可选范围。
                accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
                multiple
                className="hidden"
                onChange={(e) => handleUploadReference(e.target.files)}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingRef || referenceImages.length >= MAX_REFERENCE_IMAGES}
                title={
                  referenceImages.length >= MAX_REFERENCE_IMAGES
                    ? `最多 ${MAX_REFERENCE_IMAGES} 张参考图（文档限制）`
                    : `上传 PNG / JPG / WEBP 格式（单张 ≤ ${MAX_REFERENCE_IMAGE_MB}MB）触发图生图`
                }
              >
                {uploadingRef ? (
                  <>
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    上传中…
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-3 w-3" />
                    {referenceImages.length === 0 ? "上传参考图（开启图生图）" : "继续添加"}
                  </>
                )}
              </Button>
              {/* 缩略图列表：上传后立即出现，删除有动画 */}
              <div className="mt-2 min-h-[1px]">
                {referenceImages.length > 0 && (
                  <div className="grid grid-cols-4 gap-1.5">
                    {referenceImages.map((url) => (
                      <div
                        key={url}
                        className="group relative aspect-square overflow-hidden rounded-md border border-white/10 bg-[#1a1a1a] animate-in fade-in zoom-in-95 duration-200"
                      >
                        <ThumbnailImage url={url} alt="参考图" />
                        <button
                          type="button"
                          onClick={() => handleRemoveReference(url)}
                          className="absolute right-0.5 top-0.5 grid h-4 w-4 place-items-center rounded-full bg-black/70 text-white/80 opacity-0 transition group-hover:opacity-100 hover:bg-red-500/80"
                          aria-label="移除参考图"
                          title="移除该参考图"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {referenceImages.length > 0 && (
                <button
                  type="button"
                  onClick={() => setReferenceImages([])}
                  className="mt-1.5 text-[10px] text-gray-500 hover:text-red-400 transition-colors"
                >
                  清空所有参考图
                </button>
              )}
            </section>

            <Button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim()}
              className="w-full bg-emerald-500 hover:bg-emerald-600"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  生成中…
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  {isImg2Img ? "图生图生成" : "生成图片"}
                </>
              )}
            </Button>

            {/* 重新生成同款参数（E3） */}
            {candidates.length > 0 && !isGenerating && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRegenerateSame}
                className="w-full border-white/10 text-gray-300 hover:text-white gap-1.5"
                title="使用当前所有参数（提示词/模型/尺寸/参考图等）重新生成"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                重新生成同款参数
              </Button>
            )}
          </div>
        </div>

        {/* 中间预览区（D3：n 自适应） */}
        <div className="flex-1 p-4 flex flex-col min-h-0">
          {isGenerating ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-gray-400 border border-dashed border-white/10 rounded-lg">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
              <div className="text-sm">AI 正在生成 {n} 张图片，请稍候…</div>
              <div className="text-[11px] text-gray-500">预计耗时 {estimatedSeconds}s（最多 2min）</div>
              {/* 终止按钮：长任务必备，避免用户等得不耐烦又无法中断 */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCancel}
                className="mt-2 border-white/15 text-gray-300 hover:text-white hover:border-red-500/60 hover:text-red-300 gap-1.5"
                title="中止当前生成任务（参数会保留，可修改后重新发起）"
              >
                <X className="h-3.5 w-3.5" />
                终止生成
              </Button>
            </div>
          ) : candidates.length > 0 ? (
            <div
              className={
                // n 决定布局，但 n 是当前表单的"想要几张"，与 candidates 实际张数可能不一致
                // （如历史里点「使用」只会放进 1 张）。所以这里按 candidates 实际数量判断。
                candidates.length === 1
                  ? "flex-1 flex items-center justify-center min-h-0 overflow-hidden"
                  : "flex-1 grid grid-cols-2 gap-4 max-w-4xl w-full mx-auto content-start overflow-auto"
              }
            >
              {candidates.map((item, idx) => {
                const url = item.url;
                const itemRatio = item.ratio;
                const selected = selectedIndex === idx;
                const isApplied = selectedAsset === url; // D2：已应用状态
                return (
                  <div
                    key={`${url}-${idx}`}
                    style={
                      candidates.length === 1
                        ? renderSingleItemStyle(itemRatio)
                        : renderGridItemStyle(itemRatio)
                    }
                    // role + tabIndex + onClick：让"点击图片"本身就能在新标签页打开原图，
                    // 不再依赖 hover 才出现的"查看原图"按钮（用户截图反馈：点图无反应）。
                    // 子按钮（查看原图/设为角色资产）已 stopPropagation，不会冒泡到这里。
                    // "已应用"徽标是纯展示 div，不拦截。
                    role="button"
                    tabIndex={0}
                    onClick={() => handleOpenOriginal(url)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleOpenOriginal(url);
                      }
                    }}
                    // group + cursor-zoom-in:鼠标悬停时显示遮罩+查看原图按钮;
                    // 与现有 group hover(右上角删除按钮)互不影响,本 group 只覆盖中间预览区
                    className={`group relative overflow-hidden rounded-lg border-2 transition-all cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 ${isApplied
                      ? "border-emerald-500/70 ring-2 ring-emerald-500/30"
                      : selected
                        ? "border-emerald-400 ring-2 ring-emerald-400/40"
                        : "border-white/10 hover:border-white/30"
                      } ${candidates.length === 1 ? "" : "w-full"}`}
                    title="点击图片在新标签页查看原图"
                  >
                    <img
                      src={url}
                      alt={`候选图 ${idx + 1}`}
                      // max-h-full / max-w-full：图片以"在容器内能放下的最大尺寸"渲染，
                      // 配合父容器的 aspectRatio 锁比例；object-contain 保证原图比例不一致
                      // 时只留黑边不裁切。整体效果：图片严格在可视区内、按生成比例垂直居中。
                      className="max-h-full max-w-full object-contain bg-[#1a1a1a]"
                    />
                    {/* hover 遮罩 + 查看原图按钮：默认透明,鼠标悬停时显示半透明黑色蒙层 + 右下角按钮。
                        onClick 调用 handleOpenOriginal,新浏览器 tab 打开原图 URL。
                        按钮在右下,不和右上角"已应用"/"选中"按钮冲突;选中态/已应用态下也都能用。 */}
                    <div
                      className="pointer-events-none absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/40"
                      aria-hidden="true"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation(); // 阻止冒泡,不影响外层选中/已应用等交互
                        handleOpenOriginal(url);
                      }}
                      className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md bg-black/75 px-2.5 py-1.5 text-[11px] font-medium text-white opacity-0 shadow-lg backdrop-blur transition-all group-hover:opacity-100 hover:bg-emerald-500/90 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                      title="在新浏览器标签页打开原图（URL 模式下可用）"
                      aria-label={`查看候选图 ${idx + 1} 原图`}
                    >
                      <Maximize2 className="h-3 w-3" />
                      查看原图
                    </button>
                    {/* 未选/已选/已应用 状态切换（E1/D2） */}
                    {isApplied ? (
                      <div
                        className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/95 px-2.5 py-1 text-[10px] font-medium text-white shadow"
                        title="该图已设置为当前角色资产"
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        已应用
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation(); // 阻止冒泡,避免触发表层的"打开原图"路径
                          setSelectedIndex(selected ? null : idx);
                        }}
                        className={`absolute top-2 right-2 h-7 w-7 rounded-full flex items-center justify-center transition-all ${selected
                          ? "bg-emerald-500 text-white"
                          : "bg-black/60 text-white/70 hover:bg-black/80 border border-white/20"
                          }`}
                        title={selected ? "取消选中" : "选中此图"}
                      >
                        {selected ? <Check className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                      </button>
                    )}
                    {selected && !isApplied && (
                      <div className="absolute bottom-2 left-2 right-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            // 传入选中图的 ratio：handleSelectAsAsset 会把它一起记到
                            // 「已选资产历史」里，下次预览能精确还原。
                            handleSelectAsAsset(url, itemRatio);
                          }}
                          disabled={isSaving}
                          className="w-full bg-emerald-500 hover:bg-emerald-600"
                        >
                          {isSaving ? (
                            <>
                              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                              保存中…
                            </>
                          ) : (
                            <>设为角色资产</>
                          )}
                        </Button>
                      </div>
                    )}
                    <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/60 text-[10px] text-white/90 inline-flex items-center gap-1">
                      <span>#{idx + 1}</span>
                      <span className="text-gray-400">·</span>
                      <span className="text-emerald-300" title="按生图时提交的比例显示">{itemRatio}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500 border border-dashed border-white/10 rounded-lg">
              <ImageIcon className="h-12 w-12 mb-3 opacity-50" />
              <span className="text-sm">填写提示词后点击「{isImg2Img ? "图生图生成" : "生成图片"}」</span>
              {isImg2Img && (
                <span className="mt-2 text-xs text-amber-300/80">已加载 {referenceImages.length} 张参考图，将作为图生图输入</span>
              )}
            </div>
          )}
        </div>

        {/* 右侧栏：已选角色资产 + 历史图片 */}
        <div className="w-72 flex-shrink-0 border-l border-white/10 bg-[#1a1a1a] p-4 overflow-y-auto">
          {/* 已选角色资产：从底部 footer 提升到右侧栏顶部（C2） */}
          {selectedAsset && (
            <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-emerald-300">
                <User className="h-3.5 w-3.5" />
                已选角色资产
              </div>
              <div
                role="button"
                tabIndex={0}
                onClick={() => handlePreviewAsset(selectedAsset)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handlePreviewAsset(selectedAsset);
                  }
                }}
                className="flex cursor-pointer items-center gap-2 rounded-md p-1 -m-1 outline-none transition-colors hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-emerald-500/40"
                title="点击在中间预览区查看"
              >
                <img
                  src={selectedAsset}
                  alt="角色资产"
                  className="h-16 w-16 flex-shrink-0 rounded-md object-cover border border-white/10"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-white" title={character.name}>{character.name}</p>
                  <p className="text-[10px] text-gray-400">已应用到角色 · 点击预览</p>
                </div>
                {/* 在新 tab 打开原图:不影响"点击卡片预览"的主交互 */}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenOriginal(selectedAsset);
                  }}
                  disabled={isSaving}
                  className="h-7 px-2 text-gray-400 hover:text-emerald-300"
                  title="在新标签页打开原图"
                  aria-label="在新标签页打开原图"
                >
                  <ExternalLink className="h-3 w-3" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation(); // 阻止冒泡触发预览
                    handleRemoveAsset();
                  }}
                  disabled={isSaving}
                  className="h-7 px-2 text-red-400 hover:text-red-300"
                  title="移除角色图片"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}

          {/* 已选资产历史：保留所有曾经设为角色资产的图（即使被新图覆盖也能找回/删除）。 */}
          {assetHistory.length > 0 && (
            <div className="mb-4">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-medium text-white inline-flex items-center gap-1.5">
                  <HistoryIcon className="h-3.5 w-3.5 text-emerald-300" />
                  已选资产历史
                </h2>
                <span className="text-[10px] text-gray-500">{assetHistory.length}/{MAX_ASSET_HISTORY}</span>
              </div>
              <p className="mb-2 text-[10px] text-gray-500 leading-relaxed">
                每次「设为角色资产」都会自动保留一份（含比例），被新图覆盖也不会丢失，可一键还原或删除。
              </p>
              <div className="grid grid-cols-3 gap-2">
                {assetHistory.map((item) => {
                  const isCurrent = selectedAsset === item.url;
                  return (
                    <div
                      key={item.id}
                      className={`group relative overflow-hidden rounded-md border transition-colors ${isCurrent
                        ? "border-emerald-500/60 ring-1 ring-emerald-500/30"
                        : "border-white/10 hover:border-emerald-500/50"
                        }`}
                      title={`${item.ratio} · ${item.size} · ${item.timestamp}`}
                    >
                      <div className="aspect-square w-full bg-[#0f0f0f]">
                        <img
                          src={item.url}
                          alt="历史资产"
                          className="h-full w-full object-cover cursor-pointer"
                          // 单击：在中间区预览这张历史资产（不修改表单参数）
                          onClick={() => handlePreviewAssetHistory(item)}
                        />
                        {/* 当前正在用：左上角徽标 */}
                        {isCurrent && (
                          <div className="absolute top-1 left-1 inline-flex items-center gap-0.5 rounded-full bg-emerald-500/95 px-1.5 py-0.5 text-[9px] font-medium text-white">
                            <CheckCircle2 className="h-2.5 w-2.5" />
                            当前
                          </div>
                        )}
                        {/* ratio 角标：右上角常驻，告诉用户这张图实际是按什么比例存的 */}
                        <div className="absolute top-1 right-1 rounded bg-black/70 px-1 py-0.5 text-[9px] text-emerald-300">
                          {item.ratio}
                        </div>
                      </div>
                      {/* 底部操作：还原 / 删除（hover 才出现，避免误点） */}
                      <div className="flex border-t border-white/10 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => handleReapplyAssetFromHistory(item)}
                          disabled={isSaving || isCurrent}
                          className="flex-1 px-1 py-1 text-[10px] text-emerald-300 hover:bg-emerald-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          title={isCurrent ? "已是当前角色资产" : "重新应用为当前角色资产"}
                        >
                          {isCurrent ? "已应用" : "应用"}
                        </button>
                        <span className="w-px bg-white/10" />
                        <button
                          type="button"
                          onClick={() => handleDeleteAssetHistory(item.id)}
                          className="flex-1 px-1 py-1 text-[10px] text-gray-400 hover:bg-red-500/20 hover:text-red-300 transition-colors"
                          title="从历史中删除（不会影响当前角色资产）"
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-white">历史图片</h2>
            <span className="text-[10px] text-gray-500">{history.length}/{MAX_HISTORY}</span>
          </div>

          {history.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">暂无历史记录</div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {history.map((item) => (
                <div
                  key={item.id}
                  className={`group relative overflow-hidden rounded-md border transition-colors ${item.isApplied
                    ? "border-emerald-500/50"
                    : "border-white/10 hover:border-emerald-500/50"
                    }`}
                >
                  <div className="aspect-square w-full bg-[#0f0f0f]">
                    <img
                      src={item.url}
                      alt={item.prompt}
                      className="h-full w-full object-cover cursor-zoom-in"
                      title={item.prompt}
                      // 单击历史图直接在新 tab 打开原图（和中间预览区逻辑一致,用户最直观的预期）
                      onClick={() => handleOpenOriginal(item.url)}
                    />
                    {/* hover 时右上角的"新 tab 打开"提示,点击行为同上(img 已绑定 onClick) */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenOriginal(item.url);
                      }}
                      className="absolute top-1 right-1 grid h-5 w-5 place-items-center rounded bg-black/70 text-white/80 opacity-0 transition group-hover:opacity-100 hover:bg-emerald-500/80"
                      title="在新标签页打开原图"
                      aria-label="在新标签页打开原图"
                    >
                      <ExternalLink className="h-2.5 w-2.5" />
                    </button>
                  </div>
                  {/* 元信息常驻显示（C1/F1） */}
                  <div className="px-1.5 py-1 text-[10px] leading-tight text-gray-400">
                    <div className="truncate" title={`模型：${item.model} · 尺寸：${item.size}`}>
                      <span className="text-emerald-300">{item.model.replace("agnes-image-", "")}</span>
                      <span className="mx-1 text-gray-600">·</span>
                      <span>{item.size}</span>
                    </div>
                    <div className="truncate text-gray-500" title={`${item.responseFormat} · ${item.n}张 · ${item.timestamp}`}>
                      {item.responseFormat} · {item.n}张 · {item.timestamp.split(" ")[1] || item.timestamp}
                    </div>
                  </div>
                  {item.isApplied && (
                    <div className="absolute top-1 left-1 inline-flex items-center gap-0.5 rounded-full bg-emerald-500/95 px-1.5 py-0.5 text-[9px] font-medium text-white">
                      <CheckCircle2 className="h-2.5 w-2.5" />
                      已应用
                    </div>
                  )}
                  {/* 删除/使用 常驻底部（hover 不再依赖） */}
                  <div className="flex border-t border-white/10 bg-black/40">
                    <button
                      type="button"
                      onClick={() => handleUseFromHistory(item)}
                      className="flex-1 px-2 py-1 text-[10px] text-emerald-300 hover:bg-emerald-500/20 transition-colors"
                      title="将此参数与提示词重新加载到面板"
                    >
                      使用
                    </button>
                    <span className="w-px bg-white/10" />
                    <button
                      type="button"
                      onClick={() => handleDeleteFromHistory(item.id)}
                      className="flex-1 px-2 py-1 text-[10px] text-gray-400 hover:bg-red-500/20 hover:text-red-300 transition-colors"
                      title="从历史中删除（不会影响已应用的角色资产）"
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 重置确认弹窗（D4） */}
      {confirmReset && (
        <ConfirmDialog
          title="重置图片参数？"
          description="将清空模型、尺寸、输出格式、生成数量、风格修饰、反向提示词、随机种子、参考图等所有参数，恢复为默认值。此操作不会影响已生成的历史图片和已应用的角色资产。"
          confirmLabel="确认重置"
          onClose={() => setConfirmReset(false)}
          onConfirm={doResetParams}
        />
      )}
    </div>
  );
}
