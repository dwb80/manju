"use client";

import { Check, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ManagementTable as ProjectManagementTable } from "@/components/project/project-workbench";
import type { ProjectEpisode } from "@/lib/app-types";

interface EpisodesTabProps {
    projectEpisodes: ProjectEpisode[];
    filteredProjectEpisodes: ProjectEpisode[];
    pagedProjectEpisodes: ProjectEpisode[];
    episodeDraft: Partial<ProjectEpisode>;
    editingEpisodeId: string;
    resetProjectEpisodeForm: () => void;
    editProjectEpisodeItem: (episode: ProjectEpisode) => void;
    deleteProjectEpisodeItem: (episode: ProjectEpisode) => Promise<void>;
    submitProjectEpisodeForm: () => Promise<void>;
    setEpisodeDraft: (updater: (draft: Partial<ProjectEpisode>) => Partial<ProjectEpisode>) => void;
}

export function EpisodesTab(props: EpisodesTabProps) {
    return (
        <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-[#202020]">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
                    <div>
                        <div className="text-base font-semibold text-white">剧集规划</div>
                        <div className="mt-1 text-sm text-[#bdbdbd]">按集管理故事简介、制作阶段、截止日期和备注。</div>
                    </div>
                    <Button size="sm" variant="secondary" onClick={props.resetProjectEpisodeForm}><Plus className="h-4 w-4" />新增剧集</Button>
                </div>
                {props.filteredProjectEpisodes.length === 0 ? (
                    <div className="px-5 py-10 text-center">
                        <div className="text-base font-semibold text-white">{props.projectEpisodes.length === 0 ? "还没有剧集规划" : "没有匹配的剧集"}</div>
                        <div className="mt-2 text-sm text-[#bdbdbd]">{props.projectEpisodes.length === 0 ? "先在下方添加第 1 集，后续剧本、分镜和剪辑都可以绑定到剧集。" : "调整搜索、状态或负责人筛选后再试。"}</div>
                    </div>
                ) : (
                    <ProjectManagementTable columns={["集数", "标题", "阶段", "截止日期", "剧情简介", "备注", "操作"]}>
                        {props.pagedProjectEpisodes.map((episode) => (
                            <tr key={episode.id} className="align-top transition-colors hover:bg-white/[0.03]">
                                <td className="whitespace-nowrap px-4 py-4 font-semibold text-white">第{episode.episode}集</td>
                                <td className="px-4 py-4">
                                    <div className="max-w-[200px] truncate font-semibold text-white">{episode.title || "未命名剧集"}</div>
                                </td>
                                <td className="px-4 py-4">
                                    <span className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-100">{episode.status}</span>
                                </td>
                                <td className="px-4 py-4 text-[#cfcfcf]">{episode.due_date || "未设置"}</td>
                                <td className="px-4 py-4">
                                    <div className="line-clamp-2 max-w-[300px] whitespace-pre-wrap text-[#cfcfcf]">{episode.summary || "无"}</div>
                                </td>
                                <td className="px-4 py-4">
                                    <div className="line-clamp-2 max-w-[220px] whitespace-pre-wrap text-[#bdbdbd]">{episode.notes || "无"}</div>
                                </td>
                                <td className="px-4 py-4">
                                    <div className="flex flex-wrap gap-2">
                                        <Button size="sm" variant="secondary" onClick={() => props.editProjectEpisodeItem(episode)}><Pencil className="h-4 w-4" />编辑</Button>
                                        <Button size="sm" variant="destructive" onClick={() => void props.deleteProjectEpisodeItem(episode)}><Trash2 className="h-4 w-4" /></Button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </ProjectManagementTable>
                )}
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#202020] p-5">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <div className="text-base font-semibold text-white">{props.editingEpisodeId ? "编辑剧集" : "新增剧集"}</div>
                        <div className="mt-1 text-sm text-[#bdbdbd]">按集管理故事简介、制作阶段、截止日期和备注。</div>
                    </div>
                    {props.editingEpisodeId && <Button size="sm" variant="secondary" onClick={props.resetProjectEpisodeForm}>取消编辑</Button>}
                </div>
                <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-x-4 gap-y-3 max-md:grid-cols-1">
                    <label className="contents">
                        <span className="pt-3 text-right text-sm font-medium text-[#d8d8d8] max-md:pt-0 max-md:text-left">集数</span>
                        <input className="h-11 rounded-xl border border-white/10 bg-[#2f2f2f] px-3 text-sm text-white outline-none transition-colors focus:border-emerald-500" type="number" min={1} value={props.episodeDraft.episode ?? 1} placeholder="第几集" onChange={(event) => props.setEpisodeDraft((draft) => ({ ...draft, episode: Number(event.target.value) }))} />
                    </label>
                    <label className="contents">
                        <span className="pt-3 text-right text-sm font-medium text-[#d8d8d8] max-md:pt-0 max-md:text-left">标题</span>
                        <input className="h-11 rounded-xl border border-white/10 bg-[#2f2f2f] px-3 text-sm text-white outline-none transition-colors focus:border-emerald-500" value={props.episodeDraft.title ?? ""} placeholder="剧集标题" onChange={(event) => props.setEpisodeDraft((draft) => ({ ...draft, title: event.target.value }))} />
                    </label>
                    <label className="contents">
                        <span className="pt-3 text-right text-sm font-medium text-[#d8d8d8] max-md:pt-0 max-md:text-left">制作阶段</span>
                        <select className="h-11 rounded-xl border border-white/10 bg-[#2f2f2f] px-3 text-sm text-white outline-none transition-colors focus:border-emerald-500" value={props.episodeDraft.status ?? "策划中"} onChange={(event) => props.setEpisodeDraft((draft) => ({ ...draft, status: event.target.value }))}>
                            {["策划中", "剧本中", "分镜中", "出图中", "视频中", "剪辑中", "审核中", "已完成"].map((status) => <option key={status}>{status}</option>)}
                        </select>
                    </label>
                    <label className="contents">
                        <span className="pt-3 text-right text-sm font-medium text-[#d8d8d8] max-md:pt-0 max-md:text-left">截止日期</span>
                        <input className="h-11 rounded-xl border border-white/10 bg-[#2f2f2f] px-3 text-sm text-white outline-none transition-colors focus:border-emerald-500" type="date" value={props.episodeDraft.due_date ?? ""} onChange={(event) => props.setEpisodeDraft((draft) => ({ ...draft, due_date: event.target.value }))} />
                    </label>
                    <label className="contents">
                        <span className="pt-3 text-right text-sm font-medium text-[#d8d8d8] max-md:pt-0 max-md:text-left">剧情简介</span>
                        <textarea className="min-h-28 w-full resize-y rounded-xl border border-white/10 bg-[#2f2f2f] px-3 py-3 text-sm leading-6 text-white outline-none transition-colors focus:border-emerald-500" value={props.episodeDraft.summary ?? ""} placeholder="本集剧情简介" onChange={(event) => props.setEpisodeDraft((draft) => ({ ...draft, summary: event.target.value }))} />
                    </label>
                    <label className="contents">
                        <span className="pt-3 text-right text-sm font-medium text-[#d8d8d8] max-md:pt-0 max-md:text-left">备注</span>
                        <textarea className="min-h-20 w-full resize-y rounded-xl border border-white/10 bg-[#2f2f2f] px-3 py-3 text-sm leading-6 text-white outline-none transition-colors focus:border-emerald-500" value={props.episodeDraft.notes ?? ""} placeholder="制作备注、风险、交付要求" onChange={(event) => props.setEpisodeDraft((draft) => ({ ...draft, notes: event.target.value }))} />
                    </label>
                </div>
                <div className="mt-5 flex justify-end">
                    <Button size="sm" onClick={() => void props.submitProjectEpisodeForm()}>
                        {props.editingEpisodeId ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                        {props.editingEpisodeId ? "保存剧集" : "添加剧集"}
                    </Button>
                </div>
            </div>
        </div>
    );
}
