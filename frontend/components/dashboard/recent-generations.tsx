"use client";

import { memo } from "react";
import { Image, Video, Mic, Clock, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import type { RecentGeneration as RecentGenerationData } from "@/lib/app-types";

/** 最近生成组件Props */
export interface RecentGenerationsProps {
  /** 生成项列表 */
  items: RecentGenerationData[];
  /** 点击项回调 */
  onItemClick?: (itemId: string) => void;
}

/** 资产类型配置 */
const assetTypeConfig: Record<"character" | "video" | "voiceover", { icon: typeof Image; color: string; bgColor: string }> = {
  character: {
    icon: Image,
    color: "text-pink-400",
    bgColor: "bg-pink-500/20",
  },
  video: {
    icon: Video,
    color: "text-purple-400",
    bgColor: "bg-purple-500/20",
  },
  voiceover: {
    icon: Mic,
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/20",
  },
};

/** 资产状态配置 */
const assetStatusConfig: Record<"success" | "failed", { icon: typeof CheckCircle2; color: string; text: string }> = {
  success: {
    icon: CheckCircle2,
    color: "text-emerald-400",
    text: "已完成",
  },
  failed: {
    icon: AlertCircle,
    color: "text-red-400",
    text: "失败",
  },
};

/** 格式化时间 */
function formatTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diff = now.getTime() - d.getTime();

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 7) return `${days}天前`;
  return d.toLocaleDateString("zh-CN");
}

/** 生成项卡片 */
const GenerationItem = memo(function GenerationItem({
  item,
  onClick,
}: {
  item: RecentGenerationData;
  onClick?: () => void;
}) {
  const typeConfig = assetTypeConfig[item.type];
  const statusConfig = assetStatusConfig[item.status];
  const TypeIcon = typeConfig.icon;
  const StatusIcon = statusConfig.icon;

  return (
    <div
      className="flex cursor-pointer items-center gap-3 rounded-lg border border-white/5 bg-white/5 p-3 transition-all hover:border-white/10 hover:bg-white/10"
      onClick={onClick}
    >
      {/* 缩略图或类型图标 */}
      <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-[#1a1a1a]">
        <div className={`flex h-full w-full items-center justify-center ${typeConfig.bgColor}`}>
          <TypeIcon className={`h-5 w-5 ${typeConfig.color}`} />
        </div>
      </div>

      {/* 内容 */}
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <TypeIcon className={`h-3.5 w-3.5 ${typeConfig.color}`} />
          <span className="truncate text-sm font-medium text-white">{item.title}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#666]">
          <StatusIcon className={`h-3 w-3 ${statusConfig.color}`} />
          <span className={statusConfig.color}>{statusConfig.text}</span>
          <span>·</span>
          <Clock className="h-3 w-3" />
          <span>{formatTime(item.createdAt)}</span>
        </div>
      </div>
    </div>
  );
});

/** 最近生成组件 */
export const RecentGenerations = memo(function RecentGenerations({
  items,
  onItemClick,
}: RecentGenerationsProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#252525] p-6">
      {/* 标题 */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-pink-500/20 to-purple-500/20">
            <Image className="h-5 w-5 text-pink-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">最近生成</h2>
            <p className="text-sm text-[#888]">最新生成的资产</p>
          </div>
        </div>
      </div>

      {/* 生成项列表 */}
      <div className="space-y-2">
        {items.map((item) => (
          <GenerationItem
            key={item.id}
            item={item}
            onClick={() => onItemClick?.(item.id)}
          />
        ))}
      </div>

      {/* 空状态 */}
      {items.length === 0 && (
        <div className="flex h-40 flex-col items-center justify-center">
          <Image className="mb-2 h-12 w-12 text-[#333]" />
          <p className="text-sm text-[#666]">暂无生成记录</p>
        </div>
      )}
    </div>
  );
});

export default RecentGenerations;