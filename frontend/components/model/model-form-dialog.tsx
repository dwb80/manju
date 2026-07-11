"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ModelInfo, ModelType, ModelCapabilities } from "@/components/dashboard/model-center";

/** 表单数据结构 */
export interface ModelFormData {
  name: string;
  type: ModelType;
  description: string;
  version: string;
  provider: string;
  isDefault: boolean;
  is_enabled: boolean;
  // API配置
  apiEndpoint: string;
  apiMethod: "POST" | "GET";
  apiStatusEndpoint: string;
  // 能力标签
  capabilities: ModelCapabilities;
  // 参数（聊天模型）
  maxContext: string;
  maxTokens: string;
  defaultTemperature: string;
  // 参数（图片模型）
  supportedSizes: string;
  defaultSteps: string;
  responseFormats: string;
  // 参数（视频模型）
  supportedRatios: string;
  maxDuration: string;
  maxFrames: string;
  // 价格
  priceStandardInput: string;
  priceStandardOutput: string;
  priceStandardImage: string;
  priceStandardVideo: string;
  priceCurrentInput: string;
  priceCurrentOutput: string;
  priceCurrentImage: string;
  priceCurrentVideo: string;
  // 性能
  avgResponseTime: string;
  successRate: string;
  concurrency: string;
  // 标签
  tags: string;
}

interface ModelFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: ModelFormData) => void;
  editingModel?: ModelInfo | null;
  isLoading?: boolean;
}

/** 聊天模型能力选项 */
const CHAT_CAPABILITIES: Array<{ key: keyof ModelCapabilities; label: string }> = [
  { key: "visionSupport", label: "视觉理解" },
  { key: "thinkingMode", label: "Thinking模式" },
  { key: "toolCalling", label: "工具调用" },
  { key: "streaming", label: "流式响应" },
];

/** 图片模型能力选项 */
const IMAGE_CAPABILITIES: Array<{ key: keyof ModelCapabilities; label: string }> = [
  { key: "img2img", label: "图生图" },
  { key: "keyframeMode", label: "关键帧模式" },
  { key: "highDensity", label: "高信息密度" },
];

/** 视频模型能力选项 */
const VIDEO_CAPABILITIES: Array<{ key: keyof ModelCapabilities; label: string }> = [
  { key: "img2vid", label: "图生视频" },
  { key: "keyframeMode", label: "关键帧模式" },
  { key: "asyncGeneration", label: "异步生成" },
  { key: "frameConstraint", label: "帧数约束" },
];

const EMPTY_FORM: ModelFormData = {
  name: "",
  type: "chat",
  description: "",
  version: "1.0",
  provider: "Agnes AI",
  isDefault: false,
  is_enabled: true,
  apiEndpoint: "",
  apiMethod: "POST",
  apiStatusEndpoint: "",
  capabilities: {},
  maxContext: "4096",
  maxTokens: "2000",
  defaultTemperature: "0.7",
  supportedSizes: "1024x768, 768x1024, 1024x1024",
  defaultSteps: "25",
  responseFormats: "url, b64_json",
  supportedRatios: "16:9, 9:16, 1:1",
  maxDuration: "18",
  maxFrames: "441",
  priceStandardInput: "$0.03 / 1M tokens",
  priceStandardOutput: "$0.15 / 1M tokens",
  priceStandardImage: "$0.003 / 张",
  priceStandardVideo: "$0.005 / 秒",
  priceCurrentInput: "$0 / 1M tokens",
  priceCurrentOutput: "$0 / 1M tokens",
  priceCurrentImage: "$0 / 张",
  priceCurrentVideo: "$0 / 秒",
  avgResponseTime: "500",
  successRate: "99",
  concurrency: "10",
  tags: "",
};

/** 将 ModelInfo 转换为表单数据 */
function modelToForm(model: ModelInfo): ModelFormData {
  const caps = model.capabilities ?? {};
  const pricing = model.pricing ?? { standard: {}, current: {} };
  const params = model.parameters ?? {};

  return {
    name: model.name ?? "",
    type: model.type ?? "chat",
    description: model.description ?? "",
    version: model.version ?? "1.0",
    provider: model.provider ?? "Agnes AI",
    isDefault: model.isDefault ?? false,
    is_enabled: model.is_enabled ?? true,
    apiEndpoint: model.api_config?.endpoint ?? "",
    apiMethod: model.api_config?.method ?? "POST",
    apiStatusEndpoint: model.api_config?.statusEndpoint ?? "",
    capabilities: { ...caps },
    maxContext: String(params.maxContext ?? ""),
    maxTokens: String(params.maxTokens ?? ""),
    defaultTemperature: String(params.defaultTemperature ?? ""),
    supportedSizes: (params.supportedSizes ?? []).join(", "),
    defaultSteps: String(params.defaultSteps ?? ""),
    responseFormats: (params.responseFormats ?? []).join(", "),
    supportedRatios: (params.supportedRatios ?? []).join(", "),
    maxDuration: String(params.maxDuration ?? ""),
    maxFrames: String(params.maxFrames ?? ""),
    priceStandardInput: pricing.standard?.chat?.input ?? "",
    priceStandardOutput: pricing.standard?.chat?.output ?? "",
    priceStandardImage: pricing.standard?.image ?? "",
    priceStandardVideo: pricing.standard?.video ?? "",
    priceCurrentInput: pricing.current?.chat?.input ?? "",
    priceCurrentOutput: pricing.current?.chat?.output ?? "",
    priceCurrentImage: pricing.current?.image ?? "",
    priceCurrentVideo: pricing.current?.video ?? "",
    avgResponseTime: String(model.performance?.avgResponseTime ?? ""),
    successRate: String(model.performance?.successRate ?? ""),
    concurrency: String(model.performance?.concurrency ?? ""),
    tags: (model.tags ?? []).join(", "),
  };
}

export function ModelFormDialog({
  isOpen,
  onClose,
  onSave,
  editingModel,
  isLoading = false,
}: ModelFormDialogProps) {
  const [form, setForm] = useState<ModelFormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      setForm(editingModel ? modelToForm(editingModel) : EMPTY_FORM);
      setErrors({});
    }
  }, [isOpen, editingModel]);

  const handleChange = <K extends keyof ModelFormData>(key: K, value: ModelFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key as string]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key as string];
        return next;
      });
    }
  };

  const handleCapabilityToggle = (key: keyof ModelCapabilities) => {
    setForm((prev) => ({
      ...prev,
      capabilities: { ...prev.capabilities, [key]: !prev.capabilities[key] },
    }));
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = "模型名称为必填项";
    if (!form.apiEndpoint.trim()) errs.apiEndpoint = "API Endpoint为必填项";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSave(form);
    }
  };

  if (!isOpen) return null;

  const capabilityOptions =
    form.type === "chat"
      ? CHAT_CAPABILITIES
      : form.type === "image"
      ? IMAGE_CAPABILITIES
      : VIDEO_CAPABILITIES;

  const isVideo = form.type === "video";
  const isImage = form.type === "image";
  const isChat = form.type === "chat";

  return (
    <div
      className="fixed inset-0 z-[90] grid place-items-center bg-black/60 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={editingModel ? "编辑模型" : "注册新模型"}
    >
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#202020] p-5 shadow-2xl">
        {/* 标题栏 */}
        <div className="flex items-center justify-between mb-4 sticky top-0 bg-[#202020] z-10 pb-2">
          <h2 className="text-base font-semibold text-white">
            {editingModel ? "编辑模型" : "注册新模型"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-md hover:bg-white/10 flex items-center justify-center"
            aria-label="关闭"
          >
            <X className="h-4 w-4 text-[#888]" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* 基本信息 */}
          <section className="mb-5">
            <h3 className="text-sm font-semibold text-emerald-400 mb-3 border-b border-white/10 pb-1">
              基本信息
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#888] mb-1.5">
                  模型名称<span className="text-red-400 ml-1">*</span>
                </label>
                <Input
                  value={form.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  placeholder="如：Agnes 2.0 Flash"
                  className={errors.name ? "border-red-400" : ""}
                />
                {errors.name && <p className="text-xs text-red-400 mt-1">{errors.name}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-[#888] mb-1.5">模型类型</label>
                <select
                  value={form.type}
                  onChange={(e) => handleChange("type", e.target.value as ModelType)}
                  className="h-10 w-full rounded-md border border-border bg-muted px-3 text-sm outline-none focus:border-primary"
                >
                  <option value="chat">聊天模型</option>
                  <option value="image">图片模型</option>
                  <option value="video">视频模型</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-[#888] mb-1.5">模型描述</label>
                <Textarea
                  value={form.description}
                  onChange={(e) => handleChange("description", e.target.value)}
                  placeholder="模型功能描述..."
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#888] mb-1.5">版本</label>
                <Input
                  value={form.version}
                  onChange={(e) => handleChange("version", e.target.value)}
                  placeholder="如：2.0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#888] mb-1.5">提供商</label>
                <Input
                  value={form.provider}
                  onChange={(e) => handleChange("provider", e.target.value)}
                  placeholder="如：Agnes AI"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#888] mb-1.5">标签（逗号分隔）</label>
                <Input
                  value={form.tags}
                  onChange={(e) => handleChange("tags", e.target.value)}
                  placeholder="如：视觉理解, Thinking模式"
                />
              </div>
              <div className="flex items-end gap-4">
                <label className="flex items-center gap-2 text-sm text-[#888] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isDefault}
                    onChange={(e) => handleChange("isDefault", e.target.checked)}
                    className="h-4 w-4 rounded accent-emerald-500"
                  />
                  设为默认模型
                </label>
                <label className="flex items-center gap-2 text-sm text-[#888] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_enabled}
                    onChange={(e) => handleChange("is_enabled", e.target.checked)}
                    className="h-4 w-4 rounded accent-emerald-500"
                  />
                  启用模型
                </label>
              </div>
            </div>
          </section>

          {/* API配置 */}
          <section className="mb-5">
            <h3 className="text-sm font-semibold text-emerald-400 mb-3 border-b border-white/10 pb-1">
              API配置
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-[#888] mb-1.5">
                  API Endpoint<span className="text-red-400 ml-1">*</span>
                </label>
                <Input
                  value={form.apiEndpoint}
                  onChange={(e) => handleChange("apiEndpoint", e.target.value)}
                  placeholder="https://apihub.agnes-ai.com/v1/chat/completions"
                  className={errors.apiEndpoint ? "border-red-400" : ""}
                />
                {errors.apiEndpoint && (
                  <p className="text-xs text-red-400 mt-1">{errors.apiEndpoint}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-[#888] mb-1.5">HTTP方法</label>
                <select
                  value={form.apiMethod}
                  onChange={(e) => handleChange("apiMethod", e.target.value as "POST" | "GET")}
                  className="h-10 w-full rounded-md border border-border bg-muted px-3 text-sm outline-none focus:border-primary"
                >
                  <option value="POST">POST</option>
                  <option value="GET">GET</option>
                </select>
              </div>
              {isVideo && (
                <div>
                  <label className="block text-sm font-medium text-[#888] mb-1.5">
                    状态查询Endpoint（视频模型）
                  </label>
                  <Input
                    value={form.apiStatusEndpoint}
                    onChange={(e) => handleChange("apiStatusEndpoint", e.target.value)}
                    placeholder="https://apihub.agnes-ai.com/agnesapi?video_id={video_id}"
                  />
                </div>
              )}
            </div>
          </section>

          {/* 能力标签 */}
          <section className="mb-5">
            <h3 className="text-sm font-semibold text-emerald-400 mb-3 border-b border-white/10 pb-1">
              能力标签
            </h3>
            <div className="flex flex-wrap gap-4">
              {capabilityOptions.map((cap) => (
                <label
                  key={cap.key}
                  className="flex items-center gap-2 text-sm text-[#aaa] cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={Boolean(form.capabilities[cap.key])}
                    onChange={() => handleCapabilityToggle(cap.key)}
                    className="h-4 w-4 rounded accent-emerald-500"
                  />
                  {cap.label}
                </label>
              ))}
            </div>
          </section>

          {/* 参数配置 */}
          <section className="mb-5">
            <h3 className="text-sm font-semibold text-emerald-400 mb-3 border-b border-white/10 pb-1">
              参数配置
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {isChat && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-[#888] mb-1.5">最大上下文</label>
                    <Input
                      type="number"
                      value={form.maxContext}
                      onChange={(e) => handleChange("maxContext", e.target.value)}
                      placeholder="4096"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#888] mb-1.5">最大输出Token</label>
                    <Input
                      type="number"
                      value={form.maxTokens}
                      onChange={(e) => handleChange("maxTokens", e.target.value)}
                      placeholder="2000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#888] mb-1.5">默认温度</label>
                    <Input
                      type="number"
                      step="0.1"
                      value={form.defaultTemperature}
                      onChange={(e) => handleChange("defaultTemperature", e.target.value)}
                      placeholder="0.7"
                    />
                  </div>
                </>
              )}
              {isImage && (
                <>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-[#888] mb-1.5">
                      支持尺寸（逗号分隔）
                    </label>
                    <Input
                      value={form.supportedSizes}
                      onChange={(e) => handleChange("supportedSizes", e.target.value)}
                      placeholder="1024x768, 768x1024, 1024x1024"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#888] mb-1.5">默认推理步数</label>
                    <Input
                      type="number"
                      value={form.defaultSteps}
                      onChange={(e) => handleChange("defaultSteps", e.target.value)}
                      placeholder="25"
                    />
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-sm font-medium text-[#888] mb-1.5">
                      返回格式（逗号分隔）
                    </label>
                    <Input
                      value={form.responseFormats}
                      onChange={(e) => handleChange("responseFormats", e.target.value)}
                      placeholder="url, b64_json"
                    />
                  </div>
                </>
              )}
              {isVideo && (
                <>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-[#888] mb-1.5">
                      支持比例（逗号分隔）
                    </label>
                    <Input
                      value={form.supportedRatios}
                      onChange={(e) => handleChange("supportedRatios", e.target.value)}
                      placeholder="16:9, 9:16, 1:1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#888] mb-1.5">最大时长(秒)</label>
                    <Input
                      type="number"
                      value={form.maxDuration}
                      onChange={(e) => handleChange("maxDuration", e.target.value)}
                      placeholder="18"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#888] mb-1.5">最大帧数</label>
                    <Input
                      type="number"
                      value={form.maxFrames}
                      onChange={(e) => handleChange("maxFrames", e.target.value)}
                      placeholder="441"
                    />
                  </div>
                </>
              )}
            </div>
          </section>

          {/* 价格信息 */}
          <section className="mb-5">
            <h3 className="text-sm font-semibold text-emerald-400 mb-3 border-b border-white/10 pb-1">
              价格信息
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {isChat && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-[#888] mb-1.5">标准-输入价格</label>
                    <Input
                      value={form.priceStandardInput}
                      onChange={(e) => handleChange("priceStandardInput", e.target.value)}
                      placeholder="$0.03 / 1M tokens"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#888] mb-1.5">标准-输出价格</label>
                    <Input
                      value={form.priceStandardOutput}
                      onChange={(e) => handleChange("priceStandardOutput", e.target.value)}
                      placeholder="$0.15 / 1M tokens"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#888] mb-1.5">当前-输入价格</label>
                    <Input
                      value={form.priceCurrentInput}
                      onChange={(e) => handleChange("priceCurrentInput", e.target.value)}
                      placeholder="$0 / 1M tokens"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#888] mb-1.5">当前-输出价格</label>
                    <Input
                      value={form.priceCurrentOutput}
                      onChange={(e) => handleChange("priceCurrentOutput", e.target.value)}
                      placeholder="$0 / 1M tokens"
                    />
                  </div>
                </>
              )}
              {isImage && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-[#888] mb-1.5">标准价格</label>
                    <Input
                      value={form.priceStandardImage}
                      onChange={(e) => handleChange("priceStandardImage", e.target.value)}
                      placeholder="$0.003 / 张"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#888] mb-1.5">当前价格</label>
                    <Input
                      value={form.priceCurrentImage}
                      onChange={(e) => handleChange("priceCurrentImage", e.target.value)}
                      placeholder="$0 / 张"
                    />
                  </div>
                </>
              )}
              {isVideo && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-[#888] mb-1.5">标准价格</label>
                    <Input
                      value={form.priceStandardVideo}
                      onChange={(e) => handleChange("priceStandardVideo", e.target.value)}
                      placeholder="$0.005 / 秒"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#888] mb-1.5">当前价格</label>
                    <Input
                      value={form.priceCurrentVideo}
                      onChange={(e) => handleChange("priceCurrentVideo", e.target.value)}
                      placeholder="$0 / 秒"
                    />
                  </div>
                </>
              )}
            </div>
          </section>

          {/* 性能指标 */}
          <section className="mb-5">
            <h3 className="text-sm font-semibold text-emerald-400 mb-3 border-b border-white/10 pb-1">
              性能指标
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#888] mb-1.5">平均响应时间(ms)</label>
                <Input
                  type="number"
                  value={form.avgResponseTime}
                  onChange={(e) => handleChange("avgResponseTime", e.target.value)}
                  placeholder="500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#888] mb-1.5">成功率(%)</label>
                <Input
                  type="number"
                  value={form.successRate}
                  onChange={(e) => handleChange("successRate", e.target.value)}
                  placeholder="99"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#888] mb-1.5">并发能力</label>
                <Input
                  type="number"
                  value={form.concurrency}
                  onChange={(e) => handleChange("concurrency", e.target.value)}
                  placeholder="10"
                />
              </div>
            </div>
          </section>

          {/* 操作按钮 */}
          <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-white/10 sticky bottom-0 bg-[#202020]">
            <Button type="button" size="sm" variant="secondary" onClick={onClose} disabled={isLoading}>
              取消
            </Button>
            <Button type="submit" size="sm" disabled={isLoading}>
              {isLoading ? "保存中..." : "保存"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
