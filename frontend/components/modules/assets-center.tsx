"use client";

/**
 * 资产中心模块
 *
 * 功能：
 * - 资产列表展示（根据项目选择状态过滤）
 * - 新建/编辑资产对话框（含必填验证）
 * - 删除资产确认
 */

import { useState, useMemo, useEffect } from "react";
import { Plus, Download, Pencil, Trash2 } from "lucide-react";
import { PageContainer, PageCard } from "@/components/layout/page-container";
import { ModuleToolbar, SearchInput, FilterSelect, EmptyState, Pagination } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { FormDialog, type FormFieldConfig } from "@/components/ui/form-dialog";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { useProjectStore } from "@/lib/stores/project-store";
import { listAssets, createAsset, updateAsset, deleteAsset as deleteAssetApi } from "@/services/module.service";
import { clearApiCache } from "@/lib/api-client";
import type { Asset } from "@/lib/module-types";

/** 资产类型中文标签映射 */
const typeLabels: Record<string, string> = {
  image: "图片",
  video: "视频",
  audio: "音频",
  document: "文档",
};

/** 资产表单字段配置 */
const assetFields: FormFieldConfig[] = [
  { name: "name", label: "资产名称", type: "text", required: true, placeholder: "请输入资产名称" },
  {
    name: "type",
    label: "资产类型",
    type: "select",
    required: true,
    options: [
      { value: "image", label: "图片" },
      { value: "video", label: "视频" },
      { value: "audio", label: "音频" },
      { value: "document", label: "文档" },
    ],
    defaultValue: "image",
  },
  { name: "file_url", label: "文件地址", type: "text", placeholder: "请输入文件URL" },
  { name: "size", label: "大小(字节)", type: "number", placeholder: "0", min: 0 },
  { name: "format", label: "格式", type: "text", placeholder: "如：png, mp4, mp3, pdf" },
];

export function AssetsCenterPage() {
  const { selectedProjectId } = useProjectStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // 对话框状态
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // 删除确认状态
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

  // 根据 selectedProjectId 加载资产数据
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!selectedProjectId) { setAssets([]); return; }
    setIsLoading(true);
    listAssets(selectedProjectId)
      .then(data => setAssets(data))
      .catch(err => console.error("Failed to load assets:", err))
      .finally(() => setIsLoading(false));
  }, [selectedProjectId]);

  const typeOptions = [
    { value: "", label: "全部类型" },
    { value: "image", label: "图片" },
    { value: "video", label: "视频" },
    { value: "audio", label: "音频" },
    { value: "document", label: "文档" },
  ];

  // 筛选资产列表
  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      const matchesSearch = asset.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = !typeFilter || asset.type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [assets, searchQuery, typeFilter]);

  const paginatedAssets = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAssets.slice(start, start + pageSize);
  }, [filteredAssets, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredAssets.length / pageSize);

  // 打开新建对话框
  const handleCreate = () => {
    setEditingAsset(null);
    setIsFormOpen(true);
  };

  // 打开编辑对话框
  const handleEdit = (asset: Asset) => {
    setEditingAsset(asset);
    setIsFormOpen(true);
  };

  // 保存资产（新建或编辑）
  const handleSave = async (values: Record<string, string | number | string[]>) => {
    setIsSaving(true);
    try {
      const payload = { ...values, project_id: selectedProjectId } as any;
      if (editingAsset) {
        await updateAsset(editingAsset.id, payload);
      } else {
        await createAsset(payload);
      }
      setIsFormOpen(false);
      setEditingAsset(null);
      // Refresh the list
      clearApiCache();
      const data = await listAssets(selectedProjectId);
      setAssets(data);
    } finally {
      setIsSaving(false);
    }
  };

  // 确认删除
  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    await deleteAssetApi(deleteConfirm.id);
    setDeleteConfirm(null);
    clearApiCache();
    const data = await listAssets(selectedProjectId);
    setAssets(data);
  };

  return (
    <PageContainer title="资产中心" description="管理项目的所有资产资源">
      {/* 工具栏 */}
      <ModuleToolbar
        left={
          <>
            <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="搜索资产..." />
            <FilterSelect value={typeFilter} onChange={setTypeFilter} options={typeOptions} placeholder="类型筛选" />
          </>
        }
        right={
          <>
            <Button size="sm" onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              上传资产
            </Button>
          </>
        }
      />

      {/* 资产列表 */}
      <PageCard title="资产列表">
        {filteredAssets.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="px-4 py-3 text-left text-sm font-medium text-[#888]">资产名称</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-[#888]">类型</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-[#888] hidden md:table-cell">文件大小</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-[#888] hidden sm:table-cell">格式</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-[#888] hidden md:table-cell">更新时间</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-[#888]">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedAssets.map((asset) => (
                    <AssetRow
                      key={asset.id}
                      asset={asset}
                      onEdit={() => handleEdit(asset)}
                      onDelete={() => setDeleteConfirm({ id: asset.id, name: asset.name })}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="mt-4">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={filteredAssets.length}
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
            title="未找到资产"
            description={searchQuery || typeFilter ? "尝试调整搜索条件" : "点击上方按钮上传新资产"}
            action={{ label: "上传资产", onClick: handleCreate }}
          />
        )}
      </PageCard>

      {/* 新建/编辑对话框 */}
      <FormDialog
        title={editingAsset ? "编辑资产" : "新建资产"}
        fields={assetFields}
        initialValues={editingAsset ? {
          name: editingAsset.name,
          type: editingAsset.type,
          file_url: editingAsset.file_url || "",
          size: editingAsset.size ?? 0,
          format: editingAsset.format || "",
        } as Record<string, string | number> : {}}
        isOpen={isFormOpen}
        onClose={() => { setIsFormOpen(false); setEditingAsset(null); }}
        onSave={handleSave}
        isLoading={isSaving}
      />

      {/* 删除确认对话框 */}
      {deleteConfirm && (
        <ConfirmDialog
          title="删除资产"
          description={`确定要删除资产「${deleteConfirm.name}」吗？此操作无法撤销。`}
          confirmLabel="删除"
          onClose={() => setDeleteConfirm(null)}
          onConfirm={handleDeleteConfirm}
        />
      )}
    </PageContainer>
  );
}

/** 资产表格行组件 */
function AssetRow({
  asset,
  onEdit,
  onDelete,
}: {
  asset: Asset;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const typeColors: Record<string, string> = {
    image: "bg-emerald-500/20 text-emerald-400",
    video: "bg-blue-500/20 text-blue-400",
    audio: "bg-purple-500/20 text-purple-400",
    document: "bg-orange-500/20 text-orange-400",
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return "-";
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  return (
    <tr className="border-b border-white/5 hover:bg-white/5 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-white/5">
            <Download className="h-4 w-4 text-emerald-400" />
          </div>
          <div>
            <div className="font-medium text-white">{asset.name}</div>
            {asset.file_url && (
              <div className="text-xs text-[#666] line-clamp-1">{asset.file_url}</div>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={`px-2 py-0.5 rounded text-xs ${typeColors[asset.type] ?? "bg-gray-500/20 text-gray-400"}`}>
          {typeLabels[asset.type] ?? asset.type}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-[#888] hidden md:table-cell">{formatSize(asset.size)}</td>
      <td className="px-4 py-3 text-sm text-[#888] hidden sm:table-cell">
        {asset.format || "-"}
      </td>
      <td className="px-4 py-3 text-sm text-[#888] hidden md:table-cell">
        {new Date(asset.updated_at).toLocaleDateString()}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={onEdit} title="编辑">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete} title="删除">
            <Trash2 className="h-4 w-4 text-red-400" />
          </Button>
        </div>
      </td>
    </tr>
  );
}