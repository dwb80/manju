import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "secondary" | "ghost" | "destructive";
  size?: "default" | "icon" | "sm";
};

/** 统一按钮样式，支持默认、次级、幽灵和危险操作几种状态。 */
export function Button({ className, variant = "default", size = "default", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md border text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
        variant === "default" && "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
        variant === "secondary" && "border-border bg-muted text-foreground hover:border-primary",
        variant === "ghost" && "border-transparent bg-transparent hover:bg-muted",
        variant === "destructive" && "border-destructive bg-destructive text-white hover:bg-destructive/90",
        size === "default" && "h-10 px-4",
        size === "sm" && "h-8 px-3",
        size === "icon" && "h-9 w-9",
        className,
      )}
      {...props}
    />
  );
}
