"use client";

import Link from "next/link";
import { Database, FileText, KeyRound, ShieldCheck } from "lucide-react";

const panels = [
  { title: "模型与凭据", description: "管理 Provider 模型、配额和加密凭据。", href: "/models", icon: KeyRound },
  { title: "审计日志", description: "查看客户端和服务端的重要操作记录。", href: "/logs", icon: FileText },
  { title: "数据与成本", description: "核对项目成本、质量和产能数据。", href: "/data", icon: Database },
  { title: "安全状态", description: "认证、权限、备份与内容安全由后端策略强制执行。", href: "/settings", icon: ShieldCheck },
];

export function AdminPanels() {
  return <div className="grid gap-3 sm:grid-cols-2">{panels.map(({ title, description, href, icon: Icon }) => (
    <Link key={title} href={href} className="rounded-xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-white/20 hover:bg-white/[0.06]">
      <div className="flex items-center gap-2 text-sm font-medium text-white"><Icon className="h-4 w-4 text-emerald-400" />{title}</div>
      <p className="mt-2 text-xs leading-5 text-neutral-500">{description}</p>
    </Link>
  ))}</div>;
}
