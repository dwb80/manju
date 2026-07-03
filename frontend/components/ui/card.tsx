import * as React from "react";
import { cn } from "@/lib/utils";

/** 用于包裹详情、列表项和操作区的基础卡片组件。 */
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-md border border-border bg-card text-card-foreground", className)} {...props} />;
}
