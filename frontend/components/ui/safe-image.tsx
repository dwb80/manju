"use client";

/**
 * @file safe-image.tsx
 * @description 容错图片组件：统一处理加载失败、加载中、空 src 的展示。
 *
 * 设计目标：
 * - 替代散落在业务组件中的 `<img onError=… style="display:none">` 模式
 * - 失败后展示占位符（图标 / 文字），避免页面出现空块或破损图标
 * - 与主题系统兼容（暗色 / 浅色都可见）
 * - 可关闭的 lazy 与 decoding 行为，调用方零成本接入
 */

import * as React from "react";
import { ImageOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type SafeImageFit = "cover" | "contain" | "fill" | "none" | "scale-down";

export interface SafeImageProps
  extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "onLoad" | "onError" | "alt" | "src"> {
  /** 图片地址。空值（null / undefined / 空串）会直接展示占位符。 */
  src?: string | null;
  /** 占位符 alt 文本，同时也是无障碍标签的来源。 */
  alt: string;
  /** 占位符图标，默认为 ImageOff。传 false 可隐藏图标。 */
  fallbackIcon?: React.ComponentType<{ className?: string }> | false;
  /** 自定义占位符文本，默认 "暂无图片"。 */
  fallbackLabel?: string;
  /** 占位符底色，覆盖默认主题色（用于与父容器同色）。 */
  fallbackClassName?: string;
  /** 加载中是否显示 spinner。默认 true。 */
  showLoader?: boolean;
}

/**
 * SafeImage - 容错图片组件
 *
 * 用法：
 * ```tsx
 * <SafeImage src={row.thumbnail} alt={row.name} className="h-32 w-full" />
 * ```
 */
export const SafeImage = React.forwardRef<HTMLDivElement, SafeImageProps>(function SafeImage(
  {
    src,
    alt,
    className,
    fallbackIcon: FallbackIcon = ImageOff,
    fallbackLabel = "暂无图片",
    fallbackClassName,
    showLoader = true,
    loading = "lazy",
    decoding = "async",
    ...imgProps
  },
  ref,
) {
  const hasSrc = typeof src === "string" && src.trim().length > 0;
  const [errored, setErrored] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);

  // src 改变时重置状态
  React.useEffect(() => {
    setErrored(false);
    setLoaded(false);
  }, [src]);

  const shouldShowPlaceholder = !hasSrc || errored;

  return (
    <div
      ref={ref}
      className={cn(
        "relative isolate overflow-hidden bg-muted/40 text-muted-foreground",
        className,
      )}
      role={shouldShowPlaceholder ? "img" : undefined}
      aria-label={shouldShowPlaceholder ? alt : undefined}
    >
      {hasSrc && !errored ? (
        <img
          src={src}
          alt={alt}
          loading={loading}
          decoding={decoding}
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
          className={cn(
            "h-full w-full transition-opacity duration-200",
            loaded ? "opacity-100" : "opacity-0",
          )}
          {...imgProps}
        />
      ) : null}

      {hasSrc && !errored && !loaded && showLoader ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" />
        </div>
      ) : null}

      {shouldShowPlaceholder ? (
        <div
          className={cn(
            "absolute inset-0 flex flex-col items-center justify-center gap-1 bg-muted/60 text-muted-foreground",
            fallbackClassName,
          )}
          aria-hidden={hasSrc ? "true" : undefined}
        >
          {FallbackIcon !== false ? (
            <FallbackIcon className="h-6 w-6" aria-hidden="true" />
          ) : null}
          <span className="px-2 text-center text-[11px] leading-tight">{fallbackLabel}</span>
        </div>
      ) : null}
    </div>
  );
});
