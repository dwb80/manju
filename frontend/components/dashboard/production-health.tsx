/**
 * @file production-health.tsx
 * @description 生产健康度组件，展示AI生产质量指标包括图片一致性、角色一致性等
 */
"use client";

import { memo } from "react";
import { Heart, Image, Users, AlertTriangle, Clock, Star } from "lucide-react";
import type { ProductionHealth as ProductionHealthData } from "@/lib/app-types";

/** 生产健康度组件Props */
export interface ProductionHealthProps {
  /** 健康度数据 */
  data: ProductionHealthData;
}

/** 健康度指标项 */
interface HealthMetricItem {
  icon: typeof Image;
  label: string;
  value: number;
  unit?: string;
  type: "percentage" | "number";
  color: "emerald" | "blue" | "purple" | "orange" | "red";
  invert?: boolean; // 是否反转颜色逻辑（数值越低越好）
}

/** 颜色配置 */
const colorConfig = {
  emerald: {
    text: "text-primary",
    bg: "bg-primary",
    bgLight: "bg-primary/20",
  },
  blue: {
    text: "text-info",
    bg: "bg-info",
    bgLight: "bg-info/20",
  },
  purple: {
    text: "text-chart-1",
    bg: "bg-chart-1",
    bgLight: "bg-chart-1/20",
  },
  orange: {
    text: "text-chart-3",
    bg: "bg-chart-3",
    bgLight: "bg-chart-3/20",
  },
  red: {
    text: "text-destructive",
    bg: "bg-destructive",
    bgLight: "bg-destructive/20",
  },
};

/** 根据数值获取颜色 */
function getScoreColor(score: number, invert = false): "emerald" | "blue" | "orange" | "red" {
  if (invert) {
    if (score <= 20) return "emerald";
    if (score <= 40) return "blue";
    if (score <= 60) return "orange";
    return "red";
  }
  if (score >= 80) return "emerald";
  if (score >= 60) return "blue";
  if (score >= 40) return "orange";
  return "red";
}

/** 星级评分 */
const StarRating = memo(function StarRating({ score }: { score: number }) {
  const stars = Math.round(score / 20); // 0-100 转换为 0-5 星

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-4 w-4 ${star <= stars ? "text-warning fill-warning" : "text-muted-foreground"
            }`}
        />
      ))}
      <span className="ml-2 text-sm text-muted-foreground">{score}分</span>
    </div>
  );
});

/** 指标卡片 */
const MetricCard = memo(function MetricCard({
  icon: Icon,
  label,
  value,
  unit,
  type,
  color,
  invert,
}: HealthMetricItem) {
  const colors = colorConfig[color];
  const displayValue = type === "percentage" ? `${value}%` : `${value}${unit || ""}`;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${colors.bgLight}`}>
            <Icon className={`h-4 w-4 ${colors.text}`} />
          </div>
          <span className="text-sm text-muted-foreground">{label}</span>
        </div>
        <span className={`text-lg font-bold ${colors.text}`}>{displayValue}</span>
      </div>

      {type === "percentage" && (
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full ${colors.bg} transition-all duration-300`}
            style={{ width: `${invert ? 100 - value : value}%` }}
          />
        </div>
      )}
    </div>
  );
});

/**
 * ProductionHealth - 生产健康度组件
 * @param {ProductionHealthProps} props - 组件属性
 * @param {ProductionHealthData} props.data - 健康度数据
 * @returns {JSX.Element} 渲染的健康度指标界面
 */
export const ProductionHealth = memo(function ProductionHealth({
  data,
}: ProductionHealthProps) {
  const metrics: HealthMetricItem[] = [
    {
      icon: Image,
      label: "图片任务成功率",
      value: data.imageConsistency,
      type: "percentage",
      color: getScoreColor(data.imageConsistency),
    },
    {
      icon: Users,
      label: "视频任务成功率",
      value: data.characterConsistency,
      type: "percentage",
      color: getScoreColor(data.characterConsistency),
    },
    {
      icon: AlertTriangle,
      label: "失败率",
      value: data.failRate,
      type: "percentage",
      color: getScoreColor(data.failRate, true),
      invert: true,
    },
    {
      icon: Clock,
      label: "平均耗时（未采集）",
      value: data.avgDuration,
      unit: "分钟",
      type: "number",
      color: "blue",
    },
  ];

  return (
    <div className="rounded-xl border border-border bg-secondary p-6">
      {/* 标题 */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-chart-4/20 to-chart-4/20">
          <Heart className="h-5 w-5 text-chart-4" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">生产健康度</h2>
          <p className="text-sm text-muted-foreground">AI生产质量指标</p>
        </div>
      </div>

      {/* 整体健康度 */}
      <div className="mb-6 rounded-lg border border-border bg-gradient-to-br from-background to-muted p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">整体健康度</span>
          <StarRating score={data.overallScore} />
        </div>
        <div className="relative h-4 overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full bg-gradient-to-r transition-all duration-500 ${data.overallScore >= 80
                ? "from-primary to-success"
                : data.overallScore >= 60
                  ? "from-info to-chart-2"
                  : data.overallScore >= 40
                    ? "from-chart-3 to-warning"
                    : "from-destructive to-chart-4"
              }`}
            style={{ width: `${data.overallScore}%` }}
          />
        </div>
      </div>

      {/* 指标网格 */}
      <div className="grid grid-cols-2 gap-3">
        {metrics.map((metric, index) => (
          <MetricCard key={index} {...metric} />
        ))}
      </div>
    </div>
  );
});

export default ProductionHealth;
