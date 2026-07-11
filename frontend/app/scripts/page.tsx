"use client";

/**
 * 剧本中心路由页面
 *
 * 路由: /scripts
 * 功能: 渲染剧本中心列表页
 *
 * URL 参数：
 * - projectId:  从项目中心跳转过来时携带，自动选中该项目
 * - action=import:  自动打开"导入剧本"对话框（项目无剧本时使用）
 *
 * 注意：客户端组件用 useSearchParams 需要包 Suspense 兜底
 */

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ScriptsCenterPage } from "@/components/modules/scripts-center";

function ScriptsPageInner() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId") || undefined;
  const action = searchParams.get("action") || undefined;
  return (
    <ScriptsCenterPage
      initialProjectId={projectId}
      initialAction={action}
    />
  );
}

export default function ScriptsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-full min-h-0 bg-[#0a0a0a] text-emerald-400 animate-pulse">
          加载中...
        </div>
      }
    >
      <ScriptsPageInner />
    </Suspense>
  );
}