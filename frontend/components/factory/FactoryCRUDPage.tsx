/**
 * 通用工厂 CRUD 页面
 *
 * 适用对象：角色 / 场景 / 道具工厂。
 * 把三个工厂 90% 同构的 UI / 状态管理抽到这一个组件里，
 * 各工厂只需要传入字段配置、数据 API 和卡片渲染函数即可。
 *
 * 不变量：
 * - 不动 entityType 业务逻辑。
 * - 不依赖具体后端服务名（通过 fetchList / createItem / updateItem / deleteItem 注入）。
 * - 与现有 FormDialog / ConfirmDialog / AIGenerateImageDialog 协同工作。
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Sparkles, Pencil, Trash2, CheckSquare, Square, X, LayoutTemplate, History, Copy, Inbox, RotateCcw, Archive, ChevronRight } from "lucide-react";
import { PageContainer, PageCard } from "@/components/layout/page-container";
import {
  StatCard,
  StatCardGrid,
  ModuleToolbar,
  SearchInput,
  FilterSelect,
  EmptyState,
  Pagination,
  AIGenerateImageDialog,
  VersionHistoryDialog,
  CopyToProjectDialog,
} from "@/components/shared";
import { TemplateSelector, type AssetTemplate, type TemplateEntityType } from "@/components/shared/template-selector";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/ui/form-dialog";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { toast } from "@/components/common/toast";
import { clearApiCache } from "@/lib/api-client";
import { useFactoryEntity } from "./useFactoryEntity";
import type { FactoryCRUDPageProps, FactoryEntity, FactoryEntityType, FilterOption } from "./types";

const DEFAULT_GRID_CLASS = "grid-cols-1 md:grid-cols-2 lg:grid-cols-3";

/** 工具栏内"批量改类型"下拉菜单（被 FactoryCRUDPage 内部使用）。 */
function BatchChangeTypeMenu({
  options,
  onSelect,
  label,
}: {
  options: FilterOption[];
  onSelect: (value: string) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <Button variant="secondary" size="sm" onClick={() => setOpen((v) => !v)} className="text-xs">
        {label}
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-30 mt-1 min-w-[140px] max-h-72 overflow-y-auto rounded-md border border-white/10 bg-[#202020] py-1 shadow-lg">
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setOpen(false);
                  onSelect(opt.value);
                }}
                className="w-full px-3 py-1.5 text-left text-xs text-white hover:bg-white/10"
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** 工具栏内的批量操作条。 */
function FactoryBatchActionsBar({
  count,
  selectAllLabel,
  onSelectAll,
  onClear,
  onDelete,
  batchTypeConfig,
  onChangeType,
}: {
  count: number;
  selectAllLabel: string;
  onSelectAll: () => void;
  onClear: () => void;
  onDelete: () => void;
  batchTypeConfig?: {
    buttonLabel: string;
    options: FilterOption[];
    onSelect: (value: string) => void;
  };
  onChangeType?: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-1.5">
      <span className="text-xs font-medium text-emerald-300">已选 {count} 项</span>
      <span className="h-4 w-px bg-white/10" />
      <Button variant="ghost" size="sm" onClick={onSelectAll} className="text-xs">
        <CheckSquare className="mr-1 h-3 w-3" />
        {selectAllLabel}
      </Button>
      <Button variant="ghost" size="sm" onClick={onClear} className="text-xs">
        <X className="mr-1 h-3 w-3" />
        取消选择
      </Button>
      {batchTypeConfig && onChangeType && (
        <>
          <span className="h-4 w-px bg-white/10" />
          <BatchChangeTypeMenu
            options={batchTypeConfig.options}
            onSelect={onChangeType}
            label={batchTypeConfig.buttonLabel}
          />
        </>
      )}
      <Button variant="destructive" size="sm" onClick={onDelete} className="text-xs">
        <Trash2 className="mr-1 h-3 w-3" />
        批量删除
      </Button>
    </div>
  );
}

/** 顶部全选/部分选中提示行。 */
function SelectAllRow({
  isAllSelected,
  isPartial,
  allCount,
  onToggle,
  totalSelectedLabel,
  showSelectAll = true,
  selectAllLabel = "全选当前筛选结果",
  selectedLabel = "已全选当前筛选结果",
  partialLabel = "已选部分",
}: {
  isAllSelected: boolean;
  isPartial: boolean;
  allCount: number;
  onToggle: () => void;
  totalSelectedLabel?: React.ReactNode;
  showSelectAll?: boolean;
  selectAllLabel?: string;
  selectedLabel?: string;
  partialLabel?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 pb-3 mb-3 border-b border-white/10">
      {showSelectAll && (
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-2 text-xs text-[#888] hover:text-white transition-colors"
          aria-label={isAllSelected ? "取消全选" : selectAllLabel}
        >
          {isAllSelected ? (
            <CheckSquare className="h-4 w-4 text-emerald-400" />
          ) : isPartial ? (
            <Square className="h-4 w-4 text-emerald-400 opacity-50" />
          ) : (
            <Square className="h-4 w-4" />
          )}
          {isAllSelected ? selectedLabel : isPartial ? partialLabel : selectAllLabel}
        </button>
      )}
      {totalSelectedLabel}
    </div>
  );
}

/** 回收站中每个条目的极简行（头像 + 名称 + 元信息 + 恢复 / 永久删除）。 */
function RecycleBinRow<TEntity extends FactoryEntity>({
  item,
  entityLabel,
  metaLabel = "删除时间",
  selected,
  onToggleSelect,
  onRestore,
  onPermanentDelete,
}: {
  item: TEntity;
  entityLabel: string;
  metaLabel?: string;
  selected: boolean;
  onToggleSelect: () => void;
  onRestore: () => void;
  onPermanentDelete: () => void;
}) {
  const image = (item as { image?: string }).image;
  const deletedAt = item.deleted_at;
  return (
    <div
      className={`group flex items-center gap-3 rounded-lg border bg-[#1f1f1f] px-4 py-3 transition-colors ${
        selected
          ? "border-emerald-500 ring-1 ring-emerald-500/40"
          : "border-white/10 hover:border-white/20"
      }`}
    >
      <button
        type="button"
        onClick={onToggleSelect}
        className={`grid h-5 w-5 shrink-0 place-items-center rounded border transition-opacity ${
          selected
            ? "border-emerald-500 bg-emerald-500"
            : "border-white/40 bg-black/30 hover:border-emerald-400"
        }`}
        aria-label={selected ? "取消选择" : "选择"}
      >
        {selected && <CheckSquare className="h-3 w-3 text-white" />}
      </button>
      <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-md bg-[#2a2a2a]">
        {image ? (
          <img src={image} alt={item.name} className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        ) : (
          <span className="text-xs text-[#888]">{item.name?.slice(0, 2) || entityLabel.slice(0, 2)}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-sm text-white truncate">
          {item.name}
        </div>
        <div className="text-xs text-[#666] truncate">
          {metaLabel}: {deletedAt ? new Date(deletedAt).toLocaleString() : "—"}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button variant="secondary" size="sm" onClick={onRestore} className="text-xs">
          <RotateCcw className="mr-1 h-3 w-3" />
          恢复
        </Button>
        <Button variant="destructive" size="sm" onClick={onPermanentDelete} className="text-xs">
          <Trash2 className="mr-1 h-3 w-3" />
          永久删除
        </Button>
      </div>
    </div>
  );
}

export function FactoryCRUDPage<TEntity extends FactoryEntity>(props: FactoryCRUDPageProps<TEntity>) {
  const {
    title,
    description,
    entityLabel,
    listTitle,
    emptyTitle,
    searchPlaceholder,
    fetchList,
    createItem,
    updateItem,
    deleteItem,
    restoreItem,
    batch,
    fetchDeleted,
    permanentDelete,
    recycleBinMetaLabel,
    fields,
    toFormValues,
    transformFormValues,
    renderCard,
    gridClassName = DEFAULT_GRID_CLASS,
    searchFields,
    filterOptions,
    filterField,
    filterPlaceholder = "筛选",
    filterValue: filterValueProp,
    onFilterChange,
    stats,
    aiConfig,
    fetchUsage,
    usageImpact = "删除可能影响剧本/分镜/对白中的引用。",
    batchTypeConfig,
    copyToProjects,
    pageSize: defaultPageSize = 12,
    selectAllLabel = "全选",
    loadingView,
    extraToolbarContent,
    enableTemplates,
    templateFetcher,
    onApplyTemplate,
    fetchVersions,
  } = props;

  // ===== 数据加载 =====
  const { selectedProjectId, items, isLoading, reload, selectedIds, setSelectedIds } = useFactoryEntity(fetchList);

  // ===== 视图模式：normal / recycleBin =====
  const [activeView, setActiveView] = useState<"normal" | "recycleBin">("normal");
  const recycleBinEnabled = Boolean(fetchDeleted && permanentDelete && restoreItem);

  // 回收站数据
  const [deletedItems, setDeletedItems] = useState<TEntity[]>([]);
  const [isRecycleBinLoading, setIsRecycleBinLoading] = useState(false);
  const reloadRecycleBin = useCallback(async () => {
    if (!selectedProjectId || !fetchDeleted) {
      setDeletedItems([]);
      return;
    }
    const data = await fetchDeleted(selectedProjectId);
    setDeletedItems(data);
  }, [selectedProjectId, fetchDeleted]);

  useEffect(() => {
    if (activeView !== "recycleBin" || !recycleBinEnabled) return;
    setIsRecycleBinLoading(true);
    reloadRecycleBin()
      .catch((err) => console.error("FactoryCRUDPage: failed to load recycle bin", err))
      .finally(() => setIsRecycleBinLoading(false));
  }, [activeView, recycleBinEnabled, reloadRecycleBin]);

  // 切回正常视图时清空回收站选择
  const switchToNormal = useCallback(() => {
    setActiveView("normal");
    setSelectedIds(new Set());
  }, [setSelectedIds]);
  const switchToRecycleBin = useCallback(() => {
    setActiveView("recycleBin");
    setSelectedIds(new Set());
  }, [setSelectedIds]);

  // ===== 搜索 / 过滤 =====
  const [searchQuery, setSearchQuery] = useState("");
  const [internalFilterValue, setInternalFilterValue] = useState("");
  const filterValue = filterValueProp ?? internalFilterValue;
  const setFilterValue = (v: string) => {
    if (onFilterChange) onFilterChange(v);
    else setInternalFilterValue(v);
  };

  // ===== 表单弹窗 =====
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<TEntity | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // ===== AI 生成弹窗 =====
  const [isAIDialogOpen, setIsAIDialogOpen] = useState(false);
  const [isAIGenerating, setIsAIGenerating] = useState(false);

  // ===== 删除确认 =====
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string; usageCount: number } | null>(null);

  // ===== 批量删除 / 改类型确认 =====
  const [batchDeleteConfirm, setBatchDeleteConfirm] = useState<number | null>(null);
  const [batchTypeConfirm, setBatchTypeConfirm] = useState<{ ids: string[]; value: string } | null>(null);

  // ===== 跨项目复制 =====
  const [copyDialogItem, setCopyDialogItem] = useState<TEntity | null>(null);

  // ===== 模板/预设（任务15：三厂共性 - 资产模板） =====
  const [isTemplateOpen, setIsTemplateOpen] = useState(false);
  // 模板填表用：保存一份"通过模板创建的初始值"，对话框打开时优先使用
  const [templateInitialValues, setTemplateInitialValues] = useState<Record<string, string | number | string[]> | null>(null);

  // ===== 回收站（任务13：软删除 + 回收站） =====
  /** 单个永久删除的二次确认。 */
  const [permanentDeleteConfirm, setPermanentDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  /** 批量永久删除确认。 */
  const [batchPermanentDeleteConfirm, setBatchPermanentDeleteConfirm] = useState<number | null>(null);

  // ===== 版本历史（任务12：统一版本管理） =====
  const [versionHistory, setVersionHistory] = useState<{ id: string; name: string } | null>(null);

  // ===== 分页（可选） =====
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const usePagination = props.pageSize !== undefined;

  // ===== 过滤 / 搜索 =====
  const filteredItems = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return items.filter((it) => {
      if (q && !searchFields(it, q)) return false;
      if (filterField && filterValue && !filterField(it, filterValue)) return false;
      return true;
    });
  }, [items, searchQuery, searchFields, filterField, filterValue]);

  // 分页后的列表
  const totalPages = usePagination ? Math.ceil(filteredItems.length / pageSize) : 1;
  const pagedItems = useMemo(() => {
    if (!usePagination) return filteredItems;
    return filteredItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  }, [filteredItems, usePagination, currentPage, pageSize]);

  // 过滤/分页变化时清理掉不在当前过滤集合里的选中项
  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;
      const valid = filteredItems.some((it) => prev.has(it.id));
      return valid ? prev : new Set();
    });
  }, [filteredItems, setSelectedIds]);

  // 切换单个
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, [setSelectedIds]);
  const clearSelection = useCallback(() => setSelectedIds(new Set()), [setSelectedIds]);

  // 顶部"全选当前页/筛选结果"
  const visibleIds = useMemo(() => pagedItems.map((it) => it.id), [pagedItems]);
  const isAllVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const isPartialVisible = visibleIds.some((id) => selectedIds.has(id)) && !isAllVisibleSelected;
  const toggleSelectVisible = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (isAllVisibleSelected) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        visibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }, [isAllVisibleSelected, visibleIds, setSelectedIds]);
  const selectAllFiltered = useCallback(() => {
    setSelectedIds(new Set(filteredItems.map((it) => it.id)));
  }, [filteredItems, setSelectedIds]);

  // ===== 统计 =====
  const statConfigs = useMemo(() => stats(items), [items, stats]);

  // ===== 新建 / 编辑 =====
  const openCreate = useCallback(() => {
    setEditing(null);
    setTemplateInitialValues(null);
    setIsFormOpen(true);
  }, []);
  const openEdit = useCallback((item: TEntity) => {
    setEditing(item);
    setTemplateInitialValues(null);
    setIsFormOpen(true);
  }, []);

  // ===== 模板应用 =====
  const handleApplyTemplate = useCallback(
    (template: AssetTemplate) => {
      if (!onApplyTemplate) {
        toast.error("未配置模板应用", "请在工厂配置 onApplyTemplate");
        return;
      }
      try {
        const initial = onApplyTemplate(template);
        setEditing(null);
        setTemplateInitialValues(initial);
        setIsFormOpen(true);
        toast.success("已应用模板", `已根据「${template.name}」填充表单，仍可继续修改`);
      } catch (err) {
        console.error("apply template failed", err);
        toast.error("应用模板失败", (err as Error).message ?? "请稍后重试");
      }
    },
    [onApplyTemplate],
  );

  const handleSave = useCallback(
    async (values: Record<string, string | number | string[]>) => {
      setIsSaving(true);
      try {
        const baseValues = transformFormValues
          ? transformFormValues(values, selectedProjectId)
          : { ...values, project_id: selectedProjectId };
        if (editing) {
          await updateItem(editing.id, baseValues);
        } else {
          await createItem(baseValues);
        }
        setIsFormOpen(false);
        setEditing(null);
        clearApiCache();
        await reload();
      } finally {
        setIsSaving(false);
      }
    },
    [editing, selectedProjectId, transformFormValues, createItem, updateItem, reload],
  );

  // ===== 删除（带引用警告） =====
  const requestDelete = useCallback(
    async (item: TEntity) => {
      let usageCount = item.usage_count ?? 0;
      if (fetchUsage) {
        try {
          const u = await fetchUsage(item.id);
          usageCount = u.total ?? u.usage_count ?? usageCount;
        } catch {
          // ignore: 使用实体上的 usage_count
        }
      }
      setDeleteConfirm({ id: item.id, name: item.name, usageCount });
    },
    [fetchUsage],
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteConfirm) return;
    const target = deleteConfirm;
    setDeleteConfirm(null);
    await deleteItem(target.id);
    clearApiCache();
    await reload();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(target.id);
      return next;
    });
    if (restoreItem) {
      toast.action(
        `已删除「${target.name}」`,
        {
          label: "撤销",
          onClick: async () => {
            await restoreItem(target.id);
            await reload();
            toast.success("已恢复", `「${target.name}」已恢复到列表`);
          },
        },
        "5秒内可撤销",
        5000,
      );
    }
  }, [deleteConfirm, deleteItem, reload, setSelectedIds, restoreItem]);

  // ===== 批量删除 =====
  const handleBatchDelete = useCallback(async () => {
    if (!batchDeleteConfirm) return;
    const ids = Array.from(selectedIds);
    setBatchDeleteConfirm(null);
    if (batch) {
      await batch("delete", ids);
    } else {
      // 退化：逐个删除
      await Promise.all(ids.map((id) => deleteItem(id)));
    }
    clearApiCache();
    await reload();
    setSelectedIds(new Set());
    if (restoreItem) {
      toast.action(
        `已批量删除 ${ids.length} 个${entityLabel}`,
        {
          label: "撤销",
          onClick: async () => {
            for (const id of ids) {
              await restoreItem(id);
            }
            await reload();
            toast.success("已恢复", `${ids.length} 个${entityLabel}已恢复到列表`);
          },
        },
        "5秒内可撤销",
        5000,
      );
    }
  }, [batchDeleteConfirm, selectedIds, batch, deleteItem, reload, setSelectedIds, restoreItem, entityLabel]);

  // ===== 批量改类型 =====
  const handleBatchUpdate = useCallback(async () => {
    if (!batchTypeConfirm || !batchTypeConfig) return;
    const { ids, value } = batchTypeConfirm;
    setBatchTypeConfirm(null);
    if (batch) {
      await batch("update", ids, { [batchTypeConfig.patchKey]: value });
    } else {
      // 退化：没有 batch API 时不执行
      toast.error("暂不支持批量修改", "请逐个编辑");
      return;
    }
    clearApiCache();
    await reload();
    setSelectedIds(new Set());
    const label = batchTypeConfig.typeLabels[value] ?? value;
    toast.success("已更新", `${ids.length} 个${entityLabel}已更新为「${label}」`);
  }, [batchTypeConfirm, batchTypeConfig, batch, reload, setSelectedIds, entityLabel]);

  // ===== AI 生成 =====
  const handleAIGenerateConfirm = useCallback(
    async (payload: import("@/components/shared/ai-generate-dialog").AIConfirmPayload) => {
      if (!aiConfig) return;
      setIsAIGenerating(true);
      try {
        await aiConfig.onGenerate(payload);
        setIsAIDialogOpen(false);
        clearApiCache();
        await reload();
        toast.success("创建成功", `「${payload.name}」已创建，主图已设置`);
      } finally {
        setIsAIGenerating(false);
      }
    },
    [aiConfig, reload],
  );

  // ===== 跨项目复制 =====
  const handleCopyConfirm = useCallback(
    async (targetProjectIds: string[]) => {
      if (!copyToProjects || !copyDialogItem) {
        return { copied: 0, skipped: 0 };
      }
      const result = await copyToProjects(copyDialogItem.id, targetProjectIds);
      clearApiCache();
      // 用 toast.action 展示"已复制到 N 个项目"以及"查看项目"占位操作
      toast.action(
        `已复制「${copyDialogItem.name}」`,
        {
          label: "完成",
          onClick: () => {
            /* 提示用：toast 自身可关闭 */
          },
        },
        result.skipped > 0
          ? `已复制到 ${result.copied} 个项目，跳过 ${result.skipped} 个（同名资产）`
          : `已复制到 ${result.copied} 个项目`,
      );
      return result;
    },
    [copyToProjects, copyDialogItem],
  );

  // ===== 回收站：恢复 / 永久删除 =====
  const handleRestoreOne = useCallback(
    async (item: TEntity) => {
      if (!restoreItem) return;
      await restoreItem(item.id);
      // 从回收站列表移除
      setDeletedItems((prev) => prev.filter((it) => it.id !== item.id));
      // 同步刷新正常列表（让"已恢复"立即可见）
      clearApiCache();
      await reload();
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
      toast.success("已恢复", `「${item.name}」已恢复到${entityLabel}列表`);
    },
    [restoreItem, reload, setSelectedIds, entityLabel],
  );

  const handleBatchRestore = useCallback(
    async (ids: string[]) => {
      if (!restoreItem) return;
      for (const id of ids) {
        await restoreItem(id);
      }
      setDeletedItems((prev) => prev.filter((it) => !ids.includes(it.id)));
      setSelectedIds(new Set());
      clearApiCache();
      await reload();
      toast.success("已恢复", `${ids.length} 个${entityLabel}已恢复到列表`);
    },
    [restoreItem, reload, setSelectedIds, entityLabel],
  );

  const handlePermanentDeleteOne = useCallback(
    async (item: TEntity) => {
      if (!permanentDelete) return;
      const target = { id: item.id, name: item.name };
      setPermanentDeleteConfirm(null);
      await permanentDelete([target.id]);
      setDeletedItems((prev) => prev.filter((it) => it.id !== target.id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(target.id);
        return next;
      });
      toast.success("已永久删除", `「${target.name}」已从系统中移除`);
    },
    [permanentDelete, setSelectedIds],
  );

  const handleBatchPermanentDelete = useCallback(
    async (count: number) => {
      if (!permanentDelete) return;
      const ids = Array.from(selectedIds);
      setBatchPermanentDeleteConfirm(null);
      await permanentDelete(ids);
      setDeletedItems((prev) => prev.filter((it) => !ids.includes(it.id)));
      setSelectedIds(new Set());
      toast.success("已永久删除", `${ids.length} 个${entityLabel}已从系统中移除`);
    },
    [permanentDelete, selectedIds, setSelectedIds, entityLabel],
  );

  return (
    <PageContainer title={title} description={description}>
      {/* 顶部 Tab：正常资产 / 回收站（仅当配置了 fetchDeleted + permanentDelete + restoreItem 时启用） */}
      {recycleBinEnabled && (
        <div className="mb-4 inline-flex h-9 items-center rounded-md border border-white/10 bg-[#1a1a1a] p-0.5 text-xs">
          <button
            type="button"
            onClick={switchToNormal}
            className={`inline-flex items-center gap-1.5 rounded-sm px-3 py-1 transition-colors ${
              activeView === "normal"
                ? "bg-emerald-500/15 text-emerald-300"
                : "text-[#888] hover:text-white"
            }`}
          >
            <Archive className="h-3.5 w-3.5" />
            正常{entityLabel}
            <span className="text-[10px] text-[#666]">（{items.length}）</span>
          </button>
          <button
            type="button"
            onClick={switchToRecycleBin}
            className={`inline-flex items-center gap-1.5 rounded-sm px-3 py-1 transition-colors ${
              activeView === "recycleBin"
                ? "bg-emerald-500/15 text-emerald-300"
                : "text-[#888] hover:text-white"
            }`}
          >
            <Inbox className="h-3.5 w-3.5" />
            回收站
            <span className="text-[10px] text-[#666]">（{deletedItems.length}）</span>
          </button>
        </div>
      )}

      {/* ===== 正常视图 ===== */}
      {activeView === "normal" && (
        <>
          {/* 统计卡片 */}
          {statConfigs.length > 0 && (
            <PageCard className="mb-6">
              <StatCardGrid columns={4 as 2 | 3 | 4}>
                {statConfigs.map((cfg, idx) => (
                  <StatCard key={`${cfg.label}-${idx}`} label={cfg.label} value={cfg.value} icon={cfg.icon} color={cfg.color} />
                ))}
              </StatCardGrid>
            </PageCard>
          )}

      {/* 工具栏 */}
      <ModuleToolbar
        left={
          <>
            <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder={searchPlaceholder} />
            {filterOptions && (
              <FilterSelect
                value={filterValue}
                onChange={setFilterValue}
                options={filterOptions}
                placeholder={filterPlaceholder}
              />
            )}
          </>
        }
        right={
          <>
            {selectedIds.size > 0 ? (
              <FactoryBatchActionsBar
                count={selectedIds.size}
                selectAllLabel={usePagination ? selectAllLabel : "全选"}
                onSelectAll={usePagination ? selectAllFiltered : toggleSelectVisible}
                onClear={clearSelection}
                onDelete={() => setBatchDeleteConfirm(selectedIds.size)}
                onChangeType={
                  batchTypeConfig
                    ? (v) => setBatchTypeConfirm({ ids: Array.from(selectedIds), value: v })
                    : undefined
                }
                batchTypeConfig={
                  batchTypeConfig
                    ? {
                        buttonLabel: batchTypeConfig.buttonLabel,
                        options: batchTypeConfig.options,
                        onSelect: (v) => setBatchTypeConfirm({ ids: Array.from(selectedIds), value: v }),
                      }
                    : undefined
                }
              />
            ) : (
              <>
                {enableTemplates && templateFetcher && (
                  <Button variant="secondary" size="sm" onClick={() => setIsTemplateOpen(true)}>
                    <LayoutTemplate className="mr-2 h-4 w-4" />
                    使用模板
                  </Button>
                )}
                {aiConfig && (
                  <Button variant="secondary" size="sm" onClick={() => setIsAIDialogOpen(true)}>
                    <Sparkles className="mr-2 h-4 w-4" />
                    {aiConfig.buttonLabel ?? `AI生成${entityLabel}`}
                  </Button>
                )}
                {fetchVersions && items.length > 0 && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      // 弹出"历史"列表前，要求先选择一个资产（避免一次性展示所有资产）
                      if (items.length === 1) {
                        setVersionHistory({ id: items[0].id, name: items[0].name });
                        return;
                      }
                      // 多资产时通过"提示选择"占位：让用户从卡片里点 "历史" 按钮
                      toast.success("请选择一个资产", `点击任意${entityLabel}卡片上的「历史」按钮查看版本`);
                    }}
                    title="查看所有资产的最新版本概况"
                  >
                    <History className="mr-2 h-4 w-4" />
                    历史
                  </Button>
                )}
                <Button size="sm" onClick={openCreate}>
                  <Plus className="mr-2 h-4 w-4" />
                  新建{entityLabel}
                </Button>
              </>
            )}
          </>
        }
      />

      {/* 列表 */}
      <PageCard title={listTitle}>
        {isLoading && loadingView ? (
          loadingView
        ) : filteredItems.length > 0 ? (
          <>
            {/* 顶部全选 */}
            <SelectAllRow
              isAllSelected={isAllVisibleSelected}
              isPartial={isPartialVisible}
              allCount={visibleIds.length}
              onToggle={toggleSelectVisible}
              totalSelectedLabel={
                selectedIds.size > 0 ? (
                  <span className="text-xs text-emerald-400">已选 {selectedIds.size} 项</span>
                ) : undefined
              }
              selectedLabel={usePagination ? "已选当前页" : "已全选当前筛选结果"}
              partialLabel="已选部分"
              selectAllLabel={usePagination ? "全选当前页" : "全选当前筛选结果"}
            />
            {usePagination && totalPages > 1 && (
              <div className="mb-3 -mt-3">
                <button
                  type="button"
                  onClick={selectAllFiltered}
                  className="text-xs text-[#888] hover:text-emerald-300 transition-colors"
                  title={`将当前过滤结果的全部 ${filteredItems.length} 项加入选择`}
                >
                  {selectAllLabel}（{filteredItems.length}）
                </button>
              </div>
            )}
            <div className={`grid ${gridClassName} gap-4`}>
              {pagedItems.map((item) =>
                renderCard(item, {
                  selected: selectedIds.has(item.id),
                  onToggleSelect: () => toggleSelect(item.id),
                  onEdit: () => openEdit(item),
                  onDelete: () => requestDelete(item),
                  onViewHistory: fetchVersions ? () => setVersionHistory({ id: item.id, name: item.name }) : undefined,
                  onCopyToProjects: copyToProjects ? () => setCopyDialogItem(item) : undefined,
                }),
              )}
            </div>
            {usePagination && totalPages > 1 && (
              <div className="mt-4">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={filteredItems.length}
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
            title={emptyTitle}
            description={searchQuery || filterValue ? "尝试调整搜索条件" : `点击上方按钮创建新${entityLabel}`}
            action={{ label: `新建${entityLabel}`, onClick: openCreate }}
          />
        )}
        {extraToolbarContent}
      </PageCard>
        </>
      )}

      {/* ===== 回收站视图 ===== */}
      {activeView === "recycleBin" && recycleBinEnabled && (
        <>
          {/* 提示横幅 */}
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-200">
            <Inbox className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <div>
              回收站中的{entityLabel}可被恢复或永久删除。
              <span className="ml-1 text-amber-300/80">永久删除后将无法恢复，请谨慎操作。</span>
            </div>
          </div>

          {/* 工具栏：搜索 + 批量操作 + 返回 */}
          <ModuleToolbar
            left={
              <SearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder={`搜索已删除的${entityLabel}…`}
              />
            }
            right={
              selectedIds.size > 0 ? (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-1.5">
                  <span className="text-xs font-medium text-emerald-300">已选 {selectedIds.size} 项</span>
                  <span className="h-4 w-px bg-white/10" />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleBatchRestore(Array.from(selectedIds))}
                    className="text-xs"
                  >
                    <RotateCcw className="mr-1 h-3 w-3" />
                    批量恢复
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setBatchPermanentDeleteConfirm(selectedIds.size)}
                    className="text-xs"
                  >
                    <Trash2 className="mr-1 h-3 w-3" />
                    批量永久删除
                  </Button>
                  <Button variant="ghost" size="sm" onClick={clearSelection} className="text-xs">
                    <X className="mr-1 h-3 w-3" />
                    取消选择
                  </Button>
                </div>
              ) : (
                <Button variant="secondary" size="sm" onClick={switchToNormal}>
                  <ChevronRight className="mr-1 h-3 w-3 rotate-180" />
                  返回正常列表
                </Button>
              )
            }
          />

          {/* 回收站列表 */}
          <PageCard title={`回收站（${entityLabel}）`}>
            {isRecycleBinLoading ? (
              loadingView ?? <div className="flex items-center justify-center py-12 text-[#888]">加载中...</div>
            ) : deletedItems.length > 0 ? (
              (() => {
                // 简单搜索过滤
                const q = searchQuery.toLowerCase();
                const filtered = q
                  ? deletedItems.filter((it) => it.name.toLowerCase().includes(q))
                  : deletedItems;
                if (filtered.length === 0) {
                  return (
                    <EmptyState type="no-results" title="没有匹配项" description="尝试调整搜索条件" />
                  );
                }
                const visibleIdsInBin = filtered.map((it) => it.id);
                const allInBinSelected =
                  visibleIdsInBin.length > 0 && visibleIdsInBin.every((id) => selectedIds.has(id));
                const partialInBin =
                  visibleIdsInBin.some((id) => selectedIds.has(id)) && !allInBinSelected;
                return (
                  <>
                    <div className="flex flex-wrap items-center gap-3 pb-3 mb-3 border-b border-white/10">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedIds((prev) => {
                            const next = new Set(prev);
                            if (allInBinSelected) {
                              visibleIdsInBin.forEach((id) => next.delete(id));
                            } else {
                              visibleIdsInBin.forEach((id) => next.add(id));
                            }
                            return next;
                          });
                        }}
                        className="flex items-center gap-2 text-xs text-[#888] hover:text-white transition-colors"
                      >
                        {allInBinSelected ? (
                          <CheckSquare className="h-4 w-4 text-emerald-400" />
                        ) : partialInBin ? (
                          <Square className="h-4 w-4 text-emerald-400 opacity-50" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                        {allInBinSelected ? "已全选" : "全选"}
                      </button>
                      <span className="text-xs text-[#666]">
                        共 {deletedItems.length} 个已删除{entityLabel}
                      </span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {filtered.map((item) => (
                        <RecycleBinRow
                          key={item.id}
                          item={item}
                          entityLabel={entityLabel}
                          metaLabel={recycleBinMetaLabel ?? "删除时间"}
                          selected={selectedIds.has(item.id)}
                          onToggleSelect={() => toggleSelect(item.id)}
                          onRestore={() => handleRestoreOne(item)}
                          onPermanentDelete={() => setPermanentDeleteConfirm({ id: item.id, name: item.name })}
                        />
                      ))}
                    </div>
                  </>
                );
              })()
            ) : (
              <EmptyState
                type="no-results"
                title="回收站为空"
                description={`这里没有已删除的${entityLabel}。`}
                action={{ label: "返回正常列表", onClick: switchToNormal }}
              />
            )}
          </PageCard>
        </>
      )}

      {/* 新建 / 编辑对话框 */}
      <FormDialog
        title={editing ? `编辑${entityLabel}` : `新建${entityLabel}`}
        fields={fields}
        initialValues={
          editing
            ? (toFormValues(editing) as Record<string, string | number>)
            : (templateInitialValues ?? {})
        }
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditing(null);
          setTemplateInitialValues(null);
        }}
        onSave={handleSave}
        isLoading={isSaving}
      />

      {/* 单个删除确认 */}
      {deleteConfirm && (
        <ConfirmDialog
          title={`删除${entityLabel}`}
          description={
            deleteConfirm.usageCount > 0
              ? `确定要删除「${deleteConfirm.name}」吗？\n\n⚠️ 该资产被 ${deleteConfirm.usageCount} 处使用，${usageImpact}\n\n此操作可在 5 秒内撤销。`
              : `确定要删除「${deleteConfirm.name}」吗？\n\n此操作可在 5 秒内撤销。`
          }
          confirmLabel="删除"
          onClose={() => setDeleteConfirm(null)}
          onConfirm={handleDeleteConfirm}
        />
      )}

      {/* 批量删除确认 */}
      {batchDeleteConfirm !== null && (
        <ConfirmDialog
          title={`批量删除${entityLabel}`}
          description={`确定要删除选中的 ${batchDeleteConfirm} 个${entityLabel}吗？此操作可在 5 秒内撤销。`}
          confirmLabel="删除"
          onClose={() => setBatchDeleteConfirm(null)}
          onConfirm={handleBatchDelete}
        />
      )}

      {/* 批量改类型确认 */}
      {batchTypeConfirm && batchTypeConfig && (
        <ConfirmDialog
          title={batchTypeConfig.confirmTitle}
          description={`确定要将选中的 ${batchTypeConfirm.ids.length} 个${entityLabel}改为「${batchTypeConfig.typeLabels[batchTypeConfirm.value] ?? batchTypeConfirm.value}」吗？`}
          confirmLabel="确认修改"
          onClose={() => setBatchTypeConfirm(null)}
          onConfirm={handleBatchUpdate}
        />
      )}

      {/* AI 生成对话框 */}
      {aiConfig && (
        <AIGenerateImageDialog
          isOpen={isAIDialogOpen}
          onClose={() => setIsAIDialogOpen(false)}
          title={aiConfig.title}
          promptPlaceholder={aiConfig.promptPlaceholder}
          typeField={aiConfig.typeField}
          extraFields={aiConfig.extraFields}
          onConfirm={handleAIGenerateConfirm}
        />
      )}

      {/* 跨项目复制弹窗 */}
      {copyToProjects && (
        <CopyToProjectDialog
          isOpen={copyDialogItem !== null}
          onClose={() => setCopyDialogItem(null)}
          sourceItem={copyDialogItem ? { id: copyDialogItem.id, name: copyDialogItem.name, project_id: copyDialogItem.project_id } : null}
          entityLabel={entityLabel}
          onConfirm={handleCopyConfirm}
        />
      )}

      {/* 模板/预设选择器（任务15：三厂共性 - 资产模板） */}
      {enableTemplates && templateFetcher && (
        <TemplateSelector
          isOpen={isTemplateOpen}
          onClose={() => setIsTemplateOpen(false)}
          onSelect={handleApplyTemplate}
          entityType={entityTypeFromLabel(entityLabel)}
          entityLabel={entityLabel}
          fetcher={templateFetcher}
        />
      )}

      {/* 回收站：单个永久删除二次确认（强烈警告：无法恢复） */}
      {permanentDeleteConfirm && (
        <ConfirmDialog
          title={`永久删除「${permanentDeleteConfirm.name}」`}
          description={`⚠️ 此操作将彻底从数据库中移除「${permanentDeleteConfirm.name}」，无法恢复！\n\n请确认你真的要永久删除这个${entityLabel}。`}
          confirmLabel="永久删除"
          onClose={() => setPermanentDeleteConfirm(null)}
          onConfirm={() => {
            const item = deletedItems.find((it) => it.id === permanentDeleteConfirm.id);
            if (item) {
              void handlePermanentDeleteOne(item);
            } else {
              // 兜底：如果找不到对象（极端情况），仅清除 dialog
              setPermanentDeleteConfirm(null);
            }
          }}
        />
      )}

      {/* 回收站：批量永久删除二次确认 */}
      {batchPermanentDeleteConfirm !== null && (
        <ConfirmDialog
          title={`批量永久删除${entityLabel}`}
          description={`⚠️ 你即将永久删除 ${batchPermanentDeleteConfirm} 个${entityLabel}，该操作不可恢复！\n\n请再次确认。`}
          confirmLabel="永久删除"
          onClose={() => setBatchPermanentDeleteConfirm(null)}
          onConfirm={() => handleBatchPermanentDelete(batchPermanentDeleteConfirm)}
        />
      )}

      {/* 任务12：统一版本管理 - 版本历史弹窗 */}
      {fetchVersions && versionHistory && (
        <VersionHistoryDialog
          isOpen
          onClose={() => setVersionHistory(null)}
          entityType={fetchVersions.entityType}
          entityId={versionHistory.id}
          entityName={versionHistory.name}
          entityLabel={entityLabel}
          onRestored={() => {
            // 回滚后刷新当前列表
            clearApiCache();
            void reload();
          }}
        />
      )}
    </PageContainer>
  );
}

/** 根据 entityLabel 推导 entityType（用于 TemplateSelector 的类型 chip 渲染）。 */
function entityTypeFromLabel(label: string): TemplateEntityType {
  if (label.includes("角色")) return "character";
  if (label.includes("场景")) return "scene";
  if (label.includes("道具")) return "prop";
  return "character";
}

// 透传一些方便父组件直接使用的图标，避免父组件重复 import。
export { Pencil, Trash2, Copy };
