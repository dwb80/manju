import { cva, type VariantProps } from "class-variance-authority";

export const buttonVariants = cva(
  // 基础样式：行内 flex、垂直水平居中、不换行、圆角、字号、字重、过渡、聚焦轮廓、禁用态
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        // 主操作：emerald 填充（高对比度，明确的"提交"语义）
        default: "bg-emerald-500 text-white hover:bg-emerald-400 shadow-sm",
        // 次操作：中性描边（不抢主操作视觉，hover 时填充淡白）
        secondary: "border border-white/15 bg-white/[0.04] text-foreground hover:bg-white/10 hover:border-white/25",
        // 幽灵：仅 hover 时有底色（用于工具栏图标按钮）
        ghost: "hover:bg-white/10 text-foreground",
        // 描边（保持兼容）：透明背景 + 边框
        outline: "border border-white/15 bg-transparent hover:bg-white/10",
        // 危险：红色填充
        destructive: "bg-red-500 text-white hover:bg-red-400 shadow-sm",
        // 链接样式
        link: "underline-offset-4 hover:underline text-emerald-400",
        // 兼容旧调用：原 "default" 改为白底黑字（避免破坏其他按钮）
        legacy: "bg-white text-black hover:bg-neutral-200",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3",
        lg: "h-11 px-6",
        icon: "h-9 w-9",
        /** 表单/弹窗主操作尺寸：36px 高度 + 更大内边距 */
        form: "h-9 px-4",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);
export type ButtonVariantsProps = VariantProps<typeof buttonVariants>;
