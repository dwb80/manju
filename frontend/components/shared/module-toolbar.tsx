/**
 * @file module-toolbar.tsx
 * @description 模块工具栏组件集合，提供统一的工具栏布局、搜索输入和筛选功能
 */

"use client";

import { ReactNode } from "react";
import { Search } from "lucide-react";

/**
 * 模块工具栏组件
 *
 * 功能：
 * - 统一的工具栏布局
 * - 搜索和筛选区域
 * - 操作按钮区域
 */

interface ModuleToolbarProps {
  /** 左侧内容（搜索、筛选） */
  left?: ReactNode;
  /** 右侧内容（操作按钮） */
  right?: ReactNode;
}

/**
 * ModuleToolbar - 模块工具栏组件
 * @param {ModuleToolbarProps} props - 组件属性
 * @returns {JSX.Element} 渲染的工具栏元素
 */
export function ModuleToolbar({ left, right }: ModuleToolbarProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
      <div className="flex flex-col md:flex-row gap-3">
        {left}
      </div>
      <div className="flex gap-2">
        {right}
      </div>
    </div>
  );
}

/**
 * 搜索输入框组件
 */

interface SearchInputProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * SearchInput - 搜索输入框组件
 * @param {SearchInputProps} props - 组件属性
 * @returns {JSX.Element} 渲染的搜索输入框元素
 */
export function SearchInput({
  value,
  onChange,
  placeholder = "搜索...",
  className = ""
}: SearchInputProps) {
  return (
    <div className={`relative ${className}`}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#888]" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        className="w-full md:w-64 h-9 pl-10 pr-4 rounded-lg border border-white/10 bg-[#252525] text-sm text-white placeholder-[#888] focus:border-emerald-500/50 focus:outline-none"
        aria-label={placeholder}
      />
    </div>
  );
}

/**
 * 筛选选择器组件
 */

interface FilterSelectProps {
  value?: string;
  onChange?: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
}

/**
 * FilterSelect - 筛选选择器组件
 * @param {FilterSelectProps} props - 组件属性
 * @returns {JSX.Element} 渲染的筛选选择器元素
 */
export function FilterSelect({
  value,
  onChange,
  options,
  placeholder = "筛选...",
  className = ""
}: FilterSelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      className={`h-9 px-3 rounded-lg border border-white/10 bg-[#252525] text-sm text-white focus:border-emerald-500/50 focus:outline-none ${className}`}
      aria-label={placeholder}
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

/**
 * 标签筛选组件
 */

interface TagFilterProps {
  tags: string[];
  selectedTags: string[];
  onChange: (tags: string[]) => void;
  className?: string;
}

export function TagFilter({
  tags,
  selectedTags,
  onChange,
  className = ""
}: TagFilterProps) {
  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      onChange(selectedTags.filter((t) => t !== tag));
    } else {
      onChange([...selectedTags, tag]);
    }
  };

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {tags.map((tag) => (
        <button
          key={tag}
          onClick={() => toggleTag(tag)}
          className={`px-3 py-1 rounded-full text-xs transition-colors ${selectedTags.includes(tag)
            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
            : 'bg-[#252525] text-[#888] border border-white/10 hover:border-white/20'
            }`}
        >
          {tag}
        </button>
      ))}
    </div>
  );
}