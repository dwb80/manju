"use client";

/**
 * @file app/pipeline/runs/[runId]/page.tsx
 * @description V2 W5 REQ-PIPE-001-06 节点启停页面
 *
 * 路由: /pipeline/runs/[runId]
 * - 显示 run 全部节点 + 启停按钮
 *
 * 注意：Stream C 重构后 ui/ 大量缺失，本页只用 HTML 原生 button + inline style。
 */

import { use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Workflow } from "lucide-react";
import { PipelineNodesPanel } from "@/components/pipeline/pipeline-nodes-panel";

interface PageProps {
  params: Promise<{ runId: string }>;
}

const backLinkStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "6px 12px",
  borderRadius: 6,
  background: "transparent",
  color: "white",
  border: "1px solid rgba(255,255,255,0.15)",
  cursor: "pointer",
  fontSize: 13,
};

export default function PipelineRunNodesPage({ params }: PageProps) {
  const router = useRouter();
  const { runId } = use(params);

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "white", padding: "24px 32px" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button type="button" style={backLinkStyle} aria-label="返回流水线入口" onClick={() => router.push("/pipeline")}>
            <ArrowLeft size={14} />
            流水线
          </button>
          <span style={{ color: "rgba(255,255,255,0.3)" }}>/</span>
          <span style={{ fontSize: 13, color: "white", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Workflow size={14} color="rgb(96,165,250)" />
            Run: {runId}
          </span>
        </div>

        <div
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.10)",
            borderRadius: 12,
            padding: 20,
          }}
        >
          <h1 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>节点启停</h1>
          <PipelineNodesPanel runId={runId} />
        </div>
      </div>
    </div>
  );
}
