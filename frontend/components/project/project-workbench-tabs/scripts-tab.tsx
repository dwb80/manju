"use client";

import { Check, Download, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ManagementTable as ProjectManagementTable } from "@/components/project/project-workbench";
import type { ProjectScript } from "@/lib/app-types";

interface ScriptsTabProps {
    projectScripts: ProjectScript[];
    filteredProjectScripts: ProjectScript[];
    pagedProjectScripts: ProjectScript[];
    scriptForm: { episode: number; title: string; status: ProjectScript["status"]; content: string; notes: string };
    editingScriptId: string;
    scriptStatusText: (status: ProjectScript["status"]) => string;
    resetProjectScriptForm: () => void;
    editProjectScriptItem: (script: ProjectScript) => void;
    deleteProjectScriptItem: (script: ProjectScript) => Promise<void>;
    submitProjectScriptForm: () => Promise<void>;
    breakdownSavedScript: (script: ProjectScript) => Promise<void>;
    setScriptForm: (updater: (draft: { episode: number; title: string; status: ProjectScript["status"]; content: string; notes: string }) => { episode: number; title: string; status: ProjectScript["status"]; content: string; notes: string }) => void;
    downloadProjectExport: (file: "scripts.txt" | "edit-list.csv" | "manifest.json") => void;
}

export function ScriptsTab(props: ScriptsTabProps) {
    return (
        <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-[#202020]">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
                    <div>
                        <div className="text-base font-semibold text-white">剧本列表</div>
                        <div className="mt-1 text-sm text-[#bdbdbd]">按剧集管理剧本文档，后续可直接拆分镜和导出交付。</div>
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => props.downloadProjectExport("scripts.txt")}><Download className="h-4 w-4" />导出剧本</Button>
                </div>
                {props.filteredProjectScripts.length === 0 ? (
                    props.projectScripts.length === 0 ? (
                        <div className="px-5 py-10 text-center">
                            <div className="text-base font-semibold text-white">还没有剧本</div>
                            <div className="mt-2 text-sm text-[#bdbdbd]">先在下方新增第一集剧本，保存后即可生成分镜。</div>
                        </div>
                    ) : (
                        <div className="px-5 py-10 text-center">
                            <div className="text-base font-semibold text-white">没有匹配的剧本</div>
                            <div className="mt-2 text-sm text-[#bdbdbd]">调整搜索、状态或负责人筛选后再试。</div>
                        </div>
                    )
                ) : (
                    <ProjectManagementTable columns={["集数", "标题", "状态", "内容摘要", "备注", "操作"]}>
                        {props.pagedProjectScripts.map((script) => (
                            <tr key={script.id} className="align-top transition-colors hover:bg-white/[0.03]">
                                <td className="whitespace-nowrap px-4 py-4 font-semibold text-white">第{script.episode}集</td>
                                <td className="px-4 py-4">
                                    <div className="max-w-[220px] truncate font-semibold text-white">{script.title || "未命名剧本"}</div>
                                </td>
                                <td className="px-4 py-4">
                                    <span className="inline-flex rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-xs font-medium text-[#dcdcdc]">{props.scriptStatusText(script.status)}</span>
                                </td>
                                <td className="px-4 py-4">
                                    <div className="line-clamp-2 max-w-[360px] whitespace-pre-wrap text-[#cfcfcf]">{script.content || "暂无正文"}</div>
                                </td>
                                <td className="px-4 py-4">
                                    <div className="line-clamp-2 max-w-[180px] whitespace-pre-wrap text-[#bdbdbd]">{script.notes || "无"}</div>
                                </td>
                                <td className="px-4 py-4">
                                    <div className="flex flex-wrap gap-2">
                                        <Button size="sm" variant="secondary" onClick={() => void props.breakdownSavedScript(script)}>生成分镜</Button>
                                        <Button size="sm" variant="secondary" onClick={() => props.editProjectScriptItem(script)}><Pencil className="h-4 w-4" />编辑</Button>
                                        <Button size="sm" variant="destructive" onClick={() => void props.deleteProjectScriptItem(script)}><Trash2 className="h-4 w-4" /></Button>
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
                        <div className="text-base font-semibold text-white">{props.editingScriptId ? "编辑剧本" : "新增剧本"}</div>
                        <div className="mt-1 text-sm text-[#bdbdbd]">填写剧集、状态、标题和正文，保存后会出现在上方列表。</div>
                    </div>
                    {props.editingScriptId && <Button size="sm" variant="secondary" onClick={props.resetProjectScriptForm}>取消编辑</Button>}
                </div>
                <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-x-4 gap-y-3 max-md:grid-cols-1">
                    <label className="contents">
                        <span className="pt-3 text-right text-sm font-medium text-[#d8d8d8] max-md:pt-0 max-md:text-left">剧集</span>
                        <input className="h-11 rounded-xl border border-white/10 bg-[#2f2f2f] px-3 text-sm text-white outline-none transition-colors focus:border-emerald-500" type="number" min={1} value={props.scriptForm.episode} placeholder="第几集" onChange={(event) => props.setScriptForm((draft) => ({ ...draft, episode: Number(event.target.value) }))} />
                    </label>
                    <label className="contents">
                        <span className="pt-3 text-right text-sm font-medium text-[#d8d8d8] max-md:pt-0 max-md:text-left">状态</span>
                        <select className="h-11 rounded-xl border border-white/10 bg-[#2f2f2f] px-3 text-sm text-white outline-none transition-colors focus:border-emerald-500" value={props.scriptForm.status} onChange={(event) => props.setScriptForm((draft) => ({ ...draft, status: event.target.value as ProjectScript["status"] }))}>
                            <option value="draft">草稿</option>
                            <option value="ready">可拆分镜</option>
                            <option value="storyboarded">已生成分镜</option>
                            <option value="archived">已归档</option>
                        </select>
                    </label>
                    <label className="contents">
                        <span className="pt-3 text-right text-sm font-medium text-[#d8d8d8] max-md:pt-0 max-md:text-left">标题</span>
                        <input className="h-11 rounded-xl border border-white/10 bg-[#2f2f2f] px-3 text-sm text-white outline-none transition-colors focus:border-emerald-500" value={props.scriptForm.title} placeholder="例如：第一集 归来" onChange={(event) => props.setScriptForm((draft) => ({ ...draft, title: event.target.value }))} />
                    </label>
                    <label className="contents">
                        <span className="pt-3 text-right text-sm font-medium text-[#d8d8d8] max-md:pt-0 max-md:text-left">正文</span>
                        <textarea className="min-h-48 w-full resize-y rounded-xl border border-white/10 bg-[#2f2f2f] px-3 py-3 text-sm leading-6 text-white outline-none transition-colors focus:border-emerald-500" value={props.scriptForm.content} placeholder="粘贴或编写剧本文本" onChange={(event) => props.setScriptForm((draft) => ({ ...draft, content: event.target.value }))} />
                    </label>
                    <label className="contents">
                        <span className="pt-3 text-right text-sm font-medium text-[#d8d8d8] max-md:pt-0 max-md:text-left">备注</span>
                        <textarea className="min-h-20 w-full resize-y rounded-xl border border-white/10 bg-[#2f2f2f] px-3 py-3 text-sm leading-6 text-white outline-none transition-colors focus:border-emerald-500" value={props.scriptForm.notes} placeholder="制作备注、改稿要求、交付说明" onChange={(event) => props.setScriptForm((draft) => ({ ...draft, notes: event.target.value }))} />
                    </label>
                </div>
                <div className="mt-5 flex justify-end">
                    <Button size="sm" onClick={() => void props.submitProjectScriptForm()}>
                        {props.editingScriptId ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                        {props.editingScriptId ? "保存剧本" : "添加剧本"}
                    </Button>
                </div>
            </div>
        </div>
    );
}
