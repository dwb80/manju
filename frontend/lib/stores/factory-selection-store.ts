/**
 * @file factory-selection-store.ts
 * @description 工厂页选中项共享 store
 *
 * 历史：FactoryCRUDPage 内部用 React state 管理 selectedIds，
 * 其它模块（storyboard-director / audio-center）需要跨组件读这份选中状态。
 * 早期实现是把 selectedIds 序列化成 DOM 属性 [data-factory-selected]，
 * 消费者用 setInterval 轮询 —— 存在以下问题：
 *   1. 500ms 延迟，用户操作后视觉滞后
 *   2. setInterval 不随组件卸载而停 → 内存泄漏 / 重复轮询
 *   3. DOM 是 UI 层的实现细节，跨组件通信应该用 store
 *
 * 本 store 用 Zustand 把选中态提到全局，按 entityType + projectId 隔离，
 * FactoryCRUDPage 写、消费组件订阅读。
 *
 * - key = `${entityType}:${projectId}`，避免不同项目 / 工厂之间互相污染
 * - 内部用 immutable Set（直接 set Set 引用即可，Zustand 会浅比较）
 */

import { create } from "zustand";
import { useProjectStore } from "./project-store";

export type FactorySelectionKey = string;

function makeKey(entityType: string, projectId: string): FactorySelectionKey {
  return `${entityType}:${projectId || "__none__"}`;
}

interface FactorySelectionState {
  /** 全量 key → 选中 id 集合 */
  byKey: Record<FactorySelectionKey, ReadonlySet<string>>;
  /** 设置某工厂的选中 id 集合（覆盖式） */
  setSelection: (entityType: string, projectId: string, ids: Iterable<string>) => void;
  /** 清空某工厂的选中 */
  clearSelection: (entityType: string, projectId: string) => void;
}

export const useFactorySelectionStore = create<FactorySelectionState>((set) => ({
  byKey: {},
  setSelection: (entityType, projectId, ids) => {
    const key = makeKey(entityType, projectId);
    const next = new Set(ids);
    set((state) => ({
      byKey: { ...state.byKey, [key]: next },
    }));
  },
  clearSelection: (entityType, projectId) => {
    const key = makeKey(entityType, projectId);
    set((state) => {
      if (!state.byKey[key]) return state;
      const { [key]: _omit, ...rest } = state.byKey;
      return { byKey: rest };
    });
  },
}));

/**
 * 读取指定 entityType 在当前选中项目下的选中 id 集合（响应式）。
 * 注意：返回值是 store 中的 Set 引用，不要就地修改。
 */
export function useFactorySelection(
  entityType: string,
  projectId?: string,
): ReadonlySet<string> {
  const resolvedProjectId =
    projectId ?? useProjectStore.getState().selectedProjectId;
  const key = makeKey(entityType, resolvedProjectId);
  return useFactorySelectionStore((state) => state.byKey[key] ?? EMPTY_SET);
}

const EMPTY_SET: ReadonlySet<string> = new Set();

/**
 * 写入 helper：通常在 useEffect 里把本地 state 同步到 store。
 * 如果不传 projectId，会自动从 useProjectStore 读取当前项目。
 */
export function syncFactorySelection(
  entityType: string,
  ids: Iterable<string>,
  projectId?: string,
): void {
  const resolvedProjectId =
    projectId ?? useProjectStore.getState().selectedProjectId;
  useFactorySelectionStore.getState().setSelection(entityType, resolvedProjectId, ids);
}
