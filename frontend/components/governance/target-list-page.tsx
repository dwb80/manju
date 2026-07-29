"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { api } from "@/lib/api-client";
import { StandalonePageHeader } from "@/components/layout/standalone-page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface TargetListItem {
  id: string;
  title?: string;
  name?: string;
  status?: string;
  type?: string;
  updatedAt?: string;
  createdAt?: string;
  summary?: string;
}

export function TargetListPage({ title, description, endpoint, emptyText, actions }: { title: string; description: string; endpoint: string; emptyText: string; actions?: ReactNode }) {
  const [items, setItems] = useState<TargetListItem[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => { setLoading(true); setError(null); try { const result = await api<TargetListItem[] | { items: TargetListItem[] }>(endpoint); setItems(Array.isArray(result) ? result : result.items); } catch (cause) { setError(cause instanceof Error ? cause.message : `无法加载${title}`); } finally { setLoading(false); } }, [endpoint, title]);
  useEffect(() => { void load(); }, [load]);
  const filtered = useMemo(() => items.filter((item) => `${item.title ?? ""} ${item.name ?? ""} ${item.summary ?? ""}`.toLowerCase().includes(query.toLowerCase())), [items, query]);
  return <main className="min-h-screen bg-background"><StandalonePageHeader title={title} description={description} breadcrumbs={["首页", title]} extraRight={actions} /><div className="mx-auto max-w-6xl space-y-4 px-6 py-6"><div className="flex gap-2"><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`搜索${title}`} aria-label={`搜索${title}`} /><Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className="mr-1 h-4 w-4" />刷新</Button></div>{loading && <p role="status" className="text-sm text-muted-foreground">正在加载…</p>}{error && <div role="alert" className="flex gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"><AlertTriangle className="h-4 w-4" />{error}</div>}{!loading && !error && filtered.length === 0 && <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">{emptyText}</div>}<div className="space-y-2">{filtered.map((item) => <article key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4"><div><h2 className="font-medium">{item.title ?? item.name ?? item.id}</h2><p className="text-xs text-muted-foreground">{item.summary ?? item.id}</p></div><div className="flex items-center gap-2">{item.type && <Badge variant="muted">{item.type}</Badge>}<Badge variant={item.status === "failed" || item.status === "blocked" ? "destructive" : item.status === "completed" || item.status === "published" ? "success" : "warning"}>{item.status ?? "unknown"}</Badge></div></article>)}</div></div></main>;
}
