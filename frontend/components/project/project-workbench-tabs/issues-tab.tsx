"use client";

import { Check, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShadcnSelect } from "@/components/ui/select";
import { ManagementTable as ProjectManagementTable } from "@/components/project/project-workbench";
import type { ProjectIssue, ProjectIssueSeverity, ProjectIssueStatus, ProjectMember } from "@/lib/app-types";

interface IssuesTabProps {
    projectIssues: ProjectIssue[];
    filteredProjectIssues: ProjectIssue[];
    pagedProjectIssues: ProjectIssue[];
    issueDraft: Partial<ProjectIssue>;
    editingIssueId: string;
    projectMembers: ProjectMember[];
    resetProjectIssueForm: () => void;
    editProjectIssueItem: (issue: ProjectIssue) => void;
    deleteProjectIssueItem: (issue: ProjectIssue) => Promise<void>;
    submitProjectIssueForm: () => Promise<void>;
    setIssueDraft: (updater: (draft: Partial<ProjectIssue>) => Partial<ProjectIssue>) => void;
}

export function IssuesTab(props: IssuesTabProps) {
    return (
        <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-[#202020]">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
                    <div>
                        <div className="text-base font-semibold text-white">问题与风险</div>
                        <div className="mt-1 text-sm text-[#bdbdbd]">记录影响交付的风险、阻塞点和待决策事项。</div>
                    </div>
                    <Button size="sm" variant="secondary" onClick={props.resetProjectIssueForm}><Plus className="h-4 w-4" />新增问题</Button>
                </div>
                {props.filteredProjectIssues.length === 0 ? (
                    <div className="px-5 py-10 text-center">
                        <div className="text-base font-semibold text-white">{props.projectIssues.length === 0 ? "暂无问题或风险" : "没有匹配的问题"}</div>
                        <div className="mt-2 text-sm text-[#bdbdbd]">{props.projectIssues.length === 0 ? "项目风险会影响交付节奏，建议及时记录并指定负责人。" : "调整搜索、状态或负责人筛选后再试。"}</div>
                    </div>
                ) : (
                    <ProjectManagementTable columns={["标题", "级别", "状态", "负责人", "说明", "操作"]}>
                        {props.pagedProjectIssues.map((issue) => (
                            <tr key={issue.id} className="align-top transition-colors hover:bg-white/[0.03]">
                                <td className="px-4 py-4">
                                    <div className="max-w-[260px] truncate font-semibold text-white">{issue.title}</div>
                                </td>
                                <td className="px-4 py-4">
                                    <span className="inline-flex rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-xs font-medium text-[#dcdcdc]">{issue.severity === "critical" ? "严重" : issue.severity === "high" ? "高" : issue.severity === "medium" ? "中" : "低"}</span>
                                </td>
                                <td className="px-4 py-4">
                                    <span className="inline-flex rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-xs font-medium text-[#dcdcdc]">{issue.status === "open" ? "待处理" : issue.status === "doing" ? "处理中" : issue.status === "resolved" ? "已解决" : "已关闭"}</span>
                                </td>
                                <td className="px-4 py-4 text-[#cfcfcf]">{issue.owner || "未分配"}</td>
                                <td className="px-4 py-4">
                                    <div className="line-clamp-2 max-w-[360px] whitespace-pre-wrap text-[#cfcfcf]">{issue.notes || "无"}</div>
                                </td>
                                <td className="px-4 py-4">
                                    <div className="flex flex-wrap gap-2">
                                        <Button size="sm" variant="secondary" onClick={() => props.editProjectIssueItem(issue)}><Pencil className="h-4 w-4" />编辑</Button>
                                        <Button size="sm" variant="destructive" onClick={() => void props.deleteProjectIssueItem(issue)}><Trash2 className="h-4 w-4" /></Button>
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
                        <div className="text-base font-semibold text-white">{props.editingIssueId ? "编辑问题" : "新增问题"}</div>
                        <div className="mt-1 text-sm text-[#bdbdbd]">记录风险级别、处理状态、负责人和解决方案。</div>
                    </div>
                    {props.editingIssueId && <Button size="sm" variant="secondary" onClick={props.resetProjectIssueForm}>取消编辑</Button>}
                </div>
                <div className="grid grid-cols-4 gap-3 max-lg:grid-cols-2 max-md:grid-cols-1">
                    <label className="space-y-1.5 lg:col-span-2">
                        <span className="block text-sm font-medium text-[#d8d8d8]">问题标题</span>
                        <input className="h-11 w-full rounded-xl border border-white/10 bg-[#2f2f2f] px-3 text-sm text-white outline-none transition-colors focus:border-emerald-500" value={props.issueDraft.title ?? ""} placeholder="问题标题" onChange={(event) => props.setIssueDraft((draft) => ({ ...draft, title: event.target.value }))} />
                    </label>
                    <label className="space-y-1.5">
                        <span className="block text-sm font-medium text-[#d8d8d8]">级别</span>
                        <ShadcnSelect
                            options={[
                                { value: "low", label: "低" },
                                { value: "medium", label: "中" },
                                { value: "high", label: "高" },
                                { value: "critical", label: "严重" },
                            ]}
                            value={props.issueDraft.severity ?? "low"}
                            onChange={(value) => props.setIssueDraft((draft) => ({ ...draft, severity: value as ProjectIssueSeverity }))}
                            className="h-11 w-full text-sm"
                        />
                    </label>
                    <label className="space-y-1.5">
                        <span className="block text-sm font-medium text-[#d8d8d8]">状态</span>
                        <ShadcnSelect
                            options={[
                                { value: "open", label: "待处理" },
                                { value: "doing", label: "处理中" },
                                { value: "resolved", label: "已解决" },
                                { value: "closed", label: "已关闭" },
                            ]}
                            value={props.issueDraft.status ?? "open"}
                            onChange={(value) => props.setIssueDraft((draft) => ({ ...draft, status: value as ProjectIssueStatus }))}
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
                            value={props.issueDraft.owner ?? ""}
                            onChange={(value) => props.setIssueDraft((draft) => ({ ...draft, owner: value }))}
                            className="h-11 w-full text-sm"
                        />
                    </label>
                </div>
                <label className="mt-3 block space-y-1.5">
                    <span className="block text-sm font-medium text-[#d8d8d8]">问题说明</span>
                    <textarea className="min-h-24 w-full resize-y rounded-xl border border-white/10 bg-[#2f2f2f] px-3 py-3 text-sm leading-6 text-white outline-none transition-colors focus:border-emerald-500" value={props.issueDraft.notes ?? ""} placeholder="问题描述、影响范围、解决方案" onChange={(event) => props.setIssueDraft((draft) => ({ ...draft, notes: event.target.value }))} />
                </label>
                <div className="mt-5 flex justify-end">
                    <Button size="sm" onClick={() => void props.submitProjectIssueForm()}>
                        {props.editingIssueId ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                        {props.editingIssueId ? "保存问题" : "添加问题"}
                    </Button>
                </div>
            </div>
        </div>
    );
}
