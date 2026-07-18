/**
 * @file ai-generate-dialog.tsx
 * @description 通用AI生成图片对话框组件，适用于角色工厂/场景工厂/道具工厂共用
 */

"use client";

/**
 * 通用 AI 生成图片对话框
 *
 * 功能：
 * - 用户输入描述（prompt）+ 风格（style）+ 数量（count）
 * - 点击「生成预览」调用 /api/images/generate 返回多张候选图
 * - 用户从候选图选择 1 张（选中状态高亮）
 * - 用户填写元数据（name + typeField）
 * - 点击「确认创建」通过 onConfirm 把 { imageUrl, prompt, style, ...extra } 回调给父组件
 *
 * 适用场景：角色工厂 / 场景工厂 / 道具工厂 三个工厂共用。
 */

import { useEffect, useRef, useState } from "react";
import { Loader2, Sparkles, X, Check, Image as ImageIcon, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";
import { toast } from "@/components/common/toast";

/** 图片生成任务返回类型（后端 /api/images/generate） */
interface ImageTask {
  id: string;
  status: string;
  image_urls: string[];
  error?: string;
  prompt?: string;
}

/** 类型字段配置（让三个工厂各自定义"类型"的字段名与选项） */
export interface AITypeFieldConfig {
  /** 表单字段名：例如 "role" / "type" / "category" */
  name: string;
  /** 中文标签：例如 "角色类型" / "场景类型" / "道具类别" */
  label: string;
  options: { value: string; label: string }[];
  defaultValue: string;
}

/** 父组件的 onConfirm 回调载荷 */
export interface AIConfirmPayload {
  imageUrl: string;
  prompt: string;
  style: string;
  count: number;
  name: string;
  /** 透传 type 字段（可能叫 role/type/category） */
  typeFieldName: string;
  typeFieldValue: string;
  /** 父组件注入的额外字段（如 description、tags） */
  extra: Record<string, string>;
}

export interface AIGenerateImageDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** 对话框标题，例如 "AI 生成角色" */
  title: string;
  /** 描述输入框的占位提示 */
  promptPlaceholder?: string;
  /** 类型字段配置 */
  typeField: AITypeFieldConfig;
  /** 父组件注入的额外字段（输入框形式），例如 { description, tags } */
  extraFields?: { name: string; label: string; placeholder?: string; defaultValue?: string }[];
  /**
   * 用户点击「确认创建」时回调，父组件应在此完成实体的创建（带 image 字段）。
   * 若返回 Promise<reject>，对话框会保持打开并提示错误。
   */
  onConfirm: (payload: AIConfirmPayload) => Promise<void> | void;
  /** 选中的默认名称（创建后名字），留空则由用户填写 */
  defaultName?: string;
}

/** 风格选项（统一在公共组件里给出，避免三个工厂重复声明） */
const STYLE_OPTIONS = [
  { value: "", label: "默认" },
  { value: "写实", label: "写实" },
  { value: "动漫", label: "动漫" },
  { value: "古风", label: "古风" },
  { value: "科幻", label: "科幻" },
  { value: "二次元", label: "二次元" },
];

/** 数量选项 */
const COUNT_OPTIONS = [
  { value: "1", label: "1 张" },
  { value: "2", label: "2 张" },
  { value: "3", label: "3 张" },
  { value: "4", label: "4 张" },
];

/**
 * AIGenerateImageDialog - 通用AI生成图片对话框组件
 * @param {AIGenerateImageDialogProps} props - 组件属性
 * @returns {JSX.Element | null} 渲染的对话框元素
 */
export function AIGenerateImageDialog({
  isOpen,
  onClose,
  title,
  promptPlaceholder = "请输入要生成的描述，例如：古风少年剑客，黑发高马尾，身披白袍…",
  typeField,
  extraFields = [],
  onConfirm,
  defaultName = "",
}: AIGenerateImageDialogProps) {
  // ===== 表单状态 =====
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("");
  const [count, setCount] = useState("4");
  const [name, setName] = useState(defaultName);
  const [typeValue, setTypeValue] = useState(typeField.defaultValue);
  const [extras, setExtras] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    extraFields.forEach((f) => {
      init[f.name] = f.defaultValue ?? "";
    });
    return init;
  });

  // ===== 候选图状态 =====
  const [isGenerating, setIsGenerating] = useState(false);
  const [candidates, setCandidates] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [error, setError] = useState("");

  // ===== 提交状态 =====
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 跟踪是否第一次打开，用于重置表单
  const prevIsOpenRef = useRef(false);
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      setPrompt("");
      setStyle("");
      setCount("4");
      setName(defaultName);
      setTypeValue(typeField.defaultValue);
      const initExtras: Record<string, string> = {};
      extraFields.forEach((f) => {
        initExtras[f.name] = f.defaultValue ?? "";
      });
      setExtras(initExtras);
      setCandidates([]);
      setSelectedIndex(null);
      setError("");
      setIsGenerating(false);
      setIsSubmitting(false);
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, defaultName, typeField.defaultValue, extraFields]);

  if (!isOpen) return null;

  /** 调用 /api/images/generate；失败时保留明确失败态，禁止伪造可入库资产。 */
  const handleGenerate = async () => {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      setError("请输入描述");
      return;
    }
    setError("");
    setIsGenerating(true);
    setCandidates([]);
    setSelectedIndex(null);
    try {
      const n = Math.max(1, Math.min(4, Number(count) || 4));
      const task = await api<ImageTask>("/api/images/generate", {
        method: "POST",
        body: JSON.stringify({
          prompt: style ? `${trimmedPrompt}, ${style}风格` : trimmedPrompt,
          n,
          size: "1024x1024",
          response_format: "url",
        }),
      });
      const urls = Array.isArray(task.image_urls) ? task.image_urls.filter(Boolean) : [];
      if (urls.length === 0) {
        throw new Error("AI 未返回任何图片");
      }
      setCandidates(urls);
      // 默认选中第一张
      setSelectedIndex(0);
      // 默认把描述前 8 个字作为名字
      if (!name.trim()) {
        setName(trimmedPrompt.slice(0, 8) || "新资产");
      }
    } catch (err) {
      console.error("AI 生成图片失败:", err);
      setCandidates([]);
      setSelectedIndex(null);
      const msg = (err as Error).message || "AI 生成失败";
      setError(msg);
      toast.error("AI 生成失败", "未创建任何资产，请检查模型配置后重试");
    } finally {
      setIsGenerating(false);
    }
  };

  /** 提交创建。 */
  const handleConfirm = async () => {
    setError("");
    if (selectedIndex === null || !candidates[selectedIndex]) {
      setError("请先选择一张候选图");
      return;
    }
    if (!name.trim()) {
      setError("请填写名称");
      return;
    }
    setIsSubmitting(true);
    try {
      await onConfirm({
        imageUrl: candidates[selectedIndex],
        prompt: prompt.trim(),
        style,
        count: Number(count) || 1,
        name: name.trim(),
        typeFieldName: typeField.name,
        typeFieldValue: typeValue,
        extra: extras,
      });
      // 成功后由父组件关闭对话框
    } catch (err) {
      const msg = (err as Error).message || "创建失败，请重试";
      setError(msg);
      toast.error("创建失败", msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[90] grid place-items-center bg-black/60 px-4 backdrop-blur-sm overflow-y-auto py-8"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="w-full max-w-3xl max-h-[calc(100vh-4rem)] rounded-2xl border border-white/10 bg-[#202020] p-5 shadow-2xl flex flex-col">
        {/* 标题栏 */}
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-emerald-400" />
            <h2 className="text-base font-semibold text-white">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-md hover:bg-white/10 flex items-center justify-center"
            aria-label="关闭"
            disabled={isSubmitting}
          >
            <X className="h-4 w-4 text-[#888]" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-4">
          {/* 1. 描述 + 风格 + 数量 */}
          <div>
            <label className="block text-sm font-medium text-[#888] mb-1.5">
              描述 <span className="text-red-400">*</span>
            </label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={promptPlaceholder}
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[#888] mb-1.5">风格</label>
              <select
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                className="h-10 w-full rounded-md border border-border bg-muted px-3 text-sm outline-none focus:border-primary"
              >
                {STYLE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#888] mb-1.5">数量</label>
              <select
                value={count}
                onChange={(e) => setCount(e.target.value)}
                className="h-10 w-full rounded-md border border-border bg-muted px-3 text-sm outline-none focus:border-primary"
              >
                {COUNT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim()}
              className="bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  生成预览
                </>
              )}
            </Button>
            {candidates.length > 0 && !isGenerating && (
              <span className="text-xs text-[#888]">已生成 {candidates.length} 张候选图，请点击选中</span>
            )}
          </div>

          {/* 2. 候选图 */}
          <div>
            {isGenerating ? (
              <div className="flex items-center justify-center py-8 text-[#888] border border-dashed border-white/10 rounded-lg">
                <Loader2 className="h-5 w-5 mr-2 animate-spin text-emerald-400" />
                AI 正在生成图片，请稍候…
              </div>
            ) : candidates.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {candidates.map((url, idx) => {
                  const selected = selectedIndex === idx;
                  return (
                    <button
                      key={`${url}-${idx}`}
                      type="button"
                      onClick={() => setSelectedIndex(idx)}
                      className={`relative aspect-square overflow-hidden rounded-lg border-2 transition-all ${selected
                          ? "border-emerald-400 ring-2 ring-emerald-400/40 scale-[1.02]"
                          : "border-white/10 hover:border-white/30"
                        }`}
                      aria-label={`候选图 ${idx + 1}`}
                    >
                      <img
                        src={url}
                        alt={`候选图 ${idx + 1}`}
                        className="w-full h-full object-cover bg-[#1a1a1a]"
                        onError={(e) => {
                          const t = e.target as HTMLImageElement;
                          t.style.display = "none";
                        }}
                      />
                      {selected && (
                        <div className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg">
                          <Check className="h-3.5 w-3.5 text-white" />
                        </div>
                      )}
                      <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/60 text-[10px] text-white/90">
                        #{idx + 1}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-[#666] border border-dashed border-white/10 rounded-lg">
                <ImageIcon className="h-8 w-8 mb-2 opacity-50" />
                <span className="text-xs">填写描述后点击「生成预览」</span>
              </div>
            )}
          </div>

          {/* 3. 元数据表单：name + type + extras */}
          {selectedIndex !== null && (
            <div className="space-y-3 pt-2 border-t border-white/10">
              <div className="text-xs text-emerald-400 pt-1">
                ✓ 已选中「{name || "未命名"}」，将创建资产并设置主图为候选 #{selectedIndex + 1}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[#888] mb-1.5">
                    名称 <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-10 w-full rounded-md border border-border bg-muted px-3 text-sm outline-none focus:border-primary"
                    placeholder="请输入名称"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#888] mb-1.5">
                    {typeField.label}
                  </label>
                  <select
                    value={typeValue}
                    onChange={(e) => setTypeValue(e.target.value)}
                    className="h-10 w-full rounded-md border border-border bg-muted px-3 text-sm outline-none focus:border-primary"
                  >
                    {typeField.options.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              {extraFields.length > 0 && (
                <div className="space-y-3">
                  {extraFields.map((f) => (
                    <div key={f.name}>
                      <label className="block text-sm font-medium text-[#888] mb-1.5">{f.label}</label>
                      <input
                        type="text"
                        value={extras[f.name] ?? ""}
                        onChange={(e) => setExtras((prev) => ({ ...prev, [f.name]: e.target.value }))}
                        placeholder={f.placeholder}
                        className="h-10 w-full rounded-md border border-border bg-muted px-3 text-sm outline-none focus:border-primary"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-md px-3 py-2">
              {error}
            </div>
          )}
        </div>

        {/* 操作按钮 */}
        <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-white/10 flex-shrink-0">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            取消
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleConfirm}
            disabled={isSubmitting || isGenerating || selectedIndex === null}
            className="bg-emerald-500 hover:bg-emerald-600"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                创建中...
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                确认创建
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
