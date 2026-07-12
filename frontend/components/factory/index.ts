/**
 * 通用工厂模块导出
 *
 * 角色 / 场景 / 道具三个工厂共享一个通用 CRUD 页面，
 * 各工厂只需要传入字段配置、数据 API 和卡片渲染函数即可。
 */

export { FactoryCRUDPage } from "./FactoryCRUDPage";
export { useFactoryEntity } from "./useFactoryEntity";
export { CopyToProjectDialog } from "@/components/shared/copy-to-project-dialog";
export { VersionHistoryDialog } from "@/components/shared/version-history-dialog";

// 评审优化（P1）：工厂页 Tab 筛选
export { FilterTabsBar } from "./filter-tabs-bar";
export type { FilterTabsBarProps } from "./filter-tabs-bar";
export { useFilterState } from "@/hooks/use-filter-state";
export type {
  UseFilterStateParams,
  UseFilterStateResult,
  FilterTabConfig,
  FilterTabId,
} from "@/hooks/use-filter-state";
export type {
  FactoryCRUDPageProps,
  FactoryEntity,
  FactoryEntityType,
  FactoryAIConfig,
  FactoryBatchTypeConfig,
  FilterOption,
  StatCardConfig,
  CardActions,
} from "./types";
export { getEntityLabel } from "./types";
export type { CopyToProjectDialogProps } from "@/components/shared/copy-to-project-dialog";
export type { VersionHistoryDialogProps } from "@/components/shared/version-history-dialog";
export { flattenUsageReferences } from "./usage-utils";
