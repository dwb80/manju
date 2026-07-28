import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
const styles = { default: "bg-secondary text-secondary-foreground", secondary: "bg-muted text-muted-foreground", destructive: "bg-destructive/15 text-destructive", outline: "border border-border text-muted-foreground", success: "bg-success/15 text-success", warning: "bg-warning/15 text-warning", info: "bg-info/15 text-info", muted: "bg-muted/50 text-muted-foreground" };
export function Badge({ className, variant = "default", ...props }: HTMLAttributes<HTMLSpanElement> & { variant?: keyof typeof styles }) { return <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", styles[variant], className)} {...props} />; }
