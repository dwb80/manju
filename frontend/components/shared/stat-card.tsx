/**
 * @file stat-card.tsx
 * @description 统计卡片组件，显示关键统计指标，支持趋势显示和可配置颜色
 */

"use client";

import { ReactNode } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

/**
 * 统计卡片组件
 *
 * 功能：
 * - 显示关键统计指标
 * - 支持趋势显示
 * - 可配置颜色和图标
 */

interface StatCardProps {
  label: string;
  value: string | number;
  trend?: 'up' | 'down' | 'stable';
  change?: string;
  icon?: React.ComponentType<{ className?: string }>;
  color?: 'emerald' | 'blue' | 'purple' | 'orange';
}

/**
 * StatCard - 统计卡片组件
 * @param {StatCardProps} props - 组件属性
 * @returns {JSX.Element} 渲染的统计卡片元素
 */
export function StatCard({
  label,
  value,
  trend,
  change,
  icon: Icon,
  color = 'emerald'
}: StatCardProps) {
  const colorClasses = {
    emerald: 'text-emerald-400',
    blue: 'text-blue-400',
    purple: 'text-purple-400',
    orange: 'text-orange-400',
  };

  const trendIcons = {
    up: TrendingUp,
    down: TrendingDown,
    stable: Minus,
  };

  const TrendIcon = trend ? trendIcons[trend] : null;

  return (
    <div className="flex flex-col p-4 rounded-lg bg-[#252525] border border-white/10">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-[#888]">{label}</span>
        {Icon && <Icon className={`h-4 w-4 ${colorClasses[color]}`} />}
      </div>

      <div className="flex items-baseline gap-2">
        <span className={`text-2xl font-bold ${colorClasses[color]}`}>
          {value}
        </span>
        {change && (
          <div className="flex items-center gap-1 text-xs text-[#888]">
            {TrendIcon && <TrendIcon className="h-3 w-3" />}
            <span>{change}</span>
          </div>
        )}
      </div>
    </div>
  );
}

interface StatCardGridProps {
  children: ReactNode;
  columns?: 2 | 3 | 4;
}

/**
 * StatCardGrid - 统计卡片网格组件
 * @param {StatCardGridProps} props - 组件属性
 * @returns {JSX.Element} 渲染的统计卡片网格元素
 */
export function StatCardGrid({ children, columns = 4 }: StatCardGridProps) {
  const gridClasses = {
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  };

  return (
    <div className={`grid gap-4 ${gridClasses[columns]}`}>
      {children}
    </div>
  );
}