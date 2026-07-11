"use client";

import { memo } from "react";
import { Image, Video, FileText, Layers, ClipboardCheck } from "lucide-react";
import type { ReviewCenterData } from "@/lib/app-types";

/** 审核类型 */
export type ReviewType = "image" | "video" | "script" | "storyboard";

/** 待审核中心组件Props */
export interface ReviewCenterProps {
  /** 审核数据 */
  data: ReviewCenterData;
  /** 点击回调 */
  onItemClick?: (type: ReviewType) => void;
}

/** 审核类型配置 */
const reviewTypeConfig: Record<ReviewType, { name: string; icon: typeof Image; color: string; bgColor: string }> = {
  image: {
    name: "图片",
    icon: Image,
    color: "text-pink-400",
    bgColor: "bg-pink-500/20",
  },
  video: {
    name: "视频",
    icon: Video,
    color: "text-purple-400",
    bgColor: "bg-purple-500/20",
  },
  script: {
    name: "剧本",
    icon: FileText,
    color: "text-blue-400",
    bgColor: "bg-blue-500/20",
  },
  storyboard: {
    name: "分镜",
    icon: Layers,
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/20",
  },
};

/** 审核项卡片 */
const ReviewItemCard = memo(function ReviewItemCard({
  type,
  count,
  onClick,
}: {
  type: ReviewType;
  count: number;
  onClick?: () => void;
}) {
  const config = reviewTypeConfig[type];
  const Icon = config.icon;

  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-center justify-center rounded-xl border border-white/10 bg-[#1a1a1a] p-4 transition-all hover:border-white/20 hover:bg-[#222]"
    >
      {/* 图标 */}
      <div
        className={`mb-2 flex h-12 w-12 items-center justify-center rounded-lg ${config.bgColor} transition-transform group-hover:scale-110`}
      >
        <Icon className={`h-6 w-6 ${config.color}`} />
      </div>

      {/* 类型名称 */}
      <span className="mb-1 text-sm text-[#888]">{config.name}</span>

      {/* 数量 */}
      <span className={`text-2xl font-bold ${config.color}`}>{count}</span>

      {/* 待审核标签 */}
      <span className="mt-1 text-xs text-[#666]">待审核</span>
    </button>
  );
});

/** 待审核中心组件 */
export const ReviewCenter = memo(function ReviewCenter({
  data,
  onItemClick,
}: ReviewCenterProps) {
  const reviewItems: { type: ReviewType; count: number }[] = [
    { type: "image", count: data.images },
    { type: "video", count: data.videos },
    { type: "script", count: data.scripts },
    { type: "storyboard", count: data.storyboards },
  ];
  const totalPending = reviewItems.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="rounded-xl border border-white/10 bg-[#252525] p-6">
      {/* 标题 */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500/20 to-amber-500/20">
            <ClipboardCheck className="h-5 w-5 text-orange-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">待审核中心</h2>
            <p className="text-sm text-[#888]">共 {totalPending} 项待审核</p>
          </div>
        </div>
      </div>

      {/* 审核项列表 */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {reviewItems.map((item) => (
          <ReviewItemCard
            key={item.type}
            type={item.type}
            count={item.count}
            onClick={() => onItemClick?.(item.type)}
          />
        ))}
      </div>

      {/* 空状态 */}
      {totalPending === 0 && (
        <div className="flex h-40 flex-col items-center justify-center">
          <ClipboardCheck className="mb-2 h-12 w-12 text-[#333]" />
          <p className="text-sm text-[#666]">暂无待审核内容</p>
        </div>
      )}
    </div>
  );
});

export default ReviewCenter;