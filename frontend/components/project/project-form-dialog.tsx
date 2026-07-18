"use client";

import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Project, ProjectFormDraft, ProjectFormMode } from "@/lib/app-types";

type ProjectFormDialogProps = {
    projectFormMode: ProjectFormMode;
    projectFormTarget: Project | null;
    projectFormDraft: ProjectFormDraft;
    onSubmit: () => void;
    onClose: () => void;
    onFieldChange: (key: string, value: string | number) => void;
};

/**
 * ProjectFormDialog - 项目表单弹窗组件
 * @param {ProjectFormDialogProps} props - 组件属性
 * @returns {JSX.Element} 渲染的项目表单弹窗元素
 */
export function ProjectFormDialog({ projectFormMode, projectFormTarget, projectFormDraft, onSubmit, onClose, onFieldChange }: ProjectFormDialogProps) {
    return (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/60 px-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={projectFormMode === "edit" ? "编辑项目" : "新建项目"}>
            <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-[#202020] shadow-2xl">
                <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                    <div>
                        <div className="text-base font-semibold text-white">{projectFormMode === "edit" ? "编辑项目" : projectFormMode === "create-existing" ? "使用现有文件夹创建项目" : "新建空白项目"}</div>
                        <div className="mt-1 text-xs text-[#b4b4b4]">补齐项目基本信息，后续剧本、分镜、资产、剪辑和交付都会绑定到这个项目。</div>
                    </div>
                    <button className="grid h-8 w-8 place-items-center rounded-lg text-[#d8d8d8] hover:bg-white/10 hover:text-white" onClick={onClose} aria-label="关闭项目表单">
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="max-h-[72vh] space-y-3 overflow-auto p-5">
                    {[
                        { key: "name", label: "项目名称", placeholder: "例如：盛唐异闻录 AIGC 漫剧" },
                        { key: "category", label: "题材类型", placeholder: "古风 / 科幻 / 悬疑 / 现代都市" },
                        { key: "owner", label: "负责人", placeholder: "项目负责人或主创" },
                        { key: "due_date", label: "截止日期", placeholder: "YYYY-MM-DD", type: "date" },
                    ].map((field) => (
                        <label key={field.key} className="grid grid-cols-[108px_1fr] items-center gap-3 max-sm:grid-cols-1 max-sm:gap-1">
                            <span className="text-right text-xs font-medium text-[#d8d8d8] max-sm:text-left">{field.label}</span>
                            <input
                                className="h-10 rounded-lg border border-white/10 bg-[#2f2f2f] px-3 text-sm text-white outline-none focus:border-emerald-500"
                                type={field.type ?? "text"}
                                value={String(projectFormDraft[field.key as keyof ProjectFormDraft] ?? "")}
                                placeholder={field.placeholder}
                                onChange={(event) => onFieldChange(field.key, event.target.value)}
                            />
                        </label>
                    ))}
                    <label className="grid grid-cols-[108px_1fr] items-center gap-3 max-sm:grid-cols-1 max-sm:gap-1">
                        <span className="text-right text-xs font-medium text-[#d8d8d8] max-sm:text-left">项目状态</span>
                        <select
                            className="h-10 rounded-lg border border-white/10 bg-[#2f2f2f] px-3 text-sm text-white outline-none focus:border-emerald-500"
                            value={projectFormDraft.status}
                            onChange={(event) => onFieldChange("status", event.target.value)}
                        >
                            {["策划中", "剧本中", "分镜中", "资产制作", "生成中", "剪辑中", "审核中", "已交付"].map((status) => <option key={status} value={status}>{status}</option>)}
                        </select>
                    </label>
                    <label className="grid grid-cols-[108px_1fr] items-center gap-3 max-sm:grid-cols-1 max-sm:gap-1">
                        <span className="text-right text-xs font-medium text-[#d8d8d8] max-sm:text-left">目标集数</span>
                        <input
                            className="h-10 rounded-lg border border-white/10 bg-[#2f2f2f] px-3 text-sm text-white outline-none focus:border-emerald-500"
                            type="number"
                            min={1}
                            value={projectFormDraft.episode_count}
                            onChange={(event) => onFieldChange("episode_count", Number(event.target.value))}
                        />
                    </label>
                    {projectFormMode !== "edit" && (
                        <label className="grid grid-cols-[108px_1fr] items-center gap-3 max-sm:grid-cols-1 max-sm:gap-1">
                            <span className="text-right text-xs font-medium text-[#d8d8d8] max-sm:text-left">存储文件夹</span>
                            <input
                                className="h-10 rounded-lg border border-white/10 bg-[#2f2f2f] px-3 text-sm text-white outline-none focus:border-emerald-500 disabled:cursor-not-allowed disabled:text-[#888]"
                                value={projectFormDraft.storage_path}
                                disabled={projectFormMode === "create-managed"}
                                placeholder={projectFormMode === "create-managed" ? "系统自动创建项目文件夹" : "例如：manju 或 客户A/短剧项目"}
                                onChange={(event) => onFieldChange("storage_path", event.target.value)}
                            />
                        </label>
                    )}
                    <label className="grid grid-cols-[108px_1fr] items-start gap-3 max-sm:grid-cols-1 max-sm:gap-1">
                        <span className="pt-2 text-right text-xs font-medium text-[#d8d8d8] max-sm:text-left">项目说明</span>
                        <textarea
                            className="min-h-24 resize-none rounded-lg border border-white/10 bg-[#2f2f2f] px-3 py-2 text-sm leading-6 text-white outline-none focus:border-emerald-500"
                            value={projectFormDraft.description}
                            placeholder="项目定位、受众、风格参考、交付目标等"
                            onChange={(event) => onFieldChange("description", event.target.value)}
                        />
                    </label>
                </div>
                <div className="flex justify-end gap-2 border-t border-white/10 px-5 py-4">
                    <Button size="sm" variant="secondary" onClick={onClose}>取消</Button>
                    <Button size="sm" onClick={onSubmit}><Check className="h-4 w-4" />{projectFormMode === "edit" ? "保存项目" : "创建项目"}</Button>
                </div>
            </div>
        </div>
    );
}