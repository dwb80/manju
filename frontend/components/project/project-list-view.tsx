/**
 * @file project-list-view.tsx
 * @description 项目列表视图组件，提示用户选择项目
 */

"use client";

import { Card } from "@/components/ui/card";

/**
 * ProjectListView - 项目列表视图组件
 * @returns {JSX.Element} 渲染的项目列表视图元素
 */
export function ProjectListView() {
  return (
    <Card className="border-border bg-secondary p-6 text-sm text-foreground/80">
      请先在左侧选择一个具体项目。
    </Card>
  );
}