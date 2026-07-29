"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listReviewIntakes, waiveReviewIntake, type ReviewIntake, type ReviewIntakeStatus } from "@/services/governance.service";

const LABEL: Record<ReviewIntakeStatus, string> = {
  qc_running: "自动质检中", qc_blocked: "质检阻断", review_pending: "待分配审核", reviewing: "审核中", needs_fix: "待返工", completed: "已完成",
};
const VARIANT: Record<ReviewIntakeStatus, "info" | "destructive" | "warning" | "success" | "muted"> = {
  qc_running: "info", qc_blocked: "destructive", review_pending: "warning", reviewing: "info", needs_fix: "warning", completed: "success",
};

export function ReviewIntakeQueue({ projectId }: { projectId: string }) {
  const [items, setItems] = useState<ReviewIntake[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [waiverId, setWaiverId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true); setError(null);
    try { setItems(await listReviewIntakes(projectId)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "无法加载 Review Intake"); }
    finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);
  const active = useMemo(() => items.filter((item) => item.status !== "completed"), [items]);

  async function submitWaiver(item: ReviewIntake) {
    if (reason.trim().length < 10) { setError("豁免原因至少 10 个字符"); return; }
    try {
      const updated = await waiveReviewIntake(item, reason.trim());
      setItems((current) => current.map((value) => value.id === updated.id ? updated : value));
      setWaiverId(null); setReason("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "豁免失败"); }
  }

  return (
    <section aria-labelledby="review-intake-title" className="mb-4 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div><h2 id="review-intake-title" className="font-semibold">送审准入队列</h2><p className="text-xs text-muted-foreground">冻结快照 → 自动 QC → 人工审核；mandatory 规则不可豁免</p></div>
        <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className="mr-1 h-3.5 w-3.5" />刷新</Button>
      </div>
      {loading && <div role="status" className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />加载准入状态…</div>}
      {error && <div role="alert" className="mt-4 flex gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"><AlertTriangle className="h-4 w-4 shrink-0" />{error}</div>}
      {!loading && !error && active.length === 0 && <p className="mt-4 text-sm text-muted-foreground">当前没有进行中的送审准入。</p>}
      <div className="mt-3 space-y-2">
        {active.map((item) => {
          const mandatory = item.blockers.some((blocker) => blocker.mandatory);
          const canWaive = item.status === "qc_blocked" && !mandatory && item.warnings.some((warning) => warning.waivable);
          return <article key={item.id} className="rounded-lg border border-border p-3">
            <div className="flex flex-wrap items-center gap-2"><ShieldCheck className="h-4 w-4" /><span className="font-medium">{item.targetType} · {item.targetId}</span><Badge variant={VARIANT[item.status]}>{LABEL[item.status]}</Badge><span className="text-xs text-muted-foreground">v{item.targetVersion} · {item.snapshotHash.slice(0, 10)}</span></div>
            {[...item.blockers, ...item.warnings].length > 0 && <ul className="mt-2 space-y-1 text-xs text-muted-foreground">{[...item.blockers, ...item.warnings].map((issue) => <li key={issue.code}>• {issue.code}: {issue.message}{"mandatory" in issue && issue.mandatory ? "（mandatory）" : ""}</li>)}</ul>}
            {canWaive && waiverId !== item.id && <Button className="mt-2" size="sm" variant="outline" onClick={() => setWaiverId(item.id)}>申请受控豁免</Button>}
            {waiverId === item.id && <div className="mt-2 flex flex-col gap-2 sm:flex-row"><Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="填写业务理由（至少10字）" aria-label="QC豁免原因" /><Button size="sm" onClick={() => void submitWaiver(item)}>确认并审计放行</Button><Button size="sm" variant="ghost" onClick={() => setWaiverId(null)}>取消</Button></div>}
          </article>;
        })}
      </div>
    </section>
  );
}

