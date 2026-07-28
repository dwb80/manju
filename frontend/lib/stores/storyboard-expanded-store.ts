/**
 * @file storyboard-expanded-store.ts
 * @description 分镜导演台行展开状态共享 store
 *
 * 历史：
 * - 分镜行的"展开镜头"按钮控制的是 StoryboardRow 内部 useState。
 * - 离开页面 / 刷新浏览器后状态会丢失，用户每次回来都要重新展开。
 * - 同时，多个分镜可能同时展开（没有限制），但 UI 状态无法跨组件共享。
 *
 * 本 store 持久化展开的分镜 ID 集合：
 * - key = `${projectId}`，按项目隔离
 * - 写操作：用户点击"展开/收起镜头"按钮时同步到 store
 * - 读操作：StoryboardRow 订阅当前 project 下"已展开"的 id 列表
 * - 用 zustand persist 中间件把 set 写到 localStorage，
 *   用户刷新后仍能保持之前展开的分镜
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useProjectStore } from "./project-store";

interface StoryboardExpandedState {
  /** projectId → 展开的分镜 id 集合 */
  byProject: Record<string, ReadonlySet<string>>;
  toggle: (projectId: string, storyboardId: string) => void;
  setExpanded: (projectId: string, storyboardId: string, expanded: boolean) => void;
  clear: (projectId: string) => void;
}

function makeKey(projectId: string) {
  return projectId || "__none__";
}

export const useStoryboardExpandedStore = create<StoryboardExpandedState>()(
  persist(
    (set) => ({
      byProject: {},
      toggle: (projectId, storyboardId) => {
        const key = makeKey(projectId);
        set((state) => {
          const current = state.byProject[key] ?? new Set<string>();
          const next = new Set(current);
          if (next.has(storyboardId)) next.delete(storyboardId);
          else next.add(storyboardId);
          return {
            byProject: { ...state.byProject, [key]: next },
          };
        });
      },
      setExpanded: (projectId, storyboardId, expanded) => {
        const key = makeKey(projectId);
        set((state) => {
          const current = state.byProject[key] ?? new Set<string>();
          const has = current.has(storyboardId);
          if (expanded === has) return state;
          const next = new Set(current);
          if (expanded) next.add(storyboardId);
          else next.delete(storyboardId);
          return {
            byProject: { ...state.byProject, [key]: next },
          };
        });
      },
      clear: (projectId) => {
        const key = makeKey(projectId);
        set((state) => {
          if (!state.byProject[key]) return state;
          const { [key]: _omit, ...rest } = state.byProject;
          return { byProject: rest };
        });
      },
    }),
    {
      name: "manju:storyboard-expanded",
      // Set 不可序列化，Zustand persist 默认会失败；转成数组后存盘
      storage: {
        getItem: (name) => {
          if (typeof window === "undefined") return null;
          try {
            const raw = window.localStorage.getItem(name);
            if (!raw) return null;
            const parsed = JSON.parse(raw) as {
              state?: { byProject?: Record<string, string[]> };
              version?: number;
            };
            const byProject: Record<string, ReadonlySet<string>> = {};
            for (const [k, v] of Object.entries(parsed.state?.byProject ?? {})) {
              byProject[k] = new Set(v);
            }
            return { state: { byProject }, version: parsed.version };
          } catch {
            return null;
          }
        },
        setItem: (name, value) => {
          if (typeof window === "undefined") return;
          try {
            const byProject: Record<string, string[]> = {};
            for (const [k, v] of Object.entries(value.state.byProject ?? {})) {
              byProject[k] = Array.from(v as Set<string>);
            }
            window.localStorage.setItem(
              name,
              JSON.stringify({ state: { byProject }, version: value.version }),
            );
          } catch {
            // ignore
          }
        },
        removeItem: (name) => {
          if (typeof window === "undefined") return;
          try {
            window.localStorage.removeItem(name);
          } catch {
            // ignore
          }
        },
      },
    },
  ),
);

/** 读取当前项目下"已展开"的分镜 id 集合（响应式）。 */
export function useStoryboardExpandedIds(projectId?: string): ReadonlySet<string> {
  const resolved = projectId ?? useProjectStore.getState().selectedProjectId;
  const key = makeKey(resolved);
  return useStoryboardExpandedStore((state) => state.byProject[key] ?? EMPTY_SET);
}

const EMPTY_SET: ReadonlySet<string> = new Set();
