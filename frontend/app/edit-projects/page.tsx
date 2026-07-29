"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Film, RefreshCw } from "lucide-react";
import { api } from "@/lib/api-client";
import { useProjectStore } from "@/lib/stores/project-store";
import { StandalonePageHeader } from "@/components/layout/standalone-page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { EditProjectSummary } from "@/lib/timeline-types";

export default function EditProjectsPage() {
  const projectId = useProjectStore((state) => state.selectedProjectId);
  const [items, setItems] = useState<EditProjectSummary[]>([]); const [error, setError] = useState<string | null>(null); const [loading, setLoading] = useState(true);
  const load = useCallback(async () => { if (!projectId) { setLoading(false); return; } setLoading(true); setError(null); try { const result = await api<EditProjectSummary[] | { items: EditProjectSummary[] }>(`/api/v1/edit-projects?projectId=${encodeURIComponent(projectId)}`); setItems(Array.isArray(result) ? result : result.items); } catch (cause) { setError(cause instanceof Error ? cause.message : "无法加载剪辑工程"); } finally { setLoading(false); } }, [projectId]);
  useEffect(() => { void load(); }, [load]);
  return <main className="min-h-screen bg-background"><StandalonePageHeader title="剪辑中心" description="EditProject 修订与闭合 Timeline；旧 /clips 仅保留兼容读取" breadcrumbs={["首页", "剪辑中心"]} extraRight={<Button size="sm" variant="outline" onClick={() => void load()}><RefreshCw className="mr-1 h-4 w-4" />刷新</Button>} /><div className="mx-auto max-w-7xl space-y-4 px-6 py-6">{!projectId && <p className="rounded-md border border-warning/30 bg-warning/10 p-3 text-sm">请先选择项目。</p>}{loading && <p role="status" className="text-sm text-muted-foreground">加载 EditProject 修订…</p>}{error && <p role="alert" className="flex gap-2 text-sm text-destructive"><AlertTriangle className="h-4 w-4" />{error}</p>}{!loading && !error && items.length === 0 && <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">暂无剪辑工程。请从已审核 Storyboard 创建 EditProject。</div>}{items.map((item) => <article key={item.id} className="rounded-xl border border-border bg-card p-4"><div className="flex flex-wrap items-center gap-2"><Film className="h-4 w-4" /><h2 className="font-semibold">{item.name ?? item.id}</h2><Badge variant={item.status === "ready" ? "success" : item.status === "rendering" ? "info" : "warning"}>{item.status}</Badge><Badge variant="muted">revision {item.currentRevision}</Badge><Badge variant="muted">version {item.version}</Badge></div><div className="mt-3 grid gap-2 text-xs sm:grid-cols-4"><div>Timebase {item.timeline.timebase.fpsNumerator}/{item.timeline.timebase.fpsDenominator}</div><div>时长 {item.timeline.durationMs} ms</div><div>视频轨 {item.timeline.videoTracks.length}</div><div>音频轨 {item.timeline.audioTracks.length} / 字幕轨 {item.timeline.subtitleTracks.length}</div></div><div className="mt-3 space-y-2">{item.timeline.videoTracks.map((track) => <div key={track.id} className="rounded-md border border-border p-2 text-xs"><strong>{track.name}</strong> · {track.clips.length} clips {track.locked ? "· 已锁定" : ""}<div className="mt-1 flex flex-wrap gap-2">{track.clips.map((clip) => <Badge key={clip.id} variant="muted">{clip.sourceType}:{clip.sourceId}@v{clip.sourceVersion} · {clip.sourceContentHash.slice(0, 8)}</Badge>)}</div></div>)}</div></article>)}</div></main>;
}

