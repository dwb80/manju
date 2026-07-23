"use client";

/**
 * @file app/quality/page.tsx
 * @description V2 W6 REQ-PIPE-004-05 质检报告查看页（轻量版）
 *
 * 功能：
 * - 顶部：项目 ID 输入 + 自动质检配置（启用/目标类型/阈值/失败处理）+ 汇总（总/通过/失败/平均分）
 * - 主体：报告列表（runId/nodeId/targetType/score/status/items 数/时间）
 * - 单条展开：可查看 details.items 每项 rule / status / score / message
 *
 * 复用 pipeline/page.tsx 的轻量设计：HTML 原生 + inline style。
 */

import { useEffect, useMemo, useState } from "react";
import {
  fetchAutoConfig,
  saveAutoConfig,
  deleteAutoConfig,
  listReports,
  fetchReport,
  triggerDetect,
  fetchSummary,
} from "@/services/quality.service";
import type {
  QualityAutoConfig,
  QualityReport,
  QualitySummary,
  QualityTargetType,
  QualityOnFailure,
} from "@/services/quality.service";

const cardStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 8,
  padding: 16,
  marginBottom: 16,
};

const inputStyle: React.CSSProperties = {
  padding: "6px 10px",
  fontSize: 13,
  background: "rgba(0,0,0,0.30)",
  border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: 6,
  color: "white",
  fontFamily: "ui-monospace, SFMono-Regular, monospace",
};

const btnPrimary: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 14px",
  borderRadius: 6,
  background: "linear-gradient(135deg, rgb(59,130,246) 0%, rgb(96,165,250) 100%)",
  color: "white",
  border: "none",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 500,
};

const btnDanger: React.CSSProperties = {
  ...btnPrimary,
  background: "linear-gradient(135deg, rgb(220,38,38) 0%, rgb(248,113,113) 100%)",
};

const statusColor: Record<string, string> = {
  passed: "rgb(34,197,94)",
  warning: "rgb(234,179,8)",
  failed: "rgb(220,38,38)",
  unknown: "rgb(148,163,184)",
};

const TARGET_TYPES: QualityTargetType[] = ["image", "video", "audio", "composition"];
const ON_FAILURE: QualityOnFailure[] = ["log", "review", "block"];

const DEFAULT_PROJECT_ID = "p-171a35d8-0c63-40a3-8ece-d69e6ee39764";

/**
 * 构造一个"占位"默认配置，用于 SSR 首次渲染 / 等待 fetch 完成期间。
 * 关键点：让 useState 初值非 null，render 立即能看到自动配置区，
 * 等 useEffect 中 fetchAutoConfig 拿到真实值后再覆盖。
 *  - id 为空串（表示尚未持久化）
 *  - updated_at 标为 "loading..."，方便前端 UI 区分
 */
function buildDefaultConfig(projectId: string): QualityAutoConfig {
  return {
    id: "",
    project_id: projectId,
    enabled: false,
    target_types: [],
    threshold: 70,
    on_failure: "log",
    created_at: "",
    updated_at: "loading...",
  };
}

export default function QualityPage() {
  const [projectId, setProjectId] = useState(DEFAULT_PROJECT_ID);
  const [config, setConfig] = useState<QualityAutoConfig>(() => buildDefaultConfig(DEFAULT_PROJECT_ID));
  const [summary, setSummary] = useState<QualitySummary | null>(null);
  const [reports, setReports] = useState<QualityReport[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<QualityReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // 手动 detect 表单
  const [detectTargetId, setDetectTargetId] = useState("");
  const [detectTargetType, setDetectTargetType] = useState<QualityTargetType>("image");

  const reload = async (pid = projectId) => {
    if (!pid) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const [cfg, sum, rep] = await Promise.all([
        fetchAutoConfig(pid),
        fetchSummary(pid),
        listReports({ projectId: pid, limit: 50 }),
      ]);
      setConfig(cfg.config);
      setSummary(sum.summary);
      setReports(rep.reports);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveConfig = async () => {
    setBusy(true);
    setError(null);
    try {
      const next = await saveAutoConfig({
        project_id: config.project_id,
        enabled: config.enabled,
        target_types: config.target_types,
        threshold: config.threshold,
        on_failure: config.on_failure,
      });
      setConfig(next.config);
      setInfo("配置已保存");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteConfig = async () => {
    setBusy(true);
    setError(null);
    try {
      await deleteAutoConfig(projectId);
      const cfg = await fetchAutoConfig(projectId);
      setConfig(cfg.config);
      setInfo("配置已删除，已回退默认");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleToggleTargetType = (t: QualityTargetType) => {
    const set = new Set(config.target_types);
    if (set.has(t)) set.delete(t);
    else set.add(t);
    setConfig({ ...config, target_types: Array.from(set) as QualityTargetType[] });
  };

  const handleTriggerDetect = async () => {
    if (!detectTargetId.trim()) {
      setError("请填写 targetId");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await triggerDetect({
        projectId,
        targetId: detectTargetId.trim(),
        targetType: detectTargetType,
      });
      setInfo(`已触发检测，reportId=${result.report.reportId}，分数=${result.report.overallScore}，状态=${result.report.status}`);
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleExpand = async (reportId: string) => {
    if (expandedId === reportId) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    setExpandedId(reportId);
    try {
      const d = await fetchReport(reportId);
      setDetail(d);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const statusBadge = (status: string) => ({
    display: "inline-block",
    padding: "2px 8px",
    fontSize: 11,
    fontWeight: 600,
    borderRadius: 4,
    background: statusColor[status] ?? statusColor.unknown,
    color: "white",
  });

  const sortedReports = useMemo(() => reports, [reports]);

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto", color: "white" }}>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>质检中心</h1>

      {/* 项目选择 */}
      <div style={cardStyle}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ fontSize: 13, color: "rgb(148,163,184)" }}>项目 ID：</label>
          <input
            style={{ ...inputStyle, minWidth: 320 }}
            value={projectId}
            onChange={(e) => setProjectId(e.target.value.trim())}
            placeholder="p-xxxxx"
          />
          <button style={btnPrimary} disabled={busy} onClick={() => reload()}>
            {busy ? "加载中..." : "刷新"}
          </button>
          {error && (
            <span style={{ color: "rgb(248,113,113)", fontSize: 12, marginLeft: 8 }}>错误：{error}</span>
          )}
          {info && (
            <span style={{ color: "rgb(134,239,172)", fontSize: 12, marginLeft: 8 }}>{info}</span>
          )}
        </div>
      </div>

      {/* 自动配置 — 总是渲染（useState 初值是 buildDefaultConfig，保证 SSR 立即可见） */}
      <div style={cardStyle}>
        <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>
          自动质检配置
          {config.id === "" && (
            <span style={{ fontSize: 11, color: "rgb(234,179,8)", marginLeft: 8 }}>（使用默认，待后端返回后覆盖）</span>
          )}
        </h2>
        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
            />
            启用
          </label>
          <div style={{ fontSize: 13 }}>
            目标类型：
            {TARGET_TYPES.map((t) => (
              <label key={t} style={{ marginLeft: 8, display: "inline-flex", alignItems: "center", gap: 4 }}>
                <input
                  type="checkbox"
                  checked={config.target_types.includes(t)}
                  onChange={() => handleToggleTargetType(t)}
                />
                {t}
              </label>
            ))}
          </div>
          <label style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}>
            阈值：
            <input
              type="number"
              min={0}
              max={100}
              style={{ ...inputStyle, width: 80 }}
              value={config.threshold}
              onChange={(e) => setConfig({ ...config, threshold: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
            />
          </label>
          <label style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}>
            失败处理：
            <select
              style={inputStyle}
              value={config.on_failure}
              onChange={(e) => setConfig({ ...config, on_failure: e.target.value as QualityOnFailure })}
            >
              {ON_FAILURE.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </label>
          <button style={btnPrimary} disabled={busy} onClick={handleSaveConfig}>
            保存
          </button>
          <button style={btnDanger} disabled={busy || config.id === ""} onClick={handleDeleteConfig} title={config.id === "" ? "当前为默认占位，无可删除的持久化记录" : "删除项目自动质检配置"}>
            删除
          </button>
          <span style={{ fontSize: 11, color: "rgb(148,163,184)" }}>
            updated_at: {config.updated_at}
          </span>
        </div>
      </div>

      {/* 汇总 */}
      {summary && (
        <div style={cardStyle}>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>质检汇总</h2>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            <Stat label="总报告" value={summary.total} color="rgb(148,163,184)" />
            <Stat label="通过" value={summary.passed} color="rgb(34,197,94)" />
            <Stat label="失败" value={summary.failed} color="rgb(220,38,38)" />
            <Stat label="平均分" value={summary.avgScore} color="rgb(59,130,246)" />
            <div style={{ fontSize: 12, color: "rgb(148,163,184)" }}>
              按目标类型：
              {Object.entries(summary.byTargetType).map(([k, v]) => (
                <span key={k} style={{ marginLeft: 8 }}>{k}={v}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 手动触发检测 */}
      <div style={cardStyle}>
        <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>手动触发检测</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ fontSize: 13, color: "rgb(148,163,184)" }}>targetId：</label>
          <input
            style={{ ...inputStyle, minWidth: 280 }}
            value={detectTargetId}
            onChange={(e) => setDetectTargetId(e.target.value)}
            placeholder="img-xxx / vid-xxx / comp-xxx"
          />
          <label style={{ fontSize: 13, color: "rgb(148,163,184)" }}>类型：</label>
          <select
            style={inputStyle}
            value={detectTargetType}
            onChange={(e) => setDetectTargetType(e.target.value as QualityTargetType)}
          >
            {TARGET_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <button style={btnPrimary} disabled={busy} onClick={handleTriggerDetect}>
            {busy ? "检测中..." : "执行检测"}
          </button>
        </div>
      </div>

      {/* 报告列表 */}
      <div style={cardStyle}>
        <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>
          报告列表 <span style={{ fontSize: 12, color: "rgb(148,163,184)" }}>({sortedReports.length})</span>
        </h2>
        {sortedReports.length === 0 ? (
          <p style={{ fontSize: 13, color: "rgb(148,163,184)" }}>暂无报告</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "rgb(148,163,184)" }}>
                  <th style={th}>报告 ID</th>
                  <th style={th}>目标</th>
                  <th style={th}>类型</th>
                  <th style={th}>分数</th>
                  <th style={th}>状态</th>
                  <th style={th}>Run/Node</th>
                  <th style={th}>时间</th>
                  <th style={th}>操作</th>
                </tr>
              </thead>
              <tbody>
                {sortedReports.map((r) => {
                  const status = String(r.details?.status ?? (r.passed ? "passed" : "failed"));
                  const ttype = String(r.details?.targetType ?? "unknown");
                  const tid = String(r.details?.targetId ?? "");
                  const isOpen = expandedId === r.id;
                  return (
                    <>
                      <tr key={r.id} style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                        <td style={td}><code style={{ fontSize: 11 }}>{r.id}</code></td>
                        <td style={td}><code style={{ fontSize: 11 }}>{tid || "-"}</code></td>
                        <td style={td}>{ttype}</td>
                        <td style={td}>
                          <span style={scoreBar(r.score)}>{r.score}</span>
                        </td>
                        <td style={td}><span style={statusBadge(status)}>{status}</span></td>
                        <td style={td}><code style={{ fontSize: 11 }}>{r.run_id || "-"} / {r.node_id || "-"}</code></td>
                        <td style={td}><code style={{ fontSize: 11 }}>{r.created_at}</code></td>
                        <td style={td}>
                          <button
                            style={{ ...btnPrimary, padding: "2px 8px", fontSize: 11 }}
                            onClick={() => handleExpand(r.id)}
                          >
                            {isOpen ? "收起" : "详情"}
                          </button>
                        </td>
                      </tr>
                      {isOpen && detail && detail.id === r.id && (
                        <tr>
                          <td colSpan={8} style={{ ...td, background: "rgba(0,0,0,0.20)" }}>
                            <ReportDetail report={detail} />
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const th: React.CSSProperties = {
  padding: "8px 10px",
  borderBottom: "1px solid rgba(255,255,255,0.15)",
  fontWeight: 500,
  fontSize: 12,
};

const td: React.CSSProperties = {
  padding: "8px 10px",
  fontSize: 13,
};

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
      <span style={{ fontSize: 11, color: "rgb(148,163,184)" }}>{label}</span>
      <span style={{ fontSize: 20, fontWeight: 700, color }}>{value}</span>
    </div>
  );
}

function scoreBar(score: number): React.CSSProperties {
  const color = score >= 80 ? "rgb(34,197,94)" : score >= 60 ? "rgb(234,179,8)" : "rgb(220,38,38)";
  return {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 4,
    background: color,
    color: "white",
    fontWeight: 600,
    fontSize: 12,
    minWidth: 36,
    textAlign: "center",
  };
}

function ReportDetail({ report }: { report: QualityReport }) {
  const d = report.details;
  return (
    <div style={{ padding: 8, fontSize: 12, color: "rgb(203,213,225)" }}>
      <div style={{ marginBottom: 8 }}>
        <strong>总体：</strong> 技术 {d.technicalScore} / 美学 {d.aestheticScore} / 一致性 {d.consistencyScore}
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ color: "rgb(148,163,184)", textAlign: "left" }}>
            <th style={{ ...th, padding: "4px 6px" }}>规则</th>
            <th style={{ ...th, padding: "4px 6px" }}>状态</th>
            <th style={{ ...th, padding: "4px 6px" }}>分数</th>
            <th style={{ ...th, padding: "4px 6px" }}>说明</th>
          </tr>
        </thead>
        <tbody>
          {d.items.map((it) => (
            <tr key={it.rule} style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <td style={{ ...td, padding: "4px 6px" }}>{it.rule}</td>
              <td style={{ ...td, padding: "4px 6px" }}>
                <span style={{
                  padding: "1px 6px",
                  borderRadius: 3,
                  background: it.status === "passed" ? "rgb(34,197,94)" : it.status === "warning" ? "rgb(234,179,8)" : "rgb(220,38,38)",
                  color: "white",
                  fontSize: 11,
                }}>{it.status}</span>
              </td>
              <td style={{ ...td, padding: "4px 6px" }}>{it.score}</td>
              <td style={{ ...td, padding: "4px 6px" }}>{it.message}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
