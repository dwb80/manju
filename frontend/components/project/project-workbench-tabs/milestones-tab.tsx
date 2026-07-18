"use client";

import { Check, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShadcnSelect } from "@/components/ui/select";
import { ManagementTable as ProjectManagementTable } from "@/components/project/project-workbench";
import type { ProjectMilestone, ProjectMilestoneStatus, ProjectMember } from "@/lib/app-types";

interface MilestonesTabProps {
    projectMilestones: ProjectMilestone[];
    filteredProjectMilestones: ProjectMilestone[];
    pagedProjectMilestones: ProjectMilestone[];
    milestoneDraft: Partial<ProjectMilestone>;
    editingMilestoneId: string;
    projectMembers: ProjectMember[];
    resetProjectMilestoneForm: () => void;
    editProjectMilestoneItem: (milestone: ProjectMilestone) => void;
    deleteProjectMilestoneItem: (milestone: ProjectMilestone) => Promise<void>;
    submitProjectMilestoneForm: () => Promise<void>;
    setMilestoneDraft: (updater: (draft: Partial<ProjectMilestone>) => Partial<ProjectMilestone>) => void;
}

export function MilestonesTab(props: MilestonesTabProps) {
    return (
        <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-[#202020]">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
                    <div>
                        <div className="text-base font-semibold text-white">里程碑</div>
                        <div className="mt-1 text-sm text-[#bdbdbd]">管理样片、分镜锁定、成片审核、最终交付等关键节点。</div>
                    </div>
                    <Button size="sm" variant="secondary" onClick={props.resetProjectMilestoneForm}><Plus className="h-4 w-4" />新增里程碑</Button>
                </div>
                {props.filteredProjectMilestones.length === 0 ? (
                    <div className="px-5 py-10 text-center">
                        <div className="text-base font-semibold text-white">{props.projectMilestones.length === 0 ? "暂无里程碑" : "没有匹配的里程碑"}</div>
                        <div className="mt-2 text-sm text-[#bdbdbd]">{props.projectMilestones.length === 0 ? "可以先添加\"第一集样片交付\"作为关键节点。" : "调整搜索、状态或负责人筛选后再试。"}</div>
                    </div>
                ) : (
                    <ProjectManagementTable columns={["标题", "状态", "负责人", "截止日期", "交付说明", "操作"]}>
                        {props.pagedProjectMilestones.map((milestone) => (
                            <tr key={milestone.id} className="align-top transition-colors hover:bg-white/[0.03]">
                                <td className="px-4 py-4">
                                    <div className="max-w-[260px] truncate font-semibold text-white">{milestone.title}</div>
                                </td>
                                <td className="px-4 py-4">
                                    <span className="inline-flex rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-xs font-medium text-[#dcdcdc]">{milestone.status === "planned" ? "计划中" : milestone.status === "doing" ? "进行中" : milestone.status === "done" ? "已完成" : "延期"}</span>
                                </td>
                                <td className="px-4 py-4 text-[#cfcfcf]">{milestone.owner || "未分配"}</td>
                                <td className="px-4 py-4 text-[#cfcfcf]">{milestone.due_date || "未设置"}</td>
                                <td className="px-4 py-4">
                                    <div className="line-clamp-2 max-w-[360px] whitespace-pre-wrap text-[#cfcfcf]">{milestone.description || "无"}</div>
                                </td>
                                <td className="px-4 py-4">
                                    <div className="flex flex-wrap gap-2">
                                        <Button size="sm" variant="secondary" onClick={() => props.editProjectMilestoneItem(milestone)}><Pencil className="h-4 w-4" />编辑</Button>
                                        <Button size="sm" variant="destructive" onClick={() => void props.deleteProjectMilestoneItem(milestone)}><Trash2 className="h-4 w-4" /></Button>
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
                        <div className="text-base font-semibold text-white">{props.editingMilestoneId ? "编辑里程碑" : "新增里程碑"}</div>
                        <div className="mt-1 text-sm text-[#bdbdbd]">定义交付范围、验收标准、负责人和截止日期。</div>
                    </div>
                    {props.editingMilestoneId && <Button size="sm" variant="secondary" onClick={props.resetProjectMilestoneForm}>取消编辑</Button>}
                </div>
                <div className="grid grid-cols-4 gap-3 max-lg:grid-cols-2 max-md:grid-cols-1">
                    <label className="space-y-1.5 lg:col-span-2">
                        <span className="block text-sm font-medium text-[#d8d8d8]">里程碑标题</span>
                        <input className="h-11 w-full rounded-xl border border-white/10 bg-[#2f2f2f] px-3 text-sm text-white outline-none transition-colors focus:border-emerald-500" value={props.milestoneDraft.title ?? ""} placeholder="里程碑标题" onChange={(event) => props.setMilestoneDraft((draft) => ({ ...draft, title: event.target.value }))} />
                    </label>
                    <label className="space-y-1.5">
                        <span className="block text-sm font-medium text-[#d8d8d8]">状态</span>
                        <ShadcnSelect
                            options={[
                                { value: "planned", label: "计划中" },
                                { value: "doing", label: "进行中" },
                                { value: "done", label: "已完成" },
                                { value: "delayed", label: "延期" },
                            ]}
                            value={props.milestoneDraft.status ?? "planned"}
                            onChange={(value) => props.setMilestoneDraft((draft) => ({ ...draft, status: value as ProjectMilestoneStatus }))}
                            className="h-11 w-full text-sm"
                        />
                    </label>
                    <label className="space-y-1.5">
                        <span className="block text-sm font-medium text-[#d8d8d8]">负责人</span>
                        <ShadcnSelect
                            options={[
                                { value: "", label: "负责人" },
                                ...props.projectMembers.map((member) => ({ value: member.name, label: `${member.name} · ${member.role}` })),
                            ]}
                            value={props.milestoneDraft.owner ?? ""}
                            onChange={(value) => props.setMilestoneDraft((draft) => ({ ...draft, owner: value }))}
                            className="h-11 w-full text-sm"
                        />
                    </label>
                    <label className="space-y-1.5">
                        <span className="block text-sm font-medium text-[#d8d8d8]">截止日期</span>
                        <input className="h-11 w-full rounded-xl border border-white/10 bg-[#2f2f2f] px-3 text-sm text-white outline-none transition-colors focus:border-emerald-500" type="date" value={props.milestoneDraft.due_date ?? ""} onChange={(event) => props.setMilestoneDraft((draft) => ({ ...draft, due_date: event.target.value }))} />
                    </label>
                </div>
                <label className="mt-3 block space-y-1.5">
                    <span className="block text-sm font-medium text-[#d8d8d8]">交付说明</span>
                    <textarea className="min-h-24 w-full resize-y rounded-xl border border-white/10 bg-[#2f2f2f] px-3 py-3 text-sm leading-6 text-white outline-none transition-colors focus:border-emerald-500" value={props.milestoneDraft.description ?? ""} placeholder="交付范围、验收标准、依赖事项" onChange={(event) => props.setMilestoneDraft((draft) => ({ ...draft, description: event.target.value }))} />
                </label>
                <div className="mt-5 flex justify-end">
                    <Button size="sm" onClick={() => void props.submitProjectMilestoneForm()}>
                        {props.editingMilestoneId ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                        {props.editingMilestoneId ? "保存里程碑" : "添加里程碑"}
                    </Button>
                </div>
            </div>
        </div>
    );
}
