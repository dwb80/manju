"use client";
import type { ReactElement, ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip";
export function Tip({ label, children, side = "top", className }: { label: ReactNode; children: ReactElement; side?: "top" | "right" | "bottom" | "left"; className?: string }) { return <TooltipProvider><Tooltip><TooltipTrigger asChild>{children}</TooltipTrigger><TooltipContent side={side} className={className}>{label}</TooltipContent></Tooltip></TooltipProvider>; }
