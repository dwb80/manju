/**
 * 通用模块 CRUD Hook
 *
 * 提供模块数据的加载、创建、更新、删除操作的统一封装。
 *
 * ⚠️ 已废弃（DEPRECATED）：
 * - 业务数据模块（角色/场景/道具/分镜/视频/音频/剪辑）请统一使用
 *   `useFactoryEntity` + `<FactoryCRUDPage>` 组合，详见 `@/components/factory`。
 * - 本 hook 仅保留给"系统级配置类"模块（如 ModelCenter）使用，
 *   因为这些模块没有 project_id 维度，不适合套用工厂模型。
 * - 新模块请勿引用。
 */

import { useState, useEffect, useCallback } from "react";
import { clearApiCache } from "@/lib/api-client";

export interface ModuleCrudState<T> {
  items: T[];
  isLoading: boolean;
  error: string | null;
}

export interface ModuleCrudActions<T, CreateInput, UpdateInput> {
  load: () => Promise<void>;
  create: (data: CreateInput) => Promise<T | null>;
  update: (id: string, data: UpdateInput) => Promise<T | null>;
  remove: (id: string) => Promise<boolean>;
  refresh: () => void;
}

export type ModuleCrudResult<T, CreateInput, UpdateInput> = ModuleCrudState<T> & ModuleCrudActions<T, CreateInput, UpdateInput>;

/**
 * 通用模块 CRUD Hook
 */
export function useModuleCrud<T extends { id: string }>(
  apiPath: string
): ModuleCrudResult<T, Partial<T>, Partial<T>> {
  const [items, setItems] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 加载数据
  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(apiPath);
      const payload = await response.json();
      if (!response.ok || payload.code !== 0) {
        throw new Error(payload.message || "加载失败");
      }
      setItems(payload.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [apiPath]);

  // 创建数据
  const create = useCallback(async (data: Partial<T>): Promise<T | null> => {
    try {
      const response = await fetch(apiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const payload = await response.json();
      if (!response.ok || payload.code !== 0) {
        throw new Error(payload.message || "创建失败");
      }
      const newItem = payload.data as T;
      setItems((prev) => [newItem, ...prev]);
      return newItem;
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建失败");
      return null;
    }
  }, [apiPath]);

  // 更新数据
  const update = useCallback(async (id: string, data: Partial<T>): Promise<T | null> => {
    try {
      const response = await fetch(`${apiPath}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const payload = await response.json();
      if (!response.ok || payload.code !== 0) {
        throw new Error(payload.message || "更新失败");
      }
      const updatedItem = payload.data as T;
      setItems((prev) => prev.map((item) => (item.id === id ? updatedItem : item)));
      return updatedItem;
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新失败");
      return null;
    }
  }, [apiPath]);

  // 删除数据
  const remove = useCallback(async (id: string): Promise<boolean> => {
    try {
      const response = await fetch(`${apiPath}/${id}`, {
        method: "DELETE",
      });
      const payload = await response.json();
      if (!response.ok || payload.code !== 0) {
        throw new Error(payload.message || "删除失败");
      }
      setItems((prev) => prev.filter((item) => item.id !== id));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
      return false;
    }
  }, [apiPath]);

  // 刷新数据（清除缓存后重新加载）
  const refresh = useCallback(() => {
    clearApiCache(apiPath);
    load();
  }, [apiPath, load]);

  // 初始加载
  useEffect(() => {
    load();
  }, [load]);

  return {
    items,
    isLoading,
    error,
    load,
    create,
    update,
    remove,
    refresh,
  };
}