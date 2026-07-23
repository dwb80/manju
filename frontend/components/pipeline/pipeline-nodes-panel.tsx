"use client";

/**
 * @file pipeline-nodes-panel.tsx
 * @description V2 W5 REQ-PIPE-001-06 节点启停面板（轻量版）
 *
 * - 列出 run 全部节点
 * - 每节点 3 按钮：暂停 / 恢复 / 跳过（按 status 显示/隐藏）
 * - 1.5 秒轮询刷新
 *
 * 设计原则：只用 HTML 原生 button + inline style，不依赖 `@/components/ui/*`
 * （Stream C 重构后 ui/ 大量缺失，连锁 ModuleBuildError 风险）。
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play, SkipForward, RefreshCw, Loader2, AlertTriangle, ListChecks } from "lucide-react";
import {
  PIPELINE_NODE_STATUS_LABELS,
  PIPELINE_NODE_STATUS_COLORS,
  type PipelineDependency, type PipelineNode,
  type PipelineNodeAction,
} from "@/lib/app-types";
import { actOnNode, listRunNodes } from "@/services/pipeline.service";
import { PipelineDagView } from "./pipeline-dag-view";

interface PipelineNodesPanelProps {
  runId: string;
}

const POLL_INTERVAL_MS = 1500;

const buttonBase: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "4px 10px",
  borderRadius: 5,
  fontSize: 12,
  fontWeight: 500,
  cursor: "pointer",
  border: "1px solid transparent",
  transition: "opacity 120ms",
};

const pauseBtn: React.CSSProperties = {
  ...buttonBase,
  background: "rgba(245,158,11,0.15)",
  borderColor: "rgba(245,158,11,0.40)",
  color: "rgb(252,211,77)",
};
const resumeBtn: React.CSSProperties = {
  ...buttonBase,
  background: "rgba(34,197,94,0.15)",
  borderColor: "rgba(34,197,94,0.40)",
  color: "rgb(134,239,172)",
};
const skipBtn: React.CSSProperties = {
  ...buttonBase,
  background: "rgba(107,114,128,0.15)",
  borderColor: "rgba(107,114,128,0.40)",
  color: "rgb(209,213,219)",
};

interface Toast {
  id: number;
  text: string;
  tone: "info" | "error" | "success";
}

let toastSeq = 0;

export function PipelineNodesPanel({ runId }: PipelineNodesPanelProps) {
  const [nodes, setNodes] = useState<PipelineNode[]>([]);
  const [dependencies, setDependencies] = useState<PipelineDependency[]>([]);
  const [view, setView] = useState<"graph" | "list">("graph");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<Record<string, boolean>>({});
  const [toasts, setToasts] = useState<Toast[]>([]);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pushToast = useCallback((text: string, tone: Toast["tone"] = "info") => {
    const id = ++toastSeq;
    setToasts((prev) => [...prev, { id, text, tone }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2500);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const r = await listRunNodes(runId);
      setNodes(r.nodes ?? []);
      setDependencies(r.dependencies ?? []);
      setError(null);
    } catch (err) {
      setError((err as Error)?.message ?? "加载失败");
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      await refresh();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.key === "1") setView("graph");
      if (event.key === "2") setView("list");
      if (event.key.toLowerCase() === "r") void refresh();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [refresh]);

  useEffect(() => {
    function schedulePoll() {
      pollTimerRef.current = setTimeout(async () => {
        await refresh();
        if (!cancelled) schedulePoll();
      }, POLL_INTERVAL_MS);
    }
    let cancelled = false;
    schedulePoll();
    return () => {
      cancelled = true;
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, [refresh]);

  const handleAction = useCallback(
    async (node: PipelineNode, action: PipelineNodeAction) => {
      const key = `${node.id}:${action}`;
      setActing((prev) => ({ ...prev, [key]: true }));
      try {
        await actOnNode(runId, node.id, action);
        pushToast(`已${labelForAction(action)}节点「${node.name || node.id}」`, "success");
        await refresh();
      } catch (err) {
        pushToast(`失败: ${(err as Error)?.message ?? "未知错误"}`, "error");
      } finally {
        setActing((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }
    },
    [runId, refresh, pushToast],
  );

  if (loading && nodes.length === 0) {
    return (
      <div role="status" aria-live="polite" style={{ display: "flex", alignItems: "center", gap: 8, padding: 16, color: "rgba(255,255,255,0.6)" }}>
        <Loader2 size={16} className="animate-spin" />
        正在加载节点…
      </div>
    );
  }

  if (error && nodes.length === 0) {
    return (
      <div role="alert" style={{ display: "flex", alignItems: "center", gap: 8, padding: 16, color: "rgb(252,165,165)" }}>
        <AlertTriangle size={16} />
        加载失败: {error}
        <button type="button" style={{ ...skipBtn, marginLeft: 8 }} onClick={refresh}>
          <RefreshCw size={12} />
          重试
        </button>
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 16, color: "rgba(255,255,255,0.4)" }}>
        <ListChecks size={16} />
        该 run 暂无节点。
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,0.6)", fontSize: 12 }}>
        <span>共 {nodes.length} 个节点</span>
        <button type="button" aria-pressed={view === "graph"} aria-label="显示依赖关系图，快捷键 1" onClick={() => setView("graph")} style={skipBtn}>依赖图</button>
        <button type="button" aria-pressed={view === "list"} aria-label="显示节点列表，快捷键 2" onClick={() => setView("list")} style={skipBtn}>列表</button>
        <span style={{ marginLeft: "auto" }}>runId: {runId}</span>
      </div>
      {view === "graph" ? <PipelineDagView nodes={nodes} dependencies={dependencies} /> : null}
      {view === "list" ? <div role="list" aria-label="流水线节点列表">
      {nodes.map((n) => {
        const color = PIPELINE_NODE_STATUS_COLORS[n.status] ?? "#94a3b8";
        const label = PIPELINE_NODE_STATUS_LABELS[n.status] ?? n.status;
        const canPause = n.status === "pending";
        const canResume = n.status === "paused";
        const canSkip = n.status === "pending" || n.status === "paused";
        return (
          <div
            key={n.id}
            role="listitem"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 14px",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: 8,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: color,
                boxShadow: `0 0 8px ${color}`,
                flexShrink: 0,
              }}
            />
            <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: "white" }}>{n.name || n.id}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>
                {n.type} · {label} · 重试 {n.retry_count}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {canPause ? (
                <button
                  type="button"
                  style={{ ...pauseBtn, opacity: acting[`${n.id}:pause`] ? 0.5 : 1 }}
                  disabled={!!acting[`${n.id}:pause`]}
                  onClick={() => handleAction(n, "pause")}
                >
                  <Pause size={11} />
                  暂停
                </button>
              ) : null}
              {canResume ? (
                <button
                  type="button"
                  style={{ ...resumeBtn, opacity: acting[`${n.id}:resume`] ? 0.5 : 1 }}
                  disabled={!!acting[`${n.id}:resume`]}
                  onClick={() => handleAction(n, "resume")}
                >
                  <Play size={11} />
                  恢复
                </button>
              ) : null}
              {canSkip ? (
                <button
                  type="button"
                  style={{ ...skipBtn, opacity: acting[`${n.id}:skip`] ? 0.5 : 1 }}
                  disabled={!!acting[`${n.id}:skip`]}
                  onClick={() => handleAction(n, "skip")}
                >
                  <SkipForward size={11} />
                  跳过
                </button>
              ) : null}
            </div>
          </div>
        );
      })}
      </div> : null}

      {toasts.length > 0 ? (
        <div
          aria-live="polite"
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            display: "flex",
            flexDirection: "column",
            gap: 6,
            zIndex: 1000,
          }}
        >
          {toasts.map((t) => (
            <div
              key={t.id}
              style={{
                padding: "8px 14px",
                borderRadius: 6,
                fontSize: 13,
                background:
                  t.tone === "error"
                    ? "rgba(239,68,68,0.20)"
                    : t.tone === "success"
                      ? "rgba(34,197,94,0.20)"
                      : "rgba(59,130,246,0.20)",
                border: `1px solid ${
                  t.tone === "error"
                    ? "rgba(239,68,68,0.50)"
                    : t.tone === "success"
                      ? "rgba(34,197,94,0.50)"
                      : "rgba(59,130,246,0.50)"
                }`,
                color:
                  t.tone === "error"
                    ? "rgb(252,165,165)"
                    : t.tone === "success"
                      ? "rgb(134,239,172)"
                      : "rgb(147,197,253)",
                backdropFilter: "blur(8px)",
              }}
            >
              {t.text}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function labelForAction(action: PipelineNodeAction): string {
  if (action === "pause") return "暂停";
  if (action === "resume") return "恢复";
  return "跳过";
}
