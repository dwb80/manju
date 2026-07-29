"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listDependencyImpacts, type DependencyImpactList, type DependencyFreshness } from "@/services/governance.service";

const VARIANT: Record<DependencyFreshness, "success" | "warning" | "destructive" | "muted"> = { current: "success", stale: "warning", blocked: "destructive", unknown: "muted" };

export function DependencyImpactPanel({ projectId }: { projectId: string }) {
  const [data, setData] = useState<DependencyImpactList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => { setLoading(true); setError(null); try { setData(await listDependencyImpacts(projectId)); } catch (cause) { setError(cause instanceof Error ? cause.message : "无法加载依赖影响"); } finally { setLoading(false); } }, [projectId]);
  useEffect(() => { void load(); }, [load]);
  return <section aria-labelledby="dep-title" className="rounded-xl border border-border bg-card p-4">
    <div className="flex items-center justify-between"><div><h2 id="dep-title" className="font-semibold">生产依赖与变更影响</h2><p className="text-xs text-muted-foreground">状态来自事件投影，页面不可直接修改新鲜度</p></div><Button size="sm" variant="outline" onClick={() => void load()}><RefreshCw className="mr-1 h-3.5 w-3.5" />刷新</Button></div>
    {loading && <p role="status" className="mt-3 text-sm text-muted-foreground">正在读取投影水位…</p>}
    {error && <p role="alert" className="mt-3 flex gap-2 text-sm text-destructive"><AlertTriangle className="h-4 w-4" />{error}</p>}
    {data && <><div className="mt-3 flex flex-wrap gap-2">{Object.entries(data.counts).map(([key, count]) => <Badge key={key} variant={VARIANT[key as DependencyFreshness]}>{key} {count}</Badge>)}<span className="text-xs text-muted-foreground">watermark: {data.projectionWatermark}</span></div><div className="mt-3 space-y-2">{data.items.slice(0, 8).map((item) => <div key={`${item.sourceRef}-${item.targetRef}`} className="flex flex-wrap items-center gap-2 rounded-md border border-border px-3 py-2 text-xs"><Badge variant={VARIANT[item.freshness]}>{item.freshness}</Badge><span>{item.sourceRef} → {item.targetRef}</span><span className="text-muted-foreground">{item.reason}</span></div>)}{data.items.length === 0 && <p className="text-sm text-muted-foreground">当前没有受影响依赖。</p>}</div></>}
  </section>;
}

