"use client";

/**
 * 系统管理 · 审计日志查看（评审增量改造 P2-2）
 *
 * 用途：
 * - 查看后端 /api/logs 返回的 AppLog 列表（视频状态机、跨项目复制、
 *   软删除 / 恢复、客户端错误等业务事件）。
 * - 简易筛选：按 entity_type + action 过滤。
 * - 列宽自适应：包含 event / payload / trace_id / project_id 等关键字段。
 *
 * 设计原则：
 * - 只读，不修改 app_logs。
 * - 复用 StandalonePageHeader / Alert 公共组件。
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, RefreshCcw, Filter } from "lucide-react";
import { StandalonePageHeader, Alert } from "@/components/layout";
import { api } from "@/lib/api-client";
import { createLogger } from "@/lib/logger";
import { AdminRouteGuard } from "@/components/auth/admin-route-guard";

const log = createLogger("logs-page");

interface AppLog {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  event: string;
  payload: string;
  operator: string;
  project_id?: string;
  trace_id?: string;
  created_at: string;
}

const ENTITY_TYPES = [
  "",
  "video_task",
  "image_task",
  "audio_task",
  "character",
  "scene",
  "prop",
  "storyboard",
  "clip",
  "script",
  "project",
] as const;

const ACTIONS = [
  "",
  "video.status_changed",
  "video.created",
  "image.status_changed",
  "audio.status_changed",
  "asset.copied",
  "asset.soft_deleted",
  "asset.restored",
  "script.imported",
  "script.exported",
  "client.error",
  "client.warn",
] as const;

function LogsContent() {
  const [items, setItems] = useState<AppLog[]>([]);
  const [entityType, setEntityType] = useState<string>("");
  const [action, setAction] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (entityType) params.set("entityType", entityType);
      if (action) params.set("action", action);
      params.set("limit", "200");
      const data = await api<AppLog[]>(`/api/logs?${params.toString()}`);
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      log.error("fetch logs failed", { entityType, action, err });
    } finally {
      setLoading(false);
    }
  }, [entityType, action]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  const summary = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const item of items) totals[item.action] = (totals[item.action] ?? 0) + 1;
    return totals;
  }, [items]);

  return (
    <div className="flex flex-col h-full">
      <StandalonePageHeader
        title="审计日志"
        description="视频任务状态机、跨项目资产复制、软删除/恢复、客户端错误等业务事件"
        extraRight={
          <button
            type="button"
            onClick={() => void fetchLogs()}
            disabled={loading}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 disabled:opacity-50"
          >
            <RefreshCcw className="w-3.5 h-3.5" />
            {loading ? "加载中..." : "刷新"}
          </button>
        }
      />

      <div className="flex-1 overflow-auto px-6 py-4 space-y-4">
        {error && (
          <Alert tone="error" title="加载失败">
            {error}
          </Alert>
        )}

        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 flex flex-wrap items-center gap-3">
          <Filter className="w-4 h-4 text-slate-400" />
          <label className="text-xs text-slate-400 flex items-center gap-2">
            entity_type:
            <select
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200"
            >
              {ENTITY_TYPES.map((t) => (
                <option key={t} value={t}>{t || "(全部)"}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-400 flex items-center gap-2">
            action:
            <select
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200"
            >
              {ACTIONS.map((a) => (
                <option key={a} value={a}>{a || "(全部)"}</option>
              ))}
            </select>
          </label>
          <div className="text-xs text-slate-500 ml-auto">
            共 {items.length} 条 · {Object.keys(summary).length} 种 action
          </div>
        </div>

        {Object.keys(summary).length > 0 && (
          <div className="flex flex-wrap gap-2 text-xs">
            {Object.entries(summary).map(([k, v]) => (
              <span
                key={k}
                className="px-2 py-1 rounded bg-slate-800 text-slate-200 border border-slate-700"
              >
                {k} × {v}
              </span>
            ))}
          </div>
        )}

        <div className="rounded-lg border border-slate-800 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-slate-900 text-slate-400">
              <tr>
                <th className="text-left px-3 py-2 font-medium">时间</th>
                <th className="text-left px-3 py-2 font-medium">entity</th>
                <th className="text-left px-3 py-2 font-medium">action</th>
                <th className="text-left px-3 py-2 font-medium">event</th>
                <th className="text-left px-3 py-2 font-medium">project</th>
                <th className="text-left px-3 py-2 font-medium">trace</th>
                <th className="text-left px-3 py-2 font-medium">operator</th>
                <th className="text-left px-3 py-2 font-medium">payload</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {items.length === 0 && !loading && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-slate-500">
                    暂无审计日志
                  </td>
                </tr>
              )}
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-900/40">
                  <td className="px-3 py-2 text-slate-400 whitespace-nowrap">
                    {formatTime(item.created_at)}
                  </td>
                  <td className="px-3 py-2 text-slate-200">
                    <div>{item.entity_type}</div>
                    <div className="text-slate-500 text-[10px]">{item.entity_id}</div>
                  </td>
                  <td className="px-3 py-2 text-slate-200">{item.action}</td>
                  <td className="px-3 py-2 text-slate-300">{item.event}</td>
                  <td className="px-3 py-2 text-slate-400">{item.project_id || "-"}</td>
                  <td className="px-3 py-2 text-slate-500 font-mono text-[10px]">
                    {item.trace_id ? item.trace_id.slice(0, 12) : "-"}
                  </td>
                  <td className="px-3 py-2 text-slate-400">{item.operator}</td>
                  <td className="px-3 py-2 text-slate-400 max-w-md">
                    <pre className="whitespace-pre-wrap break-words text-[10px] leading-tight">
                      {prettyPayload(item.payload)}
                    </pre>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function LogsPage() {
  return <AdminRouteGuard><LogsContent /></AdminRouteGuard>;
}

function formatTime(iso: string): string {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  } catch {
    return iso;
  }
}

function prettyPayload(payload: string): string {
  if (!payload) return "";
  try {
    return JSON.stringify(JSON.parse(payload), null, 0);
  } catch {
    return payload;
  }
}
