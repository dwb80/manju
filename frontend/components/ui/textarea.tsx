import * as React from "react";
import { cn } from "@/lib/utils";

/** 统一多行文本输入框样式的基础组件。 */
export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn("min-h-28 w-full resize-y rounded-md border border-border bg-muted px-3 py-2 text-sm outline-none focus:border-primary", className)}
      {...props}
    />
  );
}
