"use client";

/**
 * 剧本工作台：审核意见（reviews）tab
 *
 * 集中展示分镜 / 剪辑 / 资产上的审核意见。
 * 通过/驳回/删除 操作。
 */

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ManagementTable as ProjectManagementTable } from "@/components/project/project-workbench";
import type { ProjectWorkbenchTabsProps } from "./types";

export function ReviewsTab(props: Pick<
  ProjectWorkbenchTabsProps,
  "filteredProjectReviews" | "pagedProjectReviews" | "reviewTargetLabel" | "updateProjectReviewItem" | "deleteProjectReviewItem" | "projectReviews"
>) {
  const { filteredProjectReviews, pagedProjectReviews, reviewTargetLabel, updateProjectReviewItem, deleteProjectReviewItem, projectReviews } = props;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-[#202020]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div>
            <div className="text-base font-semibold text-white">审核中心</div>
            <div className="mt-1 text-sm text-[#bdbdbd]">集中处理分镜、剪辑、资产相关审核意见。</div>
          </div>
          <div className="rounded-full border border-yellow-500/20 bg-yellow-500/10 px-3 py-1 text-sm font-medium text-yellow-100">
            待处理 {filteredProjectReviews.filter((review) => review.status === "open").length} / 当前 {filteredProjectReviews.length}
          </div>
        </div>
        {filteredProjectReviews.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <div className="text-base font-semibold text-white">{projectReviews.length === 0 ? "暂无审核意见" : "没有匹配的审核意见"}</div>
            <div className="mt-2 text-sm text-[#bdbdbd]">{projectReviews.length === 0 ? "可以在分镜卡片里添加返工点或通过意见。" : "调整搜索或状态筛选后再试。"}</div>
          </div>
        ) : (
          <ProjectManagementTable columns={["状态", "对象", "意见", "审核人", "时间", "操作"]}>
            {pagedProjectReviews.map((review) => (
              <tr key={review.id} className="align-top transition-colors hover:bg-white/[0.03]">
                <td className="px-4 py-4">
                  <span className={review.status === "open" ? "inline-flex rounded-full border border-yellow-500/20 bg-yellow-500/10 px-2.5 py-1 text-xs font-medium text-yellow-100" : review.status === "resolved" ? "inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-100" : "inline-flex rounded-full border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-100"}>
                    {review.status === "open" ? "待处理" : review.status === "resolved" ? "已解决" : "已驳回"}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <div className="max-w-[220px] truncate font-semibold text-white">{reviewTargetLabel(review)}</div>
                </td>
                <td className="px-4 py-4">
                  <div className="line-clamp-3 max-w-[420px] whitespace-pre-wrap text-[#cfcfcf]">{review.comment}</div>
                </td>
                <td className="px-4 py-4 text-[#cfcfcf]">{review.reviewer || "审核人"}</td>
                <td className="px-4 py-4 text-[#bdbdbd]">{review.created_at?.slice(0, 10) || "-"}</td>
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
