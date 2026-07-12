"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { api, uploadImages } from "@/lib/api-client";
import { toast } from "@/components/common/toast";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import type { Character, ImageModel, ImageResponseFormat, ImageSize, StyleValue } from "@/lib/module-types";
import { updateCharacter } from "@/services/character.service";
import {
  aspectRatioOptions,
  defaultSizeFromRatio,
  findStyleOption,
  imageSizeOptions,
  styleOptions,
} from "@/lib/project-workflow";
import { AspectRatioPicker } from "@/components/modules/image-picker-aspect-ratio";
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
  responseFormat: ImageResponseFormat;
  n: number;
  /** 是否已设置为当前角色资产（F2）。 */
  applied?: boolean;
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
const DEFAULT_COUNT = 4;
const MAX_REFERENCE_IMAGES = 4;
const MAX_HISTORY = 20;
const SECONDS_PER_IMAGE = 30;

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

/** sessionStorage key（前缀 + character.id），用于 history 持久化（G3）。 */
const historyStorageKey = (characterId: string) => `img-gen-history:${characterId}`;

export function CharacterImageGenerator({ character, scriptInfo, onClose, onApplied }: CharacterImageGeneratorProps) {
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState<StyleValue>(DEFAULT_STYLE);
  const [count, setCount] = useState(String(DEFAULT_COUNT));

  // 与文档/images.txt 对齐的完整图片参数
  const [model, setModel] = useState<ImageModel>(DEFAULT_MODEL);
  const [size, setSize] = useState<ImageSize>(DEFAULT_SIZE);
  const [responseFormat, setResponseFormat] = useState<ImageResponseFormat>(DEFAULT_FORMAT);
  const [negativePrompt, setNegativePrompt] = useState("");
  const [seed, setSeed] = useState("");

  // 图生图：参考图（多张）
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [uploadingRef, setUploadingRef] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 高级选项折叠状态（默认折叠）
  const [showAdvanced, setShowAdvanced] = useState(false);
  // 重置确认弹窗（D4）
  const [confirmReset, setConfirmReset] = useState(false);

  const [isGenerating, setIsGenerating] = useState(false);
  const [candidates, setCandidates] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [history, setHistory] = useState<HistoryImage[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<string | null>(character.image || null);
  const [isSaving, setIsSaving] = useState(false);

  const isImg2Img = referenceImages.length > 0;
  const n = useMemo(() => Math.max(1, Math.min(4, Number(count) || DEFAULT_COUNT)), [count]);
  // 预计耗时（F3）：每张 ~30s，最长 2min
  const estimatedSeconds = useMemo(() => Math.min(120, n * SECONDS_PER_IMAGE), [n]);

  // ============ 初始化：从 sessionStorage 恢复历史（G3） ============
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.sessionStorage.getItem(historyStorageKey(character.id));
      if (raw) {
        const parsed = JSON.parse(raw) as HistoryImage[];
        if (Array.isArray(parsed)) {
          setHistory(parsed.slice(0, MAX_HISTORY));
        }
      }
    } catch {
      // 静默忽略解析失败
    }
  }, [character.id]);

  // 持久化 history 到 sessionStorage（G3）
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(historyStorageKey(character.id), JSON.stringify(history));
    } catch {
      // 静默忽略 quota
    }
  }, [history, character.id]);

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

  /** 上传参考图：调用 /api/uploads，拿到 URL 后塞入 referenceImages 触发图生图。 */
  const handleUploadReference = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadingRef(true);
    try {
      const fileArray = Array.from(files);
      const uploaded = await uploadImages(fileArray);
      const urls = uploaded.map((item) => item.url).filter(Boolean);
      if (urls.length === 0) throw new Error("上传失败：未返回 URL");
      setReferenceImages((prev) => [...prev, ...urls].slice(0, MAX_REFERENCE_IMAGES));
      toast.success(`已添加 ${urls.length} 张参考图`, "已自动切换为图生图模式");
    } catch (err) {
      toast.error("参考图上传失败", (err as Error).message);
    } finally {
      setUploadingRef(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, []);

  const handleRemoveReference = (url: string) => {
    setReferenceImages((prev) => prev.filter((u) => u !== url));
  };

  /** 一键重置所有图片参数（D4：带确认弹窗）。 */
  const doResetParams = () => {
    setModel(DEFAULT_MODEL);
    setSize(DEFAULT_SIZE);
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

  const handleGenerate = async () => {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      toast.error("请输入描述");
      return;
    }
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
      setCandidates(urls);
      const newHistory: HistoryImage[] = urls.map((url) => ({
        id: crypto.randomUUID(),
        url,
        prompt: finalPrompt,
        timestamp: new Date().toLocaleString(),
        model,
        size,
        responseFormat,
        n: urls.length,
      }));
      setHistory((prev) => [...newHistory, ...prev].slice(0, MAX_HISTORY));
      setSelectedIndex(0);
    } catch (err) {
      console.error("AI 生成图片失败:", err);
      // fallback 用本地 SVG 避免中文乱码（H1）
      const fallback = Array.from({ length: n }, () => FALLBACK_PLACEHOLDER);
      setCandidates(fallback);
      setSelectedIndex(0);
      toast.error("AI 生成失败", "已使用占位图，你可以重新尝试");
    } finally {
      setIsGenerating(false);
    }
  };

  /** 重新生成同款参数（E3）。 */
  const handleRegenerateSame = useCallback(() => {
    if (!prompt.trim()) {
      toast.error("暂无参数可复用", "请先填写提示词");
      return;
    }
    handleGenerate();
  }, [prompt, handleGenerate]);

  /** 设为角色资产：成功后从候选区移除（F2），toast 带下一步行动（G1）。 */
  const handleSelectAsAsset = async (url: string) => {
    if (selectedAsset === url) {
      toast.success("该图已是当前角色资产", undefined, 1500);
      return;
    }
    setIsSaving(true);
    try {
      await updateCharacter(character.id, { image: url });
      setSelectedAsset(url);
      // 标记历史项已应用（F2）
      setHistory((prev) => prev.map((h) => (h.url === url ? { ...h, applied: true } : h)));
      // 取消该候选的选中态
      setSelectedIndex(null);
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
      // 取消所有候选/历史的 applied 标记
      setHistory((prev) => prev.map((h) => ({ ...h, applied: false })));
      toast.success("角色图片已移除");
    } catch (err) {
      toast.error("移除失败", (err as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteFromHistory = (id: string) => {
    setHistory((prev) => prev.filter((h) => h.id !== id));
  };

  const handleUseFromHistory = (item: HistoryImage) => {
    setCandidates([item.url]);
    setSelectedIndex(0);
    setPrompt(item.prompt);
    setModel(item.model);
    setSize(item.size);
    setResponseFormat(item.responseFormat);
    setCount(String(item.n));
  };

  /** 计算候选图预览的网格布局（D3：n 自适应）。 */
  const candidateGridClass = useMemo(() => {
    if (n === 1) return "flex justify-center";
    if (n === 2) return "grid grid-cols-2 gap-4 max-w-3xl mx-auto";
    return "grid grid-cols-2 gap-4";
  }, [n]);

  const candidateItemClass = useMemo(() => {
    if (n === 1) return "w-full max-w-md aspect-square";
    if (n === 2) return "aspect-square";
    return "aspect-square";
  }, [n]);

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
          {/* 图生图徽标移到左侧栏标题旁（A3） */}
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-medium text-white flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-emerald-400" />
              图片参数
            </h2>
            {isImg2Img && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[11px] text-amber-200">
                <ImageIcon className="h-3 w-3" />
                图生图 · {referenceImages.length} 张
              </span>
            )}
          </div>

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
                <span>
                  提示词 <span className="text-red-400">*</span>
                </span>
                <span className="text-[11px] text-gray-400">{prompt.length} 字符</span>
              </label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={isImg2Img
                  ? "图生图：请描述你希望调整的内容，如：把服装换成黑色斗篷，雨夜氛围"
                  : "请输入角色描述，如：古风少年剑客，黑发高马尾，身披白袍…"}
                rows={5}
                className="bg-[#252525] border-white/10 text-sm"
                title={prompt}
              />
              <p className="mt-1.5 text-[11px] text-gray-400 leading-relaxed">
                推荐结构：<span className="text-gray-300">[主体] + [动作] + [环境] + [风格] + [构图] + [质量要求]</span>
              </p>
            </section>

            {/* ===== 分组 2：基础参数（模型 / 尺寸 / 输出格式） ===== */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">基础参数</h3>
                <span className="text-[10px] text-gray-500">已设默认值</span>
              </div>

              {/* 模型：保留 <select> 以备未来扩展，1 个选项时降级为静态文本（评审 D2 方案） */}
              <div>
                <label className="mb-1.5 flex items-center justify-between text-sm font-medium text-gray-200">
                  <span>模型</span>
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
                <p className="mt-1 text-[11px] text-gray-400">{MODEL_OPTIONS[0].description}</p>
              </div>

              {/* 比例：6 个 chip，单选（用户截图样式） */}
              <div>
                <label className="mb-1.5 flex items-center justify-between text-sm font-medium text-gray-200">
                  <span>比例</span>
                  <span className="text-[10px] text-gray-400" title="选择比例后会自动推荐对应的输出尺寸">
                    {imageSizeOptions.find((o) => o.value === size)?.label}
                  </span>
                </label>
                <AspectRatioPicker
                  value={imageSizeOptions.find((o) => o.value === size)?.ratio ?? "1:1"}
                  options={aspectRatioOptions}
                  onChange={(ratio) => setSize(defaultSizeFromRatio(ratio))}
                />
              </div>

              {/* 输出格式：tooltip 替代描述文字（C3） */}
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

              {/* 数量：单列全宽，并显示「将生成 N 张」实时提示（A1） */}
              <div>
                <label className="mb-1.5 flex items-center justify-between text-sm font-medium text-gray-200">
                  <span>生成数量</span>
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
                  {style || negativePrompt || seed ? "已配置" : "可选"}
                </span>
              </button>
              {showAdvanced && (
                <div className="space-y-3 border-t border-white/10 p-3">
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
                <span>参考图（图生图）</span>
                <span className="text-[10px] text-gray-400">{referenceImages.length}/{MAX_REFERENCE_IMAGES}</span>
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
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
                    : "上传 1-4 张参考图触发图生图"
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
              {referenceImages.length > 0 && (
                <div className="mt-2 grid grid-cols-4 gap-1.5">
                  {referenceImages.map((url) => (
                    <div key={url} className="group relative aspect-square overflow-hidden rounded-md border border-white/10">
                      <img src={url} alt="参考图" className="h-full w-full object-cover" />
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
              <p className="mt-1.5 text-[11px] leading-relaxed text-gray-400">
                上传参考图后将以 <code className="text-emerald-300">extra_body.image</code> 数组传入 Agnes，触发图生图工作流（1-{MAX_REFERENCE_IMAGES} 张）。
              </p>
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
        <div className="flex-1 p-4 overflow-y-auto">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-medium text-white">生成预览</h2>
            {candidates.length > 0 && !isGenerating && (
              <span className="text-[10px] text-gray-500">点击缩略图选中，再点「设为角色资产」</span>
            )}
          </div>

          {isGenerating ? (
            <div className="flex flex-col items-center justify-center h-[600px] gap-3 text-gray-400 border border-dashed border-white/10 rounded-lg">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
              <div className="text-sm">AI 正在生成 {n} 张图片，请稍候…</div>
              <div className="text-[11px] text-gray-500">预计耗时 {estimatedSeconds}s（最多 2min）</div>
            </div>
          ) : candidates.length > 0 ? (
            <div className={candidateGridClass}>
              {candidates.map((url, idx) => {
                const selected = selectedIndex === idx;
                const isApplied = selectedAsset === url; // D2：已应用状态
                return (
                  <div
                    key={`${url}-${idx}`}
                    className={`${candidateItemClass} relative overflow-hidden rounded-lg border-2 transition-all ${
                      isApplied
                        ? "border-emerald-500/70 ring-2 ring-emerald-500/30"
                        : selected
                        ? "border-emerald-400 ring-2 ring-emerald-400/40"
                        : "border-white/10 hover:border-white/30"
                    }`}
                  >
                    <img
                      src={url}
                      alt={`候选图 ${idx + 1}`}
                      className="w-full h-full object-cover bg-[#1a1a1a]"
                    />
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
                        onClick={() => setSelectedIndex(selected ? null : idx)}
                        className={`absolute top-2 right-2 h-7 w-7 rounded-full flex items-center justify-center transition-all ${
                          selected
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
                          onClick={() => handleSelectAsAsset(url)}
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
                    <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/60 text-[10px] text-white/90">
                      #{idx + 1}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-[600px] text-gray-500 border border-dashed border-white/10 rounded-lg">
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
              <div className="flex items-center gap-2">
                <img
                  src={selectedAsset}
                  alt="角色资产"
                  className="h-16 w-16 flex-shrink-0 rounded-md object-cover border border-white/10"
                  title={selectedAsset}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-white" title={character.name}>{character.name}</p>
                  <p className="text-[10px] text-gray-400">已应用到角色</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={handleRemoveAsset}
                  disabled={isSaving}
                  className="h-7 px-2 text-red-400 hover:text-red-300"
                  title="移除角色图片"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
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
                  className={`group relative overflow-hidden rounded-md border transition-colors ${
                    item.applied
                      ? "border-emerald-500/50"
                      : "border-white/10 hover:border-emerald-500/50"
                  }`}
                >
                  <div className="aspect-square w-full bg-[#0f0f0f]">
                    <img
                      src={item.url}
                      alt={item.prompt}
                      className="h-full w-full object-cover"
                      title={item.prompt}
                    />
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
                  {item.applied && (
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
