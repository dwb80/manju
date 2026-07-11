/**
 * 通用工厂数据 hook
 *
 * 封装：
 * - useState + useEffect：根据 selectedProjectId 切换加载数据
 * - selectedIds 状态 + 项目切换时清空
 * - 列表 / 加载中状态
 */

import { useCallback, useEffect, useState } from "react";
import { useProjectStore } from "@/lib/stores/project-store";
import type { FactoryEntity } from "./types";

interface UseFactoryEntityResult<TEntity extends FactoryEntity> {
  /** 当前选中的项目 ID。 */
  selectedProjectId: string;
  /** 已加载的实体列表。 */
  items: TEntity[];
  /** 是否正在加载。 */
  isLoading: boolean;
  /** 重新加载列表。 */
  reload: () => Promise<void>;
  /** 列表 setter（外部可直接覆盖，例如乐观更新）。 */
  setItems: React.Dispatch<React.SetStateAction<TEntity[]>>;
  /** 选中的实体 id 集合。 */
  selectedIds: Set<string>;
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
}

/**
 * 通用工厂数据 hook：负责根据项目加载实体。
 * @param fetchList - 实际拉取列表的服务函数
 */
export function useFactoryEntity<TEntity extends FactoryEntity>(
  fetchList: (projectId: string) => Promise<TEntity[]>,
): UseFactoryEntityResult<TEntity> {
  const selectedProjectId = useProjectStore((state) => state.selectedProjectId);
  const [items, setItems] = useState<TEntity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const reload = useCallback(async () => {
    if (!selectedProjectId) {
      setItems([]);
      return;
    }
    const data = await fetchList(selectedProjectId);
    setItems(data);
  }, [selectedProjectId, fetchList]);

  useEffect(() => {
    if (!selectedProjectId) {
      setItems([]);
      return;
    }
    setIsLoading(true);
    reload()
      .catch((err) => console.error("useFactoryEntity: failed to load", err))
      .finally(() => setIsLoading(false));
  }, [selectedProjectId, reload]);

  // 切换项目时清空选择
  useEffect(() => {
    setSelectedIds(new Set());
  }, [selectedProjectId]);

  return {
    selectedProjectId,
    items,
    isLoading,
    reload,
    setItems,
    selectedIds,
    setSelectedIds,
  };
}
