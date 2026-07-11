"use client";

import { Card } from "@/components/ui/card";

/** 渲染项目列表视图 - 提示用户选择项目 */
export function ProjectListView() {
  return (
    <Card className="border-white/10 bg-[#2a2a2a] p-6 text-sm text-[#dddddd]">
      请先在左侧选择一个具体项目。
    </Card>
  );
}