"use client";

/**
 * @file app/pipeline/page.tsx
 * @description 流水线入口页
 *
 * V2 W5 节点启停面板的着陆页：
 * - 顶部按项目维度展示 run 列表（项目下挂多个 run，可直接打开）
 * - 顶部也保留 runId 跳转入口（兼容已知 runId 直接打开的场景）
 * - 数据为空时给出引导（如何通过 SQLite / 后端 service 创建 run）
 *
 * P1 评审修复：
 * - 迁移 inline style 到 Card / Button / Input / Badge 统一设计系统组件
 * - 使用 design token（语义化 className）替代硬编码颜色
 * - 引入 StandalonePageHeader 头部统一入口
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Workflow,
  Loader2,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  FolderKanban,
  ChevronRight,
  Search,
  Circle,
  CheckCircle2,
  PauseCircle,
  XCircle,
} from "lucide-react";
import { listProjects } from "@/services/project.service";
import type { Project } from "@/lib/app-types";
import {
  listPipelineRuns,
  type PipelineRunListItem,
} from "@/services/pipeline.service";
import { notify } from "@/lib/notify";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StandalonePageHeader } from "@/components/layout/standalone-page-header";

type ProjectGroup = {
  project: Project | null; // null = 未挂项目
  projectLabel: string;
  runs: PipelineRunListItem[];
};

const STATUS_META: Record<
  string,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info" | "muted";
    Icon: typeof Circle;
  }
> = {
  running: { label: "运行中", variant: "success", Icon: Loader2 },
  completed: { label: "已完成", variant: "info", Icon: CheckCircle2 },
  paused: { label: "已暂停", variant: "warning", Icon: PauseCircle },
  failed: { label: "失败", variant: "destructive", Icon: XCircle },
  waiting: { label: "等待中", variant: "muted", Icon: Circle },
};

function formatTime(value?: string): string {
  if (!value) return "—";
  const t = Date.parse(value);
  if (!Number.isFinite(t)) return value;
  return new Date(t).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PipelinePage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [runs, setRuns] = useState<PipelineRunListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runIdInput, setRunIdInput] = useState("");
  const [checking, setChecking] = useState(false);
  const [search, setSearch] = useState("");

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const [projResp, runResp] = await Promise.all([
        listProjects().catch(() => [] as Project[]),
        listPipelineRuns().catch((err) => {
          console.error("[pipeline] listPipelineRuns failed", err);
          return { projectId: null, runs: [] as PipelineRunListItem[] };
        }),
      ]);
      setProjects(projResp);
      setRuns(runResp.runs);
    } catch (err) {
      setError((err as Error)?.message ?? "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  const groups: ProjectGroup[] = useMemo(() => {
    const projectById = new Map(projects.map((p) => [p.id, p]));
    const byProject = new Map<string, PipelineRunListItem[]>();
    for (const run of runs) {
      const key = run.project_id ?? "__none__";
      const list = byProject.get(key) ?? [];
      list.push(run);
      byProject.set(key, list);
    }
    const out: ProjectGroup[] = [];
    for (const [key, list] of byProject.entries()) {
      const project = key === "__none__" ? null : projectById.get(key) ?? null;
      out.push({
        project,
        projectLabel: project?.name ?? "未挂项目",
        runs: list.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? "")),
      });
    }
    out.sort((a, b) => {
      if (Boolean(a.project) !== Boolean(b.project)) return a.project ? -1 : 1;
      return a.projectLabel.localeCompare(b.projectLabel, "zh-Hans");
    });
    return out;
  }, [runs, projects]);

  const totalRuns = runs.length;
  const totalProjects = useMemo(() => {
    const ids = new Set<string>();
    for (const r of runs) {
      if (r.project_id) ids.add(r.project_id);
    }
    return ids.size;
  }, [runs]);

  const filteredGroups = useMemo(() => {
    if (!search.trim()) return groups;
    const q = search.trim().toLowerCase();
    return groups
      .map((g) => ({
        ...g,
        runs: g.runs.filter((r) => {
          const haystack = [r.id, r.name ?? "", r.status ?? "", g.projectLabel]
            .join("\n")
            .toLowerCase();
          return haystack.includes(q);
        }),
      }))
      .filter((g) => g.runs.length > 0);
  }, [groups, search]);

  const handleOpenRun = (runId: string) => {
    const id = runId.trim();
    if (!id) return;
    router.push(`/pipeline/runs/${encodeURIComponent(id)}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = runIdInput.trim();
    if (!trimmed) {
      notify.warn("请输入 runId");
      return;
    }
    setChecking(true);
    setError(null);
    try {
      handleOpenRun(trimmed);
    } catch (err) {
      setError((err as Error)?.message ?? "run 不存在或无法访问");
      notify.error("无法打开", (err as Error).message);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <StandalonePageHeader
        title="流水线节点启停"
        description="按项目维度查看 run，进入后可暂停 / 恢复 / 跳过节点。"
        breadcrumbs={["首页", "流水线"]}
        extraRight={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void reload()}
            disabled={loading}
            aria-label="刷新 run 列表"
          >
            <RefreshCw className={loading ? "mr-1 h-3 w-3 animate-spin" : "mr-1 h-3 w-3"} />
            刷新
          </Button>
        }
      />

      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-6 py-6 sm:px-8">
        {/* 概览 + 搜索 + runId 直跳 */}
        <Card>
          <CardContent className="p-5">
            <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <FolderKanban className="h-3.5 w-3.5" />
                <span>{totalProjects} 个项目</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Workflow className="h-3.5 w-3.5" />
                <span>{totalRuns} 个 run</span>
              </div>
              <div className="flex-1" />
              <div className="relative min-w-[200px]">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="搜索 run / 项目 / 状态…"
                  className="h-8 pl-7 text-xs"
                  aria-label="搜索 run"
                />
              </div>
            </div>
            <form onSubmit={handleSubmit} className="flex items-center gap-2">
              <Input
                aria-label="流水线运行 ID"
                value={runIdInput}
                onChange={(e) => setRunIdInput(e.target.value)}
                placeholder="或直接输入 runId 打开（run-test-xxxxxx）"
                className="flex-1 font-mono text-xs"
                disabled={checking}
              />
              <Button type="submit" size="sm" disabled={checking} aria-label="打开流水线运行">
                {checking ? (
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ArrowRight className="mr-1 h-3.5 w-3.5" />
                )}
                打开
              </Button>
            </form>
          </CardContent>
        </Card>

        {error ? (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm text-red-200"
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            {error}
          </div>
        ) : null}

        {/* 列表 */}
        {loading ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 inline-block h-4 w-4 animate-spin" />
              正在加载 run 列表…
            </CardContent>
          </Card>
        ) : filteredGroups.length === 0 ? (
          <Card>
            <CardContent className="p-9 text-center">
              <Workflow className="mx-auto h-7 w-7 text-muted-foreground/50" />
              <h3 className="mt-2.5 text-sm font-medium text-foreground">
                {search ? "没有匹配的 run" : "暂无 run 记录"}
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                可通过 SQLite 直接 INSERT 一条 pipeline_runs + pipeline_nodes 记录，
                <br />
                或调用后端 service（如 <code className="font-mono">pipelineRunService.createRun</code>）创建 run。
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-4">
            {filteredGroups.map((g) => (
              <Card key={g.project?.id ?? "__none__"}>
                <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
                  <div className="flex items-center gap-2">
                    <FolderKanban className="h-4 w-4 text-blue-300" />
                    <CardTitle className="text-sm font-semibold">{g.projectLabel}</CardTitle>
                    <span className="text-[11px] text-muted-foreground">{g.runs.length} 个 run</span>
                  </div>
                  {g.project && (
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-xs text-blue-300"
                      onClick={() =>
                        router.push(`/projects/${encodeURIComponent(g.project!.id)}`)
                      }
                    >
                      查看项目
                      <ChevronRight className="ml-0.5 h-3 w-3" />
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="space-y-2 pt-0">
                  {g.runs.map((run) => {
                    const meta = STATUS_META[run.status ?? ""] ?? STATUS_META.waiting;
                    const Icon = meta.Icon;
                    const progress = run.progress ?? 0;
                    return (
                      <button
                        type="button"
                        key={run.id}
                        onClick={() => handleOpenRun(run.id)}
                        className="group flex w-full items-center gap-3 rounded-md border border-white/10 bg-black/30 px-3 py-2.5 text-left text-foreground transition-colors hover:border-blue-300/50 hover:bg-blue-500/5"
                        aria-label={`打开 run ${run.name ?? run.id}`}
                      >
                        <Badge variant={meta.variant} className="gap-1">
                          <Icon
                            className={`h-2.5 w-2.5 ${
                              meta.Icon === Loader2 ? "animate-spin" : ""
                            }`}
                          />
                          {meta.label}
                        </Badge>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium">
                            {run.name || run.id}
                          </span>
                          <span className="block truncate font-mono text-[11px] text-muted-foreground">
                            {run.id}
                          </span>
                        </span>
                        <div className="flex w-[120px] flex-col items-end gap-1">
                          <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
                            <div
                              className="h-full bg-gradient-to-r from-blue-500 to-blue-300 transition-[width] duration-200"
                              style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            {run.completedCount ?? 0} / {run.nodeCount ?? 0} 节点 · {progress}%
                          </span>
                        </div>
                        <div className="min-w-[100px] text-right text-[11px] text-muted-foreground">
                          {formatTime(run.created_at)}
                        </div>
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
                      </button>
                    );
                  })}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
