"use client";

/**
 * @file tooltip.tsx
 * @description Tooltip 组件占位（V2 W4 — 仅满足 build 依赖）
 *
 * 历史：原 V1 Tooltip（基于 shadcn/ui）依赖 @radix-ui/react-tooltip，
 * Stream C 重构期间未补齐，导致 layout-shell 无法 import TooltipProvider。
 * 本占位提供最小可用 API：TooltipProvider / Tooltip / TooltipTrigger / TooltipContent，
 * 不实现实际的 hover/focus 显示行为，仅渲染 children 占位。
 */

import { ReactElement, ReactNode } from "react";

interface TooltipProviderProps {
  children: ReactNode;
  delayDuration?: number;
  skipDelayDuration?: number;
}

export function TooltipProvider({ children }: TooltipProviderProps) {
  return <>{children}</>;
}

interface TooltipProps {
  children: ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  delayDuration?: number;
}

export function Tooltip({ children }: TooltipProps) {
  return <>{children}</>;
}

interface TooltipTriggerProps {
  children: ReactElement;
  asChild?: boolean;
}

export function TooltipTrigger({ children }: TooltipTriggerProps) {
  return children;
}

interface TooltipContentProps {
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  className?: string;
}

export function TooltipContent({ children }: TooltipContentProps) {
  return <span style={{ display: "none" }}>{children}</span>;
}

export default TooltipProvider;
