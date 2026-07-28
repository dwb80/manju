"use client";

/**
 * 剧本工作台：审核 tab
 *
 * 整合 spec 4.1 审核中心（review_items 表，新数据源）和老的 ProjectReview
 * 评审意见（分镜评论，reviews 旧数据源），双区并存：
 *
 *   ┌────────────────────────────┐
 *   │ 上：审核中心（spec 4.1）   │  ← 调 /api/reviews，5 个端点
 *   │  左：状态过滤 + 看板统计   │  ← 累计退回 ≥3 次红标
 *   │  右：待审列表 + 通过/打回  │  ← 6 个打回原因 radio
 *   ├────────────────────────────┤
 *   │ 下：评审意见（老 ProjectReview）│  ← 分镜卡片里的评论
 *   └────────────────────────────┘
 */

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Filter, ShieldCheck, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ManagementTable as ProjectManagementTable } from "@/components/project/project-workbench";
import {
  approveReview,
  fetchReviewStats,
  fetchReviews,
  REJECTION_REASONS,
  rejectReview,
  type RejectionReasonCode,
  type ReviewItem,
  type ReviewStats,
  type ReviewStatus,
} from "@/lib/api-client";
import type { ProjectWorkbenchTabsProps } from "./types";

// ============== 顶部：spec 4.1 审核中心 ==============

interface AuditCenterSectionProps {
  projectId: string | undefined;
}

const STATUS_CHIPS: Array<{ key: ReviewStatus | "all"; label: string }> = [
  { key: "all", label: "全部" },
  { key: "pending", label: "待审" },
  { key: "approved", label: "已通过" },
  { key: "rejected", label: "已打回" },
];

function AuditCenterSection({ projectId }: AuditCenterSectionProps) {
  const [status, setStatus] = useState<ReviewStatus | "all">("pending");
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<ReviewItem | null>(null);
  const [reasonCode, setReasonCode] = useState<RejectionReasonCode>("character_inconsistent");
  const [submitting, setSubmitting] = useState(false);

  const reload = useMemo(
    () => async () => {
      if (!projectId) return;
      setLoading(true);
      setError(null);
      try {
        const [s, list] = await Promise.all([
          fetchReviewStats(projectId),
          status === "all" ? fetchReviews(projectId) : fetchReviews(projectId, status),
        ]);
        setStats(s);
        setItems(list);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [projectId, status],
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  if (!projectId) {
    return (
      <div className="rounded-2xl border border-border bg-muted px-5 py-6 text-sm text-foreground/80">
        暂无项目上下文，请先选择项目。
      </div>
    );
  }

  async function handleApprove(item: ReviewItem) {
    setSubmitting(true);
    try {
      await approveReview(item.id);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReject() {
    if (!rejecting) return;
    setSubmitting(true);
    try {
      await rejectReview(rejecting.id, reasonCode);
      setRejecting(null);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-muted">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <div className="flex items-center gap-2 text-base font-semibold text-foreground">
            <ShieldCheck className="h-4 w-4" /> 审核中心
            <span className="rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">spec 4.1</span>
          </div>
          <div className="mt-1 text-sm text-muted-foreground">分镜 / 资产 / 视频的资产级审核。退回 ≥3 次红标并通知项目负责人。</div>
        </div>
        <div className="flex items-center gap-2">
          {STATUS_CHIPS.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => setStatus(chip.key)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                status === chip.key
                  ? "border-primary/40 bg-primary/15 text-primary"
                  : "border-border bg-muted/50 text-muted-foreground hover:border-border hover:text-foreground"
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="mx-5 mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
      ) : null}

      <div className="grid grid-cols-1 gap-0 lg:grid-cols-[280px_1fr]">
        {/* 左栏：看板统计 */}
        <aside className="border-b border-border p-5 lg:border-b-0 lg:border-r">
          <div className="space-y-3">
            <StatCard label="待审" value={stats?.pending ?? 0} tone="yellow" />
            <StatCard label="已通过" value={stats?.approved ?? 0} tone="emerald" />
            <StatCard label="已打回" value={stats?.rejected ?? 0} tone="red" />
            <StatCard
              label="累计退回 ≥3"
              value={stats?.blockedByFrequentRejection ?? 0}
              tone="orange"
              hint="需项目负责人介入"
            />
          </div>
          <div className="mt-5 rounded-xl border border-border bg-muted/50 p-4">
            <div className="text-xs font-medium text-muted-foreground">审核进度</div>
            <div className="mt-2 flex items-baseline gap-2">
              <div className="text-2xl font-semibold text-foreground">{stats?.progress.pct ?? 0}%</div>
              <div className="text-xs text-muted-foreground">
                {stats?.progress.approved ?? 0} / {stats?.progress.total ?? 0}
              </div>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted/50">
              <div
                className="h-full rounded-full bg-primary/70"
                style={{ width: `${stats?.progress.pct ?? 0}%` }}
              />
            </div>
          </div>
        </aside>

        {/* 右栏：审核列表 */}
        <section className="p-5">
          {loading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">加载中…</div>
          ) : items.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">暂无{status === "all" ? "" : STATUS_CHIPS.find((c) => c.key === status)?.label}审核项</div>
          ) : (
            <ul className="space-y-2">
              {items.map((item) => (
                <li
                  key={item.id}
                  className={`rounded-xl border px-4 py-3 transition-colors ${
                    item.rejected_count >= 3 ? "border-chart-3/40 bg-chart-3/5" : "border-border bg-muted/50"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="rounded-md border border-border bg-black/30 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                          {item.target_type}
                        </span>
                        <span className="truncate font-mono text-xs text-foreground/80">{item.target_id}</span>
                        <StatusBadge item={item} />
                        {item.rejected_count >= 3 ? (
                          <span className="rounded-full border border-chart-3/40 bg-chart-3/15 px-2 py-0.5 text-[11px] font-medium text-chart-3">
                            已累计退回 {item.rejected_count} 次
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1.5 text-xs text-muted-foreground">
                        提交人 {item.submitted_by || "未知"} · 更新于 {item.updated_at?.slice(0, 16).replace("T", " ")}
                        {item.status === "rejected" && item.rejection_reason ? (
                          <> · 打回原因 <span className="text-destructive">{REJECTION_REASONS.find((r) => r.code === item.rejection_reason)?.label ?? item.rejection_reason}</span></>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={submitting || item.status === "approved"}
                        onClick={() => void handleApprove(item)}
                      >
                        <CheckCircle2 className="mr-1 h-4 w-4" />通过
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={submitting}
                        onClick={() => {
                          setRejecting(item);
                          setReasonCode("character_inconsistent");
                        }}
                      >
                        <XCircle className="mr-1 h-4 w-4" />打回
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* 打回原因 Dialog */}
      {rejecting ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-muted p-5 shadow-2xl">
            <div className="text-base font-semibold text-foreground">选择打回原因</div>
            <div className="mt-1 text-xs text-muted-foreground">对象：{rejecting.target_type} · {rejecting.target_id}</div>
            <div className="mt-4 space-y-2">
              {REJECTION_REASONS.map((r) => (
                <label
                  key={r.code}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                    reasonCode === r.code ? "border-primary/40 bg-primary/10 text-primary-foreground" : "border-border bg-muted/50 text-foreground/80"
                  }`}
                >
                  <input
                    type="radio"
                    name="reason"
                    value={r.code}
                    checked={reasonCode === r.code}
                    onChange={() => setReasonCode(r.code)}
                    className="accent-primary"
                  />
                  {r.label}
                </label>
              ))}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setRejecting(null)} disabled={submitting}>取消</Button>
              <Button variant="destructive" onClick={() => void handleReject()} disabled={submitting}>
                {submitting ? "提交中…" : "确认打回"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StatCard({ label, value, tone, hint }: { label: string; value: number; tone: "yellow" | "emerald" | "red" | "orange"; hint?: string }) {
  const toneClass: Record<typeof tone, string> = {
    yellow: "border-chart-5/30 bg-chart-5/10 text-chart-5",
    emerald: "border-primary/30 bg-primary/10 text-primary",
    red: "border-destructive/30 bg-destructive/10 text-destructive",
    orange: "border-chart-3/30 bg-chart-3/10 text-chart-3",
  } as const;
  return (
    <div className={`rounded-xl border px-4 py-3 ${toneClass[tone]}`}>
      <div className="text-xs font-medium opacity-80">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {hint ? <div className="mt-0.5 text-[10px] opacity-70">{hint}</div> : null}
    </div>
  );
}

function StatusBadge({ item }: { item: ReviewItem }) {
  if (item.status === "approved") {
    return <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">已通过</span>;
  }
  if (item.status === "rejected") {
    return <span className="rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">已打回</span>;
  }
  return <span className="rounded-full border border-chart-5/30 bg-chart-5/10 px-2 py-0.5 text-[11px] font-medium text-chart-5">待审</span>;
}

// ============== 主组件 ==============

export function ReviewsTab(props: Pick<
  ProjectWorkbenchTabsProps,
  "filteredProjectReviews" | "pagedProjectReviews" | "reviewTargetLabel" | "updateProjectReviewItem" | "deleteProjectReviewItem" | "projectReviews"
>) {
  const { filteredProjectReviews, pagedProjectReviews, reviewTargetLabel, updateProjectReviewItem, deleteProjectReviewItem, projectReviews } = props;
  // projectId 上下文：老 ProjectReview 与新审核中心共享项目
  const projectId = projectReviews[0]?.project_id;
  return (
    <div className="space-y-4">
      <AuditCenterSection projectId={projectId} />

      <div className="rounded-2xl border border-border bg-muted">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <div className="flex items-center gap-2 text-base font-semibold text-foreground">
              <Filter className="h-4 w-4" /> 评审意见
              <span className="rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">分镜评论</span>
            </div>
            <div className="mt-1 text-sm text-muted-foreground">分镜 / 剪辑 / 资产上的协作评论（与上方"审核中心"是两套独立数据）。</div>
          </div>
          <div className="rounded-full border border-chart-5/20 bg-chart-5/10 px-3 py-1 text-sm font-medium text-chart-5">
            待处理 {filteredProjectReviews.filter((review) => review.status === "open").length} / 当前 {filteredProjectReviews.length}
          </div>
        </div>
        {filteredProjectReviews.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <div className="text-base font-semibold text-foreground">{projectReviews.length === 0 ? "暂无审核意见" : "没有匹配的审核意见"}</div>
            <div className="mt-2 text-sm text-muted-foreground">{projectReviews.length === 0 ? "可以在分镜卡片里添加返工点或通过意见。" : "调整搜索或状态筛选后再试。"}</div>
          </div>
        ) : (
          <ProjectManagementTable columns={["状态", "对象", "意见", "审核人", "时间", "操作"]}>
            {pagedProjectReviews.map((review) => (
              <tr key={review.id} className="align-top transition-colors hover:bg-muted/40">
                <td className="px-4 py-4">
                  <span className={review.status === "open" ? "inline-flex rounded-full border border-chart-5/20 bg-chart-5/10 px-2.5 py-1 text-xs font-medium text-chart-5" : review.status === "resolved" ? "inline-flex rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary" : "inline-flex rounded-full border border-destructive/20 bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive"}>
                    {review.status === "open" ? "待处理" : review.status === "resolved" ? "已解决" : "已驳回"}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <div className="max-w-[220px] truncate font-semibold text-foreground">{reviewTargetLabel(review)}</div>
                </td>
                <td className="px-4 py-4">
                  <div className="line-clamp-3 max-w-[420px] whitespace-pre-wrap text-foreground/80">{review.comment}</div>
                </td>
                <td className="px-4 py-4 text-foreground/80">{review.reviewer || "审核人"}</td>
                <td className="px-4 py-4 text-muted-foreground">{review.created_at?.slice(0, 10) || "-"}</td>
                <td className="px-4 py-4">
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={() => void updateProjectReviewItem(review, { status: "resolved" })}>通过</Button>
                    <Button size="sm" variant="secondary" onClick={() => void updateProjectReviewItem(review, { status: "rejected" })}>驳回</Button>
                    <Button size="sm" variant="destructive" onClick={() => void deleteProjectReviewItem(review)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </ProjectManagementTable>
        )}
      </div>
    </div>
  );
}
