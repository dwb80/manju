"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Wand2,
  X,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, uploadImages } from "@/lib/api-client";
import { toast } from "@/components/common/toast";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import type { Character, ImageModel, ImageRatio, ImageResponseFormat, ImageSize, StyleValue } from "@/lib/module-types";
import { updateCharacter } from "@/services/character.service";
import { createAsset } from "@/services/asset.service";
import {
  appendCharacterImageHistory,
  applyCharacterImageHistory,
  deleteCharacterImageHistory,
  listCharacterImageHistory,
} from "@/services/character-image-history.service";
import {
  defaultSizeFromRatio,
  findStyleOption,
  imageRatioFromSize,
} from "@/lib/project-workflow";
import {
  ImageTask,
  HistoryImage,
  CandidateImage,
  AssetHistoryItem,
  CharacterImageGeneratorProps,
  DEFAULT_SIZE,
  DEFAULT_MODEL,
  DEFAULT_FORMAT,
  DEFAULT_STYLE,
  DEFAULT_COUNT,
  MAX_REFERENCE_IMAGES,
  MAX_HISTORY,
  MAX_ASSET_HISTORY,
  SECONDS_PER_IMAGE,
  MAX_REFERENCE_IMAGE_SIZE,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_IMAGE_EXTS,
  FALLBACK_PLACEHOLDER,
  toHistoryItem,
  mergeHistoryItems,
} from "./types";
import { ThumbnailImage, CountHighlight } from "./utils";
import { ImageGeneratorParams } from "./ImageGeneratorParams";
import { ImageGeneratorPreview } from "./ImageGeneratorPreview";
import { ImageGeneratorSidebar } from "./ImageGeneratorSidebar";

export { ratioToAspectRatio, detectClosestRatio, detectRatioFromImageUrl } from "./types";
export type { CharacterImageGeneratorProps } from "./types";

export function CharacterImageGenerator({ character, scriptInfo, onClose, onApplied }: CharacterImageGeneratorProps) {
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState<StyleValue>(DEFAULT_STYLE);
  const [count, setCount] = useState(String(DEFAULT_COUNT));
  const [model, setModel] = useState<ImageModel>(DEFAULT_MODEL);
  const [size, setSize] = useState<ImageSize>(DEFAULT_SIZE);
  const [ratio, setRatio] = useState<ImageRatio>("1:1");
  const [responseFormat, setResponseFormat] = useState<ImageResponseFormat>(DEFAULT_FORMAT);
  const [negativePrompt, setNegativePrompt] = useState("");
  const [seed, setSeed] = useState("");
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [uploadingRef, setUploadingRef] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    console.info("[img-gen] referenceImages 状态变化", {
      count: referenceImages.length,
      urls: referenceImages,
    });
  }, [referenceImages]);

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [candidates, setCandidates] = useState<CandidateImage[]>(
    character.image ? [{ url: character.image, ratio: imageRatioFromSize(DEFAULT_SIZE) }] : []
  );
  const [selectedIndex, setSelectedIndex] = useState<number | null>(
    character.image ? 0 : null
  );
  const [historyRecords, setHistoryRecords] = useState<HistoryImage[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState<string | null>(character.image || null);
  const [isSaving, setIsSaving] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isCancelledRef = useRef(false);
  const retryCountRef = useRef(0);
  const latestCharacterIdRef = useRef(character.id);
  useEffect(() => { latestCharacterIdRef.current = character.id; }, [character.id]);

  const isImg2Img = referenceImages.length > 0;
  const n = useMemo(() => Math.max(1, Math.min(4, Number(count) || DEFAULT_COUNT)), [count]);
  const estimatedSeconds = useMemo(() => Math.min(120, n * SECONDS_PER_IMAGE), [n]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

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
        setHistoryRecords([]);
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    return () => { cancelled = true; };
  }, [character.id]);

  const assetHistory = useMemo(
    () => historyRecords.filter((h) => h.isApplied),
    [historyRecords]
  );
  const history = historyRecords;

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

      let record: import("@/lib/module-types").CharacterImageHistory | null = null;
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
    [character.id, character.project_id, historyRecords, model, negativePrompt, prompt, ratio, responseFormat, size]
  );

  useEffect(() => {
    if (scriptInfo) {
      const parts: string[] = [];
      if (scriptInfo.name) parts.push(scriptInfo.name);
      if (scriptInfo.role) {
        const roleMap: Record<string, string> = {
          protagonist: "主角", supporting: "配角", antagonist: "反派", minor: "次要角色",
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
        protagonist: "主角", supporting: "配角", antagonist: "反派", minor: "次要角色",
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

  const handleUploadReference = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadingRef(true);
    try {
      const allFiles = Array.from(files);
      const fileArray: File[] = [];
      for (const file of allFiles) {
        const mimeOk = file.type
          ? (ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)
          : ALLOWED_IMAGE_EXTS.test(file.name);
        if (!mimeOk) {
          toast.error("已跳过非图片文件", `${file.name}（仅支持 PNG / JPG / WEBP）`);
          continue;
        }
        if (file.size > MAX_REFERENCE_IMAGE_SIZE) {
          toast.error("已跳过超大文件", `${file.name}（${(file.size / 1024 / 1024).toFixed(1)}MB > ${MAX_REFERENCE_IMAGE_SIZE / 1024 / 1024}MB）`);
          continue;
        }
        fileArray.push(file);
      }
      if (fileArray.length === 0) {
        toast.error("没有可用的图片文件", `请选择 PNG / JPG / WEBP 格式`);
        return;
      }
      const uploaded = await uploadImages(fileArray);
      const urls = uploaded.map((item) => item.url).filter(Boolean);
      if (urls.length === 0) throw new Error("上传失败：未返回 URL");
      setReferenceImages((prev) => [...prev, ...urls].slice(0, MAX_REFERENCE_IMAGES));
      toast.success(`已添加 ${urls.length} 张参考图`, `已自动切换为图生图模式`);
    } catch (err) {
      console.error("[img-gen] 参考图上传失败:", err);
      toast.error("参考图上传失败", (err as Error).message);
    } finally {
      setUploadingRef(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [referenceImages.length]);

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

  const handleRatioChange = useCallback((r: ImageRatio) => {
    setRatio(r);
    setSize(defaultSizeFromRatio(r));
  }, []);

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
          body: JSON.stringify({ prompt: trimmed, mode: "image", ratio }),
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
      const styleOption = findStyleOption(style);
      const styleSuffix = styleOption?.promptSuffix || "";
      const ratioSuffix = ` --ar ${ratio}`;
      const basePrompt =
        styleSuffix && referenceImages.length === 0
          ? `${trimmedPrompt}${styleSuffix}`
          : trimmedPrompt;
      const finalPrompt = basePrompt.includes("--ar") ? basePrompt : `${basePrompt}${ratioSuffix}`;
      const seedNum = seed.trim() ? Number(seed) : undefined;
      const task = await api<ImageTask>("/api/images/generate", {
        method: "POST",
        signal: controller.signal,
        body: JSON.stringify({
          model,
          prompt: finalPrompt,
          n,
          size,
          negative_prompt: negativePrompt.trim() || undefined,
          seed: Number.isFinite(seedNum) ? seedNum : undefined,
          ...(referenceImages.length > 0 ? { images: referenceImages } : {}),
          response_format: responseFormat,
        }),
      });
      const urls = Array.isArray(task.image_urls) ? task.image_urls.filter(Boolean) : [];
      if (urls.length === 0) {
        throw new Error("AI 未返回任何图片");
      }
      const isGrid = n === 4 && urls.length === 1;
      const newCandidates: CandidateImage[] = urls.map((url) => ({ url, ratio, isGrid }));
      setCandidates(newCandidates);
      setSelectedIndex(0);
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
      if ((err as Error)?.name === "AbortError" || isCancelledRef.current) {
        console.info("[img-gen] 用户已终止生成");
        setCandidates([]);
        return;
      }
      const errMsg = (err as Error)?.message || "";
      if (errMsg.includes("队列已满") && retryCountRef.current < 2) {
        retryCountRef.current += 1;
        const delayMs = 5000 * retryCountRef.current;
        toast.success(
          `AI 生图队列繁忙`,
          `${delayMs / 1000} 秒后自动第 ${retryCountRef.current} 次重试…`,
          3000
        );
        setTimeout(() => {
          if (!isCancelledRef.current) {
            handleGenerate();
          }
        }, delayMs);
        return;
      }
      retryCountRef.current = 0;
      console.error("AI 生成图片失败:", err);
      const fallback = Array.from({ length: n }, () => FALLBACK_PLACEHOLDER);
      setCandidates(fallback.map((url) => ({ url, ratio })));
      setSelectedIndex(0);
      toast.error("AI 生成失败", errMsg || "已使用占位图，你可以重新尝试");
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      setIsGenerating(false);
    }
  };

  const handleCancel = useCallback(() => {
    if (!isGenerating) return;
    isCancelledRef.current = true;
    abortControllerRef.current?.abort();
    toast.success("已终止生成", "可以调整参数后重新发起");
  }, [isGenerating]);

  const handleRegenerateSame = useCallback(() => {
    if (!prompt.trim()) {
      toast.error("暂无参数可复用", "请先填写提示词");
      return;
    }
    handleGenerate();
  }, [prompt]);

  const handleSelectAsAsset = async (url: string, ratioAtGen?: ImageRatio) => {
    if (selectedAsset === url) {
      toast.success("该图已是当前角色资产", undefined, 1500);
      return;
    }
    setIsSaving(true);
    try {
      await updateCharacter(character.id, { image: url });
      setSelectedAsset(url);
      setSelectedIndex(null);
      try {
        if (character.project_id) {
          await createAsset(character.project_id, {
            kind: "character",
            name: character.name || "角色资产",
            image_url: url,
            prompt: prompt.trim(),
            tags: [character.name].filter(Boolean),
          });
        }
      } catch (assetErr) {
        console.warn("[img-gen] 创建项目资产失败:", assetErr);
      }
      try {
        await ensureHistoryRecordForAsset({
          url,
          ratioAtGen,
          promptText: prompt.trim(),
          markApplied: true,
        });
      } catch (err) {
        console.warn("[img-gen] 保存已选资产历史失败:", err);
        toast.error("资产历史保存失败", "当前角色图片已更新，但刷新后可能缺少这条历史");
      }
      toast.action("角色图片已更新", {
        label: "在分镜中使用",
        onClick: () => { onApplied?.(url); },
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
      toast.success("角色图片已移除");
    } catch (err) {
      toast.error("移除失败", (err as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteFromHistory = async (id: string) => {
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

  const handlePreviewAsset = useCallback(async (url: string) => {
    const { detectRatioFromImageUrl } = await import("./types");
    const detected = await detectRatioFromImageUrl(url);
    setCandidates([{ url, ratio: detected ?? ratio }]);
    setSelectedIndex(0);
  }, [ratio]);

  const handlePreviewAssetHistory = useCallback((item: HistoryImage) => {
    const itemRatio: ImageRatio = item.ratio ?? "1:1";
    setCandidates([{ url: item.url, ratio: itemRatio }]);
    setSelectedIndex(0);
    setPrompt(item.prompt);
    setModel((item.model || DEFAULT_MODEL) as ImageModel);
    setSize((item.size || DEFAULT_SIZE) as ImageSize);
    setRatio(itemRatio);
    setResponseFormat((item.responseFormat || DEFAULT_FORMAT) as ImageResponseFormat);
    setCount(String(item.n || 1));
  }, []);

  const handleReapplyAssetFromHistory = useCallback(
    async (item: HistoryImage) => {
      setIsSaving(true);
      try {
        await updateCharacter(character.id, { image: item.url });
        setSelectedAsset(item.url);
        const itemRatio: ImageRatio = item.ratio ?? "1:1";
        setPrompt(item.prompt);
        setModel((item.model || DEFAULT_MODEL) as ImageModel);
        setSize((item.size || DEFAULT_SIZE) as ImageSize);
        setRatio(itemRatio);
        setResponseFormat((item.responseFormat || DEFAULT_FORMAT) as ImageResponseFormat);
        setCount(String(item.n || 1));
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

  const handleOpenOriginal = useCallback((url: string) => {
    if (!url) return;
    if (url.startsWith("data:")) {
      toast.error("无法在新页面打开", "当前图为 Base64 编码，数据量较大。请改用 URL 输出格式重新生成。");
      return;
    }
    try {
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error("打开新标签页失败", (err as Error).message);
    }
  }, []);

  const fullTitle = `编辑角色 - ${character.name}（${scriptInfo?.name || character.name}）`;

  return (
    <div className="fixed inset-0 z-[100] bg-[#0a0a0a] flex flex-col">
      {/* 顶栏 */}
      <div className="border-b border-white/10 bg-[#1a1a1a] px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Wand2 className="h-5 w-5 text-emerald-400 flex-shrink-0" />
          <h1 className="text-lg font-semibold text-white truncate" title={fullTitle}>
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
        <ImageGeneratorParams
          character={character}
          scriptInfo={scriptInfo}
          prompt={prompt}
          onPromptChange={setPrompt}
          model={model}
          onModelChange={setModel}
          size={size}
          ratio={ratio}
          onRatioChange={handleRatioChange}
          responseFormat={responseFormat}
          onResponseFormatChange={setResponseFormat}
          count={count}
          onCountChange={setCount}
          style={style}
          onStyleChange={setStyle}
          negativePrompt={negativePrompt}
          onNegativePromptChange={setNegativePrompt}
          seed={seed}
          onSeedChange={setSeed}
          referenceImages={referenceImages}
          onReferenceImagesChange={setReferenceImages}
          showAdvanced={showAdvanced}
          onShowAdvancedChange={setShowAdvanced}
          isGenerating={isGenerating}
          isEnhancing={isEnhancing}
          isImg2Img={isImg2Img}
          candidatesCount={candidates.length}
          onGenerate={handleGenerate}
          onRegenerateSame={handleRegenerateSame}
          onEnhancePrompt={handleEnhancePrompt}
          onResetParams={doResetParams}
        />

        <div className="flex-1 p-4 flex flex-col min-h-0">
          <ImageGeneratorPreview
            isGenerating={isGenerating}
            isImg2Img={isImg2Img}
            isSaving={isSaving}
            n={n}
            estimatedSeconds={estimatedSeconds}
            candidates={candidates}
            selectedIndex={selectedIndex}
            selectedAsset={selectedAsset}
            onCancel={handleCancel}
            onSelectIndex={setSelectedIndex}
            onSelectAsAsset={handleSelectAsAsset}
            onOpenOriginal={handleOpenOriginal}
          />
        </div>

        <ImageGeneratorSidebar
          character={character}
          selectedAsset={selectedAsset}
          isSaving={isSaving}
          assetHistory={assetHistory as unknown as AssetHistoryItem[]}
          history={history}
          onPreviewAsset={handlePreviewAsset}
          onRemoveAsset={handleRemoveAsset}
          onOpenOriginal={handleOpenOriginal}
          onReapplyAssetFromHistory={handleReapplyAssetFromHistory}
          onDeleteAssetHistory={handleDeleteAssetHistory}
          onPreviewAssetHistory={handlePreviewAssetHistory}
          onUseFromHistory={handleUseFromHistory}
          onDeleteFromHistory={handleDeleteFromHistory}
        />
      </div>

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
