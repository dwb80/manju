"use client";

/**
 * @file app/quality/page.tsx
 * @description V2 W6 REQ-PIPE-004-05 质检报告查看页
 *
 * 功能：
 * - 顶部：项目选择（默认从 useProjectStore 取）+ 自动质检配置（启用/目标类型/阈值/失败处理）+ 汇总
 * - 主体：报告列表（runId/nodeId/targetType/score/status/items 数/时间）
 * - 单条展开：可查看 details.items 每项 rule / status / score / message
 *
 * P1 评审修复：
 * - 迁移 inline style 到 Card / Table / Button / Input / Badge 统一设计系统组件
 * - 改用 useProjectStore.selectedProjectId 替代硬编码 DEFAULT_PROJECT_ID
 * - 修复 React.Fragment + 双 tr 的 key warning
 * - 引入 StandalonePageHeader 头部
 */

import { useEffect, useMemo, useState, Fragment } from "react";
import {
  fetchAutoConfig,
  saveAutoConfig,
  deleteAutoConfig,
  listReports,
  fetchReport,
  triggerDetect,
  fetchSummary,
  type QualityAutoConfig,
  type QualityReport,
  type QualitySummary,
  type QualityTargetType,
  type QualityOnFailure,
} from "@/services/quality.service";
import { useProjectStore } from "@/lib/stores/project-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StandalonePageHeader } from "@/components/layout/standalone-page-header";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { notify } from "@/lib/notify";
import { Loader2, Trash2, Save, Play, AlertTriangle } from "lucide-react";
import { StatCard } from "@/components/shared/stat-card";

const TARGET_TYPES: QualityTargetType[] = ["image", "video", "audio", "composition"];
const ON_FAILURE: QualityOnFailure[] = ["log", "review", "block"];

const STATUS_VARIANT: Record<
  string,
  "success" | "warning" | "destructive" | "muted"
> = {
  passed: "success",
  warning: "warning",
  failed: "destructive",
  unknown: "muted",
};

function statusVariant(status: string) {
  return STATUS_VARIANT[status] ?? "muted";
}

function scoreColor(score: number): "success" | "warning" | "destructive" {
  if (score >= 80) return "success";
  if (score >= 60) return "warning";
  return "destructive";
}

/**
 * 构造一个"占位"默认配置，用于 SSR 首次渲染 / 等待 fetch 完成期间。
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
  const selectedProjectId = useProjectStore((s) => s.selectedProjectId);
  const [projectId, setProjectId] = useState(selectedProjectId || "");
  const [config, setConfig] = useState<QualityAutoConfig>(() =>
    buildDefaultConfig(selectedProjectId || ""),
  );
  const [summary, setSummary] = useState<QualitySummary | null>(null);
  const [reports, setReports] = useState<QualityReport[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<QualityReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // 手动 detect 表单
  const [detectTargetId, setDetectTargetId] = useState("");
  const [detectTargetType, setDetectTargetType] = useState<QualityTargetType>("image");

  // 监听全局项目选择变化
  useEffect(() => {
    if (selectedProjectId && selectedProjectId !== projectId) {
      setProjectId(selectedProjectId);
      setConfig(buildDefaultConfig(selectedProjectId));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectId]);

  const reload = async (pid = projectId) => {
    if (!pid) {
      notify.info("请先选择项目");
      return;
    }
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
      notify.error("加载失败", (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      void reload(projectId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

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
      notify.success("配置已保存");
    } catch (e) {
      setError((e as Error).message);
      notify.error("保存失败", (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteConfig = async () => {
    setConfirmDelete(false);
    setBusy(true);
    setError(null);
    try {
      await deleteAutoConfig(projectId);
      const cfg = await fetchAutoConfig(projectId);
      setConfig(cfg.config);
      setInfo("配置已删除，已回退默认");
      notify.success("配置已删除");
    } catch (e) {
      setError((e as Error).message);
      notify.error("删除失败", (e as Error).message);
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
      notify.warn("请填写 targetId");
      return;
    }
    if (!projectId) {
      notify.warn("请先选择项目");
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
      setInfo(
        `已触发检测，reportId=${result.report.reportId}，分数=${result.report.overallScore}，状态=${result.report.status}`,
      );
      notify.success("检测完成", `分数 ${result.report.overallScore}`);
      await reload();
    } catch (e) {
      setError((e as Error).message);
      notify.error("检测失败", (e as Error).message);
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
      notify.error("加载报告失败", (e as Error).message);
    }
  };

  const sortedReports = useMemo(() => reports, [reports]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <StandalonePageHeader
        title="质检中心"
        description="查看项目维度的质检报告与自动配置"
        breadcrumbs={["首页", "质检中心"]}
        extraRight={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void reload()}
            disabled={busy || !projectId}
          >
            <Loader2 className={`mr-1 h-3 w-3 ${busy ? "animate-spin" : "hidden"}`} />
            刷新
          </Button>
        }
      />

      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-6 sm:px-8">
        {error && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm text-red-200"
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            {error}
          </div>
        )}
        {info && (
          <div
            role="status"
            className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-sm text-emerald-200"
          >
            {info}
          </div>
        )}

        {/* 自动配置 */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">自动质检配置</CardTitle>
              {config.id === "" && (
                <Badge variant="warning" className="text-[10px]">
                  使用默认，待后端返回后覆盖
                </Badge>
              )}
            </div>
            <span className="text-[11px] text-muted-foreground">
              updated_at: {config.updated_at || "—"}
            </span>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-white/20 bg-transparent accent-emerald-500"
                  checked={config.enabled}
                  onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                />
                启用
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-muted-foreground">目标类型：</span>
                {TARGET_TYPES.map((t) => (
                  <label key={t} className="inline-flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-white/20 bg-transparent accent-emerald-500"
                      checked={config.target_types.includes(t)}
                      onChange={() => handleToggleTargetType(t)}
                    />
                    {t}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <label className="inline-flex items-center gap-2">
                <span className="text-muted-foreground">阈值：</span>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  className="h-8 w-20 text-xs"
                  value={config.threshold}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      threshold: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                    })
                  }
                />
              </label>
              <label className="inline-flex items-center gap-2">
                <span className="text-muted-foreground">失败处理：</span>
                <select
                  className="h-8 rounded-md border border-input bg-muted px-2 text-xs"
                  value={config.on_failure}
                  onChange={(e) =>
                    setConfig({ ...config, on_failure: e.target.value as QualityOnFailure })
                  }
                >
                  {ON_FAILURE.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={handleSaveConfig} disabled={busy}>
                  <Save className="mr-1 h-3.5 w-3.5" />
                  保存
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setConfirmDelete(true)}
                  disabled={busy || config.id === ""}
                  title={config.id === "" ? "当前为默认占位，无可删除的持久化记录" : ""}
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                  删除
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 汇总 */}
        {summary && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">质检汇总</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <StatCard label="总报告" value={summary.total} color="orange" />
                <StatCard label="通过" value={summary.passed} color="emerald" />
                <StatCard label="失败" value={summary.failed} color="orange" />
                <StatCard label="平均分" value={summary.avgScore} color="blue" />
              </div>
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span>按目标类型：</span>
                {Object.entries(summary.byTargetType).map(([k, v]) => (
                  <Badge key={k} variant="muted">
                    {k}={v}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 手动触发检测 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">手动触发检测</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">targetId：</span>
                <Input
                  className="h-8 w-72 text-xs"
                  value={detectTargetId}
                  onChange={(e) => setDetectTargetId(e.target.value)}
                  placeholder="img-xxx / vid-xxx / comp-xxx"
                />
              </label>
              <label className="inline-flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">类型：</span>
                <select
                  className="h-8 rounded-md border border-input bg-muted px-2 text-xs"
                  value={detectTargetType}
                  onChange={(e) => setDetectTargetType(e.target.value as QualityTargetType)}
                >
                  {TARGET_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <Button size="sm" onClick={handleTriggerDetect} disabled={busy}>
                <Play className="mr-1 h-3.5 w-3.5" />
                {busy ? "检测中..." : "执行检测"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 报告列表 */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">报告列表</CardTitle>
            <span className="text-xs text-muted-foreground">
              共 {sortedReports.length} 条
            </span>
          </CardHeader>
          <CardContent className="pt-0">
            {sortedReports.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">暂无报告</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>报告 ID</TableHead>
                    <TableHead>目标</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>分数</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>Run/Node</TableHead>
                    <TableHead>时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedReports.map((r) => {
                    const status = String(r.details?.status ?? (r.passed ? "passed" : "failed"));
                    const ttype = String(r.details?.targetType ?? "unknown");
                    const tid = String(r.details?.targetId ?? "");
                    const isOpen = expandedId === r.id;
                    return (
                      <Fragment key={r.id}>
                        <TableRow className={isOpen ? "bg-white/[0.03]" : undefined}>
                          <TableCell>
                            <code className="font-mono text-[11px]">{r.id}</code>
                          </TableCell>
                          <TableCell>
                            <code className="font-mono text-[11px]">{tid || "-"}</code>
                          </TableCell>
                          <TableCell>{ttype}</TableCell>
                          <TableCell>
                            <Badge variant={scoreColor(r.score)}>{r.score}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusVariant(status)}>{status}</Badge>
                          </TableCell>
                          <TableCell>
                            <code className="font-mono text-[11px]">
                              {r.run_id || "-"} / {r.node_id || "-"}
                            </code>
                          </TableCell>
                          <TableCell>
                            <code className="font-mono text-[11px]">{r.created_at}</code>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-[11px]"
                              onClick={() => handleExpand(r.id)}
                              aria-label={isOpen ? "收起详情" : "查看详情"}
                            >
                              {isOpen ? "收起" : "详情"}
                            </Button>
                          </TableCell>
                        </TableRow>
                        {isOpen && detail && detail.id === r.id && (
                          <TableRow>
                            <TableCell colSpan={8} className="bg-black/20 p-0">
                              <ReportDetail report={detail} />
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="删除项目自动质检配置"
          description="删除后该项目将不再自动执行质检。确认要继续吗？"
          confirmLabel="确认删除"
          onClose={() => setConfirmDelete(false)}
          onConfirm={handleDeleteConfig}
        />
      )}
    </div>
  );
}

function ReportDetail({ report }: { report: QualityReport }) {
  const d = report.details;
  return (
    <div className="p-4 text-xs text-neutral-300">
      <div className="mb-3 flex flex-wrap gap-4">
        <span>
          <strong>技术</strong> {d.technicalScore}
        </span>
        <span>
          <strong>美学</strong> {d.aestheticScore}
        </span>
        <span>
          <strong>一致性</strong> {d.consistencyScore}
        </span>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>规则</TableHead>
            <TableHead>状态</TableHead>
            <TableHead>分数</TableHead>
            <TableHead>说明</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {d.items.map((it) => (
            <TableRow key={it.rule}>
              <TableCell>{it.rule}</TableCell>
              <TableCell>
                <Badge variant={statusVariant(it.status)}>{it.status}</Badge>
              </TableCell>
              <TableCell>{it.score}</TableCell>
              <TableCell>{it.message}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
