"use client";
import * as React from "react"; import * as Primitive from "@radix-ui/react-popover"; import { cn } from "@/lib/utils";
export const Popover = Primitive.Root, PopoverTrigger = Primitive.Trigger;
export const PopoverContent = React.forwardRef<React.ElementRef<typeof Primitive.Content>, React.ComponentPropsWithoutRef<typeof Primitive.Content>>(({ className, align = "center", sideOffset = 4, ...props }, ref) => <Primitive.Portal><Primitive.Content ref={ref} align={align} sideOffset={sideOffset} className={cn("z-50 rounded-md border border-white/10 bg-neutral-900 p-4 text-white shadow-xl", className)} {...props} /></Primitive.Portal>);
