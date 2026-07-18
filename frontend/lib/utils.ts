/**
 * @file utils.ts
 * @description 通用工具函数，提供 className 合并、防抖等基础能力
 */

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * cn - 合并 Tailwind className，并自动处理冲突的样式类
 * @param {...ClassValue[]} inputs - 样式类名列表
 * @returns {string} 合并后的类名字符串
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 函数防抖：在 wait 毫秒内连续调用只会执行最后一次。
 *
 * @param fn - 待防抖的函数
 * @param wait - 等待毫秒数
 * @returns 防抖处理后的函数（带 cancel 方法）
 */
export function debounce<T extends (...args: any[]) => any>(fn: T, wait: number) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const wrapped = ((...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, wait);
  }) as T & { cancel: () => void };
  wrapped.cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };
  return wrapped;
}
