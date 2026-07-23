import * as React from "react"; import { ChevronRight } from "lucide-react"; import { cn } from "@/lib/utils";
export const Breadcrumb = React.forwardRef<HTMLElement, React.ComponentPropsWithoutRef<"nav">>((props, ref) => <nav ref={ref} aria-label="breadcrumb" {...props} />);
export const BreadcrumbList = React.forwardRef<HTMLOListElement, React.ComponentPropsWithoutRef<"ol">>(({ className, ...props }, ref) => <ol ref={ref} className={cn("flex flex-wrap items-center gap-1.5 text-sm text-neutral-400", className)} {...props} />);
export const BreadcrumbItem = React.forwardRef<HTMLLIElement, React.ComponentPropsWithoutRef<"li">>(({ className, ...props }, ref) => <li ref={ref} className={cn("inline-flex items-center gap-1.5", className)} {...props} />);
export const BreadcrumbLink = React.forwardRef<HTMLAnchorElement, React.ComponentPropsWithoutRef<"a">>(({ className, ...props }, ref) => <a ref={ref} className={cn("hover:text-white", className)} {...props} />);
export const BreadcrumbPage = React.forwardRef<HTMLSpanElement, React.ComponentPropsWithoutRef<"span">>(({ className, ...props }, ref) => <span ref={ref} aria-current="page" className={cn("text-white", className)} {...props} />);
export const BreadcrumbSeparator = ({ children, ...props }: React.ComponentProps<"li">) => <li role="presentation" {...props}>{children ?? <ChevronRight className="h-3.5 w-3.5" />}</li>;
export const BreadcrumbEllipsis = () => <span>…</span>;
