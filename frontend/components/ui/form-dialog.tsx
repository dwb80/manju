"use client";

/**
 * 通用表单对话框组件（基于 shadcn Form + Dialog + react-hook-form + zod）。
 *
 * 优势：
 * - 使用 react-hook-form 管理状态，性能更好（受控/非受控混合）
 * - 使用 zod schema 自动校验，错误信息更精确
 * - 与 shadcn Form 组件无缝集成（aria-describedby / aria-invalid）
 * - 保留原有 API 接口，所有调用方零迁移成本
 *
 * 字段类型：
 * - text/textarea/number：使用 shadcn Input/Textarea
 * - select：使用 shadcn Select
 * - image：使用 ImageUploader
 * - tags：使用 TagInput
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z, type ZodTypeAny } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImageUploader } from "@/components/shared/image-uploader";
import { TagInput } from "@/components/shared/tag-input";
import { EntityMultiPicker } from "@/components/shared/entity-multi-picker";

/** 表单字段类型 */
export type FieldType =
  | "text"
  | "textarea"
  | "select"
  | "number"
  | "image"
  | "tags"
  | "entity-multi";

/** 实体多选字段扩展配置（分镜→角色多选 / 分镜→道具多选等场景）。 */
export interface EntityMultiFieldConfig<T extends { id: string; name?: string; title?: string }> {
  /** 加载实体列表的函数（按当前项目过滤）。 */
  fetcher: (projectId: string) => Promise<T[]>;
  /** 实体转展示文本。 */
  formatLabel: (item: T) => string;
  /** 实体转辅助说明（可选）。 */
  formatHint?: (item: T) => string;
  /** 最多可选数量（可选）。 */
  maxItems?: number;
  /** 自定义 chip 渲染（可选，如头像/缩略图）。 */
  renderChip?: (item: T) => React.ReactNode;
}

/** 图片上传字段扩展配置 */
export interface ImageFieldConfig {
  onUpload?: (file: File) => Promise<string>;
  maxSize?: number;
  placeholder?: string;
}

/** 表单字段配置 */
export interface FormFieldConfig {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  defaultValue?: string | number | string[];
  min?: number;
  max?: number;
  rows?: number;
  imageConfig?: ImageFieldConfig;
  tagSuggestions?: string[];
  maxTags?: number;
  /** entity-multi 专用配置：传入 fetcher / formatLabel 等。 */
  entityMultiConfig?: EntityMultiFieldConfig<{ id: string; name?: string; title?: string }>;
  hint?: string;
  /**
   * 字段所属分组（用于在表单中渲染分组小标题）。
   * 同组字段会聚集在一起渲染，小标题显示在组首字段之上。
   * 不传则归入 "default" 组，置于最后。
   */
  group?: "basic" | "progress" | "description" | "default" | string;
  /**
   * 字段布局方式。
   * - vertical（默认）：标签在上、控件在下，堆叠显示（适合弹窗 / 移动端）。
   * - horizontal：左侧标签、右侧控件，左右结构（适合详情页、PC 后台）。
   *
   * 对于 textarea / image / tags / entity-multi 等"长字段"，即使在 horizontal 模式下，
   * 标签与控件仍会占满整行（不再压缩为 4+8），以保证信息密度合理。
   */
  layout?: "vertical" | "horizontal";
  /**
   * horizontal 布局下左侧标签的栅格宽度（Tailwind col-span）。
   * 默认 3（即 3:9 比例）。可填 3/4/5 等。
   * 仅当 layout === "horizontal" 且当前字段不是"长字段"时生效。
   */
  labelColSpan?: 3 | 4 | 5;
  /**
   * 输入框右侧单位文本（如 "集"、"%"、"px"），仅在 type=text/number 时生效。
   * 不参与提交值，仅作为视觉单位提示。
   */
  unit?: string;
  /**
   * 当值为空时是否在控件内显示空占位符（仅 type=select 时生效）。
   * 默认为 true，select 会自动在首项插入 disabled 的 placeholder option。
   */
  showPlaceholderWhenEmpty?: boolean;
}

/** 表单对话框属性 */
export interface FormDialogProps {
  title: string;
  description?: string;
  fields: FormFieldConfig[];
  initialValues?: Record<string, string | number | string[]>;
  isOpen: boolean;
  onClose: () => void;
  onSave: (values: Record<string, string | number | string[]>) => void;
  isLoading?: boolean;
  /** 底部保存按钮文案，默认 "保存" */
  submitLabel?: string;
  /** 加载中按钮文案，默认 `${submitLabel}中...` */
  loadingLabel?: string;
  /**
   * 自定义分组配置：覆盖默认 DEFAULT_GROUPS。
   * 不传则使用内置默认分组（基础信息 / 进度管理 / 描述 / 其他）。
   */
  groups?: Array<{ key: string; title: string; order: number }>;
}

/** 根据字段配置动态生成 zod schema。 */
function buildSchema(fields: FormFieldConfig[]): z.ZodObject<Record<string, ZodTypeAny>> {
  const shape: Record<string, ZodTypeAny> = {};
  fields.forEach((field) => {
    if (field.type === "tags" || field.type === "entity-multi") {
      shape[field.name] = field.required
        ? z.array(z.string()).min(1, `${field.label}为必填项`)
        : z.array(z.string()).optional();
    } else if (field.type === "number") {
      const min = field.min;
      const max = field.max;
      const label = field.label;
      const numberChecks: ((n: number) => boolean)[] = [];
      if (min !== undefined) numberChecks.push((n) => n >= min);
      if (max !== undefined) numberChecks.push((n) => n <= max);
      const numberRefine: z.ZodTypeAny = z.coerce
        .number()
        .refine((n) => !Number.isNaN(n), { message: `${label}为必填项` });
      let numSchema: z.ZodTypeAny = field.required
        ? numberRefine
        : z.preprocess(
          (v) => (v === "" || v === undefined || v === null ? undefined : v),
          z.coerce.number().optional(),
        );
      numberChecks.forEach((check) => {
        numSchema = (numSchema as z.ZodTypeAny).refine(
          (v) => v === undefined || v === null || check(v as number),
          {
            message: min !== undefined && max !== undefined
              ? `范围 ${min} ~ ${max}`
              : min !== undefined
                ? `不能小于 ${min}`
                : `不能大于 ${max}`,
          },
        );
      });
      shape[field.name] = numSchema;
    } else {
      // text / textarea / select / image
      const label = field.label;
      let strSchema: z.ZodTypeAny = field.required
        ? z.string().min(1, `${label}为必填项`)
        : z.preprocess(
          (v) => (v === "" ? undefined : v),
          z.string().optional(),
        );
      shape[field.name] = strSchema;
    }
  });
  return z.object(shape);
}

/** 计算字段默认值。 */
function buildDefaults(fields: FormFieldConfig[], initialValues: Record<string, string | number | string[]>) {
  const defaults: Record<string, string | number | string[]> = {};
  fields.forEach((field) => {
    const initial = initialValues[field.name];
    if (initial !== undefined) {
      defaults[field.name] = initial;
    } else if (field.type === "tags" || field.type === "entity-multi") {
      defaults[field.name] = (field.defaultValue as string[]) ?? [];
    } else if (field.type === "number") {
      defaults[field.name] = field.defaultValue ?? "";
    } else {
      defaults[field.name] = field.defaultValue ?? "";
    }
  });
  return defaults;
}

/**
 * 表单分组（用于字段聚合显示）。
 * - key：与 FormFieldConfig.group 字段对应
 * - title：分组小标题（11px uppercase + 渐变分隔线）
 * - order：数字越小排得越靠前
 */
const DEFAULT_GROUPS: Array<{ key: string; title: string; order: number }> = [
  { key: "basic", title: "基础信息", order: 1 },
  { key: "progress", title: "进度管理", order: 2 },
  { key: "description", title: "描述", order: 3 },
  { key: "default", title: "其他", order: 99 },
];

/** 通用表单对话框组件 */
export function FormDialog({
  title,
  description,
  fields,
  initialValues = {},
  isOpen,
  onClose,
  onSave,
  isLoading = false,
  submitLabel = "保存",
  loadingLabel,
  /** 自定义分组配置（覆盖默认）。 */
  groups,
}: FormDialogProps) {
  const schema = useMemo(() => buildSchema(fields), [fields]);
  const defaults = useMemo(
    () => buildDefaults(fields, initialValues),
    // 仅在打开时初始化一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fields],
  );

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: defaults,
    // P0-4：实时校验（onChange）+ 首次失焦校验 + 提交后校验
    mode: "onChange",
    reValidateMode: "onChange",
  });

  // 跟踪表单脏状态：用于取消时二次确认
  const initialSnapshotRef = useRef<Record<string, string | number | string[]>>(defaults);
  const [isDirty, setIsDirty] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  useEffect(() => {
    const subscription = form.watch(() => {
      setIsDirty(form.formState.isDirty);
    });
    return () => subscription.unsubscribe();
  }, [form]);

  const prevIsOpenRef = useRef(false);
  // 仅在对话框从关闭变为打开时重置一次表单
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      const newDefaults = buildDefaults(fields, initialValues);
      form.reset(newDefaults);
      initialSnapshotRef.current = newDefaults;
      setIsDirty(false);
    }
    prevIsOpenRef.current = isOpen;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleSubmit = form.handleSubmit((values) => {
    onSave(values as Record<string, string | number | string[]>);
  });

  // 尝试关闭：脏状态触发二次确认，否则直接关闭
  const tryClose = () => {
    if (isDirty) {
      setShowCancelConfirm(true);
    } else {
      onClose();
    }
  };

  // 提交按钮禁用条件：正在加载 或 表单无效（必填未填 / 校验失败）
  const isSubmitDisabled = isLoading || !form.formState.isValid;

  // 是否存在必填项：用于决定是否渲染"必填项"图例
  const hasRequired = fields.some((f) => f.required);
  const requiredCount = fields.filter((f) => f.required).length;

  // 字段分组（按 order 排序）
  const groupMap = useMemo(() => {
    const list = groups ?? DEFAULT_GROUPS;
    return new Map(list.map((g) => [g.key, g]));
  }, [groups]);

  const sortedFields = useMemo(() => {
    return [...fields].sort((a, b) => {
      const ga = groupMap.get(a.group ?? "default")?.order ?? 99;
      const gb = groupMap.get(b.group ?? "default")?.order ?? 99;
      return ga - gb;
    });
  }, [fields, groupMap]);

  // 按分组聚合字段，保留原始顺序
  const groupedFields = useMemo(() => {
    const result: Array<{ groupKey: string; groupTitle: string; fields: FormFieldConfig[] }> = [];
    sortedFields.forEach((field) => {
      const key = field.group ?? "default";
      const last = result[result.length - 1];
      if (last && last.groupKey === key) {
        last.fields.push(field);
      } else {
        result.push({
          groupKey: key,
          groupTitle: groupMap.get(key)?.title ?? "其他",
          fields: [field],
        });
      }
    });
    return result;
  }, [sortedFields, groupMap]);

  return (
    <>
      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) tryClose();
        }}
      >
        <DialogContent size="wide" className="border-border max-h-[90vh] flex flex-col">
          <DialogHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-4">
            <div className="space-y-1">
              <DialogTitle className="text-base font-semibold tracking-tight text-foreground">
                {title}
              </DialogTitle>
              {description ? (
                <DialogDescription className="text-[12px] leading-5 text-muted-foreground/80">
                  {description}
                </DialogDescription>
              ) : null}
            </div>
          </DialogHeader>

          <Form {...form}>
            <form
              onSubmit={handleSubmit}
              className="flex flex-col min-h-0 flex-1"
              noValidate
            >
              {/* P0-1：必填图例移到表单顶部第一行（在字段组之上） */}
              {hasRequired && (
                <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span aria-hidden className="form-required-dot" />
                    <span>为必填项（共 {requiredCount} 项）</span>
                  </span>
                  <span className="hidden sm:inline opacity-50">·</span>
                  <span>标注 <span aria-hidden className="form-required-dot" /> 的字段需填写后才能保存</span>
                </div>
              )}

              <div className="flex-1 overflow-y-auto pr-1 -mr-1">
                <FormFieldsRenderer form={form} groups={groupedFields} />
              </div>

              <DialogFooter className="mt-6 gap-2 border-t border-white/[0.06] bg-white/[0.01] -mx-6 px-6 -mb-6 pb-4 pt-4">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={tryClose}
                  disabled={isLoading}
                >
                  取消
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitDisabled}
                  className="shadow-sm"
                >
                  {isLoading ? (loadingLabel ?? `${submitLabel}中...`) : submitLabel}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* 取消二次确认（P1-9） */}
      <ConfirmDialog
        isOpen={showCancelConfirm}
        onClose={() => setShowCancelConfirm(false)}
        onConfirm={() => {
          setShowCancelConfirm(false);
          setIsDirty(false);
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

/** 是否属于"长字段"——需要独占整行展示（在两种布局下都占满）。 */
function isLongField(field: FormFieldConfig): boolean {
  return (
    field.type === "textarea" ||
    field.type === "image" ||
    field.type === "tags" ||
    field.type === "entity-multi"
  );
}

/**
 * 字段标签（左右结构专用）。
 *
 * 视觉规范：
 * - 必填项：标签前 emerald 圆点（避免与"错误/警告"的红色星号语义冲突）。
 * - 非必填：纯文字标签，靠颜色字重区分。
 * - 标签左对齐 + 垂直居中（短字段）/ 顶部对齐（长字段）。
 * - 字号 13px、字重 500，颜色 text-foreground/80。
 */
function FormFieldLabel({
  label,
  required,
  for: htmlFor,
  isLong = false,
}: {
  label: string;
  required?: boolean;
  for?: string;
  isLong?: boolean;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={`flex items-start gap-2 text-[13px] font-medium leading-5 text-foreground/80 ${
        isLong ? "pt-2.5" : "pt-[7px]"
      }`}
    >
      {required && (
        <span
          aria-hidden
          className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.12)]"
        />
      )}
      {!required && (
        <span aria-hidden className="mt-2 inline-block h-1.5 w-1.5 shrink-0" />
      )}
      <span>{label}</span>
    </label>
  );
}

/**
 * 字段渲染器：根据每个字段的 layout 决定是"标签上 / 控件下"（vertical）还是
 * "标签左 / 控件右"（horizontal）。
 *
 * 设计规范（v2 视觉升级）：
 * - 必填项：标签前 emerald 圆点，代替红色星号（避免与错误色冲突）。
 * - 标签左对齐 + 13px + font-medium + text-foreground/80。
 * - horizontal 短字段：3:9 栅格，items-center；长字段：3:9 栅格，items-start，标签加 padding-top。
 * - 字段行间距 gap-y-5（20px），控件行内间距 gap-x-4。
 * - 错误提示：text-red-400，固定高度区域（避免抖动），顶部 6px 间距。
 * - 提示文案：text-muted-foreground/80，12px。
 */
function FormFieldsRenderer({
  form,
  groups,
}: {
  form: import("react-hook-form").UseFormReturn<Record<string, unknown>>;
  groups: Array<{ groupKey: string; groupTitle: string; fields: FormFieldConfig[] }>;
}) {
  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => (
        <section key={group.groupKey} className="flex flex-col gap-4">
          <div className="form-group-title" aria-hidden>
            <span>{group.groupTitle}</span>
          </div>
          <div className="grid grid-cols-1 gap-x-4 gap-y-5">
            {group.fields.map((field) => {
              const isHorizontal = field.layout === "horizontal";
              const long = isLongField(field);

              if (isHorizontal && !long) {
                return (
                  <FormField
                    key={field.name}
                    control={form.control}
                    name={field.name}
                    render={({ field: f }) => (
                      <FormItem className="grid grid-cols-12 items-start gap-x-4 space-y-0">
                        <div className="col-span-12 md:col-span-3">
                          <FormFieldLabel label={field.label} required={field.required} for={f.name} />
                        </div>
                        <div className="col-span-12 md:col-span-9 space-y-1.5">
                          <FormControl>{renderFieldControl(field, f)}</FormControl>
                          {field.hint && (
                            <p className="text-[12px] leading-4 text-muted-foreground/80">{field.hint}</p>
                          )}
                          <FormMessage className="text-[12px] leading-4" />
                        </div>
                      </FormItem>
                    )}
                  />
                );
              }

              if (isHorizontal && long) {
                return (
                  <FormField
                    key={field.name}
                    control={form.control}
                    name={field.name}
                    render={({ field: f }) => (
                      <FormItem className="grid grid-cols-12 items-start gap-x-4 space-y-0">
                        <div className="col-span-12 md:col-span-3">
                          <FormFieldLabel label={field.label} required={field.required} for={f.name} isLong />
                        </div>
                        <div className="col-span-12 md:col-span-9 space-y-1.5">
                          <FormControl>{renderFieldControl(field, f)}</FormControl>
                          {field.hint && (
                            <p className="text-[12px] leading-4 text-muted-foreground/80">{field.hint}</p>
                          )}
                          <FormMessage className="text-[12px] leading-4" />
                        </div>
                      </FormItem>
                    )}
                  />
                );
              }

              // vertical（默认）：与原行为一致，但视觉风格同步升级
              return (
                <FormField
                  key={field.name}
                  control={form.control}
                  name={field.name}
                  render={({ field: f }) => (
                    <FormItem className="space-y-1.5">
                      <FormFieldLabel label={field.label} required={field.required} for={f.name} />
                      <FormControl>{renderFieldControl(field, f)}</FormControl>
                      {field.hint && (
                        <p className="text-[12px] leading-4 text-muted-foreground/80">{field.hint}</p>
                      )}
                      <FormMessage className="text-[12px] leading-4" />
                    </FormItem>
                  )}
                />
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

/** 渲染单个字段的控件（根据 type 选择对应组件）。 */
function renderFieldControl(
  field: FormFieldConfig,
  // react-hook-form 的 field 类型：{ value, onChange, onBlur, ref, name }
  f: {
    value: unknown;
    onChange: (...args: unknown[]) => void;
    onBlur: () => void;
    ref: React.Ref<HTMLElement>;
    name: string;
  },
) {
  switch (field.type) {
    case "text":
      return (
        <Input
          name={f.name}
          value={(f.value as string) ?? ""}
          onChange={(e) => f.onChange(e.target.value)}
          onBlur={f.onBlur}
          placeholder={field.placeholder}
        />
      );
    case "number":
      return (
        <Input
          type="number"
          name={f.name}
          value={(f.value as string | number) ?? ""}
          onChange={(e) => f.onChange(e.target.value)}
          onBlur={f.onBlur}
          placeholder={field.placeholder}
          min={field.min}
          max={field.max}
        />
      );
    case "textarea":
      return (
        <Textarea
          name={f.name}
          value={(f.value as string) ?? ""}
          onChange={(e) => f.onChange(e.target.value)}
          onBlur={f.onBlur}
          placeholder={field.placeholder}
          rows={field.rows ?? 4}
        />
      );
    case "select":
      return (
        <Controller
          name={f.name}
          // 使用独立 Controller 包装 Select 以避免 RHF 与 onValueChange 的 onChange 类型冲突
          render={({ field: cf }) => (
            <Select
              value={(cf.value as string) ?? ""}
              onValueChange={cf.onChange}
              onOpenChange={(open) => {
                if (!open) cf.onBlur();
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={field.placeholder ?? "请选择..."} />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      );
    case "image":
      return (
        <ImageUploader
          value={(f.value as string) ?? ""}
          onChange={(url) => f.onChange(url)}
          maxSize={field.imageConfig?.maxSize}
          placeholder={field.imageConfig?.placeholder}
          onUpload={field.imageConfig?.onUpload}
        />
      );
    case "tags":
      return (
        <TagInput
          value={(f.value as string[]) ?? []}
          onChange={(tags) => f.onChange(tags)}
          placeholder={field.placeholder}
          suggestions={field.tagSuggestions}
          maxTags={field.maxTags}
        />
      );
    case "entity-multi": {
      const cfg = field.entityMultiConfig;
      if (!cfg) {
        return (
          <div className="text-xs text-red-400">
            entity-multi 字段缺少 entityMultiConfig 配置
          </div>
        );
      }
      return (
        <EntityMultiPicker
          value={(f.value as string[]) ?? []}
          onChange={(ids) => f.onChange(ids)}
          fetcher={cfg.fetcher}
          formatLabel={cfg.formatLabel}
          formatHint={cfg.formatHint}
          maxItems={cfg.maxItems}
          renderChip={cfg.renderChip}
          placeholder={field.placeholder}
        />
      );
    }
    default:
      return <></>;
  }
}
