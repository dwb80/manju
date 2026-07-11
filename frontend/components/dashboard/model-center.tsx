"use client";

import { memo, useState } from "react";
import { MessageCircle, Image as ImageIcon, Video, Star, RefreshCw, Plus, Pencil, Trash2, Power, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ModelType = "chat" | "image" | "video";

/** 模型API配置 */
export interface ModelApiConfig {
  endpoint: string;
  method: "POST" | "GET";
  headers?: Record<string, string>;
  statusEndpoint?: string;
}

/** 模型能力标签 */
export interface ModelCapabilities {
  visionSupport?: boolean;
  thinkingMode?: boolean;
  toolCalling?: boolean;
  streaming?: boolean;
  img2img?: boolean;
  keyframeMode?: boolean;
  highDensity?: boolean;
  img2vid?: boolean;
  asyncGeneration?: boolean;
  frameConstraint?: boolean;
}

/** 模型价格信息 */
export interface ModelPricing {
  standard: {
    chat?: { input: string; output: string };
    image?: string;
    video?: string;
  };
  current: {
    chat?: { input: string; output: string };
    image?: string;
    video?: string;
  };
}

/** 模型配置（与后端 ModelConfig 对齐） */
export interface ModelInfo {
  id: string;
  name: string;
  type: ModelType;
  description: string;
  isDefault: boolean;
  is_enabled: boolean;
  version: string;
  provider: string;
  api_config: ModelApiConfig;
  capabilities: ModelCapabilities;
  parameters: {
    maxContext?: number;
    maxTokens?: number;
    defaultTemperature?: number;
    supportedSizes?: string[];
    defaultSteps?: number;
    responseFormats?: string[];
    supportedRatios?: string[];
    maxDuration?: number;
    maxFrames?: number;
    frameRateRange?: { min: number; max: number; default: number };
  };
  parameter_rules: Record<string, { min?: number; max?: number; rule?: string; description?: string }>;
  pricing: ModelPricing;
  performance: {
    avgResponseTime?: number;
    successRate?: number;
    concurrency?: number;
  };
  usageStats: {
    totalCalls: number;
    weeklyCalls: number;
    monthlyCalls: number;
    lastUsedAt: string;
  };
  tags: string[];
  created_at: string;
  updated_at: string;
}

interface ModelCenterProps {
  models: ModelInfo[];
  isLoading?: boolean;
  onRefresh: () => void;
  onCreate: () => void;
  onEdit: (model: ModelInfo) => void;
  onDelete: (model: ModelInfo) => void;
  onSetDefault: (modelId: string) => void;
  onToggleEnabled: (modelId: string, enabled: boolean) => void;
  onViewDetail?: (model: ModelInfo) => void;
}

export const ModelCenter = memo(function ModelCenter({
  models,
  isLoading = false,
  onRefresh,
  onCreate,
  onEdit,
  onDelete,
  onSetDefault,
  onToggleEnabled,
  onViewDetail,
}: ModelCenterProps) {
  const [activeTab, setActiveTab] = useState<ModelType>("chat");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredModels = models.filter(
    (model) =>
      model.type === activeTab &&
      (searchQuery === "" ||
        model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        model.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (model.tags ?? []).some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())))
  );

  const getTypeIcon = (type: ModelType) => {
    switch (type) {
      case "chat":
        return MessageCircle;
      case "image":
        return ImageIcon;
      case "video":
        return Video;
    }
  };

  const getTypeColor = (type: ModelType) => {
    switch (type) {
      case "chat":
        return "text-blue-400";
      case "image":
        return "text-purple-400";
      case "video":
        return "text-orange-400";
    }
  };

  const getTypeLabel = (type: ModelType) => {
    switch (type) {
      case "chat":
        return "聊天";
      case "image":
        return "图片";
      case "video":
        return "视频";
    }
  };

  /** 获取能力标签列表 */
  const getCapabilityLabels = (caps: ModelCapabilities, type: ModelType): string[] => {
    const labels: string[] = [];
    if (type === "chat") {
      if (caps.visionSupport) labels.push("视觉理解");
      if (caps.thinkingMode) labels.push("Thinking模式");
      if (caps.toolCalling) labels.push("工具调用");
      if (caps.streaming) labels.push("流式响应");
    }
    if (type === "image") {
      if (caps.img2img) labels.push("图生图");
      if (caps.keyframeMode) labels.push("关键帧模式");
      if (caps.highDensity) labels.push("高信息密度");
    }
    if (type === "video") {
      if (caps.img2vid) labels.push("图生视频");
      if (caps.keyframeMode) labels.push("关键帧模式");
      if (caps.asyncGeneration) labels.push("异步生成");
      if (caps.frameConstraint) labels.push("帧数约束");
    }
    return labels;
  };

  /** 获取价格显示文本 */
  const getPriceText = (pricing: ModelPricing, type: ModelType): { standard: string; current: string } => {
    if (type === "chat") {
      const std = pricing.standard?.chat;
      const cur = pricing.current?.chat;
      return {
        standard: std ? `输入 ${std.input} / 输出 ${std.output}` : "-",
        current: cur ? `输入 ${cur.input} / 输出 ${cur.output}` : "-",
      };
    }
    if (type === "image") {
      return {
        standard: pricing.standard?.image ?? "-",
        current: pricing.current?.image ?? "-",
      };
    }
    return {
      standard: pricing.standard?.video ?? "-",
      current: pricing.current?.video ?? "-",
    };
  };

  const tabCounts = {
    chat: models.filter((m) => m.type === "chat").length,
    image: models.filter((m) => m.type === "image").length,
    video: models.filter((m) => m.type === "video").length,
  };

  return (
    <div className="rounded-xl border border-white/10 bg-[#1a1a1a]">
      {/* 头部 */}
      <div className="border-b border-white/10 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">模型中心</h3>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onRefresh} className="gap-2" disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              刷新
            </Button>
            <Button size="sm" onClick={onCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              添加模型
            </Button>
          </div>
        </div>

        {/* 类型切换 */}
        <div className="mt-4 flex gap-2">
          {(["chat", "image", "video"] as ModelType[]).map((type) => {
            const Icon = getTypeIcon(type);
            const isActive = activeTab === type;
            return (
              <button
                key={type}
                onClick={() => setActiveTab(type)}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm transition-all ${
                  isActive
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "text-[#888] hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4" />
                {getTypeLabel(type)}
                <span className="ml-1 rounded bg-white/10 px-1.5 py-0.5 text-xs">{tabCounts[type]}</span>
              </button>
            );
          })}
        </div>

        {/* 搜索 */}
        <input
          type="text"
          placeholder="搜索模型名称、描述或标签..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="mt-4 w-full rounded-lg border border-white/10 bg-[#252525] px-4 py-2 text-sm text-white placeholder-[#666] focus:border-emerald-500 focus:outline-none"
        />
      </div>

      {/* 模型列表 */}
      <div className="divide-y divide-white/5">
        {isLoading && filteredModels.length === 0 ? (
          <div className="p-8 text-center text-[#666]">加载中...</div>
        ) : filteredModels.length === 0 ? (
          <div className="p-8 text-center text-[#666]">
            暂无模型，点击右上角"添加模型"创建
          </div>
        ) : (
          filteredModels.map((model) => {
            const TypeIcon = getTypeIcon(model.type);
            const capLabels = getCapabilityLabels(model.capabilities ?? {}, model.type);
            const priceText = getPriceText(model.pricing ?? { standard: {}, current: {} }, model.type);

            return (
              <div key={model.id} className="p-4">
                {/* 第一行：图标 + 基本信息 + 操作 */}
                <div className="flex items-start gap-4">
                  {/* 图标 */}
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white/5 ${getTypeColor(model.type)}`}
                  >
                    <TypeIcon className="h-6 w-6" />
                  </div>

                  {/* 基本信息 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-white">{model.name}</span>
                      {model.isDefault && (
                        <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-400">
                          默认
                        </span>
                      )}
                      {!model.is_enabled && (
                        <span className="rounded bg-red-500/20 px-2 py-0.5 text-xs text-red-400">
                          已禁用
                        </span>
                      )}
                      <span className="rounded bg-white/10 px-2 py-0.5 text-xs text-[#888]">
                        v{model.version}
                      </span>
                      <span className="text-xs text-[#666]">{model.provider}</span>
                    </div>
                    <div className="mt-1 text-sm text-[#888]">{model.description}</div>
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex items-center gap-1 shrink-0">
                    {onViewDetail && (
                      <button
                        onClick={() => onViewDetail(model)}
                        className="rounded p-2 text-[#888] hover:bg-white/10 hover:text-white"
                        title="查看详情"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => onEdit(model)}
                      className="rounded p-2 text-[#888] hover:bg-white/10 hover:text-white"
                      title="编辑"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onToggleEnabled(model.id, !model.is_enabled)}
                      className={`rounded p-2 hover:bg-white/10 ${
                        model.is_enabled ? "text-emerald-400 hover:text-emerald-300" : "text-[#666] hover:text-white"
                      }`}
                      title={model.is_enabled ? "禁用" : "启用"}
                    >
                      <Power className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onDelete(model)}
                      className="rounded p-2 text-[#888] hover:bg-red-500/10 hover:text-red-400"
                      title="删除"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* 第二行：能力标签 */}
                {capLabels.length > 0 && (
                  <div className="mt-3 flex items-center gap-2 flex-wrap pl-16">
                    <span className="text-xs text-[#666]">能力：</span>
                    {capLabels.map((label) => (
                      <span
                        key={label}
                        className="rounded bg-blue-500/10 px-2 py-0.5 text-xs text-blue-300"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                )}

                {/* 第三行：API配置 */}
                {model.api_config?.endpoint && (
                  <div className="mt-2 flex items-center gap-2 flex-wrap pl-16">
                    <span className="text-xs text-[#666]">API：</span>
                    <span className="rounded bg-white/5 px-2 py-0.5 text-xs text-[#aaa] font-mono">
                      {model.api_config.method} {model.api_config.endpoint}
                    </span>
                    {model.api_config.statusEndpoint && (
                      <span className="rounded bg-orange-500/10 px-2 py-0.5 text-xs text-orange-300 font-mono">
                        状态: {model.api_config.statusEndpoint}
                      </span>
                    )}
                  </div>
                )}

                {/* 第四行：性能 + 价格 + 统计 */}
                <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2 pl-16 text-xs">
                  {/* 性能 */}
                  <div className="rounded bg-white/5 px-3 py-2">
                    <div className="text-[#666] mb-1">性能</div>
                    <div className="text-[#aaa]">
                      响应 {model.performance?.avgResponseTime ?? "-"}ms | 成功率{" "}
                      {model.performance?.successRate ?? "-"}% | 并发{" "}
                      {model.performance?.concurrency ?? "-"}
                    </div>
                  </div>
                  {/* 价格 */}
                  <div className="rounded bg-white/5 px-3 py-2">
                    <div className="text-[#666] mb-1">价格</div>
                    <div className="text-[#aaa]">
                      标准：{priceText.standard}
                    </div>
                    <div className="text-emerald-400">
                      当前：{priceText.current}
                    </div>
                  </div>
                  {/* 统计 */}
                  <div className="rounded bg-white/5 px-3 py-2">
                    <div className="text-[#666] mb-1">统计</div>
                    <div className="text-[#aaa]">
                      总调用 {model.usageStats?.totalCalls ?? 0} | 本周{" "}
                      {model.usageStats?.weeklyCalls ?? 0} | 本月{" "}
                      {model.usageStats?.monthlyCalls ?? 0}
                    </div>
                  </div>
                </div>

                {/* 第五行：设为默认按钮 */}
                {!model.isDefault && model.is_enabled && (
                  <div className="mt-2 pl-16">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onSetDefault(model.id)}
                      className="gap-2"
                    >
                      <Star className="h-4 w-4" />
                      设为默认
                    </Button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
});
