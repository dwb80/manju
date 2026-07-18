"use client";

import { Check, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShadcnSelect } from "@/components/ui/select";
import { ManagementTable as ProjectManagementTable } from "@/components/project/project-workbench";
import type { ProjectMember } from "@/lib/app-types";

interface MembersTabProps {
    projectMembers: ProjectMember[];
    filteredProjectMembers: ProjectMember[];
    pagedProjectMembers: ProjectMember[];
    memberDraft: Partial<ProjectMember>;
    editingMemberId: string;
    resetProjectMemberForm: () => void;
    editProjectMemberItem: (member: ProjectMember) => void;
    deleteProjectMemberItem: (member: ProjectMember) => Promise<void>;
    submitProjectMemberForm: () => Promise<void>;
    setMemberDraft: (updater: (draft: Partial<ProjectMember>) => Partial<ProjectMember>) => void;
}

export function MembersTab(props: MembersTabProps) {
    return (
        <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-[#202020]">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
                    <div>
                        <div className="text-base font-semibold text-white">团队成员</div>
                        <div className="mt-1 text-sm text-[#bdbdbd]">维护导演、编剧、美术、剪辑、审核等小团队成员。</div>
                    </div>
                    <Button size="sm" variant="secondary" onClick={props.resetProjectMemberForm}><Plus className="h-4 w-4" />新增成员</Button>
                </div>
                {props.filteredProjectMembers.length === 0 ? (
                    <div className="px-5 py-10 text-center">
                        <div className="text-base font-semibold text-white">{props.projectMembers.length === 0 ? "还没有团队成员" : "没有匹配的成员"}</div>
                        <div className="mt-2 text-sm text-[#bdbdbd]">{props.projectMembers.length === 0 ? "先在下方添加导演、编剧、美术或剪辑成员。" : "调整搜索、状态或负责人筛选后再试。"}</div>
                    </div>
                ) : (
                    <ProjectManagementTable columns={["姓名", "角色", "联系方式", "职责说明", "操作"]}>
                        {props.pagedProjectMembers.map((member) => (
                            <tr key={member.id} className="align-top transition-colors hover:bg-white/[0.03]">
                                <td className="px-4 py-4 font-semibold text-white">{member.name}</td>
                                <td className="px-4 py-4">
                                    <span className="inline-flex rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-xs font-medium text-[#dcdcdc]">{member.role}</span>
                                </td>
                                <td className="px-4 py-4 text-[#cfcfcf]">{member.contact || "未填写"}</td>
                                <td className="px-4 py-4">
                                    <div className="line-clamp-2 max-w-[360px] whitespace-pre-wrap text-[#cfcfcf]">{member.notes || "无"}</div>
                                </td>
                                <td className="px-4 py-4">
                                    <div className="flex flex-wrap gap-2">
                                        <Button size="sm" variant="secondary" onClick={() => props.editProjectMemberItem(member)}><Pencil className="h-4 w-4" />编辑</Button>
                                        <Button size="sm" variant="destructive" onClick={() => void props.deleteProjectMemberItem(member)}><Trash2 className="h-4 w-4" /></Button>
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
                        <div className="text-base font-semibold text-white">{props.editingMemberId ? "编辑成员" : "新增成员"}</div>
                        <div className="mt-1 text-sm text-[#bdbdbd]">成员姓名会在任务、问题、里程碑负责人中复用。</div>
                    </div>
                    {props.editingMemberId && <Button size="sm" variant="secondary" onClick={props.resetProjectMemberForm}>取消编辑</Button>}
                </div>
                <div className="grid grid-cols-3 gap-3 max-lg:grid-cols-1">
                    <label className="space-y-1.5">
                        <span className="block text-sm font-medium text-[#d8d8d8]">成员姓名</span>
                        <input className="h-11 w-full rounded-xl border border-white/10 bg-[#2f2f2f] px-3 text-sm text-white outline-none transition-colors focus:border-emerald-500" value={props.memberDraft.name ?? ""} placeholder="例如：张导" onChange={(event) => props.setMemberDraft((draft) => ({ ...draft, name: event.target.value }))} />
                    </label>
                    <label className="space-y-1.5">
                        <span className="block text-sm font-medium text-[#d8d8d8]">角色</span>
                        <select className="h-11 w-full rounded-xl border border-white/10 bg-[#2f2f2f] px-3 text-sm text-white outline-none transition-colors focus:border-emerald-500" value={props.memberDraft.role ?? ""} onChange={(event) => props.setMemberDraft((draft) => ({ ...draft, role: event.target.value }))}>
                            {["制片", "导演", "编剧", "分镜", "美术", "剪辑", "审核", "运营", "成员"].map((role) => <option key={role}>{role}</option>)}
                        </select>
                    </label>
                    <label className="space-y-1.5">
                        <span className="block text-sm font-medium text-[#d8d8d8]">联系方式</span>
                        <input className="h-11 w-full rounded-xl border border-white/10 bg-[#2f2f2f] px-3 text-sm text-white outline-none transition-colors focus:border-emerald-500" value={props.memberDraft.contact ?? ""} placeholder="手机号、微信或邮箱" onChange={(event) => props.setMemberDraft((draft) => ({ ...draft, contact: event.target.value }))} />
                    </label>
                </div>
                <label className="mt-3 block space-y-1.5">
                    <span className="block text-sm font-medium text-[#d8d8d8]">职责说明</span>
                    <textarea className="min-h-24 w-full resize-y rounded-xl border border-white/10 bg-[#2f2f2f] px-3 py-3 text-sm leading-6 text-white outline-none transition-colors focus:border-emerald-500" value={props.memberDraft.notes ?? ""} placeholder="例如：负责第1-3集分镜审核" onChange={(event) => props.setMemberDraft((draft) => ({ ...draft, notes: event.target.value }))} />
                </label>
                <div className="mt-5 flex justify-end">
                    <Button size="sm" onClick={() => void props.submitProjectMemberForm()}>
                        {props.editingMemberId ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                        {props.editingMemberId ? "保存成员" : "添加成员"}
                    </Button>
                </div>
            </div>
        </div>
    );
}
