/** Lightweight in-process P50/P95/P99 monitor for NF-F01/F02. */
export type PerformanceGroup = "list" | "workbench" | "other";
interface Sample { path: string; method: string; durationMs: number; status: number; at: number; group: PerformanceGroup }
const MAX_SAMPLES = 5000;
const samples: Sample[] = [];

export function classifyPerformanceGroup(method: string, pathname: string): PerformanceGroup {
  if (method === "GET" && (/\/api\/[^/]+$/.test(pathname) || pathname.includes("/list"))) return "list";
  if (pathname.includes("workbench") || /^\/api\/projects\/[^/]+$/.test(pathname)) return "workbench";
  return "other";
}

export function recordHttpPerformance(sample: Omit<Sample, "at" | "group">): void {
  samples.push({ ...sample, at: Date.now(), group: classifyPerformanceGroup(sample.method, sample.path) });
  if (samples.length > MAX_SAMPLES) samples.splice(0, samples.length - MAX_SAMPLES);
}

function percentile(values: number[], pct: number): number {
  if (!values.length) return 0; const sorted = [...values].sort((a, b) => a - b);
  return Math.round(sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * pct) - 1)] * 100) / 100;
}

export function getHttpPerformanceSummary(windowMinutes = 15) {
  const cutoff = Date.now() - Math.max(1, windowMinutes) * 60_000; const recent = samples.filter((s) => s.at >= cutoff);
  const summarize = (group: PerformanceGroup, thresholdMs: number) => {
    const selected = recent.filter((s) => s.group === group); const durations = selected.map((s) => s.durationMs); const p95 = percentile(durations, .95);
    return { group, count: selected.length, p50Ms: percentile(durations, .5), p95Ms: p95, p99Ms: percentile(durations, .99), errorRate: selected.length ? Math.round(selected.filter((s) => s.status >= 500).length / selected.length * 10000) / 100 : 0, thresholdMs, healthy: !selected.length || p95 <= thresholdMs };
  };
  return { windowMinutes, generatedAt: new Date().toISOString(), groups: [summarize("list", 500), summarize("workbench", 1000), summarize("other", 1500)] };
}
