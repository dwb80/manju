"use client";

/**
 * @file app/pipeline/page.tsx
 * @description V2 W5 流水线入口页（轻量版）
 *
 * 用户输入 runId 进入节点启停面板。
 * 后续可扩展：列出项目下的所有 run（按项目 ID）。
 *
 * 注意：Stream C 重构后 ui/ 大量缺失，本页只用 HTML 原生 button + inline style。
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Workflow, Loader2, AlertTriangle } from "lucide-react";
import { listRunNodes } from "@/services/pipeline.service";

const inputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 280,
  padding: "8px 12px",
  fontSize: 13,
  background: "rgba(0,0,0,0.30)",
  border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: 6,
  color: "white",
  fontFamily: "ui-monospace, SFMono-Regular, monospace",
};

const primaryButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 16px",
  borderRadius: 6,
  background: "linear-gradient(135deg, rgb(59,130,246) 0%, rgb(96,165,250) 100%)",
  color: "white",
  border: "none",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 500,
};

export default function PipelinePage() {
  const router = useRouter();
  const [runId, setRunId] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = runId.trim();
    if (!trimmed) {
      setError("请输入 runId");
      return;
    }
    setChecking(true);
    setError(null);
    try {
      await listRunNodes(trimmed);
      router.push(`/pipeline/runs/${encodeURIComponent(trimmed)}`);
    } catch (err) {
      setError((err as Error)?.message ?? "run 不存在或无法访问");
      setChecking(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "white", padding: "24px 32px" }}>
      <div style={{ maxWidth: 720, margin: "60px auto", display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Workflow size={24} color="rgb(96,165,250)" />
          <h1 style={{ fontSize: 22, fontWeight: 600 }}>流水线节点启停</h1>
        </div>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", marginTop: -8 }}>
          输入 pipeline run 的 ID（run-test-xxxxxx 等），进入节点面板后可以暂停 / 恢复 / 跳过节点。
        </p>

        <form
          onSubmit={handleSubmit}
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.10)",
            borderRadius: 10,
            padding: 16,
          }}
        >
          <input
            aria-label="流水线运行 ID"
            type="text"
            value={runId}
            onChange={(e) => setRunId(e.target.value)}
            placeholder="run-test-1784639536487"
            style={inputStyle}
            disabled={checking}
          />
          <button type="submit" style={primaryButtonStyle} disabled={checking} aria-label="打开流水线运行">
            {checking ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
            打开
          </button>
        </form>

        {error ? (
          <div
            role="alert"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 14px",
              background: "rgba(239,68,68,0.10)",
              border: "1px solid rgba(239,68,68,0.30)",
              borderRadius: 8,
              color: "rgb(252,165,165)",
              fontSize: 13,
            }}
          >
            <AlertTriangle size={14} />
            {error}
          </div>
        ) : null}

        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 8 }}>
          提示：可通过 SQLite 直接 INSERT 一条 pipeline_runs + pipeline_nodes 记录，或调用后端 service 创建 run。
        </div>
      </div>
    </div>
  );
}
