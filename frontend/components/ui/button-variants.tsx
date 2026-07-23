import { cva, type VariantProps } from "class-variance-authority";

export const buttonVariants = cva("inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50", {
  variants: {
    variant: { default: "bg-white text-black hover:bg-neutral-200", destructive: "bg-red-600 text-white hover:bg-red-500", outline: "border border-white/15 bg-transparent hover:bg-white/10", secondary: "bg-white/10 text-white hover:bg-white/15", ghost: "hover:bg-white/10", link: "underline-offset-4 hover:underline" },
    size: { default: "h-10 px-4 py-2", sm: "h-9 px-3", lg: "h-11 px-8", icon: "h-10 w-10" },
  }, defaultVariants: { variant: "default", size: "default" },
});
export type ButtonVariantsProps = VariantProps<typeof buttonVariants>;
