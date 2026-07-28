"use client";

/**
 * ProjectFormDialog - 项目表单弹窗组件（左右结构 · v2 UI · 优先级修复）
 *
 * 本次升级（按优先级修复）：
 * - P0-1：字段分组（基础信息 / 进度管理 / 其他），分组小标题 11px uppercase。
 * - P0-2：提交按钮校验——必填为空时禁用并显示提示。
 * - P0-3：错误态红框 + 字段下方错误信息（实时校验）。
 * - P1-1：集数输入框右侧加单位"集"。
 * - P1-2：未保存关闭二次确认（脏状态检测）。
 * - P1-3：移动端响应式（col-span-12 / md:col-span-3/9）。
 * - P1-4：聚焦态按钮/输入框颜色统一 emerald。
 * - P1-5：底部按钮区用 1px 弱线分隔。
 *
 * 视觉规范（与全局 FormDialog 完全统一）：
 * - 必填项：标签前 emerald 圆点 + 微弱光环（避免红色星号与"错误"色冲突）。
 * - 标签左对齐、13px、font-medium、text-foreground/80。
 * - 字段垂直间距 20px，行内间距 16px。
 * - 标题区右上角"为必填项"图例（带圆点徽章）。
 * - 移动端：标签与控件各占整行（col-span-12），仍保留视觉层次。
 *
 * 与 FormDialog 不同的原因：
 * - 该组件需要支持"项目模式"切换（create-blank / create-existing / create-managed / edit），
 *   字段在 "edit" 模式下隐藏"存储文件夹"项；
 * - 字段集合较小且稳定，使用原生 input / textarea / select 性能更好。
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import type { Project, ProjectFormDraft, ProjectFormMode } from "@/lib/app-types";

type ProjectFormDialogProps = {
    projectFormMode: ProjectFormMode;
    projectFormTarget: Project | null;
    projectFormDraft: ProjectFormDraft;
    onSubmit: () => void;
    onClose: () => void;
    onFieldChange: (key: string, value: string | number) => void;
};

/** 输入控件统一样式：38px 高度、深色背景、边框 + 焦点态、主色 ring。 */
const baseInputClassName =
    "h-[38px] w-full rounded-md border border-border bg-muted px-3 text-[13px] leading-5 text-foreground placeholder:text-muted-foreground/40 outline-none transition-colors hover:border-border focus:border-primary/70 focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:bg-muted/30 disabled:text-muted-foreground";

/** 错误态：在基础样式上叠加红框 + 红光环。 */
const errorInputClassName =
    "border-destructive/60 focus:border-destructive focus:ring-2 focus:ring-destructive/20";

/** 带单位后缀的输入框（用于集数等场景）。 */
function InputWithUnit({
    unit,
    className,
    ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { unit: string; className?: string }) {
    return (
        <div className="relative">
            <input {...rest} className={`${baseInputClassName} pr-9 ${className ?? ""}`} />
            <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[12px] text-muted-foreground/70"
            >
                {unit}
            </span>
        </div>
    );
}

/** 必填圆点：emerald 主色 + 微弱光环，避免与"错误红"语义冲突。 */
function RequiredDot() {
    return (
        <span
            aria-hidden
            className="mt-[7px] inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-primary shadow-[0_0_0_3px_hsl(var(--primary)/0.12)]"
        />
    );
}

/** 非必填占位：与必填圆点等高的不可见块，保证文字基线对齐。 */
function OptionalSpacer() {
    return <span aria-hidden className="mt-[7px] inline-block h-1.5 w-1.5 shrink-0" />;
}

/** 短字段：标签左、控件右，3:9 栅格。 */
function FieldRow({
    label,
    required,
    htmlFor,
    error,
    hint,
    children,
}: {
    label: string;
    required?: boolean;
    htmlFor?: string;
    error?: string;
    hint?: string;
    children: React.ReactNode;
}) {
    return (
        <div className="grid grid-cols-12 items-start gap-x-4 gap-y-1.5">
            <label
                htmlFor={htmlFor}
                className="col-span-12 md:col-span-3 flex items-start gap-2 pt-[9px] text-[13px] font-medium leading-5 text-foreground/80"
            >
                {required ? <RequiredDot /> : <OptionalSpacer />}
                <span>{label}</span>
            </label>
            <div className="col-span-12 md:col-span-9 space-y-1.5">
                {children}
                {error ? (
                    <p role="alert" className="text-[12px] leading-4 text-destructive">
                        {error}
                    </p>
                ) : hint ? (
                    <p className="text-[12px] leading-4 text-muted-foreground/70">{hint}</p>
                ) : null}
            </div>
        </div>
    );
}

/** 长字段（textarea）：标签与控件均占 3:9 栅格，但标签顶部对齐便于阅读。 */
function LongFieldRow({
    label,
    required,
    htmlFor,
    error,
    hint,
    children,
}: {
    label: string;
    required?: boolean;
    htmlFor?: string;
    error?: string;
    hint?: string;
    children: React.ReactNode;
}) {
    return (
        <div className="grid grid-cols-12 items-start gap-x-4 gap-y-1.5">
            <label
                htmlFor={htmlFor}
                className="col-span-12 md:col-span-3 flex items-start gap-2 pt-[7px] text-[13px] font-medium leading-5 text-foreground/80"
            >
                {required ? <RequiredDot /> : <OptionalSpacer />}
                <span>{label}</span>
            </label>
            <div className="col-span-12 md:col-span-9 space-y-1.5">
                {children}
                {error ? (
                    <p role="alert" className="text-[12px] leading-4 text-destructive">
                        {error}
                    </p>
                ) : hint ? (
                    <p className="text-[12px] leading-4 text-muted-foreground/70">{hint}</p>
                ) : null}
            </div>
        </div>
    );
}

/** 分组小标题。 */
function GroupTitle({ title }: { title: string }) {
    return (
        <div className="form-group-title" aria-hidden>
            <span>{title}</span>
        </div>
    );
}

/**
 * 字段级校验。
 * 返回该字段的错误信息；无错误返回 undefined。
 * 这里只做"必填非空"和最小长度的轻量校验，
 * 复杂规则（格式、唯一性）应放在 onSubmit 中由后端 / 上层处理。
 */
function validateField(
    key: keyof ProjectFormDraft,
    value: string | number,
    required: boolean,
): string | undefined {
    if (required) {
        if (typeof value === "string" && value.trim() === "") return "此项为必填项";
        if (typeof value === "number" && (Number.isNaN(value) || value === 0)) return "此项为必填项";
    }
    if (key === "name" && typeof value === "string" && value.length > 80) {
        return "项目名称不能超过 80 个字符";
    }
    if (key === "category" && typeof value === "string" && value.length > 30) {
        return "题材类型不能超过 30 个字符";
    }
    if (key === "owner" && typeof value === "string" && value.length > 30) {
        return "负责人不能超过 30 个字符";
    }
    if (key === "episode_count" && typeof value === "number" && value < 0) {
        return "集数不能为负数";
    }
    if (key === "episode_count" && typeof value === "number" && value > 9999) {
        return "集数过大";
    }
    return undefined;
}

/**
 * ProjectFormDialog - 项目表单弹窗组件
 */
export function ProjectFormDialog({ projectFormMode, projectFormTarget, projectFormDraft, onSubmit, onClose, onFieldChange }: ProjectFormDialogProps) {
    const titleText =
        projectFormMode === "edit"
            ? "编辑项目"
            : projectFormMode === "create-existing"
                ? "使用现有文件夹创建项目"
                : "新建空白项目";

    // 脏状态检测：用于关闭二次确认
    const initialSnapshotRef = useRef<ProjectFormDraft>(projectFormDraft);
    useEffect(() => {
        // 每次表单"打开"时记录初始快照（通过 projectFormTarget 变化触发）
        initialSnapshotRef.current = projectFormDraft;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectFormTarget]);
    const isDirty = useMemo(() => {
        const a = initialSnapshotRef.current;
        const b = projectFormDraft;
        return (
            a.name !== b.name ||
            a.category !== b.category ||
            a.status !== b.status ||
            a.owner !== b.owner ||
            a.episode_count !== b.episode_count ||
            a.due_date !== b.due_date ||
            a.storage_path !== b.storage_path ||
            a.description !== b.description
        );
    }, [projectFormDraft]);

    // 字段级错误（实时）
    const errors = useMemo(() => {
        const e: Partial<Record<keyof ProjectFormDraft, string>> = {};
        e.name = validateField("name", projectFormDraft.name, true);
        e.category = validateField("category", projectFormDraft.category, true);
        e.status = validateField("status", projectFormDraft.status, true);
        e.owner = validateField("owner", projectFormDraft.owner, true);
        e.episode_count = validateField(
            "episode_count",
            projectFormDraft.episode_count,
            false,
        );
        return e;
    }, [projectFormDraft]);
    const hasError = Object.values(errors).some(Boolean);

    // 关闭二次确认
    const [showCancelConfirm, setShowCancelConfirm] = useState(false);
    const handleCloseClick = () => {
        if (isDirty) {
            setShowCancelConfirm(true);
        } else {
            onClose();
        }
    };

    // 必填项数量图例
    const requiredCount = 4;

    // 决定输入框的 className：基础 + 错误态
    const cls = (key: keyof ProjectFormDraft) =>
        errors[key] ? `${baseInputClassName} ${errorInputClassName}` : baseInputClassName;

    return (
        <>
            <div
                className="fixed inset-0 z-[80] grid place-items-center bg-black/70 px-4 backdrop-blur-md"
                role="dialog"
                aria-modal="true"
                aria-label={titleText}
            >
                <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card shadow-[0_24px_64px_-12px_rgba(0,0,0,0.6)]">
                    {/* 标题区 */}
                    <div className="flex items-start justify-between gap-4 border-b border-border/60 px-6 py-5">
                        <div className="space-y-1">
                            <h2 className="text-base font-semibold tracking-tight text-foreground">{titleText}</h2>
                            <p className="text-[12px] leading-5 text-muted-foreground/80">
                                补齐项目基本信息，后续剧本、分镜、资产、剪辑和交付都会绑定到这个项目。
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[11px] text-muted-foreground">
                                <span
                                    aria-hidden
                                    className="inline-block h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_0_3px_hsl(var(--primary)/0.12)]"
                                />
                                <span>为必填项（共 {requiredCount} 项）</span>
                            </div>
                            <button
                                className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                                onClick={handleCloseClick}
                                aria-label="关闭项目表单"
                                type="button"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    </div>

                    {/* 表单区 */}
                    <div className="max-h-[68vh] space-y-6 overflow-auto px-6 py-5">
                        {/* 基础信息 */}
                        <section className="space-y-4">
                            <GroupTitle title="基础信息" />
                            <div className="space-y-5">
                                <FieldRow
                                    label="项目名称"
                                    required
                                    htmlFor="project-name"
                                    error={errors.name}
                                >
                                    <input
                                        id="project-name"
                                        className={cls("name")}
                                        type="text"
                                        value={String(projectFormDraft.name ?? "")}
                                        placeholder="例如：盛唐异闻录 AIGC 漫剧"
                                        onChange={(event) => onFieldChange("name", event.target.value)}
                                        aria-invalid={Boolean(errors.name)}
                                    />
                                </FieldRow>

                                <FieldRow
                                    label="题材类型"
                                    required
                                    htmlFor="project-category"
                                    error={errors.category}
                                >
                                    <input
                                        id="project-category"
                                        className={cls("category")}
                                        type="text"
                                        value={String(projectFormDraft.category ?? "")}
                                        placeholder="古风 / 科幻 / 悬疑 / 现代都市"
                                        onChange={(event) => onFieldChange("category", event.target.value)}
                                        aria-invalid={Boolean(errors.category)}
                                    />
                                </FieldRow>

                                <FieldRow
                                    label="负责人"
                                    required
                                    htmlFor="project-owner"
                                    error={errors.owner}
                                >
                                    <input
                                        id="project-owner"
                                        className={cls("owner")}
                                        type="text"
                                        value={String(projectFormDraft.owner ?? "")}
                                        placeholder="项目负责人或主创"
                                        onChange={(event) => onFieldChange("owner", event.target.value)}
                                        aria-invalid={Boolean(errors.owner)}
                                    />
                                </FieldRow>
                            </div>
                        </section>

                        {/* 进度管理 */}
                        <section className="space-y-4">
                            <GroupTitle title="进度管理" />
                            <div className="space-y-5">
                                <FieldRow
                                    label="项目状态"
                                    required
                                    htmlFor="project-status"
                                    error={errors.status}
                                >
                                    <select
                                        id="project-status"
                                        className={cls("status")}
                                        value={projectFormDraft.status}
                                        onChange={(event) => onFieldChange("status", event.target.value)}
                                        aria-invalid={Boolean(errors.status)}
                                    >
                                        {["策划中", "剧本中", "分镜中", "资产制作", "生成中", "剪辑中", "审核中", "已交付"].map(
                                            (status) => (
                                                <option key={status} value={status} className="bg-card text-foreground">
                                                    {status}
                                                </option>
                                            ),
                                        )}
                                    </select>
                                </FieldRow>

                                <FieldRow
                                    label="目标集数"
                                    htmlFor="project-episode-count"
                                    error={errors.episode_count}
                                >
                                    <InputWithUnit
                                        id="project-episode-count"
                                        unit="集"
                                        type="number"
                                        min={1}
                                        className={errors.episode_count ? errorInputClassName : ""}
                                        value={projectFormDraft.episode_count}
                                        onChange={(event) =>
                                            onFieldChange("episode_count", Number(event.target.value))
                                        }
                                        aria-invalid={Boolean(errors.episode_count)}
                                    />
                                </FieldRow>

                                <FieldRow
                                    label="截止日期"
                                    htmlFor="project-due-date"
                                    hint="可选；用于在项目列表中倒计时显示"
                                >
                                    <input
                                        id="project-due-date"
                                        className={baseInputClassName}
                                        type="date"
                                        value={String(projectFormDraft.due_date ?? "")}
                                        onChange={(event) => onFieldChange("due_date", event.target.value)}
                                    />
                                </FieldRow>
                            </div>
                        </section>

                        {/* 其他 */}
                        <section className="space-y-4">
                            <GroupTitle title="其他" />
                            <div className="space-y-5">
                                {projectFormMode !== "edit" && (
                                    <FieldRow
                                        label="存储文件夹"
                                        htmlFor="project-storage-path"
                                        hint={
                                            projectFormMode === "create-managed"
                                                ? "系统自动创建项目文件夹"
                                                : "例如：manju 或 客户A/短剧项目"
                                        }
                                    >
                                        <input
                                            id="project-storage-path"
                                            className={baseInputClassName}
                                            value={projectFormDraft.storage_path}
                                            disabled={projectFormMode === "create-managed"}
                                            placeholder={
                                                projectFormMode === "create-managed"
                                                    ? "系统自动创建项目文件夹"
                                                    : "例如：manju 或 客户A/短剧项目"
                                            }
                                            onChange={(event) => onFieldChange("storage_path", event.target.value)}
                                        />
                                    </FieldRow>
                                )}

                                <LongFieldRow
                                    label="项目说明"
                                    htmlFor="project-description"
                                    hint="项目定位、受众、风格参考、交付目标等"
                                >
                                    <textarea
                                        id="project-description"
                                        className="min-h-[88px] w-full resize-none rounded-md border border-border bg-muted px-3 py-2 text-[13px] leading-6 text-foreground placeholder:text-muted-foreground/40 outline-none transition-colors hover:border-border focus:border-primary/70 focus:ring-2 focus:ring-primary/20"
                                        value={projectFormDraft.description}
                                        placeholder="项目定位、受众、风格参考、交付目标等"
                                        onChange={(event) => onFieldChange("description", event.target.value)}
                                    />
                                </LongFieldRow>
                            </div>
                        </section>
                    </div>

                    {/* 底部按钮区：与表单内容用 1px 弱线分隔 */}
                    <div className="flex items-center justify-end gap-2 border-t border-border/60 bg-muted/20 px-6 py-4">
                        <Button
                            size="sm"
                            variant="secondary"
                            onClick={handleCloseClick}
                            className="px-4"
                            type="button"
                        >
                            取消
                        </Button>
                        <Button
                            size="sm"
                            onClick={onSubmit}
                            disabled={hasError}
                            className="gap-1.5 bg-secondary px-4 text-foreground shadow-sm hover:bg-secondary/90 disabled:cursor-not-allowed disabled:opacity-60"
                            type="button"
                            title={hasError ? "请先修复表单中的错误" : undefined}
                        >
                            <Check className="h-3.5 w-3.5" />
                            {projectFormMode === "edit" ? "保存项目" : "创建项目"}
                        </Button>
                    </div>
                </div>
            </div>

            {/* 关闭二次确认：脏状态未保存时拦截 */}
            <ConfirmDialog
                isOpen={showCancelConfirm}
                onClose={() => setShowCancelConfirm(false)}
                onConfirm={() => {
                    setShowCancelConfirm(false);
                    onClose();
                }}
                title="放弃未保存的修改？"
                description="当前表单存在未保存的更改，关闭后将丢失这些内容。"
                confirmLabel="放弃修改"
                cancelLabel="继续编辑"
                variant="destructive"
            />
        </>
    );
}
