"use client";

/**
 * 审核中心模块
 *
 * 功能：
 * - 审核列表展示
 * - 新建/编辑审核对话框（含必填验证）
 * - 删除审核确认
 */

import { useState, useMemo, useEffect } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { PageContainer, PageCard } from "@/components/layout/page-container";
import { ModuleToolbar, SearchInput, FilterSelect, EmptyState, Pagination } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { FormDialog, type FormFieldConfig } from "@/components/ui/form-dialog";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { useProjectStore } from "@/lib/stores/project-store";
import { listReviews, createReview, updateReview, deleteReview as deleteReviewApi } from "@/services/module.service";
import { clearApiCache } from "@/lib/api-client";
import type { Review } from "@/lib/module-types";

/** 审核目标类型中文标签映射 */
const contentTypeLabels: Record<string, string> = {
  image: "图片",
  video: "视频",
  audio: "音频",
  script: "剧本",
};

/** 审核表单字段配置 */
const reviewFields: FormFieldConfig[] = [
  {
    name: "content_type",
    label: "内容类型",
    type: "select",
    required: true,
    options: [
      { value: "script", label: "剧本" },
      { value: "video", label: "视频" },
      { value: "audio", label: "音频" },
      { value: "image", label: "图片" },
    ],
    defaultValue: "script",
  },
  { name: "content_id", label: "内容ID", type: "text", required: true, placeholder: "请输入内容ID" },
  { name: "content_title", label: "内容标题", type: "text", placeholder: "请输入内容标题" },
  {
    name: "result",
    label: "审核结果",
    type: "select",
    required: true,
    options: [
      { value: "pending", label: "待审核" },
      { value: "approved", label: "已通过" },
      { value: "rejected", label: "已拒绝" },
    ],
    defaultValue: "pending",
  },
  { name: "score", label: "评分", type: "number", placeholder: "0", min: 0 },
  { name: "reviewer_name", label: "审核人", type: "text", required: true, placeholder: "请输入审核人" },
  { name: "comment", label: "审核意见", type: "textarea", placeholder: "请输入审核意见", rows: 3 },
];

export function ReviewCenterPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [resultFilter, setResultFilter] = useState("");

  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // 对话框状态
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingReview, setEditingReview] = useState<Review | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // 删除确认状态
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; title: string } | null>(null);

  // 从 store 获取选中的项目ID
  const selectedProjectId = useProjectStore((state) => state.selectedProjectId);

  // 根据 selectedProjectId 加载审核数据
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!selectedProjectId) { setReviews([]); return; }
    setIsLoading(true);
    listReviews(selectedProjectId)
      .then(data => setReviews(data as unknown as Review[]))
      .catch(err => console.error("Failed to load reviews:", err))
      .finally(() => setIsLoading(false));
  }, [selectedProjectId]);

  const resultOptions = [
    { value: "", label: "全部状态" },
    { value: "pending", label: "待审核" },
    { value: "approved", label: "已通过" },
    { value: "rejected", label: "已拒绝" },
  ];

  const filteredReviews = useMemo(() => {
    return reviews.filter((review) => {
      const matchesSearch = review.content_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (review.content_title || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (review.comment || "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchesResult = !resultFilter || review.result === resultFilter;
      return matchesSearch && matchesResult;
    });
  }, [reviews, searchQuery, resultFilter]);

  // 分页后的审核列表
  const paginatedReviews = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredReviews.slice(start, start + pageSize);
  }, [filteredReviews, currentPage, pageSize]);

  // 计算总页数
  const totalPages = Math.ceil(filteredReviews.length / pageSize);

  // 打开新建对话框
  const handleCreate = () => {
    setEditingReview(null);
    setIsFormOpen(true);
  };

  // 打开编辑对话框
  const handleEdit = (review: Review) => {
    setEditingReview(review);
    setIsFormOpen(true);
  };

  // 保存审核（新建或编辑）
  const handleSave = async (values: Record<string, string | number | string[]>) => {
    setIsSaving(true);
    try {
      const payload = { ...values, project_id: selectedProjectId } as any;
      if (editingReview) {
        await updateReview(selectedProjectId, editingReview.id, payload);
      } else {
        await createReview(selectedProjectId, payload);
      }
      setIsFormOpen(false);
      setEditingReview(null);
      // Refresh the list
      clearApiCache();
      const data = await listReviews(selectedProjectId);
      setReviews(data as unknown as Review[]);
    } finally {
      setIsSaving(false);
    }
  };

  // 确认删除
  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    await deleteReviewApi(selectedProjectId, deleteConfirm.id);
    setDeleteConfirm(null);
    clearApiCache();
    const data = await listReviews(selectedProjectId);
    setReviews(data as unknown as Review[]);
  };

  return (
    <PageContainer title="审核中心" description="审核和管理生成内容">
      <ModuleToolbar
        left={
          <>
            <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="搜索内容..." />
            <FilterSelect value={resultFilter} onChange={setResultFilter} options={resultOptions} placeholder="审核状态" />
          </>
        }
        right={
          <Button size="sm" onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            新建审核
          </Button>
        }
      />

      <PageCard title="审核队列">
        {filteredReviews.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="px-4 py-3 text-left text-sm font-medium text-[#888]">内容ID</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-[#888] hidden md:table-cell">类型</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-[#888]">审核结果</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-[#888] hidden md:table-cell">审核人</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-[#888] hidden sm:table-cell">审核意见</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-[#888] hidden sm:table-cell">时间</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-[#888]">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedReviews.map((review) => (
                    <tr key={review.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-white">
                        <div>{review.content_id}</div>
                        {review.content_title && (
                          <div className="text-xs text-[#666] line-clamp-1">{review.content_title}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="px-2 py-0.5 rounded text-xs bg-white/5 text-[#888]">
                          {contentTypeLabels[review.content_type] ?? review.content_type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs ${review.result === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                          review.result === 'approved' ? 'bg-emerald-500/20 text-emerald-400' :
                            'bg-red-500/20 text-red-400'
                          }`}>
                          {review.result === 'pending' ? '待审核' :
                            review.result === 'approved' ? '已通过' : '已拒绝'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-[#888] hidden md:table-cell">
                        {review.reviewer_name || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-[#888] hidden sm:table-cell">
                        {review.comment || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-[#888] hidden sm:table-cell">
                        {new Date(review.updated_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(review)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm({ id: review.id, title: review.content_title || review.content_id })}>
                            <Trash2 className="h-4 w-4 text-red-400" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 分页组件 */}
            {totalPages > 1 && (
              <div className="mt-4">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={filteredReviews.length}
                  pageSize={pageSize}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={setPageSize}
                />
              </div>
            )}
          </>
        ) : (
          <EmptyState
            type="no-results"
            title="暂无审核内容"
            description={searchQuery || resultFilter ? "尝试调整搜索条件" : "点击上方按钮创建新审核"}
            action={{ label: "新建审核", onClick: handleCreate }}
          />
        )}
      </PageCard>

      {/* 新建/编辑对话框 */}
      <FormDialog
        title={editingReview ? "编辑审核" : "新建审核"}
        fields={reviewFields}
        initialValues={editingReview ? {
          content_type: editingReview.content_type,
          content_id: editingReview.content_id,
          content_title: editingReview.content_title || "",
          result: editingReview.result,
          score: editingReview.score ?? 0,
          reviewer_name: editingReview.reviewer_name || "",
          comment: editingReview.comment ?? "",
        } as Record<string, string | number> : {}}
        isOpen={isFormOpen}
        onClose={() => { setIsFormOpen(false); setEditingReview(null); }}
        onSave={handleSave}
        isLoading={isSaving}
      />

      {/* 删除确认对话框 */}
      {deleteConfirm && (
        <ConfirmDialog
          title="删除审核"
          description={`确定要删除审核「${deleteConfirm.title}」吗？此操作无法撤销。`}
          confirmLabel="删除"
          onClose={() => setDeleteConfirm(null)}
          onConfirm={handleDeleteConfirm}
        />
      )}
    </PageContainer>
  );
}