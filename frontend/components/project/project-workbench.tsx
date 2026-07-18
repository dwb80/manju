"use client";

import { type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type WorkbenchPagerProps = {
  total: number;
  page: number;
  pageSize: number;
  label: string;
  onPageChange: (page: number) => void;
};

/**
 * WorkbenchPager - 工作台分页器组件
 * @param {WorkbenchPagerProps} props - 组件属性
 * @returns {JSX.Element} 渲染的分页器元素
 */
export function WorkbenchPager({ total, page, pageSize, label, onPageChange }: WorkbenchPagerProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(page, 1), pageCount);
  const start = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(total, safePage * pageSize);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#202020] px-4 py-3 text-sm text-[#d8d8d8]">
      <div className="font-medium">
        {label}: 共 {total} 条
        {total > 0 && <span className="ml-2 text-[#bfbfbf]">当前 {start}-{end}</span>}
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="secondary" disabled={safePage <= 1} onClick={() => onPageChange(safePage - 1)}>上一页</Button>
        <span className="min-w-16 text-center font-semibold text-[#eeeeee]">{safePage} / {pageCount}</span>
        <Button size="sm" variant="secondary" disabled={safePage >= pageCount} onClick={() => onPageChange(safePage + 1)}>下一页</Button>
      </div>
    </div>
  );
}

type ManagementTableProps = {
  columns: string[];
  children: ReactNode;
};

/**
 * Provides a consistent table shell for CRUD-oriented project workspace pages.
 */
export function ManagementTable({ columns, children }: ManagementTableProps) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card">
      <Table className="min-w-[860px] text-left text-sm">
        <TableHeader className="border-b border-border bg-white/[0.04] text-[#d8d8d8]">
          <TableRow>
            {columns.map((column) => (
              <TableHead key={column} className="px-4 py-3 font-semibold">{column}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y divide-white/10">{children}</TableBody>
      </Table>
    </div>
  );
}

type PortraitImageLinkProps = {
  href: string;
  src: string;
  alt: string;
  onLoad?: () => void;
};

/**
 * Shows generated portrait images without stretching while keeping a stable 9:16 frame.
 */
export function PortraitImageLink({ href, src, alt, onLoad }: PortraitImageLinkProps) {
  return (
    <a
      className="mx-auto block aspect-[9/16] max-h-[72vh] overflow-hidden bg-[#171717]"
      style={{ width: "min(100%, calc(72vh * 9 / 16))" }}
      href={href}
      target="_blank"
      rel="noreferrer"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="h-full w-full cursor-zoom-in object-contain" src={src} alt={alt} onLoad={onLoad} />
    </a>
  );
}
