"use client";

/**
 * 资产中心模块 - 工厂资产手工同步管理
 *
 * 功能：
 * - 资产分类浏览（角色/场景/分镜/风格/提示词）
 * - 网格视图展示（适合图片类资产）
 * - 搜索筛选（类型、标签、收藏状态）
 * - 资产收藏、删除、批量操作
 * - 工厂资产手工同步导入
 */

import { useState, useMemo, useEffect } from "react";
import {
  Database,
  Star,
  Search,
  Filter,
  Users,
  Image,
  Film,
  Palette,
  Sparkles,
  Trash2,
  Download,
  MoreHorizontal,
  Loader2,
  Heart,
  BookmarkPlus,
  Plus,
} from "lucide-react";
import { PageContainer, PageCard } from "@/components/layout/page-container";
import { ModuleToolbar, SearchInput, FilterSelect, EmptyState, Pagination } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { useProjectStore } from "@/lib/stores/project-store";
import { listAssets, createAsset, updateAsset, deleteAsset, toggleAssetFavorite } from "@/services/asset.service";
import { clearApiCache } from "@/lib/api-client";
import { toast } from "@/components/common/toast";
import type { ProjectAsset, ProjectAssetKind } from "@/lib/app-types";

/** 资产类型配置 */
const ASSET_KINDS: Array<{ id: ProjectAssetKind; name: string; icon: React.ComponentType<{ className?: string }>; color: string }> = [
  { id: "character", name: "角色资产", icon: Users, color: "purple" },
  { id: "scene", name: "场景资产", icon: Image, color: "orange" },
  { id: "storyboard", name: "分镜资产", icon: Film, color: "blue" },
  { id: "style", name: "风格资产", icon: Palette, color: "pink" },
  { id: "prompt", name: "提示词模板", icon: Sparkles, color: "yellow" },
];

/** 资产类型颜色映射 */
const KIND_COLORS: Record<ProjectAssetKind, string> = {
  character: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  scene: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  storyboard: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  style: "bg-pink-500/20 text-pink-400 border-pink-500/30",
  prompt: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  image: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  video: "bg-red-500/20 text-red-400 border-red-500/30",
  project: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

export function AssetsCenterPage() {
  const { selectedProjectId } = useProjectStore();
  const [assets, setAssets] = useState<ProjectAsset[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // 筛选状态
  const [selectedKind, setSelectedKind] = useState<ProjectAssetKind | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFavoriteOnly, setShowFavoriteOnly] = useState(false);

  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // 选中状态
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());

  // 删除确认
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

  // 加载资产数据
  useEffect(() => {
    if (!selectedProjectId) {
      setAssets([]);
      return;
    }
    setIsLoading(true);
    const query = new URLSearchParams();
    if (selectedKind !== "all") query.set("kind", selectedKind);
    if (searchQuery) query.set("q", searchQuery);
    if (showFavoriteOnly) query.set("favorite", "true");

    listAssets(selectedProjectId, query.toString())
      .then((data) => setAssets(data))
      .catch((err) => {
        console.error("加载资产失败:", err);
        toast({ title: "加载资产失败", variant: "error" });
      })
      .finally(() => setIsLoading(false));
  }, [selectedProjectId, selectedKind, searchQuery, showFavoriteOnly]);

  // 统计各类型资产数量
  const kindCounts = useMemo(() => {
    const counts: Record<string, number> = { all: assets.length };
    for (const kind of ASSET_KINDS) {
      counts[kind.id] = assets.filter((a) => a.kind === kind.id).length;
    }
    counts.favorite = assets.filter((a) => a.is_favorite).length;
    return counts;
  }, [assets]);

  // 网格分页
  const paginatedAssets = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return assets.slice(start, start + pageSize);
  }, [assets, currentPage, pageSize]);

  const totalPages = Math.ceil(assets.length / pageSize);

  // 切换资产收藏
  const handleToggleFavorite = async (assetId: string) => {
    try {
      await toggleAssetFavorite(selectedProjectId, assetId);
      clearApiCache();
      const query = new URLSearchParams();
      if (selectedKind !== "all") query.set("kind", selectedKind);
      if (searchQuery) query.set("q", searchQuery);
      if (showFavoriteOnly) query.set("favorite", "true");
      const data = await listAssets(selectedProjectId, query.toString());
      setAssets(data);
      toast({ title: "收藏状态已更新", variant: "success" });
    } catch (err) {
      toast({ title: "操作失败", variant: "error" });
    }
  };

  // 删除资产
  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    try {
      await deleteAsset(selectedProjectId, deleteConfirm.id);
      clearApiCache();
      const query = new URLSearchParams();
      if (selectedKind !== "all") query.set("kind", selectedKind);
      if (searchQuery) query.set("q", searchQuery);
      if (showFavoriteOnly) query.set("favorite", "true");
      const data = await listAssets(selectedProjectId, query.toString());
      setAssets(data);
      setDeleteConfirm(null);
      toast({ title: "资产已删除", variant: "success" });
    } catch (err) {
      toast({ title: "删除失败", variant: "error" });
    }
  };

  // 批量删除
  const handleBatchDelete = async () => {
    if (selectedAssets.size === 0) return;
    try {
      for (const assetId of selectedAssets) {
        await deleteAsset(selectedProjectId, assetId);
      }
      clearApiCache();
      const query = new URLSearchParams();
      if (selectedKind !== "all") query.set("kind", selectedKind);
      if (searchQuery) query.set("q", searchQuery);
      if (showFavoriteOnly) query.set("favorite", "true");
      const data = await listAssets(selectedProjectId, query.toString());
      setAssets(data);
      setSelectedAssets(new Set());
      toast({ title: `已删除 ${selectedAssets.size} 个资产`, variant: "success" });
    } catch (err) {
      toast({ title: "批量删除失败", variant: "error" });
    }
  };

  // 切换选中
  const handleToggleSelect = (assetId: string) => {
    const next = new Set(selectedAssets);
    if (next.has(assetId)) {
      next.delete(assetId);
    } else {
      next.add(assetId);
    }
    setSelectedAssets(next);
  };

  // 全选/取消全选
  const handleSelectAll = () => {
    if (selectedAssets.size === paginatedAssets.length) {
      setSelectedAssets(new Set());
    } else {
      setSelectedAssets(new Set(paginatedAssets.map((a) => a.id)));
    }
  };

  return (
    <PageContainer title="资产中心" description="管理项目的工厂资产（角色/场景/分镜/风格/提示词）">
      {/* 左侧分类树 + 右侧浏览区布局 */}
      <div className="flex gap-4 h-[calc(100vh-180px)]">
        {/* 左侧分类树 */}
        <div className="w-64 bg-[#1a1a1a] rounded-lg border border-white/10 overflow-y-auto">
          <div className="p-3 border-b border-white/10">
            <div className="text-sm font-semibold text-white">资产分类</div>
          </div>

          <div className="p-2 space-y-1">
            {/* 全部 */}
            <button
              onClick={() => setSelectedKind("all")}
              className={`flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm transition-colors ${
                selectedKind === "all"
                  ? "bg-emerald-500/10 text-emerald-400 border-l-2 border-emerald-500"
                  : "text-[#ccc] hover:bg-white/5"
              }`}
            >
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                <span>全部资产</span>
              </div>
              <span className="text-xs bg-white/10 px-1.5 py-0.5 rounded">{kindCounts.all}</span>
            </button>

            {/* 收藏 */}
            <button
              onClick={() => setShowFavoriteOnly(!showFavoriteOnly)}
              className={`flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm transition-colors ${
                showFavoriteOnly
                  ? "bg-yellow-500/10 text-yellow-400 border-l-2 border-yellow-500"
                  : "text-[#ccc] hover:bg-white/5"
              }`}
            >
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4" />
                <span>我的收藏</span>
              </div>
              <span className="text-xs bg-white/10 px-1.5 py-0.5 rounded">{kindCounts.favorite}</span>
            </button>

            {/* 分隔线 */}
            <div className="border-t border-white/10 my-2" />

            {/* 各类型资产 */}
            {ASSET_KINDS.map((kind) => {
              const Icon = kind.icon;
              return (
                <button
                  key={kind.id}
                  onClick={() => {
                    setSelectedKind(kind.id);
                    setShowFavoriteOnly(false);
                  }}
                  className={`flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm transition-colors ${
                    selectedKind === kind.id
                      ? "bg-emerald-500/10 text-emerald-400 border-l-2 border-emerald-500"
                      : "text-[#ccc] hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    <span>{kind.name}</span>
                  </div>
                  <span className="text-xs bg-white/10 px-1.5 py-0.5 rounded">{kindCounts[kind.id] || 0}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 右侧浏览区 */}
        <div className="flex-1 flex flex-col gap-4">
          {/* 工具栏 */}
          <ModuleToolbar
            left={
              <>
                <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="搜索资产名称、标签..." />
                <FilterSelect
                  value={selectedKind}
                  onChange={(v) => setSelectedKind(v as ProjectAssetKind | "all")}
                  options={[
                    { value: "all", label: "全部类型" },
                    ...ASSET_KINDS.map((k) => ({ value: k.id, label: k.name })),
                  ]}
                  placeholder="类型筛选"
                />
              </>
            }
            right={
              <>
                {selectedAssets.size > 0 && (
                  <div className="flex items-center gap-2 mr-2">
                    <span className="text-sm text-emerald-400">{selectedAssets.size} 已选中</span>
                    <Button size="sm" variant="ghost" onClick={handleBatchDelete}>
                      <Trash2 className="h-4 w-4 mr-1" />
                      批量删除
                    </Button>
                  </div>
                )}
                <Button size="sm" onClick={handleSelectAll}>
                  {selectedAssets.size === paginatedAssets.length ? "取消全选" : "全选"}
                </Button>
              </>
            }
          />

          {/* 资产网格 */}
          <PageCard className="flex-1 overflow-hidden">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
              </div>
            ) : assets.length > 0 ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 p-4 overflow-y-auto h-full">
                  {paginatedAssets.map((asset) => (
                    <AssetCard
                      key={asset.id}
                      asset={asset}
                      isSelected={selectedAssets.has(asset.id)}
                      onToggleSelect={() => handleToggleSelect(asset.id)}
                      onToggleFavorite={() => handleToggleFavorite(asset.id)}
                      onDelete={() => setDeleteConfirm({ id: asset.id, name: asset.name })}
                    />
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="border-t border-white/10 px-4 py-3">
                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      totalItems={assets.length}
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
                title="暂无资产"
                description={
                  searchQuery || selectedKind !== "all"
                    ? "尝试调整筛选条件"
                    : "从角色工厂、场景工厂或分镜导演台同步资产"
                }
              />
            )}
          </PageCard>
        </div>
      </div>

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

/** 资产卡片组件 */
function AssetCard({
  asset,
  isSelected,
  onToggleSelect,
  onToggleFavorite,
  onDelete,
}: {
  asset: ProjectAsset;
  isSelected: boolean;
  onToggleSelect: () => void;
  onToggleFavorite: () => void;
  onDelete: () => void;
}) {
  const [showMenu, setShowMenu] = useState(false);

  const colorClass = KIND_COLORS[asset.kind] || KIND_COLORS.image;

  return (
    <div
      className={`relative aspect-square rounded-lg overflow-hidden border ${
        isSelected ? "border-emerald-500 shadow-lg shadow-emerald-500/20" : "border-white/10"
      } bg-[#1a1a1a] hover:border-white/30 transition-all group cursor-pointer`}
      onClick={onToggleSelect}
    >
      {/* 图片预览 */}
      {asset.image_url ? (
        <img src={asset.image_url} alt={asset.name} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-white/5 to-white/10">
          <Database className="h-12 w-12 text-white/30" />
        </div>
      )}

      {/* 类型徽章 */}
      <div className={`absolute top-2 left-2 px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}>
        {ASSET_KINDS.find((k) => k.id === asset.kind)?.name || asset.kind}
      </div>

      {/* 收藏星星 */}
      {asset.is_favorite && (
        <Star className="absolute top-2 right-2 h-4 w-4 text-yellow-400 fill-yellow-400" />
      )}

      {/* 选中标记 */}
      {isSelected && (
        <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
          <BookmarkPlus className="h-4 w-4 text-white" />
        </div>
      )}

      {/* 底部信息 */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="text-sm text-white truncate font-medium">{asset.name}</div>
        {asset.tags && asset.tags.length > 0 && (
          <div className="flex items-center gap-1 mt-1 flex-wrap">
            {asset.tags.slice(0, 3).map((tag, idx) => (
              <span key={idx} className="text-xs bg-white/20 px-1.5 py-0.5 rounded truncate max-w-[80px]">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 快捷操作按钮（悬停显示） */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
          className="w-8 h-8 rounded-full bg-white/90 hover:bg-white flex items-center justify-center transition-colors"
          title={asset.is_favorite ? "取消收藏" : "添加收藏"}
        >
          <Heart className={`h-4 w-4 ${asset.is_favorite ? "text-red-500 fill-red-500" : "text-gray-600"}`} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="w-8 h-8 rounded-full bg-red-500/90 hover:bg-red-500 flex items-center justify-center transition-colors"
          title="删除"
        >
          <Trash2 className="h-4 w-4 text-white" />
        </button>
      </div>
    </div>
  );
}