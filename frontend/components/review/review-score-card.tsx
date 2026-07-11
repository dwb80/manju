"use client";

import { useState, useMemo, useCallback } from "react";
import { Star, Award, FileCheck, Lightbulb, Code, MessageSquare } from "lucide-react";

/**
 * 审核质量评分组件：用于审核中心的质量评分界面。
 *
 * 功能：
 * - 显示审核质量评分界面
 * - 评分维度：内容质量、符合要求程度、创意水平、技术质量
 * - 每个维度：星级评分组件、维度说明文字、维度权重显示
 * - 自动计算综合评分（加权平均）
 * - 显示评分标准说明
 * - 支持评语输入（可选）
 * - 提交评分按钮
 *
 * @param reviewId - 审核ID
 * @param targetName - 审核对象名称
 * @param targetType - 审核对象类型
 * @param onScore - 提交评分回调
 * @param defaultScores - 默认评分（可选，用于编辑场景）
 * @param loading - 加载状态
 * @param disabled - 是否禁用
 *
 * @example
 * ```tsx
 * <ReviewScoreCard
 *   reviewId="review-123"
 *   targetName="角色设计方案"
 *   targetType="asset"
 *   onScore={(scores) => handleSubmitScore(scores)}
 *   defaultScores={{
 *     contentQuality: 4,
 *     requirementMatch: 5,
 *     creativity: 4,
 *     technicalQuality: 4,
 *     overallScore: 4.3,
 *     comment: "整体设计优秀"
 *   }}
 * />
 * ```
 */

/** 审核对象类型 */
export type ReviewTargetType = "storyboard" | "asset" | "script";

/** 评分数据类型 */
export interface ScoreData {
  /** 内容质量评分 (1-5星) */
  contentQuality: number;
  /** 符合要求程度评分 (1-5星) */
  requirementMatch: number;
  /** 创意水平评分 (1-5星) */
  creativity: number;
  /** 技术质量评分 (1-5星) */
  technicalQuality: number;
  /** 综合评分（加权平均，自动计算） */
  overallScore: number;
  /** 评语（可选） */
  comment?: string;
}

/** 评分维度配置 */
interface ScoreDimension {
  /** 维度key */
  key: keyof Pick<ScoreData, "contentQuality" | "requirementMatch" | "creativity" | "technicalQuality">;
  /** 维度名称 */
  label: string;
  /** 维度说明 */
  description: string;
  /** 权重（百分比） */
  weight: number;
  /** 图标 */
  icon: typeof Award;
}

/** 评分标准配置 */
interface ScoreLevelConfig {
  /** 等级 */
  level: number;
  /** 标签 */
  label: string;
  /** 说明 */
  description: string;
  /** 颜色 */
  color: string;
  /** 背景色 */
  bgColor: string;
}

type ReviewScoreCardProps = {
  /** 审核ID */
  reviewId: string;
  /** 审核对象名称 */
  targetName: string;
  /** 审核对象类型 */
  targetType: ReviewTargetType;
  /** 提交评分回调 */
  onScore: (scores: ScoreData) => void | Promise<void>;
  /** 默认评分（可选，用于编辑场景） */
  defaultScores?: ScoreData;
  /** 加载状态 */
  loading?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
};

/** 评分维度配置列表 */
const SCORE_DIMENSIONS: ScoreDimension[] = [
  {
    key: "contentQuality",
    label: "内容质量",
    description: "评估内容的完整性、准确性和专业性",
    weight: 30,
    icon: FileCheck,
  },
  {
    key: "requirementMatch",
    label: "符合要求程度",
    description: "评估是否符合项目需求和规范要求",
    weight: 30,
    icon: Award,
  },
  {
    key: "creativity",
    label: "创意水平",
    description: "评估设计的创新性和独特性",
    weight: 20,
    icon: Lightbulb,
  },
  {
    key: "technicalQuality",
    label: "技术质量",
    description: "评估技术实现的规范性和质量",
    weight: 20,
    icon: Code,
  },
];

/** 评分标准配置列表 */
const SCORE_LEVELS: ScoreLevelConfig[] = [
  {
    level: 5,
    label: "优秀",
    description: "超出预期，质量卓越",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/20",
  },
  {
    level: 4,
    label: "良好",
    description: "达到预期，质量良好",
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/20",
  },
  {
    level: 3,
    label: "合格",
    description: "基本符合要求",
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/20",
  },
  {
    level: 2,
    label: "需改进",
    description: "存在明显不足",
    color: "text-orange-400",
    bgColor: "bg-orange-500/20",
  },
  {
    level: 1,
    label: "不合格",
    description: "不符合要求",
    color: "text-red-400",
    bgColor: "bg-red-500/20",
  },
];

/** 审核对象类型配置映射 */
const TARGET_TYPE_CONFIGS: Record<ReviewTargetType, { label: string; color: string; bgColor: string }> = {
  storyboard: {
    label: "分镜",
    color: "text-purple-400",
    bgColor: "bg-purple-500/20",
  },
  asset: {
    label: "资产",
    color: "text-amber-400",
    bgColor: "bg-amber-500/20",
  },
  script: {
    label: "剧本",
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/20",
  },
};

/**
 * 星级评分组件
 */
function StarRating({
  value,
  onChange,
  disabled = false,
  size = "md",
}: {
  /** 当前评分值 */
  value: number;
  /** 评分变化回调 */
  onChange: (value: number) => void;
  /** 是否禁用 */
  disabled?: boolean;
  /** 尺寸 */
  size?: "sm" | "md" | "lg";
}) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6",
  };

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => !disabled && onChange(star)}
          disabled={disabled}
          className="transition-transform hover:scale-110 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={`${star}星评分`}
        >
          <Star
            className={`${sizeClasses[size]} ${
              star <= value
                ? "fill-yellow-400 text-yellow-400"
                : "fill-transparent text-gray-600 hover:text-yellow-400/50"
            } transition-colors`}
          />
        </button>
      ))}
    </div>
  );
}

/**
 * 获取评分等级配置
 */
function getScoreLevelConfig(score: number): ScoreLevelConfig | undefined {
  if (score >= 4.5) return SCORE_LEVELS.find((l) => l.level === 5);
  if (score >= 3.5) return SCORE_LEVELS.find((l) => l.level === 4);
  if (score >= 2.5) return SCORE_LEVELS.find((l) => l.level === 3);
  if (score >= 1.5) return SCORE_LEVELS.find((l) => l.level === 2);
  return SCORE_LEVELS.find((l) => l.level === 1);
}

export function ReviewScoreCard({
  reviewId,
  targetName,
  targetType,
  onScore,
  defaultScores,
  loading = false,
  disabled = false,
}: ReviewScoreCardProps) {
  // 各维度评分状态
  const [scores, setScores] = useState<Omit<ScoreData, "overallScore" | "comment">>({
    contentQuality: defaultScores?.contentQuality || 0,
    requirementMatch: defaultScores?.requirementMatch || 0,
    creativity: defaultScores?.creativity || 0,
    technicalQuality: defaultScores?.technicalQuality || 0,
  });

  // 评语状态
  const [comment, setComment] = useState<string>(defaultScores?.comment || "");

  // 提交中状态
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 审核对象类型配置
  const targetTypeConfig = TARGET_TYPE_CONFIGS[targetType];

  /**
   * 计算综合评分（加权平均）
   */
  const overallScore = useMemo(() => {
    // 如果所有维度都是0，返回0
    if (Object.values(scores).every((score) => score === 0)) {
      return 0;
    }

    // 计算加权总分
    const weightedSum = SCORE_DIMENSIONS.reduce((sum, dimension) => {
      return sum + scores[dimension.key] * dimension.weight;
    }, 0);

    // 计算实际使用的权重总和（排除评分为0的维度）
    const usedWeights = SCORE_DIMENSIONS.reduce((sum, dimension) => {
      return scores[dimension.key] > 0 ? sum + dimension.weight : sum;
    }, 0);

    // 如果没有评分，返回0
    if (usedWeights === 0) return 0;

    // 计算加权平均，保留一位小数
    return Number((weightedSum / usedWeights).toFixed(1));
  }, [scores]);

  /**
   * 更新单个维度评分
   */
  const updateScore = useCallback((key: keyof typeof scores, value: number) => {
    setScores((prev) => ({ ...prev, [key]: value }));
  }, []);

  /**
   * 处理提交评分
   */
  const handleSubmit = async () => {
    // 验证是否所有维度都已评分
    const allScored = Object.values(scores).every((score) => score > 0);
    if (!allScored) {
      alert("请为所有维度评分");
      return;
    }

    setIsSubmitting(true);
    try {
      await onScore({
        ...scores,
        overallScore,
        comment: comment.trim() || undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * 获取综合评分等级配置
   */
  const overallLevelConfig = getScoreLevelConfig(overallScore);

  return (
    <div className="rounded-xl border border-white/10 bg-[#181818] p-6">
      {/* 标题区域 */}
      <div className="mb-6 flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-yellow-500/20 to-orange-500/20">
              <Star className="h-5 w-5 text-yellow-400 fill-yellow-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">审核质量评分</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-sm ${targetTypeConfig.color}`}>
                  {targetTypeConfig.label}
                </span>
                <span className="text-xs text-[#666]">·</span>
                <span className="text-sm text-[#888]">{targetName}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 综合评分展示 */}
      <div className="mb-6 rounded-lg border border-white/10 bg-gradient-to-br from-yellow-500/10 to-orange-500/5 p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-[#888] mb-1">综合评分</div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-white">{overallScore.toFixed(1)}</span>
              <span className="text-lg text-[#666]">/ 5.0</span>
            </div>
            {overallLevelConfig && overallScore > 0 && (
              <div className="flex items-center gap-2 mt-2">
                <span className={`text-sm font-medium ${overallLevelConfig.color}`}>
                  {overallLevelConfig.label}
                </span>
                <span className="text-xs text-[#666]">{overallLevelConfig.description}</span>
              </div>
            )}
          </div>
          <div className="text-right">
            <StarRating value={Math.round(overallScore)} onChange={() => {}} disabled size="lg" />
            <div className="text-xs text-[#666] mt-2">
              {Object.values(scores).filter((s) => s > 0).length} / 4 维度已评分
            </div>
          </div>
        </div>
      </div>

      {/* 评分维度列表 */}
      <div className="space-y-4 mb-6">
        {SCORE_DIMENSIONS.map((dimension) => {
          const Icon = dimension.icon;
          const currentScore = scores[dimension.key];
          const levelConfig = getScoreLevelConfig(currentScore);

          return (
            <div
              key={dimension.key}
              className="rounded-lg border border-white/10 bg-white/[0.02] p-4 transition-all hover:border-white/20"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5">
                    <Icon className="h-5 w-5 text-[#888]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">{dimension.label}</span>
                      <span className="text-xs text-[#666]">权重 {dimension.weight}%</span>
                    </div>
                    <p className="text-xs text-[#888] mt-0.5">{dimension.description}</p>
                  </div>
                </div>
                {currentScore > 0 && levelConfig && (
                  <div className={`px-2 py-1 rounded text-xs font-medium ${levelConfig.bgColor} ${levelConfig.color}`}>
                    {currentScore}星 - {levelConfig.label}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-4">
                <StarRating
                  value={currentScore}
                  onChange={(value) => updateScore(dimension.key, value)}
                  disabled={disabled || loading}
                  size="md"
                />
                <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-yellow-500 to-orange-500 transition-all duration-300"
                    style={{ width: `${(currentScore / 5) * 100}%` }}
                  />
                </div>
                <span className="text-sm text-[#888] w-8 text-right">{currentScore}/5</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 评分标准说明 */}
      <div className="mb-6 rounded-lg border border-white/10 bg-white/[0.02] p-4">
        <div className="flex items-center gap-2 mb-3">
          <Award className="h-4 w-4 text-[#888]" />
          <span className="text-xs font-semibold text-[#888]">评分标准</span>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {SCORE_LEVELS.map((level) => (
            <div
              key={level.level}
              className={`text-center p-2 rounded-lg ${level.bgColor} transition-all`}
            >
              <div className={`text-sm font-bold ${level.color}`}>{level.level}星</div>
              <div className="text-xs text-[#888] mt-0.5">{level.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 评语输入 */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <MessageSquare className="h-4 w-4 text-[#888]" />
          <label className="text-xs font-semibold text-[#888]">评语（可选）</label>
        </div>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="请输入审核评语，说明评分理由..."
          disabled={disabled || loading}
          rows={4}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-[#666] focus:border-purple-500/50 focus:outline-none focus:ring-1 focus:ring-purple-500/50 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
        />
        <div className="text-xs text-[#666] mt-1 text-right">{comment.length} / 500 字</div>
      </div>

      {/* 提交按钮 */}
      <div className="flex items-center justify-end gap-3">
        <div className="text-xs text-[#666] mr-auto">
          审核ID: <span className="font-mono text-[#888]">{reviewId}</span>
        </div>
        <button
          onClick={handleSubmit}
          disabled={disabled || loading || isSubmitting || Object.values(scores).some((s) => s === 0)}
          className="flex items-center gap-2 rounded-lg border border-yellow-500/30 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 px-6 py-2.5 text-sm font-medium text-yellow-400 transition-all hover:from-yellow-500/20 hover:to-orange-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Star className="h-4 w-4" />
          {isSubmitting ? "提交中..." : "提交评分"}
        </button>
      </div>

      {/* 加载状态遮罩 */}
      {loading && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-xl">
          <div className="flex items-center gap-2 text-white">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            <span>加载中...</span>
          </div>
        </div>
      )}
    </div>
  );
}