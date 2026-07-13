/**
 * 通用工厂 CRUD 页面（容器）
 *
 * 适用对象：角色 / 场景 / 道具工厂。
 * 把三个工厂 90% 同构的 UI / 状态管理抽到这一个组件里，
 * 各工厂只需要传入字段配置、数据 API 和卡片渲染函数即可。
 *
 * 不变量：
 * - 不动 entityType 业务逻辑。
 * - 不依赖具体后端服务名（通过 fetchList / createItem / updateItem / deleteItem 注入）。
 * - 与现有 FormDialog / ConfirmDialog / AIGenerateImageDialog 协同工作。
 *
 * 文件结构（v2 拆分后）：
 * - ./types.ts                                         类型定义
 * - ./useFactoryEntity.ts                              数据加载 hook
 * - ./useFactoryActions.ts                             所有 handle* 业务操作 hook
 * - ./useRecycleBin.ts                                 回收站 hook
 * - ./filter-tabs-bar.tsx                              自定义筛选 Tabs
 * - ./UsageDialog.tsx                                  引用来源弹窗
 * - ./parts/batch-change-type-menu.tsx                 批量改类型下拉
 * - ./parts/factory-batch-actions-bar.tsx              批量操作条
 * - ./parts/select-all-row.tsx                         顶部全选行
 * - ./parts/recycle-bin-row.tsx                        回收站行
 * - ./parts/entity-type-from-label.ts                  entityLabel -> TemplateEntityType
 * - ./parts/factory-view-tabs.tsx                      正常 / 回收站 切换器
 * - ./parts/factory-normal-view.tsx                    正常资产主视图
 * - ./parts/factory-recycle-bin-view.tsx               回收站视图
 * - ./parts/factory-dialogs.tsx                        所有对话框集合
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageContainer } from "@/components/layout/page-container";
import { getEntityLabel, type FactoryCRUDPageProps, type FactoryEntity } from "./types";
import { useFactoryEntity } from "./useFactoryEntity";
import { useFactoryActions } from "./useFactoryActions";
import { useRecycleBin } from "./useRecycleBin";
import { useFilterState } from "@/hooks/use-filter-state";
import { clearApiCache } from "@/lib/api-client";
import { FactoryViewTabs } from "./parts/factory-view-tabs";
import { FactoryNormalView } from "./parts/factory-normal-view";
import { FactoryRecycleBinView } from "./parts/factory-recycle-bin-view";
import { FactoryDialogs } from "./parts/factory-dialogs";
import { entityTypeFromLabel } from "./parts/entity-type-from-label";

const DEFAULT_GRID_CLASS = "grid-cols-1 md:grid-cols-2 lg:grid-cols-3";

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
    secondaryFilter,
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
    toolbarExtra,
    enableTemplates,
    templateFetcher,
    onApplyTemplate,
    fetchVersions,
    fetchReferences,
    insertToStoryboard,
    filterTabs,
  } = props;

  // ===== 数据加载 =====
  const { selectedProjectId, items, isLoading, reload, selectedIds, setSelectedIds } = useFactoryEntity(fetchList);

  // ===== 顶部筛选 Tabs（评审优化 P1：全部 / 最近使用 / 我创建的 / 已收藏） =====
  const {
    activeTab: filterActiveTab,
    setActiveTab: setFilterActiveTab,
    filteredItems: filterTabFiltered,
    tabConfig: filterTabConfig,
  } = useFilterState<TEntity>({
    items,
    getUpdatedAt: filterTabs?.getUpdatedAt ?? (() => undefined),
    getCreatedBy: filterTabs?.getCreatedBy,
    getIsFavorited: filterTabs?.getIsFavorited,
    currentUserId: filterTabs?.currentUserId,
    pageSize: filterTabs?.pageSize,
    moduleName: title,
  });

  const sourceItems: TEntity[] = filterTabs ? filterTabFiltered : items;

  // ===== 业务操作 hook =====
  const actions = useFactoryActions<TEntity>({
    selectedProjectId,
    items,
    reload,
    setSelectedIds,
    createItem,
    updateItem,
    deleteItem,
    restoreItem,
    batch,
    copyToProjects,
    insertToStoryboard,
    transformFormValues,
    fetchUsage,
    usageImpact,
    aiConfig,
    batchTypeConfig,
    onApplyTemplate,
    selectedIds,
    entityLabel,
  });

  // ===== 回收站 hook =====
  const recycleBin = useRecycleBin<TEntity>({
    selectedProjectId,
    fetchDeleted,
    restoreItem,
    permanentDelete,
    reload,
    setSelectedIds,
    selectedIds,
    entityLabel,
  });

  // ===== 搜索 / 过滤（受控 / 非受控） =====
  const [searchQuery, setSearchQuery] = useState("");
  const [internalFilterValue, setInternalFilterValue] = useState("");
  const filterValue = filterValueProp ?? internalFilterValue;
  const handleFilterChange = useCallback(
    (v: string) => {
      if (onFilterChange) onFilterChange(v);
      else setInternalFilterValue(v);
    },
    [onFilterChange],
  );
  const [internalSecondaryValue, setInternalSecondaryValue] = useState("");
  const secondaryValue = secondaryFilter?.value ?? internalSecondaryValue;
  const handleSecondaryChange = useCallback(
    (v: string) => {
      if (secondaryFilter?.onChange) secondaryFilter.onChange(v);
      else setInternalSecondaryValue(v);
    },
    [secondaryFilter],
  );

  // ===== 过滤 / 搜索 派生数据 =====
  const filteredItems = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return sourceItems.filter((it) => {
      if (q && !searchFields(it, q)) return false;
      if (filterField && filterValue && !filterField(it, filterValue)) return false;
      if (secondaryFilter && secondaryValue && !secondaryFilter.match(it, secondaryValue)) return false;
      return true;
    });
  }, [sourceItems, searchQuery, searchFields, filterField, filterValue, secondaryFilter, secondaryValue]);

  // ===== 引用懒加载 =====
  const [referencesMap, setReferencesMap] = useState<
    Record<string, { count: number; references: { id: string; title: string }[]; episodes: number[] }>
  >({});
  useEffect(() => {
    if (!fetchReferences) return;
    const visible = filteredItems.slice(0, 24); // 一次最多加载 24 条
    visible.forEach(async (it) => {
      if (referencesMap[it.id]) return;
      try {
        const data = await fetchReferences(it);
        setReferencesMap((prev) => ({ ...prev, [it.id]: data }));
      } catch (err) {
        console.warn("loadReferences failed", it.id, err);
      }
    });
    // 故意省略 referencesMap 依赖以避免循环
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredItems, fetchReferences]);

  // ===== 监听外部 reload 事件 =====
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => {
      reload().catch((err) => console.error("FactoryCRUDPage: external reload failed", err));
    };
    window.addEventListener("factory:reload", handler);
    return () => window.removeEventListener("factory:reload", handler);
  }, [reload]);

  // ===== 分页 =====
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const usePagination = props.pageSize !== undefined;
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

  // ===== 选中 =====
  const visibleIds = useMemo(() => pagedItems.map((it) => it.id), [pagedItems]);
  const isAllVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const isPartialVisible = visibleIds.some((id) => selectedIds.has(id)) && !isAllVisibleSelected;
  const toggleSelect = useCallback(
    (id: string) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    [setSelectedIds],
  );
  const clearSelection = useCallback(() => setSelectedIds(new Set()), [setSelectedIds]);
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

  // ===== 回收站：搜索过滤 + 全选 =====
  const recycleBinSearchQuery = recycleBin.activeView === "recycleBin" ? searchQuery : "";
  const recycleBinVisibleIds = useMemo(() => {
    if (recycleBin.activeView !== "recycleBin") return [];
    const q = searchQuery.toLowerCase();
    return recycleBin.deletedItems
      .filter((it) => !q || getEntityLabel(it).toLowerCase().includes(q))
      .map((it) => it.id);
  }, [recycleBin.activeView, recycleBin.deletedItems, searchQuery]);
  const allRecycleBinVisibleSelected =
    recycleBinVisibleIds.length > 0 && recycleBinVisibleIds.every((id) => selectedIds.has(id));
  const toggleSelectAllRecycleBinVisible = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allRecycleBinVisibleSelected) {
        recycleBinVisibleIds.forEach((id) => next.delete(id));
      } else {
        recycleBinVisibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }, [allRecycleBinVisibleSelected, recycleBinVisibleIds, setSelectedIds]);

  // ===== 视图组件的 props（集中组装，便于阅读） =====
  const normalViewProps = {
    entityLabel,
    listTitle,
    emptyTitle,
    searchPlaceholder,
    items,
    isLoading,
    filteredItems,
    pagedItems,
    statConfigs,
    selectedIds,
    visibleIds,
    isAllVisibleSelected,
    isPartialVisible,
    onToggleSelect: toggleSelect,
    onClearSelection: clearSelection,
    onToggleSelectVisible: toggleSelectVisible,
    onSelectAllFiltered: selectAllFiltered,
    searchQuery,
    onSearchChange: setSearchQuery,
    filterOptions,
    filterPlaceholder,
    filterValue,
    onFilterChange: handleFilterChange,
    secondaryFilter: secondaryFilter
      ? {
          options: secondaryFilter.options,
          value: secondaryValue,
          onChange: handleSecondaryChange,
          placeholder: secondaryFilter.placeholder,
        }
      : undefined,
    filterTabs: filterTabs
      ? { activeTab: filterActiveTab, setActiveTab: setFilterActiveTab, tabConfig: filterTabConfig }
      : undefined,
    usePagination,
    currentPage,
    totalPages,
    pageSize,
    onPageChange: setCurrentPage,
    onPageSizeChange: setPageSize,
    selectAllLabel,
    gridClassName,
    renderCard,
    referencesMap,
    actions: {
      openCreate: actions.openCreate,
      openEdit: actions.openEdit,
      requestDelete: actions.requestDelete,
      openAIDialog: actions.openAIDialog,
      openTemplateSelector: actions.openTemplateSelector,
      openVersionHistory: actions.openVersionHistory,
      openVersionHistoryShortcut: actions.openVersionHistoryShortcut,
      setBatchDeleteConfirm: actions.setBatchDeleteConfirm,
      setBatchTypeConfirm: actions.setBatchTypeConfirm,
      setCopyDialogItem: actions.setCopyDialogItem,
      openUsageDialog: actions.openUsageDialog,
      handleInsertToStoryboard: actions.handleInsertToStoryboard,
    },
    hasFetchVersions: Boolean(fetchVersions),
    hasCopyToProjects: Boolean(copyToProjects),
    hasFetchReferences: Boolean(fetchReferences),
    hasInsertToStoryboard: Boolean(insertToStoryboard),
    insertingId: actions.insertingId,
    hasAI: Boolean(aiConfig),
    aiButtonLabel: aiConfig?.buttonLabel,
    hasTemplates: Boolean(enableTemplates && templateFetcher),
    batchTypeConfig,
    toolbarExtra,
    extraToolbarContent,
    loadingView,
  } as const;

  const recycleBinViewProps = {
    entityLabel,
    recycleBinMetaLabel,
    deletedItems: recycleBin.deletedItems,
    isLoading: recycleBin.isRecycleBinLoading,
    loadingView,
    searchQuery: recycleBinSearchQuery,
    onSearchChange: setSearchQuery,
    selectedIds,
    onToggleSelect: toggleSelect,
    onClearSelection: clearSelection,
    onToggleSelectAllVisible: toggleSelectAllRecycleBinVisible,
    visibleIds: recycleBinVisibleIds,
    switchToNormal: recycleBin.switchToNormal,
    handleRestoreOne: recycleBin.handleRestoreOne,
    onRequestPermanentDelete: (item: TEntity) =>
      recycleBin.setPermanentDeleteConfirm({ id: item.id, name: getEntityLabel(item) }),
    onRequestBatchPermanentDelete: recycleBin.setBatchPermanentDeleteConfirm,
    handleBatchRestore: recycleBin.handleBatchRestore,
  } as const;

  const dialogsProps = {
    // 表单
    isFormOpen: actions.isFormOpen,
    onCloseForm: actions.closeForm,
    editing: actions.editing,
    isSaving: actions.isSaving,
    fields,
    toFormValues,
    templateInitialValues: actions.templateInitialValues,
    onSave: actions.handleSave,
    entityLabel,
    // 单个删除
    deleteConfirm: actions.deleteConfirm,
    onCloseDeleteConfirm: () => actions.setDeleteConfirm(null),
    onConfirmDelete: actions.handleDeleteConfirm,
    usageImpact,
    // 批量删除
    batchDeleteConfirm: actions.batchDeleteConfirm,
    onCloseBatchDeleteConfirm: () => actions.setBatchDeleteConfirm(null),
    onConfirmBatchDelete: actions.handleBatchDelete,
    // 批量改类型
    batchTypeConfig,
    batchTypeConfirm: actions.batchTypeConfirm,
    onCloseBatchTypeConfirm: () => actions.setBatchTypeConfirm(null),
    onConfirmBatchTypeUpdate: actions.handleBatchUpdate,
    // AI
    aiConfig,
    isAIDialogOpen: actions.isAIDialogOpen,
    onCloseAIDialog: () => actions.setIsAIDialogOpen(false),
    onConfirmAIGenerate: actions.handleAIGenerateConfirm,
    isAIGenerating: actions.isAIGenerating,
    // 跨项目复制
    hasCopyToProjects: Boolean(copyToProjects),
    copyDialogItem: actions.copyDialogItem,
    onCloseCopyDialog: () => actions.setCopyDialogItem(null),
    onConfirmCopy: actions.handleCopyConfirm,
    // 模板
    hasTemplates: Boolean(enableTemplates),
    isTemplateOpen: actions.isTemplateOpen,
    onCloseTemplateSelector: () => actions.setIsTemplateOpen(false),
    onSelectTemplate: actions.handleApplyTemplate,
    templateEntityType: entityTypeFromLabel(entityLabel),
    templateFetcher,
    // 回收站永久删除
    permanentDeleteConfirm: recycleBin.permanentDeleteConfirm,
    onClosePermanentDeleteConfirm: () => recycleBin.setPermanentDeleteConfirm(null),
    onConfirmPermanentDeleteOne: recycleBin.handlePermanentDeleteOne,
    deletedItems: recycleBin.deletedItems,
    batchPermanentDeleteConfirm: recycleBin.batchPermanentDeleteConfirm,
    onCloseBatchPermanentDeleteConfirm: () => recycleBin.setBatchPermanentDeleteConfirm(null),
    onConfirmBatchPermanentDelete: recycleBin.handleBatchPermanentDelete,
    // 版本历史
    versionHistory: actions.versionHistory,
    onCloseVersionHistory: () => actions.setVersionHistory(null),
    versionEntityType: fetchVersions?.entityType,
    onVersionHistoryRestored: () => {
      clearApiCache();
      void reload();
    },
    // 引用来源
    usageDialog: actions.usageDialog,
    onCloseUsageDialog: () => actions.setUsageDialog(null),
  } as const;

  return (
    <PageContainer title={title} description={description}>
      <div data-factory-selected={JSON.stringify(Array.from(selectedIds))} style={{ display: "contents" }} />

      {/* 顶部 Tab：正常资产 / 回收站 */}
      {recycleBin.recycleBinEnabled && (
        <FactoryViewTabs
          entityLabel={entityLabel}
          activeView={recycleBin.activeView}
          normalCount={items.length}
          recycleBinCount={recycleBin.deletedItems.length}
          onChange={(mode) => (mode === "normal" ? recycleBin.switchToNormal() : recycleBin.switchToRecycleBin())}
        />
      )}

      {/* ===== 正常视图 ===== */}
      {recycleBin.activeView === "normal" && <FactoryNormalView {...normalViewProps} />}

      {/* ===== 回收站视图 ===== */}
      {recycleBin.activeView === "recycleBin" && recycleBin.recycleBinEnabled && (
        <FactoryRecycleBinView {...recycleBinViewProps} />
      )}

      {/* ===== 所有对话框 ===== */}
      <FactoryDialogs {...dialogsProps} />
    </PageContainer>
  );
}
