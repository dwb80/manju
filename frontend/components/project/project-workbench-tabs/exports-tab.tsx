"use client";

/**
 * 剧本工作台：交付中心（exports）tab
 *
 * 集中导出剧本文档、分镜表、剪辑清单和项目素材清单。
 */

import { Download, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Project } from "@/lib/app-types";
import type { ProjectWorkbenchTabsProps } from "./types";

export interface ExportsTabProps extends Pick<
  ProjectWorkbenchTabsProps,
  "selectedProject" | "projectScripts" | "projectStoryboards" | "projectClips" | "projectAssets" |
  "downloadProjectExport" | "downloadStoryboardCsv" | "generateProjectPackageIndex" | "openProjectFolder" | "refreshProjectWorkbench"
> {}

export function ExportsTab(props: ExportsTabProps) {
  const { selectedProject, projectScripts, projectStoryboards, projectClips, projectAssets, downloadProjectExport, downloadStoryboardCsv, generateProjectPackageIndex, openProjectFolder, refreshProjectWorkbench } = props;

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-white/10 bg-[#202020] p-3">
        <div className="text-sm font-semibold">交付中心</div>
        <div className="mt-1 text-xs text-[#b4b4b4]">集中导出剧本文档、分镜表、剪辑清单和项目素材清单。</div>
      </div>
      <div className="grid grid-cols-4 gap-2 text-sm max-lg:grid-cols-2 max-md:grid-cols-1">
        {[
          ["剧本", projectScripts.length],
          ["分镜", projectStoryboards.length],
          ["剪辑", projectClips.length],
          ["资产", projectAssets.length],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-white/10 bg-[#202020] px-3 py-2">
            <div className="text-xs text-[#b4b4b4]">{label}</div>
            <div className="mt-1 text-lg font-semibold">{value}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
        <button className="rounded-lg border border-white/10 bg-[#202020] p-4 text-left hover:bg-white/5" onClick={() => downloadProjectExport("scripts.txt")}>
          <div className="flex items-center gap-2 text-sm font-semibold"><Download className="h-4 w-4" />剧本文档 TXT</div>
          <div className="mt-1 text-xs text-[#b4b4b4]">按集数合并导出已保存剧本。</div>
        </button>
        <button className="rounded-lg border border-white/10 bg-[#202020] p-4 text-left hover:bg-white/5" onClick={downloadStoryboardCsv}>
          <div className="flex items-center gap-2 text-sm font-semibold"><Download className="h-4 w-4" />分镜表 CSV</div>
          <div className="mt-1 text-xs text-[#b4b4b4]">导出全部分镜到 Excel / Numbers。</div>
        </button>
        <button className="rounded-lg border border-white/10 bg-[#202020] p-4 text-left hover:bg-white/5" onClick={() => downloadProjectExport("edit-list.csv")}>
          <div className="flex items-center gap-2 text-sm font-semibold"><Download className="h-4 w-4" />剪辑清单 CSV</div>
          <div className="mt-1 text-xs text-[#b4b4b4]">导出分镜-视频-剪辑的入点出点表。</div>
        </button>
        <button className="rounded-lg border border-white/10 bg-[#202020] p-4 text-left hover:bg-white/5" onClick={() => downloadProjectExport("manifest.json")}>
          <div className="flex items-center gap-2 text-sm font-semibold"><Download className="h-4 w-4" />素材清单 JSON</div>
          <div className="mt-1 text-xs text-[#b4b4b4]">用于跨平台同步的完整 manifest。</div>
        </button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-[#202020] p-3">
        <div className="text-xs text-[#b4b4b4]">辅助操作</div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => void generateProjectPackageIndex()}>
            生成项目包索引
          </Button>
          <Button size="sm" variant="secondary" onClick={() => selectedProject && void openProjectFolder(selectedProject)} disabled={!selectedProject}>
            <FolderOpen className="h-4 w-4" />打开项目目录
          </Button>
          <Button size="sm" variant="secondary" onClick={() => void refreshProjectWorkbench()}>
            刷新工作台
          </Button>
        </div>
      </div>
    </div>
  );
}

// Project 类型通过参数 props 间接使用，避免未使用警告
void ({} as Project);
