"use client";

/**
 * 工厂页工具栏内"批量改类型"下拉菜单
 *
 * - 点击按钮展开/收起面板
 * - 面板由全屏覆盖层 + 列表组成（点击外部自动关闭）
 * - 选中某项后调用 onSelect 并关闭面板
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { FilterOption } from "../types";

export function BatchChangeTypeMenu({
  options,
  onSelect,
  label,
}: {
  options: FilterOption[];
  onSelect: (value: string) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <Button variant="secondary" size="sm" onClick={() => setOpen((v) => !v)} className="text-xs">
        {label}
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-30 mt-1 min-w-[140px] max-h-72 overflow-y-auto rounded-md border border-white/10 bg-[#202020] py-1 shadow-lg">
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setOpen(false);
                  onSelect(opt.value);
                }}
                className="w-full px-3 py-1.5 text-left text-xs text-white hover:bg-white/10"
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
