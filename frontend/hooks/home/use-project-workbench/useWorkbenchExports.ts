"use client";

/**
 * 工作台：导出
 *
 * 触发后端生成 PDF / Excel / Markdown 等文件下载。
 */

import { useCallback } from "react";
import { api } from "@/lib/api-client";
import type { Project } from "@/lib/app-types";

export type ExportFormat = "pdf" | "excel" | "markdown" | "csv" | "json";

const FORMAT_LABEL: Record<ExportFormat, string> = {
  pdf: "PDF 报告",
  excel: "Excel 表格",
  markdown: "Markdown 文档",
  csv: "CSV 数据",
  json: "JSON 数据",
};

export function useExportProject({
  showNotice,
}: {
  showNotice: (message: string) => void;
}) {
  return useCallback(async (selectedProject: Project | undefined, format: ExportFormat) => {
    if (!selectedProject) {
      showNotice("请先选择项目");
      return;
    }
    try {
      showNotice(`正在导出${FORMAT_LABEL[format]}...`);
      const result = await api<{ url: string; file_name?: string }>(`/api/projects/${selectedProject.id}/export`, { method: "POST", body: JSON.stringify({ format }) });
      showNotice("导出完成，下载已开始");
      if (typeof window !== "undefined" && result?.url) {
        const link = document.createElement("a");
        link.href = result.url;
        link.download = result.file_name ?? `${selectedProject.name}.${format}`;
        link.click();
      }
      return result;
    } catch (error) {
      showNotice((error as Error).message || "导出失败");
    }
  }, [showNotice]);
}
