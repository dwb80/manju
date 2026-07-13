"use client";

import { useRef } from "react";
import {
  Loader2,
  Sparkles,
  Upload,
  Info,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  aspectRatioOptions,
  defaultSizeFromRatio,
  findStyleOption,
  imageSizeOptions,
  styleOptions,
} from "@/lib/project-workflow";
import { AspectRatioSelect } from "@/components/modules/image-picker-aspect-ratio-select";
import { StylePicker } from "@/components/modules/image-picker-style";
import {
  MAX_REFERENCE_IMAGES,
  MAX_REFERENCE_IMAGE_MB,
  MAX_REFERENCE_IMAGE_SIZE,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_IMAGE_EXTS,
  DEFAULT_MODEL,
  DEFAULT_FORMAT,
  DEFAULT_COUNT,
  MODEL_OPTIONS,
  RESPONSE_FORMAT_OPTIONS,
  COUNT_OPTIONS,
} from "./types";
import { ThumbnailImage, CountHighlight } from "./utils";
import type { ImageModel, ImageRatio, ImageResponseFormat, ImageSize, StyleValue } from "@/lib/module-types";

export interface ImageGeneratorParamsProps {
  character: {
    name: string;
    role?: string | null;
    gender?: string | null;
    age?: number | null;
    description?: string | null;
  };
  scriptInfo?: {
    name: string;
    description?: string;
    role?: string;
    gender?: string;
    age?: number;
  };
  prompt: string;
  onPromptChange: (v: string) => void;
  model: ImageModel;
  onModelChange: (v: ImageModel) => void;
  size: ImageSize;
  ratio: ImageRatio;
  onRatioChange: (r: ImageRatio) => void;
  responseFormat: ImageResponseFormat;
  onResponseFormatChange: (v: ImageResponseFormat) => void;
  count: string;
  onCountChange: (v: string) => void;
  style: StyleValue;
  onStyleChange: (v: StyleValue) => void;
  negativePrompt: string;
  onNegativePromptChange: (v: string) => void;
  seed: string;
  onSeedChange: (v: string) => void;
  referenceImages: string[];
  onReferenceImagesChange: (v: string[]) => void;
  showAdvanced: boolean;
  onShowAdvancedChange: (v: boolean) => void;
  isGenerating: boolean;
  isEnhancing: boolean;
  isImg2Img: boolean;
  candidatesCount: number;
  onGenerate: () => void;
  onRegenerateSame: () => void;
  onEnhancePrompt: () => void;
  onResetParams: () => void;
}

export function ImageGeneratorParams({
  character,
  scriptInfo,
  prompt,
  onPromptChange,
  model,
  onModelChange,
  size,
  ratio,
  onRatioChange,
  responseFormat,
  onResponseFormatChange,
  count,
  onCountChange,
  style,
  onStyleChange,
  negativePrompt,
  onNegativePromptChange,
  seed,
  onSeedChange,
  referenceImages,
  onReferenceImagesChange,
  showAdvanced,
  onShowAdvancedChange,
  isGenerating,
  isEnhancing,
  isImg2Img,
  candidatesCount,
  onGenerate,
  onRegenerateSame,
  onEnhancePrompt,
  onResetParams,
}: ImageGeneratorParamsProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadingRef = false; // 由父组件管理，这里简化

  const handleUploadReference = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const allFiles = Array.from(files);
    const fileArray: File[] = [];
    for (const file of allFiles) {
      const mimeOk = file.type
        ? (ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)
        : ALLOWED_IMAGE_EXTS.test(file.name);
      if (!mimeOk) continue;
      if (file.size > MAX_REFERENCE_IMAGE_SIZE) continue;
      fileArray.push(file);
    }
    if (fileArray.length === 0) return;
    // 上传逻辑由父组件处理，这里触发事件
    const event = new CustomEvent("upload-reference", { detail: fileArray });
    window.dispatchEvent(event);
  };

  const handleRemoveReference = (url: string) => {
    onReferenceImagesChange(referenceImages.filter((u) => u !== url));
  };

  return (
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
              <span>提示词 <span className="text-red-400">*</span></span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onEnhancePrompt}
                disabled={!prompt.trim() || isEnhancing}
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
            onChange={(e) => onPromptChange(e.target.value)}
            placeholder={isImg2Img
              ? "图生图：请描述你希望调整的内容，如：把服装换成黑色斗篷，雨夜氛围"
              : "请输入角色描述，如：古风少年剑客，黑发高马尾，身披白袍…"}
            rows={10}
            className="bg-[#252525] border-white/10 text-sm"
          />
        </section>

        {/* ===== 分组 2：基础参数 ===== */}
        <section className="space-y-3">
          <div>
            <label className="mb-1.5 flex items-center justify-between text-sm font-medium text-gray-200">
              <span className="flex items-center gap-1.5">
                模型
                <span className="cursor-help text-gray-500 hover:text-gray-300" title={MODEL_OPTIONS[0].description}>
                  <Info className="h-3.5 w-3.5" />
                </span>
              </span>
            </label>
            {MODEL_OPTIONS.length === 1 ? (
              <div className="h-10 w-full rounded-md border border-white/10 bg-[#252525] px-3 py-2 text-sm text-white flex items-center">
                {MODEL_OPTIONS[0].label}（已固定）
              </div>
            ) : (
              <select
                value={model}
                onChange={(e) => onModelChange(e.target.value as ImageModel)}
                className="h-10 w-full rounded-md border border-white/10 bg-[#252525] px-3 text-sm outline-none focus:border-emerald-500 text-white"
              >
                {MODEL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="mb-1.5 flex items-center justify-between text-sm font-medium text-gray-200">
              <span>比例</span>
              <span className="text-[10px] text-gray-400">
                {imageSizeOptions.find((o) => o.value === size)?.label}
              </span>
            </label>
            <AspectRatioSelect
              value={ratio}
              options={aspectRatioOptions}
              onChange={(r) => {
                onRatioChange(r);
                // size 同步更新由父组件处理
              }}
            />
          </div>
        </section>

        {/* ===== 分组 3：高级选项 ===== */}
        <section className="rounded-lg border border-white/10 bg-[#1f1f1f]">
          <button
            type="button"
            onClick={() => onShowAdvancedChange(!showAdvanced)}
            className="flex w-full items-center justify-between px-3 py-2 text-left"
          >
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
              {showAdvanced ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              高级选项
            </span>
            <span className="text-[10px] text-gray-500">
              {style || negativePrompt || seed || responseFormat !== DEFAULT_FORMAT || count !== String(DEFAULT_COUNT) ? "已配置" : "可选"}
            </span>
          </button>
          {showAdvanced && (
            <div className="space-y-3 border-t border-white/10 p-3">
              <div>
                <label className="mb-1.5 flex items-center justify-between text-sm font-medium text-gray-200">
                  <span className="flex items-center gap-1.5">生成数量</span>
                  <span className="text-[10px] text-emerald-400">将生成 {count} 张候选</span>
                </label>
                <select
                  value={count}
                  onChange={(e) => onCountChange(e.target.value)}
                  className="h-10 w-full rounded-md border border-white/10 bg-[#252525] px-3 text-sm outline-none focus:border-emerald-500 text-white"
                >
                  {COUNT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-gray-200">
                  <span>输出格式</span>
                </label>
                <select
                  value={responseFormat}
                  onChange={(e) => onResponseFormatChange(e.target.value as ImageResponseFormat)}
                  className="h-10 w-full rounded-md border border-white/10 bg-[#252525] px-3 text-sm outline-none focus:border-emerald-500 text-white"
                >
                  {RESPONSE_FORMAT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 flex items-center justify-between text-sm font-medium text-gray-200">
                  <span>风格修饰</span>
                  <span className="text-[10px] text-gray-400">
                    {findStyleOption(style)?.label || "默认"}
                  </span>
                </label>
                <StylePicker value={style} options={styleOptions} onChange={onStyleChange} />
                <p className="mt-1.5 text-[11px] text-gray-500">仅文生图追加（图生图忽略以保留原图特征）。</p>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-200">反向提示词</label>
                <Input
                  value={negativePrompt}
                  onChange={(e) => onNegativePromptChange(e.target.value)}
                  placeholder="避免模糊、畸形、错误结构、水印"
                  className="bg-[#252525] border-white/10 text-sm"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-200">随机种子（可选）</label>
                <Input
                  value={seed}
                  onChange={(e) => onSeedChange(e.target.value.replace(/[^\d-]/g, ""))}
                  placeholder="留空则随机"
                  inputMode="numeric"
                  className="bg-[#252525] border-white/10 text-sm"
                />
              </div>
            </div>
          )}
        </section>

        {/* ===== 分组 4：参考图 ===== */}
        <section>
          <label className="mb-1.5 flex items-center justify-between text-sm font-medium text-gray-200">
            <span className="flex items-center gap-1.5">参考图（图生图）</span>
            <span className="text-[10px] tabular-nums transition-colors">
              <CountHighlight value={referenceImages.length} max={MAX_REFERENCE_IMAGES} />
            </span>
          </label>
          <input
            ref={fileInputRef}
            type="file"
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
            disabled={referenceImages.length >= MAX_REFERENCE_IMAGES}
          >
            <Upload className="mr-2 h-3 w-3" />
            {referenceImages.length === 0 ? "上传参考图（开启图生图）" : "继续添加"}
          </Button>
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
              onClick={() => onReferenceImagesChange([])}
              className="mt-1.5 text-[10px] text-gray-500 hover:text-red-400 transition-colors"
            >
              清空所有参考图
            </button>
          )}
        </section>

        <Button
          type="button"
          onClick={onGenerate}
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

        {candidatesCount > 0 && !isGenerating && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRegenerateSame}
            className="w-full border-white/10 text-gray-300 hover:text-white gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            重新生成同款参数
          </Button>
        )}
      </div>
    </div>
  );
}
