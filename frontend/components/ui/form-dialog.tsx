"use client";

import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ImageUploader } from "@/components/shared/image-uploader";
import { TagInput } from "@/components/shared/tag-input";

/** 表单字段类型 */
export type FieldType = "text" | "textarea" | "select" | "number" | "image" | "tags";

/** 图片上传字段扩展配置 */
export interface ImageFieldConfig {
  /** 上传回调（可选；不传则降级为 base64） */
  onUpload?: (file: File) => Promise<string>;
  /** 最大字节数 */
  maxSize?: number;
  /** 占位提示 */
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
  /** image 类型的扩展配置 */
  imageConfig?: ImageFieldConfig;
  /** tags 类型的扩展配置：推荐标签 */
  tagSuggestions?: string[];
  /** tags 类型的扩展配置：最大标签数 */
  maxTags?: number;
  /** 字段下方的提示文案（用于补充说明） */
  hint?: string;
}

/** 表单对话框属性 */
export interface FormDialogProps {
  title: string;
  fields: FormFieldConfig[];
  initialValues?: Record<string, string | number | string[]>;
  isOpen: boolean;
  onClose: () => void;
  onSave: (values: Record<string, string | number | string[]>) => void;
  isLoading?: boolean;
}

/** 通用表单对话框组件 */
export function FormDialog({
  title,
  fields,
  initialValues = {},
  isOpen,
  onClose,
  onSave,
  isLoading = false,
}: FormDialogProps) {
  const [values, setValues] = useState<Record<string, string | number | string[]>>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const prevIsOpenRef = useRef(false);

  // 仅在对话框从关闭变为打开时初始化一次表单值，避免无限更新循环
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      const initValues: Record<string, string | number | string[]> = {};
      fields.forEach((field) => {
        const initialVal = initialValues[field.name];
        if (initialVal !== undefined) {
          initValues[field.name] = initialVal;
        } else if (field.type === "tags") {
          initValues[field.name] = (field.defaultValue as string[]) ?? [];
        } else {
          initValues[field.name] = field.defaultValue ?? "";
        }
      });
      setValues(initValues);
      setErrors({});
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen]); // 故意省略 initialValues/fields，仅在打开时初始化一次

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    fields.forEach((field) => {
      if (field.required) {
        const value = values[field.name];
        if (field.type === "tags") {
          if (!Array.isArray(value) || value.length === 0) {
            newErrors[field.name] = `${field.label}为必填项`;
          }
        } else if (value === "" || value === undefined || value === null) {
          newErrors[field.name] = `${field.label}为必填项`;
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSave(values);
    }
  };

  const handleChange = (name: string, value: string | number | string[]) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    // 清除该字段的错误
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[90] grid place-items-center bg-black/60 px-4 backdrop-blur-sm overflow-y-auto py-8"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="w-full max-w-2xl max-h-[calc(100vh-4rem)] rounded-2xl border border-white/10 bg-[#202020] p-5 shadow-2xl flex flex-col">
        {/* 标题栏 */}
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-md hover:bg-white/10 flex items-center justify-center"
            aria-label="关闭"
          >
            <X className="h-4 w-4 text-[#888]" />
          </button>
        </div>

        {/* 表单内容 - 两列布局 */}
        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 gap-y-4 overflow-y-auto pr-1">
            {fields.map((field) => {
              // textarea/image/tags 字段跨两列
              const isFullSpan = field.type === "textarea" || field.type === "image" || field.type === "tags";
              return (
                <div key={field.name} className={isFullSpan ? "md:col-span-2" : ""}>
                  <label className="block text-sm font-medium text-[#888] mb-1.5">
                    {field.label}
                    {field.required && <span className="text-red-400 ml-1">*</span>}
                  </label>

                  {field.type === "text" && (
                    <Input
                      name={field.name}
                      value={(values[field.name] as string) ?? ""}
                      onChange={(e) => handleChange(field.name, e.target.value)}
                      placeholder={field.placeholder}
                      className={errors[field.name] ? "border-red-400" : ""}
                    />
                  )}

                  {field.type === "number" && (
                    <Input
                      type="number"
                      name={field.name}
                      value={(values[field.name] as string) ?? ""}
                      onChange={(e) => handleChange(field.name, e.target.value)}
                      placeholder={field.placeholder}
                      min={field.min}
                      max={field.max}
                      className={errors[field.name] ? "border-red-400" : ""}
                    />
                  )}

                  {field.type === "textarea" && (
                    <Textarea
                      name={field.name}
                      value={(values[field.name] as string) ?? ""}
                      onChange={(e) => handleChange(field.name, e.target.value)}
                      placeholder={field.placeholder}
                      rows={field.rows ?? 4}
                      className={errors[field.name] ? "border-red-400" : ""}
                    />
                  )}

                  {field.type === "select" && (
                    <select
                      name={field.name}
                      value={(values[field.name] as string) ?? ""}
                      onChange={(e) => handleChange(field.name, e.target.value)}
                      className={`h-10 w-full rounded-md border bg-muted px-3 text-sm outline-none focus:border-primary ${
                        errors[field.name] ? "border-red-400" : "border-border"
                      }`}
                    >
                      <option value="" disabled>
                        {field.placeholder ?? "请选择..."}
                      </option>
                      {field.options?.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  )}

                  {field.type === "image" && (
                    <ImageUploader
                      value={(values[field.name] as string) ?? ""}
                      onChange={(url) => handleChange(field.name, url)}
                      maxSize={field.imageConfig?.maxSize}
                      placeholder={field.imageConfig?.placeholder}
                      onUpload={field.imageConfig?.onUpload}
                    />
                  )}

                  {field.type === "tags" && (
                    <TagInput
                      value={(values[field.name] as string[]) ?? []}
                      onChange={(tags) => handleChange(field.name, tags)}
                      placeholder={field.placeholder}
                      suggestions={field.tagSuggestions}
                      maxTags={field.maxTags}
                    />
                  )}

                  {errors[field.name] && (
                    <p className="text-xs text-red-400 mt-1">{errors[field.name]}</p>
                  )}
                  {!errors[field.name] && field.hint && (
                    <p className="text-xs text-[#888] mt-1">{field.hint}</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* 操作按钮 */}
          <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-white/10 flex-shrink-0">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={onClose}
              disabled={isLoading}
            >
              取消
            </Button>
            <Button type="submit" size="sm" disabled={isLoading}>
              {isLoading ? "保存中..." : "保存"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}