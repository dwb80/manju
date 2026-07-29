"use client";

import { useState } from "react";
import { TargetListPage } from "@/components/governance";
import { Button } from "@/components/ui/button";

const TYPES = ["all", "import", "export", "backup", "restore", "cleanup"] as const;

export default function DataJobsPage() {
  const [type, setType] = useState<(typeof TYPES)[number]>("all");
  const query = type === "all" ? "" : `?type=${type}`;
  return <TargetListPage title="数据作业与恢复中心" description="统一查看导入、导出、备份、恢复和永久清理的后台状态与审计结果" endpoint={`/api/v1/operation-jobs${query}`} emptyText="当前没有数据作业。失败、超时和结果未知的作业会保留可操作原因。" actions={<div className="flex flex-wrap gap-1">{TYPES.map((value) => <Button key={value} size="sm" variant={type === value ? "default" : "outline"} onClick={() => setType(value)}>{value}</Button>)}</div>} />;
}

