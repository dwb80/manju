"use client";

/**
 * AI生成剧本对话框
 */

import { FormDialog, type FormFieldConfig } from "@/components/ui/form-dialog";

/** AI生成剧本表单字段 */
const aiGenerateFields: FormFieldConfig[] = [
  { name: "prompt", label: "创意描述", type: "textarea", required: true, placeholder: "请输入您的创意构思（1-1000字），描述越详细，AI生成效果越好", rows: 5 },
  {
    name: "style",
    label: "剧本风格",
    type: "select",
    options: [
      { value: "", label: "默认" },
      { value: "轻松", label: "轻松" },
      { value: "严肃", label: "严肃" },
      { value: "搞笑", label: "搞笑" },
      { value: "悬疑", label: "悬疑" },
      { value: "浪漫", label: "浪漫" },
      { value: "史诗", label: "史诗" },
    ],
    defaultValue: "",
  },
  {
    name: "genre",
    label: "剧本类型",
    type: "select",
    options: [
      { value: "", label: "不限" },
      { value: "ancient", label: "古装剧" },
      { value: "modern", label: "现代剧" },
      { value: "scifi", label: "科幻剧" },
      { value: "fantasy", label: "奇幻剧" },
      { value: "suspense", label: "悬疑剧" },
      { value: "comedy", label: "喜剧" },
      { value: "romance", label: "言情剧" },
    ],
    defaultValue: "",
  },
  {
    name: "length",
    label: "目标字数",
    type: "select",
    options: [
      { value: "3000", label: "短篇（约3000字）" },
      { value: "8000", label: "中篇（约8000字）" },
      { value: "15000", label: "长篇（约15000字）" },
      { value: "30000", label: "超长篇（约30000字）" },
    ],
    defaultValue: "8000",
  },
];

export function AIGenerateDialog({
  isOpen,
  onClose,
  onSave,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (values: Record<string, string | number>) => void;
  isLoading: boolean;
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
      title="AI生成剧本"
      fields={aiGenerateFields}
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
      isLoading={isLoading}
      submitLabel="开始生成"
      loadingLabel="生成中..."
    />
  );
}
