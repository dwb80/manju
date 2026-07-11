"use client";

/**
 * 新建/编辑剧本对话框
 */

import { FormDialog, type FormFieldConfig } from "@/components/ui/form-dialog";
import type { Script } from "@/lib/module-types";

/** 剧本表单字段配置 - 补全数据项 */
const scriptFields: FormFieldConfig[] = [
  { name: "title", label: "剧本标题", type: "text", required: true, placeholder: "请输入剧本标题" },
  { name: "author", label: "作者", type: "text", required: true, placeholder: "请输入作者名" },
  {
    name: "status",
    label: "状态",
    type: "select",
    required: true,
    options: [
      { value: "draft", label: "草稿" },
      { value: "active", label: "进行中" },
      { value: "review", label: "审核中" },
      { value: "completed", label: "已完成" },
      { value: "archived", label: "已归档" },
    ],
    defaultValue: "draft",
  },
  { name: "description", label: "剧本初始内容", type: "textarea", placeholder: "请输入剧本正文内容（将自动写入编辑器首段）", rows: 6, hint: "下方填写的内容将自动写入编辑器首段" },
  { name: "genre", label: "剧本类型", type: "select", options: [
    { value: "", label: "不限" },
    { value: "ancient", label: "古装剧" },
    { value: "modern", label: "现代剧" },
    { value: "scifi", label: "科幻剧" },
    { value: "fantasy", label: "奇幻剧" },
    { value: "suspense", label: "悬疑剧" },
    { value: "comedy", label: "喜剧" },
    { value: "romance", label: "言情剧" },
  ]},
  { name: "words", label: "字数", type: "number", placeholder: "0", min: 0 },
  { name: "chapters", label: "章节数", type: "number", placeholder: "0", min: 0 },
];

export function ScriptFormDialog({
  editingScript,
  isOpen,
  onClose,
  onSave,
  isSaving,
}: {
  editingScript: Script | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (values: Record<string, string | number | string[]>) => void;
  isSaving: boolean;
}) {
  return (
    <FormDialog
      title={editingScript ? "编辑剧本" : "新建剧本"}
      fields={scriptFields}
      initialValues={
        editingScript
          ? ({
              title: editingScript.title,
              author: editingScript.author,
              status: editingScript.status,
              description: editingScript.description ?? "",
              words: editingScript.words ?? 0,
              chapters: editingScript.chapters ?? 0,
            } as Record<string, string | number>)
          : {}
      }
      isOpen={isOpen}
      onClose={onClose}
      onSave={onSave}
      isLoading={isSaving}
    />
  );
}
