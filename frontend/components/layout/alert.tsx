"use client";

/**
 * Alert —— 统一提示条组件（C3 公共组件）
 *
 * 设计动机（评审 P0-修复 C3）：
 * - 此前各页面的"错误提示/警告提示"样式各自写一遍（border/bg/text 三件套）
 * - 抽到本组件后，仅需指定 tone 与内容
 *
 * 设计原则：
 * - 单一职责：仅负责"提示条"的展示
 * - 可配置：4 种 tone（error/warn/info/success），可关闭、含操作按钮
 * - 可访问：role="alert" 与 aria-live，确保屏幕阅读器朗读
 * - 与 notify 工具的差异：notify 是瞬时浮层；Alert 是内嵌式提示条
 *
 * 使用示例：
 *   {error && <Alert tone="error">{error}</Alert>}
 *   <Alert tone="warn" onClose={() => setShowWarn(false)}>操作不可撤销</Alert>
 *   <Alert tone="info" action={<button>查看</button>}>已成功保存 3 个剧本</Alert>
 */

import { ReactNode } from "react";
import { AlertCircle, AlertTriangle, Info, CheckCircle2, X } from "lucide-react";

/** 提示条类型 */
export type AlertTone = "error" | "warn" | "info" | "success";

export interface AlertProps {
  /** 提示内容 */
  children: ReactNode;
  /** 类型（控制颜色与图标） */
  tone?: AlertTone;
  /** 是否可关闭（显示关闭按钮） */
  onClose?: () => void;
  /** 标题（可选，如"保存失败"） */
  title?: string;
  /** 自定义图标（不传则用 tone 默认） */
  icon?: ReactNode;
  /** 自定义 className */
  className?: string;
  /** 右侧操作按钮（可选） */
  action?: ReactNode;
}

// === Tone 样式映射（与 StatsOverview 风格一致） ===
const TONE_CLASS: Record<AlertTone, {
  border: string;
  bg: string;
  text: string;
  iconText: string;
  defaultIcon: ReactNode;
  ariaRole: "alert" | "status";
}> = {
  error: {
    border: "border-red-500/20",
    bg: "bg-red-500/10",
    text: "text-red-400",
    iconText: "text-red-400",
    defaultIcon: <AlertCircle className="h-4 w-4" />,
    ariaRole: "alert",
  },
  warn: {
    border: "border-amber-500/20",
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    iconText: "text-amber-400",
    defaultIcon: <AlertTriangle className="h-4 w-4" />,
    ariaRole: "alert",
  },
  info: {
    border: "border-blue-500/20",
    bg: "bg-blue-500/10",
    text: "text-blue-400",
    iconText: "text-blue-400",
    defaultIcon: <Info className="h-4 w-4" />,
    ariaRole: "status",
  },
  success: {
    border: "border-emerald-500/20",
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    iconText: "text-emerald-400",
    defaultIcon: <CheckCircle2 className="h-4 w-4" />,
    ariaRole: "status",
  },
};

/**
 * Alert - 统一提示条组件
 * @param {AlertProps} props - 组件属性
 * @returns {JSX.Element} 渲染的提示条元素
 */
export function Alert({
  children,
  tone = "info",
  onClose,
  title,
  icon,
  className = "",
  action,
}: AlertProps) {
  const t = TONE_CLASS[tone]
  return (
    <div
      role={t.ariaRole}
      className={`flex items-start gap-3 rounded-lg border ${t.border} ${t.bg} px-4 py-2 ${className}`}
    >
      {/* 图标 */}
      <span className={`mt-0.5 ${t.iconText}`} aria-hidden="true">
        {icon ?? t.defaultIcon}
      </span>

      {/* 文本区 */}
      <div className="flex-1 min-w-0">
        {title && (
          <div className={`text-sm font-semibold ${t.text}`}>{title}</div>
        )}
        <div className={`text-sm ${t.text}`}>{children}</div>
      </div>

      {/* 右侧操作 */}
      {action && <div className="flex items-center">{action}</div>}

      {/* 关闭按钮 */}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className={`${t.text} hover:opacity-70 transition-opacity`}
          aria-label="关闭提示"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
