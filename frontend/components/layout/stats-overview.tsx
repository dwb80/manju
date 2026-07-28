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
    border: "border-info/20",
    bg: "bg-info/10",
    text: "text-info",
    iconBg: "bg-info/20",
    iconText: "text-info",
  },
  purple: {
    border: "border-chart-1/20",
    bg: "bg-chart-1/10",
    text: "text-chart-1",
    iconBg: "bg-chart-1/20",
    iconText: "text-chart-1",
  },
  amber: {
    border: "border-warning/20",
    bg: "bg-warning/10",
    text: "text-warning",
    iconBg: "bg-warning/20",
    iconText: "text-warning",
  },
  emerald: {
    border: "border-primary/20",
    bg: "bg-primary/10",
    text: "text-primary",
    iconBg: "bg-primary/20",
    iconText: "text-primary",
  },
  red: {
    border: "border-destructive/20",
    bg: "bg-destructive/10",
    text: "text-destructive",
    iconBg: "bg-destructive/20",
    iconText: "text-destructive",
  },
  cyan: {
    border: "border-chart-2/20",
    bg: "bg-chart-2/10",
    text: "text-chart-2",
    iconBg: "bg-chart-2/20",
    iconText: "text-chart-2",
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
 * StatsOverview - 统一统计卡片组组件
 * @param {StatsOverviewProps} props - 组件属性
 * @returns {JSX.Element} 渲染的统计卡片组元素
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
            className={`rounded-lg border ${tone.border} ${tone.bg} px-4 py-3 ${isClickable ? "cursor-pointer transition-colors hover:brightness-110" : ""
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
                  <div className="text-sm font-semibold text-foreground">{card.title}</div>
                  {card.sub && (
                    <div className={`text-xs ${tone.text}`}>{card.sub}</div>
                  )}
                </div>
              </div>
              {/* 右侧：主数值 */}
              <div className="text-right">
                <div className="text-lg font-bold text-foreground">{card.value}</div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  );
}
