"use client";

/**
 * 实体引用选择器
 *
 * 用途：在创建/编辑表单中，"分镜→场景"、"视频→分镜"、"音频→角色"
 * 这类"指向其他模块实体"的字段，不再用文本输入 ID，而是下拉选实体。
 *
 * 设计原则：
 * - 高度解耦：本组件不感知具体业务，只接收"获取列表"和"展示文本"两个函数。
 * - 数据获取可注入：调用方决定从哪个 service 加载数据。
 * - 可空：通过 allowEmpty + emptyLabel 决定是否显示"无"选项。
 * - 命中服务端数据：组件内部会缓存列表，切换项目时自动重载。
 */

import { useEffect, useState } from "react";
import { useProjectStore } from "@/lib/stores/project-store";

export interface EntityPickerProps<T extends { id: string; name?: string; title?: string }> {
  /** 表单字段名。 */
  name: string;
  /** 字段标签。 */
  label: string;
  /** 字段占位提示。 */
  placeholder?: string;
  /** 是否必填。 */
  required?: boolean;
  /** 当前值（实体 id）。 */
  value: string;
  /** 值变更回调。 */
  onChange: (value: string) => void;
  /** 加载实体列表的函数。 */
  fetcher: (projectId: string) => Promise<T[]>;
  /** 把实体转成展示文本。 */
  formatLabel: (item: T) => string;
  /** 把实体转成辅助说明（可选）。 */
  formatHint?: (item: T) => string;
  /** 是否允许空值（默认 true）。 */
  allowEmpty?: boolean;
  /** 空值文案（默认 "无"）。 */
  emptyLabel?: string;
  /** 自定义 className。 */
  className?: string;
}

/**
 * EntityPicker - 实体引用选择器组件
 * @param {EntityPickerProps<T>} props - 组件属性
 * @returns {JSX.Element} 渲染的选择器元素
 */
export function EntityPicker<T extends { id: string; name?: string; title?: string }>({
  name,
  label,
  placeholder = "请选择",
  required = false,
  value,
  onChange,
  fetcher,
  formatLabel,
  formatHint,
  allowEmpty = true,
  emptyLabel = "无",
  className,
}: EntityPickerProps<T>) {
  const selectedProjectId = useProjectStore((s) => s.selectedProjectId);
  const [items, setItems] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!selectedProjectId) {
      setItems([]);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    fetcher(selectedProjectId)
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch((err) => console.error(`EntityPicker(${name}) load failed`, err))
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedProjectId, fetcher, name]);

  return (
    <div className={className}>
      <label className="mb-1 block text-xs text-[#888]">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      <select
        name={name}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-white/10 bg-[#1a1a1a] px-3 py-2 text-sm text-white focus:border-emerald-500/50 focus:outline-none"
        disabled={isLoading}
      >
        {allowEmpty && <option value="">{emptyLabel}</option>}
        {!isLoading && items.length === 0 && (
          <option value="" disabled>
            （无可选项）
          </option>
        )}
        {items.map((it) => (
          <option key={it.id} value={it.id}>
            {formatLabel(it)}
            {formatHint ? ` (${formatHint(it)})` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
