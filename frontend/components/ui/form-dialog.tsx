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

import { useEffect, useMemo, useRef } from "react";
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
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
  });

  const prevIsOpenRef = useRef(false);
  // 仅在对话框从关闭变为打开时重置一次表单
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      form.reset(buildDefaults(fields, initialValues));
    }
    prevIsOpenRef.current = isOpen;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleSubmit = form.handleSubmit((values) => {
    onSave(values as Record<string, string | number | string[]>);
  });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="wide" className="border-border">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto pr-1">
              {fields.map((field) => {
                const isFullSpan =
                  field.type === "textarea" ||
                  field.type === "image" ||
                  field.type === "tags" ||
                  field.type === "entity-multi";
                return (
                  <div key={field.name} className={isFullSpan ? "md:col-span-2" : ""}>
                    <FormField
                      control={form.control}
                      name={field.name}
                      render={({ field: f }) => (
                        <FormItem>
                          <FormLabel>
                            {field.label}
                            {field.required && <span className="text-destructive ml-1">*</span>}
                          </FormLabel>
                          <FormControl>
                            {renderFieldControl(field, f)}
                          </FormControl>
                          {field.hint && <p className="text-xs text-muted-foreground mt-1">{field.hint}</p>}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                );
              })}
            </div>

            <DialogFooter className="mt-4">
              <Button type="button" size="sm" variant="secondary" onClick={onClose} disabled={isLoading}>
                取消
              </Button>
              <Button type="submit" size="sm" disabled={isLoading}>
                {isLoading ? (loadingLabel ?? `${submitLabel}中...`) : submitLabel}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
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
      return null;
  }
}
