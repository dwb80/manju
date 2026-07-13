"use client";

/**
 * 工作台：URL 同步 + 刷新入口
 *
 * 1. 路由 URL 上的 ?tab= 变化 → 同步到 projectWorkbenchTab
 * 2. projectWorkbenchTab 变化 → 回写到 URL
 * 3. refreshProjectWorkbench 入口（外部调用）
 */

import { useCallback, useEffect, useRef } from "react";
import type { Project, WorkbenchTab } from "@/lib/app-types";
import type { WorkbenchState } from "./useWorkbenchState";

const VALID_TABS: ReadonlySet<WorkbenchTab> = new Set<WorkbenchTab>([
  "overview", "tasks", "members", "episodes", "issues",
  "milestones", "scripts", "reviews", "storyboards", "clips", "assets",
]);

export function useWorkbenchUrlSync({
  state,
}: {
  state: WorkbenchState;
}) {
  const { projectWorkbenchTab, setProjectWorkbenchTab } = state;
  const lastTabRef = useRef<WorkbenchTab>(projectWorkbenchTab);

  // URL → 状态
  useEffect(() => {
    if (typeof window === "undefined") return;
    const search = new URLSearchParams(window.location.search);
    const tab = search.get("tab");
    if (tab && VALID_TABS.has(tab as WorkbenchTab)) {
      const next = tab as WorkbenchTab;
      if (next !== lastTabRef.current) {
        lastTabRef.current = next;
        setProjectWorkbenchTab(next);
      }
    }
  }, [setProjectWorkbenchTab]);

  // 状态 → URL
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (lastTabRef.current === projectWorkbenchTab) return;
    lastTabRef.current = projectWorkbenchTab;
    const search = new URLSearchParams(window.location.search);
    search.set("tab", projectWorkbenchTab);
    const next = `${window.location.pathname}?${search.toString()}${window.location.hash}`;
    window.history.replaceState(null, "", next);
  }, [projectWorkbenchTab]);

  return { projectWorkbenchTab, setProjectWorkbenchTab };
}

export function useRefreshTrigger() {
  // 占位刷新触发器（外部组件可以监听 workbenchVersionRef 决定是否需要重新加载）
  // 拆分后供 main hook 在 refreshProjectWorkbench 中递增此值（后续需要再补）
  const refresh = useCallback((_selectedProject: Project | undefined) => {
    /* no-op, 占位 */
  }, []);
  return refresh;
}
