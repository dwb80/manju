"use client";

/**
 * 新建/编辑剧本对话框
 */

import { FormDialog, type FormFieldConfig } from "@/components/ui/form-dialog";
import type { Script } from "@/lib/module-types";

/** 剧本表单字段配置 - 方案 A：合并 Path A/B 元数据
 *  - words/chapters 字段移除（后端从 editor_json / script_episodes 自动计算）
 *  - 其他字段保留作为"创建剧本时"的元数据录入
 */
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
  // 方案 A：words / chapters 由后端从 editor_json / script_episodes 自动计算，
  // 不在创建表单中要求用户填写。编辑时可在"继续编辑"页面顶部看到实时统计。
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
  onSave: (values: Record<string, string | number>) => void;
  isSaving: boolean;
}) {
  const handleSave = (values: Record<string, string | number | string[]>) => {
    const simpleValues: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(values)) {
      if (typeof value === "string" || typeof value === "number") {
        simpleValues[key] = value;
      }
    }
    onSave(simpleValues);
  };

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
              // 方案 A 修复：移除 words / chapters 字段的冗余赋值
              // 这些字段由后端从 editor_json / script_episodes 自动计算，不再写入表单
            } as Record<string, string | number>)
          : {}
      }
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
      isLoading={isSaving}
    />
  );
}
