import * as React from "react";
import { cn } from "@/lib/utils";

/** 统一输入框样式的基础组件。 */
export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn("h-10 w-full rounded-md border border-border bg-muted px-3 text-sm outline-none focus:border-primary", className)}
      {...props}
    />
  );
}
