import * as React from "react";
import { cn } from "@/lib/utils";

/** 统一多行文本输入框样式的基础组件。 */
export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      // 尺寸：最小 96px（≈ 4 行）、最大 192px（≈ 8 行），仅允许垂直方向 resize
      "flex min-h-[96px] max-h-[192px] w-full rounded-md border border-input bg-muted px-3 py-2.5 text-sm text-foreground ring-offset-background transition-colors",
      "placeholder:text-muted-foreground/70",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40 focus-visible:border-sky-400",
      "disabled:cursor-not-allowed disabled:opacity-50",
      // 浏览器原生 resize 控制：仅垂直方向
      "resize-y",
      className
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
