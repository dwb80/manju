/**
 * @file tag-input.tsx
 * @description 通用标签输入组件，支持回车/逗号添加、点击删除、预设标签
 */

"use client";

import { useState, KeyboardEvent } from "react";
import { X, Plus } from "lucide-react";

export interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  maxTags?: number;
  disabled?: boolean;
  /** 预设标签（点击即添加） */
  suggestions?: string[];
}

/**
 * TagInput - 通用标签输入组件
 * @param {TagInputProps} props - 组件属性
 * @returns {JSX.Element} 渲染的标签输入元素
 */
export function TagInput({
  value = [],
  onChange,
  placeholder = "输入标签后回车...",
  maxTags = 20,
  disabled = false,
  suggestions = [],
}: TagInputProps) {
  const [draft, setDraft] = useState("");

  const normalize = (t: string) => t.trim().replace(/\s+/g, " ");

  const addTag = (raw: string) => {
    const tag = normalize(raw);
    if (!tag) return;
    if (value.length >= maxTags) return;
    if (value.some((v) => v.toLowerCase() === tag.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...value, tag]);
    setDraft("");
  };

  const removeTag = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(draft);
    } else if (e.key === "Backspace" && !draft && value.length > 0) {
      removeTag(value.length - 1);
    }
  };

  const remainingSuggestions = suggestions.filter(
    (s) => !value.some((v) => v.toLowerCase() === s.toLowerCase())
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5 min-h-9 rounded-md border border-border bg-muted px-2 py-1.5 focus-within:border-primary">
        {value.map((tag, idx) => (
          <span
            key={`${tag}-${idx}`}
            className="inline-flex items-center gap-1 rounded-md bg-primary/20 px-2 py-0.5 text-xs text-primary"
          >
            {tag}
            {!disabled && (
              <button
                type="button"
                onClick={() => removeTag(idx)}
                className="hover:text-red-400"
                aria-label={`删除标签 ${tag}`}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        ))}
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => draft && addTag(draft)}
          placeholder={value.length === 0 ? placeholder : ""}
          disabled={disabled || value.length >= maxTags}
          className="flex-1 min-w-[100px] bg-transparent text-sm outline-none placeholder:text-[#666]"
        />
      </div>
      {remainingSuggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-[#666]">推荐：</span>
          {remainingSuggestions.slice(0, 8).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => addTag(s)}
              disabled={disabled}
              className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-[#aaa] hover:bg-white/10 hover:text-white disabled:opacity-50"
            >
              <Plus className="h-2.5 w-2.5" />
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
