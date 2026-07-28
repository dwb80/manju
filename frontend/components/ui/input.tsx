import * as React from "react";
import { cn } from "@/lib/utils";

/** 统一输入框样式的基础组件。 */
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-muted px-3 py-2 text-sm text-foreground ring-offset-background transition-colors",
        "file:border-0 file:bg-transparent file:text-sm file:font-medium",
        // 占位符对比度提升：/70（深色主题下仍清晰可读，但不抢主）
        "placeholder:text-muted-foreground/70",
        // 聚焦色与必填绿色解耦：ring（蓝色）作为通用焦点指示
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
        // 错误态（aria-invalid）：红色 border + ring
        "aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-destructive/20",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";
