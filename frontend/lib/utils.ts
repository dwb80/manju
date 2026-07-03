import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** 合并 Tailwind className，并自动处理冲突的样式类。 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
