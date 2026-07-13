"use client";

import { useState, useEffect } from "react";
import { Loader2, X } from "lucide-react";

/**
 * 带 loading + error 状态的缩略图组件。
 */
export function ThumbnailImage({ url, alt }: { url: string; alt: string }) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");
  useEffect(() => {
    setStatus("loading");
  }, [url]);
  if (status === "error") {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center bg-[#2a1a1a] text-red-300">
        <X className="h-4 w-4" />
        <span className="mt-1 text-[9px]">加载失败</span>
      </div>
    );
  }
  return (
    <>
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#1a1a1a]">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-500" />
        </div>
      )}
      <img
        src={url}
        alt={alt}
        className="h-full w-full object-cover"
        onLoad={() => setStatus("loaded")}
        onError={() => setStatus("error")}
      />
    </>
  );
}

/**
 * 计数高亮：数字变化时用 key 强制 remount，触发一次脉冲动画。
 */
export function CountHighlight({ value, max }: { value: number; max: number }) {
  return (
    <span
      key={value}
      className="inline-block animate-in fade-in slide-in-from-right-1 zoom-in-110 duration-300"
    >
      {value}/{max}
    </span>
  );
}
