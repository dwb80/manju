"use client";

/**
 * StatsOverview —— 统一统计卡片组（C2 公共组件）
 *
 * 设计动机（评审 P0-修复 C2）：
 * - 此前 /ai-tasks /models /data /publish 等独立页面各自写"3 张统计卡"的重复样式
 * - 颜色、布局、图标位置、字号等都略有差异，影响视觉一致性
 * - 抽到本组件后，仅需提供 cards 数组
 *
 * 设计原则：
 * - 单一职责：仅负责统计卡的展示
 * - 可配置：每个 card 的颜色、图标、标题、值、辅助文本均可配
 * - 类型化：使用 union 限定颜色，编译期即可发现问题
 * - 可访问：图标有 aria-label，卡片语义化
 *
 * 使用示例：
 *   <StatsOverview
 *     columns={3}
 *     cards={[
 *       { tone: 'blue',   icon: <MessageCircle />, title: '聊天模型', value: 5, sub: '3 个可用' },
 *       { tone: 'purple', icon: <Image />,         title: '图片模型', value: 8, sub: '6 个可用' },
 *       { tone: 'amber',  icon: <Video />,         title: '视频模型', value: 4, sub: '2 个可用' },
 *     ]}
 *   />
 */

import { ReactNode } from "react";

/** 卡片主题色（限定取值范围） */
export type StatsCardTone = "blue" | "purple" | "amber" | "emerald" | "red" | "cyan";

/** 单个统计卡 */
export interface StatsCardConfig {
  /** 主题色（控制边框、背景、文字色） */
  tone: StatsCardTone;
  /** 卡片图标（推荐 lucide-react 图标） */
  icon: ReactNode;
  /** 标题（如"聊天模型"） */
  title: string;
  /** 主数值（数字或字符串） */
  value: ReactNode;
  /** 辅助文本（如"3 个可用"） */
  sub?: ReactNode;
  /** 点击事件（可选） */
  onClick?: () => void;
}

export interface StatsOverviewProps {
  /** 卡片数组 */
  cards: StatsCardConfig[];
  /** 列数（默认 3，支持 2/3/4/6） */
  columns?: 2 | 3 | 4 | 6;
  /** 自定义外层 className */
  className?: string;
}

// === 主题色映射（Tailwind 动态类） ===
const TONE_CLASS: Record<StatsCardTone, {
  border: string;
  bg: string;
  text: string;
  iconBg: string;
  iconText: string;
}> = {
  blue: {
    border: "border-blue-500/20",
    bg: "bg-blue-500/10",
    text: "text-blue-300",
    iconBg: "bg-blue-500/20",
    iconText: "text-blue-400",
  },
  purple: {
    border: "border-purple-500/20",
    bg: "bg-purple-500/10",
    text: "text-purple-300",
    iconBg: "bg-purple-500/20",
    iconText: "text-purple-400",
  },
  amber: {
    border: "border-amber-500/20",
    bg: "bg-amber-500/10",
    text: "text-amber-300",
    iconBg: "bg-amber-500/20",
    iconText: "text-amber-400",
  },
  emerald: {
    border: "border-emerald-500/20",
    bg: "bg-emerald-500/10",
    text: "text-emerald-300",
    iconBg: "bg-emerald-500/20",
    iconText: "text-emerald-400",
  },
  red: {
    border: "border-red-500/20",
    bg: "bg-red-500/10",
    text: "text-red-300",
    iconBg: "bg-red-500/20",
    iconText: "text-red-400",
  },
  cyan: {
    border: "border-cyan-500/20",
    bg: "bg-cyan-500/10",
    text: "text-cyan-300",
    iconBg: "bg-cyan-500/20",
    iconText: "text-cyan-400",
  },
};

/** 列数对应的 Tailwind 网格类 */
const COLUMNS_CLASS: Record<number, string> = {
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  6: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6",
};

/**
 * 统一统计卡组
 */
export function StatsOverview({
  cards,
  columns = 3,
  className = "",
}: StatsOverviewProps) {
  return (
    <div className={`grid gap-4 ${COLUMNS_CLASS[columns]} ${className}`}>
      {cards.map((card, idx) => {
        const tone = TONE_CLASS[card.tone]
        const isClickable = !!card.onClick
        return (
          <div
            key={idx}
            onClick={card.onClick}
            role={isClickable ? "button" : undefined}
            tabIndex={isClickable ? 0 : undefined}
            onKeyDown={
              isClickable
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      card.onClick?.()
                    }
                  }
                : undefined
            }
            className={`rounded-lg border ${tone.border} ${tone.bg} px-4 py-3 ${
              isClickable ? "cursor-pointer transition-colors hover:brightness-110" : ""
            }`}
            aria-label={`${card.title}：${typeof card.value === "number" ? card.value : ""}`}
          >
            <div className="flex items-center justify-between">
              {/* 左侧：图标 + 标题 + 副文本 */}
              <div className="flex items-center gap-2">
                <div
                  className={`h-8 w-8 rounded-lg ${tone.iconBg} flex items-center justify-center`}
                >
                  <span className={tone.iconText}>{card.icon}</span>
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">{card.title}</div>
                  {card.sub && (
                    <div className={`text-xs ${tone.text}`}>{card.sub}</div>
                  )}
                </div>
              </div>
              {/* 右侧：主数值 */}
              <div className="text-right">
                <div className="text-lg font-bold text-white">{card.value}</div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  );
}
