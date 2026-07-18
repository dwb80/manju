/**
 * 通用工厂数据 hook
 *
 * 封装：
 * - useState + useEffect：根据 selectedProjectId 切换加载数据
 * - selectedIds 状态 + 项目切换时清空
 * - 列表 / 加载中状态
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useProjectStore } from "@/lib/stores/project-store";
import { useHasMounted } from "@/lib/hooks/use-has-mounted";
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
 * useFactoryEntity - 通用工厂数据 Hook
 * @description 负责根据项目加载实体，封装列表加载、选中状态管理等功能
 * @template TEntity - 工厂实体类型，需继承 FactoryEntity
 * @param {(projectId: string) => Promise<TEntity[]>} fetchList - 实际拉取列表的服务函数
 * @returns {UseFactoryEntityResult<TEntity>} 包含 items、isLoading、reload、selectedIds 等状态
 */
export function useFactoryEntity<TEntity extends FactoryEntity>(
  fetchList: (projectId: string) => Promise<TEntity[]>,
): UseFactoryEntityResult<TEntity> {
  const selectedProjectId = useProjectStore((state) => state.selectedProjectId);
  const hasMounted = useHasMounted();
  const [items, setItems] = useState<TEntity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 使用 ref 保存 fetchList，避免函数引用变化导致 useEffect 重复执行
  const fetchListRef = useRef(fetchList);
  fetchListRef.current = fetchList;

  const reload = useCallback(async () => {
    // 等待客户端 mount（zustand persist 从 localStorage 读取完成），
    // 避免 SSR/CSR 状态不一致导致的 hydration mismatch
    if (!selectedProjectId || !hasMounted) {
      setItems([]);
      return;
    }
    const data = await fetchListRef.current(selectedProjectId);
    setItems(data);
  }, [selectedProjectId, hasMounted]);

  useEffect(() => {
    if (!selectedProjectId || !hasMounted) {
      setItems([]);
      return;
    }
    setIsLoading(true);
    reload()
      .catch((err) => console.error("useFactoryEntity: failed to load", err))
      .finally(() => setIsLoading(false));
  }, [selectedProjectId, hasMounted, reload]);

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
