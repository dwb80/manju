"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { useProjectStore } from "@/lib/stores/project-store";

type Overview = {
  projectId: string;
  costs: Record<string, unknown> | null;
  quality: Record<string, unknown> | null;
  capacity: Record<string, unknown> | null;
  generatedAt: string;
};

function MetricGroup({ title, value }: { title: string; value: Record<string, unknown> | null }) {
  const entries = Object.entries(value ?? {}).filter(([key]) => key !== "project_id").slice(0, 4);
  return (
    <article className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <h3 className="text-sm font-medium text-white">{title}</h3>
      {entries.length ? <dl className="mt-3 grid grid-cols-2 gap-3">{entries.map(([key, item]) => (
        <div key={key}><dt className="truncate text-xs text-neutral-500">{key}</dt><dd className="mt-1 text-sm text-neutral-200">{String(item ?? "-")}</dd></div>
      ))}</dl> : <p className="mt-3 text-xs text-neutral-500">当前项目暂无数据</p>}
    </article>
  );
}

export function ProjectOverviewSection() {
  const projectId = useProjectStore((state) => state.selectedProjectId);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!projectId) { setOverview(null); setError(""); return; }
    let active = true;
    api<Overview>(`/api/data/project-overview?projectId=${encodeURIComponent(projectId)}`, { cache: "no-store" })
      .then((value) => { if (active) { setOverview(value); setError(""); } })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "加载失败"); });
    return () => { active = false; };
  }, [projectId]);
  if (!projectId) return <div className="rounded-xl border border-dashed border-white/10 p-5 text-sm text-neutral-500">选择项目后查看项目成本、质量与产能。</div>;
  if (error) return <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-300">项目概览加载失败：{error}</div>;
  return <div className="grid gap-4 md:grid-cols-3"><MetricGroup title="项目成本" value={overview?.costs ?? null} /><MetricGroup title="质量表现" value={overview?.quality ?? null} /><MetricGroup title="生产产能" value={overview?.capacity ?? null} /></div>;
}
