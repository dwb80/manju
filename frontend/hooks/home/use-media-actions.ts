"use client";

import { useCallback } from "react";
import { api, apiUrl } from "@/lib/api-client";

export function useMediaActions({ showNotice }: { showNotice: (message: string) => void }) {
  /** 复制文本到剪贴板，失败时退回到传统 textarea 复制方式。 */
  const copy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        showNotice("链接已复制");
      } catch {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        const ok = document.execCommand("copy");
        textarea.remove();
        showNotice(ok ? "链接已复制" : "复制失败，请手动复制");
      }
    },
    [showNotice]
  );

  /** 在新标签页打开原始媒体地址。 */
  const openRawMedia = useCallback((url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  }, []);

  /** 在新标签页打开图片详情页。 */
  const openImageDetail = useCallback((taskId: string, index: number) => {
    window.open(`/images/${taskId}?index=${index}`, "_blank");
  }, []);

  /** 下载图片或视频，跨域失败时退回到打开原链接。 */
  const downloadMedia = useCallback(
    async (url: string, filename: string) => {
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(objectUrl);
        showNotice("已开始下载");
      } catch {
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        link.target = "_blank";
        document.body.appendChild(link);
        link.click();
        link.remove();
        showNotice("已打开下载链接");
      }
    },
    [showNotice]
  );

  return { copy, openRawMedia, openImageDetail, downloadMedia };
}
