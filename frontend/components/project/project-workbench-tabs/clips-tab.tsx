"use client";

/**
 * 剧本工作台：剪辑清单（clips）tab
 *
 * 同步分镜视频 / 维护片段名/视频地址/入点/出点/顺序/剪辑备注。
 */

import { Check, Download, ExternalLink, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShadcnSelect } from "@/components/ui/select";
import { EmptyClips } from "@/components/shared";
import type { ProjectClipStatus } from "@/lib/app-types";
import type { ProjectWorkbenchTabsProps } from "./types";

export function ClipsTab(props: Pick<
  ProjectWorkbenchTabsProps,
  "currentWorkbenchPageNumber" | "workbenchPageSize" | "projectClips" | "filteredProjectClips" | "pagedProjectClips" |
  "editingClipId" | "clipDraft" | "setClipDraft" | "submitProjectClipForm" | "resetProjectClipForm" | "editProjectClipItem" | "deleteProjectClipItem" |
  "clipStatuses" | "clipStatusText" | "syncProjectClips" | "downloadProjectExport"
>) {
  const {
    currentWorkbenchPageNumber, workbenchPageSize, projectClips, filteredProjectClips, pagedProjectClips,
    editingClipId, clipDraft, setClipDraft, submitProjectClipForm, resetProjectClipForm, editProjectClipItem, deleteProjectClipItem,
    clipStatuses, clipStatusText, syncProjectClips, downloadProjectExport,
  } = props;

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-white/10 bg-[#202020] p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">剪辑清单</div>
            <div className="text-xs text-[#b4b4b4]">从已出视频的分镜同步片段，再维护入点、出点、顺序和剪辑备注。</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => void syncProjectClips()}><RefreshCw className="h-4 w-4" />同步分镜视频</Button>
            <Button size="sm" variant="secondary" onClick={() => downloadProjectExport("edit-list.csv")}><Download className="h-4 w-4" />导出剪辑清单</Button>
          </div>
        </div>
      </div>
      <div className="rounded-lg border border-white/10 bg-[#202020] p-3">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">{editingClipId ? "编辑剪辑条目" : "新增剪辑条目"}</div>
            <div className="text-xs text-[#b4b4b4]">用表单维护片段名、视频地址、入点、出点和剪辑备注。</div>
          </div>
          {editingClipId && <Button size="sm" variant="secondary" onClick={resetProjectClipForm}>取消编辑</Button>}
        </div>
        <div className="grid grid-cols-6 gap-2 max-lg:grid-cols-2 max-md:grid-cols-1">
          <input className="h-9 rounded-lg border border-white/10 bg-[#2f2f2f] px-3 text-xs text-white outline-none focus:border-emerald-500" type="number" min={1} value={clipDraft.episode ?? 1} placeholder="集数" onChange={(event) => setClipDraft((draft) => ({ ...draft, episode: Number(event.target.value) }))} />
          <input className="h-9 rounded-lg border border-white/10 bg-[#2f2f2f] px-3 text-xs text-white outline-none focus:border-emerald-500" value={clipDraft.scene ?? ""} placeholder="场次" onChange={(event) => setClipDraft((draft) => ({ ...draft, scene: event.target.value }))} />
          <input className="h-9 rounded-lg border border-white/10 bg-[#2f2f2f] px-3 text-xs text-white outline-none focus:border-emerald-500" value={clipDraft.shot ?? ""} placeholder="镜号" onChange={(event) => setClipDraft((draft) => ({ ...draft, shot: event.target.value }))} />
          <ShadcnSelect
            options={clipStatuses.map((s) => ({ value: s.key, label: s.label }))}
            value={clipDraft.status ?? "todo"}
            onChange={(value) => setClipDraft((draft) => ({ ...draft, status: value as ProjectClipStatus }))}
            className="h-9 text-xs"
          />
          <input className="h-9 rounded-lg border border-white/10 bg-[#2f2f2f] px-3 text-xs text-white outline-none focus:border-emerald-500" value={clipDraft.title ?? ""} placeholder="片段名" onChange={(event) => setClipDraft((draft) => ({ ...draft, title: event.target.value }))} />
          <input className="h-9 rounded-lg border border-white/10 bg-[#2f2f2f] px-3 text-xs text-white outline-none focus:border-emerald-500" type="number" min={1} value={clipDraft.duration ?? 5} placeholder="时长" onChange={(event) => setClipDraft((draft) => ({ ...draft, duration: Number(event.target.value) }))} />
        </div>
        <div className="mt-2 grid grid-cols-4 gap-2 max-lg:grid-cols-2 max-md:grid-cols-1">
          <input className="h-9 rounded-lg border border-white/10 bg-[#2f2f2f] px-3 text-xs text-white outline-none focus:border-emerald-500" value={clipDraft.source_video_url ?? ""} placeholder="视频文件地址" onChange={(event) => setClipDraft((draft) => ({ ...draft, source_video_url: event.target.value }))} />
          <input className="h-9 rounded-lg border border-white/10 bg-[#2f2f2f] px-3 text-xs text-white outline-none focus:border-emerald-500" value={clipDraft.in_point ?? ""} placeholder="入点 00:00:00" onChange={(event) => setClipDraft((draft) => ({ ...draft, in_point: event.target.value }))} />
          <input className="h-9 rounded-lg border border-white/10 bg-[#2f2f2f] px-3 text-xs text-white outline-none focus:border-emerald-500" value={clipDraft.out_point ?? ""} placeholder="出点 00:00:05" onChange={(event) => setClipDraft((draft) => ({ ...draft, out_point: event.target.value }))} />
          <input className="h-9 rounded-lg border border-white/10 bg-[#2f2f2f] px-3 text-xs text-white outline-none focus:border-emerald-500" type="number" min={0} value={clipDraft.order_index ?? 0} placeholder="顺序" onChange={(event) => setClipDraft((draft) => ({ ...draft, order_index: Number(event.target.value) }))} />
        </div>
        <textarea className="mt-2 min-h-14 w-full resize-none rounded-lg border border-white/10 bg-[#2f2f2f] px-3 py-2 text-xs text-white outline-none focus:border-emerald-500" value={clipDraft.notes ?? ""} placeholder="剪辑备注、音效、字幕、转场要求" onChange={(event) => setClipDraft((draft) => ({ ...draft, notes: event.target.value }))} />
        <div className="mt-3 flex justify-end">
          <Button size="sm" onClick={() => void submitProjectClipForm()}>
            {editingClipId ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {editingClipId ? "保存剪辑条目" : "添加剪辑条目"}
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        {filteredProjectClips.length === 0 ? (
          projectClips.length === 0 ? (
            <EmptyClips onSyncClips={() => void syncProjectClips()} />
          ) : (
            <div className="px-5 py-10 text-center">
              <div className="text-base font-semibold text-white">没有匹配的剪辑条目</div>
              <div className="mt-2 text-sm text-[#bdbdbd]">调整搜索或状态筛选后再试。</div>
            </div>
          )
        ) : (
          pagedProjectClips.map((clip, index) => (
            <div key={clip.id} className="rounded-lg border border-white/10 bg-[#202020] p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#b4b4b4]">
                    <span className="rounded-md bg-white/10 px-2 py-1">#{(Math.max(currentWorkbenchPageNumber, 1) - 1) * workbenchPageSize + index + 1}</span>
                    <span className="rounded-md bg-white/10 px-2 py-1">第{clip.episode}集</span>
                    <span className="rounded-md bg-white/10 px-2 py-1">{clip.scene}-{clip.shot}</span>
                    <span className="rounded-md bg-white/10 px-2 py-1">{clipStatusText(clip.status)}</span>
                  </div>
                  <div className="mt-2 font-medium text-white">{clip.title}</div>
                  <div className="mt-1 text-xs text-[#d0d0d0]">{clip.source_video_url || "未绑定视频文件"}</div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-[#d8d8d8]">
                    {clip.in_point && <span className="rounded-md bg-white/10 px-2 py-1">入点：{clip.in_point}</span>}
                    {clip.out_point && <span className="rounded-md bg-white/10 px-2 py-1">出点：{clip.out_point}</span>}
                    <span className="rounded-md bg-white/10 px-2 py-1">时长：{clip.duration}s</span>
                    <span className="rounded-md bg-white/10 px-2 py-1">顺序：{clip.order_index}</span>
                  </div>
                  {clip.notes && <div className="mt-2 whitespace-pre-wrap text-xs text-[#d8d8d8]">{clip.notes}</div>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {clip.source_video_url && <Button size="sm" variant="secondary" onClick={() => window.open(clip.source_video_url, "_blank", "noopener,noreferrer")}><ExternalLink className="h-4 w-4" />打开视频</Button>}
                  <Button size="sm" variant="secondary" onClick={() => editProjectClipItem(clip)}><Pencil className="h-4 w-4" />编辑</Button>
                  <Button size="sm" variant="destructive" onClick={() => void deleteProjectClipItem(clip)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
