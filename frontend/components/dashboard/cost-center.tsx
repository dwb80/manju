"use client";

import { memo } from "react";
import { DollarSign, Sparkles, Bot, Image, Video, TrendingUp, TrendingDown } from "lucide-react";
import type { CostBreakdown } from "@/lib/app-types";

/** AI成本中心组件Props */
export interface CostCenterProps {
  /** 成本明细数据 */
  data: CostBreakdown;
  /** 环比变化百分比（正数为上涨，负数为下跌） */
  changePercent?: number;
}

/** 成本类型配置 */
const costTypeConfig: Record<"gpt" | "claude" | "images" | "videos", { name: string; icon: typeof Sparkles; color: string; bgColor: string }> = {
  gpt: {
    name: "GPT",
    icon: Sparkles,
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/20",
  },
  claude: {
    name: "Claude",
    icon: Bot,
    color: "text-orange-400",
    bgColor: "bg-orange-500/20",
  },
  images: {
    name: "图片",
    icon: Image,
    color: "text-pink-400",
    bgColor: "bg-pink-500/20",
  },
  videos: {
    name: "视频",
    icon: Video,
    color: "text-purple-400",
    bgColor: "bg-purple-500/20",
  },
};

/** 成本项组件 */
const CostItemRow = memo(function CostItemRow({ type, cost }: { type: "gpt" | "claude" | "images" | "videos"; cost: number }) {
  const config = costTypeConfig[type];
  const Icon = config.icon;

  return (
    <div className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 p-3">
      <div className="flex items-center gap-3">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${config.bgColor}`}>
          <Icon className={`h-4 w-4 ${config.color}`} />
        </div>
        <span className="text-sm text-white">{config.name}</span>
      </div>
      <span className={`text-sm font-medium ${config.color}`}>
        ¥{cost.toFixed(2)}
      </span>
    </div>
  );
});

/** AI成本中心组件 */
export const CostCenter = memo(function CostCenter({
  data,
  changePercent,
}: CostCenterProps) {
  const isUp = changePercent !== undefined && changePercent > 0;
  const isDown = changePercent !== undefined && changePercent < 0;

  const costItems: { type: "gpt" | "claude" | "images" | "videos"; cost: number }[] = [
    { type: "gpt", cost: data.gpt },
    { type: "claude", cost: data.claude },
    { type: "images", cost: data.images },
    { type: "videos", cost: data.videos },
  ];

  return (
    <div className="rounded-xl border border-white/10 bg-[#252525] p-6">
      {/* 标题和总成本 */}
      <div className="mb-6 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500/20 to-green-500/20">
            <DollarSign className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">AI成本中心</h2>
            <p className="text-sm text-[#888]">今日成本明细</p>
          </div>
        </div>

        {/* 总成本 */}
        <div className="text-right">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-400">
              ¥{data.total.toFixed(2)}
            </span>
            {changePercent !== undefined && (
              <span
                className={`flex items-center gap-1 text-xs ${isUp ? "text-red-400" : isDown ? "text-emerald-400" : "text-[#888]"
                  }`}
              >
                {isUp ? (
                  <TrendingUp className="h-3 w-3" />
                ) : isDown ? (
                  <TrendingDown className="h-3 w-3" />
                ) : null}
                {Math.abs(changePercent).toFixed(1)}%
              </span>
            )}
          </div>
          <span className="text-xs text-[#666]">总成本</span>
        </div>
      </div>

      {/* 成本明细列表 */}
      <div className="space-y-2">
        {costItems.map((item) => (
          <CostItemRow key={item.type} type={item.type} cost={item.cost} />
        ))}
      </div>

      {/* 空状态 */}
      {data.total === 0 && (
        <div className="flex h-20 flex-col items-center justify-center">
          <DollarSign className="mb-2 h-8 w-8 text-[#333]" />
          <p className="text-sm text-[#666]">暂无成本数据</p>
        </div>
      )}
    </div>
  );
});

export default CostCenter;